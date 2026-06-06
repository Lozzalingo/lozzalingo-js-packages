/**
 * @lozzalingo/pricing - Formatting utilities
 *
 * All input values are in pence.
 */

/**
 * Format pence to GBP string (e.g. 18000 → "£180.00")
 */
function formatGBP(pence, { decimals = 2 } = {}) {
  return `\u00A3${(pence / 100).toFixed(decimals)}`;
}

/**
 * Format pence to compact GBP (e.g. 18000 → "£180")
 */
function formatGBPCompact(pence) {
  return formatGBP(pence, { decimals: 0 });
}

/**
 * Format a "from" price string (e.g. "From £30pp")
 */
function formatFromPrice(pence, { perPerson = true } = {}) {
  const amount = formatGBPCompact(pence);
  return perPerson ? `From ${amount}pp` : `From ${amount}`;
}

/**
 * Format a price range (e.g. "£25 – £45 per person")
 */
function formatPriceRange(minPence, maxPence, { perPerson = true } = {}) {
  const min = formatGBPCompact(minPence);
  const max = formatGBPCompact(maxPence);
  const suffix = perPerson ? " per person" : "";
  return `${min} \u2013 ${max}${suffix}`;
}

module.exports = { formatGBP, formatGBPCompact, formatFromPrice, formatPriceRange };
