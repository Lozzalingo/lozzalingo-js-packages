/**
 * Webhook service - verifies payment callbacks from the centralised Payments service.
 *
 * The centralised payments service sends callbacks with HMAC signatures
 * using the shared API key. The PaymentsClient.verifyCallback() method
 * handles verification.
 *
 * This module is kept for backwards compatibility but most sites should
 * use createPaymentCallbackHandler() from the payments-client instead.
 */

const { PaymentsClient } = require("@lozzalingo/payments/server/payments-client");

/**
 * Verify a payment callback from the centralised service.
 * @param {object} _stripe - DEPRECATED: ignored, kept for backwards compat
 * @param {object} req - Express request object
 * @returns {object} Parsed callback data with event_type
 * @throws {Error} If signature is invalid
 */
function verifyWebhookSignature(_stripe, req) {
  const client = new PaymentsClient();
  const data = client.verifyCallback(req);

  if (!data) {
    throw new Error("Invalid payment callback signature");
  }

  // Return in a format compatible with existing webhook handlers
  return {
    type: data.event_type,
    id: data.session_id,
    data: {
      object: {
        id: data.session_id,
        metadata: data.metadata,
        customer_email: data.customer_email,
        line_items: data.line_items,
      },
    },
  };
}

module.exports = { verifyWebhookSignature };
