/**
 * Checkout service - creates checkout sessions via the centralised Payments service.
 * Replaces direct Stripe SDK calls.
 */

const { PaymentsClient } = require("@lozzalingo/payments/server/payments-client");

/**
 * Create a checkout session for a booking via the payments service.
 * @param {object} _stripe - DEPRECATED: ignored, kept for backwards compat
 * @param {object} params
 * @param {string} params.eventTitle - Name shown on checkout
 * @param {string} params.customerEmail
 * @param {string} params.customerName
 * @param {number} params.groupSize
 * @param {string} params.eventDate - ISO date string
 * @param {number} params.priceInPence - Total price in pence
 * @param {string} params.customerPhone
 * @param {string} params.companyName
 * @param {string} params.message
 * @param {string} params.productSlug
 * @param {string} params.packageSlug
 * @param {string} params.successUrl - Absolute URL
 * @param {string} params.cancelUrl - Absolute URL
 * @param {string} params.currency
 * @param {string} [params.imageUrl] - Product image URL
 * @returns {Promise<{sessionId: string, url: string}>}
 */
async function createCheckoutSession(_stripe, params) {
  const {
    eventTitle,
    customerEmail,
    groupSize,
    eventDate,
    priceInPence,
    customerName,
    customerPhone,
    companyName,
    message,
    productSlug,
    packageSlug,
    successUrl,
    cancelUrl,
    currency = "gbp",
  } = params;

  console.log(`[Payments] Creating checkout session for "${eventTitle}" - ${groupSize} people, ${priceInPence}p`);

  const payments = new PaymentsClient();

  const result = await payments.createCheckout({
    lineItems: [{ name: eventTitle, pricePence: priceInPence, quantity: 1 }],
    successUrl,
    cancelUrl,
    customerEmail,
    currency,
    metadata: {
      customerName: customerName || "",
      customerEmail: customerEmail || "",
      customerPhone: customerPhone || "",
      companyName: companyName || "",
      groupSize: String(groupSize || ""),
      eventDate: eventDate || "",
      message: message || "",
      productSlug: productSlug || "",
      packageSlug: packageSlug || "",
    },
  });

  if (!result) {
    throw new Error("Failed to create checkout session via payments service");
  }

  console.log(`[Payments] Checkout session created: ${result.sessionId}`);

  return {
    sessionId: result.sessionId,
    url: result.checkoutUrl,
  };
}

/**
 * Retrieve a checkout session by ID via the payments service.
 * @param {object} _stripe - DEPRECATED: ignored, kept for backwards compat
 * @param {string} sessionId
 * @returns {Promise<object>}
 */
async function retrieveSession(_stripe, sessionId) {
  console.log(`[Payments] Retrieving session: ${sessionId}`);

  const payments = new PaymentsClient();
  const session = await payments.getSession(sessionId);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  console.log(`[Payments] Session retrieved: status=${session.payment_status || session.status}`);
  return session;
}

module.exports = { createCheckoutSession, retrieveSession };
