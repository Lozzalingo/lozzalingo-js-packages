/**
 * Visitor Analytics Routes (Shared)
 * Factory pattern - creates Express router with injected prisma and options
 */
const express = require("express");
const { createVisitorController } = require("./visitors.controller");

/**
 * Create visitor analytics routes
 * @param {object} prisma - PrismaClient instance
 * @param {object} options - Configuration options
 * @param {string} options.siteDomain - Site domain for referrer filtering (e.g. 'fatbigquiz.com')
 * @param {object} options.features - Feature flags (e.g. { ecommerce: true })
 * @returns {express.Router}
 */
function createVisitorRoutes(prisma, options = {}) {
  const router = express.Router();
  const controller = createVisitorController(prisma, options);

  // Tracking endpoints
  router.post("/track", controller.trackView);
  router.post("/update", controller.updateVisitor);
  router.post("/event", controller.trackEvent);

  // Analytics data endpoints
  router.get("/change", controller.getVisitorChange);
  router.get("/overview", controller.getOverviewStats);
  router.get("/devices", controller.getDeviceStats);
  router.get("/geographic", controller.getGeographicStats);
  router.get("/timeline", controller.getTrafficTimeline);
  router.get("/referrers", controller.getReferrerStats);
  router.get("/pages", controller.getTopPages);
  router.get("/ecommerce", controller.getEcommerceFunnel);
  router.get("/activity", controller.getRecentActivity);
  router.get("/bots", controller.getBotStats);
  router.get("/interactions", controller.getInteractionStats);
  router.get("/summary", controller.getSummary);

  return router;
}

module.exports = { createVisitorRoutes };
