const fs = require('fs');
const path = require('path');
let content = fs.readFileSync('server/index.js', 'utf8');

const target1 = `        // Try CBZ first page
        const cbzs = await getCbzFiles(dir);
        if (cbzs.length) {
            const images = getCbzImages(mangaId, cbzs[0], dir);
            if (images.length) return images[0];
        }`;

const replace1 = `        // Try CBZ first page
        const cbzs = await getCbzFiles(dir);
        if (cbzs.length) {
            // Don't extract cbz synchronously! Just yield the dynamic URL so the client loads it asynchronously
            return \`/api/dynamic-cbz-cover/\${encodeURIComponent(mangaId)}/\${encodeURIComponent(cbzs[0])}?subPath=\${encodeURIComponent(subPath)}\`;
        }`;

content = content.replace(target1, replace1);

const target2 = `// ══════════════════════════════════════════════════════════
// ROUTES`;

const replace2 = `// ══════════════════════════════════════════════════════════
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
        const IMAGE_EXT = /\\.(jpg|jpeg|png|webp|avif)$/i;
        const entries = zip.getEntries()
            .filter(e => IMAGE_EXT.test(e.entryName) && !e.isDirectory)
            .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }));
            
        if (entries.length > 0) {
            const buffer = zip.readFile(entries[0]);
            
            // Set correct content type
            const ext = path.extname(entries[0].entryName).toLowerCase().replace('.', '');
            const mimeType = ext === 'jpg' ? 'jpeg' : ext;
            res.set('Content-Type', \`image/\${mimeType === 'avif' ? 'avif' : mimeType === 'png' ? 'png' : mimeType === 'webp' ? 'webp' : 'jpeg'}\`);
            res.set('Cache-Control', 'public, max-age=86400');
            return res.send(buffer);
        }
        
        res.status(404).send('No images found');
    } catch (err) {
        res.status(500).send('Error reading CBZ');
    }
});

// ══════════════════════════════════════════════════════════
// ROUTES`;

content = content.replace(target2, replace2);
fs.writeFileSync('server/index.js', content);
console.log('Fixed server');
