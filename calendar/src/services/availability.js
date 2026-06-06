/**
 * @lozzalingo/calendar - Availability Service
 *
 * Checks slot availability, prevents double-booking, and calculates remaining capacity.
 */

/**
 * Check if a calendar event has availability for the requested group size.
 *
 * @param {object} calendarEvent - The calendar event record from DB
 * @param {number} requestedSize - Number of spots requested
 * @returns {{ available: boolean, remaining: number, reason?: string }}
 */
function checkAvailability(calendarEvent, requestedSize = 1) {
  if (!calendarEvent) {
    return { available: false, remaining: 0, reason: "Event not found" };
  }

  if (calendarEvent.status === "CANCELLED") {
    return { available: false, remaining: 0, reason: "Event is cancelled" };
  }

  if (calendarEvent.status === "COMPLETED") {
    return { available: false, remaining: 0, reason: "Event has ended" };
  }

  if (calendarEvent.status === "FULL") {
    return { available: false, remaining: 0, reason: "Event is full" };
  }

  if (calendarEvent.status === "DRAFT") {
    return { available: false, remaining: 0, reason: "Event is not yet published" };
  }

  // Check if event is in the past
  const now = new Date();
  if (new Date(calendarEvent.startTime) < now) {
    return { available: false, remaining: 0, reason: "Event has already started" };
  }

  // Unlimited capacity
  if (!calendarEvent.maxCapacity) {
    return { available: true, remaining: Infinity };
  }

  const remaining = calendarEvent.maxCapacity - (calendarEvent.currentBookings || 0);

  if (remaining <= 0) {
    return { available: false, remaining: 0, reason: "No spots remaining" };
  }

  if (requestedSize > remaining) {
    return {
      available: false,
      remaining,
      reason: `Only ${remaining} spot${remaining === 1 ? "" : "s"} remaining`,
    };
  }

  return { available: true, remaining };
}

/**
 * Get availability label for display.
 *
 * @param {object} calendarEvent
 * @returns {{ label: string, variant: string }}
 */
function getAvailabilityLabel(calendarEvent) {
  if (!calendarEvent || calendarEvent.status === "CANCELLED") {
    return { label: "Cancelled", variant: "error" };
  }

  if (calendarEvent.status === "COMPLETED") {
    return { label: "Completed", variant: "neutral" };
  }

  if (calendarEvent.status === "DRAFT") {
    return { label: "Coming Soon", variant: "neutral" };
  }

  if (!calendarEvent.maxCapacity) {
    return { label: "Available", variant: "success" };
  }

  const remaining = calendarEvent.maxCapacity - (calendarEvent.currentBookings || 0);
  const pctFull = ((calendarEvent.currentBookings || 0) / calendarEvent.maxCapacity) * 100;

  if (remaining <= 0 || calendarEvent.status === "FULL") {
    return { label: "Sold Out", variant: "error" };
  }

  if (pctFull >= 80) {
    return { label: `${remaining} spot${remaining === 1 ? "" : "s"} left`, variant: "warning" };
  }

  return { label: "Available", variant: "success" };
}

/**
 * Get available slots for a date from a list of calendar events.
 *
 * @param {Array} events - Calendar events for the day
 * @param {number} groupSize - Requested group size
 * @returns {Array} Available events with availability info
 */
function getAvailableSlots(events, groupSize = 1) {
  return events
    .map((event) => {
      const avail = checkAvailability(event, groupSize);
      return {
        ...event,
        availability: avail,
        displayLabel: getAvailabilityLabel(event),
      };
    })
    .filter((e) => e.availability.available || e.availability.remaining > 0);
}

module.exports = { checkAvailability, getAvailabilityLabel, getAvailableSlots };
