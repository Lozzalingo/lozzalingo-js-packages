/**
 * @lozzalingo/calendar - Slot Lifecycle Service
 *
 * Manages slot states: pencil (temporary hold), block (permanent), release.
 * Slots move through: AVAILABLE -> PENCILLED -> BLOCKED, or back to AVAILABLE.
 */

/**
 * Pencil (temporarily hold) a calendar slot.
 *
 * @param {object} prisma - Prisma client
 * @param {string} modelName - Prisma model name for calendar events
 * @param {string} calendarEventId - ID of the calendar event to pencil
 * @param {string} bookingId - Which booking is holding this slot
 * @param {number} holdHours - Hours to hold (default 24)
 * @returns {Promise<{ success: boolean, slot?: object, expiresAt?: Date, reason?: string }>}
 */
async function pencilSlot(prisma, modelName = "calendarEvent", calendarEventId, bookingId, holdHours = 24) {
  try {
    const slot = await prisma[modelName].findUnique({ where: { id: calendarEventId } });

    if (!slot) {
      console.error("[Calendar] Pencil failed - slot not found:", calendarEventId);
      return { success: false, reason: "Slot not found" };
    }

    if (slot.slotStatus !== "AVAILABLE") {
      console.log("[Calendar] Pencil rejected - slot is", slot.slotStatus, ":", calendarEventId);
      return { success: false, reason: "Slot is not available" };
    }

    const heldUntil = new Date(Date.now() + holdHours * 60 * 60 * 1000);

    const updated = await prisma[modelName].update({
      where: { id: calendarEventId },
      data: {
        slotStatus: "PENCILLED",
        heldUntil,
        heldByBookingId: bookingId,
      },
    });

    console.log("[Calendar] Slot pencilled:", calendarEventId, "until", heldUntil.toISOString(), "for booking", bookingId);
    return { success: true, slot: updated, expiresAt: heldUntil };
  } catch (error) {
    console.error("[Calendar] Failed to pencil slot:", error.message);
    throw error;
  }
}

/**
 * Block a calendar slot permanently (on confirmed payment).
 *
 * @param {object} prisma - Prisma client
 * @param {string} modelName - Prisma model name
 * @param {string} calendarEventId - ID of the calendar event
 * @param {string} bookingId - Which booking is blocking this slot
 * @returns {Promise<{ success: boolean, slot?: object, reason?: string }>}
 */
async function blockSlot(prisma, modelName = "calendarEvent", calendarEventId, bookingId) {
  try {
    const slot = await prisma[modelName].findUnique({ where: { id: calendarEventId } });

    if (!slot) {
      console.error("[Calendar] Block failed - slot not found:", calendarEventId);
      return { success: false, reason: "Slot not found" };
    }

    if (slot.slotStatus !== "AVAILABLE" && slot.slotStatus !== "PENCILLED") {
      console.log("[Calendar] Block rejected - slot is", slot.slotStatus, ":", calendarEventId);
      return { success: false, reason: "Slot is not available or pencilled" };
    }

    // If pencilled, verify the hold belongs to this booking (or allow override)
    if (slot.slotStatus === "PENCILLED" && slot.heldByBookingId && slot.heldByBookingId !== bookingId) {
      console.log("[Calendar] Block override - slot was pencilled by", slot.heldByBookingId, "but blocked by", bookingId);
    }

    const updated = await prisma[modelName].update({
      where: { id: calendarEventId },
      data: {
        slotStatus: "BLOCKED",
        blockedByBookingId: bookingId,
        heldUntil: null,
        heldByBookingId: null,
      },
    });

    console.log("[Calendar] Slot blocked:", calendarEventId, "by booking", bookingId);
    return { success: true, slot: updated };
  } catch (error) {
    console.error("[Calendar] Failed to block slot:", error.message);
    throw error;
  }
}

/**
 * Release a slot back to available (pencil expired or booking cancelled).
 *
 * @param {object} prisma - Prisma client
 * @param {string} modelName - Prisma model name
 * @param {string} calendarEventId - ID of the calendar event
 * @returns {Promise<{ success: boolean, slot?: object, reason?: string }>}
 */
async function releaseSlot(prisma, modelName = "calendarEvent", calendarEventId) {
  try {
    const slot = await prisma[modelName].findUnique({ where: { id: calendarEventId } });

    if (!slot) {
      console.error("[Calendar] Release failed - slot not found:", calendarEventId);
      return { success: false, reason: "Slot not found" };
    }

    const updated = await prisma[modelName].update({
      where: { id: calendarEventId },
      data: {
        slotStatus: "AVAILABLE",
        heldUntil: null,
        heldByBookingId: null,
        blockedByBookingId: null,
      },
    });

    console.log("[Calendar] Slot released:", calendarEventId);
    return { success: true, slot: updated };
  } catch (error) {
    console.error("[Calendar] Failed to release slot:", error.message);
    throw error;
  }
}

/**
 * Find all pencilled slots past their heldUntil time.
 *
 * @param {object} prisma - Prisma client
 * @param {string} modelName - Prisma model name
 * @returns {Promise<Array>} Expired pencilled slots
 */
async function getExpiredPencils(prisma, modelName = "calendarEvent") {
  try {
    const expired = await prisma[modelName].findMany({
      where: {
        slotStatus: "PENCILLED",
        heldUntil: { lt: new Date() },
      },
    });

    console.log("[Calendar] Found", expired.length, "expired pencilled slots");
    return expired;
  } catch (error) {
    console.error("[Calendar] Failed to fetch expired pencils:", error.message);
    throw error;
  }
}

/**
 * Release all expired pencilled slots.
 *
 * @param {object} prisma - Prisma client
 * @param {string} modelName - Prisma model name
 * @returns {Promise<{ released: number, slots: Array }>}
 */
async function releaseExpiredPencils(prisma, modelName = "calendarEvent") {
  try {
    const expired = await getExpiredPencils(prisma, modelName);
    const released = [];

    for (const slot of expired) {
      const result = await releaseSlot(prisma, modelName, slot.id);
      if (result.success) {
        released.push(result.slot);
      }
    }

    console.log("[Calendar] Released", released.length, "expired pencilled slots");
    return { released: released.length, slots: released };
  } catch (error) {
    console.error("[Calendar] Failed to release expired pencils:", error.message);
    throw error;
  }
}

module.exports = {
  pencilSlot,
  blockSlot,
  releaseSlot,
  getExpiredPencils,
  releaseExpiredPencils,
};
