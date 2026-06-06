/**
 * @lozzalingo/payments
 *
 * Stripe integration for checkout sessions, invoicing, and webhook handling.
 */

const { createPaymentRoutes } = require("./routes");
const { createPaymentController } = require("./controller");
const { createCheckoutSession, retrieveSession } = require("./services/checkout");
const {
  findOrCreateStripeCustomer,
  createInvoiceItems,
  createAndFinaliseInvoice,
  createFullInvoice,
} = require("./services/invoicing");
const { verifyWebhookSignature } = require("./services/webhooks");

module.exports = {
  createPaymentRoutes,
  createPaymentController,
  createCheckoutSession,
  retrieveSession,
  findOrCreateStripeCustomer,
  createInvoiceItems,
  createAndFinaliseInvoice,
  createFullInvoice,
  verifyWebhookSignature,
};
