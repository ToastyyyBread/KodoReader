const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const AdmZip = require('adm-zip');
const dns = require('dns').promises;
const os = require('os');
let sharp = null;
try {
    sharp = require('sharp');
} catch {
    sharp = null;
}

const APP_ROOT = process.env.KODO_APP_ROOT || path.join(__dirname, '..');
const RESOURCE_ROOT = process.env.KODO_RESOURCE_ROOT || path.join(__dirname, '..');
const MANGA_PATH = path.resolve((process.env.KODO_MANGA_PATH || path.join(APP_ROOT, 'manga')));
const DATA_DIR = path.join(APP_ROOT, 'data');
const META_PATH = path.join(DATA_DIR, 'meta.json');
const QUEUE_PATH = path.join(DATA_DIR, 'upscale-queue.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'upscale-settings.json');
const ARCHIVE_DIR = path.join(DATA_DIR, 'archive');
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|avif)$/i;
const getAppdataFolder = () => process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.local', 'share'));
const UPSCALER_DIR = path.join(getAppdataFolder(), 'kodo', 'packages', 'upscale_package');

const UPSCALER_PACKAGE_STATE_PATH = path.join(DATA_DIR, 'upscaler-model-package.json');
const UPSCALER_PACKAGE_TMP_DIR = path.join(DATA_DIR, 'downloads');
const UPSCALER_PACKAGE_TMP_FILE = path.join(UPSCALER_PACKAGE_TMP_DIR, 'upscaler-models.zip.part');
const UPSCALER_EXTRACT_TMP_DIR = path.join(DATA_DIR, 'upscaler-install-staging');
const normalizeEnvValue = (value) => String(value || '').trim().replace(/^["']|["']$/g, '');
const WAIFU2X_RUST_RUNNER = normalizeEnvValue(process.env.KODO_WAIFU2X_RUNNER);
const REALESRGAN_RUST_RUNNER = normalizeEnvValue(process.env.KODO_REALESRGAN_RUNNER);
const getConfigPaths = () => {
    const appDataRoot = process.env.APPDATA || '';
    const exeDir = path.dirname(process.execPath || '');
    const requestedConfigPath = normalizeEnvValue(process.env.KODO_CONFIG_PATH);
    const candidates = [
        requestedConfigPath,
        path.join(APP_ROOT, 'config.json'),
        appDataRoot ? path.join(appDataRoot, 'kodo', 'config.json') : '',
        appDataRoot ? path.join(appDataRoot, 'Kodo', 'config.json') : '',
        path.join(RESOURCE_ROOT, '_up_', 'config.json'),
        path.join(RESOURCE_ROOT, 'config.json'),
        path.join(__dirname, '..', 'config.json'),
        path.resolve(process.cwd(), 'config.json'),
        exeDir ? path.join(exeDir, 'config.json') : '',
        exeDir ? path.resolve(exeDir, '..', 'config.json') : '',
    ];
    return Array.from(new Set(
        candidates
            .filter(Boolean)
            .map((p) => path.resolve(p))
    ));
};
const getConfigValue = (key) => {
    for (const p of getConfigPaths()) {
        try {
            if (!fs.existsSync(p)) continue;
            const parsed = fs.readJsonSync(p);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
            const raw = parsed[key];
            const value = normalizeEnvValue(raw);
            if (value) return value;
        } catch { }
    }
    return '';
};
const getUpscalerPackageSource = () => {
    return getConfigValue('upscalerPackageUrl');
};
const getUpscalerPackageSha256 = () => {
    return getConfigValue('upscalerPackageSha256').toLowerCase();
};
const UPSCALER_EXE_WAIFU2X = 'waifu2x-ncnn-vulkan.exe';
const UPSCALER_EXE_REALESRGAN = 'realesrgan-ncnn-vulkan.exe';

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(ARCHIVE_DIR);
fs.ensureDirSync(UPSCALER_PACKAGE_TMP_DIR);

const isValidFile = (targetPath) => {
    try {
        return Boolean(targetPath) && fs.existsSync(targetPath) && fs.statSync(targetPath).isFile();
    } catch {
        return false;
    }
};

let rustWaifuRunnerLogEmitted = false;
let rustRealesrganRunnerLogEmitted = false;
const resolveUpscalerSpawnTarget = (exe, args, model) => {
    const cwd = path.dirname(exe);
    if (model === 'realesrgan' && isValidFile(REALESRGAN_RUST_RUNNER)) {
        if (!rustRealesrganRunnerLogEmitted) {
            rustRealesrganRunnerLogEmitted = true;
            console.log(`[Upscaler] Real-ESRGAN using Rust runner: ${REALESRGAN_RUST_RUNNER}`);
        }
        return {
            command: REALESRGAN_RUST_RUNNER,
            args: ['--kodo-realesrgan-runner', '--exe', exe, '--cwd', cwd, '--', ...args],
            cwd,
        };
    }

    // Keep waifu2x direct spawn to avoid cancellation edge cases observed with wrapper mode.
    if (model === 'waifu2x' && isValidFile(WAIFU2X_RUST_RUNNER) && !rustWaifuRunnerLogEmitted) {
        rustWaifuRunnerLogEmitted = true;
        console.log('[Upscaler] Waifu2x Rust runner detected but direct spawn path is active.');
    }
    return { command: exe, args, cwd };
};

let waifuModelArgNormalizeLogEmitted = false;
const normalizeWaifu2xModelArg = (exePath, modelDirInput) => {
    const fallback = 'models-cunet';
    const raw = String(modelDirInput || '').trim().replace(/^["']|["']$/g, '');
    const requested = raw || fallback;
    const exeDir = path.dirname(exePath || '');
    if (!exeDir) return requested;

    if (path.isAbsolute(requested)) {
        const rel = path.relative(exeDir, requested);
        const relInsideExe = rel && !rel.startsWith('..') && !path.isAbsolute(rel);
        if (relInsideExe) {
            const normalizedRel = rel.replace(/\\/g, '/');
            if (!waifuModelArgNormalizeLogEmitted) {
                waifuModelArgNormalizeLogEmitted = true;
                console.log(`[Upscaler] Normalized waifu2x model path to relative: ${normalizedRel}`);
            }
            return normalizedRel;
        }

        // If absolute path points to a folder name that also exists under exe dir, prefer local relative form.
        const baseName = path.basename(requested);
        if (baseName && fs.existsSync(path.join(exeDir, baseName))) {
            if (!waifuModelArgNormalizeLogEmitted) {
                waifuModelArgNormalizeLogEmitted = true;
                console.log(`[Upscaler] Normalized waifu2x model path to local folder: ${baseName}`);
            }
            return baseName;
        }
    }

    return requested;
};

const toPositiveInt = (value, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const rounded = Math.round(parsed);
    return rounded > 0 ? rounded : fallback;
};

const getWaifu2xThreadPlan = (workerHint = 3) => {
    const envProc = toPositiveInt(process.env.KODO_WAIFU2X_PROC_THREADS, 0);
    const envLoad = toPositiveInt(process.env.KODO_WAIFU2X_LOAD_THREADS, 0);
    const envSave = toPositiveInt(process.env.KODO_WAIFU2X_SAVE_THREADS, 0);
    const cpuCount = Math.max(2, os.cpus()?.length || 4);
    const baseProc = Math.max(workerHint * 2, Math.floor(cpuCount / 2));
    const proc = envProc || Math.max(2, Math.min(12, baseProc));
    const load = envLoad || (proc >= 6 ? 2 : 1);
    const save = envSave || 2;
    return { load, proc, save };
};

const parseOptionalInt = (value) => {
    if (value === undefined || value === null) return null;
    const raw = String(value).trim();
    if (!raw.length) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(parsed);
};

const clampInt = (value, min, max) => Math.max(min, Math.min(max, value));

const getRealEsrganThreadPlan = (workerHint = 1, workload = {}) => {
    const envProc = toPositiveInt(process.env.KODO_REALESRGAN_PROC_THREADS, 0);
    const envLoad = toPositiveInt(process.env.KODO_REALESRGAN_LOAD_THREADS, 0);
    const envSave = toPositiveInt(process.env.KODO_REALESRGAN_SAVE_THREADS, 0);

    // Instead of auto-scaling GPU compute pipelines by CPU count (which crashes VRAM),
    // strictly respect the user's chosen instance count (workerHint).
    const proc = envProc || clampInt(workerHint, 1, 8);
    const load = envLoad || clampInt(Math.floor(proc / 2) || 1, 1, 4);
    const save = envSave || clampInt(Math.ceil(proc / 2) || 1, 1, 4);

    return { load, proc, save };
};

const getRealEsrganTileSize = (workload = {}) => {
    const envTileRaw = process.env.KODO_REALESRGAN_TILE_SIZE ?? process.env.KODO_REALESRGAN_TILE;
    const envTile = parseOptionalInt(envTileRaw);
    if (envTile !== null) return Math.max(0, envTile);

    const maxPixels = Number(workload.maxPixels || 0);

    // Prevent VRAM overflow: 0 means no tiling (whole image loaded to VRAM)
    // which leads to freezing/stalling on "loading model". Use 256 as safe fallback.
    if (!Number.isFinite(maxPixels) || maxPixels <= 0) return 256;

    if (maxPixels >= 16_000_000) return 128;
    if (maxPixels >= 10_000_000) return 192;
    if (maxPixels >= 6_000_000) return 256;
    if (maxPixels >= 3_000_000) return 256;
    return 256;
};

const getSupportedRealEsrganScales = () => {
    const raw = String(process.env.KODO_REALESRGAN_SUPPORTED_SCALES || '2,4');
    const parsed = raw
        .split(',')
        .map(v => Number(String(v).trim()))
        .filter(v => Number.isFinite(v) && v > 0)
        .map(v => Math.round(v));
    return parsed.length ? Array.from(new Set(parsed)) : [2, 4];
};

const normalizeRealEsrganScale = (requestedScale) => {
    const supported = getSupportedRealEsrganScales();
    const requested = Number(requestedScale);
    if (Number.isFinite(requested)) {
        const rounded = Math.round(requested);
        if (supported.includes(rounded)) return rounded;
    }
    return supported[0];
};

const detectRealEsrganWorkload = async (inputDir, inputImages) => {
    const fallback = { maxPixels: 0, sampleCount: 0 };
    if (!sharp || !Array.isArray(inputImages) || inputImages.length === 0) return fallback;

    const sampleCount = clampInt(
        toPositiveInt(process.env.KODO_REALESRGAN_TUNE_SAMPLE, 6) || 6,
        1,
        Math.min(12, inputImages.length),
    );
    const sampled = inputImages.slice(0, sampleCount);

    try {
        const pixelCounts = await Promise.all(sampled.map(async (fileName) => {
            try {
                const meta = await sharp(path.join(inputDir, fileName), { failOn: 'none', limitInputPixels: false }).metadata();
                if (!meta?.width || !meta?.height) return 0;
                return meta.width * meta.height;
            } catch {
                return 0;
            }
        }));
        const maxPixels = pixelCounts.reduce((acc, val) => (val > acc ? val : acc), 0);
        return { maxPixels, sampleCount };
    } catch {
        return fallback;
    }
};

const extractNcnnProgressPercent = (text) => {
    if (!text) return null;
    const matches = String(text).match(/(\d{1,3}(?:\.\d+)?)%/g);
    if (!matches || matches.length === 0) return null;
    const last = matches[matches.length - 1];
    const parsed = Number(last.replace('%', ''));
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.min(100, parsed));
};

const isExistingDirectory = (targetPath) => {
    try {
        return Boolean(targetPath) && fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
    } catch {
        return false;
    }
};

const loadMeta = () => {
    try { return fs.readJsonSync(META_PATH); } catch { return {}; }
};

const normalizeInputPath = (rawPath) => {
    const trimmed = String(rawPath || '').trim();
    if (!trimmed) return '';
    const unquoted = trimmed.replace(/^"(.*)"$/, '$1');
    return path.resolve(unquoted);
};

const resolveLinkedPath = (absPath, relPath) => {
    const normalizedAbs = normalizeInputPath(absPath);
    if (normalizedAbs && fs.existsSync(normalizedAbs)) return normalizedAbs;

    const normalizedRel = String(relPath || '').trim();
    if (normalizedRel) {
        const candidate = path.resolve(MANGA_PATH, normalizedRel);
        if (fs.existsSync(candidate)) return candidate;
    }

    return '';
};

const resolveMangaDirFromMeta = (id, meta) => {
    const m = meta[id] || {};
    const linkedPath = resolveLinkedPath(m.sourcePath, m.sourcePathRel);
    if (linkedPath) return linkedPath;
    return path.join(MANGA_PATH, id);
};

const resolveVersionDirFromMeta = (id, vId, meta) => {
    const m = meta[id] || {};
    if (Array.isArray(m.versions)) {
        const v = m.versions.find(ver => ver.id === vId);
        if (v) {
            const linkedPath = resolveLinkedPath(v.folderPath, v.folderPathRel);
            if (linkedPath) return linkedPath;
        }
    }
    return path.join(MANGA_PATH, id, 'versions', vId);
};

const resolveJobMangaDir = (job) => {
    const meta = loadMeta();
    if (job?.versionId && job.versionId !== 'default') {
        return resolveVersionDirFromMeta(job.mangaId, job.versionId, meta);
    }
    return resolveMangaDirFromMeta(job.mangaId, meta);
};

const normalizeChapterKey = (value) => {
    return String(value || '')
        .normalize('NFKC')
        .replace(/[â€œâ€]/g, '"')
        .replace(/[â€˜â€™]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
};

const resolveChapterPaths = (mangaDir, chapterName) => {
    const directFolder = path.join(mangaDir, chapterName);
    const directCbz = path.join(mangaDir, `${chapterName}.cbz`);
    if (isExistingDirectory(directFolder)) {
        return {
            found: true,
            chapterBaseName: chapterName,
            folderPath: directFolder,
            cbzPath: directCbz,
            isCbz: false,
        };
    }
    if (isValidFile(directCbz)) {
        return {
            found: true,
            chapterBaseName: chapterName,
            folderPath: directFolder,
            cbzPath: directCbz,
            isCbz: true,
        };
    }

    let entries = [];
    try {
        entries = fs.readdirSync(mangaDir, { withFileTypes: true });
    } catch {
        return {
            found: false,
            chapterBaseName: chapterName,
            folderPath: directFolder,
            cbzPath: directCbz,
            isCbz: false,
        };
    }

    const candidates = [];
    for (const entry of entries) {
        const full = path.join(mangaDir, entry.name);
        const isDir = entry.isDirectory() || (entry.isSymbolicLink() && isExistingDirectory(full));
        const isCbz = (entry.isFile() || (entry.isSymbolicLink() && isValidFile(full))) && /\.cbz$/i.test(entry.name);
        if (isDir) {
            candidates.push({ chapterBaseName: entry.name, isCbz: false });
        } else if (isCbz) {
            candidates.push({ chapterBaseName: entry.name.replace(/\.cbz$/i, ''), isCbz: true });
        }
    }

    const desired = String(chapterName || '');
    const desiredLower = desired.toLowerCase();
    const desiredNorm = normalizeChapterKey(desired);
    const match = candidates.find(c => c.chapterBaseName === desired)
        || candidates.find(c => c.chapterBaseName.toLowerCase() === desiredLower)
        || candidates.find(c => normalizeChapterKey(c.chapterBaseName) === desiredNorm);

    if (!match) {
        return {
            found: false,
            chapterBaseName: chapterName,
            folderPath: directFolder,
            cbzPath: directCbz,
            isCbz: false,
        };
    }

    const resolvedName = match.chapterBaseName;
    return {
        found: true,
        chapterBaseName: resolvedName,
        folderPath: path.join(mangaDir, resolvedName),
        cbzPath: path.join(mangaDir, `${resolvedName}.cbz`),
        isCbz: match.isCbz,
    };
};

const normalizeRealEsrganModelId = (model) => {
    if (model === 'RealESRGAN_x4plus_anime_6B') return 'realesrgan-x4plus-anime';
    return String(model || '').trim();
};

const pickPreferredRealEsrganModel = (models = [], fallback = 'realesrgan-x4plus-anime') => {
    const normalized = Array.isArray(models)
        ? models.map(m => normalizeRealEsrganModelId(m)).filter(Boolean)
        : [];
    if (!normalized.length) return normalizeRealEsrganModelId(fallback) || 'realesrgan-x4plus-anime';
    if (normalized.includes('realesrgan-x4plus-anime')) return 'realesrgan-x4plus-anime';
    if (normalized.includes('realesrgan-x4plus')) return 'realesrgan-x4plus';
    return normalized[0];
};

const isSubPath = (parentDir, targetDir) => {
    if (!parentDir || !targetDir) return false;
    const rel = path.relative(parentDir, targetDir);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

const walkForFile = (rootDir, fileName, maxDepth = 4) => {
    if (!rootDir || !fs.existsSync(rootDir)) return '';
    const queue = [{ dir: rootDir, depth: 0 }];
    while (queue.length > 0) {
        const current = queue.shift();
        const directHit = path.join(current.dir, fileName);
        if (isValidFile(directHit)) return directHit;
        if (current.depth >= maxDepth) continue;
        let entries = [];
        try {
            entries = fs.readdirSync(current.dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            queue.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 });
        }
    }
    return '';
};

const walkForFileMatching = (rootDir, fileName, predicate, maxDepth = 5) => {
    if (!rootDir || !fs.existsSync(rootDir)) return '';
    const queue = [{ dir: rootDir, depth: 0 }];
    while (queue.length > 0) {
        const current = queue.shift();
        const directHit = path.join(current.dir, fileName);
        if (isValidFile(directHit)) {
            try {
                if (!predicate || predicate(directHit)) return directHit;
            } catch { }
        }
        if (current.depth >= maxDepth) continue;
        let entries = [];
        try {
            entries = fs.readdirSync(current.dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            queue.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 });
        }
    }
    return '';
};

const getUpscalerSearchRoots = () => {
    const roots = [];
    const add = (dir) => {
        if (!dir) return;
        const resolved = path.resolve(dir);
        if (!roots.includes(resolved) && fs.existsSync(resolved)) roots.push(resolved);
    };
    add(UPSCALER_DIR);
    add(path.join(RESOURCE_ROOT, 'upscaler'));
    return roots;
};

const getWaifu2xModelAbsDir = (exePath, modelDirInput = 'models-cunet') => {
    if (!exePath || !isValidFile(exePath)) return '';
    const modelArg = normalizeWaifu2xModelArg(exePath, modelDirInput || 'models-cunet');
    if (!modelArg) return '';
    return path.isAbsolute(modelArg) ? modelArg : path.join(path.dirname(exePath), modelArg);
};

const hasWaifu2xModelFilesForExe = (exePath, modelDirInput = 'models-cunet') => {
    try {
        if (!isValidFile(exePath)) return false;
        const modelDir = getWaifu2xModelAbsDir(exePath, modelDirInput);
        if (!modelDir || !fs.existsSync(modelDir) || !fs.statSync(modelDir).isDirectory()) return false;
        const files = fs.readdirSync(modelDir);
        const hasParam = files.some(f => /\.param$/i.test(f));
        const hasBin = files.some(f => /\.bin$/i.test(f));
        return hasParam && hasBin;
    } catch {
        return false;
    }
};

const selectFirstUsableWaifu2xExe = (candidates, modelDirInput = 'models-cunet') => {
    for (const candidate of candidates) {
        if (hasWaifu2xModelFilesForExe(candidate, modelDirInput)) return candidate;
    }
    for (const candidate of candidates) {
        if (isValidFile(candidate)) return candidate;
    }
    return '';
};

const detectManagedExecutables = () => {
    let waifu2xExe = '';
    let realesrganExe = '';
    for (const root of getUpscalerSearchRoots()) {
        if (!waifu2xExe) waifu2xExe = walkForFile(root, UPSCALER_EXE_WAIFU2X, 5);
        if (!realesrganExe) realesrganExe = walkForFile(root, UPSCALER_EXE_REALESRGAN, 5);
        if (waifu2xExe && realesrganExe) break;
    }
    return { waifu2xExe, realesrganExe };
};

const getDefaultWaifu2xExe = () => {
    const hardcoded = path.join(UPSCALER_DIR, 'waifu2x-ncnn-vulkan-20250915-windows', UPSCALER_EXE_WAIFU2X);
    const managed = path.join(UPSCALER_DIR, 'waifu2x_backend', UPSCALER_EXE_WAIFU2X);
    const bundled = path.join(RESOURCE_ROOT, 'upscaler', 'waifu2x-ncnn-vulkan-20250915-windows', UPSCALER_EXE_WAIFU2X);
    const bundledLegacy = path.join(RESOURCE_ROOT, 'upscaler', 'waifu2x_backend', UPSCALER_EXE_WAIFU2X);
    const preferred = selectFirstUsableWaifu2xExe([
        hardcoded,
        managed,
        bundled,
        bundledLegacy,
    ], 'models-cunet');
    if (preferred) return preferred;

    for (const root of getUpscalerSearchRoots()) {
        const found = walkForFileMatching(root, UPSCALER_EXE_WAIFU2X, (exePath) => hasWaifu2xModelFilesForExe(exePath, 'models-cunet'), 6);
        if (found) return found;
    }

    return detectManagedExecutables().waifu2xExe || '';
};

const getDefaultRealesrganExe = () => {
    const managed = path.join(UPSCALER_DIR, 'realesrgan-ncnn-vulkan-20210901-windows', UPSCALER_EXE_REALESRGAN);
    if (isValidFile(managed)) return managed;
    const bundled = path.join(RESOURCE_ROOT, 'upscaler', 'realesrgan-ncnn-vulkan-20210901-windows', UPSCALER_EXE_REALESRGAN);
    if (isValidFile(bundled)) return bundled;
    return detectManagedExecutables().realesrganExe || '';
};

// Check if upscaler directory has model content (non-empty)
const isUpscalerDirPopulated = () => {
    try {
        if (!fs.existsSync(UPSCALER_DIR)) return false;
        const entries = fs.readdirSync(UPSCALER_DIR);
        return entries.length > 0;
    } catch { return false; }
};

const hydrateExecutablePaths = (settings) => {
    const next = { ...settings };
    next.waifu2xPath = getDefaultWaifu2xExe();
    next.realesrganPath = getDefaultRealesrganExe();
    return next;
};

const defaultPackageState = {
    status: 'idle', // idle | downloading | extracting | done | error
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speedBytesPerSec: 0,
    error: '',
    updatedAt: 0,
    lastInstallAt: 0,
};

const loadPackageState = () => {
    try {
        return { ...defaultPackageState, ...fs.readJsonSync(UPSCALER_PACKAGE_STATE_PATH) };
    } catch {
        return { ...defaultPackageState };
    }
};

const savePackageState = (state) => {
    fs.writeJsonSync(UPSCALER_PACKAGE_STATE_PATH, state, { spaces: 2 });
};

let packageState = loadPackageState();
let packageInstallPromise = null;
let packageInstallAbortController = null;

const markInstallCancelledError = (message = 'Installation cancelled by user.') => {
    const err = new Error(message);
    err.code = 'INSTALL_CANCELLED';
    return err;
};

const isInstallCancelledError = (err) => (
    err?.code === 'INSTALL_CANCELLED'
    || err?.name === 'AbortError'
    || /cancelled by user/i.test(String(err?.message || ''))
);

const markJobCancelledError = (message = 'Upscale job cancelled by user.') => {
    const err = new Error(message);
    err.code = 'JOB_CANCELLED';
    return err;
};

const isJobCancelledError = (err) => (
    err?.code === 'JOB_CANCELLED'
    || /job cancelled by user/i.test(String(err?.message || ''))
);

const updatePackageState = (patch) => {
    const next = {
        ...packageState,
        ...patch,
        updatedAt: Date.now(),
    };
    if (next.status === 'idle') {
        next.progress = 0;
        next.downloadedBytes = 0;
        next.totalBytes = 0;
        next.speedBytesPerSec = 0;
    }
    packageState = next;
    savePackageState(packageState);
};

const ensureSettingsAutoDetected = (persist = false) => {
    const current = (() => {
        try { return { ...defaultSettings, ...fs.readJsonSync(SETTINGS_PATH) }; }
        catch { return { ...defaultSettings }; }
    })();
    const hydrated = hydrateExecutablePaths(current);
    const changed = hydrated.waifu2xPath !== current.waifu2xPath || hydrated.realesrganPath !== current.realesrganPath;
    if (changed && persist) saveSettings(hydrated);
    return hydrated;
};

const resolvePackageCopySource = (extractRoot) => {
    if (!fs.existsSync(extractRoot)) return '';
    const directUpscaler = path.join(extractRoot, 'upscaler');
    if (fs.existsSync(directUpscaler) && fs.statSync(directUpscaler).isDirectory()) return directUpscaler;

    let entries = [];
    try {
        entries = fs.readdirSync(extractRoot, { withFileTypes: true }).filter(e => e.isDirectory());
    } catch {
        return extractRoot;
    }
    if (entries.length === 1) {
        const single = path.join(extractRoot, entries[0].name);
        const nestedUpscaler = path.join(single, 'upscaler');
        if (fs.existsSync(nestedUpscaler) && fs.statSync(nestedUpscaler).isDirectory()) return nestedUpscaler;
        return single;
    }
    return extractRoot;
};

const hasRequiredBundledModels = (upscalerRoot) => {
    if (!upscalerRoot || !fs.existsSync(upscalerRoot)) return false;
    const waifuExe = path.join(upscalerRoot, 'waifu2x-ncnn-vulkan-20250915-windows', UPSCALER_EXE_WAIFU2X);
    const waifuModels = path.join(upscalerRoot, 'waifu2x-ncnn-vulkan-20250915-windows', 'models-cunet');
    const esrExe = path.join(upscalerRoot, 'realesrgan-ncnn-vulkan-20210901-windows', UPSCALER_EXE_REALESRGAN);
    const esrBin = path.join(upscalerRoot, 'realesrgan-ncnn-vulkan-20210901-windows', 'models', 'realesrgan-x4plus-anime.bin');
    const esrParam = path.join(upscalerRoot, 'realesrgan-ncnn-vulkan-20210901-windows', 'models', 'realesrgan-x4plus-anime.param');
    return (
        isValidFile(waifuExe)
        && fs.existsSync(waifuModels)
        && isValidFile(esrExe)
        && isValidFile(esrBin)
        && isValidFile(esrParam)
    );
};

const resolveBundledInstallSource = () => {
    const candidates = [
        path.join(RESOURCE_ROOT, 'upscaler'),
    ];
    for (const candidate of candidates) {
        if (hasRequiredBundledModels(candidate)) return candidate;
    }
    return '';
};

const normalizeWindowsLongPath = (value) => {
    const raw = String(value || '');
    if (raw.startsWith('\\\\?\\UNC\\')) return `\\\\${raw.slice('\\\\?\\UNC\\'.length)}`;
    if (raw.startsWith('\\\\?\\')) return raw.slice('\\\\?\\'.length);
    return raw;
};

const getUpscalerModelRootFolder = () => {
    const settings = ensureSettingsAutoDetected(true);
    const candidates = [];
    const add = (dir) => {
        if (!dir) return;
        const normalized = normalizeWindowsLongPath(path.resolve(dir));
        if (!candidates.includes(normalized) && fs.existsSync(normalized) && fs.statSync(normalized).isDirectory()) {
            candidates.push(normalized);
        }
    };

    if (isValidFile(settings.waifu2xPath)) {
        const exeDir = path.dirname(settings.waifu2xPath);
        add(path.dirname(exeDir));
        add(exeDir);
    }
    if (isValidFile(settings.realesrganPath)) {
        const exeDir = path.dirname(settings.realesrganPath);
        add(path.dirname(exeDir));
        add(exeDir);
    }

    add(UPSCALER_DIR);
    add(path.join(RESOURCE_ROOT, 'upscaler'));

    for (const candidate of candidates) {
        if (hasRequiredBundledModels(candidate)) return candidate;
    }
    return candidates[0] || '';
};

const computeFileSha256 = async (filePath) => {
    const crypto = require('crypto');
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
    });
};

const resolvePackageLocalPath = (source) => {
    const value = String(source || '').trim();
    if (!value) return '';
    if (/^file:\/\//i.test(value)) {
        try {
            const u = new URL(value);
            if (u.protocol === 'file:') return decodeURIComponent(u.pathname || '').replace(/^\//, '');
        } catch {
            return '';
        }
    }
    if (/^https?:\/\//i.test(value)) return '';
    if (path.isAbsolute(value) && fs.existsSync(value)) return value;
    const relToAppRoot = path.resolve(APP_ROOT, value);
    if (fs.existsSync(relToAppRoot)) return relToAppRoot;
    const relToCwd = path.resolve(process.cwd(), value);
    if (fs.existsSync(relToCwd)) return relToCwd;
    return '';
};

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const isZipFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return false;
        const fd = fs.openSync(filePath, 'r');
        const header = Buffer.alloc(4);
        fs.readSync(fd, header, 0, 4, 0);
        fs.closeSync(fd);
        const signature = header.toString('hex').toLowerCase();
        return signature === '504b0304' || signature === '504b0506' || signature === '504b0708';
    } catch {
        return false;
    }
};

const diagnoseFetchError = async (pkgUrl, err) => {
    const baseMsg = String(err?.message || 'fetch failed');
    let hostname = '';
    try {
        hostname = new URL(pkgUrl).hostname;
    } catch {
        return `Network error while downloading model package: ${baseMsg}`;
    }

    let cnames = [];
    let ips = [];
    try { cnames = await dns.resolveCname(hostname); } catch { }
    try { ips = await dns.resolve4(hostname); } catch { }

    const allTargets = [...cnames, ...ips].join(' ').toLowerCase();
    if (allTargets.includes('block.myrepublic.co.id') || allTargets.includes('trustpositif')) {
        return `Network error while downloading model package: DNS for ${hostname} is redirected to ISP block page (${cnames[0] || ips[0] || 'blocked'}). Use a custom domain / Worker URL (non-r2.dev) or local ZIP path in config.json (upscalerPackageUrl).`;
    }

    return `Network error while downloading model package from ${hostname}: ${baseMsg}`;
};

const downloadUpscalerPackage = async () => {
    const pkgSource = getUpscalerPackageSource();
    if (!pkgSource) {
        throw new Error('Upscaler package URL is not configured. Set "upscalerPackageUrl" in config.json.');
    }
    // Runtime-safe: recreate temp download dir if it was deleted while app is running.
    fs.ensureDirSync(UPSCALER_PACKAGE_TMP_DIR);

    const localPkgPath = resolvePackageLocalPath(pkgSource);
    if (localPkgPath) {
        if (!isValidFile(localPkgPath)) {
            throw new Error(`Local model package file not found: ${localPkgPath}`);
        }
        fs.copyFileSync(localPkgPath, UPSCALER_PACKAGE_TMP_FILE);
        if (!isZipFile(UPSCALER_PACKAGE_TMP_FILE)) {
            throw new Error('Local package file is not a valid ZIP.');
        }
        const size = fs.statSync(UPSCALER_PACKAGE_TMP_FILE).size;
        updatePackageState({
            status: 'downloading',
            error: '',
            downloadedBytes: size,
            totalBytes: size,
            speedBytesPerSec: 0,
            progress: 95,
        });

        const pkgSha256 = getUpscalerPackageSha256();
        if (pkgSha256) {
            const actualHash = await computeFileSha256(UPSCALER_PACKAGE_TMP_FILE);
            if (actualHash !== pkgSha256) {
                throw new Error('Local package checksum mismatch (config.json upscalerPackageSha256).');
            }
        }
        return;
    }

    if (!isHttpUrl(pkgSource)) {
        throw new Error(`Local model package file not found: ${pkgSource}`);
    }

    let existingSize = fs.existsSync(UPSCALER_PACKAGE_TMP_FILE) ? fs.statSync(UPSCALER_PACKAGE_TMP_FILE).size : 0;
    const fetchWithTimeout = async (headers) => {
        const installSignal = packageInstallAbortController?.signal;
        if (installSignal?.aborted) throw markInstallCancelledError();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);
        let onInstallAbort = null;
        if (installSignal) {
            onInstallAbort = () => controller.abort();
            installSignal.addEventListener('abort', onInstallAbort, { once: true });
        }
        try {
            return await fetch(pkgSource, { headers, signal: controller.signal });
        } catch (err) {
            if (installSignal?.aborted || err?.name === 'AbortError') {
                throw markInstallCancelledError();
            }
            throw new Error(await diagnoseFetchError(pkgSource, err));
        } finally {
            if (installSignal && onInstallAbort) installSignal.removeEventListener('abort', onInstallAbort);
            clearTimeout(timeout);
        }
    };

    let headers = existingSize > 0 ? { Range: `bytes=${existingSize}-` } : {};
    let response = await fetchWithTimeout(headers);

    // If server rejects resume range, restart from byte 0 automatically.
    if (response.status === 416 && existingSize > 0) {
        try { fs.truncateSync(UPSCALER_PACKAGE_TMP_FILE, 0); } catch { }
        existingSize = 0;
        headers = {};
        updatePackageState({
            status: 'downloading',
            error: '',
            downloadedBytes: 0,
            totalBytes: 0,
            speedBytesPerSec: 0,
            progress: 0,
        });
        response = await fetchWithTimeout(headers);
    }

    if (!(response.ok || response.status === 206)) {
        throw new Error(`Download failed with status ${response.status}.`);
    }
    if (!response.body) {
        throw new Error('Download response has no body.');
    }

    let appendMode = existingSize > 0 && response.status === 206;
    if (existingSize > 0 && response.status === 200) {
        fs.truncateSync(UPSCALER_PACKAGE_TMP_FILE, 0);
        appendMode = false;
    }

    let downloadedBytes = appendMode ? existingSize : 0;
    let totalBytes = 0;
    const contentRange = response.headers.get('content-range');
    if (contentRange) {
        const m = contentRange.match(/\/(\d+)$/);
        if (m) totalBytes = parseInt(m[1], 10) || 0;
    }
    if (!totalBytes) {
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10) || 0;
        totalBytes = appendMode ? downloadedBytes + contentLength : contentLength;
    }

    updatePackageState({
        status: 'downloading',
        error: '',
        downloadedBytes,
        totalBytes,
        speedBytesPerSec: 0,
        progress: totalBytes > 0 ? Math.min(95, Math.round((downloadedBytes / totalBytes) * 95)) : 0,
    });

    let downloadStream = response.body;
    if (
        downloadStream
        && typeof downloadStream.on !== 'function'
        && typeof downloadStream.getReader === 'function'
        && typeof Readable.fromWeb === 'function'
    ) {
        try {
            downloadStream = Readable.fromWeb(downloadStream);
        } catch {
            // Keep original stream and validate below.
        }
    }

    if (!downloadStream || typeof downloadStream.on !== 'function') {
        throw new Error('Download response stream is not readable in Node runtime.');
    }

    await new Promise((resolve, reject) => {
        fs.ensureDirSync(UPSCALER_PACKAGE_TMP_DIR);
        const fileStream = fs.createWriteStream(UPSCALER_PACKAGE_TMP_FILE, { flags: appendMode ? 'a' : 'w' });
        let speedWindowStart = Date.now();
        let speedWindowBytes = 0;
        let settled = false;
        const fail = (err) => {
            if (settled) return;
            settled = true;
            try { fileStream.destroy(); } catch { }
            reject(err);
        };

        const onChunk = (chunk) => {
            const nodeChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            downloadedBytes += nodeChunk.length;
            speedWindowBytes += nodeChunk.length;
            if (!fileStream.write(nodeChunk)) {
                downloadStream.pause?.();
                fileStream.once('drain', () => downloadStream.resume?.());
            }

            const now = Date.now();
            if (now - speedWindowStart >= 1000) {
                const elapsedSec = Math.max((now - speedWindowStart) / 1000, 0.001);
                const speed = Math.round(speedWindowBytes / elapsedSec);
                updatePackageState({
                    downloadedBytes,
                    totalBytes,
                    speedBytesPerSec: speed,
                    progress: totalBytes > 0 ? Math.min(95, Math.round((downloadedBytes / totalBytes) * 95)) : packageState.progress,
                });
                speedWindowStart = now;
                speedWindowBytes = 0;
            }
        };

        const onError = (err) => {
            fail(err);
        };

        fileStream.on('error', onError);
        downloadStream.on('data', onChunk);
        downloadStream.on('error', onError);
        downloadStream.on('end', () => {
            if (settled) return;
            settled = true;
            fileStream.end(() => resolve());
        });
    });

    updatePackageState({
        downloadedBytes,
        totalBytes,
        speedBytesPerSec: 0,
        progress: 95,
    });

    if (!isZipFile(UPSCALER_PACKAGE_TMP_FILE)) {
        throw new Error('Downloaded file is not a valid ZIP. URL may point to an HTML block/login page instead of package ZIP.');
    }

    const pkgSha256 = getUpscalerPackageSha256();
    if (pkgSha256) {
        const actualHash = await computeFileSha256(UPSCALER_PACKAGE_TMP_FILE);
        if (actualHash !== pkgSha256) {
            throw new Error('Downloaded package checksum mismatch.');
        }
    }
};

const installUpscalerPackage = async ({ reinstall = false } = {}) => {
    if (packageInstallPromise) return packageInstallPromise;
    const installController = new AbortController();
    packageInstallAbortController = installController;

    packageInstallPromise = (async () => {
        try {
            // If not reinstalling, check if models already exist and skip download
            if (!reinstall) {
                const currentSettings = ensureSettingsAutoDetected(true);
                const waifuOk = checkModelFiles('waifu2x', currentSettings).ok;
                const esrModel = pickPreferredRealEsrganModel(getRealesrganModels(currentSettings), currentSettings.realesrganModel);
                const esrOk = checkModelFiles(esrModel, currentSettings).ok;
                if (waifuOk && esrOk) {
                    console.log('[Upscaler] Models already detected, skipping download.');
                    updatePackageState({ status: 'done', progress: 100, error: '', speedBytesPerSec: 0, lastInstallAt: Date.now() });
                    return { ok: true };
                }
            }

            // Immediately set status so UI shows progress bar right away
            updatePackageState({ status: 'downloading', progress: 0, error: '', downloadedBytes: 0, totalBytes: 0, speedBytesPerSec: 0 });
            let copySource = '';
            let usedBundledFallback = false;
            try {
                await downloadUpscalerPackage();
                updatePackageState({ status: 'extracting', progress: 97, speedBytesPerSec: 0, error: '' });

                fs.removeSync(UPSCALER_EXTRACT_TMP_DIR);
                fs.ensureDirSync(UPSCALER_EXTRACT_TMP_DIR);
                new AdmZip(UPSCALER_PACKAGE_TMP_FILE).extractAllTo(UPSCALER_EXTRACT_TMP_DIR, true);

                copySource = resolvePackageCopySource(UPSCALER_EXTRACT_TMP_DIR);
                if (!copySource || !fs.existsSync(copySource)) {
                    throw new Error('Extract succeeded, but package content is invalid.');
                }
            } catch (downloadErr) {
                if (isInstallCancelledError(downloadErr)) throw downloadErr;
                const bundledSource = resolveBundledInstallSource();
                if (!bundledSource) throw downloadErr;
                usedBundledFallback = true;
                copySource = bundledSource;
                updatePackageState({
                    status: 'extracting',
                    progress: 97,
                    speedBytesPerSec: 0,
                    error: '',
                    downloadedBytes: 0,
                    totalBytes: 0,
                });
                console.warn('[Upscaler] Download failed; using bundled upscaler assets instead:', downloadErr?.message || downloadErr);
            }

            if (reinstall || fs.existsSync(UPSCALER_DIR)) {
                fs.removeSync(UPSCALER_DIR);
            }
            fs.ensureDirSync(path.dirname(UPSCALER_DIR));
            fs.copySync(copySource, UPSCALER_DIR, { overwrite: true });

            const settings = ensureSettingsAutoDetected(true);
            const waifuCheck = checkModelFiles('waifu2x', settings);
            const esrModel = pickPreferredRealEsrganModel(getRealesrganModels(settings), settings.realesrganModel);
            const esrCheck = checkModelFiles(esrModel, settings);
            if (!waifuCheck.ok || !esrCheck.ok) {
                throw new Error('Model package installed but required model files are still missing.');
            }

            updatePackageState({
                status: 'done',
                progress: 100,
                downloadedBytes: usedBundledFallback
                    ? 0
                    : (fs.existsSync(UPSCALER_PACKAGE_TMP_FILE) ? fs.statSync(UPSCALER_PACKAGE_TMP_FILE).size : packageState.downloadedBytes),
                totalBytes: usedBundledFallback
                    ? 0
                    : (fs.existsSync(UPSCALER_PACKAGE_TMP_FILE) ? fs.statSync(UPSCALER_PACKAGE_TMP_FILE).size : packageState.totalBytes),
                speedBytesPerSec: 0,
                error: '',
                lastInstallAt: Date.now(),
            });

            fs.removeSync(UPSCALER_EXTRACT_TMP_DIR);
            return { ok: true };
        } catch (err) {
            if (isInstallCancelledError(err)) {
                updatePackageState({
                    status: 'idle',
                    progress: 0,
                    downloadedBytes: 0,
                    totalBytes: 0,
                    speedBytesPerSec: 0,
                    error: '',
                });
                return { ok: false, cancelled: true };
            }
            updatePackageState({
                status: 'error',
                speedBytesPerSec: 0,
                error: err.message || 'Failed to install model package.',
            });
            throw err;
        } finally {
            if (packageInstallAbortController === installController) packageInstallAbortController = null;
            packageInstallPromise = null;
        }
    })();

    return packageInstallPromise;
};

const cancelUpscalerPackageInstall = () => {
    const state = loadPackageState();
    if (packageInstallAbortController && !packageInstallAbortController.signal.aborted) {
        try { packageInstallAbortController.abort(); } catch { }
    }
    if (state.status === 'downloading' || state.status === 'extracting' || state.status === 'error') {
        updatePackageState({
            status: 'idle',
            progress: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            speedBytesPerSec: 0,
            error: '',
        });
    }
    return true;
};

const deleteUpscalerPackage = () => {
    try {
        const rootFolder = getUpscalerModelRootFolder();
        if (rootFolder && fs.existsSync(rootFolder)) {
            // Delete the root folder instead of the generic UPSCALER_DIR since models might be in _up_/upscaler
            fs.removeSync(rootFolder);
        }
        if (fs.existsSync(UPSCALER_DIR)) fs.removeSync(UPSCALER_DIR);
        if (fs.existsSync(UPSCALER_PACKAGE_TMP_DIR)) fs.removeSync(UPSCALER_PACKAGE_TMP_DIR);
        fs.ensureDirSync(UPSCALER_PACKAGE_TMP_DIR);
    } catch (e) { console.error('[Upscaler] Failed to delete package:', e.message); }

    updatePackageState({
        status: 'idle',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speedBytesPerSec: 0,
        error: '',
        lastInstallAt: 0,
    });

    const settings = ensureSettingsAutoDetected();
    settings.waifu2xPath = '';
    settings.realesrganPath = '';
    saveSettings(settings);

    return true;
};

// â”€â”€ Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const defaultSettings = {
    waifu2xPath: '',
    realesrganPath: '',
    afterUpscale: 'keep', // 'keep' | 'delete'
    archiveDir: '',       // custom archive directory (empty = data/archive)
    waifu2xScale: 2,
    waifu2xDenoiseLevel: 1,
    waifu2xWorkers: 3,
    waifu2xModelDir: 'models-cunet',
    realesrganModel: 'realesrgan-x4plus-anime',
    esrganScale: 4,
    esrganWorkers: 1
};

const loadSettings = () => {
    let raw;
    try { raw = { ...defaultSettings, ...fs.readJsonSync(SETTINGS_PATH) }; }
    catch { raw = { ...defaultSettings }; }
    const hydrated = hydrateExecutablePaths(raw);
    hydrated.realesrganModel = normalizeRealEsrganModelId(hydrated.realesrganModel || defaultSettings.realesrganModel) || defaultSettings.realesrganModel;
    hydrated.esrganScale = normalizeRealEsrganScale(hydrated.esrganScale);

    const detectedModels = getRealesrganModels(hydrated);
    if (detectedModels.length > 0 && !detectedModels.includes(hydrated.realesrganModel)) {
        hydrated.realesrganModel = pickPreferredRealEsrganModel(detectedModels, hydrated.realesrganModel);
    }

    return hydrated;
};

const saveSettings = (s) => fs.writeJsonSync(SETTINGS_PATH, s, { spaces: 2 });

// â”€â”€ Queue Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let queue = [];
let currentJob = null;
let isProcessing = false;
let activeProcs = [];
let pageMonitorInterval = null;

const loadQueue = () => {
    try { queue = fs.readJsonSync(QUEUE_PATH); } catch { queue = []; }
};

const persistQueue = () => {
    fs.writeJsonSync(QUEUE_PATH, queue, { spaces: 2 });
};

loadQueue();

// â”€â”€ Resume: Reset any 'processing' jobs back to 'queued' on startup â”€â”€
(() => {
    let needsSave = false;
    for (const job of queue) {
        if (job.status === 'processing') {
            job.status = 'queued';
            needsSave = true;
            console.log(`[Upscaler] Resuming interrupted job: ${job.mangaTitle} (${job.chapters.length} chapters)`);
        }
    }
    if (needsSave) {
        fs.writeJsonSync(QUEUE_PATH, queue, { spaces: 2 });
    }
    // Auto-start processing on server boot if there are queued jobs
    setTimeout(() => processNext(), 1000);
})();

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/**
 * Add a job to the upscale queue.
 */
const addJob = (opts) => {
    const requestedScale = opts.scale !== undefined ? opts.scale : 2;
    const normalizedScale = opts.model === 'waifu2x'
        ? requestedScale
        : normalizeRealEsrganScale(requestedScale);
    const job = {
        id: generateId(),
        mangaId: opts.mangaId,
        chapters: opts.chapters,
        model: opts.model,
        scale: normalizedScale,
        denoiseLevel: opts.denoiseLevel !== undefined ? opts.denoiseLevel : 1,
        maxWorkers: opts.maxWorkers !== undefined ? Math.max(1, Math.min(8, opts.maxWorkers)) : 3,
        waifu2xModelDir: opts.waifu2xModelDir || 'models-cunet',
        archiveMode: opts.archiveMode || 'keep',
        versionId: opts.versionId || null,
        status: 'queued',
        progress: {
            current: 0,
            total: opts.chapters.length,
            currentChapter: '',
            pagesCurrent: 0,
            pagesTotal: 0,
            stagePercent: 0,
        },
        error: null,
        createdAt: Date.now(),
    };
    queue.push(job);
    persistQueue();
    processNext();
    return job;
};

const cleanupJobFiles = (jobId) => {
    try {
        const stagingBase = path.join(DATA_DIR, 'upscale-staging', jobId);
        if (fs.existsSync(stagingBase)) fs.removeSync(stagingBase);

        const tmpDir = path.join(DATA_DIR, 'upscale-tmp');
        if (fs.existsSync(tmpDir)) {
            fs.readdirSync(tmpDir).forEach(f => {
                if (f.startsWith(jobId + '_')) {
                    fs.removeSync(path.join(tmpDir, f));
                }
            });
        }
    } catch (err) {
        console.error(`[Upscaler] Failed to clean up job files for ${jobId}:`, err);
    }
};

const removeJob = (jobId) => {
    if (currentJob && currentJob.id === jobId) return false;
    queue = queue.filter(j => j.id !== jobId);
    cleanupJobFiles(jobId);
    persistQueue();
    return true;
};

const killProcessTree = (proc) => {
    if (!proc || !proc.pid) return;
    try {
        if (process.platform === 'win32') {
            const { spawnSync } = require('child_process');
            spawnSync('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { windowsHide: true, stdio: 'ignore' });
        } else {
            try { proc.kill('SIGKILL'); } catch { }
        }
    } catch { }
};

const abortCurrentJob = () => {
    if (!currentJob) return false;
    const abortedJobId = currentJob.id;
    currentJob.status = 'cancelled';
    if (pageMonitorInterval) { clearInterval(pageMonitorInterval); pageMonitorInterval = null; }
    for (const proc of activeProcs) {
        killProcessTree(proc);
    }
    // Second pass for stubborn processes that survive first kill.
    setTimeout(() => {
        for (const proc of activeProcs) {
            if (proc && proc.exitCode === null) killProcessTree(proc);
        }
        cleanupJobFiles(abortedJobId);
    }, 1200);
    cleanupJobFiles(abortedJobId);
    persistQueue();
    return true;
};

const removeSeries = (mangaId) => {
    let removed = false;
    if (currentJob && currentJob.mangaId === mangaId) {
        abortCurrentJob();
        removed = true;
    }
    const initialLen = queue.length;
    queue = queue.filter(j => {
        if (j.mangaId === mangaId) {
            cleanupJobFiles(j.id);
            return false;
        }
        return true;
    });
    if (queue.length < initialLen) removed = true;
    persistQueue();
    return removed;
};

const getQueue = () => {
    return queue;
};

// â”€â”€ Archive â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const getArchive = () => {
    const settings = loadSettings();
    const archiveBase = settings.archiveDir || ARCHIVE_DIR;
    if (!fs.existsSync(archiveBase)) return [];

    const result = [];
    const entries = fs.readdirSync(archiveBase);
    for (const seriesDir of entries) {
        const fullPath = path.join(archiveBase, seriesDir);
        if (!fs.statSync(fullPath).isDirectory()) continue;
        const files = fs.readdirSync(fullPath);
        const chapters = files.filter(f => IMAGE_EXT.test(f) || f.endsWith('.cbz') || fs.statSync(path.join(fullPath, f)).isDirectory());
        if (chapters.length > 0) {
            const totalSize = files.reduce((sum, f) => {
                const fp = path.join(fullPath, f);
                try { return sum + fs.statSync(fp).size; } catch { return sum; }
            }, 0);
            result.push({
                mangaId: seriesDir,
                chapterCount: chapters.length,
                totalSize,
                chapters: chapters.map(c => ({ name: c })),
            });
        }
    }
    return result;
};

const deleteArchive = (mangaId) => {
    const settings = loadSettings();
    const archiveBase = settings.archiveDir || ARCHIVE_DIR;
    const seriesDir = path.join(archiveBase, mangaId);
    if (fs.existsSync(seriesDir)) {
        fs.removeSync(seriesDir);
        return true;
    }
    return false;
};

const restoreArchive = (mangaId, chaptersToRestore) => {
    const settings = loadSettings();
    const archiveBase = settings.archiveDir || ARCHIVE_DIR;
    const seriesDir = path.join(archiveBase, mangaId);
    if (!fs.existsSync(seriesDir)) return false;

    const meta = loadMeta();
    const targetBase = resolveMangaDirFromMeta(mangaId, meta);
    fs.ensureDirSync(targetBase);

    const items = chaptersToRestore || fs.readdirSync(seriesDir);
    for (const item of items) {
        const src = path.join(seriesDir, item);
        if (!fs.existsSync(src)) continue;
        fs.moveSync(src, path.join(targetBase, item), { overwrite: true });

        // Clear cbz-cache
        const cacheNamePart = item.replace(/\.cbz$/i, '');
        const cacheDir = path.join(DATA_DIR, 'cbz-cache', mangaId, cacheNamePart);
        if (fs.existsSync(cacheDir)) {
            fs.removeSync(cacheDir);
        }
    }

    // Remove series archive dir if empty
    const remaining = fs.readdirSync(seriesDir);
    if (remaining.length === 0) fs.removeSync(seriesDir);
    return true;
};

const deleteArchivePartial = (mangaId, chaptersToDelete) => {
    const settings = loadSettings();
    const archiveBase = settings.archiveDir || ARCHIVE_DIR;
    const seriesDir = path.join(archiveBase, mangaId);
    if (!fs.existsSync(seriesDir)) return false;

    for (const item of chaptersToDelete) {
        const fp = path.join(seriesDir, item);
        if (fs.existsSync(fp)) fs.removeSync(fp);
    }

    // Remove series archive dir if empty
    const remaining = fs.readdirSync(seriesDir);
    if (remaining.length === 0) fs.removeSync(seriesDir);
    return true;
};

// â”€â”€ Processing Loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const processNext = async () => {
    if (isProcessing) return;
    if (queue.length === 0) return;
    activeProcs = activeProcs.filter(proc => proc && proc.exitCode === null);

    currentJob = queue.find(j => j.status === 'queued');
    if (!currentJob) return;

    isProcessing = true;
    currentJob.status = 'processing';
    currentJob.progress.pagesCurrent = 0;
    currentJob.progress.pagesTotal = 0;
    currentJob.progress.stagePercent = 0;
    persistQueue();

    const settings = loadSettings();

    for (let i = 0; i < currentJob.chapters.length; i++) {
        if (currentJob.status === 'cancelled') break;

        const chapterName = currentJob.chapters[i];
        currentJob.progress.current = i;  // 0-based index = chapters done so far
        currentJob.progress.currentChapter = chapterName;
        currentJob.progress.pagesCurrent = 0;
        currentJob.progress.pagesTotal = 0;
        currentJob.progress.stagePercent = 0;
        persistQueue();

        // Add a short cooldown between chapters to reduce GPU contention.
        if (i > 0) {
            const waifuCooldown = toPositiveInt(process.env.KODO_WAIFU2X_CHAPTER_COOLDOWN_MS, 0);
            const cooldownMs = currentJob.model === 'waifu2x' ? waifuCooldown : 1000;
            console.log(`[Upscaler] Waiting ${cooldownMs}ms for GPU cooldown before chapter ${i + 1}...`);
            if (cooldownMs > 0) await new Promise(r => setTimeout(r, cooldownMs));
        }

        console.log(`[Upscaler] Processing chapter ${i + 1}/${currentJob.chapters.length}: ${chapterName}`);

        try {
            await processChapter(currentJob, chapterName, settings);
            console.log(`[Upscaler] Done chapter ${i + 1}/${currentJob.chapters.length}: ${chapterName}`);
        } catch (err) {
            if (currentJob.status === 'cancelled' || isJobCancelledError(err)) {
                console.log(`[Upscaler] Job cancelled during chapter ${i + 1}/${currentJob.chapters.length}.`);
                break;
            }
            // Retry once after a longer cooldown
            console.warn(`[Upscaler] Chapter failed, retrying in 3s: ${err.message}`);
            await new Promise(r => setTimeout(r, 3000));
            if (currentJob.status === 'cancelled') break;
            try {
                // Clean up any partial output from the failed attempt
                const tmpBase = path.join(DATA_DIR, 'upscale-tmp', `${currentJob.id}_${chapterName.replace(/[^a-zA-Z0-9]/g, '_')}`);
                if (fs.existsSync(tmpBase)) fs.removeSync(tmpBase);

                currentJob.progress.pagesCurrent = 0;
                currentJob.progress.pagesTotal = 0;
                currentJob.progress.stagePercent = 0;
                persistQueue();

                await processChapter(currentJob, chapterName, settings);
                console.log(`[Upscaler] Done chapter ${i + 1}/${currentJob.chapters.length} (retry): ${chapterName}`);
            } catch (retryErr) {
                if (currentJob.status === 'cancelled' || isJobCancelledError(retryErr)) {
                    console.log(`[Upscaler] Job cancelled during retry of chapter ${i + 1}/${currentJob.chapters.length}.`);
                    break;
                }
                console.error(`[Upscaler] Error on ${currentJob.mangaId}/${chapterName}:`, retryErr.message);
                currentJob.error = `Chapter "${chapterName}": ${retryErr.message}`;
                currentJob.status = 'error';
                persistQueue();
                break;
            }
        }
    }

    if (currentJob.status === 'processing') {
        currentJob.status = 'review';
        currentJob.progress.current = currentJob.chapters.length;
        currentJob.progress.currentChapter = '';
        currentJob.progress.pagesCurrent = 0;
        currentJob.progress.pagesTotal = 0;
        currentJob.progress.stagePercent = 0;
    }
    persistQueue();

    currentJob = null;
    isProcessing = false;
    processNext();
};

const finalizeJob = (jobId, action) => {
    const job = queue.find(j => j.id === jobId && j.status === 'review');
    if (!job) return false;

    const mangaDir = resolveJobMangaDir(job);
    const stagingBase = path.join(DATA_DIR, 'upscale-staging', job.id);
    const archiveDir = path.join(ARCHIVE_DIR, job.mangaId);

    if (!fs.existsSync(stagingBase) || !isExistingDirectory(mangaDir)) return false;

    for (const chapterName of job.chapters) {
        if (chapterName === '__COVER__') {
            const stagingCover = path.join(stagingBase, '__COVER__');
            if (!fs.existsSync(stagingCover)) continue;
            const files = fs.readdirSync(stagingCover);
            const upscaledCoverName = files[0];

            const existingFiles = fs.readdirSync(mangaDir);
            const existingCover = existingFiles.find(f => f.startsWith('cover.') && IMAGE_EXT.test(f));

            if (action === 'keep') {
                fs.ensureDirSync(archiveDir);
                if (existingCover) fs.moveSync(path.join(mangaDir, existingCover), path.join(archiveDir, existingCover), { overwrite: true });
            } else {
                if (existingCover) fs.removeSync(path.join(mangaDir, existingCover));
            }

            fs.moveSync(path.join(stagingCover, upscaledCoverName), path.join(mangaDir, upscaledCoverName), { overwrite: true });
            continue;
        }

        const chapterPaths = resolveChapterPaths(mangaDir, chapterName);
        const resolvedChapterName = chapterPaths.chapterBaseName || chapterName;
        const folderPath = chapterPaths.folderPath;
        const cbzPath = chapterPaths.cbzPath;
        const isCbz = chapterPaths.isCbz;

        // handle original
        if (action === 'keep') {
            fs.ensureDirSync(archiveDir);
            if (isCbz && fs.existsSync(cbzPath)) fs.moveSync(cbzPath, path.join(archiveDir, resolvedChapterName + '.cbz'), { overwrite: true });
            else if (isExistingDirectory(folderPath)) fs.moveSync(folderPath, path.join(archiveDir, resolvedChapterName), { overwrite: true });
        } else {
            if (isCbz && fs.existsSync(cbzPath)) fs.removeSync(cbzPath);
            else if (isExistingDirectory(folderPath)) fs.removeSync(folderPath);
        }

        // replace with staged
        const stagedCbz = fs.existsSync(path.join(stagingBase, chapterName + '.cbz'))
            ? path.join(stagingBase, chapterName + '.cbz')
            : path.join(stagingBase, resolvedChapterName + '.cbz');
        const stagedFolder = fs.existsSync(path.join(stagingBase, chapterName))
            ? path.join(stagingBase, chapterName)
            : path.join(stagingBase, resolvedChapterName);
        if (fs.existsSync(stagedCbz)) fs.moveSync(stagedCbz, cbzPath, { overwrite: true });
        else if (fs.existsSync(stagedFolder)) fs.moveSync(stagedFolder, folderPath, { overwrite: true });

        // Clear cbz-cache so the reader picks up the new upscaled images.
        const cacheKeys = new Set([chapterName, resolvedChapterName].filter(Boolean));
        for (const cacheKey of cacheKeys) {
            const cacheNamePart = (job.versionId && job.versionId !== 'default') ? `${job.versionId}_${cacheKey}` : cacheKey;
            const cacheDir = path.join(DATA_DIR, 'cbz-cache', job.mangaId, cacheNamePart);
            if (fs.existsSync(cacheDir)) {
                fs.removeSync(cacheDir);
                console.log(`[Upscaler] Cleared cbz-cache: ${cacheDir}`);
            }
        }
    }

    fs.removeSync(stagingBase);
    queue = queue.filter(j => j.id !== jobId);
    persistQueue();
    return true;
};

const discardJob = (jobId) => {
    const job = queue.find(j => j.id === jobId && j.status === 'review');
    if (!job) return false;

    const stagingBase = path.join(DATA_DIR, 'upscale-staging', job.id);
    fs.removeSync(stagingBase);

    queue = queue.filter(j => j.id !== jobId);
    persistQueue();
    return true;
};

/**
 * Process a single chapter: extract if CBZ, upscale images, repack/replace.
 */
const processChapter = async (job, chapterName, settings) => {
    const mangaDir = resolveJobMangaDir(job);

    if (chapterName === '__COVER__') {
        if (!isExistingDirectory(mangaDir)) throw new Error(`Source folder not found: ${mangaDir}`);
        const files = fs.readdirSync(mangaDir);
        const coverFile = files.find(f => f.startsWith('cover.') && IMAGE_EXT.test(f));
        if (!coverFile) throw new Error("No cover found for this series");

        const tmpBase = path.join(DATA_DIR, 'upscale-tmp', `${job.id}_cover`);
        fs.ensureDirSync(tmpBase);

        job.progress.pagesTotal = 1;
        job.progress.pagesCurrent = 0;
        job.progress.stagePercent = 0;
        persistQueue();

        const outputDir = path.join(tmpBase, 'output');
        fs.ensureDirSync(outputDir);
        const outFileName = path.parse(coverFile).name + '.jpg';
        const coverOut = path.join(outputDir, outFileName);

        try {
            await runUpscalerSingle(path.join(mangaDir, coverFile), coverOut, job.model, job.scale, job.denoiseLevel, settings, job.waifu2xModelDir, job);
        } catch (err) {
            fs.removeSync(tmpBase);
            throw err;
        }

        job.progress.pagesCurrent = 1;
        job.progress.stagePercent = 100;
        persistQueue();

        if (job.status === 'cancelled') {
            fs.removeSync(tmpBase);
            return;
        }

        const stagingBase = path.join(DATA_DIR, 'upscale-staging', job.id);
        fs.ensureDirSync(stagingBase);
        fs.moveSync(outputDir, path.join(stagingBase, '__COVER__'), { overwrite: true });
        fs.removeSync(tmpBase);
        return;
    }

    if (!isExistingDirectory(mangaDir)) {
        throw new Error(`Source folder not found: ${mangaDir}`);
    }
    const chapterPaths = resolveChapterPaths(mangaDir, chapterName);
    const resolvedChapterName = chapterPaths.chapterBaseName || chapterName;
    const folderPath = chapterPaths.folderPath;
    const cbzPath = chapterPaths.cbzPath;
    const isCbz = chapterPaths.isCbz;

    let inputDir, outputDir;
    const tmpBase = path.join(DATA_DIR, 'upscale-tmp', `${job.id}_${chapterName.replace(/[^a-zA-Z0-9]/g, '_')}`);
    fs.ensureDirSync(tmpBase);

    if (isCbz) {
        inputDir = path.join(tmpBase, 'input');
        fs.ensureDirSync(inputDir);
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(cbzPath);
        zip.extractAllTo(inputDir, true);
    } else if (isExistingDirectory(folderPath)) {
        inputDir = folderPath;
    } else {
        throw new Error(`Chapter "${chapterName}" not found in source folder (${mangaDir})`);
    }

    outputDir = path.join(tmpBase, 'output');
    fs.ensureDirSync(outputDir);

    const inputImages = fs.readdirSync(inputDir)
        .filter(f => IMAGE_EXT.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    job.progress.pagesTotal = inputImages.length;
    job.progress.pagesCurrent = 0;
    job.progress.stagePercent = 0;
    persistQueue();

    if (inputImages.length === 0) {
        fs.removeSync(tmpBase);
        return;
    }

    // Use batch mode â€” loads model ONCE and processes all images, far faster than per-image spawning
    await runUpscalerBatch(inputDir, outputDir, job.model, job.scale, job.denoiseLevel, settings, job.waifu2xModelDir, job, inputImages.length);

    if (job.status === 'cancelled') {
        fs.removeSync(tmpBase);
        return;
    }

    const stagingBase = path.join(DATA_DIR, 'upscale-staging', job.id);
    fs.ensureDirSync(stagingBase);

    if (isCbz) {
        const AdmZip = require('adm-zip');
        const newZip = new AdmZip();
        const upFiles = fs.readdirSync(outputDir).filter(f => IMAGE_EXT.test(f)).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        for (const f of upFiles) {
            newZip.addLocalFile(path.join(outputDir, f));
        }
        newZip.writeZip(path.join(stagingBase, resolvedChapterName + '.cbz'));
    } else {
        fs.moveSync(outputDir, path.join(stagingBase, resolvedChapterName), { overwrite: true });
    }

    fs.removeSync(tmpBase);
};

/**
 * Spawn the upscaling CLI for a single image.
 * NOTE: For Real-ESRGAN, the model is loaded once per spawn â€” so we prefer batch mode.
 */
const runUpscalerSingle = (inputFile, outputFile, model, scale, denoiseLevel, settings, waifu2xModelDir, job = currentJob) => {
    return new Promise((resolve, reject) => {
        if (job?.status === 'cancelled' || currentJob?.status === 'cancelled') {
            reject(markJobCancelledError());
            return;
        }
        let exe, args;
        const denoise = denoiseLevel !== undefined && denoiseLevel !== null ? String(denoiseLevel) : '1';
        const ratioValue = model === 'waifu2x'
            ? (scale !== undefined && scale !== null ? Number(scale) : 2)
            : normalizeRealEsrganScale(scale);
        const ratio = String(ratioValue);

        if (model === 'waifu2x') {
            const defaultW2x = getDefaultWaifu2xExe();
            const desiredModelDir = waifu2xModelDir || settings.waifu2xModelDir || 'models-cunet';
            exe = selectFirstUsableWaifu2xExe(
                [settings.waifu2xPath, defaultW2x, detectManagedExecutables().waifu2xExe],
                desiredModelDir
            ) || (settings.waifu2xPath || (defaultW2x && fs.existsSync(defaultW2x) ? defaultW2x : 'waifu2x-ncnn-vulkan'));
            const modelArg = normalizeWaifu2xModelArg(exe, desiredModelDir);
            const threadPlan = getWaifu2xThreadPlan(Math.max(1, settings?.waifu2xWorkers || 3));
            args = [
                '-i', inputFile,
                '-o', outputFile,
                '-s', ratio,
                '-n', denoise,
                '-m', modelArg,
                '-f', 'jpg',
                '-j', `${threadPlan.load}:${threadPlan.proc}:${threadPlan.save}`,
            ];
        } else {
            const defaultEsr = getDefaultRealesrganExe();
            exe = settings.realesrganPath || (defaultEsr && fs.existsSync(defaultEsr) ? defaultEsr : 'realesrgan-ncnn-vulkan');
            const modelName = normalizeRealEsrganModelId(model) || pickPreferredRealEsrganModel(getRealesrganModels(settings), settings?.realesrganModel);
            const threadPlan = getRealEsrganThreadPlan(Math.max(1, settings?.esrganWorkers || 1));
            const tileSize = getRealEsrganTileSize();

            args = [
                '-i', inputFile,
                '-o', outputFile,
                '-s', ratio,
                '-n', modelName,
                '-f', 'jpg',
                '-j', `${threadPlan.load}:${threadPlan.proc}:${threadPlan.save}`,
                '-t', String(tileSize),
            ];
        }

        console.log(`[Upscaler] Single: ${path.basename(inputFile)} â†’ ${path.basename(outputFile)} (model=${model})`);

        const spawnTarget = resolveUpscalerSpawnTarget(exe, args, model === 'waifu2x' ? 'waifu2x' : 'realesrgan');
        const proc = spawn(spawnTarget.command, spawnTarget.args, { stdio: 'pipe', cwd: spawnTarget.cwd, windowsHide: true });
        activeProcs.push(proc);
        let stderr = '';

        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.stdout.on('data', () => { });

        proc.on('close', (code) => {
            activeProcs = activeProcs.filter(p => p !== proc);
            if (job?.status === 'cancelled' || currentJob?.status === 'cancelled') {
                reject(markJobCancelledError());
                return;
            }
            const filteredStderr = filterNcnnStderr(stderr);
            const success = fs.existsSync(outputFile);
            if (success) resolve();
            else reject(new Error(`Upscaler failed on ${path.basename(inputFile)} (code ${code})${filteredStderr ? ': ' + filteredStderr.slice(-400) : ''}`));
        });

        proc.on('error', (err) => {
            activeProcs = activeProcs.filter(p => p !== proc);
            if (job?.status === 'cancelled' || currentJob?.status === 'cancelled') {
                reject(markJobCancelledError());
                return;
            }
            reject(new Error(`Failed to start upscaler: ${err.message}. Check exe path in Settings.`));
        });
    });
};

/** Filter NCNN GPU enumeration noise from stderr */
const filterNcnnStderr = (stderr) => {
    return stderr
        .split('\n')
        .filter(line => !line.match(/^\[?\d?\]?\s*(NVIDIA|AMD|Intel|queueC|queueT|queueG|fp16|int8|subgroup|fp8|bf16)/i) && line.trim())
        .join('\n')
        .trim();
};

/**
 * Batch-process a chapter directory.
 * waifu2x and Real-ESRGAN both run as single-process directory batches
 * so model weights are loaded once per chapter.
 */
const runUpscalerBatch = async (inputDir, outputDir, model, scale, denoiseLevel, settings, waifu2xModelDir, job, expectedCount) => {
    if (job?.status === 'cancelled' || currentJob?.status === 'cancelled') {
        throw markJobCancelledError();
    }
    const workers = Math.max(1, job.maxWorkers || 1);

    // Get all input images
    const inputImages = fs.readdirSync(inputDir)
        .filter(f => IMAGE_EXT.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (inputImages.length === 0) return;

    const denoise = denoiseLevel !== undefined && denoiseLevel !== null ? String(denoiseLevel) : '1';
    const ratioValue = model === 'waifu2x'
        ? (scale !== undefined && scale !== null ? Number(scale) : 2)
        : normalizeRealEsrganScale(scale);
    const ratio = String(ratioValue);

    if (model === 'waifu2x') {
        // Fast path: process whole chapter in one waifu2x process (model loads once, no per-worker file copy).
        const defaultW2x = getDefaultWaifu2xExe();
        const desiredModelDir = waifu2xModelDir || settings.waifu2xModelDir || 'models-cunet';
        const exe = selectFirstUsableWaifu2xExe(
            [settings.waifu2xPath, defaultW2x, detectManagedExecutables().waifu2xExe],
            desiredModelDir
        ) || (settings.waifu2xPath || (defaultW2x && fs.existsSync(defaultW2x) ? defaultW2x : 'waifu2x-ncnn-vulkan'));
        const modelArg = normalizeWaifu2xModelArg(exe, desiredModelDir);
        const threadPlan = getWaifu2xThreadPlan(Math.max(1, workers));
        const args = [
            '-i', inputDir,
            '-o', outputDir,
            '-s', ratio,
            '-n', denoise,
            '-m', modelArg,
            '-f', 'jpg',
            '-j', `${threadPlan.load}:${threadPlan.proc}:${threadPlan.save}`,
        ];

        console.log(`[Upscaler] Batch (waifu2x/direct): 1 process, threads=${threadPlan.load}:${threadPlan.proc}:${threadPlan.save}, images=${inputImages.length}`);
        const spawnTarget = resolveUpscalerSpawnTarget(exe, args, model);
        const proc = spawn(spawnTarget.command, spawnTarget.args, { stdio: 'pipe', cwd: spawnTarget.cwd, windowsHide: true });
        activeProcs.push(proc);
        let stderr = '';

        const pollInterval = setInterval(() => {
            try {
                const totalDone = fs.readdirSync(outputDir).filter(f => IMAGE_EXT.test(f)).length;
                job.progress.pagesCurrent = totalDone;
                persistQueue();
            } catch { }
        }, 600);

        try {
            await new Promise((resolve, reject) => {
                proc.stderr.on('data', (d) => { stderr += d.toString(); });
                proc.stdout.on('data', () => { });

                proc.on('close', (code) => {
                    activeProcs = activeProcs.filter(p => p !== proc);
                    if (job?.status === 'cancelled' || currentJob?.status === 'cancelled') {
                        reject(markJobCancelledError());
                        return;
                    }
                    const produced = fs.existsSync(outputDir)
                        ? fs.readdirSync(outputDir).filter(f => IMAGE_EXT.test(f)).length
                        : 0;
                    const filteredStderr = filterNcnnStderr(stderr);
                    if (produced > 0) {
                        if (code !== 0 && code !== null) {
                            console.warn(`[Upscaler] waifu2x exited code ${code} but produced ${produced} files.`);
                        }
                        resolve();
                    } else {
                        reject(new Error(`Waifu2x batch failed (code ${code})${filteredStderr ? ': ' + filteredStderr.slice(-300) : ''}`));
                    }
                });

                proc.on('error', (err) => {
                    activeProcs = activeProcs.filter(p => p !== proc);
                    if (job?.status === 'cancelled' || currentJob?.status === 'cancelled') {
                        reject(markJobCancelledError());
                        return;
                    }
                    reject(new Error(`Failed to start waifu2x: ${err.message}`));
                });
            });
        } finally {
            clearInterval(pollInterval);
        }

        const finalCount = fs.readdirSync(outputDir).filter(f => IMAGE_EXT.test(f)).length;
        job.progress.pagesCurrent = finalCount;
        job.progress.stagePercent = 100;
        persistQueue();
        return;
    }

    // Real-ESRGAN optimized path: one process for full chapter (avoids repeated model reload).
    const defaultEsr = getDefaultRealesrganExe();
    const exe = settings.realesrganPath || (defaultEsr && fs.existsSync(defaultEsr) ? defaultEsr : 'realesrgan-ncnn-vulkan');
    const modelName = normalizeRealEsrganModelId(model) || pickPreferredRealEsrganModel(getRealesrganModels(settings), settings?.realesrganModel);

    const workload = await detectRealEsrganWorkload(inputDir, inputImages);
    const threadPlan = getRealEsrganThreadPlan(Math.max(1, workers), workload);
    const tileSize = getRealEsrganTileSize(workload);
    const args = [
        '-i', inputDir,
        '-o', outputDir,
        '-s', ratio,
        '-n', modelName,
        '-f', 'jpg',
        '-j', `${threadPlan.load}:${threadPlan.proc}:${threadPlan.save}`,
        '-t', String(tileSize),
    ];

    const maxMpx = workload.maxPixels > 0 ? (workload.maxPixels / 1_000_000).toFixed(1) : 'n/a';
    console.log(`[Upscaler] Batch (realesrgan/direct): 1 process, threads=${threadPlan.load}:${threadPlan.proc}:${threadPlan.save}, tile=${tileSize}, images=${inputImages.length}, sample=${workload.sampleCount}, maxInputMP=${maxMpx}`);
    const spawnTarget = resolveUpscalerSpawnTarget(exe, args, 'realesrgan');
    const proc = spawn(spawnTarget.command, spawnTarget.args, { stdio: 'pipe', cwd: spawnTarget.cwd, windowsHide: true });
    activeProcs.push(proc);
    let stderr = '';
    let stagePercent = 0;

    const pollInterval = setInterval(() => {
        try {
            const totalDone = fs.readdirSync(outputDir).filter(f => IMAGE_EXT.test(f)).length;
            job.progress.pagesCurrent = totalDone;
            if (totalDone === 0 && stagePercent > 0) {
                job.progress.stagePercent = Math.max(job.progress.stagePercent || 0, stagePercent);
            } else if (totalDone > 0 && stagePercent > 0 && (job.progress.stagePercent || 0) < 99) {
                job.progress.stagePercent = Math.max(job.progress.stagePercent || 0, Math.min(99, stagePercent));
            }
            persistQueue();
        } catch { }
    }, 600);

    try {
        await new Promise((resolve, reject) => {
            const handleRealProgressChunk = (chunkText) => {
                const parsed = extractNcnnProgressPercent(chunkText);
                if (parsed !== null) {
                    stagePercent = Math.max(stagePercent, Math.min(99, parsed));
                    if (job.progress.pagesCurrent === 0 && stagePercent > (job.progress.stagePercent || 0)) {
                        job.progress.stagePercent = stagePercent;
                        persistQueue();
                    }
                }
            };

            proc.stderr.on('data', (d) => {
                const chunk = d.toString();
                stderr += chunk;
                handleRealProgressChunk(chunk);
            });
            proc.stdout.on('data', (d) => {
                handleRealProgressChunk(d.toString());
            });

            proc.on('close', (code) => {
                activeProcs = activeProcs.filter(p => p !== proc);
                if (job?.status === 'cancelled' || currentJob?.status === 'cancelled') {
                    reject(markJobCancelledError());
                    return;
                }
                const produced = fs.existsSync(outputDir)
                    ? fs.readdirSync(outputDir).filter(f => IMAGE_EXT.test(f)).length
                    : 0;
                const filteredStderr = filterNcnnStderr(stderr);

                if (produced > 0) {
                    if (code !== 0 && code !== null) {
                        console.warn(`[Upscaler] Real-ESRGAN exited code ${code} but produced ${produced} files.`);
                    }
                    resolve();
                } else {
                    reject(new Error(`Real-ESRGAN batch failed (code ${code})${filteredStderr ? ': ' + filteredStderr.slice(-300) : ''}`));
                }
            });

            proc.on('error', (err) => {
                activeProcs = activeProcs.filter(p => p !== proc);
                if (job?.status === 'cancelled' || currentJob?.status === 'cancelled') {
                    reject(markJobCancelledError());
                    return;
                }
                reject(new Error(`Failed to start Real-ESRGAN: ${err.message}`));
            });
        });
    } finally {
        clearInterval(pollInterval);
    }

    // Optional corruption fallback for very tiny files.
    const minValidBytesRaw = Number(process.env.KODO_UPSCALER_MIN_VALID_BYTES || 1024);
    const MIN_VALID_SIZE = Number.isFinite(minValidBytesRaw) && minValidBytesRaw > 0 ? minValidBytesRaw : 0;
    if (MIN_VALID_SIZE > 0) {
        const outputFiles = fs.readdirSync(outputDir).filter(f => IMAGE_EXT.test(f));
        for (const f of outputFiles) {
            const outPath = path.join(outputDir, f);
            try {
                const stat = fs.statSync(outPath);
                if (stat.size < MIN_VALID_SIZE) {
                    console.warn(`[Upscaler] Tiny output detected (${stat.size}B): ${f} - re-upscaling...`);
                    fs.removeSync(outPath);
                    const inputPath = path.join(inputDir, f);
                    if (fs.existsSync(inputPath)) {
                        try {
                            await runUpscalerSingle(inputPath, outPath, model, scale, denoiseLevel, settings, waifu2xModelDir, job);
                            console.log(`[Upscaler] Re-upscaled ${f} successfully.`);
                        } catch (err) {
                            if (isJobCancelledError(err) || job?.status === 'cancelled' || currentJob?.status === 'cancelled') {
                                return;
                            }
                            console.error(`[Upscaler] Failed to re-upscale ${f}: ${err.message}`);
                        }
                    }
                }
            } catch { }
        }
    }

    // Final progress update
    const finalCount = fs.readdirSync(outputDir).filter(f => IMAGE_EXT.test(f)).length;
    job.progress.pagesCurrent = finalCount;
    job.progress.stagePercent = 100;
    persistQueue();
};/**
 * Return list of upscaled images in staging for preview.
 */
const getJobStagingImages = (jobId, chapterName) => {
    const stagingBase = path.join(DATA_DIR, 'upscale-staging', jobId);
    if (!fs.existsSync(stagingBase)) return [];

    // If chapterName given, look inside subdir or cbz
    let targetDir = stagingBase;
    if (chapterName) {
        const sub = path.join(stagingBase, chapterName);
        const cbz = path.join(stagingBase, chapterName + '.cbz');
        if (fs.existsSync(sub)) targetDir = sub;
        else if (fs.existsSync(cbz)) {
            // Extract cbz to a temp reading dir and return those paths
            const tmpRead = path.join(DATA_DIR, 'upscale-preview', jobId, chapterName);
            if (!fs.existsSync(tmpRead)) {
                fs.ensureDirSync(tmpRead);
                const AdmZip = require('adm-zip');
                new AdmZip(cbz).extractAllTo(tmpRead, true);
            }
            targetDir = tmpRead;
        }
    }

    if (!fs.existsSync(targetDir)) return [];
    return fs.readdirSync(targetDir)
        .filter(f => IMAGE_EXT.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map(f => path.join(targetDir, f));
};

/**
     * Check if model files exist for a given model.
     * Returns { ok: bool, missing: [] }
     */
const checkModelFiles = (model, settings) => {
    if (model === 'waifu2x') {
        const desiredModelDir = settings?.waifu2xModelDir || 'models-cunet';
        const exe = selectFirstUsableWaifu2xExe(
            [settings?.waifu2xPath, getDefaultWaifu2xExe(), detectManagedExecutables().waifu2xExe],
            desiredModelDir
        ) || 'waifu2x-ncnn-vulkan';
        if (!exe || !fs.existsSync(exe)) return { ok: false, missing: ['waifu2x-ncnn-vulkan.exe'] };
        const missing = hasWaifu2xModelFilesForExe(exe, desiredModelDir) ? [] : [desiredModelDir];
        return { ok: missing.length === 0, missing };
    } else {
        const exe = settings?.realesrganPath || getDefaultRealesrganExe() || 'realesrgan-ncnn-vulkan';
        if (!exe || !fs.existsSync(exe)) return { ok: false, missing: ['realesrgan-ncnn-vulkan.exe'] };
        const dir = path.dirname(exe);
        const modelName = normalizeRealEsrganModelId(model) || pickPreferredRealEsrganModel(getRealesrganModels(settings), settings?.realesrganModel);
        const needed = [`${modelName}.bin`, `${modelName}.param`];
        const modelsDir = path.join(dir, 'models');
        const missing = needed.filter(f => !fs.existsSync(path.join(modelsDir, f)));
        return { ok: missing.length === 0, missing };
    }
};

/**
 * List available Waifu2x model directories from the exe folder.
 * Returns array of directory names like ['models-cunet', 'models-upconv_7_anime_style_art_rgb', ...]
 */
const getWaifu2xModels = (settings) => {
    const exe = settings.waifu2xPath;
    if (!exe || !fs.existsSync(exe)) return [];
    const dir = path.dirname(exe);
    try {
        return fs.readdirSync(dir)
            .filter(f => f.startsWith('models-') && fs.statSync(path.join(dir, f)).isDirectory());
    } catch { return []; }
};

/**
 * List available RealESRGAN model files from the models folder.
 * Returns array of model identifiers.
 */
const getRealesrganModels = (settings) => {
    const exe = settings.realesrganPath;
    if (!exe || !fs.existsSync(exe)) return [];
    const modelsDir = path.join(path.dirname(exe), 'models');
    if (!fs.existsSync(modelsDir)) return [];
    try {
        const files = fs.readdirSync(modelsDir);
        // Collect unique model names from .bin/.param pairs
        const modelNames = new Set();
        files.forEach(f => {
            if (f.endsWith('.bin') || f.endsWith('.param')) {
                modelNames.add(f.replace(/\.(bin|param)$/, ''));
            }
        });
        // Also check for .pth files (PyTorch models)
        files.forEach(f => {
            if (f.endsWith('.pth')) {
                modelNames.add(f.replace(/\.pth$/, ''));
            }
        });
        return Array.from(modelNames).sort((a, b) => a.localeCompare(b));
    } catch { return []; }
};

module.exports = {
    isUpscalerDirPopulated,
    loadSettings, saveSettings, addJob, removeJob, removeSeries, abortCurrentJob,
    finalizeJob, discardJob, getQueue, getArchive, deleteArchive, deleteArchivePartial,
    restoreArchive, getJobStagingImages, checkModelFiles, getWaifu2xModels,
    getRealesrganModels, processNext, deleteUpscalerPackage,
    // Package management exports
    loadPackageState, updatePackageState, installUpscalerPackage, cancelUpscalerPackageInstall, getUpscalerModelRootFolder, ensureSettingsAutoDetected
};
