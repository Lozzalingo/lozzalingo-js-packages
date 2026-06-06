/**
 * @lozzalingo/calendar - iCal Feed Service
 *
 * Generates .ics feeds (RFC 5545) from calendar events.
 * No external dependencies — builds iCal text manually.
 */

/**
 * Format a Date as iCal DTSTART value (UTC).
 *
 * @param {Date} date
 * @returns {string} e.g. "20260315T140000Z"
 */
function formatICalDate(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Escape text for iCal values.
 */
function escapeICalText(text) {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Generate a UID for an event.
 */
function generateUID(eventId, domain) {
  return `${eventId}@${domain}`;
}

/**
 * Build a single VEVENT block.
 *
 * @param {object} event - Calendar event
 * @param {string} domain - Domain for UID generation
 * @returns {string} VEVENT text
 */
function buildVEvent(event, domain) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${generateUID(event.id, domain)}`,
    `DTSTART:${formatICalDate(event.startTime)}`,
    `DTEND:${formatICalDate(event.endTime)}`,
    `SUMMARY:${escapeICalText(event.title)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  }

  if (event.locationName) {
    lines.push(`LOCATION:${escapeICalText(event.locationName)}`);
  }

  if (event.meetingUrl) {
    lines.push(`URL:${event.meetingUrl}`);
  }

  if (event.status === "CANCELLED") {
    lines.push("STATUS:CANCELLED");
  } else {
    lines.push("STATUS:CONFIRMED");
  }

  lines.push(`DTSTAMP:${formatICalDate(new Date())}`);
  lines.push("END:VEVENT");

  return lines.join("\r\n");
}

/**
 * Generate a complete iCal (.ics) feed from calendar events.
 *
 * @param {Array} events - Array of calendar events
 * @param {object} options
 * @param {string} options.calendarName - Display name
 * @param {string} options.domain - Domain for UIDs (e.g. "bucketrace.com")
 * @returns {string} Complete .ics file content
 */
function generateICalFeed(events, options = {}) {
  const { calendarName = "Events", domain = "lozzalingo.com" } = options;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Lozzalingo//${calendarName}//EN`,
    `X-WR-CALNAME:${calendarName}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    lines.push(buildVEvent(event, domain));
  }

  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

module.exports = { generateICalFeed, formatICalDate, escapeICalText };
