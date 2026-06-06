/**
 * Eventbrite Marketplace Adapter
 * Pushes/pulls events via Eventbrite REST API v3
 */

class EventbriteAdapter {
  constructor(config = {}) {
    this.apiToken = config.apiToken || process.env.EVENTBRITE_API_TOKEN;
    this.organizationId = config.organizationId || process.env.EVENTBRITE_ORG_ID;
    this.baseUrl = "https://www.eventbriteapi.com/v3";
    this.platform = "EVENTBRITE";
  }

  get headers() {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Push an experience to Eventbrite as an event
   */
  async push(experience, calendarEvent = null) {
    if (!this.apiToken) {
      console.error("[Eventbrite] No API token configured");
      return { success: false, error: "No API token" };
    }

    console.log("[Eventbrite] Pushing experience:", experience.title);

    const eventData = {
      event: {
        name: { html: experience.title },
        description: { html: experience.description || experience.shortDesc || "" },
        start: {
          timezone: "Europe/London",
          utc: calendarEvent?.startTime
            ? new Date(calendarEvent.startTime).toISOString().replace(".000Z", "Z")
            : new Date().toISOString().replace(".000Z", "Z"),
        },
        end: {
          timezone: "Europe/London",
          utc: calendarEvent?.endTime
            ? new Date(calendarEvent.endTime).toISOString().replace(".000Z", "Z")
            : new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().replace(".000Z", "Z"),
        },
        currency: "GBP",
        online_event: experience.format === "VIRTUAL",
        listed: experience.isActive !== false,
        capacity: calendarEvent?.maxCapacity || null,
      },
    };

    try {
      const res = await fetch(
        `${this.baseUrl}/organizations/${this.organizationId}/events/`,
        {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify(eventData),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("[Eventbrite] Push failed:", data);
        return { success: false, error: data.error_description || "Push failed" };
      }

      console.log("[Eventbrite] Created event:", data.id);

      // Create ticket class if price exists
      if (experience.price) {
        await this._createTicketClass(data.id, experience);
      }

      return {
        success: true,
        externalId: data.id,
        externalUrl: data.url,
      };
    } catch (err) {
      console.error("[Eventbrite] Push error:", err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Update an existing Eventbrite event
   */
  async update(externalId, experience, calendarEvent = null) {
    console.log("[Eventbrite] Updating event:", externalId);

    const eventData = {
      event: {
        name: { html: experience.title },
        description: { html: experience.description || "" },
        online_event: experience.format === "VIRTUAL",
        listed: experience.isActive !== false,
      },
    };

    if (calendarEvent?.startTime) {
      eventData.event.start = {
        timezone: "Europe/London",
        utc: new Date(calendarEvent.startTime).toISOString().replace(".000Z", "Z"),
      };
      eventData.event.end = {
        timezone: "Europe/London",
        utc: new Date(calendarEvent.endTime).toISOString().replace(".000Z", "Z"),
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/events/${externalId}/`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(eventData),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("[Eventbrite] Update failed:", data);
        return { success: false, error: data.error_description || "Update failed" };
      }

      console.log("[Eventbrite] Updated event:", externalId);
      return { success: true };
    } catch (err) {
      console.error("[Eventbrite] Update error:", err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Remove an event from Eventbrite
   */
  async remove(externalId) {
    console.log("[Eventbrite] Removing event:", externalId);

    try {
      const res = await fetch(`${this.baseUrl}/events/${externalId}/`, {
        method: "DELETE",
        headers: this.headers,
      });

      if (!res.ok && res.status !== 404) {
        console.error("[Eventbrite] Remove failed:", res.status);
        return { success: false, error: `HTTP ${res.status}` };
      }

      console.log("[Eventbrite] Removed event:", externalId);
      return { success: true };
    } catch (err) {
      console.error("[Eventbrite] Remove error:", err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Pull orders/attendees from an Eventbrite event (for booking import)
   */
  async pullBookings(externalId) {
    console.log("[Eventbrite] Pulling bookings for event:", externalId);

    try {
      const res = await fetch(
        `${this.baseUrl}/events/${externalId}/attendees/`,
        { headers: this.headers }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("[Eventbrite] Pull bookings failed:", data);
        return { success: false, error: "Failed to pull bookings", bookings: [] };
      }

      const bookings = (data.attendees || []).map((att) => ({
        externalId: att.id,
        customerName: `${att.profile.first_name} ${att.profile.last_name}`,
        customerEmail: att.profile.email,
        groupSize: att.quantity || 1,
        status: att.cancelled ? "CANCELLED" : att.checked_in ? "COMPLETED" : "CONFIRMED",
        createdAt: att.created,
      }));

      console.log("[Eventbrite] Pulled", bookings.length, "bookings");
      return { success: true, bookings };
    } catch (err) {
      console.error("[Eventbrite] Pull bookings error:", err.message);
      return { success: false, error: err.message, bookings: [] };
    }
  }

  async _createTicketClass(eventId, experience) {
    try {
      await fetch(`${this.baseUrl}/events/${eventId}/ticket_classes/`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          ticket_class: {
            name: "General Admission",
            quantity_total: 100,
            cost: `GBP,${experience.price}`, // price in minor units
            free: false,
          },
        }),
      });
      console.log("[Eventbrite] Created ticket class for event:", eventId);
    } catch (err) {
      console.error("[Eventbrite] Ticket class creation failed:", err.message);
    }
  }
}

module.exports = { EventbriteAdapter };
