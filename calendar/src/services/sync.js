/**
 * @lozzalingo/calendar - External Calendar Sync Service
 *
 * Pull availability from Google Calendar and iCal feeds.
 * Creates UNAVAILABLE slots in the local database from external sources.
 */

/**
 * Sync events from a Google Calendar.
 *
 * @param {object} prisma - Prisma client
 * @param {string} modelName - Prisma model name for calendar events
 * @param {object} params
 * @param {string} params.googleCalendarId - Google Calendar ID
 * @param {object} params.credentials - Google API credentials (oauth2Client or tokens)
 * @param {string} [params.supplierId] - Optional supplier ID for cross-brand
 * @param {number} [params.syncDays] - How many days ahead to sync (default 90)
 * @returns {Promise<{ created: number, updated: number, removed: number }>}
 */
async function syncFromGoogle(prisma, modelName = "calendarEvent", params = {}) {
  const { googleCalendarId, credentials, supplierId, syncDays = 90 } = params;

  try {
    console.log("[Calendar] Starting Google sync for calendar:", googleCalendarId);

    if (!googleCalendarId || !credentials) {
      console.error("[Calendar] Google sync missing required params");
      return { created: 0, updated: 0, removed: 0 };
    }

    const now = new Date();
    const syncEnd = new Date(now.getTime() + syncDays * 24 * 60 * 60 * 1000);

    // Fetch events from Google Calendar API
    const googleEvents = await fetchGoogleEvents(credentials, googleCalendarId, now, syncEnd);

    let created = 0;
    let updated = 0;
    let removed = 0;

    const externalIds = [];

    for (const gEvent of googleEvents) {
      const externalId = gEvent.id;
      externalIds.push(externalId);

      const existing = await prisma[modelName].findFirst({
        where: { externalCalendarId: externalId, externalSource: "google" },
      });

      const eventData = {
        title: gEvent.summary || "Busy",
        startTime: new Date(gEvent.start?.dateTime || gEvent.start?.date),
        endTime: new Date(gEvent.end?.dateTime || gEvent.end?.date),
        slotStatus: "BLOCKED",
        externalCalendarId: externalId,
        externalSource: "google",
        isPublic: false,
        status: "SCHEDULED",
      };

      if (supplierId) {
        eventData.supplierId = supplierId;
      }

      if (existing) {
        await prisma[modelName].update({
          where: { id: existing.id },
          data: {
            title: eventData.title,
            startTime: eventData.startTime,
            endTime: eventData.endTime,
          },
        });
        updated++;
      } else {
        await prisma[modelName].create({ data: eventData });
        created++;
      }
    }

    // Remove events from Google that no longer exist in the feed
    if (externalIds.length > 0 || googleEvents.length === 0) {
      const removeWhere = {
        externalSource: "google",
        externalCalendarId: externalIds.length > 0 ? { notIn: externalIds } : undefined,
      };
      if (supplierId) removeWhere.supplierId = supplierId;

      const toRemove = await prisma[modelName].findMany({ where: removeWhere });
      for (const event of toRemove) {
        await prisma[modelName].delete({ where: { id: event.id } });
        removed++;
      }
    }

    console.log("[Calendar] Google sync:", created, "created,", updated, "updated,", removed, "removed");
    return { created, updated, removed };
  } catch (error) {
    console.error("[Calendar] Google sync failed:", error.message);
    return { created: 0, updated: 0, removed: 0 };
  }
}

/**
 * Fetch events from Google Calendar API.
 * This is a thin wrapper - sites may need to provide their own authenticated client.
 *
 * @param {object} credentials - Google credentials object
 * @param {string} calendarId - Google Calendar ID
 * @param {Date} timeMin - Start of window
 * @param {Date} timeMax - End of window
 * @returns {Promise<Array>} Google Calendar events
 */
async function fetchGoogleEvents(credentials, calendarId, timeMin, timeMax) {
  try {
    // If credentials has a listEvents method (pre-authenticated client), use it
    if (credentials.events && typeof credentials.events.list === "function") {
      const result = await credentials.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
      });
      return result.data?.items || [];
    }

    console.log("[Calendar] No Google API client provided, returning empty events");
    return [];
  } catch (error) {
    console.error("[Calendar] Failed to fetch Google events:", error.message);
    return [];
  }
}

/**
 * Sync events from an iCal feed URL.
 *
 * @param {object} prisma - Prisma client
 * @param {string} modelName - Prisma model name
 * @param {object} params
 * @param {string} params.icalUrl - URL of the .ics feed
 * @param {string} [params.supplierId] - Optional supplier ID
 * @param {number} [params.syncDays] - Days ahead (default 90)
 * @param {Function} [params.fetchFn] - Custom fetch function (for testing)
 * @returns {Promise<{ created: number, updated: number, removed: number }>}
 */
async function syncFromICal(prisma, modelName = "calendarEvent", params = {}) {
  const { icalUrl, supplierId, syncDays = 90, fetchFn } = params;

  try {
    console.log("[Calendar] Starting iCal sync from:", icalUrl);

    if (!icalUrl) {
      console.error("[Calendar] iCal sync missing URL");
      return { created: 0, updated: 0, removed: 0 };
    }

    // Generate a feed-specific source tag so multiple feeds don't clobber each other.
    // Uses last 12 chars of the URL as a simple fingerprint.
    const feedTag = "ical:" + icalUrl.slice(-12);

    // Fetch the .ics file
    const fetcher = fetchFn || globalThis.fetch;
    const response = await fetcher(icalUrl);
    const icsText = typeof response.text === "function" ? await response.text() : response;

    // Parse iCal events
    const icalEvents = parseICalEvents(icsText);

    const now = new Date();
    const syncEnd = new Date(now.getTime() + syncDays * 24 * 60 * 60 * 1000);

    // Filter to sync window
    const relevantEvents = icalEvents.filter((e) => {
      return e.startTime >= now && e.startTime <= syncEnd;
    });

    let created = 0;
    let updated = 0;
    let removed = 0;

    const externalIds = [];

    for (const icalEvent of relevantEvents) {
      const externalId = icalEvent.uid;
      externalIds.push(externalId);

      const existing = await prisma[modelName].findFirst({
        where: { externalCalendarId: externalId, externalSource: feedTag },
      });

      const eventData = {
        title: icalEvent.summary || "Busy",
        startTime: icalEvent.startTime,
        endTime: icalEvent.endTime,
        slotStatus: "BLOCKED",
        externalCalendarId: externalId,
        externalSource: feedTag,
        isPublic: false,
        status: "SCHEDULED",
      };

      if (supplierId) {
        eventData.supplierId = supplierId;
      }

      if (existing) {
        await prisma[modelName].update({
          where: { id: existing.id },
          data: {
            title: eventData.title,
            startTime: eventData.startTime,
            endTime: eventData.endTime,
          },
        });
        updated++;
      } else {
        await prisma[modelName].create({ data: eventData });
        created++;
      }
    }

    // Remove events from THIS FEED that no longer exist
    const removeWhere = {
      externalSource: feedTag,
    };
    if (externalIds.length > 0) {
      removeWhere.externalCalendarId = { notIn: externalIds };
    }
    if (supplierId) removeWhere.supplierId = supplierId;

    const toRemove = await prisma[modelName].findMany({ where: removeWhere });
    for (const event of toRemove) {
      await prisma[modelName].delete({ where: { id: event.id } });
      removed++;
    }

    console.log("[Calendar] iCal sync:", created, "created,", updated, "updated,", removed, "removed");
    return { created, updated, removed };
  } catch (error) {
    console.error("[Calendar] iCal sync failed:", error.message);
    return { created: 0, updated: 0, removed: 0 };
  }
}

/**
 * Parse VEVENT blocks from an iCal string.
 * Simplified parser for common fields only.
 *
 * @param {string} icsText - Raw .ics file content
 * @returns {Array<{ uid: string, summary: string, startTime: Date, endTime: Date }>}
 */
function parseICalEvents(icsText) {
  if (!icsText) return [];

  const events = [];
  const blocks = icsText.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const event = {};

    const lines = block.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith("UID:")) event.uid = line.substring(4).trim();
      if (line.startsWith("SUMMARY:")) event.summary = line.substring(8).trim();
      if (line.startsWith("DTSTART")) event.startTime = parseICalDateTime(line);
      if (line.startsWith("DTEND")) event.endTime = parseICalDateTime(line);
    }

    if (event.uid && event.startTime) {
      if (!event.endTime) event.endTime = event.startTime;
      events.push(event);
    }
  }

  return events;
}

/**
 * Parse an iCal date/datetime value.
 *
 * @param {string} line - e.g. "DTSTART:20260415T140000Z" or "DTSTART;VALUE=DATE:20260415"
 * @returns {Date}
 */
function parseICalDateTime(line) {
  // Extract the value after the last colon
  const value = line.split(":").pop().trim();

  if (value.length === 8) {
    // Date only (all-day events): YYYYMMDD
    // Always use UTC so the same timestamp is stored regardless of server timezone
    const y = parseInt(value.slice(0, 4));
    const m = parseInt(value.slice(4, 6)) - 1;
    const d = parseInt(value.slice(6, 8));
    return new Date(Date.UTC(y, m, d, 0, 0, 0));
  }

  // DateTime: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  const y = parseInt(value.slice(0, 4));
  const m = parseInt(value.slice(4, 6)) - 1;
  const d = parseInt(value.slice(6, 8));
  const h = parseInt(value.slice(9, 11)) || 0;
  const min = parseInt(value.slice(11, 13)) || 0;
  const s = parseInt(value.slice(13, 15)) || 0;

  if (value.endsWith("Z")) {
    return new Date(Date.UTC(y, m, d, h, min, s));
  }

  // Non-Z datetimes have a TZID (e.g. "DTSTART;TZID=Europe/London:20260602T101500")
  // Extract timezone from the original line
  const tzMatch = line.match(/TZID=([^:;]+)/);
  if (tzMatch) {
    // Create a date string with timezone and let the runtime convert to UTC
    const isoStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    try {
      // Use Intl to get the UTC offset for this timezone at this date
      const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: tzMatch[1],
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      });
      // Create date in UTC first, then adjust for timezone offset
      const utcDate = new Date(Date.UTC(y, m, d, h, min, s));
      const localParts = formatter.formatToParts(utcDate);
      const localHour = parseInt(localParts.find((p) => p.type === "hour")?.value || "0");
      const offsetHours = localHour - h;
      // Subtract the offset to convert local time to UTC
      return new Date(Date.UTC(y, m, d, h - offsetHours, min, s));
    } catch {
      // Fallback: assume Europe/London (BST = UTC+1 in summer, GMT = UTC in winter)
      const isSummer = m >= 2 && m <= 9; // rough BST check (Mar-Oct)
      return new Date(Date.UTC(y, m, d, h - (isSummer ? 1 : 0), min, s));
    }
  }

  // No timezone info at all: assume UTC
  return new Date(Date.UTC(y, m, d, h, min, s));
}

module.exports = { syncFromGoogle, syncFromICal, parseICalEvents };
