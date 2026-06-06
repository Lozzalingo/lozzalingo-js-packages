/**
 * @lozzalingo/settings - Settings Routes
 */

const express = require('express');
const { createSettingsController } = require('./settings.controller');

function createSettingsRoutes(prisma, options = {}) {
  const router = express.Router();
  const controller = createSettingsController(prisma, options);

  router.get('/', controller.getAll);
  router.get('/:key', controller.getByKey);
  router.post('/', controller.saveSetting);
  router.delete('/:key', controller.deleteSetting);
  router.post('/test-stripe', controller.testStripeConnection);
  router.post('/test-resend', controller.testResendConnection);

  return router;
}

module.exports = { createSettingsRoutes };
