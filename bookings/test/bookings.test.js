const { BOOKING_STATUSES, isValidStatus } = require("../src/services/statuses");
const { generateBookingNumber } = require("../src/services/booking-number");
const { findOrCreateCustomer } = require("../src/services/customer");
const { createBookingController } = require("../src/controller");

// Mock Prisma
function createMockPrisma() {
  return {
    booking: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    customer: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };
}

// Mock Express req/res
function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
  };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((data) => {
    res.body = data;
    return res;
  });
  return res;
}

// =====================================================
// 1-2: Booking Statuses
// =====================================================

describe("Booking Statuses", () => {
  test("1. All CRM statuses are present", () => {
    const expected = [
      "ENQUIRY",
      "INVOICE_SENT",
      "CONFIRMED",
      "DEPOSIT_PAID",
      "PAID",
      "COMPLETED",
      "LOST",
      "QUALIFIED_OUT",
      "CANCELLED",
    ];
    expect(BOOKING_STATUSES).toEqual(expected);
  });

  test("2. isValidStatus accepts valid and rejects invalid", () => {
    expect(isValidStatus("ENQUIRY")).toBe(true);
    expect(isValidStatus("INVOICE_SENT")).toBe(true);
    expect(isValidStatus("CONFIRMED")).toBe(true);
    expect(isValidStatus("DEPOSIT_PAID")).toBe(true);
    expect(isValidStatus("PAID")).toBe(true);
    expect(isValidStatus("COMPLETED")).toBe(true);
    expect(isValidStatus("LOST")).toBe(true);
    expect(isValidStatus("QUALIFIED_OUT")).toBe(true);
    expect(isValidStatus("CANCELLED")).toBe(true);
    // Invalid
    expect(isValidStatus("QUOTED")).toBe(false);
    expect(isValidStatus("PENCILLED")).toBe(false);
    expect(isValidStatus("PENDING")).toBe(false);
    expect(isValidStatus("")).toBe(false);
  });
});

// =====================================================
// 3-4: Booking Number
// =====================================================

describe("Booking Number", () => {
  test("3. Format: {PREFIX}-{YYYYMM}-{HEX} (6 char hex)", () => {
    const number = generateBookingNumber("BR");
    const now = new Date();
    const expectedPrefix = `BR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

    expect(number).toMatch(/^BR-\d{6}-[A-F0-9]{6}$/);
    expect(number.startsWith(expectedPrefix)).toBe(true);
  });

  test("4. Uniqueness (generates different numbers)", () => {
    const numbers = new Set();
    for (let i = 0; i < 100; i++) {
      numbers.add(generateBookingNumber("FBQ"));
    }
    // With 3 random bytes (16 million possibilities), 100 should all be unique
    expect(numbers.size).toBe(100);
  });
});

// =====================================================
// 5-7: Find or Create Customer
// =====================================================

describe("Find or Create Customer", () => {
  let mockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
  });

  test("5. Creates new customer when not found", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue(null);
    mockPrisma.customer.create.mockResolvedValue({
      id: "cust-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: "07700900000",
      company: "Acme Ltd",
      source: "website",
    });

    const result = await findOrCreateCustomer(mockPrisma, {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: "07700900000",
      company: "Acme Ltd",
      source: "website",
    });

    expect(result).not.toBeNull();
    expect(result.firstName).toBe("Jane");
    expect(mockPrisma.customer.create).toHaveBeenCalledWith({
      data: {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phone: "07700900000",
        company: "Acme Ltd",
        source: "website",
      },
    });
  });

  test("6. Updates existing customer with changed fields", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "cust-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: null,
      company: null,
    });
    mockPrisma.customer.update.mockResolvedValue({
      id: "cust-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: "07700900000",
      company: "Acme Ltd",
    });

    const result = await findOrCreateCustomer(mockPrisma, {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: "07700900000",
      company: "Acme Ltd",
      source: "website",
    });

    expect(result.phone).toBe("07700900000");
    expect(mockPrisma.customer.update).toHaveBeenCalledWith({
      where: { email: "jane@example.com" },
      data: { phone: "07700900000", company: "Acme Ltd" },
    });
  });

  test("7. Returns null on error without throwing", async () => {
    mockPrisma.customer.findUnique.mockRejectedValue(new Error("DB down"));

    const result = await findOrCreateCustomer(mockPrisma, {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      source: "website",
    });

    expect(result).toBeNull();
  });
});

// =====================================================
// 8-10: Create Booking (Enquiry)
// =====================================================

describe("Create Booking", () => {
  let mockPrisma;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    controller = createBookingController(mockPrisma, { brandPrefix: "BR" });
  });

  test("8. Sets status ENQUIRY and generates booking number", async () => {
    const createdBooking = {
      id: "uuid-1",
      bookingNumber: "BR-202604-AB12CD",
      status: "ENQUIRY",
      customerName: "John Smith",
      customerEmail: "john@example.com",
      groupSize: 20,
    };
    mockPrisma.booking.create.mockResolvedValue(createdBooking);

    // Use a date 14 days in the future to pass 7-day validation
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const futureDateStr = futureDate.toISOString().split("T")[0];

    const req = mockReq({
      body: {
        customerName: "John Smith",
        customerEmail: "john@example.com",
        groupSize: 20,
        eventDate: futureDateStr,
        productId: "prod-1",
      },
    });
    const res = mockRes();

    await controller.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();

    const createCall = mockPrisma.booking.create.mock.calls[0][0];
    expect(createCall.data.bookingNumber).toMatch(/^BR-\d{6}-[A-F0-9]{6}$/);
    expect(createCall.data.customerName).toBe("John Smith");
    expect(createCall.data.customerEmail).toBe("john@example.com");
    expect(createCall.data.groupSize).toBe(20);
  });

  test("9. Validates required fields (customerName, customerEmail, groupSize, eventDate)", async () => {
    // Missing customerName
    const req1 = mockReq({ body: { customerEmail: "john@example.com", groupSize: 10, eventDate: "2027-01-01" } });
    const res1 = mockRes();
    await controller.create(req1, res1);
    expect(res1.status).toHaveBeenCalledWith(400);
    expect(res1.body.error).toContain("Missing required fields");

    // Missing eventDate
    const req2 = mockReq({ body: { customerName: "John", customerEmail: "john@example.com", groupSize: 10 } });
    const res2 = mockRes();
    await controller.create(req2, res2);
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  test("10. Rejects event dates less than 7 days from now", async () => {
    const tooSoon = new Date();
    tooSoon.setDate(tooSoon.getDate() + 3);
    const tooSoonStr = tooSoon.toISOString().split("T")[0];

    const req = mockReq({
      body: {
        customerName: "John Smith",
        customerEmail: "john@example.com",
        groupSize: 20,
        eventDate: tooSoonStr,
      },
    });
    const res = mockRes();

    await controller.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain("7 days notice");
  });
});

// =====================================================
// 11-12: Find or Create Customer in Booking Flow
// =====================================================

describe("Customer in Booking Flow", () => {
  let mockPrisma;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    controller = createBookingController(mockPrisma, { brandPrefix: "BR" });
  });

  test("11. Creates customer when firstName and lastName provided", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue(null);
    mockPrisma.customer.create.mockResolvedValue({
      id: "cust-1",
      firstName: "John",
      lastName: "Smith",
      email: "john@example.com",
    });
    mockPrisma.booking.create.mockResolvedValue({
      id: "uuid-1",
      bookingNumber: "BR-202604-AB12CD",
      customerId: "cust-1",
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);

    const req = mockReq({
      body: {
        customerName: "John Smith",
        customerEmail: "john@example.com",
        firstName: "John",
        lastName: "Smith",
        groupSize: 20,
        eventDate: futureDate.toISOString(),
      },
    });
    const res = mockRes();

    await controller.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const createCall = mockPrisma.booking.create.mock.calls[0][0];
    expect(createCall.data.customerId).toBe("cust-1");
  });

  test("12. Skips customer creation when firstName/lastName not provided", async () => {
    mockPrisma.booking.create.mockResolvedValue({
      id: "uuid-1",
      bookingNumber: "BR-202604-AB12CD",
      customerId: null,
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);

    const req = mockReq({
      body: {
        customerName: "John Smith",
        customerEmail: "john@example.com",
        groupSize: 20,
        eventDate: futureDate.toISOString(),
      },
    });
    const res = mockRes();

    await controller.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockPrisma.customer.findUnique).not.toHaveBeenCalled();
    const createCall = mockPrisma.booking.create.mock.calls[0][0];
    expect(createCall.data.customerId).toBeNull();
  });
});

// =====================================================
// 13-14: Admin Update Status
// =====================================================

describe("Admin Update Status", () => {
  let mockPrisma;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    controller = createBookingController(mockPrisma);
  });

  test("13. Accepts valid statuses", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({ id: "uuid-1", status: "ENQUIRY" });
    mockPrisma.booking.update.mockResolvedValue({ id: "uuid-1", status: "INVOICE_SENT" });

    const req = mockReq({ params: { id: "uuid-1" }, body: { status: "INVOICE_SENT" } });
    const res = mockRes();

    await controller.updateStatus(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(mockPrisma.booking.update).toHaveBeenCalledWith({
      where: { id: "uuid-1" },
      data: { status: "INVOICE_SENT" },
    });
  });

  test("14. Rejects invalid statuses", async () => {
    const req = mockReq({ params: { id: "uuid-1" }, body: { status: "QUOTED" } });
    const res = mockRes();

    await controller.updateStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toBe("Invalid status");
    expect(mockPrisma.booking.update).not.toHaveBeenCalled();
  });
});

// =====================================================
// 15-16: Admin Send Invoice
// =====================================================

describe("Admin Send Invoice", () => {
  let mockPrisma;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
  });

  test("15. Fires onSendInvoice hook", async () => {
    const onSendInvoice = jest.fn();
    controller = createBookingController(mockPrisma, { hooks: { onSendInvoice } });

    mockPrisma.booking.findUnique.mockResolvedValue({
      id: "uuid-1",
      bookingNumber: "BR-202604-AB12CD",
      status: "ENQUIRY",
    });

    const req = mockReq({ params: { id: "uuid-1" } });
    const res = mockRes();

    await controller.sendInvoice(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.message).toBe("Invoice send triggered");
    expect(onSendInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ id: "uuid-1", bookingNumber: "BR-202604-AB12CD" }),
      { test: false }
    );
  });

  test("16. Returns 404 for non-existent booking", async () => {
    controller = createBookingController(mockPrisma);
    mockPrisma.booking.findUnique.mockResolvedValue(null);

    const req = mockReq({ params: { id: "uuid-999" } });
    const res = mockRes();

    await controller.sendInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.error).toBe("Booking not found");
  });
});

// =====================================================
// 17-18: Dashboard
// =====================================================

describe("Dashboard", () => {
  let mockPrisma;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    controller = createBookingController(mockPrisma);
  });

  test("17. Returns status counts and recent bookings", async () => {
    // Mock count for each status
    mockPrisma.booking.count.mockResolvedValue(3);
    mockPrisma.booking.findMany.mockResolvedValue([
      { id: "uuid-1", bookingNumber: "BR-202604-AB12CD", status: "ENQUIRY" },
    ]);

    const req = mockReq();
    const res = mockRes();

    await controller.dashboard(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.ENQUIRY).toBe(3);
    expect(res.body.stats.CANCELLED).toBe(3);
    expect(res.body.recentBookings).toHaveLength(1);
  });

  test("18. Counts called for each status", async () => {
    mockPrisma.booking.count.mockResolvedValue(0);
    mockPrisma.booking.findMany.mockResolvedValue([]);

    const req = mockReq();
    const res = mockRes();

    await controller.dashboard(req, res);

    // count should be called once per status
    expect(mockPrisma.booking.count).toHaveBeenCalledTimes(BOOKING_STATUSES.length);
  });
});

// =====================================================
// 19-21: Customer Admin Endpoints
// =====================================================

describe("Customer Admin", () => {
  let mockPrisma;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    controller = createBookingController(mockPrisma);
  });

  test("19. listCustomers returns paginated results with search", async () => {
    mockPrisma.customer.findMany.mockResolvedValue([
      { id: "cust-1", firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
    ]);
    mockPrisma.customer.count.mockResolvedValue(1);

    const req = mockReq({ query: { search: "jane", page: "1", limit: "10" } });
    const res = mockRes();

    await controller.listCustomers(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);

    const findCall = mockPrisma.customer.findMany.mock.calls[0][0];
    expect(findCall.where.OR).toEqual([
      { firstName: { contains: "jane" } },
      { lastName: { contains: "jane" } },
      { email: { contains: "jane" } },
      { company: { contains: "jane" } },
    ]);
  });

  test("20. getCustomerById returns 404 for missing customer", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue(null);

    const req = mockReq({ params: { id: "cust-999" } });
    const res = mockRes();

    await controller.getCustomerById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.error).toBe("Customer not found");
  });

  test("21. createCustomer validates required fields", async () => {
    const req = mockReq({ body: { firstName: "Jane" } });
    const res = mockRes();

    await controller.createCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain("firstName, lastName, and email are required");
  });
});

// =====================================================
// 22-23: Hooks
// =====================================================

describe("Hooks", () => {
  let mockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
  });

  test("22. onCreated and onStatusChanged hooks fire", async () => {
    const hooks = {
      onCreated: jest.fn(),
      onStatusChanged: jest.fn(),
    };
    const controller = createBookingController(mockPrisma, { hooks, brandPrefix: "BR" });

    // onCreated
    mockPrisma.booking.create.mockResolvedValue({ id: "uuid-1", bookingNumber: "BR-202604-AB12CD", status: "ENQUIRY" });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);

    const reqCreate = mockReq({
      body: {
        customerName: "John",
        customerEmail: "j@e.com",
        groupSize: 10,
        eventDate: futureDate.toISOString(),
      },
    });
    await controller.create(reqCreate, mockRes());
    expect(hooks.onCreated).toHaveBeenCalled();

    // onStatusChanged
    mockPrisma.booking.findUnique.mockResolvedValue({ id: "uuid-1", status: "ENQUIRY" });
    mockPrisma.booking.update.mockResolvedValue({ id: "uuid-1", status: "CONFIRMED" });

    await controller.updateStatus(
      mockReq({ params: { id: "uuid-1" }, body: { status: "CONFIRMED" } }),
      mockRes()
    );
    expect(hooks.onStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ id: "uuid-1", status: "CONFIRMED" }),
      "ENQUIRY"
    );
  });

  test("23. Hook errors do not fail the operation", async () => {
    const hooks = {
      onCreated: jest.fn().mockRejectedValue(new Error("Hook exploded")),
    };
    const controller = createBookingController(mockPrisma, { hooks, brandPrefix: "BR" });

    const createdBooking = { id: "uuid-1", bookingNumber: "BR-202604-AB12CD", status: "ENQUIRY" };
    mockPrisma.booking.create.mockResolvedValue(createdBooking);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);

    const req = mockReq({
      body: {
        customerName: "John",
        customerEmail: "j@e.com",
        groupSize: 10,
        eventDate: futureDate.toISOString(),
      },
    });
    const res = mockRes();

    await controller.create(req, res);

    // Should still succeed despite hook error
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(createdBooking);
    expect(hooks.onCreated).toHaveBeenCalled();
  });
});

// =====================================================
// 24-25: Payment Actions
// =====================================================

describe("Payment Actions", () => {
  let mockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
  });

  test("24. markAsPaid updates payment fields and fires status hook", async () => {
    const hooks = {
      onStatusChanged: jest.fn(),
    };
    const controller = createBookingController(mockPrisma, { hooks, brandPrefix: "BR" });
    const existing = {
      id: "uuid-1",
      bookingNumber: "BR-202604-AB12CD",
      status: "INVOICE_SENT",
      totalAmount: 30000,
      totalPaid: 0,
    };
    const paid = {
      ...existing,
      status: "PAID",
      totalPaid: 30000,
      stripeSessionId: "cs_test_123",
      stripePaymentId: "pi_test_123",
    };

    mockPrisma.booking.findUnique.mockResolvedValue(existing);
    mockPrisma.booking.update.mockResolvedValue(paid);

    const result = await controller.markAsPaid("uuid-1", "cs_test_123", "pi_test_123", 30000);

    expect(result).toBe(paid);
    expect(mockPrisma.booking.update).toHaveBeenCalledWith({
      where: { id: "uuid-1" },
      data: {
        status: "PAID",
        totalPaid: 30000,
        stripeSessionId: "cs_test_123",
        stripePaymentId: "pi_test_123",
      },
    });
    expect(hooks.onStatusChanged).toHaveBeenCalledWith(paid, "INVOICE_SENT");
  });

  test("25. checkPayment marks booking paid when hook confirms payment", async () => {
    const hooks = {
      onCheckPayment: jest.fn().mockResolvedValue({
        paid: true,
        paymentStatus: "paid",
        amountPaid: 45000,
        stripeSessionId: "cs_test_456",
        stripePaymentId: "pi_test_456",
      }),
      onStatusChanged: jest.fn(),
    };
    const controller = createBookingController(mockPrisma, { hooks, brandPrefix: "BR" });
    const existing = {
      id: "uuid-2",
      bookingNumber: "BR-202604-EF34AB",
      status: "INVOICE_SENT",
      totalAmount: 45000,
      totalPaid: 0,
    };
    const paid = {
      ...existing,
      status: "PAID",
      totalPaid: 45000,
      stripeSessionId: "cs_test_456",
      stripePaymentId: "pi_test_456",
    };

    mockPrisma.booking.findUnique.mockResolvedValue(existing);
    mockPrisma.booking.update.mockResolvedValue(paid);

    const res = mockRes();
    await controller.checkPayment(mockReq({ params: { id: "uuid-2" } }), res);

    expect(hooks.onCheckPayment).toHaveBeenCalledWith(existing);
    expect(res.body).toEqual({
      paid: true,
      message: "Payment received",
      booking: paid,
      paymentStatus: "paid",
    });
    expect(hooks.onStatusChanged).toHaveBeenCalledWith(paid, "INVOICE_SENT");
  });
});

// =====================================================
// 26-27: Public List and Get
// =====================================================

describe("Public Endpoints", () => {
  let mockPrisma;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    controller = createBookingController(mockPrisma);
  });

  test("26. list returns paginated results with status filter", async () => {
    const mockBookings = [
      { id: "uuid-1", bookingNumber: "LZ-202604-AB12CD" },
      { id: "uuid-2", bookingNumber: "LZ-202604-CD34EF" },
    ];
    mockPrisma.booking.findMany.mockResolvedValue(mockBookings);
    mockPrisma.booking.count.mockResolvedValue(50);

    const req = mockReq({ query: { page: "2", limit: "10", status: "enquiry" } });
    const res = mockRes();

    await controller.list(req, res);

    const findCall = mockPrisma.booking.findMany.mock.calls[0][0];
    expect(findCall.skip).toBe(10);
    expect(findCall.take).toBe(10);
    expect(findCall.where.status).toBe("ENQUIRY");

    expect(res.body.data).toEqual(mockBookings);
    expect(res.body.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 50,
      totalPages: 5,
    });
  });

  test("27. getById returns 404 for missing booking", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(null);

    const req = mockReq({ params: { id: "uuid-999" } });
    const res = mockRes();

    await controller.getById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.error).toBe("Booking not found");
  });
});

// =====================================================
// 28: Duplicate Customer Email
// =====================================================

describe("Customer Duplicate Email", () => {
  test("28. createCustomer returns 409 for duplicate email", async () => {
    const mockPrisma = createMockPrisma();
    const controller = createBookingController(mockPrisma);

    const prismaError = new Error("Unique constraint failed");
    prismaError.code = "P2002";
    mockPrisma.customer.create.mockRejectedValue(prismaError);

    const req = mockReq({
      body: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
    });
    const res = mockRes();

    await controller.createCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body.error).toContain("already exists");
  });
});
