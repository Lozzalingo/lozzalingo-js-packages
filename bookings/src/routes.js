const express = require("express");
const { createBookingController } = require("./controller");

function createBookingRoutes(prisma, options = {}) {
  const router = express.Router();
  const { authMiddleware } = options;
  const controller = createBookingController(prisma, options);

  // Auth guard - falls back to no-op if not provided
  const adminGuard = authMiddleware || ((req, res, next) => next());

  // Public routes
  router.post("/bookings", controller.create);
  router.get("/bookings", controller.list);
  router.get("/bookings/:id", controller.getById);

  // Admin - bookings
  router.get("/admin/bookings", adminGuard, controller.adminList);
  router.put("/admin/bookings/:id", adminGuard, controller.updateBooking);
  router.put("/admin/bookings/:id/status", adminGuard, controller.updateStatus);
  router.post("/admin/bookings/:id/check-payment", adminGuard, controller.checkPayment);
  router.delete("/admin/bookings/:id", adminGuard, controller.deleteBooking);
  router.post("/admin/bookings/:id/send-invoice", adminGuard, controller.sendInvoice);
  router.post("/admin/bookings/:id/resend-confirmation", adminGuard, controller.resendConfirmation);
  router.post("/admin/bookings/:id/push-to-sheet", adminGuard, controller.pushToSheet);

  // Admin - invoices
  router.get("/admin/bookings/:id/invoices", adminGuard, controller.listInvoices);
  router.post("/admin/bookings/:id/invoices", adminGuard, controller.createInvoice);
  router.post("/admin/bookings/:id/invoices/:invoiceId/send", adminGuard, controller.sendInvoiceById);
  router.post("/admin/bookings/:id/invoices/:invoiceId/check-payment", adminGuard, controller.checkInvoicePayment);
  router.post("/admin/bookings/:id/invoices/:invoiceId/resend-confirmation", adminGuard, controller.resendInvoiceConfirmation);
  router.delete("/admin/bookings/:id/invoices/:invoiceId", adminGuard, controller.deleteInvoice);

  // Admin - customers
  router.get("/admin/customers", adminGuard, controller.listCustomers);
  router.get("/admin/customers/:id", adminGuard, controller.getCustomerById);
  router.post("/admin/customers", adminGuard, controller.createCustomer);

  // Admin - dashboard
  router.get("/admin/dashboard", adminGuard, controller.dashboard);

  return router;
}

module.exports = { createBookingRoutes };
