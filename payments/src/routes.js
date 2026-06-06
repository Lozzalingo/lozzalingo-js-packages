/**
 * Payment routes factory.
 *
 * Creates an Express router with all payment endpoints.
 * This package does NOT take prisma as first arg - it is Stripe-focused.
 * Sites pass database operations via webhookHandlers.
 */

const express = require("express");
const { createPaymentController } = require("./controller");

/**
 * Create payment routes.
 * @param {object} options
 * @param {string} options.stripeSecretKey
 * @param {string} options.webhookSecret
 * @param {string} options.currency - Default currency (default: "gbp")
 * @param {string} options.successUrl - Default success redirect
 * @param {string} options.cancelUrl - Default cancel redirect
 * @param {string} options.baseUrl - For building absolute URLs
 * @param {Function} options.authMiddleware - For admin-only routes
 * @param {object} options.webhookHandlers - Map of event type to async handler
 * @param {string} options.invoiceFooter - Custom footer for invoices
 * @returns {express.Router}
 */
function createPaymentRoutes(options = {}) {
  const router = express.Router();
  const { authMiddleware } = options;
  const controller = createPaymentController(options);

  console.log("[Payments] Mounting payment routes");

  // Auth guard - falls back to no-op if not provided
  const adminGuard = authMiddleware || ((req, res, next) => next());

  // Public routes
  router.post("/checkout", controller.checkout);
  router.get("/checkout/session", controller.getSession);
  router.get("/checkout/status", controller.getStatus);

  // Webhook route - no auth, verified by Stripe signature
  router.post("/webhook", controller.handleWebhook);

  // Admin routes
  router.post("/admin/invoice", adminGuard, controller.createInvoice);

  return router;
}

module.exports = { createPaymentRoutes };
