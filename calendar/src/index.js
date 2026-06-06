/**
 * @lozzalingo/calendar - Barrel Export
 */

const { createCalendarRoutes } = require("./routes");
const { createCalendarController } = require("./controller");
const { checkAvailability, getAvailabilityLabel, getAvailableSlots } = require("./services/availability");
const { parseRRule, generateOccurrences, expandRecurringEvent } = require("./services/recurring");
const { generateICalFeed, formatICalDate } = require("./services/ical");
const { pencilSlot, blockSlot, releaseSlot, getExpiredPencils, releaseExpiredPencils } = require("./services/slots");
const { syncFromGoogle, syncFromICal } = require("./services/sync");
const { checkSupplierAvailability, getSupplierUnavailableDates } = require("./services/cross-brand");
const { getAvailableTimeSlots, checkTimeWindowAvailable, createAndBlockSlot, generatePossibleSlots } = require("./services/time-slots");

module.exports = {
  // Route factory
  createCalendarRoutes,

  // Controller factory
  createCalendarController,

  // Availability
  checkAvailability,
  getAvailabilityLabel,
  getAvailableSlots,

  // Recurring events
  parseRRule,
  generateOccurrences,
  expandRecurringEvent,

  // iCal
  generateICalFeed,
  formatICalDate,

  // Slots
  pencilSlot,
  blockSlot,
  releaseSlot,
  getExpiredPencils,
  releaseExpiredPencils,

  // Sync
  syncFromGoogle,
  syncFromICal,

  // Cross-brand
  checkSupplierAvailability,
  getSupplierUnavailableDates,

  // Time slots (duration-aware)
  getAvailableTimeSlots,
  checkTimeWindowAvailable,
  createAndBlockSlot,
  generatePossibleSlots,
};
