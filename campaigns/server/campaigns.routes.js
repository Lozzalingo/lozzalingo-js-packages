/**
 * Campaign Routes
 *
 * Factory pattern: returns { adminRouter, trackingRouter }
 * - adminRouter: CRUD, sending, stats (behind auth middleware)
 * - trackingRouter: open pixel + click tracking (public, no auth)
 */

const express = require("express");
const { createCampaignsController } = require("./campaigns.controller");

/**
 * Create campaign routes.
 *
 * @param {object} prisma - PrismaClient instance
 * @param {object} emailService - Email service from @lozzalingo/email
 * @param {object} options
 * @param {Function} options.authMiddleware - Admin auth guard
 * @param {string} options.brandName - Brand name for emails
 * @param {object} options.style - Email style config
 * @param {string} options.websiteUrl - Site base URL
 * @param {string} options.trackingSecret - HMAC secret
 * @param {Array} options.variables - Custom template variables
 * @param {number} options.inactiveThreshold - Campaigns before "inactive"
 * @returns {{ adminRouter: Router, trackingRouter: Router }}
 */
function createCampaignsRoutes(prisma, emailService, options = {}) {
  const adminRouter = express.Router();
  const trackingRouter = express.Router();

  const controller = createCampaignsController(prisma, emailService, options);

  // Auth middleware (falls back to no-op if not provided)
  const adminGuard = options.authMiddleware || ((req, res, next) => next());

  // ── Admin Routes ──────────────────────────────────────────────────────────

  // These must come before /:id to avoid route conflicts
  adminRouter.get("/subscriber-count", adminGuard, controller.getSubscriberCount);
  adminRouter.get("/variables", adminGuard, controller.getVariables);
  adminRouter.get("/inactive-subscribers", adminGuard, controller.getInactiveSubscribers);
  adminRouter.post("/preview", adminGuard, controller.previewBlocks);
  adminRouter.post("/deactivate-inactive", adminGuard, controller.deactivateInactive);

  // CRUD
  adminRouter.get("/", adminGuard, controller.listCampaigns);
  adminRouter.post("/", adminGuard, controller.createCampaign);
  adminRouter.get("/:id", adminGuard, controller.getCampaign);
  adminRouter.put("/:id", adminGuard, controller.updateCampaign);
  adminRouter.delete("/:id", adminGuard, controller.deleteCampaign);

  // Sending
  adminRouter.post("/:id/send", adminGuard, controller.sendCampaign);
  adminRouter.post("/:id/send-test", adminGuard, controller.sendTestCampaign);
  adminRouter.post("/:id/duplicate", adminGuard, controller.duplicateCampaign);

  // Stats
  adminRouter.get("/:id/stats", adminGuard, controller.getCampaignStats);

  // ── Public Tracking Routes ────────────────────────────────────────────────

  trackingRouter.get("/open/:trackingId", controller.trackOpen);
  trackingRouter.get("/click/:trackingId", controller.trackClick);

  return { adminRouter, trackingRouter };
}

module.exports = { createCampaignsRoutes };
