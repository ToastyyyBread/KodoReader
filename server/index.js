const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { exec, spawn } = require('child_process');
const { encryptData, decryptData } = require('./backup');
const gdrive = require('./gdrive');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Path resolution for Electron vs Dev ──────────────────
const IS_PACKAGED = process.env.KODO_IS_PACKAGED === '1';
const APP_ROOT = process.env.KODO_APP_ROOT || path.join(__dirname, '..');

// Load environment variables securely from .env
const dotenv = require('dotenv');
const appDataRoot = process.env.APPDATA || '';
const envPaths = Array.from(new Set([
    appDataRoot ? path.join(appDataRoot, 'kodo', '.env') : '',
    appDataRoot ? path.join(appDataRoot, 'Kodo', '.env') : '',
    path.join(APP_ROOT, '.env'),
    path.resolve(process.cwd(), '.env'),
    path.join(__dirname, '..', '.env'),
].filter(Boolean)));
for (const p of envPaths) {
    if (fs.existsSync(p)) {
        dotenv.config({ path: p });
    }
}

const RESOURCE_ROOT = process.env.KODO_RESOURCE_ROOT || path.join(__dirname, '..');
const normalizeConfigValue = (value) => String(value || '').trim().replace(/^["']|["']$/g, '');
const getConfigPaths = () => {
    const requestedConfigPath = normalizeConfigValue(process.env.KODO_CONFIG_PATH);
    const exeDir = path.dirname(process.execPath || '');
    return Array.from(new Set([
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
    ].filter(Boolean).map((p) => path.resolve(p))));
};
const getConfigValue = (key) => {
    for (const p of getConfigPaths()) {
        try {
            if (!fs.existsSync(p)) continue;
            const parsed = fs.readJsonSync(p);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
            const raw = parsed[key];
            if (raw === undefined || raw === null) continue;
            if (typeof raw === 'boolean') return raw;
            const normalized = normalizeConfigValue(raw);
            if (normalized) return normalized;
        } catch { }
    }
    return '';
};

let _cachedAppVersion = '';
const getAppVersion = () => {
    if (_cachedAppVersion) return _cachedAppVersion;

    const envVersion = normalizeConfigValue(process.env.KODO_APP_VERSION || process.env.npm_package_version);
    if (envVersion) {
        _cachedAppVersion = envVersion;
        return _cachedAppVersion;
    }

    const candidates = [
        path.join(APP_ROOT, 'src-tauri', 'tauri.conf.json'),
        path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json'),
        path.join(APP_ROOT, 'package.json'),
        path.join(__dirname, '..', 'package.json'),
        path.resolve(process.cwd(), 'package.json'),
    ];

    for (const p of candidates) {
        try {
            if (!fs.existsSync(p)) continue;
            const parsed = fs.readJsonSync(p);
            const v = normalizeConfigValue(parsed?.version);
            if (v) {
                _cachedAppVersion = v;
                return _cachedAppVersion;
            }
        } catch { }
    }

    _cachedAppVersion = '0.0.0';
    return _cachedAppVersion;
};

const normalizeGithubRepo = (rawRepo) => {
    const raw = normalizeConfigValue(rawRepo);
    if (!raw) return '';
    return raw
        .replace(/^https?:\/\/github\.com\//i, '')
        .replace(/^github\.com\//i, '')
        .replace(/\/+$/, '')
        .replace(/\.git$/i, '');
};

const resolveUpdateApiUrl = () => {
    const explicitApiUrl = normalizeConfigValue(getConfigValue('appUpdateApiUrl'));
    if (explicitApiUrl) return explicitApiUrl;
    const repo = normalizeGithubRepo(getConfigValue('appUpdateRepo'));
    if (!repo) return '';
    return `https://api.github.com/repos/${repo}/releases/latest`;
};

const fetchJsonWithTimeout = async (url, timeoutMs = 9000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/vnd.github+json',
                'User-Agent': 'Kodo-Update-Checker',
            },
            signal: controller.signal,
        });
        let payload = {};
        try {
            payload = await response.json();
        } catch {
            payload = {};
        }
        if (!response.ok) {
            const apiMsg = normalizeConfigValue(payload?.message);
            throw new Error(apiMsg || `HTTP ${response.status}`);
        }
        return payload;
    } finally {
        clearTimeout(timeout);
    }
};

const resolveMangaPath = () => {
    const envPath = (process.env.KODO_MANGA_PATH || '').trim();
    if (envPath) return path.resolve(envPath);
    return path.join(APP_ROOT, 'manga');
};

const MANGA_PATH = resolveMangaPath();
process.env.KODO_MANGA_PATH = MANGA_PATH;
const META_PATH = path.join(APP_ROOT, 'data', 'meta.json');
const CAT_PATH = path.join(APP_ROOT, 'data', 'categories.json');
const CBZ_CACHE = path.join(APP_ROOT, 'data', 'cbz-cache');
const COVER_UPLOAD_TMP = path.join(APP_ROOT, 'data', 'cover-upload-tmp');
const BOOKMARK_DIR = path.join(APP_ROOT, 'data', 'bookmark', 'saved');
const BOOKMARK_JSON_PATH = path.join(APP_ROOT, 'data', 'bookmark', 'bookmarks.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
fs.ensureDirSync(MANGA_PATH);
fs.ensureDirSync(path.dirname(META_PATH));
fs.ensureDirSync(CBZ_CACHE);
fs.ensureDirSync(COVER_UPLOAD_TMP);
fs.ensureDirSync(BOOKMARK_DIR);
fs.ensureDirSync(path.dirname(BOOKMARK_JSON_PATH));

// ── Serve built frontend ─────────────────────────────────
const clientDistPath = IS_PACKAGED
    ? path.join(__dirname, '..', 'client', 'dist')
    : path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
}

// ── Library cache ─────────────────────────────────────────
let _libraryCache = null;
let _libraryCacheBuilding = false;

const buildLibraryList = async () => {
    const meta = loadMeta();
    const dirs = await getDirs(MANGA_PATH);

    // Build hidden paths set using async I/O (don't block event loop)
    const hiddenPaths = new Set();
    await Promise.all(dirs.map(async (dirName) => {
        const versionsDir = path.join(MANGA_PATH, dirName, 'versions');
        try {
            const vDirs = await fs.readdir(versionsDir);
            await Promise.all(vDirs.map(async (vId) => {
                const vPath = path.join(versionsDir, vId);
                try {
                    const stat = await fs.lstat(vPath);
                    if (stat.isSymbolicLink()) {
                        hiddenPaths.add((await fs.realpath(vPath)).toLowerCase());
                    }
                } catch { }
            }));
        } catch { }
    }));

    const list = (await Promise.all(Object.keys(meta).map(async (name) => {
        const mangaDir = path.join(MANGA_PATH, name);
        const m = meta[name] || {};
        const sourceDir = resolveMangaDir(name, meta);

        try {
            if (hiddenPaths.has((await fs.realpath(sourceDir)).toLowerCase())) return null;
        } catch { }

        // Run chapter scan, cover search, and stat in parallel
        const [chapters, cover, dirStat] = await Promise.all([
            getChapters(sourceDir),
            findCover(mangaDir, sourceDir, name),
            fs.stat(sourceDir).catch(() => null),
        ]);

        const lastChapterAdded = dirStat ? dirStat.mtimeMs : 0;

        let versionsWithCovers = [];
        if (Array.isArray(m.versions)) {
            versionsWithCovers = await Promise.all(m.versions.map(async (v) => {
                const vManagedDir = path.join(mangaDir, 'versions', v.id);
                const vSourceDir = resolveVersionDir(name, v.id, meta);
                let vCover = null;
                let vChapterCount = 0;
                try {
                    await fs.access(vSourceDir);
                    // Run version cover and chapter scan in parallel
                    const [vc, vch] = await Promise.all([
                        findCover(vManagedDir, vSourceDir, name, 'versions/' + v.id),
                        getChapters(vSourceDir),
                    ]);
                    vCover = vc;
                    vChapterCount = vch.length;
                } catch { }
                return { ...v, cover: vCover, chapterCount: vChapterCount };
            }));
        }
        return {
            id: name,
            title: m.title || name.replace(/[-_]/g, ' '),
            authors: m.authors || '',
            artists: m.artists || '',
            tags: m.tags || [],
            language: m.language || '',
            status: m.status || '',
            categories: m.categories || [],
            description: m.description || '',
            releaseYear: m.releaseYear || '',
            isNsfw: !!m.isNsfw,
            chapterCount: chapters.length,
            versions: versionsWithCovers,
            cover,
            progress: m.progress || null,
            progressByVersion: m.progressByVersion || {},
            readChapters: m.readChapters || [],
            readChaptersByVersion: m.readChaptersByVersion || {},
            lastChapterAdded
        };
    }))).filter(Boolean);
    return list;
};

let _libraryCachePromise = null;

const refreshLibraryCache = async () => {
    if (_libraryCacheBuilding) return _libraryCachePromise;
    _libraryCacheBuilding = true;
    _libraryCachePromise = (async () => {
        try {
            _libraryCache = await buildLibraryList();
        } catch (err) {
            console.error('Library cache build failed:', err.message);
        } finally {
            _libraryCacheBuilding = false;
            _libraryCachePromise = null;
        }
    })();
    return _libraryCachePromise;
};

const invalidateLibraryCache = () => { _libraryCache = null; };

// Returns a promise that resolves when the library cache is ready
const waitForLibraryCache = async (timeoutMs = 30000) => {
    if (_libraryCache) return _libraryCache;
    ensureLibraryCacheWarmup();
    // Wait for the current build to finish
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (_libraryCache) return _libraryCache;
        if (_libraryCachePromise) {
            await _libraryCachePromise;
            if (_libraryCache) return _libraryCache;
        }
        await new Promise(r => setTimeout(r, 200));
    }
    return _libraryCache; // may be null if timed out
};

const ensureLibraryCacheWarmup = () => {
    if (_libraryCache || _libraryCacheBuilding) return;
    refreshLibraryCache()
        .then(() => {
            if (_libraryCache) persistLibraryCacheToMeta(_libraryCache);
        })
        .catch((err) => {
            console.error('Library warmup failed:', err?.message || err);
        });
};

// Build the metadata-only fast response from meta.json (no FS scan)
const buildFastLibraryList = () => {
    const meta = loadMeta();
    return Object.keys(meta).map(name => {
        const m = meta[name] || {};
        return {
            id: name,
            title: m.title || name.replace(/[-_]/g, ' '),
            authors: m.authors || '',
            artists: m.artists || '',
            tags: m.tags || [],
            language: m.language || '',
            status: m.status || '',
            categories: m.categories || [],
            description: m.description || '',
            releaseYear: m.releaseYear || '',
            isNsfw: !!m.isNsfw,
            chapterCount: m._cachedChapterCount || 0,
            versions: (m.versions || []).map(v => ({ ...v, cover: v._cachedCover || null, chapterCount: v._cachedChapterCount || 0 })),
            cover: m._cachedCover || null,
            progress: m.progress || null,
            progressByVersion: m.progressByVersion || {},
            readChapters: m.readChapters || [],
            readChaptersByVersion: m.readChaptersByVersion || {},
            lastChapterAdded: m._cachedLastChapterAdded || 0
        };
    });
};

// Persist cached covers/chapter counts into meta so next cold start is instant
const persistLibraryCacheToMeta = (list) => {
    try {
        const meta = loadMeta();
        let changed = false;
        for (const item of list) {
            if (!meta[item.id]) continue;
            // Cache main series cover and chapter count
            if (meta[item.id]._cachedCover !== item.cover || meta[item.id]._cachedChapterCount !== item.chapterCount) {
                meta[item.id]._cachedCover = item.cover;
                meta[item.id]._cachedChapterCount = item.chapterCount;
                meta[item.id]._cachedLastChapterAdded = item.lastChapterAdded;
                changed = true;
            }
            // Cache version covers and chapter counts
            if (Array.isArray(item.versions) && Array.isArray(meta[item.id].versions)) {
                for (const itemV of item.versions) {
                    const metaV = meta[item.id].versions.find(v => v.id === itemV.id);
                    if (!metaV) continue;
                    if (metaV._cachedCover !== itemV.cover || metaV._cachedChapterCount !== itemV.chapterCount) {
                        metaV._cachedCover = itemV.cover;
                        metaV._cachedChapterCount = itemV.chapterCount;
                        changed = true;
                    }
                }
            }
        }
        if (changed) saveMeta(meta);
    } catch { }
};

// ── Metadata helpers ──────────────────────────────────────
const loadMeta = () => { try { return fs.readJsonSync(META_PATH); } catch { return {}; } };
const saveMeta = (m) => { fs.writeJsonSync(META_PATH, m, { spaces: 2 }); invalidateLibraryCache(); };
const loadCategories = () => { try { return fs.readJsonSync(CAT_PATH); } catch { return []; } };
const saveCategories = (c) => fs.writeJsonSync(CAT_PATH, c, { spaces: 2 });
const loadBookmarks = () => { try { return fs.readJsonSync(BOOKMARK_JSON_PATH); } catch { return []; } };
const saveBookmarks = (b) => {
    fs.ensureDirSync(path.dirname(BOOKMARK_JSON_PATH));
    fs.writeJsonSync(BOOKMARK_JSON_PATH, b, { spaces: 2 });
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

const toMetaPathReference = (rawPath) => {
    const abs = normalizeInputPath(rawPath);
    if (!abs) return { abs: '', rel: '' };

    const rel = path.relative(MANGA_PATH, abs);
    const insideMangaRoot = rel && !rel.startsWith('..') && !path.isAbsolute(rel);

    return { abs, rel: insideMangaRoot ? rel : '' };
};

const isExistingDirectory = (targetPath) => {
    try {
        return fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
    } catch {
        return false;
    }
};

const resolveMangaDir = (id, meta) => {
    const m = meta[id] || {};
    const linkedPath = resolveLinkedPath(m.sourcePath, m.sourcePathRel);
    if (linkedPath) return linkedPath;
    return path.join(MANGA_PATH, id);
};

const resolveVersionDir = (id, vId, meta) => {
    const m = meta[id] || {};
    if (m.versions) {
        const v = m.versions.find(ver => ver.id === vId);
        if (v) {
            const linkedPath = resolveLinkedPath(v.folderPath, v.folderPathRel);
            if (linkedPath) return linkedPath;
        }
    }
    return path.join(MANGA_PATH, id, 'versions', vId);
};

const sanitizeSeriesId = (title, folderPath = '') => {
    const sanitize = (value) => String(value || '')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const fromTitle = sanitize(title);
    if (fromTitle) return fromTitle;

    const fromFolder = sanitize(path.basename(String(folderPath || '')));
    if (fromFolder) return fromFolder;

    return `untitled-${Date.now()}`;
};

const ensureUniqueSeriesId = (baseId, meta) => {
    let candidate = baseId;
    let counter = 2;
    while (meta[candidate] || fs.existsSync(path.join(MANGA_PATH, candidate))) {
        candidate = `${baseId} (${counter++})`;
    }
    return candidate;
};

// ── Helpers ───────────────────────────────────────────────
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|avif)$/i;

const getDirs = async (src) => {
    try {
        const items = await fs.readdir(src, { withFileTypes: true });
        return items
            .filter(d => {
                if (d.isDirectory()) return true;
                if (!d.isSymbolicLink()) return false;
                try {
                    return fs.statSync(path.join(src, d.name)).isDirectory();
                } catch {
                    return false;
                }
            })
            .map(d => d.name);
    } catch { return []; }
};

const getCbzFiles = async (src) => {
    try {
        const items = await fs.readdir(src, { withFileTypes: true });
        return items.filter(d => d.isFile() && /\.cbz$/i.test(d.name)).map(d => d.name);
    } catch { return []; }
};

// Folders to exclude from chapter listing
const EXCLUDED_DIRS = new Set(['versions']);

// Returns { name, type }[] for all chapters (folders + cbz)
const getChapters = async (mangaDir) => {
    try {
        const items = await fs.readdir(mangaDir, { withFileTypes: true });
        const dirs = items
            .filter(d => {
                if (EXCLUDED_DIRS.has(d.name.toLowerCase())) return false;
                if (d.isDirectory()) return true;
                if (!d.isSymbolicLink()) return false;
                try { return fs.statSync(path.join(mangaDir, d.name)).isDirectory(); } catch { return false; }
            })
            .map(d => ({ name: d.name, type: 'folder' }));
        const cbzs = items
            .filter(d => d.isFile() && /\.cbz$/i.test(d.name))
            .map(d => ({ name: d.name.replace(/\.cbz$/i, ''), type: 'cbz', file: d.name }));
        const all = [...dirs, ...cbzs];
        return all.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    } catch { return []; }
};

// Extract CBZ pages to cache
const getCbzImages = (mangaId, chapterFile, mangaDir = null, versionId = null) => {
    const cbzPath = mangaDir ? path.join(mangaDir, chapterFile) : path.join(MANGA_PATH, mangaId, chapterFile);
    const cacheNameBase = chapterFile.replace(/\.cbz$/i, '');
    const cacheName = versionId && versionId !== 'default' ? `${versionId}_${cacheNameBase}` : cacheNameBase;
    const cacheDir = path.join(CBZ_CACHE, mangaId, cacheName);

    if (!fs.existsSync(cacheDir) || fs.readdirSync(cacheDir).length === 0) {
        fs.ensureDirSync(cacheDir);
        try {
            const zip = new AdmZip(cbzPath);
            const entries = zip.getEntries()
                .filter(e => IMAGE_EXT.test(e.entryName) && !e.isDirectory)
                .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }));
            entries.forEach(e => {
                zip.extractEntryTo(e, cacheDir, false, true);
            });
        } catch (err) {
            console.error('CBZ extract error:', err.message);
        }
    }

    return fs.readdirSync(cacheDir)
        .filter(f => IMAGE_EXT.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map(f => `/api/cbz-cache/${encodeURIComponent(mangaId)}/${encodeURIComponent(cacheName)}/${encodeURIComponent(f)}`);
};

// Find cover image
const findCoverLocal = async (dir, mangaId, subPath = '') => {
    if (!dir) return null;
    try {
        await fs.access(dir);
    } catch { return null; }
    try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        const urlPrefix = `/api/cover-file/${encodeURIComponent(mangaId)}${subPath ? '/' + subPath : ''}`;

        // 1) Look for an explicit cover file
        const cover = items.find(f => f.isFile() && /cover\.(jpg|jpeg|png|webp)$/i.test(f.name));
        if (cover) return `${urlPrefix}/${encodeURIComponent(cover.name)}`;

        // 2) Try first image inside the first folder chapter
        const firstDir = items.find(d => d.isDirectory() || (d.isSymbolicLink() && (() => { try { return fs.statSync(path.join(dir, d.name)).isDirectory(); } catch { return false; } })()));
        if (firstDir) {
            const chFiles = await fs.readdir(path.join(dir, firstDir.name)).catch(() => []);
            const img = chFiles.find(f => IMAGE_EXT.test(f));
            if (img) return `${urlPrefix}/${encodeURIComponent(firstDir.name)}/${encodeURIComponent(img)}`;
        }

        // 3) Try CBZ first page (dynamic cover route, no extraction needed)
        const firstCbz = items.find(d => d.isFile() && /\.cbz$/i.test(d.name));
        if (firstCbz) {
            return `/api/dynamic-cbz-cover/${encodeURIComponent(mangaId)}/${encodeURIComponent(firstCbz.name)}?subPath=${encodeURIComponent(subPath)}`;
        }

        return null;
    } catch { return null; }
};

const findCover = async (managedDir, sourceDir, mangaId, subPath = '') => {
    let cover = await findCoverLocal(managedDir, mangaId, subPath);
    if (cover) return cover;
    if (sourceDir && sourceDir !== managedDir) {
        return await findCoverLocal(sourceDir, mangaId, subPath);
    }
    return null;
};

// ══════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════

app.get('/api/dynamic-cbz-cover/:mangaId/:chapterFile', async (req, res) => {
    try {
        const { mangaId, chapterFile } = req.params;
        const subPath = req.query.subPath || '';
        const meta = loadMeta();

        // Resolve directory
        let dir;
        if (subPath.startsWith('versions/')) {
            const vId = subPath.split('/')[1];
            dir = resolveVersionDir(mangaId, vId, meta);
        } else {
            dir = resolveMangaDir(mangaId, meta);
        }

        if (!dir || !fs.existsSync(dir)) return res.status(404).send('Not found');

        const cbzPath = path.join(dir, chapterFile);
        if (!fs.existsSync(cbzPath)) return res.status(404).send('CBZ not found');

        // Quick read first image using AdmZip
        const zip = new AdmZip(cbzPath);
        const IMAGE_EXT = /\.(jpg|jpeg|png|webp|avif)$/i;
        const entries = zip.getEntries()
            .filter(e => IMAGE_EXT.test(e.entryName) && !e.isDirectory)
            .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }));

        if (entries.length > 0) {
            const buffer = zip.readFile(entries[0]);
            const ext = path.extname(entries[0].entryName).toLowerCase().replace('.', '');
            const mimeType = ext === 'jpg' ? 'jpeg' : ext;
            res.set('Content-Type', `image/${mimeType === 'avif' ? 'avif' : mimeType === 'png' ? 'png' : mimeType === 'webp' ? 'webp' : 'jpeg'}`);
            res.set('Cache-Control', 'public, max-age=86400');
            return res.send(buffer);
        }

        res.status(404).send('No images found');
    } catch (err) {
        res.status(500).send('Error reading CBZ');
    }
});

// ── GET /api/meta/clear ───────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});

app.get('/api/app/update/check', async (_req, res) => {
    const apiUrl = resolveUpdateApiUrl();
    const currentVersion = getAppVersion();
    if (!apiUrl) {
        return res.json({
            configured: false,
            currentVersion,
            error: 'Update checker is not configured. Set "appUpdateRepo" or "appUpdateApiUrl" in config.json.',
        });
    }

    try {
        const payload = await fetchJsonWithTimeout(apiUrl);
        const tagName = normalizeConfigValue(payload?.tag_name || payload?.name);
        const repo = normalizeGithubRepo(getConfigValue('appUpdateRepo'));
        const fallbackReleaseUrl = repo ? `https://github.com/${repo}/releases` : '';

        res.json({
            configured: true,
            currentVersion,
            latestVersion: tagName,
            releaseName: normalizeConfigValue(payload?.name),
            releaseUrl: normalizeConfigValue(payload?.html_url) || fallbackReleaseUrl,
            publishedAt: normalizeConfigValue(payload?.published_at),
            prerelease: Boolean(payload?.prerelease),
            draft: Boolean(payload?.draft),
        });
    } catch (err) {
        res.status(502).json({
            configured: true,
            currentVersion,
            error: `Failed to check update: ${err?.message || 'unknown error'}`,
        });
    }
});

app.post('/api/meta/clear', (req, res) => {
    try {
        saveMeta({});
        saveBookmarks([]);
        if (fs.existsSync(BOOKMARK_DIR)) fs.emptyDirSync(BOOKMARK_DIR);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Bookmarks ─────────────────────────────────────────────
const cleanOrphanedBookmarks = () => {
    try {
        const bookmarks = loadBookmarks();
        const validFiles = new Set();
        bookmarks.forEach(b => {
            if (!b.thumbnail) return;
            try {
                const urlObj = new URL(b.thumbnail, 'http://localhost');
                const pathParts = urlObj.pathname.split('/');
                const imageIdx = pathParts.indexOf('image');
                if (imageIdx !== -1 && pathParts.length >= imageIdx + 3) {
                    const seriesName = decodeURIComponent(pathParts[imageIdx + 1]);
                    const fileName = decodeURIComponent(pathParts[imageIdx + 2]);
                    validFiles.add(path.join(BOOKMARK_DIR, seriesName, fileName));
                }
            } catch { }
        });

        if (!fs.existsSync(BOOKMARK_DIR)) return;
        const seriesDirs = fs.readdirSync(BOOKMARK_DIR);
        for (const sDir of seriesDirs) {
            const seriesPath = path.join(BOOKMARK_DIR, sDir);
            if (!fs.statSync(seriesPath).isDirectory()) continue;

            const files = fs.readdirSync(seriesPath);
            for (const f of files) {
                const fp = path.join(seriesPath, f);
                if (!validFiles.has(fp)) {
                    try { fs.removeSync(fp); } catch { }
                }
            }
            if (fs.readdirSync(seriesPath).length === 0) {
                try { fs.removeSync(seriesPath); } catch { }
            }
        }
    } catch (err) {
        console.error('Bookmark orphaned cleanup error:', err);
    }
};

let _bookmarkCleanupPending = false;
let _bookmarkCleanupTimer = null;
const scheduleBookmarkCleanup = (delayMs = 2000) => {
    if (_bookmarkCleanupPending) return;
    _bookmarkCleanupPending = true;
    if (_bookmarkCleanupTimer) clearTimeout(_bookmarkCleanupTimer);
    _bookmarkCleanupTimer = setTimeout(() => {
        _bookmarkCleanupPending = false;
        _bookmarkCleanupTimer = null;
        cleanOrphanedBookmarks();
    }, Math.max(0, Number(delayMs) || 0));
};

app.get('/api/bookmarks', (req, res) => {
    try {
        res.json(loadBookmarks());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bookmarks/sync', (req, res) => {
    try {
        const { bookmarks: clientBookmarks } = req.body;
        if (Array.isArray(clientBookmarks) && clientBookmarks.length > 0) {
            const existing = loadBookmarks();
            const existingIds = new Set(existing.map(b => b.id));
            let added = false;

            for (const b of clientBookmarks) {
                if (!existingIds.has(b.id)) {
                    existing.push(b);
                    existingIds.add(b.id);
                    added = true;
                }
            }
            if (added) {
                existing.sort((a, b) => (b.ts || 0) - (a.ts || 0));
                saveBookmarks(existing);
            }
        }
        scheduleBookmarkCleanup();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bookmark/save', (req, res) => {
    try {
        const { id, mangaId, mangaTitle, chapterId, page, scrollRatio, thumbnailBase64 } = req.body;
        console.log('[Bookmark] Save request:', { id, mangaId, mangaTitle, chapterId, page, scrollRatio, hasThumbnail: !!thumbnailBase64 });

        if (!mangaTitle || !thumbnailBase64) return res.status(400).json({ error: 'Missing data' });

        const seriesName = sanitizeSeriesId(mangaTitle) || 'unknown';
        const seriesDir = path.join(BOOKMARK_DIR, seriesName);
        fs.ensureDirSync(seriesDir);

        const matches = thumbnailBase64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return res.status(400).json({ error: 'Invalid base64 payload' });

        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const fileName = `screenshot-${Date.now()}.${ext}`;
        const filePath = path.join(seriesDir, fileName);

        fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));

        const url = `/api/bookmark/image/${encodeURIComponent(seriesName)}/${encodeURIComponent(fileName)}`;
        const bookmarkId = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

        const bookmark = {
            id: bookmarkId,
            mangaId: mangaId || seriesName,
            mangaTitle,
            chapterId,
            page,
            scrollRatio: scrollRatio != null ? scrollRatio : null,
            thumbnail: url,
            ts: Date.now()
        };

        const list = loadBookmarks();
        list.unshift(bookmark);
        saveBookmarks(list);
        console.log('[Bookmark] Saved successfully:', bookmarkId, 'total:', list.length, 'json:', BOOKMARK_JSON_PATH);

        res.json({ url, bookmark });
    } catch (err) {
        console.error('[Bookmark] Save error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/bookmarks/:id', (req, res) => {
    try {
        const { id } = req.params;
        let list = loadBookmarks();
        const bookmark = list.find(b => b.id === id);

        if (bookmark && bookmark.thumbnail) {
            try {
                // thumbnail is something like http://localhost:5000/api/bookmark/image/seriesName/fileName 
                // or /api/bookmark/image/seriesName/fileName
                const urlObj = new URL(bookmark.thumbnail, 'http://localhost');
                const pathParts = urlObj.pathname.split('/');

                // pathname expects: /api/bookmark/image/seriesName/fileName
                // which splits to: ["", "api", "bookmark", "image", seriesName, fileName]
                const imageIdx = pathParts.indexOf('image');
                if (imageIdx !== -1 && pathParts.length >= imageIdx + 3) {
                    const seriesName = decodeURIComponent(pathParts[imageIdx + 1]);
                    const fileName = decodeURIComponent(pathParts[imageIdx + 2]);
                    const filePath = path.join(BOOKMARK_DIR, seriesName, fileName);
                    if (fs.existsSync(filePath)) {
                        fs.removeSync(filePath);
                    }
                }
            } catch (e) {
                console.error('Failed to delete bookmark image:', e);
            }
        }

        list = list.filter(b => b.id !== id);
        saveBookmarks(list);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/bookmark/image/:seriesName/:fileName', (req, res) => {
    try {
        const seriesName = req.params.seriesName;
        const fileName = req.params.fileName;
        const filePath = path.join(BOOKMARK_DIR, seriesName, fileName);
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).send('Not found');
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ── GET /api/health ───────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});

// ── GET /api/categories ───────────────────────────────────
app.get('/api/categories', (_req, res) => {
    res.json(loadCategories());
});

app.post('/api/categories', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const cats = loadCategories();
    if (!cats.includes(name)) {
        cats.push(name);
        saveCategories(cats);
    }
    res.json(cats);
});

app.delete('/api/categories/:name', (req, res) => {
    const { name } = req.params;
    let cats = loadCategories();
    cats = cats.filter(c => c !== name);
    saveCategories(cats);

    // Remove category from all manga
    const meta = loadMeta();
    let updated = false;
    for (const key in meta) {
        if (meta[key].categories && meta[key].categories.includes(name)) {
            meta[key].categories = meta[key].categories.filter(c => c !== name);
            updated = true;
        }
    }
    if (updated) saveMeta(meta);

    res.json(cats);
});

app.put('/api/categories/:name', (req, res) => {
    const { name: oldName } = req.params;
    const { newName } = req.body;
    if (!newName) return res.status(400).json({ error: 'New name required' });
    let cats = loadCategories();
    const idx = cats.indexOf(oldName);
    if (idx !== -1 && !cats.includes(newName)) {
        cats[idx] = newName;
        saveCategories(cats);

        // Update in meta
        const meta = loadMeta();
        let updated = false;
        for (const key in meta) {
            if (meta[key].categories && meta[key].categories.includes(oldName)) {
                meta[key].categories = meta[key].categories.map(c => c === oldName ? newName : c);
                updated = true;
            }
        }
        if (updated) saveMeta(meta);
    }
    res.json(cats);
});

// ── GET /api/manga ────────────────────────────────────────
app.get('/api/manga', async (_req, res) => {
    try {
        const forceRefresh = _req.query.refresh === 'true';
        const shouldWait = _req.query.wait === 'true';

        // ?refresh=true → rebuild fully and wait
        if (forceRefresh) {
            const list = await buildLibraryList();
            _libraryCache = list;
            _libraryCacheBuilding = false;
            persistLibraryCacheToMeta(list);
            res.set('X-Kodo-Library-Cache', 'ready');
            res.json(list);
            return;
        }

        // If cache is ready, return it instantly
        if (_libraryCache) {
            res.set('X-Kodo-Library-Cache', 'ready');
            res.json(_libraryCache);
            return;
        }

        // ?wait=true → block until cache build completes (for cold-start flow)
        if (shouldWait) {
            const cached = await waitForLibraryCache();
            if (cached) {
                res.set('X-Kodo-Library-Cache', 'ready');
                res.json(cached);
            } else {
                // Timeout: return fast list as fallback
                ensureLibraryCacheWarmup();
                res.set('X-Kodo-Library-Cache', 'warming');
                res.json(buildFastLibraryList());
            }
            return;
        }

        // Cold start path: return metadata snapshot quickly,
        // while full filesystem scan runs in the background.
        ensureLibraryCacheWarmup();
        res.set('X-Kodo-Library-Cache', 'warming');
        res.json(buildFastLibraryList());
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ── GET /api/manga/:id ────────────────────────────────────
app.get('/api/manga/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const meta = loadMeta();
        const m = meta[id] || {};
        const mangaDir = path.join(MANGA_PATH, id);
        const sourceDir = resolveMangaDir(id, meta);
        if (!fs.existsSync(sourceDir)) return res.status(404).json({ error: 'Not found' });

        const chapters = await getChapters(sourceDir);
        const cover = await findCover(mangaDir, sourceDir, id);
        const versions = [];

        versions.push({
            id: 'default',
            name: m.title || id.replace(/[-_]/g, ' '),
            description: m.description || '',
            authors: m.authors || '',
            artists: m.artists || '',
            tags: m.tags || [],
            status: m.status || '',
            cover,
            chapters: chapters.map(c => c.name)
        });

        if (Array.isArray(m.versions)) {
            for (const v of m.versions) {
                const vManagedDir = path.join(mangaDir, 'versions', v.id);
                const vSourceDir = resolveVersionDir(id, v.id, meta);
                let vChapters = [];
                if (fs.existsSync(vSourceDir)) {
                    vChapters = (await getChapters(vSourceDir)).map(c => c.name);
                }
                let vCover = null;
                if (fs.existsSync(vSourceDir)) {
                    vCover = await findCover(vManagedDir, vSourceDir, id, 'versions/' + v.id);
                }
                versions.push({
                    id: v.id,
                    name: v.name,
                    title: v.title || v.name,
                    description: v.description || '',
                    authors: v.authors || '',
                    artists: v.artists || '',
                    tags: v.tags || [],
                    status: v.status || '',
                    type: v.type || '',
                    folderPath: resolveLinkedPath(v.folderPath, v.folderPathRel) || '',
                    cover: vCover,
                    chapters: vChapters
                });
            }
        }

        const requestedVersion = req.query.version;
        let topChapters = chapters.map(c => c.name);
        let topCover = cover;
        if (requestedVersion && requestedVersion !== 'default') {
            const vManagedDir = path.join(mangaDir, 'versions', requestedVersion);
            const vSourceDir = resolveVersionDir(id, requestedVersion, meta);
            if (fs.existsSync(vSourceDir)) {
                topChapters = (await getChapters(vSourceDir)).map(c => c.name);
                topCover = await findCover(vManagedDir, vSourceDir, id, 'versions/' + requestedVersion) || cover;
            }
        }

        res.json({
            id,
            title: m.title || id.replace(/[-_]/g, ' '),
            authors: m.authors || '',
            artists: m.artists || '',
            tags: m.tags || [],
            language: m.language || '',
            status: m.status || '',
            categories: m.categories || [],
            description: m.description || '',
            releaseYear: m.releaseYear || '',
            isNsfw: !!m.isNsfw,
            chapters: topChapters,
            cover: topCover,
            progress: m.progress || null,
            progressByVersion: m.progressByVersion || {},
            readChapters: m.readChapters || [],
            readChaptersByVersion: m.readChaptersByVersion || {},
            sourcePath: resolveLinkedPath(m.sourcePath, m.sourcePathRel) || '',
            versions
        });
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ── GET /api/manga/:id/:chapter ───────────────────────────
app.get('/api/manga/:id/:chapter', async (req, res) => {
    try {
        const { id, chapter } = req.params;
        const versionId = req.query.version;
        const meta = loadMeta();
        let targetDir = resolveMangaDir(id, meta);

        if (versionId && versionId !== 'default') {
            targetDir = resolveVersionDir(id, versionId, meta);
        }

        const cbzFile = chapter + '.cbz';
        const cbzPath = path.join(targetDir, cbzFile);
        if (fs.existsSync(cbzPath)) {
            const cbzImages = getCbzImages(id, cbzFile, targetDir, versionId);
            return res.json(cbzImages);
        }

        const chapterDir = path.join(targetDir, chapter);
        if (!fs.existsSync(chapterDir)) return res.status(404).json({ error: 'Chapter not found' });

        const files = await fs.readdir(chapterDir);
        const images = files
            .filter(f => IMAGE_EXT.test(f))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        let mappedImages;
        if (versionId && versionId !== 'default') {
            mappedImages = images.map(f => `/api/serve-version/${encodeURIComponent(id)}/${encodeURIComponent(versionId)}/${encodeURIComponent(chapter)}/${encodeURIComponent(f)}`);
        } else {
            mappedImages = images.map(f => `/api/serve/${encodeURIComponent(id)}/${encodeURIComponent(chapter)}/${encodeURIComponent(f)}`);
        }
        res.json(mappedImages);
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ── Static file serving ───────────────────────────────────
const serveCover = (req, res) => {
    const id = decodeURIComponent(req.params.mangaId);

    // Support up to 4 subdirectories 
    const rest = [req.params.p1, req.params.p2, req.params.p3, req.params.p4]
        .filter(Boolean)
        .map(decodeURIComponent);

    const managedPath = path.join(MANGA_PATH, id, ...rest);
    if (fs.existsSync(managedPath)) return res.sendFile(managedPath);

    const meta = loadMeta();
    if (rest[0] === 'versions' && rest.length > 2) {
        const vId = rest[1];
        const baseDir = resolveVersionDir(id, vId, meta);
        const externalPath = path.join(baseDir, ...rest.slice(2));
        if (fs.existsSync(externalPath)) return res.sendFile(externalPath);
    }

    const baseDir = resolveMangaDir(id, meta);
    const externalPath = path.join(baseDir, ...rest);
    if (fs.existsSync(externalPath)) return res.sendFile(externalPath);

    res.status(404).send('Not found');
};

app.get('/api/cover-file/:mangaId', serveCover);
app.get('/api/cover-file/:mangaId/:p1', serveCover);
app.get('/api/cover-file/:mangaId/:p1/:p2', serveCover);
app.get('/api/cover-file/:mangaId/:p1/:p2/:p3', serveCover);
app.get('/api/cover-file/:mangaId/:p1/:p2/:p3/:p4', serveCover);

app.get('/api/serve/:id/:ch/:file', (req, res) => {
    const id = decodeURIComponent(req.params.id);
    const meta = loadMeta();
    const baseDir = resolveMangaDir(id, meta);
    const fp = path.join(baseDir, decodeURIComponent(req.params.ch), decodeURIComponent(req.params.file));
    res.sendFile(fp);
});

app.get('/api/serve-version/:id/:vId/:ch/:file', (req, res) => {
    const id = decodeURIComponent(req.params.id);
    const vId = decodeURIComponent(req.params.vId);
    const meta = loadMeta();
    const baseDir = resolveVersionDir(id, vId, meta);
    const fp = path.join(baseDir, decodeURIComponent(req.params.ch), decodeURIComponent(req.params.file));
    res.sendFile(fp);
});

app.get('/api/cbz-cache/:mangaId/:chapter/:file', (req, res) => {
    const fp = path.join(CBZ_CACHE, decodeURIComponent(req.params.mangaId), decodeURIComponent(req.params.chapter), decodeURIComponent(req.params.file));
    res.sendFile(fp);
});

// ── POST /api/manga (Add Series) ──────────────────────────
app.post('/api/manga', (req, res) => {
    const up = multer({
        storage: multer.diskStorage({
            destination: (_r, _f, cb) => cb(null, COVER_UPLOAD_TMP),
            filename: (_r, f, cb) => cb(null, `cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${path.extname(f.originalname)}`)
        })
    }).single('cover');

    up(req, res, async () => {
        try {
            const { title, description, authors, artists, language, status, folderPath, releaseYear } = req.body;
            const categories = (() => { try { return JSON.parse(req.body.categories || '[]'); } catch { return []; } })();
            const isNsfw = req.body.isNsfw === 'true';
            const tags = (() => { try { return JSON.parse(req.body.tags || '[]'); } catch { return []; } })();
            const sourceFolderInput = String(folderPath || '').trim();
            const sourceFolder = normalizeInputPath(sourceFolderInput);

            // #region agent log
            try {
                fs.appendFileSync(
                    path.join(APP_ROOT, 'debug-dfc727.log'),
                    JSON.stringify({
                        sessionId: 'dfc727',
                        runId: 'pre-fix-1',
                        hypothesisId: 'H2',
                        location: 'server/index.js:/api/manga',
                        message: 'Add series backend start',
                        data: {
                            title,
                            folderPathInput: sourceFolderInput,
                            sourceFolder,
                            mangaPath: MANGA_PATH,
                        },
                        timestamp: Date.now(),
                    }) + '\n',
                    'utf8'
                );
            } catch { }
            // #endregion

            if (sourceFolderInput && !isExistingDirectory(sourceFolder)) {
                // #region agent log
                try {
                    fs.appendFileSync(
                        path.join(APP_ROOT, 'debug-dfc727.log'),
                        JSON.stringify({
                            sessionId: 'dfc727',
                            runId: 'pre-fix-1',
                            hypothesisId: 'H2',
                            location: 'server/index.js:/api/manga',
                            message: 'Invalid source folder for series',
                            data: {
                                folderPathInput: sourceFolderInput,
                                sourceFolder,
                            },
                            timestamp: Date.now(),
                        }) + '\n',
                        'utf8'
                    );
                } catch { }
                // #endregion
                return res.status(400).json({ error: 'Selected folder path is invalid or not a directory' });
            }

            const meta = loadMeta();
            const baseId = sanitizeSeriesId(title, sourceFolder || sourceFolderInput);
            const dirName = ensureUniqueSeriesId(baseId, meta);
            const targetDir = path.join(MANGA_PATH, dirName);

            fs.ensureDirSync(targetDir);

            if (req.file?.path && fs.existsSync(req.file.path)) {
                const ext = path.extname(req.file.originalname || req.file.filename || '') || '.jpg';
                const coverTarget = path.join(targetDir, `cover${ext}`);
                try {
                    fs.moveSync(req.file.path, coverTarget, { overwrite: true });
                } catch (e) {
                    console.error('Failed to move uploaded cover:', e.message);
                    try { fs.removeSync(req.file.path); } catch { }
                }
            }

            meta[dirName] = { title: title || dirName, description, authors, artists, language, status, tags, categories, isNsfw, releaseYear };
            if (sourceFolderInput) {
                const sourceRef = toMetaPathReference(sourceFolder);
                meta[dirName].sourcePath = sourceRef.abs;
                if (sourceRef.rel) {
                    meta[dirName].sourcePathRel = sourceRef.rel;
                } else {
                    delete meta[dirName].sourcePathRel;
                }
            }

            const sourceDir = sourceFolderInput ? sourceFolder : targetDir;
            let chapterCount = 0;
            let cover = null;
            let lastChapterAdded = 0;
            try {
                const chapters = await getChapters(sourceDir);
                chapterCount = chapters.length;
                cover = await findCover(targetDir, sourceDir, dirName);
                try {
                    const dirStat = await fs.stat(sourceDir);
                    lastChapterAdded = dirStat.mtimeMs || 0;
                } catch { }
            } catch { }

            meta[dirName]._cachedChapterCount = chapterCount;
            meta[dirName]._cachedCover = cover;
            meta[dirName]._cachedLastChapterAdded = lastChapterAdded;

            saveMeta(meta);
            ensureLibraryCacheWarmup();
            res.json({
                id: dirName,
                title: title || dirName,
                description: description || '',
                tags,
                categories,
                authors: authors || '',
                artists: artists || '',
                language: language || '',
                status: status || '',
                isNsfw,
                releaseYear: releaseYear || '',
                chapterCount,
                cover,
                lastChapterAdded,
            });
        } catch (err) {
            if (req.file?.path && fs.existsSync(req.file.path)) {
                try { fs.removeSync(req.file.path); } catch { }
            }

            // #region agent log
            try {
                fs.appendFileSync(
                    path.join(APP_ROOT, 'debug-dfc727.log'),
                    JSON.stringify({
                        sessionId: 'dfc727',
                        runId: 'pre-fix-1',
                        hypothesisId: 'H2',
                        location: 'server/index.js:/api/manga',
                        message: 'Add series backend error',
                        data: {
                            errorMessage: err?.message || 'unknown',
                            name: err?.name || '',
                        },
                        timestamp: Date.now(),
                    }) + '\n',
                    'utf8'
                );
            } catch { }
            // #endregion

            res.status(500).json({ error: err.message || 'Failed to add series' });
        }
    });
});

// ── POST /api/manga/:id/versions (Add Version) ──────────────
app.post('/api/manga/:id/versions', (req, res) => {
    const { id } = req.params;
    const versionId = 'v_' + Date.now();

    const up = multer({
        storage: multer.diskStorage({
            destination: (r, _f, cb) => {
                const versionsDir = path.join(MANGA_PATH, id, 'versions', versionId);
                fs.ensureDirSync(versionsDir);
                cb(null, versionsDir);
            },
            filename: (_r, f, cb) => cb(null, 'cover' + path.extname(f.originalname))
        })
    }).single('cover');

    up(req, res, () => {
        try {
            const { name, description, type, folderPath, title, authors, artists, status } = req.body;
            const tags = (() => { try { return JSON.parse(req.body.tags || '[]'); } catch { return []; } })();
            const folderPathInput = String(folderPath || '').trim();
            const normalizedFolderPath = normalizeInputPath(folderPathInput);

            if (!name) return res.status(400).json({ error: 'Name is required' });

            const meta = loadMeta();
            if (!meta[id]) return res.status(404).json({ error: 'Series not found' });

            if (!meta[id].versions) meta[id].versions = [];

            const newVersion = { id: versionId, name, title: title || name, description, type, authors, artists, tags, status: status || '' };

            const versionsDir = path.join(MANGA_PATH, id, 'versions');
            fs.ensureDirSync(versionsDir);
            const targetDir = path.join(versionsDir, versionId);

            if (folderPathInput) {
                if (!isExistingDirectory(normalizedFolderPath)) {
                    return res.status(400).json({ error: 'Version folder path is invalid or not a directory' });
                }

                const folderRef = toMetaPathReference(normalizedFolderPath);
                newVersion.folderPath = folderRef.abs;
                if (folderRef.rel) {
                    newVersion.folderPathRel = folderRef.rel;
                }
            }
            fs.ensureDirSync(targetDir);

            meta[id].versions.push(newVersion);
            saveMeta(meta);

            res.json({ success: true, version: newVersion });
        } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
    });
});

// ── DELETE /api/manga/:id/versions/:vId (Delete Version) ────
app.delete('/api/manga/:id/versions/:vId', (req, res) => {
    try {
        const { id, vId } = req.params;
        const meta = loadMeta();
        if (!meta[id] || !meta[id].versions) return res.status(404).json({ error: 'Not found' });

        meta[id].versions = meta[id].versions.filter(v => v.id !== vId);
        saveMeta(meta);

        const targetDir = path.join(MANGA_PATH, id, 'versions', vId);
        if (fs.existsSync(targetDir)) {
            try {
                const stats = fs.lstatSync(targetDir);
                if (stats.isSymbolicLink()) {
                    // Junction/symlink — use unlinkSync
                    fs.unlinkSync(targetDir);
                } else {
                    // Real directory — use removeSync
                    fs.removeSync(targetDir);
                }
            } catch (e) {
                console.error('Failed to remove version directory:', e);
                // Last resort fallback
                try { fs.removeSync(targetDir); } catch { }
            }
        }

        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ── PUT /api/manga/:id/versions/:vId (Edit Version) ─────────
app.put('/api/manga/:id/versions/:vId', (req, res) => {
    const { id, vId } = req.params;

    const up = multer({
        storage: multer.diskStorage({
            destination: (r, _f, cb) => {
                const vDir = path.join(MANGA_PATH, id, 'versions', vId);
                fs.ensureDirSync(vDir);
                cb(null, vDir);
            },
            filename: (_r, f, cb) => cb(null, 'cover' + path.extname(f.originalname))
        })
    }).single('cover');

    up(req, res, () => {
        try {
            const { name, description, type, folderPath, title, authors, artists, status } = req.body;
            const tags = (() => { try { return JSON.parse(req.body.tags || '[]'); } catch { return []; } })();
            const folderPathInput = folderPath === undefined ? undefined : String(folderPath).trim();
            const normalizedFolderPath = folderPathInput ? normalizeInputPath(folderPathInput) : '';

            if (!name) return res.status(400).json({ error: 'Name is required' });

            const meta = loadMeta();
            if (!meta[id] || !Array.isArray(meta[id].versions)) return res.status(404).json({ error: 'Not found' });

            const vIndex = meta[id].versions.findIndex(v => v.id === vId);
            if (vIndex === -1) return res.status(404).json({ error: 'Version not found' });

            meta[id].versions[vIndex] = { ...meta[id].versions[vIndex], name, title: title || name, description, type, authors, artists, tags, status: status || '' };

            const targetDir = path.join(MANGA_PATH, id, 'versions', vId);
            fs.ensureDirSync(targetDir);
            if (folderPathInput !== undefined) {
                if (folderPathInput === '') {
                    delete meta[id].versions[vIndex].folderPath;
                    delete meta[id].versions[vIndex].folderPathRel;
                } else if (!isExistingDirectory(normalizedFolderPath)) {
                    return res.status(400).json({ error: 'Version folder path is invalid or not a directory' });
                } else {
                    const folderRef = toMetaPathReference(normalizedFolderPath);
                    meta[id].versions[vIndex].folderPath = folderRef.abs;
                    if (folderRef.rel) {
                        meta[id].versions[vIndex].folderPathRel = folderRef.rel;
                    } else {
                        delete meta[id].versions[vIndex].folderPathRel;
                    }
                }
            }

            saveMeta(meta);
            res.json({ success: true, version: meta[id].versions[vIndex] });
        } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
    });
});

// ── PUT /api/manga/:id (Edit Series) ──────────────────────
app.put('/api/manga/:id', (req, res) => {
    const { id } = req.params;
    const up = multer({
        storage: multer.diskStorage({
            destination: (r, _f, cb) => {
                cb(null, path.join(MANGA_PATH, id));
            },
            filename: (_r, f, cb) => cb(null, 'cover' + path.extname(f.originalname))
        })
    }).single('cover');

    up(req, res, () => {
        try {
            const { title, description, authors, artists, language, status, releaseYear } = req.body;
            const tags = (() => { try { return JSON.parse(req.body.tags || '[]'); } catch { return []; } })();
            const categories = (() => { try { return JSON.parse(req.body.categories || '[]'); } catch { return []; } })();

            const meta = loadMeta();
            if (!meta[id]) meta[id] = {};

            if (title !== undefined) meta[id].title = title;
            if (description !== undefined) meta[id].description = description;
            if (authors !== undefined) meta[id].authors = authors;
            if (artists !== undefined) meta[id].artists = artists;
            if (language !== undefined) meta[id].language = language;
            if (status !== undefined) meta[id].status = status;
            if (releaseYear !== undefined) meta[id].releaseYear = releaseYear;
            if (req.body.tags !== undefined) meta[id].tags = tags;
            if (req.body.categories !== undefined) meta[id].categories = categories;
            if (req.body.isNsfw !== undefined) meta[id].isNsfw = req.body.isNsfw === 'true';

            // Allow updating/clearing source folder when editing series.
            if (req.body.folderPath !== undefined) {
                const folderPathInput = String(req.body.folderPath || '').trim();
                if (!folderPathInput) {
                    delete meta[id].sourcePath;
                    delete meta[id].sourcePathRel;
                } else {
                    const normalizedFolderPath = normalizeInputPath(folderPathInput);
                    if (!isExistingDirectory(normalizedFolderPath)) {
                        return res.status(400).json({ error: 'Selected folder path is invalid or not a directory' });
                    }

                    const oldSourcePath = meta[id].sourcePath;
                    const newSourcePath = normalizedFolderPath;

                    // Migrate versions paths if parent path successfully changed
                    if (oldSourcePath && oldSourcePath !== newSourcePath && Array.isArray(meta[id].versions)) {
                        meta[id].versions.forEach(v => {
                            if (v.folderPath && v.folderPath.toLowerCase().startsWith(oldSourcePath.toLowerCase())) {
                                const relativeVPath = v.folderPath.substring(oldSourcePath.length);
                                const newVPath = path.join(newSourcePath, relativeVPath);
                                const vRef = toMetaPathReference(newVPath);
                                v.folderPath = vRef.abs;
                                if (vRef.rel) {
                                    v.folderPathRel = vRef.rel;
                                } else {
                                    delete v.folderPathRel;
                                }
                            }
                        });
                    }

                    const sourceRef = toMetaPathReference(normalizedFolderPath);
                    meta[id].sourcePath = sourceRef.abs;
                    if (sourceRef.rel) {
                        meta[id].sourcePathRel = sourceRef.rel;
                    } else {
                        delete meta[id].sourcePathRel;
                    }
                }
            }

            saveMeta(meta);
            res.json({ success: true, meta: meta[id] });
        } catch (err) {
            res.status(500).json({ error: err.message || 'Failed to update series' });
        }
    });
});

// ── DELETE /api/manga/:id (Delete Series) ─────────────────
app.delete('/api/manga/:id', (req, res) => {
    try {
        const { id } = req.params;
        const targetDir = path.join(MANGA_PATH, id);

        // Remove the directory/symlink
        if (fs.existsSync(targetDir)) {
            fs.removeSync(targetDir);
        }

        // Remove from metadata
        const meta = loadMeta();
        if (meta[id]) {
            delete meta[id];
            saveMeta(meta);
        }

        res.json({ success: true, message: 'Series deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/browse-folder ───────────────────────────────
// Returns folder contents for folder picker
app.post('/api/browse-folder', async (req, res) => {
    try {
        const { folderPath } = req.body;
        const targetPath = folderPath || MANGA_PATH;

        if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'Path not found' });

        const stat = await fs.stat(targetPath);
        if (!stat.isDirectory()) return res.status(400).json({ error: 'Not a directory' });

        const items = await fs.readdir(targetPath, { withFileTypes: true });
        const dirs = items.filter(d => d.isDirectory()).map(d => d.name);
        const cbzs = items.filter(d => d.isFile() && /\.cbz$/i.test(d.name)).length;

        res.json({
            path: targetPath,
            parent: path.dirname(targetPath),
            dirs,
            cbzCount: cbzs,
            hasMangaContent: cbzs > 0 || dirs.length > 0
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/browse-os-folder ──────────────────────────
// Opens the native folder picker via PowerShell dialog.
// NOTE: In Tauri mode, the frontend uses Tauri's dialog plugin directly.
// This route is kept as a fallback for standalone server mode.
app.get('/api/browse-os-folder', (req, res) => {
    const psScript = `
Add-Type -AssemblyName System.windows.forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.ShowNewFolderButton = $false
$f.Description = "Select a Manga Folder"
$f.RootFolder = [System.Environment+SpecialFolder]::Desktop
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
if ($f.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $f.SelectedPath
}
    `;
    const b64 = Buffer.from(psScript, 'utf16le').toString('base64');
    const { execFile } = require('child_process');
    execFile('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-EncodedCommand', b64], (err, stdout) => {
        if (err) return res.status(500).json({ error: err.message });
        const folder = stdout.trim();
        res.json({ folder });
    });
});

// ── POST /api/progress ────────────────────────────────────
app.post('/api/progress', async (req, res) => {
    try {
        const { mangaId, chapterId, page, completed, versionId } = req.body;
        const meta = loadMeta();
        if (!meta[mangaId]) meta[mangaId] = {};

        // Compare if we are regressing to an older chapter
        let shouldUpdateProgress = true;
        const savedVol = versionId || 'default';
        const versionProgress = meta[mangaId].progressByVersion ? meta[mangaId].progressByVersion[savedVol] : (savedVol === 'default' ? meta[mangaId].progress : null);

        if (versionProgress && versionProgress.chapterId !== chapterId) {
            const mangaDir = path.join(MANGA_PATH, mangaId);
            // Check regression within the SAME version
            if (fs.existsSync(mangaDir)) {
                let chaptersInfo;
                if (savedVol === 'default') {
                    chaptersInfo = await getChapters(mangaDir);
                } else {
                    const vDir = path.join(mangaDir, 'versions', savedVol);
                    if (fs.existsSync(vDir)) {
                        chaptersInfo = await getChapters(vDir);
                    }
                }

                if (chaptersInfo) {
                    const oldIdx = chaptersInfo.findIndex(c => c.name === versionProgress.chapterId);
                    const newIdx = chaptersInfo.findIndex(c => c.name === chapterId);

                    if (oldIdx !== -1 && newIdx !== -1 && newIdx < oldIdx) {
                        // It's an older chapter, DON'T update the tracking record.
                        shouldUpdateProgress = false;
                    }
                }
            }
        }

        if (!meta[mangaId].progressByVersion) {
            meta[mangaId].progressByVersion = {};
            // migrate old
            if (meta[mangaId].progress) {
                meta[mangaId].progressByVersion[meta[mangaId].progress.versionId || 'default'] = meta[mangaId].progress;
            }
        }

        if (shouldUpdateProgress) {
            // Save last read progress per version
            const savedVol = versionId || 'default';
            meta[mangaId].progressByVersion[savedVol] = { chapterId, page, versionId: savedVol };
            meta[mangaId].progress = { chapterId, page, versionId: savedVol }; // Keep for recent tracking cross-version
        }

        // Track fully completed chapters for the "Viewed" badge
        if (completed) {
            const savedVol = versionId || 'default';
            if (!meta[mangaId].readChaptersByVersion) meta[mangaId].readChaptersByVersion = {};
            if (!Array.isArray(meta[mangaId].readChaptersByVersion[savedVol])) {
                meta[mangaId].readChaptersByVersion[savedVol] = [];
            }
            if (!meta[mangaId].readChaptersByVersion[savedVol].includes(chapterId)) {
                meta[mangaId].readChaptersByVersion[savedVol].push(chapterId);
            }

            // Keep global readChapters for backward compatibility
            if (!Array.isArray(meta[mangaId].readChapters)) {
                meta[mangaId].readChapters = [];
            }
            if (!meta[mangaId].readChapters.includes(chapterId)) {
                meta[mangaId].readChapters.push(chapterId);
            }
        }

        saveMeta(meta);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/progress/:mangaId', (req, res) => {
    try {
        const { mangaId } = req.params;
        const { versionId } = req.query;
        const meta = loadMeta();
        if (meta[mangaId]) {
            const savedVol = versionId || 'default';
            if (meta[mangaId].progressByVersion) {
                delete meta[mangaId].progressByVersion[savedVol];
            }
            if (meta[mangaId].readChaptersByVersion) {
                delete meta[mangaId].readChaptersByVersion[savedVol];
            }

            // if we are deleting default, or deleting the specific version that acts as the 'global current' (progress)
            if (savedVol === 'default' || (meta[mangaId].progress && meta[mangaId].progress.versionId === savedVol)) {
                meta[mangaId].progress = null;
            }
            if (savedVol === 'default') {
                meta[mangaId].readChapters = [];
            } else if (meta[mangaId].readChaptersByVersion && meta[mangaId].readChaptersByVersion['default']) {
                // if not deleting default, sync readChapters to default's state
                meta[mangaId].readChapters = [...meta[mangaId].readChaptersByVersion['default']];
            } else {
                meta[mangaId].readChapters = [];
            }
            saveMeta(meta);
        }
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════════════════
// UPSCALER API
// ══════════════════════════════════════════════════════════
const upscaler = require('./upscaler');

// Settings
app.get('/api/upscale/settings', (_req, res) => {
    res.json(upscaler.ensureSettingsAutoDetected(true));
});

app.put('/api/upscale/settings', (req, res) => {
    const current = upscaler.ensureSettingsAutoDetected();
    const updated = { ...current, ...req.body };
    upscaler.saveSettings(updated);
    res.json(updated);
});

// Package Management
app.get('/api/upscale/models-ready', (_req, res) => {
    res.json({ ready: upscaler.isUpscalerDirPopulated() });
});

app.get('/api/upscale/package-state', (_req, res) => {
    res.json(upscaler.loadPackageState());
});

app.post('/api/upscale/install-package', (req, res) => {
    const { reinstall } = req.body || {};
    upscaler.installUpscalerPackage({ reinstall })
        .catch(err => console.error('[Upscaler Install]', err.message));
    res.json({ ok: true, message: 'Installation started' });
});

app.delete('/api/upscale/delete-package', (req, res) => {
    try {
        const ok = upscaler.deleteUpscalerPackage();
        res.json({ ok });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/upscale/cancel-install', (req, res) => {
    try {
        const ok = upscaler.cancelUpscalerPackageInstall();
        res.json({ ok });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/upscale/open-model-folder', (req, res) => {
    try {
        const folderPath = upscaler.getUpscalerModelRootFolder();
        if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
            return res.status(404).json({ error: 'Upscaler model folder not found.' });
        }

        const opener = process.platform === 'win32'
            ? 'explorer.exe'
            : process.platform === 'darwin'
                ? 'open'
                : 'xdg-open';
        const child = spawn(opener, [folderPath], { detached: true, stdio: 'ignore' });
        child.unref();

        res.json({ ok: true, path: folderPath });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to open model folder.' });
    }
});

// Queue
app.get('/api/upscale/queue', (_req, res) => {
    res.json(upscaler.getQueue());
});

app.post('/api/upscale/add', (req, res) => {
    try {
        const { mangaId, mangaTitle, chapters, model, versionId, scale, denoiseLevel, maxWorkers, waifu2xModelDir } = req.body;
        if (!mangaId || !chapters || !chapters.length || !model) {
            return res.status(400).json({ error: 'mangaId, chapters[], and model are required' });
        }
        const job = upscaler.addJob({ mangaId, mangaTitle, chapters, model, versionId, scale, denoiseLevel, maxWorkers, waifu2xModelDir });
        res.json(job);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/upscale/remove/:jobId', (req, res) => {
    const ok = upscaler.removeJob(req.params.jobId);
    res.json({ ok });
});

app.delete('/api/upscale/remove-series/:mangaId', (req, res) => {
    const ok = upscaler.removeSeries(req.params.mangaId);
    res.json({ ok });
});

app.get('/api/upscale/archive', (_req, res) => {
    res.json(upscaler.getArchive());
});

app.delete('/api/upscale/archive/:mangaId', (req, res) => {
    const ok = upscaler.deleteArchive(req.params.mangaId);
    res.json({ ok });
});

app.post('/api/upscale/archive/restore/:mangaId', express.json(), (req, res) => {
    const chapters = req.body?.chapters || null;
    const ok = upscaler.restoreArchive(req.params.mangaId, chapters);
    res.json({ ok });
});

app.post('/api/upscale/archive/partial/:mangaId', express.json(), (req, res) => {
    const { chapters, action } = req.body || {};
    if (!chapters || !Array.isArray(chapters)) return res.status(400).json({ error: 'chapters array required' });
    let ok;
    if (action === 'delete') {
        ok = upscaler.deleteArchivePartial(req.params.mangaId, chapters);
    } else {
        ok = upscaler.restoreArchive(req.params.mangaId, chapters);
    }
    res.json({ ok });
});

app.post('/api/upscale/abort', (_req, res) => {
    const ok = upscaler.abortCurrentJob();
    res.json({ ok });
});

app.post('/api/upscale/finalize', (req, res) => {
    const { jobId, action } = req.body;
    const ok = upscaler.finalizeJob(jobId, action);
    res.json({ ok });
});

app.post('/api/upscale/discard', (req, res) => {
    const { jobId } = req.body;
    const ok = upscaler.discardJob(jobId);
    res.json({ ok });
});

// Check model files exist
app.get('/api/upscale/check-model', (req, res) => {
    const { model } = req.query;
    if (!model) return res.status(400).json({ error: 'model query required' });
    const settings = upscaler.loadSettings();
    res.json(upscaler.checkModelFiles(model, settings));
});

// List available Waifu2x model directories
app.get('/api/upscale/waifu2x-models', (_req, res) => {
    const settings = upscaler.loadSettings();
    res.json(upscaler.getWaifu2xModels(settings));
});

// List available RealESRGAN model names
app.get('/api/upscale/realesrgan-models', (_req, res) => {
    const settings = upscaler.loadSettings();
    res.json(upscaler.getRealesrganModels(settings));
});

// Check GPU Support
app.get('/api/upscale/gpu-check', (_req, res) => {
    if (process.platform !== 'win32') return res.json({ ok: false, message: 'GPU check is currently only supported on Windows.' });
    try {
        const out = require('child_process').execSync('powershell.exe -NoProfile -Command "(Get-CimInstance Win32_VideoController).Name"', { stdio: 'pipe' }).toString();
        const names = out.split('\n').map(s => s.trim()).filter(Boolean);
        const isSupported = names.some(n => n.toLowerCase().includes('nvidia') || n.toLowerCase().includes('amd') || n.toLowerCase().includes('radeon'));
        res.json({ ok: true, gpus: names, supported: isSupported });
    } catch (err) {
        res.json({ ok: false, message: 'Failed to retrieve GPU information.', error: err.message });
    }
});

// Get staged images for preview (returns array of /api/file?path=... URLs)
app.get('/api/upscale/preview-images/:jobId', (req, res) => {
    const { jobId } = req.params;
    const { chapter } = req.query;
    const imagePaths = upscaler.getJobStagingImages(jobId, chapter);
    // Return as relative URLs served via /api/file route
    res.json(imagePaths.map(p => `/api/file?path=${encodeURIComponent(p)}`));
});

// ── BACKUP ENDPOINTS ───────────────────────────────────────
app.post('/api/backup/export', (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Password required' });

        const meta = loadMeta();
        const categories = loadCategories();
        const bookmarks = loadBookmarks();
        const encrypted = encryptData({ meta, categories, bookmarks }, password);

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="kodo_backup_${Date.now()}.kdba"`);
        res.send(encrypted);
    } catch (err) {
        console.error('Backup export failed:', err);
        res.status(500).json({ error: err.message });
    }
});

const backupUpload = multer({ storage: multer.memoryStorage() }).single('backupFile');

app.post('/api/backup/import', backupUpload, (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Password required' });
        if (!req.file) return res.status(400).json({ error: 'Backup file required' });

        const decryptedMeta = decryptData(req.file.buffer, password);
        if (typeof decryptedMeta !== 'object' || !decryptedMeta) throw new Error('Invalid backup data format');

        if (decryptedMeta.meta) {
            saveMeta(decryptedMeta.meta);
            if (decryptedMeta.categories) saveCategories(decryptedMeta.categories);
            if (decryptedMeta.bookmarks && Array.isArray(decryptedMeta.bookmarks)) saveBookmarks(decryptedMeta.bookmarks);
        } else {
            saveMeta(decryptedMeta); // legacy backup format
        }

        res.json({ success: true, message: 'Restore completed successfully' });
    } catch (err) {
        console.error('Backup import failed:', err);
        res.status(400).json({ error: err.message });
    }
});

// ── FULL BACKUP (with manga files) ──────────────────────────
const archiver = require('archiver');
const unzipper = require('unzipper');
const crypto = require('crypto');
const backupJobs = {};
const COVER_FILE_RE = /^cover\.(jpg|jpeg|png|webp|avif)$/i;

const isSubPath = (parentDir, targetDir) => {
    if (!parentDir || !targetDir) return false;
    const rel = path.relative(parentDir, targetDir);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

const getDirSizeBytes = (dirPath) => {
    if (!isExistingDirectory(dirPath)) return 0;
    let total = 0;
    const walk = (currentDir) => {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else {
                try { total += fs.statSync(full).size; } catch { }
            }
        }
    };
    walk(dirPath);
    return total;
};

const addManagedCoversIfNeeded = (managedDir, sourceDir, archiveDestDir, fileEntries, fileDestSet) => {
    if (!isExistingDirectory(managedDir)) return;
    if (isExistingDirectory(sourceDir) && path.resolve(managedDir) === path.resolve(sourceDir)) return;

    let sourceHasCover = false;
    if (isExistingDirectory(sourceDir)) {
        try {
            sourceHasCover = fs.readdirSync(sourceDir).some((name) => COVER_FILE_RE.test(name));
        } catch { }
    }
    if (sourceHasCover) return;

    let files = [];
    try { files = fs.readdirSync(managedDir); } catch { }
    for (const name of files) {
        if (!COVER_FILE_RE.test(name)) continue;
        const sourcePath = path.join(managedDir, name);
        if (!fs.existsSync(sourcePath)) continue;
        const archivePath = path.posix.join(archiveDestDir, name);
        const key = archivePath.toLowerCase();
        if (fileDestSet.has(key)) continue;
        fileDestSet.add(key);
        fileEntries.push({ sourcePath, archivePath });
    }
};

const collectLibraryBackupEntries = () => {
    const meta = loadMeta();
    const dirEntries = [];
    const fileEntries = [];
    const dirDestSet = new Set();
    const fileDestSet = new Set();

    for (const mangaId of Object.keys(meta)) {
        const mangaMeta = meta[mangaId] || {};
        const managedSeriesDir = path.join(MANGA_PATH, mangaId);
        const sourceSeriesDir = resolveMangaDir(mangaId, meta);
        const seriesArchiveDir = path.posix.join('manga', mangaId);

        if (isExistingDirectory(sourceSeriesDir)) {
            const dirKey = seriesArchiveDir.toLowerCase();
            if (!dirDestSet.has(dirKey)) {
                dirDestSet.add(dirKey);
                dirEntries.push({ sourcePath: sourceSeriesDir, archivePath: seriesArchiveDir });
            }
        }

        addManagedCoversIfNeeded(managedSeriesDir, sourceSeriesDir, seriesArchiveDir, fileEntries, fileDestSet);

        const versions = Array.isArray(mangaMeta.versions) ? mangaMeta.versions : [];
        for (const version of versions) {
            if (!version?.id) continue;

            const versionId = String(version.id);
            const managedVersionDir = path.join(managedSeriesDir, 'versions', versionId);
            const sourceVersionDir = resolveVersionDir(mangaId, versionId, meta);
            const versionArchiveDir = path.posix.join(seriesArchiveDir, 'versions', versionId);

            const coveredBySeriesDir = isExistingDirectory(sourceSeriesDir)
                && isExistingDirectory(sourceVersionDir)
                && isSubPath(sourceSeriesDir, sourceVersionDir);

            if (!coveredBySeriesDir && isExistingDirectory(sourceVersionDir)) {
                const versionKey = versionArchiveDir.toLowerCase();
                if (!dirDestSet.has(versionKey)) {
                    dirDestSet.add(versionKey);
                    dirEntries.push({ sourcePath: sourceVersionDir, archivePath: versionArchiveDir });
                }
            }

            addManagedCoversIfNeeded(managedVersionDir, sourceVersionDir, versionArchiveDir, fileEntries, fileDestSet);
        }
    }

    return { dirEntries, fileEntries };
};

const getLibraryBackupSizeBytes = () => {
    const entries = collectLibraryBackupEntries();
    let totalSize = 0;
    for (const dirEntry of entries.dirEntries) totalSize += getDirSizeBytes(dirEntry.sourcePath);
    for (const fileEntry of entries.fileEntries) {
        try { totalSize += fs.statSync(fileEntry.sourcePath).size; } catch { }
    }
    return { totalSize, entries };
};

const appendLibraryEntriesToArchive = (archive, entries) => {
    for (const dirEntry of entries.dirEntries) {
        if (isExistingDirectory(dirEntry.sourcePath)) {
            archive.directory(dirEntry.sourcePath, dirEntry.archivePath);
        }
    }
    for (const fileEntry of entries.fileEntries) {
        if (fs.existsSync(fileEntry.sourcePath)) {
            archive.file(fileEntry.sourcePath, { name: fileEntry.archivePath });
        }
    }
};

app.get('/api/backup/size', async (req, res) => {
    try {
        let totalSize = getLibraryBackupSizeBytes().totalSize;
        if (fs.existsSync(META_PATH)) totalSize += fs.statSync(META_PATH).size;
        if (fs.existsSync(CAT_PATH)) totalSize += fs.statSync(CAT_PATH).size;
        if (fs.existsSync(BOOKMARK_JSON_PATH)) totalSize += fs.statSync(BOOKMARK_JSON_PATH).size;
        if (fs.existsSync(BOOKMARK_DIR)) totalSize += getDirSizeBytes(BOOKMARK_DIR);
        if (fs.existsSync(BOOKMARK_JSON_PATH)) totalSize += fs.statSync(BOOKMARK_JSON_PATH).size;
        if (fs.existsSync(BOOKMARK_DIR)) totalSize += getDirSizeBytes(BOOKMARK_DIR);
        res.json({ totalBytes: totalSize, totalMB: (totalSize / 1024 / 1024).toFixed(1) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/backup/job/start', async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });
    const jobId = `bkp_${Date.now()}`;
    // We stream directly to the final .kdba file; no tmpZip needed!
    const tmpOut = path.join(APP_ROOT, 'data', `_backup_${jobId}.kdba`);
    backupJobs[jobId] = { status: 'zipping', progress: 0, speed: 0, totalBytes: 0, processedBytes: 0, startTime: Date.now(), tmpOut, cancelled: false, archive: null, error: null };
    res.json({ jobId });
    const job = backupJobs[jobId];
    try {
        const { totalSize: librarySize, entries: backupEntries } = getLibraryBackupSizeBytes();
        let totalSize = librarySize;
        if (fs.existsSync(META_PATH)) totalSize += fs.statSync(META_PATH).size;
        if (fs.existsSync(CAT_PATH)) totalSize += fs.statSync(CAT_PATH).size;
        job.totalBytes = totalSize;
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(tmpOut);
            const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
            const key = crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256');
            const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

            output.write(Buffer.from('KODOSTRM'));
            output.write(salt);
            output.write(iv);

            const archive = archiver('zip', { zlib: { level: 0 }, store: true });
            job.archive = archive;
            let lastCheck = Date.now(), lastBytes = 0;
            archive.on('progress', (p) => {
                if (job.cancelled) { archive.abort(); return; }
                job.processedBytes = p.fs.processedBytes;
                job.progress = totalSize > 0 ? Math.round((p.fs.processedBytes / totalSize) * 99) : 0;
                const now = Date.now(), elapsed = (now - lastCheck) / 1000;
                if (elapsed >= 0.3) { job.speed = (p.fs.processedBytes - lastBytes) / elapsed; lastCheck = now; lastBytes = p.fs.processedBytes; }
            });

            archive.on('error', reject);
            cipher.on('error', reject);
            output.on('error', reject);

            cipher.on('end', () => {
                const authTag = cipher.getAuthTag();
                output.write(authTag);
                output.end();
            });

            output.on('close', () => { if (job.cancelled) return reject(new Error('Cancelled')); resolve(); });

            archive.pipe(cipher).pipe(output, { end: false });

            appendLibraryEntriesToArchive(archive, backupEntries);
            if (fs.existsSync(META_PATH)) archive.file(META_PATH, { name: 'meta.json' });
            if (fs.existsSync(CAT_PATH)) archive.file(CAT_PATH, { name: 'categories.json' });
            if (fs.existsSync(BOOKMARK_JSON_PATH)) archive.file(BOOKMARK_JSON_PATH, { name: 'bookmarks.json' });
            if (fs.existsSync(BOOKMARK_DIR)) archive.directory(BOOKMARK_DIR, 'bookmark_images');
            archive.finalize();
        });
        if (job.cancelled) throw new Error('Cancelled');
        job.status = 'done'; job.progress = 100; job.speed = 0;
    } catch (err) {
        if (fs.existsSync(tmpOut)) fs.removeSync(tmpOut);
        job.status = err.message === 'Cancelled' ? 'cancelled' : 'error';
        job.error = err.message === 'Cancelled' ? null : err.message;
    }
});

app.get('/api/backup/job/active', (req, res) => {
    // Return any job that is currently running or done (but not yet downloaded/cleaned)
    const entry = Object.entries(backupJobs).find(([id, job]) => job.status !== 'error' && job.status !== 'cancelled' && job.status !== 'downloaded');
    if (entry) res.json({ jobId: entry[0], status: entry[1].status, progress: entry[1].progress });
    else res.json({ jobId: null });
});

app.get('/api/backup/job/progress/:id', (req, res) => {
    const job = backupJobs[req.params.id];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ status: job.status, progress: job.progress, speed: job.speed, totalBytes: job.totalBytes, processedBytes: job.processedBytes, error: job.error });
});

app.post('/api/backup/job/cancel/:id', (req, res) => {
    const job = backupJobs[req.params.id];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    job.cancelled = true;
    if (job.archive) { try { job.archive.abort(); } catch { } }
    if (fs.existsSync(job.tmpOut)) fs.removeSync(job.tmpOut);
    job.status = 'cancelled';
    res.json({ success: true });
});

app.get('/api/backup/job/download/:id', (req, res) => {
    const job = backupJobs[req.params.id];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'done') return res.status(400).json({ error: 'Backup not ready' });
    if (!fs.existsSync(job.tmpOut)) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="kodo_full_backup_${Date.now()}.kdba"`);
    const stream = fs.createReadStream(job.tmpOut);
    stream.pipe(res);
    stream.on('end', () => {
        job.status = 'downloaded';
        fs.removeSync(job.tmpOut);
        delete backupJobs[req.params.id];
    });
});

app.post('/api/backup/full-export', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Password required' });
        const tmpOut = path.join(APP_ROOT, 'data', `_backup_tmp_${Date.now()}.kdba`);
        const { entries: backupEntries } = getLibraryBackupSizeBytes();
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(tmpOut);
            const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
            const key = crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256');
            const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
            output.write(Buffer.from('KODOSTRM')); output.write(salt); output.write(iv);
            const archive = archiver('zip', { zlib: { level: 0 }, store: true });
            archive.on('error', reject); cipher.on('error', reject); output.on('error', reject);
            cipher.on('end', () => { output.write(cipher.getAuthTag()); output.end(); });
            output.on('close', resolve);
            archive.pipe(cipher).pipe(output, { end: false });
            appendLibraryEntriesToArchive(archive, backupEntries);
            if (fs.existsSync(META_PATH)) archive.file(META_PATH, { name: 'meta.json' });
            if (fs.existsSync(CAT_PATH)) archive.file(CAT_PATH, { name: 'categories.json' });
            if (fs.existsSync(BOOKMARK_JSON_PATH)) archive.file(BOOKMARK_JSON_PATH, { name: 'bookmarks.json' });
            if (fs.existsSync(BOOKMARK_DIR)) archive.directory(BOOKMARK_DIR, 'bookmark_images');
            archive.finalize();
        });
        const stream = fs.createReadStream(tmpOut);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="kodo_full_backup_${Date.now()}.kdba"`);
        stream.pipe(res);
        stream.on('end', () => fs.removeSync(tmpOut));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const fullBackupUpload = multer({ storage: multer.diskStorage({ destination: path.join(APP_ROOT, 'data'), filename: (req, file, cb) => cb(null, `_restore_tmp_${Date.now()}.kdba`) }), limits: { fileSize: 50 * 1024 * 1024 * 1024 } }).single('backupFile');

app.post('/api/backup/full-import', fullBackupUpload, async (req, res) => {
    let tmpZip = null;
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Password required' });
        if (!req.file) return res.status(400).json({ error: 'Backup file required' });
        const filePath = req.file.path;

        const fd = fs.openSync(filePath, 'r');
        const header = Buffer.alloc(36);
        fs.readSync(fd, header, 0, 36, 0);
        const marker = header.subarray(0, 8).toString();

        let salt, iv, authTag, decStart, decEnd;
        const stat = fs.statSync(filePath);

        if (marker === 'KODOSTRM') {
            salt = header.subarray(8, 24);
            iv = header.subarray(24, 36);
            authTag = Buffer.alloc(16);
            fs.readSync(fd, authTag, 0, 16, stat.size - 16);
            decStart = 36;
            decEnd = stat.size - 17; // inclusive bounds for stream
        } else if (marker === 'KODOFULL') {
            const extra = Buffer.alloc(16);
            fs.readSync(fd, extra, 0, 16, 36); // Read KODOFULL format auth tag
            salt = header.subarray(8, 24);
            iv = header.subarray(24, 36);
            authTag = extra;
            decStart = 52;
            decEnd = stat.size - 1;
        } else {
            fs.closeSync(fd);
            fs.removeSync(filePath);
            return res.status(400).json({ error: 'This is not a full backup file. Use "Restore" for metadata-only backups.' });
        }
        fs.closeSync(fd);

        const key = crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        tmpZip = path.join(APP_ROOT, 'data', `_restore_extract_${Date.now()}.zip`);
        const writeStream = fs.createWriteStream(tmpZip);
        const readStream = fs.createReadStream(filePath, { start: decStart, end: decEnd });

        await new Promise((resolve, reject) => {
            readStream.pipe(decipher).pipe(writeStream);
            writeStream.on('close', resolve);
            decipher.on('error', () => reject(new Error('Invalid password or corrupted backup file')));
            readStream.on('error', reject); writeStream.on('error', reject);
        });
        fs.removeSync(filePath); // done with original file

        const extractDir = path.join(APP_ROOT, 'data', `_restore_extract_${Date.now()}`);
        await fs.createReadStream(tmpZip).pipe(unzipper.Extract({ path: extractDir })).promise();
        fs.removeSync(tmpZip); tmpZip = null;

        const extractedManga = path.join(extractDir, 'manga');
        if (fs.existsSync(extractedManga)) fs.copySync(extractedManga, MANGA_PATH, { overwrite: true });
        const extractedMeta = path.join(extractDir, 'meta.json');
        if (fs.existsSync(extractedMeta)) fs.copySync(extractedMeta, META_PATH, { overwrite: true });
        const extractedCat = path.join(extractDir, 'categories.json');
        if (fs.existsSync(extractedCat)) fs.copySync(extractedCat, CAT_PATH, { overwrite: true });
        const extractedBkm = path.join(extractDir, 'bookmarks.json');
        if (fs.existsSync(extractedBkm)) fs.copySync(extractedBkm, BOOKMARK_JSON_PATH, { overwrite: true });
        const extractedBkmImg = path.join(extractDir, 'bookmark_images');
        if (fs.existsSync(extractedBkmImg)) fs.copySync(extractedBkmImg, BOOKMARK_DIR, { overwrite: true });
        fs.removeSync(extractDir);
        res.json({ success: true, message: 'Full restore completed successfully' });
    } catch (err) {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.removeSync(req.file.path);
        if (tmpZip) fs.removeSync(tmpZip);
        res.status(400).json({ error: err.message });
    }
});


// ── GDRIVE ENDPOINTS ───────────────────────────────────────
app.get('/api/gdrive/status', (req, res) => {
    const creds = gdrive.loadCreds();
    const isConnected = !!(creds.tokens && creds.tokens.access_token);
    res.json({ isConnected, clientId: creds.clientId || '' });
});

app.post('/api/gdrive/auth-url', (req, res) => {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });
    try {
        const url = gdrive.getAuthUrl(clientId);
        res.json({ url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/gdrive/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error) return res.send(`Error: ${error}`);
    if (!code) return res.send('No code provided');
    try {
        await gdrive.handleCallback(code);
        res.send('<script>window.opener?.postMessage("kodo_gdrive_auth_success", "*"); window.close();</script>');
    } catch (err) {
        res.send(`Authentication failed: ${err.message}`);
    }
});

app.post('/api/gdrive/disconnect', (req, res) => {
    gdrive.disconnect();
    res.json({ success: true });
});

app.post('/api/backup/gdrive/export', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Password required' });

        const meta = loadMeta();
        const encrypted = encryptData(meta, password);

        const file = await gdrive.uploadBackup(encrypted, password);
        res.json({ success: true, file });
    } catch (err) {
        console.error('GDrive Backup export failed:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/backup/gdrive/list', async (req, res) => {
    try {
        const files = await gdrive.listBackups();
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/backup/gdrive/import', async (req, res) => {
    try {
        const { fileId, password } = req.body;
        if (!fileId || !password) return res.status(400).json({ error: 'fileId and password required' });

        const encryptedBuffer = await gdrive.downloadBackup(fileId);

        try {
            const decryptedMeta = decryptData(encryptedBuffer, password);
            if (typeof decryptedMeta !== 'object' || !decryptedMeta) throw new Error('Invalid backup format');
            saveMeta(decryptedMeta);
            res.json({ success: true, message: 'Restore from Google Drive completed successfully' });
        } catch (decErr) {
            throw new Error('Incorrect password or corrupted file');
        }
    } catch (err) {
        console.error('GDrive Backup import failed:', err);
        res.status(400).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ══════════════════════════════════════════════════════════
app.post('/api/cache/clear-temp', (req, res) => {
    try {
        const COMPRESS_TEMP = path.join(APP_ROOT, 'data', 'compress-temp');
        const UPSCALE_TMP = path.join(APP_ROOT, 'data', 'upscale-tmp');
        const UPSCALE_STAGING = path.join(APP_ROOT, 'data', 'upscale-staging');

        // Ensure dirs exist then empty them
        if (fs.existsSync(COMPRESS_TEMP)) fs.emptyDirSync(COMPRESS_TEMP);
        if (fs.existsSync(UPSCALE_TMP)) fs.emptyDirSync(UPSCALE_TMP);
        if (fs.existsSync(UPSCALE_STAGING)) fs.emptyDirSync(UPSCALE_STAGING);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/cache/open-folder', (req, res) => {
    try {
        const folderPath = path.join(APP_ROOT, 'data');
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        const opener = process.platform === 'win32'
            ? 'explorer.exe'
            : process.platform === 'darwin'
                ? 'open'
                : 'xdg-open';
        const child = spawn(opener, [folderPath], { detached: true, stdio: 'ignore' });
        child.unref();
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/cache/clear-kodo', (req, res) => {
    try {
        const PAGE_CACHE = path.join(APP_ROOT, 'data', 'page-cache');
        const CBZ_CACHE = path.join(APP_ROOT, 'data', 'cbz-cache');

        if (fs.existsSync(PAGE_CACHE)) fs.emptyDirSync(PAGE_CACHE);
        if (fs.existsSync(CBZ_CACHE)) fs.emptyDirSync(CBZ_CACHE);

        saveBookmarks([]);
        if (fs.existsSync(BOOKMARK_DIR)) fs.emptyDirSync(BOOKMARK_DIR);

        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════
// COMPRESSOR API
// ══════════════════════════════════════════════════════════
const compressor = require('./compressor');

app.get('/api/compress/settings', (_req, res) => {
    res.json(compressor.loadSettings());
});

app.put('/api/compress/settings', (req, res) => {
    const current = compressor.loadSettings();
    const updated = { ...current, ...req.body };
    compressor.saveSettings(updated);
    res.json(updated);
});

app.get('/api/compress/presets', (_req, res) => {
    res.json(compressor.PRESETS);
});

app.get('/api/compress/queue', (_req, res) => {
    res.json(compressor.getQueue());
});

app.post('/api/compress/add', (req, res) => {
    try {
        const { mangaId, mangaTitle, chapters, versionId, preset, quality, grayscale, sharpen, maxWidth, maxHeight } = req.body;
        if (!mangaId || !chapters || !chapters.length) {
            return res.status(400).json({ error: 'mangaId and chapters[] required' });
        }
        const job = compressor.addJob({ mangaId, mangaTitle, chapters, versionId, preset, quality, grayscale, sharpen, maxWidth, maxHeight });
        res.json(job);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/compress/remove/:jobId', (req, res) => {
    compressor.removeJob(req.params.jobId);
    res.json({ ok: true });
});

app.post('/api/compress/abort', (_req, res) => {
    compressor.abortCompression();
    res.json({ ok: true });
});

app.post('/api/compress/analyze', async (req, res) => {
    try {
        const { mangaId, chapters, versionId } = req.body;
        const results = [];
        for (const ch of (chapters || [])) {
            const info = await compressor.analyzeCbz(mangaId, ch, versionId);
            if (info) results.push(info);
        }
        res.json(results);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/compress/restore', async (req, res) => {
    try {
        const { mangaId, chapter, versionId } = req.body;
        const ok = await compressor.restoreBackup(mangaId, chapter, versionId);
        res.json({ ok });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/compress/archive', async (req, res) => {
    const archDir = path.join(APP_ROOT, 'data', 'compress-archive');
    if (!fs.existsSync(archDir)) return res.json([]);
    const series = [];
    try {
        const folders = fs.readdirSync(archDir, { withFileTypes: true });
        for (const f of folders) {
            if (!f.isDirectory()) continue;
            const sDir = path.join(archDir, f.name);
            const chapters = fs.readdirSync(sDir).filter(c => c.endsWith('.cbz'));
            if (chapters.length === 0) continue;
            let totalSize = 0;
            for (const c of chapters) totalSize += fs.statSync(path.join(sDir, c)).size;
            series.push({
                mangaId: f.name,
                chapterCount: chapters.length,
                totalSize,
                chapters: chapters.map(c => ({ name: c.replace('.cbz', '') }))
            });
        }
        res.json(series);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/compress/archive/delete', (req, res) => {
    const { seriesId, chapters } = req.body;
    const sDir = path.join(APP_ROOT, 'data', 'compress-archive', seriesId);
    if (!fs.existsSync(sDir)) return res.status(404).json({ error: 'Not found' });
    try {
        if (!chapters || chapters.length === 0) {
            fs.removeSync(sDir);
        } else {
            for (const ch of chapters) {
                const f = path.join(sDir, ch + '.cbz');
                if (fs.existsSync(f)) fs.removeSync(f);
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/compress/archive/restore', (req, res) => {
    const { seriesId, chapters } = req.body;
    const archDir = path.join(APP_ROOT, 'data', 'compress-archive', seriesId);
    const mangaDir = path.join(MANGA_PATH, seriesId);
    if (!fs.existsSync(archDir)) return res.status(404).json({ error: 'Not found' });
    try {
        const filesToRestore = chapters && chapters.length > 0 ? chapters.map(c => c + '.cbz') : fs.readdirSync(archDir).filter(c => c.endsWith('.cbz'));
        for (const f of filesToRestore) {
            const src = path.join(archDir, f);
            const dest = path.join(mangaDir, f);
            if (fs.existsSync(src)) {
                fs.copySync(src, dest, { overwrite: true });
                fs.removeSync(src);
            }
        }
        // If directory is empty, remove it
        if (fs.readdirSync(archDir).length === 0) fs.removeSync(archDir);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/compress/finalize', (req, res) => {
    try {
        const ok = compressor.finalizeJob(req.body.jobId, req.body.action);
        res.json({ ok });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/compress/discard', (req, res) => {
    try {
        const ok = compressor.discardJob(req.body.jobId);
        res.json({ ok });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/rename-series', (req, res) => {
    try {
        const { mangaId, versionId } = req.query;
        if (!mangaId) return res.status(400).json({ error: 'mangaId required' });
        const meta = loadMeta();
        let folder;
        if (versionId && versionId !== 'default') {
            folder = resolveVersionDir(mangaId, versionId, meta);
        } else {
            folder = resolveMangaDir(mangaId, meta);
        }
        if (!fs.existsSync(folder)) return res.json([]);
        const entries = fs.readdirSync(folder).filter(f => {
            if (f.startsWith('.') || f === 'versions' || f === 'cover.jpg' || f === 'cover.png' || f === 'cover.webp') return false;
            const fullP = path.join(folder, f);
            return f.toLowerCase().endsWith('.cbz') || fs.statSync(fullP).isDirectory();
        });
        entries.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        res.json(entries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/rename-series', (req, res) => {
    try {
        const { mangaId, versionId, baseName, startFromZero, customPrefix = ' - ' } = req.body;
        if (!mangaId || !baseName) return res.status(400).json({ error: 'mangaId and baseName required' });

        const meta = loadMeta();
        let folder;
        if (versionId && versionId !== 'default') {
            folder = resolveVersionDir(mangaId, versionId, meta);
        } else {
            folder = resolveMangaDir(mangaId, meta);
        }

        if (!fs.existsSync(folder)) return res.status(404).json({ error: 'Folder not found' });

        const files = fs.readdirSync(folder).filter(f => {
            if (f.startsWith('.') || f === 'versions' || f === 'cover.jpg' || f === 'cover.png' || f === 'cover.webp') return false;
            const fullP = path.join(folder, f);
            return f.toLowerCase().endsWith('.cbz') || fs.statSync(fullP).isDirectory();
        });
        // Sort files to preserve order
        files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        const renamed = [];
        // First pass: rename to a temporary name to avoid conflicts if overlapping names
        const tempPrefix = `_renametemp_${Date.now()}_`;
        for (const oldName of files) {
            const oldPath = path.join(folder, oldName);
            const tempPath = path.join(folder, tempPrefix + oldName);
            fs.renameSync(oldPath, tempPath);
        }

        // Second pass: rename from temporary to target names
        for (let i = 0; i < files.length; i++) {
            const tempName = tempPrefix + files[i];
            const tempPath = path.join(folder, tempName);

            const numVal = startFromZero ? i : i + 1;
            const numStr = String(numVal).padStart(2, '0');
            const newName = `${baseName}${customPrefix}${numStr}.cbz`;
            const newPath = path.join(folder, newName);

            fs.renameSync(tempPath, newPath);
            if (files[i] !== newName) {
                renamed.push({ old: files[i], new: newName });
            }
        }

        res.json({ ok: true, renamed });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── SPA fallback: serve index.html for any unmatched route ──
const spaIndexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
if (fs.existsSync(spaIndexPath)) {
    app.use((req, res, next) => {
        // Only serve index.html for non-API GET requests
        if (req.method === 'GET' && !req.path.startsWith('/api/')) {
            res.sendFile(spaIndexPath);
        } else {
            next();
        }
    });
}

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Kodo server → http://127.0.0.1:${PORT}`);
    console.log(`Manga folder: ${MANGA_PATH}`);

    // Pre-build the library cache in the background so the first /api/manga is instant
    ensureLibraryCacheWarmup();
    scheduleBookmarkCleanup();
});
