/**
 * Groupon Marketplace Adapter
 * Manages deal listings via Groupon Partner API
 */

class GrouponAdapter {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.GROUPON_API_KEY;
    this.merchantId = config.merchantId || process.env.GROUPON_MERCHANT_ID;
    this.baseUrl = "https://partner-api.groupon.com/v2";
    this.platform = "GROUPON";
  }

  get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async push(experience, calendarEvent = null) {
    if (!this.apiKey) {
      console.error("[Groupon] No API key configured");
      return { success: false, error: "No API key" };
    }

    console.log("[Groupon] Pushing experience:", experience.title);

    const dealData = {
      merchant_id: this.merchantId,
      title: experience.title,
      description: experience.description || experience.shortDesc || "",
      category: "things-to-do",
      price: experience.price ? experience.price / 100 : null,
      value: experience.price ? (experience.price * 1.5) / 100 : null, // show "value"
      redemption_type: experience.format === "VIRTUAL" ? "online" : "in_store",
      max_quantity: calendarEvent?.maxCapacity || null,
    };

    if (calendarEvent) {
      dealData.start_date = calendarEvent.startTime;
      dealData.end_date = calendarEvent.endTime;
    }

    try {
      const res = await fetch(`${this.baseUrl}/deals`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(dealData),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("[Groupon] Push failed:", data);
        return { success: false, error: data.message || "Push failed" };
      }

      console.log("[Groupon] Created deal:", data.id);
      return {
        success: true,
        externalId: data.id,
        externalUrl: data.deal_url || null,
      };
    } catch (err) {
      console.error("[Groupon] Push error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async update(externalId, experience) {
    console.log("[Groupon] Updating deal:", externalId);

    try {
      const res = await fetch(`${this.baseUrl}/deals/${externalId}`, {
        method: "PUT",
        headers: this.headers,
        body: JSON.stringify({
          title: experience.title,
          description: experience.description || "",
          price: experience.price ? experience.price / 100 : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("[Groupon] Update failed:", data);
        return { success: false, error: data.message || "Update failed" };
      }

      console.log("[Groupon] Updated deal:", externalId);
      return { success: true };
    } catch (err) {
      console.error("[Groupon] Update error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async remove(externalId) {
    console.log("[Groupon] Removing deal:", externalId);

    try {
      const res = await fetch(`${this.baseUrl}/deals/${externalId}`, {
        method: "DELETE",
        headers: this.headers,
      });

      if (!res.ok && res.status !== 404) {
        return { success: false, error: `HTTP ${res.status}` };
      }

      console.log("[Groupon] Removed deal:", externalId);
      return { success: true };
    } catch (err) {
      console.error("[Groupon] Remove error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async pullBookings(externalId) {
    console.log("[Groupon] Pulling redemptions for deal:", externalId);

    try {
      const res = await fetch(
        `${this.baseUrl}/deals/${externalId}/redemptions`,
        { headers: this.headers }
      );

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: "Failed to pull bookings", bookings: [] };
      }

      const bookings = (data.redemptions || []).map((r) => ({
        externalId: r.id,
        customerName: r.customer_name || "Groupon Customer",
        customerEmail: r.customer_email || "",
        groupSize: r.quantity || 1,
        status: r.redeemed ? "CONFIRMED" : "PENDING",
        createdAt: r.purchased_at,
      }));

      console.log("[Groupon] Pulled", bookings.length, "redemptions");
      return { success: true, bookings };
    } catch (err) {
      console.error("[Groupon] Pull bookings error:", err.message);
      return { success: false, error: err.message, bookings: [] };
    }
  }
}

module.exports = { GrouponAdapter };
