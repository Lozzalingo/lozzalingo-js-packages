/**
 * Booking statuses.
 * Used for validation on status update endpoints.
 */
const BOOKING_STATUSES = [
  "ENQUIRY",
  "INVOICE_SENT",
  "CONFIRMED",
  "DEPOSIT_PAID",
  "PAID",
  "COMPLETED",
  "LOST",
  "QUALIFIED_OUT",
  "CANCELLED",
];

/**
 * Check if a status string is a valid booking status.
 * @param {string} status
 * @returns {boolean}
 */
function isValidStatus(status) {
  return BOOKING_STATUSES.includes(status);
}

module.exports = { BOOKING_STATUSES, isValidStatus };
