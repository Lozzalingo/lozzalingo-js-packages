/**
 * @lozzalingo/outreach - Controller Factory
 * Admin-only controllers for viewing outreach logs and managing scheduled sends.
 */

const { getOutreachLog, getScheduledOutreach } = require("./services/log");

/**
 * Create outreach controller.
 * @param {object} prisma
 * @param {object} options
 * @param {object} options.outreachService - From createOutreachService()
 * @returns {object} Controller methods
 */
function createOutreachController(prisma, options = {}) {
  const { outreachService } = options;

  console.log("[Outreach] Initialising outreach controller");

  /**
   * GET /log - Paginated, filtered outreach log
   */
  async function getLog(req, res) {
    try {
      const result = await getOutreachLog(prisma, {
        bookingId: req.query.bookingId,
        email: req.query.email,
        trigger: req.query.trigger,
        status: req.query.status,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        page: req.query.page,
        limit: req.query.limit,
      });

      return res.json(result);
    } catch (error) {
      console.error("[Outreach] Failed to fetch log:", error.message);
      return res.status(500).json({ error: "Failed to fetch outreach log" });
    }
  }

  /**
   * GET /log/booking/:bookingId - All outreach for a booking
   */
  async function getLogByBooking(req, res) {
    try {
      const result = await getOutreachLog(prisma, {
        bookingId: req.params.bookingId,
        page: req.query.page,
        limit: req.query.limit,
      });

      return res.json(result);
    } catch (error) {
      console.error("[Outreach] Failed to fetch log by booking:", error.message);
      return res.status(500).json({ error: "Failed to fetch outreach log" });
    }
  }

  /**
   * GET /log/email/:email - All outreach for an email address
   */
  async function getLogByEmail(req, res) {
    try {
      const result = await getOutreachLog(prisma, {
        email: req.params.email,
        page: req.query.page,
        limit: req.query.limit,
      });

      return res.json(result);
    } catch (error) {
      console.error("[Outreach] Failed to fetch log by email:", error.message);
      return res.status(500).json({ error: "Failed to fetch outreach log" });
    }
  }

  /**
   * GET /scheduled - Pending scheduled outreach
   */
  async function getScheduled(req, res) {
    try {
      const result = await getScheduledOutreach(prisma, {
        status: req.query.status || "PENDING",
        bookingId: req.query.bookingId,
        trigger: req.query.trigger,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        page: req.query.page,
        limit: req.query.limit,
      });

      return res.json(result);
    } catch (error) {
      console.error("[Outreach] Failed to fetch scheduled:", error.message);
      return res.status(500).json({ error: "Failed to fetch scheduled outreach" });
    }
  }

  /**
   * POST /trigger - Manually fire a trigger (admin override)
   */
  async function manualTrigger(req, res) {
    try {
      const { triggerName, bookingId } = req.body;

      if (!triggerName) {
        return res.status(400).json({ error: "triggerName is required" });
      }

      if (!outreachService) {
        console.error("[Outreach] Outreach service not configured for manual trigger");
        return res.status(500).json({ error: "Outreach service not configured" });
      }

      console.log("[Outreach] Manual trigger:", triggerName, "bookingId:", bookingId);

      // Build data from bookingId if provided
      const data = { id: bookingId, bookingId };

      // If we have a bookingId, try to fetch the booking for full data
      if (bookingId && prisma.booking) {
        try {
          const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
          if (booking) {
            Object.assign(data, booking);
          }
        } catch (fetchError) {
          console.error("[Outreach] Could not fetch booking for manual trigger:", fetchError.message);
          // Continue with limited data
        }
      }

      const result = await outreachService.trigger(triggerName, data);
      return res.json(result);
    } catch (error) {
      console.error("[Outreach] Manual trigger failed:", error.message);
      return res.status(500).json({ error: "Failed to fire trigger" });
    }
  }

  /**
   * DELETE /scheduled/:id - Cancel a scheduled outreach
   */
  async function cancelScheduledItem(req, res) {
    try {
      const { id } = req.params;

      console.log("[Outreach] Cancelling scheduled item:", id);

      const record = await prisma.outreachSchedule.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      console.log("[Outreach] Cancelled scheduled item:", id);
      return res.json({ message: "Scheduled outreach cancelled", id: record.id });
    } catch (error) {
      console.error("[Outreach] Failed to cancel scheduled item:", error.message);
      return res.status(500).json({ error: "Failed to cancel scheduled outreach" });
    }
  }

  return {
    getLog,
    getLogByBooking,
    getLogByEmail,
    getScheduled,
    manualTrigger,
    cancelScheduledItem,
  };
}

module.exports = { createOutreachController };
