/**
 * External API Routes
 *
 * Two sets of routes:
 * 1. Public API (X-API-Key auth) - /articles CRUD
 * 2. Admin API (session/admin auth) - API key management
 *
 * Usage:
 *   const { createExternalApiRoutes } = require('@lozzalingo/external-api/routes');
 *   const { apiRouter, adminRouter } = createExternalApiRoutes(prisma, options);
 *   app.use('/api/external', apiRouter);
 *   app.use('/api/admin/api-keys', adminRouter);
 */

const express = require("express");
const { createExternalApiController } = require("./controller");

function createExternalApiRoutes(prisma, options = {}) {
  const { authMiddleware } = options;
  const controller = createExternalApiController(prisma, options);

  // ── Public API Router (API key authenticated) ────────────────────────────────

  const apiRouter = express.Router();

  apiRouter.get("/articles", controller.requireApiKey, controller.getArticles);
  apiRouter.get("/articles/:id", controller.requireApiKey, controller.getArticleById);
  apiRouter.post("/articles", controller.requireApiKey, controller.createArticle);
  apiRouter.put("/articles/:id", controller.requireApiKey, controller.updateArticle);
  apiRouter.delete("/articles/:id", controller.requireApiKey, controller.deleteArticle);

  // ── Admin Router (session/admin key authenticated) ───────────────────────────

  const adminRouter = express.Router();
  const adminGuard = authMiddleware || ((req, res, next) => next());

  adminRouter.get("/", adminGuard, controller.listApiKeys);
  adminRouter.post("/", adminGuard, controller.createApiKey);
  adminRouter.delete("/:id", adminGuard, controller.revokeApiKey);
  adminRouter.delete("/:id/permanent", adminGuard, controller.deleteApiKey);

  console.log("[ExternalAPI] Routes created");

  return { apiRouter, adminRouter, controller };
}

module.exports = { createExternalApiRoutes };
