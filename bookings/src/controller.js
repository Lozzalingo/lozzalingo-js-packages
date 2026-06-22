const { generateBookingNumber } = require("./services/booking-number");
const { findOrCreateCustomer } = require("./services/customer");
const { BOOKING_STATUSES, isValidStatus } = require("./services/statuses");
const { pushBookingToSheet } = require("./services/google-sheets");

// Lazy-load CRM customer service (falls back to built-in if not installed)
let _crmFindOrCreate;
function getCrmFindOrCreate() {
  if (_crmFindOrCreate === undefined) {
    try {
      _crmFindOrCreate = require("@lozzalingo/crm/services/customer").findOrCreateCustomer;
      console.log("[Bookings] CRM-aware findOrCreateCustomer loaded");
    } catch (e) {
      _crmFindOrCreate = null;
    }
  }
  return _crmFindOrCreate;
}

function createBookingController(prisma, options = {}) {
  const {
    modelName = "booking",
    customerModelName = "customer",
    invoiceModelName = "invoice",
    brandPrefix = "LZ",
    hooks = {},
    buildCreateData: customBuildCreateData,
  } = options;

  console.log("[Bookings] Initialising bookings controller");

  // Helper to safely fire a hook
  async function fireHook(name, ...args) {
    if (hooks[name]) {
      try {
        await hooks[name](...args);
      } catch (hookError) {
        console.error(`[Bookings] ${name} hook failed:`, hookError.message);
        // Hook errors are non-fatal, do not bubble to client
      }
    }
  }

  // ── Public endpoints ────────────────────────────────────────────────────────

  async function create(req, res) {
    try {
      const {
        productId,
        packageId,
        bookingType,
        source,
        customerName,
        customerEmail,
        customerPhone,
        companyName,
        firstName,
        lastName,
        groupSize,
        eventDate,
        eventTime,
        duration,
        timeBlocking,
        message,
        fingerprint,
      } = req.body;

      console.log(`[Bookings] Create booking request - name: ${customerName}, email: ${customerEmail}, productId: ${productId || "none"}`);

      if (!customerName || !customerEmail || !groupSize || !eventDate) {
        console.log("[Bookings] Validation failed - missing required fields");
        return res.status(400).json({
          error: "Missing required fields: customerName, customerEmail, groupSize, eventDate",
        });
      }

      // Enforce 7-day minimum notice
      const parsedDate = new Date(eventDate);
      const minDate = new Date();
      minDate.setDate(minDate.getDate() + 7);
      minDate.setHours(0, 0, 0, 0);
      if (parsedDate < minDate) {
        console.log(`[Bookings] Event date too soon (minimum 7 days notice): ${eventDate}`);
        return res.status(400).json({
          error: "Bookings require at least 7 days notice. Please choose a later date.",
        });
      }

      // Find or create customer if firstName and lastName provided
      // Use CRM-aware version if available (adds fingerprint, customer number, etc.)
      let customer = null;
      if (firstName && lastName && customerEmail) {
        const crmFindOrCreate = getCrmFindOrCreate();
        if (crmFindOrCreate) {
          customer = await crmFindOrCreate(prisma, {
            firstName,
            lastName,
            email: customerEmail,
            phone: customerPhone || null,
            company: companyName || null,
            fingerprint: fingerprint || null,
            source: source || "website",
            customerPrefix: brandPrefix,
          });
        } else {
          customer = await findOrCreateCustomer(prisma, {
            firstName,
            lastName,
            email: customerEmail,
            phone: customerPhone || null,
            company: companyName || null,
            source: source || "website",
          });
        }
        if (customer) {
          console.log(`[Bookings] Customer resolved: ${customer.id}`);
        }
      }

      const bookingNumber = generateBookingNumber(brandPrefix);
      console.log(`[Bookings] Creating booking ${bookingNumber}`);

      // Allow sites to customise the data shape for their schema
      const defaultData = {
        bookingNumber,
        productId: productId || null,
        packageId: packageId || null,
        customerId: customer ? customer.id : null,
        bookingType: bookingType || "PRIVATE",
        source: source || null,
        customerName,
        customerEmail,
        customerPhone: customerPhone || null,
        companyName: companyName || null,
        groupSize: parseInt(groupSize),
        eventDate: new Date(eventDate),
        eventTime: eventTime || null,
        duration: duration || null,
        timeBlocking: timeBlocking || null,
        message: message || null,
      };

      const createData = customBuildCreateData
        ? customBuildCreateData(defaultData, req.body)
        : defaultData;

      // Check calendar availability before creating (prevents duplicate bookings)
      if (hooks.onCheckAvailability && createData.eventTime) {
        try {
          const availability = await hooks.onCheckAvailability(createData);
          if (!availability.available) {
            console.log(`[Bookings] Booking rejected - time slot not available: ${createData.eventTime} on ${eventDate}`);
            return res.status(409).json({
              error: "This time slot is no longer available. Please choose a different time.",
              conflicts: availability.conflicts?.length || 0,
            });
          }
        } catch (checkErr) {
          console.error("[Bookings] Availability check failed:", checkErr.message);
          // Allow booking to proceed if the check itself fails
        }
      }

      const booking = await prisma[modelName].create({
        data: createData,
      });

      console.log(`[Bookings] Created: ${bookingNumber}`);
      await fireHook("onCreated", booking);

      return res.status(201).json(booking);
    } catch (error) {
      console.error("[Bookings] Failed to create booking:", error.message);
      return res.status(500).json({ error: "Failed to create booking" });
    }
  }

  async function list(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const skip = (page - 1) * limit;

      const where = {};
      if (req.query.status) {
        where.status = req.query.status.toUpperCase();
      }

      const [records, total] = await Promise.all([
        prisma[modelName].findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma[modelName].count({ where }),
      ]);

      console.log(`[Bookings] Fetched ${records.length} bookings`);

      return res.json({
        data: records,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      console.error("[Bookings] Failed to fetch bookings:", error.message);
      return res.status(500).json({ error: "Failed to fetch bookings" });
    }
  }

  async function getById(req, res) {
    try {
      const { id } = req.params;
      const booking = await prisma[modelName].findUnique({ where: { id } });

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      return res.json(booking);
    } catch (error) {
      console.error("[Bookings] Failed to fetch booking:", error.message);
      return res.status(500).json({ error: "Failed to fetch booking" });
    }
  }

  // ── Admin endpoints ─────────────────────────────────────────────────────────

  async function adminList(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const skip = (page - 1) * limit;

      const where = {};
      if (req.query.status) {
        where.status = req.query.status.toUpperCase();
      }

      console.log(`[Bookings] Admin fetching bookings (page ${page}, status: ${req.query.status || "all"})`);

      const [records, total] = await Promise.all([
        prisma[modelName].findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma[modelName].count({ where }),
      ]);

      return res.json({
        data: records,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      console.error("[Bookings] Failed to fetch admin bookings:", error.message);
      return res.status(500).json({ error: "Failed to fetch bookings" });
    }
  }

  async function updateBooking(req, res) {
    try {
      const { id } = req.params;
      const existing = await prisma[modelName].findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Whitelist of editable fields
      const editable = [
        "customerName", "customerEmail", "customerPhone", "companyName",
        "groupSize", "eventDate", "eventTime", "message",
        "groupType", "style", "drinkStyle", "firstPlacePrize",
        "duration", "taskSections", "wantsMedals", "wantsPhotoPrints",
        "slotStartTime", "slotEndTime", "timeBlocking", "bufferHours",
        "locationName", "locationId",
        "totalAmount", "depositAmount", "balanceAmount", "quotedPrice",
        "notes", "source", "assignedTo", "productId", "packageId",
        "bookingType", "specialRequests",
      ];

      const data = {};
      for (const field of editable) {
        if (req.body[field] !== undefined) {
          if (field === "groupSize") {
            data[field] = parseInt(req.body[field]);
          } else if (field === "eventDate") {
            data[field] = new Date(req.body[field]);
          } else if (field === "totalAmount" || field === "depositAmount" || field === "balanceAmount" || field === "quotedPrice" || field === "bufferHours") {
            data[field] = req.body[field] !== null && req.body[field] !== "" ? parseInt(req.body[field]) : null;
          } else if (field === "wantsMedals" || field === "wantsPhotoPrints") {
            data[field] = !!req.body[field];
          } else if (field === "packageId" || field === "productId" || field === "locationId" || field === "eventId" || field === "customerId") {
            data[field] = req.body[field] || null;
          } else {
            data[field] = req.body[field];
          }
        }
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const booking = await prisma[modelName].update({
        where: { id },
        data,
      });

      console.log(`[Bookings] Updated booking ${booking.bookingNumber}: ${Object.keys(data).join(", ")}`);
      return res.json(booking);
    } catch (error) {
      console.error("[Bookings] Failed to update booking:", error.message);
      return res.status(500).json({ error: "Failed to update booking" });
    }
  }

  async function updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!isValidStatus(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const existing = await prisma[modelName].findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const oldStatus = existing.status;
      const booking = await prisma[modelName].update({
        where: { id },
        data: { status },
      });

      console.log(`[Bookings] Status changed: ${id} ${oldStatus} -> ${status}`);
      await fireHook("onStatusChanged", booking, oldStatus);

      return res.json(booking);
    } catch (error) {
      console.error("[Bookings] Failed to update booking status:", error.message);
      return res.status(500).json({ error: "Failed to update booking" });
    }
  }

  async function markAsPaid(id, stripeSessionId = null, stripePaymentId = null, amountPaid = null) {
    const existing = await prisma[modelName].findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Booking not found");
    }

    const oldStatus = existing.status;
    const paidAmount = amountPaid != null
      ? parseInt(amountPaid)
      : existing.totalAmount || existing.totalPaid || 0;

    const booking = await prisma[modelName].update({
      where: { id },
      data: {
        status: "PAID",
        totalPaid: paidAmount,
        ...(stripeSessionId ? { stripeSessionId } : {}),
        ...(stripePaymentId ? { stripePaymentId } : {}),
      },
    });

    console.log(`[Bookings] Marked as paid: ${booking.bookingNumber} (${paidAmount}p)`);
    if (oldStatus !== "PAID") {
      await fireHook("onStatusChanged", booking, oldStatus);
    }

    return booking;
  }

  async function checkPayment(req, res) {
    try {
      const { id } = req.params;
      const booking = await prisma[modelName].findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (!hooks.onCheckPayment) {
        console.log("[Bookings] Payment check rejected - onCheckPayment hook not configured");
        return res.status(501).json({ error: "Payment checking is not configured" });
      }

      console.log(`[Bookings] Checking payment for booking ${booking.bookingNumber}`);
      const result = await hooks.onCheckPayment(booking);

      if (!result || !result.paid) {
        return res.json({
          paid: false,
          message: result?.message || result?.reason || "Payment has not been received yet",
          paymentStatus: result?.paymentStatus || null,
        });
      }

      const updated = await markAsPaid(
        id,
        result.stripeSessionId || booking.stripeSessionId || null,
        result.stripePaymentId || booking.stripePaymentId || null,
        result.amountPaid ?? booking.totalAmount ?? booking.totalPaid
      );

      return res.json({
        paid: true,
        message: "Payment received",
        booking: updated,
        paymentStatus: result.paymentStatus || "paid",
      });
    } catch (error) {
      console.error("[Bookings] Failed to check payment:", error.message);
      return res.status(500).json({ error: "Failed to check payment" });
    }
  }

  async function sendInvoice(req, res) {
    try {
      const { id } = req.params;
      const { test } = req.body;

      const booking = await prisma[modelName].findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const amountPence = booking.quotedPrice || booking.totalAmount;
      if (!amountPence || amountPence <= 0) {
        return res.status(400).json({ error: "No amount set on booking. Set Total or Quoted price first." });
      }

      // Create an Invoice record with a single line item from the booking amount
      const lineItems = [{ name: `Booking ${booking.bookingNumber} - ${booking.groupSize} players`, unitPricePence: amountPence, quantity: 1 }];
      const invoice = await prisma[invoiceModelName].create({
        data: {
          bookingId: id,
          lineItems: JSON.stringify(lineItems),
          totalAmountPence: amountPence,
          description: `Quick invoice for ${booking.bookingNumber}`,
        },
      });
      console.log(`[Bookings] ${test ? "Test q" : "Q"}uick invoice ${invoice.id} created for booking ${booking.bookingNumber}`);

      if (!hooks.onSendInvoice) {
        return res.status(501).json({ error: "Invoice sending is not configured" });
      }

      const result = await hooks.onSendInvoice(booking, { test: !!test, lineItems, invoiceId: invoice.id });

      // Update invoice record with Stripe data (skip for test invoices)
      if (!test && result) {
        await prisma[invoiceModelName].update({
          where: { id: invoice.id },
          data: {
            stripeInvoiceId: result.stripeInvoiceId || null,
            invoiceNumber: result.invoiceNumber || null,
            hostedInvoiceUrl: result.hostedInvoiceUrl || null,
            status: "SENT",
            sentAt: new Date(),
          },
        });
        console.log(`[Bookings] Quick invoice updated with Stripe data: ${result.invoiceNumber}`);

        // Update booking status to INVOICE_SENT if currently ENQUIRY
        if (booking.status === "ENQUIRY") {
          await prisma[modelName].update({
            where: { id },
            data: { status: "INVOICE_SENT" },
          });
        }
      }

      return res.json({ message: `${test ? "Test invoice" : "Invoice"} sent`, bookingId: id, invoiceId: invoice.id });
    } catch (error) {
      console.error("[Bookings] Failed to send quick invoice:", error.message);
      return res.status(500).json({ error: error.message || "Failed to send invoice" });
    }
  }

  async function resendConfirmation(req, res) {
    try {
      const { id } = req.params;
      const { test } = req.body;

      const booking = await prisma[modelName].findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      console.log(`[Bookings] ${test ? "Test c" : "C"}onfirmation email triggered for booking ${booking.bookingNumber}`);
      await fireHook("onResendConfirmation", booking, { test: !!test });

      return res.json({ message: `${test ? "Test confirmation" : "Confirmation"} email triggered`, bookingId: id });
    } catch (error) {
      console.error("[Bookings] Failed to trigger confirmation email:", error.message);
      return res.status(500).json({ error: "Failed to send confirmation email" });
    }
  }

  async function dashboard(req, res) {
    try {
      console.log("[Bookings] Fetching dashboard stats");

      const statusCounts = {};
      for (const status of BOOKING_STATUSES) {
        statusCounts[status] = await prisma[modelName].count({ where: { status } });
      }

      const recentBookings = await prisma[modelName].findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      return res.json({
        stats: statusCounts,
        recentBookings,
      });
    } catch (error) {
      console.error("[Bookings] Failed to fetch dashboard:", error.message);
      return res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  }

  // ── Customer admin endpoints ────────────────────────────────────────────────

  async function listCustomers(req, res) {
    try {
      const { search } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const skip = (page - 1) * limit;

      const where = {};
      if (search) {
        where.OR = [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { email: { contains: search } },
          { company: { contains: search } },
        ];
      }

      const [customers, total] = await Promise.all([
        prisma[customerModelName].findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma[customerModelName].count({ where }),
      ]);

      console.log(`[Bookings] Fetched ${customers.length} customers`);

      return res.json({
        data: customers,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      console.error("[Bookings] Failed to fetch customers:", error.message);
      return res.status(500).json({ error: "Failed to fetch customers" });
    }
  }

  async function getCustomerById(req, res) {
    try {
      const { id } = req.params;
      const customer = await prisma[customerModelName].findUnique({ where: { id } });

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      console.log(`[Bookings] Fetched customer: ${customer.firstName} ${customer.lastName}`);
      return res.json(customer);
    } catch (error) {
      console.error("[Bookings] Failed to fetch customer:", error.message);
      return res.status(500).json({ error: "Failed to fetch customer" });
    }
  }

  async function createCustomer(req, res) {
    try {
      const { firstName, lastName, email, phone, company, source, notes } = req.body;

      if (!firstName || !lastName || !email) {
        console.log("[Bookings] Customer validation failed - missing required fields");
        return res.status(400).json({ error: "firstName, lastName, and email are required" });
      }

      console.log(`[Bookings] Creating customer: ${firstName} ${lastName} (${email})`);

      const customer = await prisma[customerModelName].create({
        data: {
          firstName,
          lastName,
          email,
          phone: phone || null,
          company: company || null,
          source: source || null,
          notes: notes || null,
        },
      });

      console.log(`[Bookings] Created customer: ${customer.id}`);
      return res.status(201).json(customer);
    } catch (error) {
      if (error.code === "P2002") {
        console.log(`[Bookings] Duplicate customer email: ${req.body.email}`);
        return res.status(409).json({ error: "A customer with this email already exists" });
      }
      console.error("[Bookings] Failed to create customer:", error.message);
      return res.status(500).json({ error: "Failed to create customer" });
    }
  }

  async function deleteBooking(req, res) {
    try {
      const { id } = req.params;
      const existing = await prisma[modelName].findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Release calendar slot if linked
      if (existing.calendarEventId) {
        try {
          await prisma.calendarEvent.delete({ where: { id: existing.calendarEventId } });
          console.log(`[Bookings] Deleted calendar event ${existing.calendarEventId}`);
        } catch (calErr) {
          console.warn(`[Bookings] Could not delete calendar event ${existing.calendarEventId}:`, calErr.message);
        }
      }

      await prisma[modelName].delete({ where: { id } });
      console.log(`[Bookings] Deleted booking ${existing.bookingNumber}`);
      return res.json({ success: true, bookingNumber: existing.bookingNumber });
    } catch (error) {
      console.error("[Bookings] Failed to delete booking:", error.message);
      return res.status(500).json({ error: "Failed to delete booking" });
    }
  }

  // ── Push to Game Builder Sheet ───────────────────────────────────────────────

  async function pushToSheet(req, res) {
    try {
      const { id } = req.params;
      const booking = await prisma[modelName].findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Look up product name if productId is set
      let productName = "";
      if (booking.productId) {
        try {
          const product = await prisma.product.findUnique({
            where: { id: booking.productId },
          });
          if (product) {
            productName = product.name;
            console.log(`[Bookings] Resolved product: ${productName}`);
          }
        } catch (prodErr) {
          console.error("[Bookings] Could not look up product:", prodErr.message);
        }
      }

      console.log(`[Bookings] Pushing booking ${booking.bookingNumber} to Game Builder sheet`);
      const result = await pushBookingToSheet(booking, productName);

      return res.json({
        success: true,
        message: `Booking ${booking.bookingNumber} pushed to Game Builder`,
        updatedRange: result.updatedRange,
      });
    } catch (error) {
      console.error("[Bookings] Failed to push booking to sheet:", error.message);
      return res.status(500).json({ error: "Failed to push booking to Game Builder sheet" });
    }
  }

  // ── Invoice endpoints ──────────────────────────────────────────────────────

  async function createInvoice(req, res) {
    try {
      const { id } = req.params;
      const { lineItems, description } = req.body;

      const booking = await prisma[modelName].findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (!Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({ error: "At least one line item is required" });
      }

      for (const item of lineItems) {
        if (!item.name || !item.unitPricePence || item.unitPricePence <= 0 || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({ error: "Each line item needs a name, unitPricePence > 0, and quantity > 0" });
        }
      }

      const totalAmountPence = lineItems.reduce((sum, item) => sum + (item.unitPricePence * item.quantity), 0);

      const invoice = await prisma[invoiceModelName].create({
        data: {
          bookingId: id,
          lineItems: JSON.stringify(lineItems),
          totalAmountPence,
          description: description || null,
        },
      });

      console.log(`[Bookings] Created draft invoice ${invoice.id} for booking ${booking.bookingNumber} - total: ${totalAmountPence}p`);
      return res.status(201).json({ ...invoice, lineItems: JSON.parse(invoice.lineItems) });
    } catch (error) {
      console.error("[Bookings] Failed to create invoice:", error.message);
      return res.status(500).json({ error: "Failed to create invoice" });
    }
  }

  async function listInvoices(req, res) {
    try {
      const { id } = req.params;
      const booking = await prisma[modelName].findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const invoices = await prisma[invoiceModelName].findMany({
        where: { bookingId: id },
        orderBy: { createdAt: "desc" },
      });

      const parsed = invoices.map((inv) => ({
        ...inv,
        lineItems: JSON.parse(inv.lineItems || "[]"),
      }));

      console.log(`[Bookings] Fetched ${parsed.length} invoices for booking ${booking.bookingNumber}`);
      return res.json({ data: parsed });
    } catch (error) {
      console.error("[Bookings] Failed to list invoices:", error.message);
      return res.status(500).json({ error: "Failed to list invoices" });
    }
  }

  async function sendInvoiceById(req, res) {
    try {
      const { id, invoiceId } = req.params;
      const { test } = req.body;

      const booking = await prisma[modelName].findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const invoice = await prisma[invoiceModelName].findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.bookingId !== id) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      if (!["DRAFT", "SENT"].includes(invoice.status)) {
        return res.status(400).json({ error: `Cannot send invoice with status ${invoice.status}` });
      }

      const parsedItems = JSON.parse(invoice.lineItems || "[]");

      console.log(`[Bookings] ${test ? "Test s" : "S"}ending invoice ${invoiceId} for booking ${booking.bookingNumber}`);

      if (!hooks.onSendInvoice) {
        return res.status(501).json({ error: "Invoice sending is not configured" });
      }

      const result = await hooks.onSendInvoice(booking, {
        test: !!test,
        lineItems: parsedItems,
        invoiceId,
      });

      // Update invoice record with Stripe data (skip for test invoices)
      if (!test && result) {
        await prisma[invoiceModelName].update({
          where: { id: invoiceId },
          data: {
            stripeInvoiceId: result.stripeInvoiceId || null,
            invoiceNumber: result.invoiceNumber || null,
            hostedInvoiceUrl: result.hostedInvoiceUrl || null,
            status: "SENT",
            sentAt: new Date(),
          },
        });
        console.log(`[Bookings] Invoice ${invoiceId} updated with Stripe data: ${result.invoiceNumber}`);

        // Update booking status to INVOICE_SENT if this is the first invoice
        if (booking.status === "ENQUIRY") {
          await prisma[modelName].update({
            where: { id },
            data: { status: "INVOICE_SENT" },
          });
          console.log(`[Bookings] Booking ${booking.bookingNumber} status updated to INVOICE_SENT`);
        }
      }

      return res.json({
        message: `${test ? "Test invoice" : "Invoice"} sent`,
        invoiceId,
        invoiceNumber: result?.invoiceNumber || null,
      });
    } catch (error) {
      console.error("[Bookings] Failed to send invoice:", error.message);
      return res.status(500).json({ error: error.message || "Failed to send invoice" });
    }
  }

  async function checkInvoicePayment(req, res) {
    try {
      const { id, invoiceId } = req.params;

      const booking = await prisma[modelName].findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const invoice = await prisma[invoiceModelName].findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.bookingId !== id) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      if (!invoice.invoiceNumber) {
        return res.json({ paid: false, message: "Invoice has not been sent to Stripe yet." });
      }

      if (!hooks.onCheckInvoicePayment) {
        return res.status(501).json({ error: "Invoice payment checking is not configured" });
      }

      console.log(`[Bookings] Checking payment for invoice ${invoice.invoiceNumber} on booking ${booking.bookingNumber}`);
      const result = await hooks.onCheckInvoicePayment(booking, invoice);

      if (!result || !result.paid) {
        return res.json({
          paid: false,
          message: result?.message || result?.reason || "Invoice payment not received yet",
          paymentStatus: result?.paymentStatus || null,
        });
      }

      // Mark invoice as paid
      await prisma[invoiceModelName].update({
        where: { id: invoiceId },
        data: { status: "PAID", paidAt: new Date() },
      });
      console.log(`[Bookings] Invoice ${invoice.invoiceNumber} marked as paid`);

      // Mark booking as paid if all SENT invoices are now PAID
      const unpaid = await prisma[invoiceModelName].count({
        where: { bookingId: id, status: "SENT" },
      });
      if (unpaid === 0 && booking.status !== "PAID") {
        const updated = await markAsPaid(
          id,
          null,
          result.stripePaymentId || null,
          result.amountPaid ?? invoice.totalAmountPence
        );
        return res.json({
          paid: true,
          message: "Invoice paid. Booking marked as paid.",
          booking: updated,
          invoiceNumber: invoice.invoiceNumber,
        });
      }

      return res.json({
        paid: true,
        message: "Invoice payment received",
        invoiceNumber: invoice.invoiceNumber,
      });
    } catch (error) {
      console.error("[Bookings] Failed to check invoice payment:", error.message);
      return res.status(500).json({ error: "Failed to check invoice payment" });
    }
  }

  async function resendInvoiceConfirmation(req, res) {
    try {
      const { id, invoiceId } = req.params;
      const { test } = req.body;

      const booking = await prisma[modelName].findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const invoice = await prisma[invoiceModelName].findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.bookingId !== id) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      if (invoice.status !== "PAID") {
        return res.status(400).json({ error: "Can only resend confirmation for paid invoices" });
      }

      console.log(`[Bookings] ${test ? "Test r" : "R"}esend confirmation for invoice ${invoice.invoiceNumber} on booking ${booking.bookingNumber}`);
      await fireHook("onResendConfirmation", booking, { test: !!test });

      return res.json({ message: `${test ? "Test confirmation" : "Confirmation"} sent`, invoiceId });
    } catch (error) {
      console.error("[Bookings] Failed to resend invoice confirmation:", error.message);
      return res.status(500).json({ error: "Failed to resend confirmation" });
    }
  }

  async function deleteInvoice(req, res) {
    try {
      const { id, invoiceId } = req.params;

      const invoice = await prisma[invoiceModelName].findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.bookingId !== id) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      if (invoice.status !== "DRAFT") {
        return res.status(400).json({ error: "Only draft invoices can be deleted" });
      }

      await prisma[invoiceModelName].delete({ where: { id: invoiceId } });
      console.log(`[Bookings] Deleted draft invoice ${invoiceId}`);
      return res.json({ success: true });
    } catch (error) {
      console.error("[Bookings] Failed to delete invoice:", error.message);
      return res.status(500).json({ error: "Failed to delete invoice" });
    }
  }

  return {
    // Public
    create,
    list,
    getById,

    // Admin - bookings
    adminList,
    updateBooking,
    updateStatus,
    markAsPaid,
    checkPayment,
    deleteBooking,
    sendInvoice,
    resendConfirmation,
    pushToSheet,
    dashboard,

    // Admin - invoices
    createInvoice,
    listInvoices,
    sendInvoiceById,
    checkInvoicePayment,
    resendInvoiceConfirmation,
    deleteInvoice,

    // Admin - customers
    listCustomers,
    getCustomerById,
    createCustomer,
  };
}

module.exports = { createBookingController };
