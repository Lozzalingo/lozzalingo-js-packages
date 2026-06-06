/**
 * @lozzalingo/merchandise - Product Routes
 */

const express = require('express');
const { createMerchandiseController } = require('./merchandise.controller');

function createMerchandiseRoutes(prisma, storageService, options = {}) {
  const router = express.Router();
  const controller = createMerchandiseController(prisma, storageService, options);

  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);
  router.post('/reorder', controller.reorder);
  router.post('/:id/images', controller.uploadImages);

  return router;
}

module.exports = { createMerchandiseRoutes };
