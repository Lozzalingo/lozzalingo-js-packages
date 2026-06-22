/**
 * CRM Campaign Service
 *
 * Records campaign sends and tracks opens/clicks.
 */

/**
 * Record a campaign send to a customer.
 *
 * @param {object} prisma - Prisma client
 * @param {string} campaignId - Campaign ID
 * @param {string} customerId - Customer ID
 * @param {object} [options] - Additional options
 * @param {string} [options.campaignModel] - Model name (default: "campaign")
 * @param {string} [options.campaignSendModel] - Model name (default: "campaignSend")
 * @returns {Promise<object|null>} Created CampaignSend record
 */
async function recordCampaignSend(prisma, campaignId, customerId, options = {}) {
  const campaignModel = options.campaignModel || "campaign";
  const campaignSendModel = options.campaignSendModel || "campaignSend";

  try {
    const send = await prisma[campaignSendModel].create({
      data: {
        campaignId,
        customerId,
        sentAt: new Date(),
      },
    });

    // Increment totalSent on the campaign
    await prisma[campaignModel].update({
      where: { id: campaignId },
      data: { totalSent: { increment: 1 } },
    });

    console.log(`[CRM] Recorded campaign send: campaign ${campaignId} to customer ${customerId}`);
    return send;
  } catch (error) {
    console.error("[CRM] Failed to record campaign send:", error.message);
    return null;
  }
}

/**
 * Update a campaign send with open/click tracking.
 *
 * @param {object} prisma - Prisma client
 * @param {string} sendId - CampaignSend ID
 * @param {object} data - Update data
 * @param {boolean} [data.opened] - Mark as opened
 * @param {boolean} [data.clicked] - Mark as clicked
 * @param {object} [options] - Additional options
 * @param {string} [options.campaignModel] - Model name (default: "campaign")
 * @param {string} [options.campaignSendModel] - Model name (default: "campaignSend")
 * @returns {Promise<object|null>} Updated CampaignSend record
 */
async function updateCampaignSend(prisma, sendId, data, options = {}) {
  const campaignModel = options.campaignModel || "campaign";
  const campaignSendModel = options.campaignSendModel || "campaignSend";

  try {
    const existing = await prisma[campaignSendModel].findUnique({ where: { id: sendId } });
    if (!existing) {
      console.warn(`[CRM] Campaign send not found: ${sendId}`);
      return null;
    }

    const updates = {};

    if (data.opened && !existing.opened) {
      updates.opened = true;
      updates.openedAt = new Date();

      // Increment totalOpened on the campaign
      await prisma[campaignModel].update({
        where: { id: existing.campaignId },
        data: { totalOpened: { increment: 1 } },
      });
    }

    if (data.clicked && !existing.clicked) {
      updates.clicked = true;
      updates.clickedAt = new Date();

      // Increment totalClicked on the campaign
      await prisma[campaignModel].update({
        where: { id: existing.campaignId },
        data: { totalClicked: { increment: 1 } },
      });
    }

    if (Object.keys(updates).length === 0) return existing;

    const send = await prisma[campaignSendModel].update({
      where: { id: sendId },
      data: updates,
    });

    console.log(`[CRM] Updated campaign send ${sendId}: ${Object.keys(updates).join(", ")}`);
    return send;
  } catch (error) {
    console.error("[CRM] Failed to update campaign send:", error.message);
    return null;
  }
}

module.exports = { recordCampaignSend, updateCampaignSend };
