const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
const AdmZip = require('adm-zip');
const os = require('os');

const APP_ROOT = process.env.KODO_APP_ROOT || path.join(__dirname, '..');
const MANGA_PATH = path.resolve((process.env.KODO_MANGA_PATH || path.join(APP_ROOT, 'manga')));
const META_PATH = path.join(APP_ROOT, 'data', 'meta.json');
const COMPRESS_TEMP = path.join(APP_ROOT, 'data', 'compress-temp');
const COMPRESS_STAGING = path.join(APP_ROOT, 'data', 'compress-staging');
const SETTINGS_PATH = path.join(APP_ROOT, 'data', 'compressor-settings.json');

fs.ensureDirSync(COMPRESS_TEMP);
fs.ensureDirSync(COMPRESS_STAGING);

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|avif)$/i;

// Effort label -> numeric value for sharp WebP (0-6)
const EFFORT_MAP = {
    fastest: 0,
    fast:    2,
    balanced: 4,
    good:    5,
    best:    6,
    maximum: 6,
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

const resolveMangaDir = (id, meta = loadMeta()) => {
    const m = meta[id] || {};
    const linkedPath = resolveLinkedPath(m.sourcePath, m.sourcePathRel);
    if (linkedPath) return linkedPath;
    return path.join(MANGA_PATH, id);
};

const resolveVersionDir = (id, vId, meta = loadMeta()) => {
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

// Settings
const defaultSettings = {
    quality: 80,           // Menjaga detail gambar & kejelasan teks
    smartSubsample: true,  // WAJIB: Menjaga teks dialog agar tidak blur/berbayang
    effort: 'best',        // Kompresi paling maksimal (hemat memori penyimpanan)
    lossless: false,       // Gunakan lossy agar ukuran file turun drastis
    afterCompress: 'review',
};

const loadSettings = () => {
    try { return { ...defaultSettings, ...fs.readJsonSync(SETTINGS_PATH) }; }
    catch { return { ...defaultSettings }; }
};
const saveSettings = (s) => fs.writeJsonSync(SETTINGS_PATH, s, { spaces: 2 });

// PRESETS kept as empty object for backwards compat with exports
const PRESETS = {};

// Queue
let compressQueue = [];
let isCompressing = false;

const getQueue = () => compressQueue;

const addJob = (job) => {
    const id = 'cj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const settings = loadSettings();
    const newJob = {
        id,
        mangaId: job.mangaId,
        mangaTitle: job.mangaTitle,
        chapters: job.chapters,
        versionId: job.versionId || null,
        quality:        job.quality        ?? settings.quality,
        smartSubsample: job.smartSubsample ?? settings.smartSubsample,
        effort:         job.effort         ?? settings.effort,
        lossless:       job.lossless       ?? settings.lossless,
        status: 'queued',
        progress: 0,
        totalPages: 0,
        processedPages: 0,
        originalSize: 0,
        compressedSize: 0,
        currentChapter: null,
        error: null,
        createdAt: Date.now(),
    };
    compressQueue.push(newJob);
    processQueue();
    return newJob;
};

const removeJob = (jobId) => {
    compressQueue = compressQueue.filter(j => j.id !== jobId);
    try {
        const stagingDir = path.join(COMPRESS_STAGING, jobId);
        if (fs.existsSync(stagingDir)) fs.removeSync(stagingDir);
    } catch { }
};

const abortCompression = () => {
    const active = compressQueue.find(j => j.status === 'processing');
    if (active) {
        active.status = 'cancelled';
        active._abort = true;
    }
};

// Process Queue
async function processQueue() {
    if (isCompressing) return;
    const next = compressQueue.find(j => j.status === 'queued');
    if (!next) return;

    isCompressing = true;
    next.status = 'processing';
    let processedAnyChapter = false;

    try {
        for (const chapterName of next.chapters) {
            if (next._abort) break;
            next.currentChapter = chapterName;
            const processed = await compressChapter(next, chapterName);
            if (processed) processedAnyChapter = true;
        }
        if (next._abort) {
            next.status = 'cancelled';
        } else if (!processedAnyChapter) {
            next.status = 'error';
            next.error = 'No CBZ files found for selected chapters. Compressor only works with .cbz chapters.';
        } else {
            const settings = loadSettings();
            if (settings.afterCompress === 'review') {
                next.status = 'review';
            } else {
                finalizeJob(next.id, 'replace');
            }
        }
    } catch (err) {
        console.error('Compression error:', err);
        next.status = 'error';
        next.error = err.message;
    }

    isCompressing = false;
    processQueue();
}

function finalizeJob(jobId, action) {
    const job = compressQueue.find(j => j.id === jobId && (j.status === 'review' || j.status === 'processing'));
    if (!job) return false;

    const stagingDir = path.join(COMPRESS_STAGING, jobId);
    if (!fs.existsSync(stagingDir)) return false;

    if (action === 'replace' || action === 'archive') {
        const meta = loadMeta();
        const mangaDir = job.versionId && job.versionId !== 'default'
            ? resolveVersionDir(job.mangaId, job.versionId, meta)
            : resolveMangaDir(job.mangaId, meta);

        for (const ch of job.chapters) {
            const cbzPath = path.join(mangaDir, ch + '.cbz');
            const stgPath = path.join(stagingDir, ch + '.cbz');
            if (fs.existsSync(stgPath)) {
                if (action === 'archive' && fs.existsSync(cbzPath)) {
                    const archDir = path.join(APP_ROOT, 'data', 'compress-archive', job.mangaId);
                    fs.ensureDirSync(archDir);
                    const archPath = path.join(archDir, ch + '.cbz');
                    if (!fs.existsSync(archPath)) {
                        fs.moveSync(cbzPath, archPath);
                    }
                }
                fs.copySync(stgPath, cbzPath, { overwrite: true });
            }
            const cacheNamePart = (job.versionId && job.versionId !== 'default') ? `${job.versionId}_${ch}` : ch;
            const cacheDir = path.join(APP_ROOT, 'data', 'cbz-cache', job.mangaId, cacheNamePart);
            if (fs.existsSync(cacheDir)) fs.removeSync(cacheDir);
        }
    }

    fs.removeSync(stagingDir);

    job.status = 'done';
    job.progress = 100;
    setTimeout(() => removeJob(jobId), 5000);
    return true;
}

function discardJob(jobId) {
    const job = compressQueue.find(j => j.id === jobId && j.status === 'review');
    if (!job) return false;

    const stagingDir = path.join(COMPRESS_STAGING, jobId);
    if (fs.existsSync(stagingDir)) fs.removeSync(stagingDir);

    job.status = 'cancelled';
    setTimeout(() => removeJob(jobId), 5000);
    return true;
}

async function compressChapter(job, chapterName) {
    const meta = loadMeta();
    const mangaDir = job.versionId && job.versionId !== 'default'
        ? resolveVersionDir(job.mangaId, job.versionId, meta)
        : resolveMangaDir(job.mangaId, meta);

    const cbzFile = chapterName + '.cbz';
    const cbzPath = path.join(mangaDir, cbzFile);

    if (!fs.existsSync(cbzPath)) {
        console.log(`[Compressor] Skipping ${chapterName} - CBZ not found at ${cbzPath}`);
        return false;
    }

    const backupPath = cbzPath + '.backup';
    if (fs.existsSync(backupPath)) {
        console.log(`[Compressor] WARNING ${chapterName}: Backup already exists - re-compressing an already compressed CBZ may yield limited results`);
    }

    const originalStat = await fs.stat(cbzPath);
    const chapterOrigSize = originalStat.size;
    job.originalSize += chapterOrigSize;

    const safeDirName = chapterName.replace(/[/\\:*?"<>|]/g, '_');
    const tempDir = path.join(COMPRESS_TEMP, job.id, safeDirName);
    fs.ensureDirSync(tempDir);

    const zip = new AdmZip(cbzPath);
    const entries = zip.getEntries()
        .filter(e => IMAGE_EXT.test(e.entryName) && !e.isDirectory)
        .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }));

    job.totalPages += entries.length;

    const effortNum = EFFORT_MAP[job.effort] ?? EFFORT_MAP['best'];

    console.log(`[Compressor] ${chapterName}: ${entries.length} images, original ${(chapterOrigSize / 1024 / 1024).toFixed(2)} MB, quality=${job.quality}, effort=${job.effort}(${effortNum}), smartSubsample=${job.smartSubsample}, lossless=${job.lossless}`);

    let totalOrigImgSize = 0;
    let totalNewImgSize = 0;
    let failCount = 0;

    const CONCURRENCY = Math.max(3, os.cpus().length);
    for (let i = 0; i < entries.length; i += CONCURRENCY) {
        if (job._abort) return;
        const chunk = entries.slice(i, i + CONCURRENCY);

        await Promise.all(chunk.map(async (entry, chunkIdx) => {
            const baseName = path.basename(entry.entryName);
            const outName = baseName.replace(/\.(jpg|jpeg|png|webp|avif)$/i, '.webp');
            const outPath = path.join(tempDir, outName);

            try {
                const inputBuffer = await new Promise((resolve, reject) => {
                    entry.getDataAsync((data, err) => err ? reject(err) : resolve(data));
                });

                if (!inputBuffer || inputBuffer.length === 0) {
                    console.error(`[Compressor] ${baseName}: getDataAsync() returned empty buffer, skipping`);
                    failCount++;
                    return;
                }

                totalOrigImgSize += inputBuffer.length;

                // WebP has a hard limit of 16383 x 16383 px.
                // Webtoon/manhwa long-strips commonly exceed this (e.g. 1440 x 29000+).
                // If exceeded, resize proportionally (maintaining aspect ratio) to fit within
                // the limit using fit:'inside', then convert to WebP as usual.
                const WEBP_MAX = 16383;
                const imgMeta = await sharp(inputBuffer, { failOn: 'none', limitInputPixels: false }).metadata();
                const exceedsWebP = (imgMeta.width > WEBP_MAX || imgMeta.height > WEBP_MAX);

                let pipeline = sharp(inputBuffer, { failOn: 'none', limitInputPixels: false });
                if (exceedsWebP) {
                    // fit:'inside' scales down so both dimensions stay within WEBP_MAX,
                    // preserving the original aspect ratio exactly.
                    pipeline = pipeline.resize(WEBP_MAX, WEBP_MAX, { fit: 'inside', withoutEnlargement: true });
                    const globalIdx = i + chunkIdx;
                    if (globalIdx < 5) {
                        console.log(`[Compressor]   [${globalIdx + 1}] ${baseName}: ${imgMeta.width}x${imgMeta.height} exceeds WebP limit, resizing to fit ${WEBP_MAX}px`);
                    }
                }

                const { data: outputBuffer } = await pipeline
                    .webp({
                        quality:        job.quality,
                        smartSubsample: job.smartSubsample,
                        effort:         effortNum,
                        lossless:       job.lossless,
                    })
                    .toBuffer({ resolveWithObject: true });

                if (outputBuffer.length >= inputBuffer.length && !exceedsWebP) {
                    // WebP is larger than original AND no resize was needed - keep original
                    fs.writeFileSync(path.join(tempDir, baseName), inputBuffer);
                    totalNewImgSize += inputBuffer.length;
                } else {
                    fs.writeFileSync(outPath, outputBuffer);
                    totalNewImgSize += outputBuffer.length;
                }

                const globalIdx = i + chunkIdx;
                if (globalIdx < 5) {
                    const finalLength = (outputBuffer.length >= inputBuffer.length && !exceedsWebP) ? inputBuffer.length : outputBuffer.length;
                    const pctDiff = Math.round((1 - finalLength / inputBuffer.length) * 100);
                    const note = exceedsWebP ? ' [resized]' : (outputBuffer.length >= inputBuffer.length ? ' [kept original]' : '');
                    console.log(`[Compressor]   [${globalIdx + 1}] ${baseName} -> ${(outputBuffer.length >= inputBuffer.length && !exceedsWebP) ? baseName : outName}: ${(inputBuffer.length / 1024).toFixed(0)} KB -> ${(finalLength / 1024).toFixed(0)} KB (${pctDiff}%)${note}`);
                }

            } catch (err) {
                console.error(`[Compressor] Failed to compress ${baseName}:`, err.message);
                failCount++;
                try {
                    const origData = entry.getData();
                    if (origData && origData.length > 0) {
                        fs.writeFileSync(path.join(tempDir, baseName), origData);
                        totalNewImgSize += origData.length;
                    }
                } catch (innerErr) {
                    console.error(`[Compressor] Also failed to fallback for ${baseName}:`, innerErr.message);
                }
            }
        }));

        job.processedPages += chunk.length;
        job.progress = Math.round((job.processedPages / job.totalPages) * 100);
    }

    const imgReduction = totalOrigImgSize > 0 ? Math.round((1 - totalNewImgSize / totalOrigImgSize) * 100) : 0;
    console.log(`[Compressor] ${chapterName}: Images ${(totalOrigImgSize / 1024 / 1024).toFixed(2)} MB -> ${(totalNewImgSize / 1024 / 1024).toFixed(2)} MB (${imgReduction}% reduced)${failCount > 0 ? ` - ${failCount} failed` : ''}`);

    // Rebuild CBZ
    const newZip = new AdmZip();
    const compressedFiles = fs.readdirSync(tempDir)
        .filter(f => IMAGE_EXT.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    for (const f of compressedFiles) {
        newZip.addLocalFile(path.join(tempDir, f));
    }

    const stagingDir = path.join(COMPRESS_STAGING, job.id);
    fs.ensureDirSync(stagingDir);
    const stagingPath = path.join(stagingDir, cbzFile);
    newZip.writeZip(stagingPath);

    const newStat = await fs.stat(stagingPath);
    const chapterNewSize = newStat.size;
    job.compressedSize += chapterNewSize;

    console.log(`[Compressor] ${chapterName}: CBZ ${(chapterOrigSize / 1024 / 1024).toFixed(2)} MB -> ${(chapterNewSize / 1024 / 1024).toFixed(2)} MB (${Math.round((1 - chapterNewSize / chapterOrigSize) * 100)}% reduced)`);

    await fs.remove(tempDir);
    return true;
}

// Analyze a CBZ (get info without compressing)
async function analyzeCbz(mangaId, chapterName, versionId) {
    const meta = loadMeta();
    const mangaDir = versionId && versionId !== 'default'
        ? resolveVersionDir(mangaId, versionId, meta)
        : resolveMangaDir(mangaId, meta);

    const cbzPath = path.join(mangaDir, chapterName + '.cbz');
    if (!fs.existsSync(cbzPath)) return null;

    const stat = await fs.stat(cbzPath);
    const zip = new AdmZip(cbzPath);
    const entries = zip.getEntries().filter(e => IMAGE_EXT.test(e.entryName) && !e.isDirectory);

    return {
        chapter: chapterName,
        fileSize: stat.size,
        pageCount: entries.length,
        hasBackup: fs.existsSync(cbzPath + '.backup'),
    };
}

// Restore backup
async function restoreBackup(mangaId, chapterName, versionId) {
    const meta = loadMeta();
    const mangaDir = versionId && versionId !== 'default'
        ? resolveVersionDir(mangaId, versionId, meta)
        : resolveMangaDir(mangaId, meta);

    const cbzPath = path.join(mangaDir, chapterName + '.cbz');
    const backupPath = cbzPath + '.backup';

    if (!fs.existsSync(backupPath)) return false;
    await fs.copy(backupPath, cbzPath, { overwrite: true });
    await fs.remove(backupPath);
    return true;
}

module.exports = {
    loadSettings, saveSettings, PRESETS,
    getQueue, addJob, removeJob, abortCompression,
    analyzeCbz, restoreBackup, finalizeJob, discardJob
};
