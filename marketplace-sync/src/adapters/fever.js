/**
 * Fever Marketplace Adapter
 * Manages experience listings via Fever Reporting API
 */

class FeverAdapter {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.FEVER_API_KEY;
    this.partnerId = config.partnerId || process.env.FEVER_PARTNER_ID;
    this.baseUrl = "https://api.feverup.com/v1";
    this.platform = "FEVER";
  }

  get headers() {
    return {
      "X-Api-Key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  async push(experience, calendarEvent = null) {
    if (!this.apiKey) {
      console.error("[Fever] No API key configured");
      return { success: false, error: "No API key" };
    }

    console.log("[Fever] Pushing experience:", experience.title);

    const eventData = {
      partner_id: this.partnerId,
      name: experience.title,
      description: experience.description || experience.shortDesc || "",
      category: "experiences",
      price_cents: experience.price || null,
      currency: "GBP",
      city: "london",
      is_online: experience.format === "VIRTUAL",
    };

    if (calendarEvent) {
      eventData.sessions = [
        {
          start_time: calendarEvent.startTime,
          end_time: calendarEvent.endTime,
          capacity: calendarEvent.maxCapacity || null,
        },
      ];
    }

    try {
      const res = await fetch(`${this.baseUrl}/partner/events`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(eventData),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("[Fever] Push failed:", data);
        return { success: false, error: data.message || "Push failed" };
      }

      console.log("[Fever] Created event:", data.id);
      return {
        success: true,
        externalId: data.id,
        externalUrl: data.url || null,
      };
    } catch (err) {
      console.error("[Fever] Push error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async update(externalId, experience) {
    console.log("[Fever] Updating event:", externalId);

    try {
      const res = await fetch(`${this.baseUrl}/partner/events/${externalId}`, {
        method: "PUT",
        headers: this.headers,
        body: JSON.stringify({
          name: experience.title,
          description: experience.description || "",
          price_cents: experience.price || null,
          is_online: experience.format === "VIRTUAL",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("[Fever] Update failed:", data);
        return { success: false, error: data.message || "Update failed" };
      }

      console.log("[Fever] Updated event:", externalId);
      return { success: true };
    } catch (err) {
      console.error("[Fever] Update error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async remove(externalId) {
    console.log("[Fever] Removing event:", externalId);

    try {
      const res = await fetch(`${this.baseUrl}/partner/events/${externalId}`, {
        method: "DELETE",
        headers: this.headers,
      });

      if (!res.ok && res.status !== 404) {
        return { success: false, error: `HTTP ${res.status}` };
      }

      console.log("[Fever] Removed event:", externalId);
      return { success: true };
    } catch (err) {
      console.error("[Fever] Remove error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async pullBookings(externalId) {
    console.log("[Fever] Pulling tickets for event:", externalId);

    try {
      const res = await fetch(
        `${this.baseUrl}/partner/events/${externalId}/tickets`,
        { headers: this.headers }
      );

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: "Failed to pull bookings", bookings: [] };
      }

      const bookings = (data.tickets || []).map((t) => ({
        externalId: t.id,
        customerName: t.attendee_name || "Fever Customer",
        customerEmail: t.attendee_email || "",
        groupSize: t.quantity || 1,
        status: t.status === "used" ? "COMPLETED" : t.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
        createdAt: t.created_at,
      }));

      console.log("[Fever] Pulled", bookings.length, "tickets");
      return { success: true, bookings };
    } catch (err) {
      console.error("[Fever] Pull bookings error:", err.message);
      return { success: false, error: err.message, bookings: [] };
    }
  }
}

module.exports = { FeverAdapter };
