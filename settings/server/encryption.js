/**
 * @lozzalingo/settings - AES-256-GCM Encryption
 * Key derived from SETTINGS_SECRET or NEXTAUTH_SECRET via SHA-256
 */

const crypto = require('crypto');

function deriveKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(plaintext, secret) {
  if (!secret) throw new Error('[Settings] No encryption secret provided');
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(ciphertext, secret) {
  if (!secret) throw new Error('[Settings] No encryption secret provided');
  const key = deriveKey(secret);
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };
