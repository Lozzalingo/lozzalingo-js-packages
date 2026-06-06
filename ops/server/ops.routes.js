/**
 * @lozzalingo/ops - Operations Routes
 */

const express = require('express');
const { createOpsController } = require('./ops.controller');

function createOpsRoutes(prisma, options = {}) {
  const router = express.Router();
  const controller = createOpsController(prisma, options);

  // Public health check
  router.get('/health', controller.healthCheck);

  // Admin routes
  router.get('/detailed', controller.detailedHealth);
  router.get('/errors', controller.getRecentErrors);
  router.get('/alerts', controller.getAlerts);
  router.post('/docker-cleanup', controller.dockerCleanup);

  return router;
}

module.exports = { createOpsRoutes };
