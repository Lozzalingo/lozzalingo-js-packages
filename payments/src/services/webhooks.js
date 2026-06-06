/**
 * Webhook service - verifies Stripe webhook signatures and dispatches events.
 *
 * Handles: checkout.session.completed, checkout.session.expired, invoice.paid.
 * Sites register handlers via webhookHandlers option to decide what happens on each event.
 */

/**
 * Verify and parse a Stripe webhook event.
 * @param {Stripe} stripe
 * @param {Buffer} rawBody
 * @param {string} signature - stripe-signature header
 * @param {string} webhookSecret
 * @returns {Stripe.Event}
 * @throws {Error} If signature is invalid
 */
function verifyWebhookSignature(stripe, rawBody, signature, webhookSecret) {
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

module.exports = { verifyWebhookSignature };
