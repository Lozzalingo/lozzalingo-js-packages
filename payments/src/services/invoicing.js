/**
 * Invoicing Service
 *
 * TODO: Invoice creation via centralised Payments service not yet implemented.
 * The payments service needs an /api/payments/invoice endpoint.
 * These functions currently log a warning and throw so callers know
 * invoicing is not yet wired through the centralised service.
 *
 * Once the payments service supports invoicing, these functions will
 * be updated to use PaymentsClient.
 */

/**
 * Find or create a customer via the payments service.
 * TODO: Wire through centralised payments service when invoice API is ready.
 */
async function findOrCreateStripeCustomer(_stripe, { email, name, phone, company, productName }) {
  // TODO: Implement via centralised payments service
  console.error("[Payments] findOrCreateStripeCustomer not yet available via centralised service");
  throw new Error("Invoice customer management not yet available via centralised payments service");
}

/**
 * Create invoice items.
 * TODO: Wire through centralised payments service when invoice API is ready.
 */
async function createInvoiceItems(_stripe, customerId, lineItems, discountPence) {
  // TODO: Implement via centralised payments service
  console.error("[Payments] createInvoiceItems not yet available via centralised service");
  throw new Error("Invoice item creation not yet available via centralised payments service");
}

/**
 * Create and finalise an invoice.
 * TODO: Wire through centralised payments service when invoice API is ready.
 */
async function createAndFinaliseInvoice(_stripe, params) {
  // TODO: Implement via centralised payments service
  console.error("[Payments] createAndFinaliseInvoice not yet available via centralised service");
  throw new Error("Invoice creation not yet available via centralised payments service");
}

/**
 * Complete invoice flow.
 * TODO: Wire through centralised payments service when invoice API is ready.
 */
async function createFullInvoice(_stripe, params) {
  // TODO: Implement via centralised payments service
  console.error("[Payments] createFullInvoice not yet available via centralised service");
  throw new Error("Invoice creation not yet available via centralised payments service");
}

module.exports = {
  findOrCreateStripeCustomer,
  createInvoiceItems,
  createAndFinaliseInvoice,
  createFullInvoice,
};
