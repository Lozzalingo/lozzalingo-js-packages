/**
 * @lozzalingo/calendar - Controller Factory
 *
 * Handles HTTP request/response for the new slot, sync, and cross-brand endpoints.
 * Existing route handlers remain inline in routes.js to avoid breaking changes.
 */

const { pencilSlot, blockSlot, releaseSlot, getExpiredPencils, releaseExpiredPencils } = require("./services/slots");
const { syncFromGoogle, syncFromICal } = require("./services/sync");
const { checkSupplierAvailability, getSupplierUnavailableDates } = require("./services/cross-brand");

/**
 * Create calendar controller with slot, sync, and cross-brand handlers.
 *
 * @param {object} prisma - Prisma client
 * @param {object} options
 * @param {string} [options.modelName] - Prisma model name (default: "calendarEvent")
 * @param {object} [options.hooks] - Lifecycle hooks
 * @returns {object} Controller methods
 */
function createCalendarController(prisma, options = {}) {
  const { modelName = "calendarEvent", hooks = {} } = options;

  console.log("[Calendar] Initialising calendar controller");

  // ---- Slot endpoints ----

  async function pencil(req, res) {
    try {
      const { id } = req.params;
      const { bookingId, holdHours } = req.body;

      if (!bookingId) {
        return res.status(400).json({ error: "Missing bookingId" });
      }

      const result = await pencilSlot(prisma, modelName, id, bookingId, holdHours || 24);

      if (!result.success) {
        return res.status(409).json({ error: result.reason });
      }

      if (hooks.onSlotPencilled) {
        try {
          await hooks.onSlotPencilled(result.slot);
        } catch (hookError) {
          console.error("[Calendar] onSlotPencilled hook failed:", hookError.message);
        }
      }

      return res.json(result);
    } catch (error) {
      console.error("[Calendar] Pencil endpoint failed:", error.message);
      return res.status(500).json({ error: "Failed to pencil slot" });
    }
  }

  async function block(req, res) {
    try {
      const { id } = req.params;
      const { bookingId } = req.body;

      if (!bookingId) {
        return res.status(400).json({ error: "Missing bookingId" });
      }

      const result = await blockSlot(prisma, modelName, id, bookingId);

      if (!result.success) {
        return res.status(409).json({ error: result.reason });
      }

      if (hooks.onSlotBlocked) {
        try {
          await hooks.onSlotBlocked(result.slot);
        } catch (hookError) {
          console.error("[Calendar] onSlotBlocked hook failed:", hookError.message);
        }
      }

      return res.json(result);
    } catch (error) {
      console.error("[Calendar] Block endpoint failed:", error.message);
      return res.status(500).json({ error: "Failed to block slot" });
    }
  }

  async function release(req, res) {
    try {
      const { id } = req.params;

      const result = await releaseSlot(prisma, modelName, id);

      if (!result.success) {
        return res.status(404).json({ error: result.reason });
      }

      if (hooks.onSlotReleased) {
        try {
          await hooks.onSlotReleased(result.slot);
        } catch (hookError) {
          console.error("[Calendar] onSlotReleased hook failed:", hookError.message);
        }
      }

      return res.json(result);
    } catch (error) {
      console.error("[Calendar] Release endpoint failed:", error.message);
      return res.status(500).json({ error: "Failed to release slot" });
    }
  }

  async function listExpired(req, res) {
    try {
      const expired = await getExpiredPencils(prisma, modelName);
      return res.json({ expired, count: expired.length });
    } catch (error) {
      console.error("[Calendar] List expired endpoint failed:", error.message);
      return res.status(500).json({ error: "Failed to fetch expired pencils" });
    }
  }

  async function releaseAllExpired(req, res) {
    try {
      const result = await releaseExpiredPencils(prisma, modelName);
      return res.json(result);
    } catch (error) {
      console.error("[Calendar] Release expired endpoint failed:", error.message);
      return res.status(500).json({ error: "Failed to release expired pencils" });
    }
  }

  // ---- Sync endpoints ----

  async function triggerGoogleSync(req, res) {
    try {
      const { googleCalendarId, credentials, supplierId, syncDays } = req.body;

      if (!googleCalendarId) {
        return res.status(400).json({ error: "Missing googleCalendarId" });
      }

      const result = await syncFromGoogle(prisma, modelName, {
        googleCalendarId,
        credentials,
        supplierId,
        syncDays,
      });

      return res.json(result);
    } catch (error) {
      console.error("[Calendar] Google sync endpoint failed:", error.message);
      return res.status(500).json({ error: "Failed to sync from Google Calendar" });
    }
  }

  async function triggerICalSync(req, res) {
    try {
      const { icalUrl, supplierId, syncDays } = req.body;

      if (!icalUrl) {
        return res.status(400).json({ error: "Missing icalUrl" });
      }

      const result = await syncFromICal(prisma, modelName, {
        icalUrl,
        supplierId,
        syncDays,
      });

      return res.json(result);
    } catch (error) {
      console.error("[Calendar] iCal sync endpoint failed:", error.message);
      return res.status(500).json({ error: "Failed to sync from iCal feed" });
    }
  }

  // ---- Cross-brand endpoints ----

  async function supplierAvailability(req, res) {
    try {
      const { date } = req.params;
      const { supplierId } = req.params;

      if (!supplierId || !date) {
        return res.status(400).json({ error: "Missing supplierId or date" });
      }

      const result = await checkSupplierAvailability(prisma, modelName, supplierId, date);
      return res.json(result);
    } catch (error) {
      console.error("[Calendar] Supplier availability endpoint failed:", error.message);
      return res.status(500).json({ error: "Failed to check supplier availability" });
    }
  }

  async function supplierUnavailableDates(req, res) {
    try {
      const { supplierId } = req.params;
      const { startDate, endDate } = req.query;

      if (!supplierId) {
        return res.status(400).json({ error: "Missing supplierId" });
      }

      // Default to next 90 days if no range specified
      const start = startDate || new Date().toISOString().split("T")[0];
      const end = endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const result = await getSupplierUnavailableDates(prisma, modelName, supplierId, start, end);
      return res.json({ supplierId, startDate: start, endDate: end, unavailableDates: result });
    } catch (error) {
      console.error("[Calendar] Supplier unavailable dates endpoint failed:", error.message);
      return res.status(500).json({ error: "Failed to fetch unavailable dates" });
    }
  }

  return {
    pencil,
    block,
    release,
    listExpired,
    releaseAllExpired,
    triggerGoogleSync,
    triggerICalSync,
    supplierAvailability,
    supplierUnavailableDates,
  };
}

module.exports = { createCalendarController };
