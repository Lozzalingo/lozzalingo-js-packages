/**
 * @lozzalingo/calendar - Time Slot Service
 *
 * Duration-aware availability. Given a date, duration, and operating hours,
 * calculates which start times are free by checking for overlapping
 * blocked/pencilled calendar events.
 *
 * Used by private booking flows where the customer chooses a duration
 * and the system shows available start times for that day.
 */

/**
 * Default operating hours (can be overridden per site).
 */
const DEFAULT_OPERATING_HOURS = {
  start: 9,  // 09:00
  end: 20,   // 20:00 (last event must finish by this time)
};

/**
 * Default slot interval in minutes.
 * Start times are generated every N minutes within operating hours.
 */
const DEFAULT_SLOT_INTERVAL = 30;

/**
 * Travel buffer in minutes added either side of a blocked slot.
 * Ensures hosts have travel time between back-to-back bookings.
 * This is operational only - customers never see the buffer.
 */
const DEFAULT_TRAVEL_BUFFER = 30;

/**
 * Generate all possible start times for a given date, duration, and operating hours.
 *
 * @param {string} dateStr - Date string YYYY-MM-DD
 * @param {number} durationMinutes - Requested duration in minutes (e.g. 120, 150, 180)
 * @param {object} [operatingHours] - { start: 9, end: 20 }
 * @param {number} [intervalMinutes] - Gap between start time options (default 30)
 * @param {string} [timezone] - Timezone (default Europe/London)
 * @returns {Array<{ startTime: Date, endTime: Date, label: string }>}
 */
function generatePossibleSlots(dateStr, durationMinutes, operatingHours, intervalMinutes, timezone) {
  const hours = operatingHours || DEFAULT_OPERATING_HOURS;
  const interval = intervalMinutes || DEFAULT_SLOT_INTERVAL;

  const slots = [];

  // Build start/end boundaries for the day
  const dayStart = new Date(`${dateStr}T${String(hours.start).padStart(2, "0")}:00:00`);
  const dayEnd = new Date(`${dateStr}T${String(hours.end).padStart(2, "0")}:00:00`);

  let cursor = new Date(dayStart);

  while (cursor.getTime() + durationMinutes * 60 * 1000 <= dayEnd.getTime()) {
    const startTime = new Date(cursor);
    const endTime = new Date(cursor.getTime() + durationMinutes * 60 * 1000);

    const startHour = String(startTime.getHours()).padStart(2, "0");
    const startMin = String(startTime.getMinutes()).padStart(2, "0");
    const endHour = String(endTime.getHours()).padStart(2, "0");
    const endMin = String(endTime.getMinutes()).padStart(2, "0");

    slots.push({
      startTime,
      endTime,
      label: `${startHour}:${startMin} - ${endHour}:${endMin}`,
    });

    cursor = new Date(cursor.getTime() + interval * 60 * 1000);
  }

  return slots;
}

/**
 * Check if two time ranges overlap.
 *
 * @param {Date} startA
 * @param {Date} endA
 * @param {Date} startB
 * @param {Date} endB
 * @returns {boolean}
 */
function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

/**
 * Get available time slots for a date, filtering out times that overlap
 * with existing blocked or pencilled calendar events.
 *
 * @param {object} prisma - Prisma client
 * @param {string} dateStr - Date YYYY-MM-DD
 * @param {number} durationMinutes - Requested duration in minutes
 * @param {object} [options]
 * @param {string} [options.modelName] - Prisma model name (default "calendarEvent")
 * @param {object} [options.operatingHours] - { start: 9, end: 20 }
 * @param {number} [options.intervalMinutes] - Slot interval (default 30)
 * @param {string} [options.timezone] - Timezone
 * @param {string} [options.productId] - Filter by product
 * @param {string} [options.supplierId] - Filter by supplier (cross-brand)
 * @param {number} [options.travelBufferMinutes] - Buffer either side of blocked slots (default 30)
 * @returns {Promise<Array<{ startTime: Date, endTime: Date, label: string, available: boolean }>>}
 */
async function getAvailableTimeSlots(prisma, dateStr, durationMinutes, options = {}) {
  const {
    modelName = "calendarEvent",
    operatingHours,
    intervalMinutes,
    timezone,
    productId,
    supplierId,
    travelBufferMinutes = DEFAULT_TRAVEL_BUFFER,
  } = options;

  console.log(`[Calendar] Checking time slots for ${dateStr}, duration ${durationMinutes}m`);

  // 1. Generate all possible start times for the day
  const possibleSlots = generatePossibleSlots(dateStr, durationMinutes, operatingHours, intervalMinutes, timezone);

  if (possibleSlots.length === 0) {
    console.log("[Calendar] No possible slots within operating hours");
    return [];
  }

  // 2. Fetch all blocked/pencilled events for the day (any that overlap the operating window)
  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59`);

  const where = {
    status: { not: "CANCELLED" },
    startTime: { lte: dayEnd },
    endTime: { gte: dayStart },
    OR: [
      { slotStatus: "BLOCKED" },
      { slotStatus: "PENCILLED" },
    ],
  };

  if (productId) where.productId = productId;
  if (supplierId) where.supplierId = supplierId;

  let blockedEvents = [];
  try {
    blockedEvents = await prisma[modelName].findMany({ where });
  } catch (error) {
    console.error("[Calendar] Failed to fetch blocked events:", error.message);
    return possibleSlots.map((s) => ({ ...s, available: true }));
  }

  console.log(`[Calendar] Found ${blockedEvents.length} blocked/pencilled events on ${dateStr}`);

  // Look up linked bookings to get their buffer settings
  const bookingIds = blockedEvents.map((e) => e.blockedByBookingId).filter(Boolean);
  let bookingBuffers = {};
  if (bookingIds.length > 0) {
    try {
      const bookings = await prisma.booking.findMany({
        where: { id: { in: bookingIds } },
        select: { id: true, bufferHours: true, timeBlocking: true },
      });
      for (const b of bookings) {
        bookingBuffers[b.id] = b;
      }
    } catch (error) {
      console.error("[Calendar] Failed to fetch booking buffers:", error.message);
    }
  }

  const defaultBufferMs = travelBufferMinutes * 60 * 1000;

  // 3. Filter: CalendarEvent stores the event time. Buffer comes from the
  //    linked Booking's bufferHours field. Combine them at query time.
  const results = possibleSlots.map((slot) => {
    const overlaps = blockedEvents.some((event) => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);

      // Pull buffer from the linked booking
      const linked = event.blockedByBookingId ? bookingBuffers[event.blockedByBookingId] : null;
      const mode = linked?.timeBlocking || "buffer";

      if (mode === "none") {
        return rangesOverlap(slot.startTime, slot.endTime, eventStart, eventEnd);
      }

      if (mode === "whole-day") {
        const dayOpen = new Date(`${dateStr}T${String(operatingHours?.start || 9).padStart(2, "0")}:00:00`);
        const dayClose = new Date(`${dateStr}T${String(operatingHours?.end || 20).padStart(2, "0")}:00:00`);
        return rangesOverlap(slot.startTime, slot.endTime, dayOpen, dayClose);
      }

      // "buffer" mode - bufferHours is a legacy field that stores minutes.
      const bufferMs = linked?.bufferHours != null
        ? linked.bufferHours * 60 * 1000
        : defaultBufferMs;
      const bufferedStart = new Date(eventStart.getTime() - bufferMs);
      const bufferedEnd = new Date(eventEnd.getTime() + bufferMs);
      return rangesOverlap(slot.startTime, slot.endTime, bufferedStart, bufferedEnd);
    });

    return {
      ...slot,
      available: !overlaps,
    };
  });

  const availableCount = results.filter((r) => r.available).length;
  console.log(`[Calendar] ${availableCount}/${results.length} time slots available on ${dateStr}`);

  return results;
}

/**
 * Check if a specific time window is available (no overlapping blocked/pencilled events).
 *
 * @param {object} prisma - Prisma client
 * @param {Date} startTime
 * @param {Date} endTime
 * @param {object} [options]
 * @param {string} [options.modelName]
 * @param {string} [options.excludeBookingId] - Exclude a specific booking (for rebooking)
 * @param {number} [options.travelBufferMinutes] - Buffer either side (default 30)
 * @returns {Promise<{ available: boolean, conflicts: Array }>}
 */
async function checkTimeWindowAvailable(prisma, startTime, endTime, options = {}) {
  const { modelName = "calendarEvent", excludeBookingId, travelBufferMinutes = DEFAULT_TRAVEL_BUFFER } = options;

  // Widen the query window to catch events whose buffer might overlap
  const maxBufferMs = 4 * 60 * 60 * 1000; // 4h max to catch any reasonable buffer
  const queryStart = new Date(new Date(startTime).getTime() - maxBufferMs);
  const queryEnd = new Date(new Date(endTime).getTime() + maxBufferMs);

  const where = {
    status: { not: "CANCELLED" },
    startTime: { lt: queryEnd },
    endTime: { gt: queryStart },
    OR: [
      { slotStatus: "BLOCKED" },
      { slotStatus: "PENCILLED" },
    ],
  };

  if (excludeBookingId) {
    where.blockedByBookingId = { not: excludeBookingId };
  }

  try {
    const events = await prisma[modelName].findMany({ where });

    // Look up linked bookings for buffer settings
    const bookingIds = events.map((e) => e.blockedByBookingId).filter(Boolean);
    let bookingBuffers = {};
    if (bookingIds.length > 0) {
      try {
        const bookings = await prisma.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { id: true, bufferHours: true, timeBlocking: true },
        });
        for (const b of bookings) {
          bookingBuffers[b.id] = b;
        }
      } catch (err) {
        console.error("[Calendar] Failed to fetch booking buffers:", err.message);
      }
    }

    const defaultBufferMs = travelBufferMinutes * 60 * 1000;
    const checkStart = new Date(startTime);
    const checkEnd = new Date(endTime);

    // Check each event with its booking's buffer applied
    const conflicts = events.filter((event) => {
      const evStart = new Date(event.startTime);
      const evEnd = new Date(event.endTime);
      const linked = event.blockedByBookingId ? bookingBuffers[event.blockedByBookingId] : null;
      const mode = linked?.timeBlocking || "buffer";

      if (mode === "none") {
        return rangesOverlap(checkStart, checkEnd, evStart, evEnd);
      }

      const bufferMs = linked?.bufferHours != null
        ? linked.bufferHours * 60 * 1000
        : defaultBufferMs;
      const bufferedStart = new Date(evStart.getTime() - bufferMs);
      const bufferedEnd = new Date(evEnd.getTime() + bufferMs);
      return rangesOverlap(checkStart, checkEnd, bufferedStart, bufferedEnd);
    });

    if (conflicts.length > 0) {
      console.log(`[Calendar] Time window conflict: ${conflicts.length} overlapping events`);
    }

    return {
      available: conflicts.length === 0,
      conflicts,
    };
  } catch (error) {
    console.error("[Calendar] Failed to check time window:", error.message);
    return { available: false, conflicts: [] };
  }
}

/**
 * Time blocking modes (admin-configurable per booking):
 * - "none"      Event time only, no buffer
 * - "buffer"    Event time + travel buffer either side (default)
 * - "whole-day" Block the entire day (09:00-20:00)
 */
const TIME_BLOCKING_MODES = ["none", "buffer", "whole-day"];

/**
 * Create and block a calendar event for a booking with a specific time window.
 * Supports different time blocking modes set by the admin.
 *
 * @param {object} prisma - Prisma client
 * @param {object} params
 * @param {string} params.title - Event title
 * @param {Date} params.startTime
 * @param {Date} params.endTime
 * @param {string} params.bookingId
 * @param {string} [params.productId]
 * @param {string} [params.locationName]
 * @param {string} [params.timeBlockingMode] - "none" | "buffer" | "whole-day" (default "buffer")
 * @param {object} [options]
 * @param {string} [options.modelName]
 * @param {number} [options.travelBufferMinutes]
 * @param {object} [options.operatingHours]
 * @returns {Promise<{ success: boolean, slot?: object, reason?: string }>}
 */
async function createAndBlockSlot(prisma, params, options = {}) {
  const { modelName = "calendarEvent", travelBufferMinutes = DEFAULT_TRAVEL_BUFFER, operatingHours } = options;
  const { title, startTime, endTime, bookingId, productId, locationName, timeBlockingMode = "buffer" } = params;
  const hours = operatingHours || DEFAULT_OPERATING_HOURS;

  try {
    const eventStart = new Date(startTime);
    const eventEnd = new Date(endTime);

    console.log(`[Calendar] Creating slot: ${eventStart.toISOString()} - ${eventEnd.toISOString()} for booking ${bookingId}`);

    // Check availability with buffer applied
    const check = await checkTimeWindowAvailable(prisma, eventStart, eventEnd, {
      ...options,
      travelBufferMinutes,
    });
    if (!check.available) {
      console.log(`[Calendar] Cannot create slot - time window has ${check.conflicts.length} conflicts`);
      return { success: false, reason: "Time window is not available" };
    }

    // Store the event time only - buffer is on the Booking and applied at query time
    const slot = await prisma[modelName].create({
      data: {
        title,
        startTime: eventStart,
        endTime: eventEnd,
        timezone: "Europe/London",
        slotStatus: "BLOCKED",
        blockedByBookingId: bookingId,
        productId: productId || null,
        locationName: locationName || null,
        status: "SCHEDULED",
        isPublic: false,
        maxCapacity: 1,
        currentBookings: 1,
      },
    });

    console.log(`[Calendar] Created slot: ${slot.id} for booking ${bookingId}`);
    return { success: true, slot };
  } catch (error) {
    console.error("[Calendar] Failed to create and block slot:", error.message);
    return { success: false, reason: error.message };
  }
}

module.exports = {
  generatePossibleSlots,
  rangesOverlap,
  getAvailableTimeSlots,
  checkTimeWindowAvailable,
  createAndBlockSlot,
  DEFAULT_OPERATING_HOURS,
  DEFAULT_SLOT_INTERVAL,
  DEFAULT_TRAVEL_BUFFER,
  TIME_BLOCKING_MODES,
};
