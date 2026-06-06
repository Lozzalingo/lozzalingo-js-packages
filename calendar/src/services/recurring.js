/**
 * @lozzalingo/calendar - Recurring Events Service
 *
 * Generates instances from recurrence rules (simplified RRULE support).
 * We don't pull in the full RFC 5545 library — just handle the common cases:
 *   FREQ=DAILY|WEEKLY|MONTHLY, INTERVAL, COUNT, UNTIL, BYDAY
 */

const DAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/**
 * Parse a simplified RRULE string.
 *
 * @param {string} rrule - e.g. "FREQ=WEEKLY;BYDAY=SA;COUNT=12"
 * @returns {object} Parsed components
 */
function parseRRule(rrule) {
  if (!rrule) return null;
  const parts = {};
  rrule.split(";").forEach((segment) => {
    const [key, val] = segment.split("=");
    parts[key] = val;
  });

  return {
    freq: parts.FREQ || "WEEKLY",
    interval: parseInt(parts.INTERVAL || "1"),
    count: parts.COUNT ? parseInt(parts.COUNT) : null,
    until: parts.UNTIL ? parseRRuleDate(parts.UNTIL) : null,
    byDay: parts.BYDAY ? parts.BYDAY.split(",") : null,
  };
}

function parseRRuleDate(str) {
  // Format: YYYYMMDD or YYYYMMDDTHHMMSSZ
  const y = parseInt(str.slice(0, 4));
  const m = parseInt(str.slice(4, 6)) - 1;
  const d = parseInt(str.slice(6, 8));
  return new Date(y, m, d, 23, 59, 59);
}

/**
 * Generate occurrence dates from a start date and recurrence rule.
 *
 * @param {Date} startDate - First occurrence
 * @param {string} rrule - RRULE string
 * @param {number} [maxOccurrences=52] - Safety limit
 * @returns {Date[]} Array of occurrence dates
 */
function generateOccurrences(startDate, rrule, maxOccurrences = 52) {
  const rule = parseRRule(rrule);
  if (!rule) return [startDate];

  const dates = [new Date(startDate)];
  let current = new Date(startDate);
  const limit = rule.count || maxOccurrences;

  while (dates.length < limit) {
    current = nextOccurrence(current, rule);

    if (rule.until && current > rule.until) break;
    if (current.getFullYear() > startDate.getFullYear() + 2) break; // 2yr safety

    // Filter by BYDAY if specified
    if (rule.byDay) {
      const dayOfWeek = current.getDay();
      const dayName = Object.entries(DAY_MAP).find(([, v]) => v === dayOfWeek)?.[0];
      if (!rule.byDay.includes(dayName)) continue;
    }

    dates.push(new Date(current));
  }

  return dates;
}

function nextOccurrence(date, rule) {
  const next = new Date(date);
  switch (rule.freq) {
    case "DAILY":
      next.setDate(next.getDate() + rule.interval);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7 * rule.interval);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + rule.interval);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  return next;
}

/**
 * Create calendar event instances from a recurring parent.
 * Returns data objects ready to be inserted via Prisma.
 *
 * @param {object} parentEvent - The parent calendar event
 * @param {string} rrule - RRULE string
 * @returns {Array} Event data objects for prisma.calendarEvent.createMany
 */
function expandRecurringEvent(parentEvent, rrule) {
  const occurrences = generateOccurrences(new Date(parentEvent.startTime), rrule);
  const durationMs =
    new Date(parentEvent.endTime).getTime() - new Date(parentEvent.startTime).getTime();

  return occurrences.map((startTime) => {
    const endTime = new Date(startTime.getTime() + durationMs);
    return {
      title: parentEvent.title,
      description: parentEvent.description,
      startTime,
      endTime,
      timezone: parentEvent.timezone || "Europe/London",
      maxCapacity: parentEvent.maxCapacity,
      currentBookings: 0,
      isRecurring: true,
      recurrenceRule: rrule,
      parentEventId: parentEvent.id,
      locationId: parentEvent.locationId,
      locationName: parentEvent.locationName,
      isVirtual: parentEvent.isVirtual || false,
      meetingUrl: parentEvent.meetingUrl,
      status: "SCHEDULED",
      isPublic: parentEvent.isPublic !== false,
      // Site-specific foreign keys — set by the caller
      productId: parentEvent.productId || null,
      eventId: parentEvent.eventId || null,
      experienceId: parentEvent.experienceId || null,
      providerId: parentEvent.providerId || null,
    };
  });
}

module.exports = { parseRRule, generateOccurrences, expandRecurringEvent };
