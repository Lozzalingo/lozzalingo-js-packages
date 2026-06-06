/**
 * @lozzalingo/calendar - Cross-Brand Availability Service
 *
 * Checks supplier availability across all their calendar events.
 * Works within a single site's database. For true cross-brand blocking,
 * each site syncs the supplier's external calendar (Google/iCal) as the
 * shared source of truth.
 */

/**
 * Check availability for a supplier on a specific date.
 * A supplier is unavailable if ANY of their events on that date
 * has slotStatus of PENCILLED, BLOCKED, or UNAVAILABLE.
 *
 * @param {object} prisma - Prisma client
 * @param {string} modelName - Prisma model name for calendar events
 * @param {string} supplierId - Supplier identity across brands
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @returns {Promise<{ available: boolean, conflicts: Array }>}
 */
async function checkSupplierAvailability(prisma, modelName = "calendarEvent", supplierId, date) {
  try {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

    const events = await prisma[modelName].findMany({
      where: {
        supplierId,
        startTime: { gte: dayStart, lte: dayEnd },
        slotStatus: { in: ["PENCILLED", "BLOCKED", "UNAVAILABLE"] },
      },
    });

    const conflicts = events.map((e) => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      slotStatus: e.slotStatus,
      externalSource: e.externalSource || null,
    }));

    const available = conflicts.length === 0;

    console.log(
      "[Calendar] Supplier availability check:",
      supplierId,
      "on",
      date,
      "-",
      available ? "available" : `${conflicts.length} conflict(s)`
    );

    return { available, conflicts };
  } catch (error) {
    console.error("[Calendar] Failed to check supplier availability:", error.message);
    throw error;
  }
}

/**
 * Get all unavailable dates for a supplier within a range.
 * Used by frontend calendar widgets to grey out dates.
 *
 * @param {object} prisma - Prisma client
 * @param {string} modelName - Prisma model name
 * @param {string} supplierId - Supplier identity
 * @param {string} startDate - ISO date (YYYY-MM-DD)
 * @param {string} endDate - ISO date (YYYY-MM-DD)
 * @returns {Promise<Array<{ date: string, reason: string, source: string }>>}
 */
async function getSupplierUnavailableDates(prisma, modelName = "calendarEvent", supplierId, startDate, endDate) {
  try {
    const rangeStart = new Date(`${startDate}T00:00:00`);
    const rangeEnd = new Date(`${endDate}T23:59:59`);

    const events = await prisma[modelName].findMany({
      where: {
        supplierId,
        startTime: { gte: rangeStart, lte: rangeEnd },
        slotStatus: { in: ["PENCILLED", "BLOCKED", "UNAVAILABLE"] },
      },
      orderBy: { startTime: "asc" },
    });

    const unavailableDates = events.map((e) => ({
      date: e.startTime.toISOString().split("T")[0],
      reason: slotStatusToReason(e.slotStatus),
      source: e.externalSource || "manual",
    }));

    console.log(
      "[Calendar] Supplier unavailable dates:",
      supplierId,
      "from",
      startDate,
      "to",
      endDate,
      "-",
      unavailableDates.length,
      "date(s)"
    );

    return unavailableDates;
  } catch (error) {
    console.error("[Calendar] Failed to get supplier unavailable dates:", error.message);
    throw error;
  }
}

/**
 * Map a slot status to a human-readable reason.
 *
 * @param {string} slotStatus
 * @returns {string}
 */
function slotStatusToReason(slotStatus) {
  switch (slotStatus) {
    case "PENCILLED":
      return "Temporarily held";
    case "BLOCKED":
      return "Booked";
    case "UNAVAILABLE":
      return "Blocked by external calendar";
    default:
      return "Unavailable";
  }
}

module.exports = { checkSupplierAvailability, getSupplierUnavailableDates };
