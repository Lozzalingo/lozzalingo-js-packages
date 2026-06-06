const express = require("express");
const { createExperienceController } = require("./controller");

/**
 * Create experience routes with the given Prisma client and options.
 * Product/package/image/section/theme routes.
 *
 * @param {object} prisma - Prisma client instance
 * @param {object} options - Configuration options
 * @returns {express.Router} Express router
 */
function createExperienceRoutes(prisma, options = {}) {
  const router = express.Router();
  const { authMiddleware } = options;
  const controller = createExperienceController(prisma, options);

  // Auth guard - falls back to no-op if not provided
  const adminGuard = authMiddleware || ((req, res, next) => next());

  // ── Public product routes ───────────────────────────────────────────────
  router.get("/products", controller.getAllProducts);
  router.get("/products/slug/:slug", controller.getProductBySlug);
  router.get("/products/:id", controller.getProductById);

  // ── Public package routes ───────────────────────────────────────────────
  router.get("/packages/product/:productId", controller.getPackagesByProduct);
  router.get("/packages/:id", controller.getPackageById);

  // ── Admin product routes ────────────────────────────────────────────────
  router.get("/admin/products", adminGuard, controller.getAllProductsAdmin);
  router.post("/admin/products", adminGuard, controller.createProduct);
  router.put("/admin/products/:id", adminGuard, controller.updateProduct);
  router.put("/admin/products/:id/toggle", adminGuard, controller.toggleProduct);
  router.delete("/admin/products/:id", adminGuard, controller.deleteProduct);

  // ── Admin product image routes ──────────────────────────────────────────
  router.get("/admin/products/:id/images", adminGuard, controller.getProductImages);
  router.post("/admin/products/:id/images", adminGuard, controller.addProductImages);
  router.put("/admin/products/:id/images/reorder", adminGuard, controller.reorderProductImages);
  router.delete("/admin/images/:imageId", adminGuard, controller.deleteProductImage);

  // ── Admin product section routes ────────────────────────────────────────
  router.post("/admin/products/:id/sections", adminGuard, controller.createProductSection);
  router.put("/admin/sections/:sectionId", adminGuard, controller.updateProductSection);
  router.put("/admin/products/:id/sections/reorder", adminGuard, controller.reorderProductSections);
  router.delete("/admin/sections/:sectionId", adminGuard, controller.deleteProductSection);

  // ── Admin package routes ────────────────────────────────────────────────
  router.post("/admin/packages", adminGuard, controller.createPackage);
  router.put("/admin/packages/:id", adminGuard, controller.updatePackage);
  router.delete("/admin/packages/:id", adminGuard, controller.deletePackage);

  // ── Admin theme routes ──────────────────────────────────────────────────
  router.get("/admin/themes", adminGuard, controller.getAllThemes);
  router.post("/admin/themes", adminGuard, controller.createTheme);
  router.put("/admin/themes/:id", adminGuard, controller.updateTheme);
  router.delete("/admin/themes/:id", adminGuard, controller.deleteTheme);
  router.put("/admin/products/:id/themes", adminGuard, controller.setProductThemes);

  console.log("[Experiences] Routes initialised");
  return router;
}

module.exports = { createExperienceRoutes };
