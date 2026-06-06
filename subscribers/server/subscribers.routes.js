/**
 * @lozzalingo/subscribers - Subscriber Routes
 */

const express = require('express');
const { createSubscriberController } = require('./subscribers.controller');

function createSubscriberRoutes(prisma, options = {}) {
  const router = express.Router();
  const controller = createSubscriberController(prisma, options);

  // Public routes
  router.post('/', controller.subscribe);
  router.get('/feeds', controller.getFeeds);

  // Admin routes
  router.get('/', controller.getAll);
  router.get('/stats', controller.getStats);
  router.get('/export', controller.exportCsv);
  router.get('/popup-config', controller.getPopupConfig);
  router.post('/popup-config', controller.savePopupConfig);
  router.put('/:email', controller.updateByEmail);
  router.delete('/:email', controller.unsubscribe);

  return router;
}

module.exports = { createSubscriberRoutes };
