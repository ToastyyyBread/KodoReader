const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits

function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(String(password), salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

function encryptData(dataObject, password) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveKey(password, salt);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const dataString = JSON.stringify({ version: 1, data: dataObject });

    const encrypted = Buffer.concat([cipher.update(dataString, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, authTag, encrypted]);
}

function decryptData(buffer, password) {
    try {
        const salt = buffer.subarray(0, SALT_LENGTH);
        const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const authTag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
        const encryptedData = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

        const key = deriveKey(password, salt);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
        const parsed = JSON.parse(decrypted.toString('utf8'));

        // Return inner data 
        return parsed.data || parsed;
    } catch (err) {
        throw new Error('Invalid password or corrupted backup file');
    }
}

module.exports = { encryptData, decryptData };
