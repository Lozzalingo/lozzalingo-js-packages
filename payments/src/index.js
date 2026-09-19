/**
 * @lozzalingo/payments
 *
 * Payment integration via the centralised Payments service.
 * Replaces direct Stripe SDK usage with thin client calls.
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
const { PaymentsClient, createPaymentCallbackHandler } = require("@lozzalingo/payments/server/payments-client");

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
  PaymentsClient,
  createPaymentCallbackHandler,
};
