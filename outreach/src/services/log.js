/**
 * @lozzalingo/outreach - Log Service
 * Outreach history for admin dashboards and Mission Ctrl.
 */

/**
 * Get outreach log entries.
 * @param {object} prisma
 * @param {object} filters
 * @param {string} filters.bookingId
 * @param {string} filters.email
 * @param {string} filters.trigger
 * @param {string} filters.status
 * @param {string} filters.dateFrom
 * @param {string} filters.dateTo
 * @param {number} filters.page
 * @param {number} filters.limit
 * @returns {Promise<{ data: Array, pagination: object }>}
 */
async function getOutreachLog(prisma, filters = {}) {
  try {
    const {
      bookingId,
      email,
      trigger,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = filters;

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (bookingId) where.bookingId = bookingId;
    if (email) where.recipientEmail = email;
    if (trigger) where.trigger = trigger;
    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.sentAt = {};
      if (dateFrom) where.sentAt.gte = new Date(dateFrom);
      if (dateTo) where.sentAt.lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      prisma.outreachLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { sentAt: "desc" },
      }),
      prisma.outreachLog.count({ where }),
    ]);

    console.log("[Outreach] Fetched", data.length, "log entries");

    return {
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  } catch (error) {
    console.error("[Outreach] Failed to fetch outreach log:", error.message);
    throw error;
  }
}

/**
 * Get scheduled outreach (pending and sent).
 * @param {object} prisma
 * @param {object} filters - Same as getOutreachLog + scheduledFor date range
 * @returns {Promise<{ data: Array, pagination: object }>}
 */
async function getScheduledOutreach(prisma, filters = {}) {
  try {
    const {
      bookingId,
      email,
      trigger,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = filters;

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (bookingId) where.bookingId = bookingId;
    if (email) where.recipientEmail = email;
    if (trigger) where.trigger = trigger;
    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.scheduledFor = {};
      if (dateFrom) where.scheduledFor.gte = new Date(dateFrom);
      if (dateTo) where.scheduledFor.lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      prisma.outreachSchedule.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { scheduledFor: "asc" },
      }),
      prisma.outreachSchedule.count({ where }),
    ]);

    console.log("[Outreach] Fetched", data.length, "scheduled entries");

    return {
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  } catch (error) {
    console.error("[Outreach] Failed to fetch scheduled outreach:", error.message);
    throw error;
  }
}

module.exports = { getOutreachLog, getScheduledOutreach };
