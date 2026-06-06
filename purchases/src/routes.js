const express = require("express");
const { createPurchaseController } = require("./controller");

function createPurchaseRoutes(prisma, options = {}) {
  const router = express.Router();
  const { authMiddleware } = options;
  const controller = createPurchaseController(prisma, options);

  // Auth guard - falls back to no-op if not provided
  const adminGuard = authMiddleware || ((req, res, next) => next());

  // Public routes
  router.get("/download/:token", controller.downloadByToken);
  router.get("/session/:sessionId", controller.getBySessionId);
  router.get("/email/:email", controller.getByEmail);

  // Admin routes
  router.get("/admin", adminGuard, controller.getAll);
  router.get("/admin/:id", adminGuard, controller.getById);
  router.post("/admin/:id/reset-downloads", adminGuard, controller.resetDownloads);
  router.post("/admin/:id/extend", adminGuard, controller.extendExpiry);
  router.post("/admin/:id/revoke", adminGuard, controller.revokeAccess);

  return router;
}

module.exports = { createPurchaseRoutes };
