/**
 * @lozzalingo/auth - JWT Verify
 * Shared JWT decode and verify using Node.js crypto (no external deps).
 * Supports HS256 (HMAC-SHA256) tokens.
 */

const crypto = require('crypto');

/**
 * Base64url decode to Buffer.
 */
function base64urlDecode(str) {
  // Replace URL-safe chars and add padding
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

/**
 * Decode a JWT without verifying the signature.
 * Returns { header, payload, signature } or null if malformed.
 */
function decodeJWT(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(base64urlDecode(parts[0]).toString('utf8'));
    const payload = JSON.parse(base64urlDecode(parts[1]).toString('utf8'));
    const signature = parts[2];
    return { header, payload, signature, raw: { header: parts[0], payload: parts[1] } };
  } catch (err) {
    console.error('[JWT] Failed to decode token:', err.message);
    return null;
  }
}

/**
 * Verify an HS256 JWT signature and expiry.
 * @param {string} token - raw JWT string
 * @param {string} secret - HMAC secret (hex or plain string)
 * @param {object} options
 * @param {number} [options.clockToleranceSec=30] - seconds of clock skew tolerance
 * @returns {{ valid: boolean, payload: object|null, error: string|null }}
 */
function verifyHS256(token, secret, options = {}) {
  const { clockToleranceSec = 30 } = options;

  const decoded = decodeJWT(token);
  if (!decoded) {
    return { valid: false, payload: null, error: 'Malformed token' };
  }

  const { header, payload, signature, raw } = decoded;

  // Check algorithm
  if (header.alg !== 'HS256') {
    return { valid: false, payload: null, error: `Unsupported algorithm: ${header.alg}` };
  }

  // Compute expected signature
  const signingInput = `${raw.header}.${raw.payload}`;
  const secretBuffer = Buffer.from(secret, 'hex').length === secret.length / 2 && /^[0-9a-f]+$/i.test(secret)
    ? Buffer.from(secret, 'hex')
    : Buffer.from(secret, 'utf8');

  const expectedSig = crypto
    .createHmac('sha256', secretBuffer)
    .update(signingInput)
    .digest('base64url');

  // Timing-safe comparison
  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, payload: null, error: 'Invalid signature' };
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp + clockToleranceSec) {
    return { valid: false, payload: null, error: 'Token expired' };
  }

  // Check not-before
  if (payload.nbf && now < payload.nbf - clockToleranceSec) {
    return { valid: false, payload: null, error: 'Token not yet valid' };
  }

  return { valid: true, payload, error: null };
}

module.exports = { decodeJWT, verifyHS256, base64urlDecode };
