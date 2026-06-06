/**
 * @lozzalingo/orders - Order Routes
 */

const express = require('express');
const { createOrderController } = require('./orders.controller');

function createOrderRoutes(prisma, options = {}) {
  const router = express.Router();
  const controller = createOrderController(prisma, options);

  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);
  router.post('/:id/resend', controller.resendConfirmation);

  return router;
}

module.exports = { createOrderRoutes };
