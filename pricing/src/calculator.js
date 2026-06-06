/**
 * @lozzalingo/pricing - Calculator
 *
 * All prices are in pence (smallest currency unit).
 * groupSize must be >= 1.
 */

const PRICING_MODELS = {
  PER_PERSON: "PER_PERSON",
  FLAT_RATE: "FLAT_RATE",
  MIN_RESERVE: "MIN_RESERVE",
  TIERED: "TIERED",
};

/**
 * Calculate total price in pence.
 *
 * @param {object} config
 * @param {string} config.pricingModel - PER_PERSON | FLAT_RATE | MIN_RESERVE | TIERED
 * @param {number} config.groupSize - Number of people
 * @param {number} [config.pricePerPerson] - Pence per person (PER_PERSON model)
 * @param {number} [config.flatRate] - Flat rate in pence (FLAT_RATE model)
 * @param {number} [config.minReserve] - Minimum reserve amount in pence (MIN_RESERVE model)
 * @param {number} [config.minPlayers] - Players included in minReserve (MIN_RESERVE model)
 * @param {number} [config.additionalPlayerPrice] - Pence per extra player beyond minPlayers
 * @param {Array} [config.tiers] - Array of { minGuests, maxGuests, pricePerHead, flatRate }
 * @returns {{ total: number, perPerson: number, breakdown: object }}
 */
function calculatePrice(config) {
  const {
    pricingModel,
    groupSize,
    pricePerPerson = 0,
    flatRate = 0,
    minReserve = 0,
    minPlayers = 1,
    additionalPlayerPrice = 0,
    tiers = [],
  } = config;

  const size = Math.max(1, groupSize);
  let total = 0;
  let breakdown = {};

  switch (pricingModel) {
    case PRICING_MODELS.PER_PERSON: {
      total = size * pricePerPerson;
      breakdown = {
        model: "PER_PERSON",
        groupSize: size,
        pricePerPerson,
        total,
      };
      break;
    }

    case PRICING_MODELS.FLAT_RATE: {
      total = flatRate;
      breakdown = {
        model: "FLAT_RATE",
        groupSize: size,
        flatRate,
        total,
      };
      break;
    }

    case PRICING_MODELS.MIN_RESERVE: {
      const effectiveMinPlayers = Math.max(1, minPlayers);
      const extraPlayers = Math.max(0, size - effectiveMinPlayers);
      const extraCost = extraPlayers * additionalPlayerPrice;
      total = minReserve + extraCost;
      breakdown = {
        model: "MIN_RESERVE",
        groupSize: size,
        minReserve,
        minPlayers: effectiveMinPlayers,
        additionalPlayerPrice,
        extraPlayers,
        extraCost,
        total,
      };
      break;
    }

    case PRICING_MODELS.TIERED: {
      const tier = tiers.find(
        (t) => size >= t.minGuests && size <= t.maxGuests
      );
      if (tier) {
        if (tier.flatRate) {
          total = tier.flatRate;
        } else if (tier.pricePerHead) {
          total = size * tier.pricePerHead;
        }
        breakdown = {
          model: "TIERED",
          groupSize: size,
          tier: { minGuests: tier.minGuests, maxGuests: tier.maxGuests },
          pricePerHead: tier.pricePerHead || null,
          tierFlatRate: tier.flatRate || null,
          total,
        };
      } else {
        console.warn("[Pricing] No tier found for group size:", size);
        breakdown = { model: "TIERED", groupSize: size, tier: null, total: 0 };
      }
      break;
    }

    default:
      console.error("[Pricing] Unknown pricing model:", pricingModel);
      breakdown = { model: pricingModel, error: "Unknown pricing model" };
  }

  const perPerson = size > 0 ? Math.round(total / size) : 0;

  return { total, perPerson, breakdown };
}

module.exports = { calculatePrice, PRICING_MODELS };
