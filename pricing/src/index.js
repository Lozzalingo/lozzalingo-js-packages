/**
 * @lozzalingo/pricing
 *
 * Unified pricing calculator for all Lozzalingo sites.
 * Supports per-person, flat-rate, min-reserve, and tiered pricing models.
 *
 * All monetary values are in pence (smallest currency unit).
 */

const { calculatePrice, PRICING_MODELS } = require("./calculator");
const { formatGBP, formatGBPCompact, formatFromPrice, formatPriceRange } = require("./format");
const { validatePricingConfig } = require("./validation");

module.exports = {
  calculatePrice,
  PRICING_MODELS,
  formatGBP,
  formatGBPCompact,
  formatFromPrice,
  formatPriceRange,
  validatePricingConfig,
};
