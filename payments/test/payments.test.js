/**
 * @lozzalingo/payments - Test suite
 *
 * Tests checkout sessions, invoicing, webhook handling, and route wiring.
 */

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

// ---- Mock Stripe ----

const mockStripeInstance = {
  checkout: {
    sessions: {
      create: jest.fn().mockResolvedValue({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/test",
        payment_status: "paid",
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: "cs_test_123",
        payment_status: "paid",
        line_items: { data: [] },
      }),
    },
  },
  customers: {
    list: jest.fn().mockResolvedValue({ data: [] }),
    create: jest.fn().mockResolvedValue({ id: "cus_new_123", name: "John Smith", email: "john@example.com" }),
    update: jest.fn().mockResolvedValue({ id: "cus_existing_456", name: "John Smith" }),
  },
  invoiceItems: {
    create: jest.fn().mockResolvedValue({ id: "ii_123" }),
  },
  invoices: {
    create: jest.fn().mockResolvedValue({ id: "inv_123" }),
    finalizeInvoice: jest.fn().mockResolvedValue({
      id: "inv_123",
      number: "INV-0001",
      amount_due: 24000,
      hosted_invoice_url: "https://invoice.stripe.com/test",
      due_date: 1700000000,
    }),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => mockStripeInstance);
});

function mockCreateStripe() {
  return mockStripeInstance;
}

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
  let mockStripe;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStripe = mockCreateStripe();
  });

  test("createCheckoutSession creates session with event metadata", async () => {
    const result = await createCheckoutSession(mockStripe, {
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
    expect(result.url).toBe("https://checkout.stripe.com/test");

    const createCall = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(createCall.mode).toBe("payment");
    expect(createCall.payment_method_types).toEqual(["card"]);
    expect(createCall.customer_email).toBe("john@example.com");
    expect(createCall.line_items[0].price_data.unit_amount).toBe(24000);
    expect(createCall.line_items[0].price_data.product_data.name).toBe("Camden Scavenger Hunt");
    expect(createCall.line_items[0].price_data.product_data.description).toContain("12 people");
    expect(createCall.line_items[0].quantity).toBe(1);
    expect(createCall.metadata.customerName).toBe("John Smith");
    expect(createCall.metadata.customerEmail).toBe("john@example.com");
    expect(createCall.metadata.groupSize).toBe("12");
    expect(createCall.metadata.productSlug).toBe("camden-hunt");
    expect(createCall.metadata.packageSlug).toBe("standard");
    expect(createCall.metadata.companyName).toBe("Acme Corp");
    expect(createCall.metadata.message).toBe("Birthday party");
    expect(createCall.success_url).toBe("https://example.com/success");
    expect(createCall.cancel_url).toBe("https://example.com/cancel");
  });

  test("createCheckoutSession uses default currency (gbp) when not specified", async () => {
    await createCheckoutSession(mockStripe, {
      eventTitle: "Test Hunt",
      priceInPence: 5000,
      groupSize: 2,
      eventDate: "2026-06-15",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    const createCall = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(createCall.line_items[0].price_data.currency).toBe("gbp");
  });

  test("createCheckoutSession defaults empty optional fields to empty strings in metadata", async () => {
    await createCheckoutSession(mockStripe, {
      eventTitle: "Test Hunt",
      customerEmail: "john@example.com",
      priceInPence: 5000,
      groupSize: 2,
      eventDate: "2026-06-15",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    const createCall = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(createCall.metadata.customerPhone).toBe("");
    expect(createCall.metadata.companyName).toBe("");
    expect(createCall.metadata.message).toBe("");
    expect(createCall.metadata.productSlug).toBe("");
    expect(createCall.metadata.packageSlug).toBe("");
  });

  test("retrieveSession retrieves session with expanded line items", async () => {
    const result = await retrieveSession(mockStripe, "cs_test_123");

    expect(result.id).toBe("cs_test_123");
    expect(result.payment_status).toBe("paid");
    expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledWith("cs_test_123", {
      expand: ["line_items"],
    });
  });
});

describe("Invoicing Service", () => {
  let mockStripe;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStripe = mockCreateStripe();
  });

  test("findOrCreateStripeCustomer creates new customer when none exists", async () => {
    mockStripe.customers.list.mockResolvedValue({ data: [] });
    mockStripe.customers.create.mockResolvedValue({
      id: "cus_new_789",
      name: "Jane Doe",
      email: "jane@example.com",
    });

    const result = await findOrCreateStripeCustomer(mockStripe, {
      email: "jane@example.com",
      name: "Jane Doe",
      phone: "07777999888",
      company: "Acme Corp",
      productName: "Scavenger Hunt",
    });

    expect(result.id).toBe("cus_new_789");
    expect(mockStripe.customers.create).toHaveBeenCalledWith({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "07777999888",
      description: "Customer for Acme Corp - Scavenger Hunt",
    });
  });

  test("findOrCreateStripeCustomer returns existing customer", async () => {
    mockStripe.customers.list.mockResolvedValue({
      data: [{ id: "cus_existing_456", name: "Jane Doe", phone: "07777999888", description: "Customer for Acme Corp - Hunt" }],
    });

    const result = await findOrCreateStripeCustomer(mockStripe, {
      email: "jane@example.com",
      name: "Jane Doe",
      phone: "07777999888",
      company: "Acme Corp",
      productName: "Hunt",
    });

    expect(result.id).toBe("cus_existing_456");
    expect(mockStripe.customers.create).not.toHaveBeenCalled();
  });

  test("findOrCreateStripeCustomer updates existing customer when details differ", async () => {
    mockStripe.customers.list.mockResolvedValue({
      data: [{ id: "cus_existing_456", name: "Old Name", phone: null, description: "old" }],
    });
    mockStripe.customers.update.mockResolvedValue({
      id: "cus_existing_456",
      name: "New Name",
    });

    const result = await findOrCreateStripeCustomer(mockStripe, {
      email: "jane@example.com",
      name: "New Name",
      company: "Acme Corp",
      productName: "Hunt",
    });

    expect(result.id).toBe("cus_existing_456");
    expect(mockStripe.customers.update).toHaveBeenCalledWith("cus_existing_456", {
      name: "New Name",
      phone: undefined,
      description: "Customer for Acme Corp - Hunt",
    });
  });

  test("createInvoiceItems creates line items with correct amounts", async () => {
    const lineItems = [
      { description: "Scavenger Hunt", unitPricePence: 2000, quantity: 12 },
      { description: "Photo Package", unitPricePence: 1500, quantity: 1 },
    ];

    const result = await createInvoiceItems(mockStripe, "cus_123", lineItems);

    expect(result).toHaveLength(2);
    expect(mockStripe.invoiceItems.create).toHaveBeenCalledTimes(2);

    const firstCall = mockStripe.invoiceItems.create.mock.calls[0][0];
    expect(firstCall.customer).toBe("cus_123");
    expect(firstCall.amount).toBe(24000); // 2000 * 12
    expect(firstCall.currency).toBe("gbp");
    expect(firstCall.description).toContain("Scavenger Hunt");

    const secondCall = mockStripe.invoiceItems.create.mock.calls[1][0];
    expect(secondCall.amount).toBe(1500); // 1500 * 1
  });

  test("createInvoiceItems applies discount as negative line item", async () => {
    const lineItems = [
      { description: "Hunt", unitPricePence: 2000, quantity: 10 },
    ];

    await createInvoiceItems(mockStripe, "cus_123", lineItems, 5000);

    expect(mockStripe.invoiceItems.create).toHaveBeenCalledTimes(2);

    const discountCall = mockStripe.invoiceItems.create.mock.calls[1][0];
    expect(discountCall.amount).toBe(-5000);
    expect(discountCall.description).toBe("Discount");
  });

  test("createInvoiceItems skips items with zero or negative values", async () => {
    const lineItems = [
      { description: "Valid", unitPricePence: 2000, quantity: 1 },
      { description: "Zero price", unitPricePence: 0, quantity: 5 },
      { description: "Zero qty", unitPricePence: 1000, quantity: 0 },
    ];

    const result = await createInvoiceItems(mockStripe, "cus_123", lineItems);

    expect(result).toHaveLength(1);
    expect(mockStripe.invoiceItems.create).toHaveBeenCalledTimes(1);
  });

  test("createInvoiceItems throws if no valid items", async () => {
    const lineItems = [
      { description: "Zero", unitPricePence: 0, quantity: 0 },
    ];

    await expect(createInvoiceItems(mockStripe, "cus_123", lineItems)).rejects.toThrow(
      "No valid invoice items created"
    );
  });

  test("createAndFinaliseInvoice creates and finalises with correct params", async () => {
    mockStripe.invoices.create.mockResolvedValue({ id: "inv_456" });
    mockStripe.invoices.finalizeInvoice.mockResolvedValue({
      id: "inv_456",
      number: "INV-0002",
      amount_due: 20000,
      hosted_invoice_url: "https://invoice.stripe.com/inv_456",
    });

    const result = await createAndFinaliseInvoice(mockStripe, {
      stripeCustomerId: "cus_123",
      description: "Scavenger Hunt - Acme Corp",
      daysUntilDue: 7,
      metadata: { booking_ref: "BR-ABC123" },
      footer: "Bank details here",
    });

    expect(result.number).toBe("INV-0002");
    expect(result.hosted_invoice_url).toBe("https://invoice.stripe.com/inv_456");

    const createCall = mockStripe.invoices.create.mock.calls[0][0];
    expect(createCall.customer).toBe("cus_123");
    expect(createCall.collection_method).toBe("send_invoice");
    expect(createCall.days_until_due).toBe(7);
    expect(createCall.auto_advance).toBe(false);
    expect(createCall.metadata.booking_ref).toBe("BR-ABC123");
    expect(createCall.footer).toBe("Bank details here");
    expect(createCall.pending_invoice_items_behavior).toBe("include");

    expect(mockStripe.invoices.finalizeInvoice).toHaveBeenCalledWith("inv_456");
  });

  test("createAndFinaliseInvoice omits footer when not provided", async () => {
    mockStripe.invoices.create.mockResolvedValue({ id: "inv_789" });
    mockStripe.invoices.finalizeInvoice.mockResolvedValue({
      id: "inv_789",
      number: "INV-0003",
      amount_due: 10000,
      hosted_invoice_url: "https://invoice.stripe.com/inv_789",
    });

    await createAndFinaliseInvoice(mockStripe, {
      stripeCustomerId: "cus_123",
      description: "Test",
    });

    const createCall = mockStripe.invoices.create.mock.calls[0][0];
    expect(createCall.footer).toBeUndefined();
  });

  test("createFullInvoice runs the complete flow", async () => {
    mockStripe.customers.list.mockResolvedValue({ data: [] });
    mockStripe.customers.create.mockResolvedValue({ id: "cus_full_123" });
    mockStripe.invoiceItems.create.mockResolvedValue({ id: "ii_full_1" });
    mockStripe.invoices.create.mockResolvedValue({ id: "inv_full_123" });
    mockStripe.invoices.finalizeInvoice.mockResolvedValue({
      id: "inv_full_123",
      number: "INV-FULL-001",
      amount_due: 24000,
      hosted_invoice_url: "https://invoice.stripe.com/full",
    });

    const result = await createFullInvoice(mockStripe, {
      customerEmail: "john@example.com",
      customerName: "John Smith",
      customerPhone: "07777123456",
      companyName: "Acme Corp",
      productName: "Camden Hunt",
      lineItems: [
        { description: "Scavenger Hunt", unitPricePence: 2000, quantity: 12 },
      ],
      daysUntilDue: 3,
      metadata: { booking_ref: "BR-XYZ" },
      footer: "Pay by bank transfer",
    });

    expect(result.number).toBe("INV-FULL-001");
    expect(result.hosted_invoice_url).toBe("https://invoice.stripe.com/full");

    // Customer was created
    expect(mockStripe.customers.create).toHaveBeenCalled();
    // Invoice item was created
    expect(mockStripe.invoiceItems.create).toHaveBeenCalledTimes(1);
    // Invoice was created and finalised
    expect(mockStripe.invoices.create).toHaveBeenCalled();
    expect(mockStripe.invoices.finalizeInvoice).toHaveBeenCalledWith("inv_full_123");
  });

  test("createFullInvoice propagates errors", async () => {
    mockStripe.customers.list.mockRejectedValue(new Error("Stripe API down"));

    await expect(
      createFullInvoice(mockStripe, {
        customerEmail: "fail@example.com",
        customerName: "Fail User",
        lineItems: [{ description: "Test", unitPricePence: 1000, quantity: 1 }],
      })
    ).rejects.toThrow("Stripe API down");
  });
});

describe("Webhooks Service", () => {
  test("verifyWebhookSignature returns event on valid signature", () => {
    const mockStripe = mockCreateStripe();
    const mockEvent = { id: "evt_123", type: "checkout.session.completed" };
    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

    const result = verifyWebhookSignature(mockStripe, Buffer.from("body"), "sig_valid", "whsec_test");

    expect(result).toEqual(mockEvent);
  });

  test("verifyWebhookSignature throws on invalid signature", () => {
    const mockStripe = mockCreateStripe();
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    expect(() => {
      verifyWebhookSignature(mockStripe, Buffer.from("body"), "bad_sig", "whsec_test");
    }).toThrow("Invalid signature");
  });
});

describe("Payment Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("checkout endpoint", () => {
    test("returns 400 when eventTitle is missing", async () => {
      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
        webhookSecret: "whsec_test",
      });

      const req = createMockReq({ body: { priceInPence: 5000 } });
      const res = createMockRes();

      await controller.checkout(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("eventTitle");
    });

    test("returns 400 when priceInPence is missing", async () => {
      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
        webhookSecret: "whsec_test",
      });

      const req = createMockReq({ body: { eventTitle: "Test" } });
      const res = createMockRes();

      await controller.checkout(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("priceInPence");
    });

    test("returns session on success", async () => {
      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
        webhookSecret: "whsec_test",
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
      expect(res.body.url).toBe("https://checkout.stripe.com/test");
    });
  });

  describe("getSession endpoint", () => {
    test("returns 400 when session_id is missing", async () => {
      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
      });

      const req = createMockReq({ query: {} });
      const res = createMockRes();

      await controller.getSession(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("session_id");
    });

    test("returns session on success", async () => {
      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
      });

      const req = createMockReq({ query: { session_id: "cs_test_123" } });
      const res = createMockRes();

      await controller.getSession(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe("cs_test_123");
    });
  });

  describe("getStatus endpoint", () => {
    test("returns configured true when key is set", async () => {
      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
      });

      const req = createMockReq();
      const res = createMockRes();

      await controller.getStatus(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.configured).toBe(true);
    });

    test("returns configured false when key is empty", async () => {
      const controller = createPaymentController({
        stripeSecretKey: "",
      });

      const req = createMockReq();
      const res = createMockRes();

      await controller.getStatus(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.configured).toBe(false);
    });
  });

  describe("webhook endpoint", () => {
    test("calls correct handler for checkout.session.completed", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      const mockEvent = {
        id: "evt_123",
        type: "checkout.session.completed",
        data: { object: { id: "cs_123", metadata: { productSlug: "hunt" } } },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
        webhookSecret: "whsec_test",
        webhookHandlers: {
          "checkout.session.completed": handler,
        },
      });

      const req = createMockReq({
        headers: { "stripe-signature": "sig_valid" },
        body: Buffer.from("raw_body"),
      });
      const res = createMockRes();

      await controller.handleWebhook(req, res);

      expect(handler).toHaveBeenCalledWith(mockEvent.data.object, mockEvent);
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    test("calls correct handler for invoice.paid", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      const mockEvent = {
        id: "evt_456",
        type: "invoice.paid",
        data: { object: { id: "inv_123", number: "INV-0001", amount_paid: 24000 } },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
        webhookSecret: "whsec_test",
        webhookHandlers: {
          "invoice.paid": handler,
        },
      });

      const req = createMockReq({
        headers: { "stripe-signature": "sig_valid" },
        body: Buffer.from("raw_body"),
      });
      const res = createMockRes();

      await controller.handleWebhook(req, res);

      expect(handler).toHaveBeenCalledWith(mockEvent.data.object, mockEvent);
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    test("returns 200 even if handler throws", async () => {
      const handler = jest.fn().mockRejectedValue(new Error("Handler exploded"));

      const mockEvent = {
        id: "evt_789",
        type: "checkout.session.completed",
        data: { object: { id: "cs_789" } },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
        webhookSecret: "whsec_test",
        webhookHandlers: {
          "checkout.session.completed": handler,
        },
      });

      const req = createMockReq({
        headers: { "stripe-signature": "sig_valid" },
        body: Buffer.from("raw_body"),
      });
      const res = createMockRes();

      await controller.handleWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(res.status).not.toHaveBeenCalledWith(500);
    });

    test("returns 400 when stripe-signature header is missing", async () => {
      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
        webhookSecret: "whsec_test",
      });

      const req = createMockReq({ headers: {} });
      const res = createMockRes();

      await controller.handleWebhook(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("stripe-signature");
    });

    test("returns 400 when signature is invalid", async () => {
      mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
        webhookSecret: "whsec_test",
      });

      const req = createMockReq({
        headers: { "stripe-signature": "bad_sig" },
        body: Buffer.from("raw_body"),
      });
      const res = createMockRes();

      await controller.handleWebhook(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("Invalid signature");
    });

    test("logs unhandled event types without error", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      const mockEvent = {
        id: "evt_999",
        type: "some.unknown.event",
        data: { object: {} },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
        webhookSecret: "whsec_test",
        webhookHandlers: {},
      });

      const req = createMockReq({
        headers: { "stripe-signature": "sig_valid" },
        body: Buffer.from("raw_body"),
      });
      const res = createMockRes();

      await controller.handleWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(res.status).not.toHaveBeenCalled();

      const logCalls = consoleSpy.mock.calls.map((c) => c.join(" "));
      const hasUnhandledLog = logCalls.some(
        (msg) => msg.includes("[Payments]") && (msg.includes("Unhandled") || msg.includes("some.unknown.event"))
      );
      expect(hasUnhandledLog).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe("createInvoice endpoint", () => {
    test("returns 400 when lineItems is missing", async () => {
      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
      });

      const req = createMockReq({ body: { customerEmail: "john@example.com" } });
      const res = createMockRes();

      await controller.createInvoice(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("lineItems");
    });

    test("returns 400 when customerEmail is missing", async () => {
      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
      });

      const req = createMockReq({
        body: { lineItems: [{ description: "Test", unitPricePence: 1000, quantity: 1 }] },
      });
      const res = createMockRes();

      await controller.createInvoice(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("customerEmail");
    });

    test("returns invoice details on success", async () => {
      mockStripeInstance.customers.list.mockResolvedValue({ data: [] });
      mockStripeInstance.customers.create.mockResolvedValue({ id: "cus_inv_123" });
      mockStripeInstance.invoiceItems.create.mockResolvedValue({ id: "ii_inv_1" });
      mockStripeInstance.invoices.create.mockResolvedValue({ id: "inv_ctrl_123" });
      mockStripeInstance.invoices.finalizeInvoice.mockResolvedValue({
        id: "inv_ctrl_123",
        number: "INV-CTRL-001",
        amount_due: 20000,
        hosted_invoice_url: "https://invoice.stripe.com/ctrl",
        due_date: 1700000000,
      });

      const controller = createPaymentController({
        stripeSecretKey: "sk_test_xxx",
        invoiceFooter: "Pay by bank transfer",
      });

      const req = createMockReq({
        body: {
          customerEmail: "john@example.com",
          customerName: "John Smith",
          productName: "Camden Hunt",
          lineItems: [
            { description: "Scavenger Hunt", unitPricePence: 2000, quantity: 10 },
          ],
          daysUntilDue: 7,
          metadata: { booking_ref: "BR-123" },
        },
      });
      const res = createMockRes();

      await controller.createInvoice(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.invoice.number).toBe("INV-CTRL-001");
      expect(res.body.invoice.amountDue).toBe(20000);
      expect(res.body.invoice.hostedInvoiceUrl).toBe("https://invoice.stripe.com/ctrl");
    });
  });
});

describe("Payment Routes", () => {
  test("admin invoice route is protected by authMiddleware", () => {
    const mockAuth = jest.fn((req, res, next) => next());

    const router = createPaymentRoutes({
      stripeSecretKey: "sk_test_xxx",
      webhookSecret: "whsec_test",
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
    const router = createPaymentRoutes({
      stripeSecretKey: "sk_test_xxx",
      webhookSecret: "whsec_test",
    });

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
