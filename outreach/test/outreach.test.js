/**
 * @lozzalingo/outreach - Test Suite
 * Tests for transactional emails, scheduled outreach, templates, log, and controller.
 */

const { createOutreachService } = require("../src/services/triggers");
const { processScheduledOutreach } = require("../src/services/scheduler");
const { getTemplate, DEFAULT_TEMPLATES, formatPence } = require("../src/services/templates");
const { getOutreachLog } = require("../src/services/log");
const { createOutreachController } = require("../src/controller");

// Mock Prisma
function createMockPrisma() {
  return {
    outreachLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((args) =>
        Promise.resolve({ id: "log-123", ...args.data })
      ),
      count: jest.fn().mockResolvedValue(0),
    },
    outreachSchedule: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((args) =>
        Promise.resolve({ id: "sched-123", ...args.data })
      ),
      update: jest.fn().mockImplementation((args) =>
        Promise.resolve({ id: args.where.id, ...args.data })
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

// Mock email service
function createMockEmailService() {
  return {
    sendEmail: jest.fn().mockResolvedValue(true),
  };
}

const testOptions = {
  brandName: "TestBrand",
  brandColour: "#FF6B35",
  baseUrl: "https://test.example.com",
  adminEmail: "admin@test.com",
  bankDetails: {
    sortCode: "60-07-10",
    accountNumber: "50094602",
    iban: "GB90NWBK60071050094602",
    bic: "NWBKGB2L",
  },
};

const testBooking = {
  id: "booking-001",
  bookingNumber: "TB-001",
  customerName: "John Smith",
  customerEmail: "john@example.com",
  eventDate: new Date("2026-06-15"),
  groupSize: 20,
  totalAmount: 50000,
};

// ── Transactional Email Templates ─────────────────────────────────────────────

describe("Transactional Email Templates", () => {
  // Test 1: booking_confirmation template produces correct subject and HTML
  test("booking_confirmation template has correct subject and includes branded content", () => {
    const template = DEFAULT_TEMPLATES.booking_confirmation;
    const result = template(
      { eventName: "Scavenger Hunt", customerEmail: "john@example.com" },
      testOptions,
    );

    expect(result.subject).toBe("Enquiry Received - Scavenger Hunt");
    expect(result.html).toContain("Thanks for your enquiry");
    expect(result.html).toContain("TestBrand");
    expect(result.html).toContain("#FF6B35");
  });

  // Test 2: enquiry_notification template includes all booking details
  test("enquiry_notification template includes customer and booking details", () => {
    const template = DEFAULT_TEMPLATES.enquiry_notification;
    const result = template(
      {
        bookingNumber: "BR-001",
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        customerPhone: "07700900000",
        companyName: "Acme Ltd",
        productName: "City Hunt",
        packageName: "Premium",
        groupSize: 30,
        eventDate: "15 June 2026",
        message: "We need a fun team event",
      },
      testOptions,
    );

    expect(result.subject).toBe("New Enquiry - BR-001 - Jane Doe");
    expect(result.html).toContain("Jane Doe");
    expect(result.html).toContain("jane@example.com");
    expect(result.html).toContain("07700900000");
    expect(result.html).toContain("Acme Ltd");
    expect(result.html).toContain("City Hunt");
    expect(result.html).toContain("Premium");
    expect(result.html).toContain("30");
    expect(result.html).toContain("15 June 2026");
    expect(result.html).toContain("We need a fun team event");
    expect(result.html).toContain("New Enquiry");
  });

  // Test 3: invoice_email template includes bank details and Stripe button
  test("invoice_email template includes bank details and pay button", () => {
    const template = DEFAULT_TEMPLATES.invoice_email;
    const result = template(
      {
        customerFirstName: "John",
        invoiceNumber: "INV-001",
        amountDuePence: 50000,
        hostedInvoiceUrl: "https://stripe.com/invoice/123",
        productName: "Scavenger Hunt",
        companyName: "Acme Ltd",
        bookingNumber: "BR-001",
        eventDate: "15 June 2026",
        eventTime: "14:00",
        groupSize: 20,
      },
      testOptions,
    );

    expect(result.subject).toBe("Invoice INV-001 - \u00a3500.00 - Scavenger Hunt");
    expect(result.html).toContain("60-07-10");
    expect(result.html).toContain("50094602");
    expect(result.html).toContain("GB90NWBK60071050094602");
    expect(result.html).toContain("NWBKGB2L");
    expect(result.html).toContain("Pay Invoice Securely");
    expect(result.html).toContain("https://stripe.com/invoice/123");
    expect(result.html).toContain("INV-001");
    expect(result.html).toContain("\u00a3500.00");
    expect(result.html).toContain("BR-001");
    expect(result.html).toContain("Acme Ltd");
  });

  // Test 4: payment_confirmation template has correct subject and details
  test("payment_confirmation template shows payment details", () => {
    const template = DEFAULT_TEMPLATES.payment_confirmation;
    const result = template(
      {
        customerFirstName: "John",
        invoiceNumber: "INV-001",
        amountPaid: "\u00a3500.00",
        paymentDate: "29 April 2026",
      },
      testOptions,
    );

    expect(result.subject).toBe("Payment Confirmed - Invoice INV-001 - \u00a3500.00");
    expect(result.html).toContain("Payment Confirmed!");
    expect(result.html).toContain("INV-001");
    expect(result.html).toContain("\u00a3500.00");
    expect(result.html).toContain("29 April 2026");
    expect(result.html).toContain("Hello John");
  });

  // Test 5: internal_payment_notification template includes line items
  test("internal_payment_notification template includes line items and details", () => {
    const template = DEFAULT_TEMPLATES.internal_payment_notification;
    const result = template(
      {
        customerName: "John Smith",
        customerEmail: "john@example.com",
        invoiceNumber: "INV-001",
        amountPaid: "\u00a3500.00",
        bookingRef: "BR-001",
        groupSize: 20,
        eventDate: "15 June 2026",
        lineItems: [
          { description: "Scavenger Hunt", quantity: 20, amount: "\u00a3500.00" },
        ],
        hostedUrl: "https://stripe.com/invoice/123",
      },
      testOptions,
    );

    expect(result.subject).toBe("Invoice Paid - John Smith (john@example.com) - Invoice #INV-001");
    expect(result.html).toContain("Invoice Paid");
    expect(result.html).toContain("John Smith");
    expect(result.html).toContain("john@example.com");
    expect(result.html).toContain("Scavenger Hunt");
    expect(result.html).toContain("Qty: 20");
    expect(result.html).toContain("https://stripe.com/invoice/123");
  });

  // Test 6: invoice_email without bank details omits bank section
  test("invoice_email without bank details omits bank transfer section", () => {
    const noBankOptions = { ...testOptions, bankDetails: {} };
    const template = DEFAULT_TEMPLATES.invoice_email;
    const result = template(
      {
        customerFirstName: "John",
        invoiceNumber: "INV-001",
        amountDuePence: 50000,
        hostedInvoiceUrl: "https://stripe.com/invoice/123",
        productName: "Hunt",
      },
      noBankOptions,
    );

    expect(result.html).not.toContain("Bank Transfer");
    expect(result.html).toContain("Pay Invoice Securely");
  });

  // Test 7: invoice_email without hostedInvoiceUrl omits pay button
  test("invoice_email without hosted URL omits pay button", () => {
    const template = DEFAULT_TEMPLATES.invoice_email;
    const result = template(
      {
        customerFirstName: "John",
        invoiceNumber: "INV-001",
        amountDuePence: 50000,
        productName: "Hunt",
      },
      testOptions,
    );

    expect(result.html).not.toContain("Pay Invoice Securely");
    expect(result.html).toContain("60-07-10"); // bank details still present
  });
});

// ── Trigger Service ───────────────────────────────────────────────────────────

describe("Outreach Trigger Service", () => {
  let mockPrisma;
  let mockEmailService;
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockEmailService = createMockEmailService();
    service = createOutreachService(mockPrisma, mockEmailService, testOptions);
  });

  // Test 8: trigger sends email via emailService
  test("trigger sends email via emailService", async () => {
    const result = await service.trigger("booking_created", testBooking);

    expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "john@example.com",
        subject: expect.stringContaining("Booking enquiry received"),
        html: expect.any(String),
      })
    );
    expect(result.sent).toBe(true);
  });

  // Test 9: trigger logs to OutreachLog on success
  test("trigger logs to OutreachLog on success", async () => {
    await service.trigger("booking_created", testBooking);

    expect(mockPrisma.outreachLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.outreachLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        trigger: "booking_created",
        recipientEmail: "john@example.com",
        status: "SENT",
        bookingId: "booking-001",
      }),
    });
  });

  // Test 10: trigger logs failure to OutreachLog when email fails
  test("trigger logs failure to OutreachLog when email fails", async () => {
    mockEmailService.sendEmail.mockResolvedValue(false);

    const result = await service.trigger("booking_created", testBooking);

    expect(result.sent).toBe(false);
    expect(mockPrisma.outreachLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "FAILED",
        error: expect.any(String),
      }),
    });
  });

  // Test 11: trigger skips duplicate within 5 minutes (same trigger + bookingId)
  test("trigger skips duplicate within 5 minutes", async () => {
    mockPrisma.outreachLog.findFirst.mockResolvedValue({
      id: "existing-log",
      trigger: "booking_created",
      bookingId: "booking-001",
    });

    const result = await service.trigger("booking_created", testBooking);

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("duplicate");
    expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
  });

  // Test 12: trigger allows same trigger for different bookings
  test("trigger allows same trigger for different bookings", async () => {
    mockPrisma.outreachLog.findFirst.mockResolvedValue(null);
    const result1 = await service.trigger("booking_created", testBooking);
    expect(result1.sent).toBe(true);

    const differentBooking = { ...testBooking, id: "booking-002", bookingNumber: "TB-002" };
    const result2 = await service.trigger("booking_created", differentBooking);
    expect(result2.sent).toBe(true);

    expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(2);
  });

  // Test 13: enquiry_notification sends to adminEmail with replyTo
  test("enquiry_notification sends to adminEmail with reply-to header", async () => {
    const result = await service.trigger("enquiry_notification", {
      bookingNumber: "BR-001",
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
      groupSize: 10,
      eventDate: "1 July 2026",
    });

    expect(result.sent).toBe(true);
    expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@test.com",
        subject: expect.stringContaining("New Enquiry"),
        headers: expect.objectContaining({ "Reply-To": "jane@example.com" }),
      })
    );
  });

  // Test 14: internal_payment_notification sends to adminEmail
  test("internal_payment_notification sends to adminEmail", async () => {
    const result = await service.trigger("internal_payment_notification", {
      id: "booking-001",
      customerName: "John Smith",
      customerEmail: "john@example.com",
      invoiceNumber: "INV-001",
      amountPaid: "\u00a3500.00",
      bookingRef: "BR-001",
      groupSize: 20,
      eventDate: "15 June 2026",
      lineItems: [],
    });

    expect(result.sent).toBe(true);
    expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "admin@test.com" })
    );
  });

  // Test 15: schedule creates PENDING OutreachSchedule record
  test("schedule creates PENDING OutreachSchedule record", async () => {
    const sendAt = new Date("2026-06-08");

    const result = await service.schedule("event_reminder_7day", testBooking, sendAt);

    expect(result.scheduleId).toBe("sched-123");
    expect(mockPrisma.outreachSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        trigger: "event_reminder_7day",
        recipientEmail: "john@example.com",
        bookingId: "booking-001",
        scheduledFor: sendAt,
        status: "PENDING",
      }),
    });
  });

  // Test 16: cancelScheduled sets matching records to CANCELLED
  test("cancelScheduled sets matching records to CANCELLED", async () => {
    mockPrisma.outreachSchedule.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.cancelScheduled("booking-001");

    expect(result.cancelled).toBe(2);
    expect(mockPrisma.outreachSchedule.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        bookingId: "booking-001",
        status: "PENDING",
      }),
      data: { status: "CANCELLED" },
    });
  });

  // Test 17: cancelScheduled with triggerName only cancels that specific trigger
  test("cancelScheduled with triggerName only cancels that specific trigger", async () => {
    mockPrisma.outreachSchedule.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.cancelScheduled("booking-001", "enquiry_followup_3day");

    expect(result.cancelled).toBe(1);
    expect(mockPrisma.outreachSchedule.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        bookingId: "booking-001",
        status: "PENDING",
        trigger: "enquiry_followup_3day",
      }),
      data: { status: "CANCELLED" },
    });
  });

  // Test 18: cancelScheduled without triggerName cancels all for booking
  test("cancelScheduled without triggerName cancels all for booking", async () => {
    mockPrisma.outreachSchedule.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.cancelScheduled("booking-001");

    expect(result.cancelled).toBe(3);
    const callArgs = mockPrisma.outreachSchedule.updateMany.mock.calls[0][0];
    expect(callArgs.where).not.toHaveProperty("trigger");
    expect(callArgs.where.bookingId).toBe("booking-001");
  });

  // Test 19: trigger returns no_recipient when admin trigger has no adminEmail
  test("admin trigger with no adminEmail returns no_recipient", async () => {
    const noAdminService = createOutreachService(mockPrisma, mockEmailService, {
      ...testOptions,
      adminEmail: undefined,
    });

    const result = await noAdminService.trigger("enquiry_notification", {
      bookingNumber: "BR-001",
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
      groupSize: 10,
      eventDate: "1 July 2026",
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("no_recipient");
  });
});

// ── Scheduler ─────────────────────────────────────────────────────────────────

describe("Scheduler - processScheduledOutreach", () => {
  let mockPrisma;
  let mockEmailService;
  let outreachService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockEmailService = createMockEmailService();
    outreachService = createOutreachService(mockPrisma, mockEmailService, testOptions);
  });

  // Test 20: processScheduledOutreach processes due items
  test("processScheduledOutreach processes due items", async () => {
    const pastDate = new Date(Date.now() - 60000);
    mockPrisma.outreachSchedule.findMany.mockResolvedValue([
      {
        id: "sched-1",
        trigger: "event_reminder_7day",
        recipientEmail: "john@example.com",
        bookingId: "booking-001",
        scheduledFor: pastDate,
        status: "PENDING",
      },
    ]);

    const result = await processScheduledOutreach(mockPrisma, outreachService);

    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
  });

  // Test 21: processScheduledOutreach skips future items
  test("processScheduledOutreach skips future items", async () => {
    mockPrisma.outreachSchedule.findMany.mockResolvedValue([]);

    const result = await processScheduledOutreach(mockPrisma, outreachService);

    expect(result.processed).toBe(0);
    expect(result.sent).toBe(0);
  });

  // Test 22: processScheduledOutreach skips CANCELLED items
  test("processScheduledOutreach skips CANCELLED items", async () => {
    mockPrisma.outreachSchedule.findMany.mockResolvedValue([]);

    const result = await processScheduledOutreach(mockPrisma, outreachService);

    expect(result.processed).toBe(0);
    expect(mockPrisma.outreachSchedule.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: "PENDING",
      }),
    });
  });

  // Test 23: processScheduledOutreach marks processed as SENT
  test("processScheduledOutreach marks processed as SENT", async () => {
    const pastDate = new Date(Date.now() - 60000);
    mockPrisma.outreachSchedule.findMany.mockResolvedValue([
      {
        id: "sched-1",
        trigger: "booking_paid",
        recipientEmail: "john@example.com",
        bookingId: "booking-001",
        scheduledFor: pastDate,
        status: "PENDING",
      },
    ]);

    await processScheduledOutreach(mockPrisma, outreachService);

    expect(mockPrisma.outreachSchedule.update).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      data: expect.objectContaining({
        status: "SENT",
        processedAt: expect.any(Date),
      }),
    });
  });

  // Test 24: processScheduledOutreach marks failed as FAILED with error
  test("processScheduledOutreach marks failed as FAILED with error", async () => {
    mockEmailService.sendEmail.mockResolvedValue(false);
    const pastDate = new Date(Date.now() - 60000);
    mockPrisma.outreachSchedule.findMany.mockResolvedValue([
      {
        id: "sched-1",
        trigger: "booking_paid",
        recipientEmail: "john@example.com",
        bookingId: "booking-001",
        scheduledFor: pastDate,
        status: "PENDING",
      },
    ]);

    const result = await processScheduledOutreach(mockPrisma, outreachService);

    expect(result.failed).toBe(1);
    expect(mockPrisma.outreachSchedule.update).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      data: expect.objectContaining({
        status: "FAILED",
        processedAt: expect.any(Date),
        error: expect.any(String),
      }),
    });
  });
});

// ── Templates ─────────────────────────────────────────────────────────────────

describe("Templates", () => {
  // Test 25: getTemplate returns default template for known trigger
  test("getTemplate returns default template for known trigger", () => {
    const template = getTemplate("booking_created");

    expect(template).not.toBeNull();
    expect(typeof template).toBe("function");

    const result = template(testBooking, testOptions);
    expect(result.subject).toContain("Booking enquiry received");
    expect(result.html).toContain("John Smith");
  });

  // Test 26: getTemplate returns override when provided
  test("getTemplate returns override when provided", () => {
    const customTemplate = (data, opts) => ({
      subject: `Custom subject for ${data.bookingNumber}`,
      html: "<p>Custom template</p>",
    });

    const template = getTemplate("booking_created", {
      booking_created: customTemplate,
    });

    expect(template).toBe(customTemplate);
    const result = template(testBooking, testOptions);
    expect(result.subject).toBe("Custom subject for TB-001");
  });

  // Test 27: getTemplate returns null for unknown trigger
  test("getTemplate returns null for unknown trigger", () => {
    const template = getTemplate("totally_unknown_trigger");
    expect(template).toBeNull();
  });

  // Test 28: formatPence converts pence to pounds string
  test("formatPence converts pence to pounds string", () => {
    expect(formatPence(50000)).toBe("\u00a3500.00");
    expect(formatPence(150)).toBe("\u00a31.50");
    expect(formatPence(0)).toBe("\u00a30.00");
    expect(formatPence(null)).toBeNull();
    expect(formatPence(undefined)).toBeNull();
  });

  // Test 29: all default templates exist and are callable
  test("all default templates are functions", () => {
    const expectedTriggers = [
      "booking_confirmation", "enquiry_notification", "invoice_email",
      "payment_confirmation", "internal_payment_notification",
      "booking_created", "booking_quoted", "booking_pencilled",
      "booking_paid", "booking_confirmed", "booking_cancelled",
      "pencil_expiring", "pencil_expired",
      "event_reminder_7day", "event_reminder_1day",
      "post_event_followup", "enquiry_followup_3day",
      "purchase_completed", "subscription_renewed", "subscription_cancelled",
    ];

    for (const trigger of expectedTriggers) {
      expect(typeof DEFAULT_TEMPLATES[trigger]).toBe("function");
      const result = DEFAULT_TEMPLATES[trigger](testBooking, testOptions);
      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("html");
      expect(typeof result.subject).toBe("string");
      expect(typeof result.html).toBe("string");
    }
  });
});

// ── Log Service ───────────────────────────────────────────────────────────────

describe("Log Service", () => {
  let mockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
  });

  // Test 30: getOutreachLog filters by bookingId
  test("getOutreachLog filters by bookingId", async () => {
    mockPrisma.outreachLog.findMany.mockResolvedValue([
      { id: "log-1", trigger: "booking_created", bookingId: "booking-001" },
    ]);
    mockPrisma.outreachLog.count.mockResolvedValue(1);

    const result = await getOutreachLog(mockPrisma, { bookingId: "booking-001" });

    expect(result.data).toHaveLength(1);
    expect(mockPrisma.outreachLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bookingId: "booking-001" }),
      })
    );
  });

  // Test 31: getOutreachLog filters by email
  test("getOutreachLog filters by email", async () => {
    mockPrisma.outreachLog.findMany.mockResolvedValue([
      { id: "log-1", recipientEmail: "john@example.com" },
    ]);
    mockPrisma.outreachLog.count.mockResolvedValue(1);

    const result = await getOutreachLog(mockPrisma, { email: "john@example.com" });

    expect(result.data).toHaveLength(1);
    expect(mockPrisma.outreachLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recipientEmail: "john@example.com" }),
      })
    );
  });

  // Test 32: getOutreachLog paginates correctly
  test("getOutreachLog paginates correctly", async () => {
    mockPrisma.outreachLog.findMany.mockResolvedValue([]);
    mockPrisma.outreachLog.count.mockResolvedValue(50);

    const result = await getOutreachLog(mockPrisma, { page: 2, limit: 10 });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 50,
      totalPages: 5,
    });
    expect(mockPrisma.outreachLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      })
    );
  });
});

// ── Controller ────────────────────────────────────────────────────────────────

describe("Controller - Admin Endpoints", () => {
  let mockPrisma;
  let mockEmailService;
  let outreachService;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockEmailService = createMockEmailService();
    outreachService = createOutreachService(mockPrisma, mockEmailService, testOptions);
    controller = createOutreachController(mockPrisma, { outreachService });
  });

  // Test 33: Admin trigger endpoint fires manually
  test("admin trigger endpoint fires manually", async () => {
    mockPrisma.booking = {
      findUnique: jest.fn().mockResolvedValue({
        id: "booking-001",
        bookingNumber: "TB-001",
        customerName: "John Smith",
        customerEmail: "john@example.com",
      }),
    };

    const req = {
      body: {
        triggerName: "booking_paid",
        bookingId: "booking-001",
      },
    };
    const res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    await controller.manualTrigger(req, res);

    expect(mockEmailService.sendEmail).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ sent: expect.any(Boolean) })
    );
  });

  // Test 34: Admin cancel endpoint cancels scheduled item
  test("admin cancel endpoint cancels scheduled item", async () => {
    mockPrisma.outreachSchedule.update.mockResolvedValue({
      id: "sched-456",
      status: "CANCELLED",
    });

    const req = { params: { id: "sched-456" } };
    const res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    await controller.cancelScheduledItem(req, res);

    expect(mockPrisma.outreachSchedule.update).toHaveBeenCalledWith({
      where: { id: "sched-456" },
      data: { status: "CANCELLED" },
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Scheduled outreach cancelled", id: "sched-456" })
    );
  });
});
