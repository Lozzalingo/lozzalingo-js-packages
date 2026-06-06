/**
 * Payment controller factory.
 *
 * Creates Express request handlers for Stripe payment operations.
 * Covers checkout sessions, invoice creation, webhook handling,
 * and session retrieval.
 *
 * Sites pass database operations via webhookHandlers so each site
 * decides what happens on payment events.
 */

const Stripe = require("stripe");
const { createCheckoutSession, retrieveSession } = require("./services/checkout");
const { createFullInvoice } = require("./services/invoicing");
const { verifyWebhookSignature } = require("./services/webhooks");

/**
 * Create a payment controller.
 * @param {object} options
 * @param {string} options.stripeSecretKey
 * @param {string} options.webhookSecret
 * @param {string} options.currency - Default currency (default: "gbp")
 * @param {string} options.successUrl - Default success redirect
 * @param {string} options.cancelUrl - Default cancel redirect
 * @param {string} options.baseUrl - For building absolute URLs
 * @param {object} options.webhookHandlers - Map of event type to async handler
 * @param {string} options.invoiceFooter - Custom footer for invoices (e.g. bank details)
 * @returns {object} Controller with request handlers
 */
function createPaymentController(options = {}) {
  const {
    stripeSecretKey,
    webhookSecret,
    currency = "gbp",
    successUrl = "/book/success?session_id={CHECKOUT_SESSION_ID}",
    cancelUrl = "/book?cancelled=true",
    baseUrl = "",
    webhookHandlers = {},
    invoiceFooter,
  } = options;

  console.log("[Payments] Initialising payment controller");

  const stripe = new Stripe(stripeSecretKey);

  /**
   * Build an absolute URL from a relative path.
   */
  function buildUrl(path) {
    if (path && path.startsWith("http")) {
      return path;
    }
    return `${baseUrl}${path}`;
  }

  /**
   * POST /checkout - Create a checkout session for a booking.
   */
  async function checkout(req, res) {
    try {
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
        imageUrl,
        successUrl: overrideSuccess,
        cancelUrl: overrideCancel,
      } = req.body;

      if (!eventTitle || !priceInPence) {
        console.error("[Payments] Checkout rejected - missing eventTitle or priceInPence");
        return res.status(400).json({ error: "eventTitle and priceInPence are required" });
      }

      const result = await createCheckoutSession(stripe, {
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
        imageUrl,
        successUrl: buildUrl(overrideSuccess || successUrl),
        cancelUrl: buildUrl(overrideCancel || cancelUrl),
        currency,
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error("[Payments] Checkout failed:", error.message);
      return res.status(500).json({ error: "Failed to create checkout session" });
    }
  }

  /**
   * GET /checkout/session - Retrieve a checkout session by ID.
   */
  async function getSession(req, res) {
    try {
      const { session_id } = req.query;

      if (!session_id) {
        console.error("[Payments] Get session rejected - missing session_id");
        return res.status(400).json({ error: "session_id query parameter is required" });
      }

      const session = await retrieveSession(stripe, session_id);

      return res.status(200).json(session);
    } catch (error) {
      console.error("[Payments] Get session failed:", error.message);
      return res.status(500).json({ error: "Failed to retrieve checkout session" });
    }
  }

  /**
   * GET /checkout/status - Check if Stripe is configured.
   */
  async function getStatus(req, res) {
    const configured = Boolean(stripeSecretKey);
    console.log(`[Payments] Status check - configured: ${configured}`);
    return res.status(200).json({ configured });
  }

  /**
   * POST /webhook - Stripe webhook receiver.
   * Handles: checkout.session.completed, checkout.session.expired, invoice.paid.
   */
  async function handleWebhook(req, res) {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      console.error("[Payments] Webhook rejected - missing stripe-signature header");
      return res.status(400).json({ error: "Missing stripe-signature header" });
    }

    if (!webhookSecret) {
      console.error("[Payments] Webhook rejected - webhook secret not configured");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }

    let event;

    try {
      event = verifyWebhookSignature(stripe, req.body, sig, webhookSecret);
    } catch (error) {
      console.error("[Payments] Webhook signature verification failed:", error.message);
      return res.status(400).json({ error: "Invalid signature" });
    }

    console.log(`[Payments] Webhook verified: ${event.type} (${event.id})`);

    const handler = webhookHandlers[event.type];
    if (handler) {
      try {
        await handler(event.data.object, event);
      } catch (error) {
        console.error(`[Payments] Webhook handler failed for ${event.type}:`, error.message);
        // Still return 200 - do not make Stripe retry for app errors
      }
    } else {
      console.log(`[Payments] Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  }

  /**
   * POST /admin/invoice - Create and send a Stripe invoice.
   * Expects: { lineItems, discountPence, daysUntilDue, customerEmail, customerName,
   *            customerPhone, companyName, productName, metadata }
   */
  async function createInvoice(req, res) {
    try {
      const {
        lineItems,
        discountPence,
        daysUntilDue,
        customerEmail,
        customerName,
        customerPhone,
        companyName,
        productName,
        metadata,
      } = req.body;

      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        console.error("[Payments] Invoice rejected - missing or empty lineItems");
        return res.status(400).json({ error: "lineItems array is required" });
      }

      if (!customerEmail) {
        console.error("[Payments] Invoice rejected - missing customerEmail");
        return res.status(400).json({ error: "customerEmail is required" });
      }

      console.log(`[Payments] Creating invoice for ${customerEmail}`);

      const invoice = await createFullInvoice(stripe, {
        customerEmail,
        customerName: customerName || "Customer",
        customerPhone,
        companyName,
        productName,
        lineItems,
        discountPence,
        daysUntilDue: daysUntilDue || 1,
        metadata: metadata || {},
        footer: invoiceFooter,
      });

      console.log(`[Payments] Invoice created: ${invoice.number} - hosted URL: ${invoice.hosted_invoice_url}`);

      return res.status(200).json({
        invoice: {
          id: invoice.id,
          number: invoice.number,
          amountDue: invoice.amount_due,
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          dueDate: invoice.due_date,
        },
      });
    } catch (error) {
      console.error("[Payments] Invoice creation failed:", error.message);
      return res.status(500).json({ error: "Failed to create invoice" });
    }
  }

  return {
    checkout,
    getSession,
    getStatus,
    handleWebhook,
    createInvoice,
  };
}

module.exports = { createPaymentController };
