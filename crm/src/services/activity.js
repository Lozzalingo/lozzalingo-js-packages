/**
 * CRM Activity Service
 *
 * Records customer interactions (games played, products used, site visits, etc.)
 * into the CustomerActivity table.
 */

/**
 * Record a customer activity.
 *
 * @param {object} prisma - Prisma client
 * @param {string} customerId - Customer ID
 * @param {object} data - Activity data
 * @param {string} data.type - ActivityType enum value
 * @param {string} [data.source] - "website", "etsy", "app", etc.
 * @param {string} [data.channel] - "Website Sign Up", "Etsy Store", etc.
 * @param {string} [data.productRef] - ID from site-specific product table
 * @param {string} [data.productModel] - "Event", "Product", "MerchProduct"
 * @param {string} [data.productName] - Denormalised name
 * @param {string} [data.productCategory] - "Scavenger Hunt", "Printable Quiz", etc.
 * @param {string} [data.platform] - "Virtual", "Real-World", "Hybrid"
 * @param {string} [data.groupType] - "Corporate", "Private", "Public"
 * @param {string} [data.audience] - "Adult", "Children", "Mixed"
 * @param {string} [data.location]
 * @param {string} [data.region]
 * @param {string} [data.country]
 * @param {string} [data.teamName]
 * @param {Date} [data.eventDate]
 * @param {object} [data.metadata] - Additional JSON data
 * @returns {Promise<object>} Created activity record
 */
async function recordActivity(prisma, customerId, data) {
  if (!customerId) {
    console.warn("[CRM] recordActivity called without customerId, skipping");
    return null;
  }

  try {
    const activity = await prisma.customerActivity.create({
      data: {
        customerId,
        type: data.type,
        source: data.source || null,
        channel: data.channel || null,
        productRef: data.productRef || null,
        productModel: data.productModel || null,
        productName: data.productName || null,
        productCategory: data.productCategory || null,
        platform: data.platform || null,
        groupType: data.groupType || null,
        audience: data.audience || null,
        location: data.location || null,
        region: data.region || null,
        country: data.country || null,
        teamName: data.teamName || null,
        eventDate: data.eventDate || null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });

    // Update lastActivityAt on the customer
    await prisma.customer.update({
      where: { id: customerId },
      data: { lastActivityAt: new Date() },
    });

    console.log(`[CRM] Recorded ${data.type} activity for customer ${customerId}`);
    return activity;
  } catch (error) {
    console.error("[CRM] Failed to record activity:", error.message);
    return null;
  }
}

module.exports = { recordActivity };
