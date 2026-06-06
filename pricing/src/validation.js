/**
 * @lozzalingo/pricing - Validation
 *
 * Validates pricing configuration before calculation.
 */

/**
 * Validate pricing config. Returns { valid, errors }.
 */
function validatePricingConfig(config) {
  const errors = [];

  if (!config.pricingModel) {
    errors.push("pricingModel is required");
  }

  if (!config.groupSize || config.groupSize < 1) {
    errors.push("groupSize must be at least 1");
  }

  switch (config.pricingModel) {
    case "PER_PERSON":
      if (!config.pricePerPerson || config.pricePerPerson <= 0) {
        errors.push("pricePerPerson must be a positive number (in pence)");
      }
      break;

    case "FLAT_RATE":
      if (!config.flatRate || config.flatRate <= 0) {
        errors.push("flatRate must be a positive number (in pence)");
      }
      break;

    case "MIN_RESERVE":
      if (!config.minReserve || config.minReserve <= 0) {
        errors.push("minReserve must be a positive number (in pence)");
      }
      if (!config.minPlayers || config.minPlayers < 1) {
        errors.push("minPlayers must be at least 1");
      }
      if (config.additionalPlayerPrice === undefined || config.additionalPlayerPrice < 0) {
        errors.push("additionalPlayerPrice must be a non-negative number (in pence)");
      }
      break;

    case "TIERED":
      if (!config.tiers || !Array.isArray(config.tiers) || config.tiers.length === 0) {
        errors.push("tiers must be a non-empty array");
      } else {
        config.tiers.forEach((tier, i) => {
          if (tier.minGuests === undefined || tier.maxGuests === undefined) {
            errors.push(`tiers[${i}] must have minGuests and maxGuests`);
          }
          if (!tier.pricePerHead && !tier.flatRate) {
            errors.push(`tiers[${i}] must have pricePerHead or flatRate`);
          }
        });
      }
      break;
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validatePricingConfig };
