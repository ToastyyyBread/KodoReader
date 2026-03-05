const { google } = require('googleapis');
const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');

const APP_ROOT = process.env.KODO_APP_ROOT || path.join(__dirname, '..');
const CREDENTIALS_PATH = path.join(APP_ROOT, 'data', 'gdrive-creds.json');

function loadCreds() {
    try {
        return fs.readJsonSync(CREDENTIALS_PATH);
    } catch {
        return { clientId: '', tokens: {}, codeVerifier: '' };
    }
}

function saveCreds(data) {
    fs.ensureDirSync(path.dirname(CREDENTIALS_PATH));
    const current = loadCreds();
    fs.writeJsonSync(CREDENTIALS_PATH, { ...current, ...data }, { spaces: 2 });
}

function getOAuthClient(clientId = null) {
    const creds = loadCreds();
    const id = clientId || creds.clientId;
    return new google.auth.OAuth2(
        id,
        '', // No client secret needed for PKCE
        'http://localhost:5000/api/gdrive/callback' // Ensure this matches Google Console exactly
    );
}

function generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

function getAuthUrl(clientId) {
    if (clientId) saveCreds({ clientId });
    const auth = getOAuthClient(clientId);
    const pkce = generatePKCE();
    saveCreds({ codeVerifier: pkce.verifier });

    return auth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: ['https://www.googleapis.com/auth/drive.file'],
        code_challenge: pkce.challenge,
        code_challenge_method: 'S256'
    });
}

async function handleCallback(code) {
    const creds = loadCreds();
    const auth = getOAuthClient();

    // We get token using the code and the code_verifier we saved earlier
    const { tokens } = await auth.getToken({
        code,
        codeVerifier: creds.codeVerifier
    });

    saveCreds({ tokens, codeVerifier: null }); // clear verifier
    return true;
}

function getDriveClient() {
    const creds = loadCreds();
    if (!creds.tokens || !creds.tokens.access_token) throw new Error('Not connected to Google Drive');
    const auth = getOAuthClient();
    auth.setCredentials(creds.tokens);

    // Listen for token refreshes to update stored tokens
    auth.on('tokens', (tokens) => {
        const current = loadCreds();
        saveCreds({ tokens: { ...current.tokens, ...tokens } });
    });

    return google.drive({ version: 'v3', auth });
}

async function uploadBackup(buffer, password) {
    const drive = getDriveClient();
    const fileName = `kodo_backup_${Date.now()}.kdba`;
    const mimeType = 'application/octet-stream';

    // Use the stream abstraction to upload the buffer
    const { Readable } = require('stream');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Kodo Backup folder logic
    let folderId = await getOrCreateKodoFolder(drive);

    const fileMetadata = {
        name: fileName,
        parents: [folderId]
    };

    const media = {
        mimeType,
        body: stream
    };

    const res = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id, name, createdTime, size'
    });

    return res.data;
}

async function getOrCreateKodoFolder(drive) {
    const folderName = 'Kodo Backups';

    const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    const res = await drive.files.list({ q, spaces: 'drive', fields: 'files(id)' });

    if (res.data.files.length > 0) return res.data.files[0].id;

    const created = await drive.files.create({
        resource: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id'
    });
    return created.data.id;
}

async function listBackups() {
    try {
        const drive = getDriveClient();
        const folderId = await getOrCreateKodoFolder(drive);

        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            orderBy: 'createdTime desc',
            fields: 'files(id, name, createdTime, size)'
        });

        return res.data.files;
    } catch (err) {
        if (err.message === 'Not connected to Google Drive') return [];
        throw err;
    }
}

async function downloadBackup(fileId) {
    const drive = getDriveClient();
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
}

function disconnect() {
    saveCreds({ tokens: {} });
}

module.exports = {
    getAuthUrl,
    handleCallback,
    uploadBackup,
    listBackups,
    downloadBackup,
    disconnect,
    loadCreds
};
