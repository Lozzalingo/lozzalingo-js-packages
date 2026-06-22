/**
 * @lozzalingo/crm - Controller
 *
 * Factory function that creates a CRM controller with all CRM operations.
 * Follows the same pattern as @lozzalingo/bookings controller.
 */

const { findOrCreateCustomer } = require("./services/customer");
const { recordActivity } = require("./services/activity");
const { recalculateScore } = require("./services/scoring");
const { recordCampaignSend, updateCampaignSend } = require("./services/campaign");
const { getNextCustomerNumber } = require("./services/customer-number");

/**
 * Create a CRM controller.
 *
 * @param {object} prisma - Prisma client
 * @param {object} [options]
 * @param {string} [options.customerPrefix] - Brand prefix for customer numbers, e.g. "BR"
 * @param {object} [options.scoring] - Scoring weights override
 * @param {string} [options.campaignModel] - Prisma model name for campaigns (default: "campaign")
 * @param {string} [options.campaignSendModel] - Prisma model name for campaign sends (default: "campaignSend")
 * @returns {object} CRM controller
 */
function createCrmController(prisma, options = {}) {
  const {
    customerPrefix = "LZ",
    scoring = {},
    campaignModel = "campaign",
    campaignSendModel = "campaignSend",
  } = options;

  console.log(`[CRM] Initialising CRM controller (prefix: ${customerPrefix})`);

  return {
    /**
     * Find or create a customer by email. CRM-aware with extended fields.
     */
    findOrCreateCustomer: (params) =>
      findOrCreateCustomer(prisma, { ...params, customerPrefix }),

    /**
     * Record a customer activity (game played, product used, site visit, etc.)
     */
    recordActivity: (customerId, data) =>
      recordActivity(prisma, customerId, data),

    /**
     * Recalculate the marketing score for a customer.
     */
    recalculateScore: (customerId) =>
      recalculateScore(prisma, customerId, scoring, { campaignSendModel }),

    /**
     * Record a campaign send to a customer.
     */
    recordCampaignSend: (campaignId, customerId) =>
      recordCampaignSend(prisma, campaignId, customerId, { campaignModel, campaignSendModel }),

    /**
     * Update a campaign send (opened, clicked).
     */
    updateCampaignSend: (sendId, data) =>
      updateCampaignSend(prisma, sendId, data, { campaignModel, campaignSendModel }),

    /**
     * Get the next customer number for this brand.
     */
    getNextCustomerNumber: () =>
      getNextCustomerNumber(prisma, customerPrefix),
  };
}

module.exports = { createCrmController };
