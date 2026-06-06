/**
 * Wowcher Marketplace Adapter
 * Manages deal listings via Wowcher REST API
 */

class WowcherAdapter {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.WOWCHER_API_KEY;
    this.merchantId = config.merchantId || process.env.WOWCHER_MERCHANT_ID;
    this.baseUrl = "https://api.wowcher.co.uk/v1";
    this.platform = "WOWCHER";
  }

  get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async push(experience, calendarEvent = null) {
    if (!this.apiKey) {
      console.error("[Wowcher] No API key configured");
      return { success: false, error: "No API key" };
    }

    console.log("[Wowcher] Pushing experience:", experience.title);

    const dealData = {
      merchant_id: this.merchantId,
      title: experience.title,
      description: experience.description || experience.shortDesc || "",
      price: experience.price ? experience.price / 100 : null,
      category: "experiences",
      location: experience.format === "VIRTUAL" ? "online" : "london",
      max_vouchers: calendarEvent?.maxCapacity || null,
    };

    try {
      const res = await fetch(`${this.baseUrl}/deals`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(dealData),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("[Wowcher] Push failed:", data);
        return { success: false, error: data.message || "Push failed" };
      }

      console.log("[Wowcher] Created deal:", data.id);
      return {
        success: true,
        externalId: data.id,
        externalUrl: data.url || null,
      };
    } catch (err) {
      console.error("[Wowcher] Push error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async update(externalId, experience) {
    console.log("[Wowcher] Updating deal:", externalId);

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
        console.error("[Wowcher] Update failed:", data);
        return { success: false, error: data.message || "Update failed" };
      }

      console.log("[Wowcher] Updated deal:", externalId);
      return { success: true };
    } catch (err) {
      console.error("[Wowcher] Update error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async remove(externalId) {
    console.log("[Wowcher] Removing deal:", externalId);

    try {
      const res = await fetch(`${this.baseUrl}/deals/${externalId}`, {
        method: "DELETE",
        headers: this.headers,
      });

      if (!res.ok && res.status !== 404) {
        return { success: false, error: `HTTP ${res.status}` };
      }

      console.log("[Wowcher] Removed deal:", externalId);
      return { success: true };
    } catch (err) {
      console.error("[Wowcher] Remove error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async pullBookings(externalId) {
    console.log("[Wowcher] Pulling vouchers for deal:", externalId);

    try {
      const res = await fetch(
        `${this.baseUrl}/deals/${externalId}/vouchers`,
        { headers: this.headers }
      );

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: "Failed to pull bookings", bookings: [] };
      }

      const bookings = (data.vouchers || []).map((v) => ({
        externalId: v.id,
        customerName: v.customer_name || "Wowcher Customer",
        customerEmail: v.customer_email || "",
        groupSize: v.quantity || 1,
        status: v.redeemed ? "COMPLETED" : "CONFIRMED",
        createdAt: v.purchased_at,
      }));

      console.log("[Wowcher] Pulled", bookings.length, "vouchers");
      return { success: true, bookings };
    } catch (err) {
      console.error("[Wowcher] Pull bookings error:", err.message);
      return { success: false, error: err.message, bookings: [] };
    }
  }
}

module.exports = { WowcherAdapter };
