/**
 * @lozzalingo/payments - Test suite
 *
 * Tests checkout sessions, invoicing, webhook handling, and route wiring.
 * All tests mock the PaymentsClient rather than the Stripe SDK.
 */

const crypto = require("crypto");

// ---- Mock PaymentsClient ----

const mockPaymentsClient = {
  url: "https://payments.test.com",
  key: "test-api-key-123",
  timeoutMs: 10000,
  createCheckout: jest.fn().mockResolvedValue({
    checkoutUrl: "https://payments.test.com/checkout/cs_test_123",
    sessionId: "cs_test_123",
  }),
  getSession: jest.fn().mockResolvedValue({
    session_id: "cs_test_123",
    status: "complete",
    payment_status: "paid",
    customer_email: "john@example.com",
    amount_total: 24000,
    currency: "gbp",
    metadata: {},
  }),
  createSubscriptionCheckout: jest.fn().mockResolvedValue({
    checkoutUrl: "https://payments.test.com/checkout/cs_sub_123",
    sessionId: "cs_sub_123",
  }),
  createCustomer: jest.fn().mockResolvedValue({
    customerId: "cus_new_123",
    email: "john@example.com",
  }),
  getCustomer: jest.fn().mockResolvedValue({
    customerId: "cus_existing_456",
    email: "jane@example.com",
  }),
  verifyCallback: jest.fn(),
  _request: jest.fn(),
};

jest.mock("@lozzalingo/payments/server/payments-client", () => ({
  PaymentsClient: jest.fn().mockImplementation(() => ({ ...mockPaymentsClient })),
  createPaymentCallbackHandler: jest.requireActual(
    "@lozzalingo/payments/server/payments-client"
  ).createPaymentCallbackHandler,
}));

// Now require modules after mock is set up
const { createCheckoutSession, retrieveSession } = require("../src/services/checkout");
const {
  findOrCreateStripeCustomer,
  createInvoiceItems,
  createAndFinaliseInvoice,
  createFullInvoice,
} = require("../src/services/invoicing");
const { verifyWebhookSignature } = require("../src/services/webhooks");
const { createPaymentController } = require("../src/controller");
const { createPaymentRoutes } = require("../src/routes");

// ---- Mock req/res ----

function createMockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status: jest.fn(function (code) {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn(function (data) {
      res.body = data;
      return res;
    }),
  };
  return res;
}

// ---- Tests ----

describe("Checkout Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPaymentsClient.createCheckout.mockResolvedValue({
      checkoutUrl: "https://payments.test.com/checkout/cs_test_123",
      sessionId: "cs_test_123",
    });
    mockPaymentsClient.getSession.mockResolvedValue({
      session_id: "cs_test_123",
      status: "complete",
      payment_status: "paid",
      customer_email: "john@example.com",
      amount_total: 24000,
      currency: "gbp",
      metadata: {},
    });
  });

  test("createCheckoutSession creates session with event metadata", async () => {
    const result = await createCheckoutSession(null, {
      eventTitle: "Camden Scavenger Hunt",
      customerEmail: "john@example.com",
      customerName: "John Smith",
      groupSize: 12,
      eventDate: "2026-06-15T10:00:00.000Z",
      priceInPence: 24000,
      customerPhone: "07777123456",
      companyName: "Acme Corp",
      message: "Birthday party",
      productSlug: "camden-hunt",
      packageSlug: "standard",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(result.sessionId).toBe("cs_test_123");
    expect(result.url).toBe("https://payments.test.com/checkout/cs_test_123");

    expect(mockPaymentsClient.createCheckout).toHaveBeenCalledTimes(1);
    const callArgs = mockPaymentsClient.createCheckout.mock.calls[0][0];
    expect(callArgs.lineItems[0].name).toBe("Camden Scavenger Hunt");
    expect(callArgs.lineItems[0].pricePence).toBe(24000);
    expect(callArgs.lineItems[0].quantity).toBe(1);
    expect(callArgs.customerEmail).toBe("john@example.com");
    expect(callArgs.successUrl).toBe("https://example.com/success");
    expect(callArgs.cancelUrl).toBe("https://example.com/cancel");
    expect(callArgs.metadata.customerName).toBe("John Smith");
    expect(callArgs.metadata.groupSize).toBe("12");
    expect(callArgs.metadata.productSlug).toBe("camden-hunt");
    expect(callArgs.metadata.packageSlug).toBe("standard");
    expect(callArgs.metadata.companyName).toBe("Acme Corp");
    expect(callArgs.metadata.message).toBe("Birthday party");
  });

  test("createCheckoutSession uses default currency (gbp) when not specified", async () => {
    await createCheckoutSession(null, {
      eventTitle: "Test Hunt",
      priceInPence: 5000,
      groupSize: 2,
      eventDate: "2026-06-15",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    const callArgs = mockPaymentsClient.createCheckout.mock.calls[0][0];
    expect(callArgs.currency).toBe("gbp");
  });

  test("createCheckoutSession defaults empty optional fields to empty strings in metadata", async () => {
    await createCheckoutSession(null, {
      eventTitle: "Test Hunt",
      customerEmail: "john@example.com",
      priceInPence: 5000,
      groupSize: 2,
      eventDate: "2026-06-15",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    const callArgs = mockPaymentsClient.createCheckout.mock.calls[0][0];
    expect(callArgs.metadata.customerPhone).toBe("");
    expect(callArgs.metadata.companyName).toBe("");
    expect(callArgs.metadata.message).toBe("");
    expect(callArgs.metadata.productSlug).toBe("");
    expect(callArgs.metadata.packageSlug).toBe("");
  });

  test("createCheckoutSession throws when payments service returns null", async () => {
    mockPaymentsClient.createCheckout.mockResolvedValue(null);

    await expect(
      createCheckoutSession(null, {
        eventTitle: "Test",
        priceInPence: 1000,
        groupSize: 1,
        eventDate: "2026-06-15",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      })
    ).rejects.toThrow("Failed to create checkout session");
  });

  test("retrieveSession retrieves session by ID", async () => {
    const result = await retrieveSession(null, "cs_test_123");

    expect(result.session_id).toBe("cs_test_123");
    expect(result.payment_status).toBe("paid");
    expect(mockPaymentsClient.getSession).toHaveBeenCalledWith("cs_test_123");
  });

  test("retrieveSession throws when session not found", async () => {
    mockPaymentsClient.getSession.mockResolvedValue(null);

    await expect(retrieveSession(null, "cs_missing")).rejects.toThrow("Session not found");
  });
});

describe("Invoicing Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPaymentsClient.createCustomer.mockResolvedValue({
      customerId: "cus_new_789",
      email: "jane@example.com",
    });
  });

  test("findOrCreateStripeCustomer creates customer via payments service", async () => {
    const result = await findOrCreateStripeCustomer(null, {
      email: "jane@example.com",
      name: "Jane Doe",
      phone: "07777999888",
      company: "Acme Corp",
      productName: "Scavenger Hunt",
    });

    expect(result.id).toBe("cus_new_789");
    expect(result.email).toBe("jane@example.com");
    expect(mockPaymentsClient.createCustomer).toHaveBeenCalledTimes(1);
    const callArgs = mockPaymentsClient.createCustomer.mock.calls[0][0];
    expect(callArgs.email).toBe("jane@example.com");
    expect(callArgs.metadata.company).toBe("Acme Corp");
    expect(callArgs.metadata.product_name).toBe("Scavenger Hunt");
  });

  test("findOrCreateStripeCustomer throws when payments service fails", async () => {
    mockPaymentsClient.createCustomer.mockResolvedValue(null);

    await expect(
      findOrCreateStripeCustomer(null, {
        email: "fail@example.com",
        name: "Fail User",
      })
    ).rejects.toThrow("Failed to create customer via centralised payments service");
  });

  test("createInvoiceItems prepares line items with correct structure", async () => {
    const lineItems = [
      { description: "Scavenger Hunt", amount: 24000 },
      { description: "Photo Package", amount: 1500 },
    ];

    const result = await createInvoiceItems(null, "cus_123", lineItems);

    expect(result).toHaveLength(2);
    expect(result[0].description).toBe("Scavenger Hunt");
    expect(result[0].amount).toBe(24000);
    expect(result[1].description).toBe("Photo Package");
    expect(result[1].amount).toBe(1500);
  });

  test("createInvoiceItems applies discount as negative line item", async () => {
    const lineItems = [
      { description: "Hunt", amount: 20000 },
    ];

    const result = await createInvoiceItems(null, "cus_123", lineItems, 5000);

    expect(result).toHaveLength(2);
    expect(result[1].description).toBe("Discount");
    expect(result[1].amount).toBe(-5000);
  });

  test("createInvoiceItems skips items with zero amount", async () => {
    const lineItems = [
      { description: "Valid", amount: 2000 },
      { description: "Zero price", amount: 0 },
    ];

    const result = await createInvoiceItems(null, "cus_123", lineItems);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Valid");
  });

  test("createInvoiceItems throws if no items provided", async () => {
    await expect(createInvoiceItems(null, "cus_123", [])).rejects.toThrow(
      "At least one line item is required"
    );
  });

  test("createAndFinaliseInvoice throws (not yet supported)", async () => {
    await expect(
      createAndFinaliseInvoice(null, {
        stripeCustomerId: "cus_123",
        description: "Test invoice",
      })
    ).rejects.toThrow("Invoice creation not yet available via centralised payments service");
  });

  test("createFullInvoice creates customer then throws (invoicing not yet supported)", async () => {
    await expect(
      createFullInvoice(null, {
        customerEmail: "john@example.com",
        customerName: "John Smith",
        lineItems: [{ description: "Test", amount: 1000 }],
      })
    ).rejects.toThrow("Invoice creation not yet available via centralised payments service");

    // Customer creation should have been attempted
    expect(mockPaymentsClient.createCustomer).toHaveBeenCalledTimes(1);
  });
});

describe("Webhooks Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("verifyWebhookSignature returns event-like object on valid callback", () => {
    const callbackData = {
      event_type: "checkout.session.completed",
      session_id: "cs_123",
      metadata: { productSlug: "hunt" },
      customer_email: "john@example.com",
      line_items: [{ name: "Hunt", amount: 2400 }],
    };

    mockPaymentsClient.verifyCallback.mockReturnValue(callbackData);

    const result = verifyWebhookSignature(null, createMockReq());

    expect(result.type).toBe("checkout.session.completed");
    expect(result.id).toBe("cs_123");
    expect(result.data.object.id).toBe("cs_123");
    expect(result.data.object.metadata.productSlug).toBe("hunt");
    expect(result.data.object.customer_email).toBe("john@example.com");
  });

  test("verifyWebhookSignature throws on invalid signature", () => {
    mockPaymentsClient.verifyCallback.mockReturnValue(null);

    expect(() => {
      verifyWebhookSignature(null, createMockReq());
    }).toThrow("Invalid payment callback signature");
  });
});

describe("Payment Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPaymentsClient.createCheckout.mockResolvedValue({
      checkoutUrl: "https://payments.test.com/checkout/cs_test_123",
      sessionId: "cs_test_123",
    });
    mockPaymentsClient.getSession.mockResolvedValue({
      session_id: "cs_test_123",
      status: "complete",
      payment_status: "paid",
    });
  });

  describe("checkout endpoint", () => {
    test("returns 400 when eventTitle is missing", async () => {
      const controller = createPaymentController({});

      const req = createMockReq({ body: { priceInPence: 5000 } });
      const res = createMockRes();

      await controller.checkout(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("eventTitle");
    });

    test("returns 400 when priceInPence is missing", async () => {
      const controller = createPaymentController({});

      const req = createMockReq({ body: { eventTitle: "Test" } });
      const res = createMockRes();

      await controller.checkout(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("priceInPence");
    });

    test("returns session on success", async () => {
      const controller = createPaymentController({
        baseUrl: "https://example.com",
      });

      const req = createMockReq({
        body: {
          eventTitle: "Camden Hunt",
          priceInPence: 24000,
          customerEmail: "john@example.com",
          groupSize: 12,
          eventDate: "2026-06-15",
        },
      });
      const res = createMockRes();

      await controller.checkout(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.sessionId).toBe("cs_test_123");
      expect(res.body.url).toBe("https://payments.test.com/checkout/cs_test_123");
    });

    test("returns 502 when payments service returns null", async () => {
      mockPaymentsClient.createCheckout.mockResolvedValue(null);

      const controller = createPaymentController({
        baseUrl: "https://example.com",
      });

      const req = createMockReq({
        body: {
          eventTitle: "Camden Hunt",
          priceInPence: 24000,
        },
      });
      const res = createMockRes();

      await controller.checkout(req, res);

      expect(res.statusCode).toBe(502);
    });
  });

  describe("getSession endpoint", () => {
    test("returns 400 when session_id is missing", async () => {
      const controller = createPaymentController({});

      const req = createMockReq({ query: {} });
      const res = createMockRes();

      await controller.getSession(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("session_id");
    });

    test("returns session on success", async () => {
      const controller = createPaymentController({});

      const req = createMockReq({ query: { session_id: "cs_test_123" } });
      const res = createMockRes();

      await controller.getSession(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.session_id).toBe("cs_test_123");
    });

    test("returns 404 when session not found", async () => {
      mockPaymentsClient.getSession.mockResolvedValue(null);

      const controller = createPaymentController({});

      const req = createMockReq({ query: { session_id: "cs_missing" } });
      const res = createMockRes();

      await controller.getSession(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe("getStatus endpoint", () => {
    test("returns configured status based on payments client", async () => {
      const controller = createPaymentController({});

      const req = createMockReq();
      const res = createMockRes();

      await controller.getStatus(req, res);

      expect(res.statusCode).toBe(200);
      expect(typeof res.body.configured).toBe("boolean");
    });
  });

  describe("webhook endpoint", () => {
    test("calls correct handler for checkout.session.completed", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      const callbackBody = {
        event_type: "checkout.session.completed",
        session_id: "cs_123",
        metadata: { productSlug: "hunt" },
        customer_email: "john@example.com",
        line_items: [{ name: "Hunt", amount: 2400 }],
      };

      // Generate valid HMAC signature
      const rawBody = JSON.stringify(callbackBody);
      const signature = crypto
        .createHmac("sha256", "test-api-key-123")
        .update(rawBody)
        .digest("hex");

      const controller = createPaymentController({
        webhookHandlers: {
          "checkout.session.completed": handler,
        },
      });

      const req = createMockReq({
        headers: { "x-pay-signature": signature },
        body: callbackBody,
        rawBody,
      });
      const res = createMockRes();

      await controller.handleWebhook(req, res);

      expect(res.body).toEqual({ received: true });
      expect(handler).toHaveBeenCalled();
    });

    test("returns 200 even if handler throws", async () => {
      const handler = jest.fn().mockRejectedValue(new Error("Handler exploded"));

      const callbackBody = {
        event_type: "checkout.session.completed",
        session_id: "cs_789",
        metadata: {},
      };

      const rawBody = JSON.stringify(callbackBody);
      const signature = crypto
        .createHmac("sha256", "test-api-key-123")
        .update(rawBody)
        .digest("hex");

      const controller = createPaymentController({
        webhookHandlers: {
          "checkout.session.completed": handler,
        },
      });

      const req = createMockReq({
        headers: { "x-pay-signature": signature },
        body: callbackBody,
        rawBody,
      });
      const res = createMockRes();

      await controller.handleWebhook(req, res);

      // Should still return 200 with { received: true } or similar
      expect(res.body.received).toBe(true);
    });
  });

  describe("createInvoice endpoint", () => {
    test("returns 501 (not yet supported)", async () => {
      const controller = createPaymentController({});

      const req = createMockReq({
        body: {
          customerEmail: "john@example.com",
          lineItems: [{ description: "Test", amount: 1000 }],
        },
      });
      const res = createMockRes();

      await controller.createInvoice(req, res);

      expect(res.statusCode).toBe(501);
    });
  });
});

describe("Payment Routes", () => {
  test("admin invoice route is protected by authMiddleware", () => {
    const mockAuth = jest.fn((req, res, next) => next());

    const router = createPaymentRoutes({
      authMiddleware: mockAuth,
    });

    const routes = router.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        method: Object.keys(layer.route.methods)[0],
        middlewareCount: layer.route.stack.length,
      }));

    // Admin invoice should have 2 handlers (auth middleware + controller handler)
    const invoiceRoute = routes.find((r) => r.path === "/admin/invoice" && r.method === "post");
    expect(invoiceRoute).toBeDefined();
    expect(invoiceRoute.middlewareCount).toBe(2);

    // Public routes should have only 1 handler
    const checkoutRoute = routes.find((r) => r.path === "/checkout" && r.method === "post");
    const webhookRoute = routes.find((r) => r.path === "/webhook" && r.method === "post");
    const sessionRoute = routes.find((r) => r.path === "/checkout/session" && r.method === "get");
    const statusRoute = routes.find((r) => r.path === "/checkout/status" && r.method === "get");

    expect(checkoutRoute.middlewareCount).toBe(1);
    expect(webhookRoute.middlewareCount).toBe(1);
    expect(sessionRoute.middlewareCount).toBe(1);
    expect(statusRoute.middlewareCount).toBe(1);
  });

  test("all expected routes are mounted", () => {
    const router = createPaymentRoutes({});

    const routes = router.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        method: Object.keys(layer.route.methods)[0],
      }));

    expect(routes).toContainEqual({ path: "/checkout", method: "post" });
    expect(routes).toContainEqual({ path: "/checkout/session", method: "get" });
    expect(routes).toContainEqual({ path: "/checkout/status", method: "get" });
    expect(routes).toContainEqual({ path: "/webhook", method: "post" });
    expect(routes).toContainEqual({ path: "/admin/invoice", method: "post" });
  });
});
