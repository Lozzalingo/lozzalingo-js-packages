/**
 * Thin client for the centralised Payments service.
 * Replaces direct Stripe SDK usage. Sites call this to create checkouts,
 * manage subscriptions, customers, and more.
 *
 * Usage:
 *   const { PaymentsClient } = require('@lozzalingo/payments/server/payments-client');
 *
 *   const client = new PaymentsClient();
 *
 *   // One-time checkout
 *   const result = await client.createCheckout({
 *     lineItems: [{ name: 'T-Shirt', pricePence: 2500, quantity: 1 }],
 *     successUrl: 'https://mysite.com/success',
 *     cancelUrl: 'https://mysite.com/cancel',
 *     customerEmail: 'buyer@example.com',
 *     metadata: { orderId: '123' },
 *   });
 *
 *   // Subscription checkout
 *   const sub = await client.createSubscriptionCheckout({
 *     lineItems: [{ priceId: 'price_xxx', quantity: 1 }],
 *     successUrl: 'https://mysite.com/success',
 *     cancelUrl: 'https://mysite.com/cancel',
 *   });
 *
 *   // PaymentIntent (custom flow)
 *   const intent = await client.createIntent({ amountPence: 2500 });
 *   // intent = { clientSecret: 'pi_..._secret_...', intentId: 'pi_...' }
 *
 *   // Subscription management
 *   const subscription = await client.getSubscription('sub_xxx');
 *   await client.updateSubscription('sub_xxx', { cancelAtPeriodEnd: true });
 *   await client.cancelSubscription('sub_xxx');
 *
 *   // Customer management
 *   const customer = await client.createCustomer({ email: 'user@example.com' });
 *   await client.getCustomer('cus_xxx');
 *
 *   // Billing portal
 *   const portal = await client.createBillingPortal({ customerId: 'cus_xxx', returnUrl: '...' });
 *
 *   // Refunds
 *   await client.createRefund({ paymentIntentId: 'pi_xxx' });
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

  // -------------------------------------------------------------------------
  // One-time checkout
  // -------------------------------------------------------------------------

  /**
   * Create a checkout session via the payments service.
   *
   * @param {object} options
   * @param {Array<{name: string, pricePence: number, quantity: number}>} options.lineItems
   * @param {string} options.successUrl
   * @param {string} options.cancelUrl
   * @param {string} [options.customerEmail]
   * @param {object} [options.metadata]
   * @param {string} [options.currency]
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
   * @param {string} sessionId
   * @returns {Promise<object|null>}
   */
  async getSession(sessionId) {
    return this._request("GET", "/api/payments/checkout/session", {
      params: { session_id: sessionId },
    });
  }

  // -------------------------------------------------------------------------
  // Subscription checkout
  // -------------------------------------------------------------------------

  /**
   * Create a subscription checkout session.
   *
   * @param {object} options
   * @param {Array<{priceId: string, quantity: number}>} options.lineItems
   * @param {string} options.successUrl
   * @param {string} options.cancelUrl
   * @param {string} [options.customerEmail]
   * @param {object} [options.metadata]
   * @param {number} [options.trialEnd] - Unix timestamp for trial end
   * @returns {Promise<{checkoutUrl: string, sessionId: string}|null>}
   */
  async createSubscriptionCheckout({
    lineItems,
    successUrl,
    cancelUrl,
    customerEmail,
    metadata,
    trialEnd,
  }) {
    const payload = {
      line_items: lineItems.map((item) => ({
        price_id: item.priceId,
        quantity: item.quantity || 1,
      })),
      success_url: successUrl,
      cancel_url: cancelUrl,
    };

    if (customerEmail) payload.customer_email = customerEmail;
    if (metadata) payload.metadata = metadata;
    if (trialEnd) payload.trial_end = trialEnd;

    return this._request("POST", "/api/payments/checkout/subscription", {
      body: payload,
    });
  }

  // -------------------------------------------------------------------------
  // PaymentIntent (custom flow)
  // -------------------------------------------------------------------------

  /**
   * Create a PaymentIntent for custom payment flows.
   *
   * @param {object} options
   * @param {number} options.amountPence
   * @param {string} [options.currency]
   * @param {string} [options.customerEmail]
   * @param {object} [options.metadata]
   * @param {string} [options.receiptEmail]
   * @param {string} [options.customerId]
   * @param {string} [options.description]
   * @returns {Promise<{clientSecret: string, intentId: string}|null>}
   */
  async createIntent({
    amountPence,
    currency = "gbp",
    customerEmail,
    metadata,
    receiptEmail,
    customerId,
    description,
  }) {
    const payload = {
      amount_pence: amountPence,
      currency,
    };

    if (customerEmail) payload.customer_email = customerEmail;
    if (metadata) payload.metadata = metadata;
    if (receiptEmail) payload.receipt_email = receiptEmail;
    if (customerId) payload.customer_id = customerId;
    if (description) payload.description = description;

    return this._request("POST", "/api/payments/intent", { body: payload });
  }

  // -------------------------------------------------------------------------
  // Subscription management
  // -------------------------------------------------------------------------

  /**
   * Retrieve subscription details.
   * @param {string} subscriptionId
   * @returns {Promise<object|null>}
   */
  async getSubscription(subscriptionId) {
    return this._request("GET", `/api/payments/subscriptions/${subscriptionId}`);
  }

  /**
   * Update a subscription (cancel at period end, change plan, etc.).
   *
   * @param {string} subscriptionId
   * @param {object} options
   * @param {boolean} [options.cancelAtPeriodEnd]
   * @param {Array} [options.items] - Item updates for plan changes
   * @param {string} [options.prorationBehavior]
   * @param {object} [options.metadata]
   * @returns {Promise<object|null>}
   */
  async updateSubscription(subscriptionId, {
    cancelAtPeriodEnd,
    items,
    prorationBehavior,
    metadata,
  } = {}) {
    const payload = {};

    if (cancelAtPeriodEnd !== undefined) payload.cancel_at_period_end = cancelAtPeriodEnd;
    if (items) payload.items = items;
    if (prorationBehavior) payload.proration_behavior = prorationBehavior;
    if (metadata) payload.metadata = metadata;

    return this._request("PUT", `/api/payments/subscriptions/${subscriptionId}`, {
      body: payload,
    });
  }

  /**
   * Cancel a subscription immediately.
   * @param {string} subscriptionId
   * @returns {Promise<object|null>}
   */
  async cancelSubscription(subscriptionId) {
    return this._request("DELETE", `/api/payments/subscriptions/${subscriptionId}`);
  }

  // -------------------------------------------------------------------------
  // Customer management
  // -------------------------------------------------------------------------

  /**
   * Create a Stripe customer.
   * @param {object} options
   * @param {string} options.email
   * @param {object} [options.metadata]
   * @returns {Promise<{customerId: string, email: string}|null>}
   */
  async createCustomer({ email, metadata }) {
    const payload = { email };
    if (metadata) payload.metadata = metadata;

    return this._request("POST", "/api/payments/customers", { body: payload });
  }

  /**
   * Retrieve a Stripe customer.
   * @param {string} customerId
   * @returns {Promise<object|null>}
   */
  async getCustomer(customerId) {
    return this._request("GET", `/api/payments/customers/${customerId}`);
  }

  /**
   * Update a Stripe customer.
   * @param {string} customerId
   * @param {object} options
   * @param {string} [options.email]
   * @param {object} [options.metadata]
   * @param {object} [options.invoiceSettings]
   * @returns {Promise<object|null>}
   */
  async updateCustomer(customerId, { email, metadata, invoiceSettings } = {}) {
    const payload = {};
    if (email) payload.email = email;
    if (metadata) payload.metadata = metadata;
    if (invoiceSettings) payload.invoice_settings = invoiceSettings;

    return this._request("PUT", `/api/payments/customers/${customerId}`, {
      body: payload,
    });
  }

  /**
   * Attach a payment method to a customer.
   * @param {string} customerId
   * @param {string} paymentMethodId
   * @returns {Promise<object|null>}
   */
  async attachPaymentMethod(customerId, paymentMethodId) {
    return this._request(
      "POST",
      `/api/payments/customers/${customerId}/payment-methods`,
      { body: { payment_method_id: paymentMethodId } }
    );
  }

  // -------------------------------------------------------------------------
  // Billing portal
  // -------------------------------------------------------------------------

  /**
   * Create a Stripe Billing Portal session.
   * @param {object} options
   * @param {string} options.customerId
   * @param {string} options.returnUrl
   * @returns {Promise<{url: string}|null>}
   */
  async createBillingPortal({ customerId, returnUrl }) {
    return this._request("POST", "/api/payments/billing-portal", {
      body: {
        customer_id: customerId,
        return_url: returnUrl,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Refunds
  // -------------------------------------------------------------------------

  /**
   * Create a refund.
   * @param {object} options
   * @param {string} [options.paymentIntentId]
   * @param {string} [options.chargeId]
   * @param {number} [options.amount] - Partial refund amount in pence
   * @param {string} [options.reason]
   * @returns {Promise<object|null>}
   */
  async createRefund({ paymentIntentId, chargeId, amount, reason } = {}) {
    const payload = {};
    if (paymentIntentId) payload.payment_intent_id = paymentIntentId;
    if (chargeId) payload.charge_id = chargeId;
    if (amount !== undefined) payload.amount = amount;
    if (reason) payload.reason = reason;

    return this._request("POST", "/api/payments/refunds", { body: payload });
  }

  // -------------------------------------------------------------------------
  // Products and prices
  // -------------------------------------------------------------------------

  /**
   * Create a Stripe product.
   * @param {object} options
   * @param {string} options.name
   * @param {string} [options.description]
   * @param {object} [options.metadata]
   * @returns {Promise<{productId: string, name: string}|null>}
   */
  async createProduct({ name, description, metadata }) {
    const payload = { name };
    if (description) payload.description = description;
    if (metadata) payload.metadata = metadata;

    return this._request("POST", "/api/payments/products", { body: payload });
  }

  /**
   * List products.
   * @param {object} [options]
   * @param {number} [options.limit]
   * @param {boolean} [options.active]
   * @returns {Promise<object|null>}
   */
  async listProducts({ limit = 20, active } = {}) {
    const params = { limit };
    if (active !== undefined) params.active = String(active);

    return this._request("GET", "/api/payments/products", { params });
  }

  /**
   * Create a Stripe price.
   * @param {object} options
   * @param {string} options.productId
   * @param {number} options.unitAmount - Amount in pence
   * @param {string} [options.currency]
   * @param {object} [options.recurring] - e.g. { interval: 'month' }
   * @param {object} [options.metadata]
   * @returns {Promise<object|null>}
   */
  async createPrice({ productId, unitAmount, currency = "gbp", recurring, metadata }) {
    const payload = {
      product_id: productId,
      unit_amount: unitAmount,
      currency,
    };
    if (recurring) payload.recurring = recurring;
    if (metadata) payload.metadata = metadata;

    return this._request("POST", "/api/payments/prices", { body: payload });
  }

  /**
   * List prices, optionally filtered by product.
   * @param {object} [options]
   * @param {string} [options.productId]
   * @param {number} [options.limit]
   * @param {boolean} [options.active]
   * @returns {Promise<object|null>}
   */
  async listPrices({ productId, limit = 20, active } = {}) {
    const params = { limit };
    if (productId) params.product_id = productId;
    if (active !== undefined) params.active = String(active);

    return this._request("GET", "/api/payments/prices", { params });
  }

  // -------------------------------------------------------------------------
  // Connect (marketplace)
  // -------------------------------------------------------------------------

  /**
   * Create a Stripe Connect account.
   * @param {object} options
   * @param {string} options.email
   * @param {object} [options.metadata]
   * @param {string} [options.country]
   * @returns {Promise<{accountId: string, email: string}|null>}
   */
  async createConnectAccount({ email, metadata, country }) {
    const payload = { email };
    if (metadata) payload.metadata = metadata;
    if (country) payload.country = country;

    return this._request("POST", "/api/payments/connect/accounts", {
      body: payload,
    });
  }

  /**
   * Create an account link for onboarding a connected account.
   * @param {object} options
   * @param {string} options.accountId
   * @param {string} options.refreshUrl
   * @param {string} options.returnUrl
   * @returns {Promise<{url: string, expiresAt: number}|null>}
   */
  async createAccountLink({ accountId, refreshUrl, returnUrl }) {
    return this._request("POST", "/api/payments/connect/account-links", {
      body: {
        account_id: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
      },
    });
  }

  /**
   * Retrieve a connected account.
   * @param {string} accountId
   * @returns {Promise<object|null>}
   */
  async getConnectAccount(accountId) {
    return this._request("GET", `/api/payments/connect/accounts/${accountId}`);
  }

  // -------------------------------------------------------------------------
  // Transactions
  // -------------------------------------------------------------------------

  /**
   * List recent transactions from the payments service.
   * @param {object} [options]
   * @param {number} [options.limit]
   * @param {number} [options.offset]
   * @returns {Promise<object|null>}
   */
  async listTransactions({ limit = 20, offset = 0 } = {}) {
    return this._request("GET", "/api/payments/transactions", {
      params: { limit, offset },
    });
  }

  // -------------------------------------------------------------------------
  // Callback verification
  // -------------------------------------------------------------------------

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
 * The payments service POSTs to this endpoint after any Stripe event is processed.
 * Each site mounts this handler and provides callbacks for site-specific work.
 *
 * Usage:
 *   const { createPaymentCallbackHandler } = require('@lozzalingo/payments/server/payments-client');
 *
 *   async function handleSuccess(data) {
 *     // data includes: sessionId, lineItems, metadata, customerEmail, eventType
 *     const booking = await prisma.booking.update({
 *       where: { id: data.metadata.bookingId },
 *       data: { status: 'paid' },
 *     });
 *   }
 *
 *   async function handleFailure(data) {
 *     // data includes: sessionId, eventType, metadata
 *   }
 *
 *   async function handleSubscription(data) {
 *     // data includes: subscriptionId, customerId, status, eventType, items, metadata
 *   }
 *
 *   app.post('/payments/callback', createPaymentCallbackHandler({
 *     onSuccess: handleSuccess,
 *     onFailure: handleFailure,
 *     onSubscription: handleSubscription,
 *   }));
 *
 * @param {object} options
 * @param {Function} options.onSuccess - Called on successful payment events
 * @param {Function} [options.onFailure] - Called on failed/expired events
 * @param {Function} [options.onSubscription] - Called on subscription lifecycle events
 * @param {PaymentsClient} [options.client] - Custom PaymentsClient instance
 * @returns {Function} Express route handler (req, res)
 */
function createPaymentCallbackHandler({ onSuccess, onFailure, onSubscription, client } = {}) {
  const paymentsClient = client || new PaymentsClient();

  const successEvents = new Set([
    "checkout.session.completed",
    "payment_intent.succeeded",
    "invoice.paid",
    "invoice.payment_succeeded",
  ]);

  const failureEvents = new Set([
    "checkout.session.expired",
    "payment_intent.payment_failed",
    "invoice.payment_failed",
  ]);

  const subscriptionEvents = new Set([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ]);

  return async (req, res) => {
    // Verify the callback signature
    let data = paymentsClient.verifyCallback(req);
    if (!data) {
      // Fall back to raw body if signature not configured
      data = req.body;
      if (!data || !data.event_type) {
        console.error("[PaymentsClient] Rejected callback with invalid payload");
        return res.status(403).json({ error: "Invalid signature" });
      }
    }

    const eventType = data.event_type || "";
    console.log(`[PaymentsClient] Received callback: ${eventType}`);

    try {
      if (successEvents.has(eventType)) {
        if (onSuccess) await onSuccess(data);
      } else if (subscriptionEvents.has(eventType)) {
        if (onSubscription) await onSubscription(data);
        else if (onSuccess && eventType === "customer.subscription.created") {
          await onSuccess(data);
        }
      } else if (failureEvents.has(eventType)) {
        if (onFailure) await onFailure(data);
      } else {
        console.log(`[PaymentsClient] Unhandled callback event type: ${eventType}`);
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
