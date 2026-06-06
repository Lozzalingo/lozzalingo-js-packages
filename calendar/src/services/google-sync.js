/**
 * Google Calendar 2-way Sync Service
 *
 * Provides OAuth 2.0 flow, push/pull events, and conflict detection
 * for syncing CalendarEvent records with Google Calendar.
 */

const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

/**
 * Create a Google Calendar sync service instance.
 *
 * @param {object} options
 * @param {string} options.clientId - Google OAuth client ID
 * @param {string} options.clientSecret - Google OAuth client secret
 * @param {string} options.redirectUri - OAuth redirect URI
 * @param {object} options.prisma - Prisma client instance
 */
function createGoogleSyncService({ clientId, clientSecret, redirectUri, prisma }) {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  /**
   * Generate the Google OAuth consent URL.
   * @param {string} providerId - Provider ID for state param
   * @returns {string} Authorization URL
   */
  function getAuthUrl(providerId) {
    console.log('[GoogleSync] Generating auth URL for provider:', providerId);
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state: providerId,
    });
  }

  /**
   * Exchange authorization code for tokens and store them.
   * @param {string} code - Auth code from Google redirect
   * @param {string} providerId - Provider to link the tokens to
   */
  async function handleCallback(code, providerId) {
    try {
      console.log('[GoogleSync] Exchanging code for tokens — provider:', providerId);
      const { tokens } = await oauth2Client.getToken(code);

      await prisma.providerCalendarSync.upsert({
        where: { providerId },
        create: {
          providerId,
          syncType: 'GOOGLE',
          tokens: JSON.stringify(tokens),
          lastSynced: new Date(),
        },
        update: {
          tokens: JSON.stringify(tokens),
          lastSynced: new Date(),
        },
      });

      console.log('[GoogleSync] Tokens stored for provider:', providerId);
      return { success: true };
    } catch (error) {
      console.error('[GoogleSync] Token exchange failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get an authenticated Google Calendar client for a provider.
   * @param {string} providerId
   * @returns {object|null} Google Calendar API instance
   */
  async function getCalendarClient(providerId) {
    try {
      const sync = await prisma.providerCalendarSync.findUnique({
        where: { providerId },
      });

      if (!sync || !sync.tokens) {
        console.log('[GoogleSync] No sync record for provider:', providerId);
        return null;
      }

      const tokens = JSON.parse(sync.tokens);
      const authClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      authClient.setCredentials(tokens);

      // Auto-refresh if token is expired
      authClient.on('tokens', async (newTokens) => {
        console.log('[GoogleSync] Tokens refreshed for provider:', providerId);
        const merged = { ...tokens, ...newTokens };
        await prisma.providerCalendarSync.update({
          where: { providerId },
          data: { tokens: JSON.stringify(merged) },
        });
      });

      return google.calendar({ version: 'v3', auth: authClient });
    } catch (error) {
      console.error('[GoogleSync] Failed to get calendar client:', error.message);
      return null;
    }
  }

  /**
   * Push a CalendarEvent to Google Calendar.
   * @param {string} providerId
   * @param {object} calendarEvent - CalendarEvent from Prisma
   * @returns {object|null} Google Calendar event
   */
  async function pushEvent(providerId, calendarEvent) {
    try {
      const calendar = await getCalendarClient(providerId);
      if (!calendar) return null;

      const sync = await prisma.providerCalendarSync.findUnique({
        where: { providerId },
      });
      const calendarId = sync?.externalCalId || 'primary';

      const googleEvent = {
        summary: calendarEvent.title,
        description: calendarEvent.description || '',
        start: {
          dateTime: calendarEvent.startTime.toISOString(),
          timeZone: calendarEvent.timezone || 'Europe/London',
        },
        end: {
          dateTime: calendarEvent.endTime.toISOString(),
          timeZone: calendarEvent.timezone || 'Europe/London',
        },
        location: calendarEvent.locationName || undefined,
      };

      console.log('[GoogleSync] Pushing event to Google:', calendarEvent.title);

      const result = await calendar.events.insert({
        calendarId,
        requestBody: googleEvent,
      });

      console.log('[GoogleSync] Event pushed successfully — Google ID:', result.data.id);
      return result.data;
    } catch (error) {
      console.error('[GoogleSync] Push event failed:', error.message);
      return null;
    }
  }

  /**
   * Pull events from Google Calendar and detect conflicts.
   * @param {string} providerId
   * @param {Date} timeMin - Start of window
   * @param {Date} timeMax - End of window
   * @returns {object[]} Array of Google Calendar events
   */
  async function pullEvents(providerId, timeMin, timeMax) {
    try {
      const calendar = await getCalendarClient(providerId);
      if (!calendar) return [];

      const sync = await prisma.providerCalendarSync.findUnique({
        where: { providerId },
      });
      const calendarId = sync?.externalCalId || 'primary';

      console.log('[GoogleSync] Pulling events — provider:', providerId, 'from:', timeMin, 'to:', timeMax);

      const result = await calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
      });

      const events = result.data.items || [];
      console.log('[GoogleSync] Pulled', events.length, 'events from Google');

      // Update last synced timestamp
      await prisma.providerCalendarSync.update({
        where: { providerId },
        data: { lastSynced: new Date() },
      });

      return events;
    } catch (error) {
      console.error('[GoogleSync] Pull events failed:', error.message);
      return [];
    }
  }

  /**
   * Detect scheduling conflicts between Google events and local CalendarEvents.
   * @param {string} providerId
   * @param {Date} startTime
   * @param {Date} endTime
   * @returns {object[]} Array of conflicting events
   */
  async function detectConflicts(providerId, startTime, endTime) {
    try {
      console.log('[GoogleSync] Checking conflicts for provider:', providerId);

      const googleEvents = await pullEvents(providerId, startTime, endTime);

      const conflicts = googleEvents.filter((gEvent) => {
        const gStart = new Date(gEvent.start?.dateTime || gEvent.start?.date);
        const gEnd = new Date(gEvent.end?.dateTime || gEvent.end?.date);
        return gStart < endTime && gEnd > startTime;
      });

      console.log('[GoogleSync] Found', conflicts.length, 'conflicts');
      return conflicts;
    } catch (error) {
      console.error('[GoogleSync] Conflict detection failed:', error.message);
      return [];
    }
  }

  /**
   * Get sync status for a provider.
   * @param {string} providerId
   * @returns {object|null}
   */
  async function getSyncStatus(providerId) {
    try {
      const sync = await prisma.providerCalendarSync.findUnique({
        where: { providerId },
      });

      if (!sync) return null;

      return {
        connected: true,
        syncType: sync.syncType,
        lastSynced: sync.lastSynced,
        externalCalId: sync.externalCalId,
      };
    } catch (error) {
      console.error('[GoogleSync] Get sync status failed:', error.message);
      return null;
    }
  }

  /**
   * Disconnect Google Calendar sync for a provider.
   * @param {string} providerId
   */
  async function disconnect(providerId) {
    try {
      console.log('[GoogleSync] Disconnecting provider:', providerId);
      await prisma.providerCalendarSync.delete({
        where: { providerId },
      });
      console.log('[GoogleSync] Provider disconnected');
      return { success: true };
    } catch (error) {
      console.error('[GoogleSync] Disconnect failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  return {
    getAuthUrl,
    handleCallback,
    pushEvent,
    pullEvents,
    detectConflicts,
    getSyncStatus,
    disconnect,
  };
}

module.exports = { createGoogleSyncService };
