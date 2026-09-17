/**
 * Thin client for the centralised Payments service.
 * Replaces direct Stripe SDK usage. Sites call this to create checkouts,
 * retrieve sessions, and list transactions.
 *
 * Usage:
 *   const { PaymentsClient } = require('@lozzalingo/payments/server/payments-client');
 *
 *   const client = new PaymentsClient();
 *
 *   // Create checkout
 *   const result = await client.createCheckout({
 *     lineItems: [{ name: 'T-Shirt', pricePence: 2500, quantity: 1 }],
 *     successUrl: 'https://mysite.com/success',
 *     cancelUrl: 'https://mysite.com/cancel',
 *     customerEmail: 'buyer@example.com',
 *     metadata: { orderId: '123' },
 *   });
 *   // result = { checkoutUrl: 'https://checkout.stripe.com/...', sessionId: 'cs_...' }
 *
 *   // Check payment status
 *   const session = await client.getSession('cs_...');
 *
 *   // Get transaction history
 *   const transactions = await client.listTransactions({ limit: 20 });
 */

const crypto = require("crypto");

class PaymentsClient {
  /**
   * @param {object} [options]
   * @param {string} [options.serviceUrl] - Override PAYMENTS_SERVICE_URL env var
   * @param {string} [options.apiKey] - Override PAYMENTS_API_KEY env var
   * @param {number} [options.timeoutMs] - Request timeout in ms (default: 10000)
   */
  constructor(options = {}) {
    this.url = (
      options.serviceUrl ||
      process.env.PAYMENTS_SERVICE_URL ||
      ""
    ).replace(/\/+$/, "");
    this.key = options.apiKey || process.env.PAYMENTS_API_KEY || "";
    this.timeoutMs = options.timeoutMs || 10000;

    if (!this.url) {
      console.error("[PaymentsClient] PAYMENTS_SERVICE_URL not set");
    }
    if (!this.key) {
      console.error("[PaymentsClient] PAYMENTS_API_KEY not set");
    }
  }

  /**
   * Make an HTTP request to the payments service.
   * Returns parsed JSON on success, or null on failure.
   * Never throws - logs errors and returns null so the calling site
   * keeps working even if the payments service is down.
   *
   * @param {string} method - HTTP method
   * @param {string} path - URL path (e.g. /api/payments/checkout)
   * @param {object} [options]
   * @param {object} [options.body] - JSON body for POST requests
   * @param {object} [options.params] - Query parameters for GET requests
   * @returns {Promise<object|null>}
   */
  async _request(method, path, { body, params } = {}) {
    if (!this.url) {
      console.error("[PaymentsClient] Cannot make request, PAYMENTS_SERVICE_URL not set");
      return null;
    }

    let fullUrl = `${this.url}${path}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
          searchParams.set(k, String(v));
        }
      }
      const qs = searchParams.toString();
      if (qs) fullUrl += `?${qs}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const fetchOptions = {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Pay-Key": this.key,
        },
        signal: controller.signal,
      };

      if (body) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(fullUrl, fetchOptions);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error(
          `[PaymentsClient] HTTP ${response.status} on ${method} ${path}:`,
          text.slice(0, 500)
        );
        return null;
      }

      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        console.error(`[PaymentsClient] Request timed out: ${method} ${path}`);
      } else {
        console.error(`[PaymentsClient] Request failed: ${method} ${path}:`, error.message);
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Create a checkout session via the payments service.
   *
   * @param {object} options
   * @param {Array<{name: string, pricePence: number, quantity: number}>} options.lineItems
   * @param {string} options.successUrl - Redirect URL after successful payment
   * @param {string} options.cancelUrl - Redirect URL if customer cancels
   * @param {string} [options.customerEmail] - Pre-fill email
   * @param {object} [options.metadata] - Metadata to attach to the session
   * @param {string} [options.currency] - Currency code (default: gbp)
   * @returns {Promise<{checkoutUrl: string, sessionId: string}|null>}
   */
  async createCheckout({
    lineItems,
    successUrl,
    cancelUrl,
    customerEmail,
    metadata,
    currency = "gbp",
  }) {
    const payload = {
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      currency,
    };

    if (customerEmail) payload.customer_email = customerEmail;
    if (metadata) payload.metadata = metadata;

    return this._request("POST", "/api/payments/checkout", { body: payload });
  }

  /**
   * Retrieve a checkout session by ID.
   *
   * @param {string} sessionId - The Stripe session ID (cs_...)
   * @returns {Promise<object|null>}
   */
  async getSession(sessionId) {
    return this._request("GET", "/api/payments/session", {
      params: { session_id: sessionId },
    });
  }

  /**
   * List recent transactions from the payments service.
   *
   * @param {object} [options]
   * @param {number} [options.limit] - Number of results (default: 20)
   * @param {number} [options.offset] - Number of results to skip (default: 0)
   * @returns {Promise<object|null>}
   */
  async listTransactions({ limit = 20, offset = 0 } = {}) {
    return this._request("GET", "/api/payments/transactions", {
      params: { limit, offset },
    });
  }

  /**
   * Verify that a payment callback came from the payments service.
   * Checks the X-Pay-Signature header against the request body using
   * the shared API key as the HMAC secret.
   *
   * @param {object} req - Express request object
   * @returns {object|null} Parsed body if signature is valid, null otherwise
   */
  verifyCallback(req) {
    const signature = req.headers["x-pay-signature"] || "";
    if (!signature) {
      console.error("[PaymentsClient] Callback missing X-Pay-Signature header");
      return null;
    }

    // req.body may already be parsed by express.json(), so we need the raw body
    // Sites should use express.json({ verify: storeRawBody }) or similar
    const rawBody =
      req.rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));

    const expected = crypto
      .createHmac("sha256", this.key)
      .update(rawBody)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      console.error("[PaymentsClient] Callback signature mismatch");
      return null;
    }

    return typeof req.body === "object" ? req.body : JSON.parse(req.body);
  }
}

/**
 * Create an Express middleware handler for payment callbacks from the service.
 *
 * The payments service POSTs to this endpoint after a checkout completes or fails.
 * Each site mounts this handler and provides its own onSuccess/onFailure callbacks
 * to do site-specific work (update orders, send emails, etc.).
 *
 * Usage:
 *   const { createPaymentCallbackHandler } = require('@lozzalingo/payments/server/payments-client');
 *
 *   async function handleSuccess({ sessionId, lineItems, metadata, customerEmail }) {
 *     const booking = await prisma.booking.update({
 *       where: { id: metadata.bookingId },
 *       data: { status: 'paid' },
 *     });
 *     await sendConfirmationEmail(booking);
 *   }
 *
 *   async function handleFailure({ sessionId, eventType, metadata }) {
 *     await prisma.booking.update({
 *       where: { id: metadata.bookingId },
 *       data: { status: 'failed' },
 *     });
 *   }
 *
 *   app.post('/payments/callback', createPaymentCallbackHandler(handleSuccess, handleFailure));
 *
 * @param {Function} onSuccess - Called with { sessionId, lineItems, metadata, customerEmail }
 * @param {Function} onFailure - Called with { sessionId, eventType, metadata }
 * @param {object} [options]
 * @param {PaymentsClient} [options.client] - Custom PaymentsClient instance
 * @returns {Function} Express route handler (req, res)
 */
function createPaymentCallbackHandler(onSuccess, onFailure, options = {}) {
  const client = options.client || new PaymentsClient();

  return async (req, res) => {
    // Verify the callback signature
    const data = client.verifyCallback(req);
    if (!data) {
      console.error("[PaymentsClient] Rejected callback with invalid signature");
      return res.status(403).json({ error: "Invalid signature" });
    }

    const {
      event_type: eventType,
      session_id: sessionId,
      line_items: lineItems,
      metadata,
      customer_email: customerEmail,
    } = data;

    console.log(`[PaymentsClient] Received callback: ${eventType} (session: ${sessionId})`);

    try {
      if (eventType === "checkout.session.completed") {
        await onSuccess({ sessionId, lineItems, metadata, customerEmail });
      } else {
        await onFailure({ sessionId, eventType, metadata });
      }
    } catch (error) {
      console.error(`[PaymentsClient] Callback handler failed for ${eventType}:`, error.message);
      // Still return 200 so the payments service does not retry for app errors
      return res.json({ received: true, error: "Handler failed" });
    }

    return res.json({ received: true });
  };
}

module.exports = { PaymentsClient, createPaymentCallbackHandler };
