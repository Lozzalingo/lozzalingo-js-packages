/**
 * @lozzalingo/calendar - Route Factory
 *
 * Creates Express router with calendar CRUD, time-slot availability,
 * slot lifecycle, sync, and cross-brand endpoints.
 * Each site mounts this with their own Prisma client.
 *
 * Usage:
 *   const { createCalendarRoutes } = require('@lozzalingo/calendar/routes');
 *   app.use('/api/calendar', createCalendarRoutes(prisma, { domain: 'bucketrace.com' }));
 */

const express = require("express");
const { generateICalFeed } = require("./services/ical");
const { createCalendarController } = require("./controller");
const { getAvailableTimeSlots } = require("./services/time-slots");

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} options
 * @param {string} [options.domain] - For iCal feed UIDs
 * @param {string} [options.calendarName] - Display name in iCal
 * @param {Function} [options.authMiddleware] - Middleware for admin routes
 */
function createCalendarRoutes(prisma, options = {}) {
  const router = express.Router();
  const { domain = "lozzalingo.com", calendarName = "Events", authMiddleware, modelName = "calendarEvent", hooks = {} } = options;

  // Wrap admin routes with auth if provided
  const adminGuard = authMiddleware || ((req, res, next) => next());

  // Controller for slot/sync/cross-brand endpoints
  const controller = createCalendarController(prisma, { modelName, hooks });

  // ─── PUBLIC ENDPOINTS ──────────────────────────────────────────────────────

  /**
   * GET /api/calendar/time-slots/:date
   * Available time slots for a date and duration.
   * Query: ?duration=180 (minutes), ?productId=xxx, ?supplierId=xxx
   */
  router.get("/time-slots/:date", async (req, res) => {
    try {
      const dateStr = req.params.date; // YYYY-MM-DD
      const duration = parseInt(req.query.duration || "180");
      const { productId, supplierId } = req.query;

      if (duration < 60 || duration > 480) {
        return res.status(400).json({ error: "Duration must be between 60 and 480 minutes" });
      }

      // Reject past dates
      const today = new Date().toISOString().split("T")[0];
      if (dateStr < today) {
        return res.json({ date: dateStr, duration, slots: [] });
      }

      const slots = await getAvailableTimeSlots(prisma, dateStr, duration, {
        modelName,
        productId: productId || undefined,
        supplierId: supplierId || undefined,
      });

      console.log(`[Calendar] Time slots ${dateStr} (${duration}m): ${slots.filter((s) => s.available).length} available`);
      return res.json({ date: dateStr, duration, slots });
    } catch (error) {
      console.error("[Calendar] Error fetching time slots:", error.message);
      return res.status(500).json({ error: "Error fetching time slots" });
    }
  });

  /**
   * GET /api/calendar/feed.ics
   * Public iCal feed.
   */
  router.get("/feed.ics", async (req, res) => {
    try {
      const pastCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Public calendar events (public ticket events)
      const calendarEvents = await prisma.calendarEvent.findMany({
        where: {
          isPublic: true,
          status: { in: ["SCHEDULED", "LIVE", "FULL"] },
          startTime: { gte: pastCutoff },
          externalSource: null, // exclude iCal-synced events from outbound feed
        },
        orderBy: { startTime: "asc" },
        take: 200,
      });

      // Confirmed/paid bookings with time slots
      let bookingEvents = [];
      try {
        const bookings = await prisma.booking.findMany({
          where: {
            status: { in: ["CONFIRMED", "DEPOSIT_PAID", "PAID", "COMPLETED"] },
            slotStartTime: { not: null },
            slotEndTime: { not: null },
            eventDate: { gte: pastCutoff },
          },
          select: {
            id: true, customerName: true, groupSize: true,
            eventDate: true, slotStartTime: true, slotEndTime: true,
            status: true, locationName: true,
          },
          orderBy: { eventDate: "asc" },
          take: 200,
        });

        bookingEvents = bookings.map((b) => {
          const dateStr = b.eventDate ? new Date(b.eventDate).toISOString().split("T")[0] : null;
          if (!dateStr || !b.slotStartTime || !b.slotEndTime) return null;
          return {
            id: `booking-${b.id}`,
            title: `${b.customerName || "Booking"} (${b.groupSize || 0} ppl)`,
            description: b.locationName || "",
            startTime: new Date(`${dateStr}T${b.slotStartTime}`),
            endTime: new Date(`${dateStr}T${b.slotEndTime}`),
            locationName: b.locationName,
            status: b.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED",
          };
        }).filter(Boolean);
      } catch (err) {
        console.log("[Calendar] Bookings model not available for iCal feed, skipping");
      }

      const allEvents = [...calendarEvents, ...bookingEvents];
      const ical = generateICalFeed(allEvents, { calendarName, domain });

      res.set("Content-Type", "text/calendar; charset=utf-8");
      res.set("Content-Disposition", `attachment; filename="${domain}-events.ics"`);
      console.log(`[Calendar] Generated iCal feed: ${allEvents.length} events (${calendarEvents.length} calendar + ${bookingEvents.length} bookings)`);
      return res.send(ical);
    } catch (error) {
      console.error("[Calendar] Error generating iCal:", error.message);
      return res.status(500).json({ error: "Error generating calendar feed" });
    }
  });

  /**
   * GET /api/calendar/blocked
   * Public endpoint returning blocked/unavailable calendar events (e.g. iCal synced).
   * Anonymises titles for public consumption - admin sees real names.
   */
  router.get("/blocked", async (req, res) => {
    try {
      const now = new Date();
      const futureLimit = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      const events = await prisma[modelName].findMany({
        where: {
          slotStatus: "BLOCKED",
          startTime: { gte: now, lte: futureLimit },
        },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          isPublic: true,
          externalSource: true,
        },
        orderBy: { startTime: "asc" },
        take: 500,
      });

      console.log(`[Calendar] Returning ${events.length} blocked events`);
      return res.json({ events });
    } catch (error) {
      console.error("[Calendar] Error fetching blocked events:", error.message);
      return res.status(500).json({ error: "Error fetching blocked events" });
    }
  });

  // ─── ADMIN ENDPOINTS ──────────────────────────────────────────────────────

  /**
   * POST /api/calendar
   * Create a calendar event.
   */
  router.post("/", adminGuard, async (req, res) => {
    try {
      const {
        title, description, startTime, endTime, timezone,
        productId, eventId, experienceId, maxCapacity,
        locationId, locationName, isVirtual, meetingUrl,
        isPublic, providerId,
      } = req.body;

      if (!title || !startTime || !endTime) {
        return res.status(400).json({ error: "Missing required fields: title, startTime, endTime" });
      }

      // Build data object — only include FK fields if provided (varies by site schema)
      const data = {
        title,
        description: description || null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        timezone: timezone || "Europe/London",
        maxCapacity: maxCapacity ? parseInt(maxCapacity) : null,
        currentBookings: 0,
        locationId: locationId || null,
        locationName: locationName || null,
        isVirtual: isVirtual || false,
        meetingUrl: meetingUrl || null,
        status: "SCHEDULED",
        isPublic: isPublic !== false,
      };

      // Site-specific FK fields — only set if provided
      if (productId) data.productId = productId;
      if (eventId) data.eventId = eventId;
      if (experienceId) data.experienceId = experienceId;
      if (providerId) data.providerId = providerId;

      const event = await prisma.calendarEvent.create({ data });

      console.log(`[Calendar] Created event: ${event.title} (${event.id})`);
      return res.status(201).json(event);
    } catch (error) {
      console.error("[Calendar] Error creating event:", error.message);
      return res.status(500).json({ error: "Error creating calendar event" });
    }
  });

  /**
   * PUT /api/calendar/:id
   * Update a calendar event.
   */
  router.put("/:id", adminGuard, async (req, res) => {
    try {
      const {
        title, description, startTime, endTime, timezone,
        maxCapacity, locationId, locationName, isVirtual, meetingUrl,
        status, isPublic,
      } = req.body;

      const existing = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: "Calendar event not found" });

      const event = await prisma.calendarEvent.update({
        where: { id: req.params.id },
        data: {
          title, description,
          startTime: startTime ? new Date(startTime) : undefined,
          endTime: endTime ? new Date(endTime) : undefined,
          timezone, maxCapacity: maxCapacity !== undefined ? parseInt(maxCapacity) : undefined,
          locationId, locationName, isVirtual, meetingUrl, status, isPublic,
        },
      });

      console.log(`[Calendar] Updated event: ${event.title}`);
      return res.json(event);
    } catch (error) {
      console.error("[Calendar] Error updating event:", error.message);
      return res.status(500).json({ error: "Error updating calendar event" });
    }
  });

  /**
   * DELETE /api/calendar/:id
   * Cancel (soft-delete) a calendar event.
   */
  router.delete("/:id", adminGuard, async (req, res) => {
    try {
      const existing = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: "Calendar event not found" });

      await prisma.calendarEvent.update({
        where: { id: req.params.id },
        data: { status: "CANCELLED" },
      });

      console.log(`[Calendar] Cancelled event: ${existing.title}`);
      return res.json({ message: "Event cancelled" });
    } catch (error) {
      console.error("[Calendar] Error cancelling event:", error.message);
      return res.status(500).json({ error: "Error cancelling calendar event" });
    }
  });

  // ─── CROSS-BRAND ENDPOINTS ────────────────────────────────────────────────

  /**
   * GET /api/calendar/availability/:date/supplier/:supplierId
   * Check supplier availability on a date (cross-brand).
   */
  router.get("/availability/:date/supplier/:supplierId", controller.supplierAvailability);

  /**
   * GET /api/calendar/unavailable/:supplierId
   * Get unavailable dates for a supplier. ?startDate=&endDate=
   */
  router.get("/unavailable/:supplierId", controller.supplierUnavailableDates);

  // ─── SLOT ENDPOINTS ─────────────────────────────────────────────────────

  /**
   * POST /api/calendar/slots/:id/pencil
   * Pencil (temporarily hold) a slot.
   */
  router.post("/slots/:id/pencil", adminGuard, controller.pencil);

  /**
   * POST /api/calendar/slots/:id/block
   * Block a slot permanently.
   */
  router.post("/slots/:id/block", adminGuard, controller.block);

  /**
   * POST /api/calendar/slots/:id/release
   * Release a slot back to available.
   */
  router.post("/slots/:id/release", adminGuard, controller.release);

  /**
   * GET /api/calendar/slots/expired
   * List all expired pencilled slots.
   */
  router.get("/slots/expired", adminGuard, controller.listExpired);

  /**
   * POST /api/calendar/slots/release-expired
   * Release all expired pencilled slots.
   */
  router.post("/slots/release-expired", adminGuard, controller.releaseAllExpired);

  // ─── SYNC ENDPOINTS ─────────────────────────────────────────────────────

  /**
   * POST /api/calendar/sync/google
   * Trigger Google Calendar sync.
   */
  router.post("/sync/google", adminGuard, controller.triggerGoogleSync);

  /**
   * POST /api/calendar/sync/ical
   * Trigger iCal feed sync.
   */
  router.post("/sync/ical", adminGuard, controller.triggerICalSync);

  return router;
}

module.exports = { createCalendarRoutes };
