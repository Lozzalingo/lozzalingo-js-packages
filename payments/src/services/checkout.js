/**
 * Checkout service - creates Stripe checkout sessions for one-off payments.
 *
 * Creates a Stripe checkout session with a single line item for the event
 * metadata (eventTitle, customerEmail, groupSize, eventDate, priceInPence,
 * productSlug, packageSlug).
 */

/**
 * Create a Stripe checkout session for a booking.
 * @param {Stripe} stripe - Stripe instance
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
 * @param {string} [params.imageUrl] - Product image URL for Stripe checkout
 * @returns {Promise<{sessionId: string, url: string}>}
 */
async function createCheckoutSession(stripe, params) {
  const {
    eventTitle,
    customerEmail,
    customerName,
    groupSize,
    eventDate,
    priceInPence,
    customerPhone,
    companyName,
    message,
    productSlug,
    packageSlug,
    successUrl,
    cancelUrl,
    currency = "gbp",
    imageUrl,
  } = params;

  console.log(`[Payments] Creating checkout session for "${eventTitle}" - ${groupSize} people, ${priceInPence}p`);

  const formattedDate = new Date(eventDate).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: eventTitle,
            description: `Booking for ${groupSize} people on ${formattedDate}`,
            ...(imageUrl ? { images: [imageUrl] } : {}),
          },
          unit_amount: priceInPence,
        },
        quantity: 1,
      },
    ],
    metadata: {
      customerName: customerName || "",
      customerEmail: customerEmail || "",
      customerPhone: customerPhone || "",
      companyName: companyName || "",
      groupSize: String(groupSize),
      eventDate: eventDate || "",
      message: message || "",
      productSlug: productSlug || "",
      packageSlug: packageSlug || "",
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  console.log(`[Payments] Checkout session created: ${session.id}`);

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Retrieve a Stripe checkout session by ID.
 * @param {Stripe} stripe - Stripe instance
 * @param {string} sessionId
 * @returns {Promise<object>} Stripe session with expanded line_items
 */
async function retrieveSession(stripe, sessionId) {
  console.log(`[Payments] Retrieving session: ${sessionId}`);

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  });

  console.log(`[Payments] Session retrieved: status=${session.payment_status}`);
  return session;
}

module.exports = { createCheckoutSession, retrieveSession };
