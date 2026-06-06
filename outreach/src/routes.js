/**
 * @lozzalingo/outreach - Route Factory
 * All outreach routes are admin-only.
 */

const express = require("express");
const { createOutreachController } = require("./controller");

/**
 * Create outreach routes.
 * @param {object} prisma
 * @param {object} options
 * @param {Function} options.authMiddleware - Express middleware for admin routes
 * @param {object} options.outreachService - From createOutreachService()
 * @returns {express.Router}
 */
function createOutreachRoutes(prisma, options = {}) {
  const router = express.Router();
  const { authMiddleware } = options;
  const controller = createOutreachController(prisma, options);

  // Auth guard - falls back to no-op if not provided
  const adminGuard = authMiddleware || ((req, res, next) => next());

  // All routes are admin-only
  router.get("/log", adminGuard, controller.getLog);
  router.get("/log/booking/:bookingId", adminGuard, controller.getLogByBooking);
  router.get("/log/email/:email", adminGuard, controller.getLogByEmail);
  router.get("/scheduled", adminGuard, controller.getScheduled);
  router.post("/trigger", adminGuard, controller.manualTrigger);
  router.delete("/scheduled/:id", adminGuard, controller.cancelScheduledItem);

  console.log("[Outreach] Routes mounted");

  return router;
}

module.exports = { createOutreachRoutes };
