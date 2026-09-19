/**
 * Payment controller factory.
 *
 * Creates Express request handlers for payment operations via the
 * centralised Payments service.
 *
 * Sites pass database operations via webhookHandlers so each site
 * decides what happens on payment events.
 */

const { PaymentsClient, createPaymentCallbackHandler } = require("@lozzalingo/payments/server/payments-client");

/**
 * Create a payment controller.
 * @param {object} options
 * @param {string} options.currency - Default currency (default: "gbp")
 * @param {string} options.successUrl - Default success redirect
 * @param {string} options.cancelUrl - Default cancel redirect
 * @param {string} options.baseUrl - For building absolute URLs
 * @param {object} options.webhookHandlers - Map of event type to async handler
 * @param {string} options.invoiceFooter - Custom footer for invoices
 * @returns {object} Controller with request handlers
 */
function createPaymentController(options = {}) {
  const {
    currency = "gbp",
    successUrl = "/book/success?session_id={CHECKOUT_SESSION_ID}",
    cancelUrl = "/book?cancelled=true",
    baseUrl = "",
    webhookHandlers = {},
    invoiceFooter,
  } = options;

  console.log("[Payments] Initialising payment controller (centralised service)");

  const payments = new PaymentsClient();

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

      console.log(`[Payments] Creating checkout for "${eventTitle}" - ${groupSize} people, ${priceInPence}p`);

      const result = await payments.createCheckout({
        lineItems: [{ name: eventTitle, pricePence: priceInPence, quantity: 1 }],
        successUrl: buildUrl(overrideSuccess || successUrl),
        cancelUrl: buildUrl(overrideCancel || cancelUrl),
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
        console.error("[Payments] Checkout failed - no response from payments service");
        return res.status(502).json({ error: "Failed to create checkout session" });
      }

      console.log(`[Payments] Checkout session created: ${result.sessionId}`);
      return res.status(200).json({ sessionId: result.sessionId, url: result.checkoutUrl });
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

      const session = await payments.getSession(session_id);

      if (!session) {
        console.error("[Payments] Session not found:", session_id);
        return res.status(404).json({ error: "Session not found" });
      }

      return res.status(200).json(session);
    } catch (error) {
      console.error("[Payments] Get session failed:", error.message);
      return res.status(500).json({ error: "Failed to retrieve checkout session" });
    }
  }

  /**
   * GET /checkout/status - Check if payments service is configured.
   */
  async function getStatus(req, res) {
    const configured = Boolean(payments.url && payments.key);
    console.log(`[Payments] Status check - configured: ${configured}`);
    return res.status(200).json({ configured });
  }

  /**
   * POST /webhook - Payment callback handler.
   * Receives callbacks from the centralised payments service.
   */
  const handleWebhook = createPaymentCallbackHandler({
    onSuccess: async (data) => {
      const sessionId = data.session_id || data.sessionId;
      const metadata = data.metadata || {};
      const customerEmail = data.customer_email || "";
      const lineItems = data.line_items || [];
      console.log(`[Payments] Payment succeeded for session: ${sessionId}`);
      const handler = webhookHandlers["checkout.session.completed"];
      if (handler) {
        // Build a session-like object for backwards compatibility
        await handler({
          id: sessionId,
          metadata,
          customer_email: customerEmail,
          line_items: lineItems,
        }, { type: "checkout.session.completed" });
      }
    },
    onFailure: async (data) => {
      const sessionId = data.session_id || data.sessionId;
      const eventType = data.event_type || "";
      const metadata = data.metadata || {};
      console.log(`[Payments] Payment event ${eventType} for session: ${sessionId}`);
      const handler = webhookHandlers[eventType];
      if (handler) {
        await handler({ id: sessionId, metadata }, { type: eventType });
      }
    },
    client: payments,
  });

  /**
   * POST /admin/invoice - Create and send an invoice.
   * TODO: Invoice creation via centralised service not yet implemented.
   * For now this returns a 501 until the payments service supports invoicing.
   */
  async function createInvoice(req, res) {
    // TODO: Wire invoice creation through centralised payments service
    // The payments service needs an /api/payments/invoice endpoint first.
    console.error("[Payments] Invoice creation via centralised service not yet supported");
    return res.status(501).json({ error: "Invoice creation not yet available via centralised service" });
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
