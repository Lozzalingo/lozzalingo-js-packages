/**
 * Design My Night Marketplace Adapter
 * Pushes venue/experience listings via DMN Partner API
 */

class DesignMyNightAdapter {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.DMN_API_KEY;
    this.venueId = config.venueId || process.env.DMN_VENUE_ID;
    this.baseUrl = "https://api.designmynight.com/v4";
    this.platform = "DESIGN_MY_NIGHT";
  }

  get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async push(experience, calendarEvent = null) {
    if (!this.apiKey) {
      console.error("[DMN] No API key configured");
      return { success: false, error: "No API key" };
    }

    console.log("[DMN] Pushing experience:", experience.title);

    const offerData = {
      name: experience.title,
      description: experience.description || experience.shortDesc || "",
      type: "experience",
      venue_id: this.venueId,
      price: experience.price ? experience.price / 100 : null,
      min_guests: experience.groupSize ? parseInt(experience.groupSize) || null : null,
      available: experience.isActive !== false,
    };

    if (calendarEvent) {
      offerData.available_from = calendarEvent.startTime;
      offerData.available_to = calendarEvent.endTime;
    }

    try {
      const res = await fetch(`${this.baseUrl}/offers`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(offerData),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("[DMN] Push failed:", data);
        return { success: false, error: data.message || "Push failed" };
      }

      console.log("[DMN] Created offer:", data.id);
      return {
        success: true,
        externalId: data.id,
        externalUrl: data.url || `https://www.designmynight.com/offers/${data.id}`,
      };
    } catch (err) {
      console.error("[DMN] Push error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async update(externalId, experience) {
    console.log("[DMN] Updating offer:", externalId);

    try {
      const res = await fetch(`${this.baseUrl}/offers/${externalId}`, {
        method: "PUT",
        headers: this.headers,
        body: JSON.stringify({
          name: experience.title,
          description: experience.description || "",
          price: experience.price ? experience.price / 100 : null,
          available: experience.isActive !== false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("[DMN] Update failed:", data);
        return { success: false, error: data.message || "Update failed" };
      }

      console.log("[DMN] Updated offer:", externalId);
      return { success: true };
    } catch (err) {
      console.error("[DMN] Update error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async remove(externalId) {
    console.log("[DMN] Removing offer:", externalId);

    try {
      const res = await fetch(`${this.baseUrl}/offers/${externalId}`, {
        method: "DELETE",
        headers: this.headers,
      });

      if (!res.ok && res.status !== 404) {
        return { success: false, error: `HTTP ${res.status}` };
      }

      console.log("[DMN] Removed offer:", externalId);
      return { success: true };
    } catch (err) {
      console.error("[DMN] Remove error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async pullBookings(externalId) {
    console.log("[DMN] Pulling bookings for offer:", externalId);

    try {
      const res = await fetch(
        `${this.baseUrl}/bookings?offer_id=${externalId}`,
        { headers: this.headers }
      );

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: "Failed to pull bookings", bookings: [] };
      }

      const bookings = (data.bookings || []).map((b) => ({
        externalId: b.id,
        customerName: b.first_name + " " + b.last_name,
        customerEmail: b.email,
        groupSize: b.num_people || 1,
        status: b.status === "complete" ? "CONFIRMED" : b.status === "cancelled" ? "CANCELLED" : "PENDING",
        createdAt: b.created,
      }));

      console.log("[DMN] Pulled", bookings.length, "bookings");
      return { success: true, bookings };
    } catch (err) {
      console.error("[DMN] Pull bookings error:", err.message);
      return { success: false, error: err.message, bookings: [] };
    }
  }
}

module.exports = { DesignMyNightAdapter };
