const crypto = require("crypto");

/**
 * Generate a booking number: {PREFIX}-{YYYYMM}-{HEX}
 * e.g. BR-202605-A3F2B1, FBQ-202605-7E1C0A
 *
 * Uses 3 random bytes (6 hex chars).
 *
 * @param {string} prefix - Brand prefix (e.g. "FBQ", "BR", "KAL")
 * @returns {string}
 */
function generateBookingNumber(prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const hex = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${year}${month}-${hex}`;
}

module.exports = { generateBookingNumber };
