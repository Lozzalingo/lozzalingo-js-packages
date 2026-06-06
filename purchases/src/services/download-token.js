const crypto = require("crypto");

/**
 * Generate a secure random download token.
 * @returns {string} 32-character hex token
 */
function generateDownloadToken() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Validate a download is allowed.
 * @param {object} purchase
 * @returns {{ allowed: boolean, reason?: string }}
 */
function validateDownload(purchase) {
  if (purchase.status !== "COMPLETED") {
    return { allowed: false, reason: "Purchase is not completed" };
  }

  if (purchase.expiresAt && new Date(purchase.expiresAt) < new Date()) {
    return { allowed: false, reason: "Download link has expired" };
  }

  if (purchase.downloadCount >= purchase.downloadLimit) {
    return { allowed: false, reason: "Download limit reached" };
  }

  return { allowed: true };
}

module.exports = { generateDownloadToken, validateDownload };
