/**
 * CRM Scoring Service
 *
 * Calculates a marketing score for each customer based on profile completeness,
 * purchase history, engagement signals, and decay over time.
 */

const DEFAULT_WEIGHTS = {
  booking_completed: 20,
  email_opened: 2,
  email_clicked: 5,
  website_visit: 1,
  product_used: 10,
  app_interaction: 5,
  returning_visitor: 5,
  decay_3_months: -5,
  decay_6_months: -10,
  decay_12_months: -15,
};

/**
 * Recalculate the marketing score for a customer.
 *
 * @param {object} prisma - Prisma client
 * @param {string} customerId - Customer ID
 * @param {object} [weights] - Scoring weights (merged with defaults)
 * @param {object} [options] - Additional options
 * @param {string} [options.campaignSendModel] - Model name for campaign sends (default: "campaignSend")
 * @returns {Promise<object|null>} Updated CustomerScore record
 */
async function recalculateScore(prisma, customerId, weights = {}, options = {}) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const campaignSendModel = options.campaignSendModel || "campaignSend";

  try {
    // Fetch the customer with related data
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        activities: { select: { type: true } },
      },
    });

    if (!customer) {
      console.warn(`[CRM] Cannot score unknown customer: ${customerId}`);
      return null;
    }

    // Profile completeness
    let profileScore = 0;
    if (customer.email) profileScore += 5;
    if (customer.phone) profileScore += 5;
    if (customer.company) profileScore += 10;
    if (customer.marketingOptIn) profileScore += 5;

    // Purchase score (cached totalBookings)
    const purchaseScore = customer.totalBookings * w.booking_completed;

    // Referral score
    const advocacyScore = customer.referralName ? 10 : 0;

    // Engagement score from activities
    let engagementScore = 0;
    for (const activity of customer.activities) {
      switch (activity.type) {
        case "GAME_PLAYED":
          engagementScore += w.product_used;
          break;
        case "PRODUCT_USED":
          engagementScore += w.product_used;
          break;
        case "WEBSITE_VISIT":
          engagementScore += w.website_visit;
          break;
        case "APP_INTERACTION":
          engagementScore += w.app_interaction;
          break;
        case "FREE_CONTENT":
          engagementScore += w.product_used;
          break;
        default:
          break;
      }
    }

    // Engagement from campaign sends (opened/clicked)
    try {
      const sends = await prisma[campaignSendModel].findMany({
        where: { customerId },
        select: { opened: true, clicked: true },
      });

      for (const send of sends) {
        if (send.opened) engagementScore += w.email_opened;
        if (send.clicked) engagementScore += w.email_clicked;
      }
    } catch (err) {
      // Campaign send model might not exist on this site
      console.warn("[CRM] Campaign sends not available for scoring:", err.message);
    }

    // Decay based on inactivity
    let decayScore = 0;
    if (customer.lastActivityAt) {
      const now = new Date();
      const monthsInactive = (now - customer.lastActivityAt) / (1000 * 60 * 60 * 24 * 30);

      if (monthsInactive >= 12) {
        decayScore = w.decay_12_months;
      } else if (monthsInactive >= 6) {
        decayScore = w.decay_6_months;
      } else if (monthsInactive >= 3) {
        decayScore = w.decay_3_months;
      }
    }

    // Total score (minimum 0)
    const totalScore = Math.max(0, profileScore + purchaseScore + advocacyScore + engagementScore + decayScore);

    const breakdown = {
      profile: profileScore,
      purchase: purchaseScore,
      advocacy: advocacyScore,
      engagement: engagementScore,
      decay: decayScore,
    };

    // Upsert the score
    const score = await prisma.customerScore.upsert({
      where: { customerId },
      create: {
        customerId,
        score: totalScore,
        breakdown: JSON.stringify(breakdown),
      },
      update: {
        score: totalScore,
        breakdown: JSON.stringify(breakdown),
      },
    });

    console.log(`[CRM] Score recalculated for ${customerId}: ${totalScore} (profile: ${profileScore}, purchase: ${purchaseScore}, engagement: ${engagementScore}, decay: ${decayScore})`);
    return score;
  } catch (error) {
    console.error("[CRM] Failed to recalculate score:", error.message);
    return null;
  }
}

module.exports = { recalculateScore, DEFAULT_WEIGHTS };
