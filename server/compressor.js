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

// ── Settings ──────────────────────────────────────────────
const defaultSettings = {
    quality: 82,
    preset: 'manhwa',       // 'manga' | 'manhwa'
    sharpen: true,
    grayscale: false,        // auto for manga preset
    maxWidth: 0,             // 0 = no resize
    maxHeight: 0,
    afterCompress: 'review', // 'review' | 'delete'
};

const loadSettings = () => {
    try { return { ...defaultSettings, ...fs.readJsonSync(SETTINGS_PATH) }; }
    catch { return { ...defaultSettings }; }
};
const saveSettings = (s) => fs.writeJsonSync(SETTINGS_PATH, s, { spaces: 2 });

// ── Presets ───────────────────────────────────────────────
const PRESETS = {
    manga: {
        label: 'Manga',
        desc: 'Black & white manga — converts to grayscale, aggressive compression',
        quality: 78,
        grayscale: true,
        sharpen: true,
    },
    manhwa: {
        label: 'Manhwa',
        desc: 'Full-color webtoon/manhwa — preserves colors, balanced compression',
        quality: 82,
        grayscale: false,
        sharpen: true,
    },
    aggressive: {
        label: 'Aggressive',
        desc: 'Maximum compression — smallest file size, some quality loss',
        quality: 65,
        grayscale: false,
        sharpen: false,
    },
    lossless: {
        label: 'Lossless-ish',
        desc: 'Minimal compression — nearly original quality, larger files',
        quality: 95,
        grayscale: false,
        sharpen: true,
    },
};

// ── Queue ─────────────────────────────────────────────────
let compressQueue = [];
let isCompressing = false;

const getQueue = () => compressQueue;

const addJob = (job) => {
    const id = 'cj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const newJob = {
        id,
        mangaId: job.mangaId,
        mangaTitle: job.mangaTitle,
        chapters: job.chapters,
        versionId: job.versionId || null,
        preset: job.preset || 'manhwa',
        quality: job.quality ?? PRESETS[job.preset]?.quality ?? 82,
        grayscale: job.grayscale ?? PRESETS[job.preset]?.grayscale ?? false,
        sharpen: job.sharpen ?? PRESETS[job.preset]?.sharpen ?? true,
        maxWidth: job.maxWidth || 0,
        maxHeight: job.maxHeight || 0,
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

    // Clean staging just in case
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

// ── Process Queue ─────────────────────────────────────────
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
    // Process next in queue
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
                    // Move original to archive
                    const archDir = path.join(APP_ROOT, 'data', 'compress-archive', job.mangaId);
                    fs.ensureDirSync(archDir);
                    const archPath = path.join(archDir, ch + '.cbz');
                    if (!fs.existsSync(archPath)) {
                        fs.moveSync(cbzPath, archPath);
                    }
                }
                fs.copySync(stgPath, cbzPath, { overwrite: true });
            }
            // Clear cbz-cache
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

    job.status = 'cancelled'; // or done, but cancelled clears it correctly
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
        console.log(`[Compressor] Skipping ${chapterName} — CBZ not found at ${cbzPath}`);
        return false;
    }

    // Warn if already compressed before
    const backupPath = cbzPath + '.backup';
    if (fs.existsSync(backupPath)) {
        console.log(`[Compressor] ⚠ ${chapterName}: Backup already exists — re-compressing an already compressed CBZ may yield limited results`);
    }

    const originalStat = await fs.stat(cbzPath);
    const chapterOrigSize = originalStat.size;
    job.originalSize += chapterOrigSize;

    // Extract CBZ
    const tempDir = path.join(COMPRESS_TEMP, job.id, chapterName);
    fs.ensureDirSync(tempDir);

    const zip = new AdmZip(cbzPath);
    const entries = zip.getEntries()
        .filter(e => IMAGE_EXT.test(e.entryName) && !e.isDirectory)
        .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }));

    job.totalPages += entries.length;
    console.log(`[Compressor] ${chapterName}: ${entries.length} images, original CBZ ${(chapterOrigSize / 1024 / 1024).toFixed(2)} MB, quality=${job.quality}`);

    // Compress each image
    let totalOrigImgSize = 0;
    let totalNewImgSize = 0;
    let failCount = 0;

    // Batch process images concurrently to utilize all CPU threads
    const CONCURRENCY = Math.max(3, os.cpus().length);
    for (let i = 0; i < entries.length; i += CONCURRENCY) {
        if (job._abort) return;
        const chunk = entries.slice(i, i + CONCURRENCY);

        await Promise.all(chunk.map(async (entry, chunkIdx) => {
            const baseName = path.basename(entry.entryName);
            const outName = baseName.replace(/\.(png|webp|avif)$/i, '.jpg');
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

                // Track sizes (thread-safe addition)
                totalOrigImgSize += inputBuffer.length;

                // Build the sharp pipeline
                // limitInputPixels: false prevents errors on huge long-strip manhwa images (>268MP)
                let pipeline = sharp(inputBuffer, { failOn: 'none', limitInputPixels: false });

                // Resize if specified
                if (job.maxWidth > 0 || job.maxHeight > 0) {
                    pipeline = pipeline.resize({
                        width: job.maxWidth || undefined,
                        height: job.maxHeight || undefined,
                        fit: 'inside',
                        withoutEnlargement: true,
                    });
                }

                // Grayscale
                if (job.grayscale) {
                    pipeline = pipeline.grayscale();
                }

                // Sharpen (subtle — preserves line art)
                // Note: Sharpening massively increases CPU time for large images
                if (job.sharpen) {
                    pipeline = pipeline.sharpen({ sigma: 0.5, flat: 0.5, jagged: 0.3 });
                }

                // Force re-encode as optimized JPEG using MozJPEG
                const { data: outputBuffer } = await pipeline
                    .jpeg({
                        quality: job.quality,
                        mozjpeg: true,
                        chromaSubsampling: job.grayscale ? '4:4:4' : '4:2:0',
                        force: true,
                    })
                    .toBuffer({ resolveWithObject: true });

                if (outputBuffer.length >= inputBuffer.length) {
                    fs.writeFileSync(path.join(tempDir, baseName), inputBuffer);
                    totalNewImgSize += inputBuffer.length;
                } else {
                    fs.writeFileSync(outPath, outputBuffer);
                    totalNewImgSize += outputBuffer.length;
                }

                // Log first few images for debugging
                const absoluteIndex = i + chunkIdx;
                if (absoluteIndex < 3) {
                    const finalLength = outputBuffer.length >= inputBuffer.length ? inputBuffer.length : outputBuffer.length;
                    const pctDiff = Math.round((1 - finalLength / inputBuffer.length) * 100);
                    console.log(`[Compressor]   ${baseName}: ${(inputBuffer.length / 1024).toFixed(0)} KB → ${(finalLength / 1024).toFixed(0)} KB (${pctDiff}%)`);
                }

            } catch (err) {
                // Fallback: copy original data as-is
                console.error(`[Compressor] ✗ Failed to compress ${baseName}:`, err.message);
                failCount++;
                try {
                    const origData = entry.getData();
                    if (origData && origData.length > 0) {
                        fs.writeFileSync(path.join(tempDir, baseName), origData);
                        totalOrigImgSize += origData.length;
                        totalNewImgSize += origData.length;
                    }
                } catch (innerErr) {
                    console.error(`[Compressor] ✗ Also failed to fallback for ${baseName}:`, innerErr.message);
                }
            }
        }));

        job.processedPages += chunk.length;
        job.progress = Math.round((job.processedPages / job.totalPages) * 100);
    }

    const imgReduction = totalOrigImgSize > 0 ? Math.round((1 - totalNewImgSize / totalOrigImgSize) * 100) : 0;
    console.log(`[Compressor] ${chapterName}: Images ${(totalOrigImgSize / 1024 / 1024).toFixed(2)} MB → ${(totalNewImgSize / 1024 / 1024).toFixed(2)} MB (${imgReduction}% reduced)${failCount > 0 ? ` — ${failCount} failed` : ''}`);

    // Rebuild CBZ
    const newZip = new AdmZip();
    const compressedFiles = fs.readdirSync(tempDir)
        .filter(f => IMAGE_EXT.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    for (const f of compressedFiles) {
        newZip.addLocalFile(path.join(tempDir, f));
    }

    // Write new to staging
    const stagingDir = path.join(COMPRESS_STAGING, job.id);
    fs.ensureDirSync(stagingDir);
    const stagingPath = path.join(stagingDir, cbzFile);
    newZip.writeZip(stagingPath);

    const newStat = await fs.stat(stagingPath);
    const chapterNewSize = newStat.size;
    job.compressedSize += chapterNewSize;

    console.log(`[Compressor] ${chapterName}: CBZ ${(chapterOrigSize / 1024 / 1024).toFixed(2)} MB → ${(chapterNewSize / 1024 / 1024).toFixed(2)} MB (${Math.round((1 - chapterNewSize / chapterOrigSize) * 100)}% reduced)`);

    // Clean up temp
    await fs.remove(tempDir);
    return true;
}

// ── Analyze a CBZ (get info without compressing) ──────────
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

// ── Restore backup ────────────────────────────────────────
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
