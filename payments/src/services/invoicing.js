/**
 * Invoicing Service
 *
 * Handles invoice operations via the centralised Payments service.
 * All functions accept a deprecated first argument (_stripe) for
 * backwards compatibility - it is ignored.
 */

const { PaymentsClient } = require("@lozzalingo/payments/server/payments-client");

/**
 * Find or create a customer via the payments service.
 * @param {object} _stripe - DEPRECATED: ignored, kept for backwards compat
 * @param {object} params
 * @param {string} params.email
 * @param {string} [params.name]
 * @param {string} [params.phone]
 * @param {string} [params.company]
 * @param {string} [params.productName]
 * @returns {Promise<object>}
 */
async function findOrCreateStripeCustomer(_stripe, { email, name, phone, company, productName }) {
  console.log(`[Payments] Finding or creating customer: ${email}`);

  const payments = new PaymentsClient();

  // Try to find existing customer by email
  // The payments service does not have a search endpoint yet,
  // so we create a customer and let the service handle deduplication.
  const metadata = {};
  if (company) metadata.company = company;
  if (productName) metadata.product_name = productName;

  const result = await payments.createCustomer({ email, metadata });

  if (!result) {
    console.error("[Payments] Failed to create/find customer via payments service");
    throw new Error("Failed to create customer via centralised payments service");
  }

  console.log(`[Payments] Customer ready: ${result.customerId || result.customer_id}`);

  return {
    id: result.customerId || result.customer_id,
    email: result.email || email,
    name: name || "",
  };
}

/**
 * Create invoice items via the payments service.
 * @param {object} _stripe - DEPRECATED: ignored, kept for backwards compat
 * @param {string} customerId
 * @param {Array<{description: string, amount: number}>} lineItems
 * @param {number} [discountPence] - Discount amount in pence (applied as negative line item)
 * @returns {Promise<Array>}
 */
async function createInvoiceItems(_stripe, customerId, lineItems, discountPence) {
  console.log(`[Payments] Creating ${lineItems.length} invoice items for customer ${customerId}`);

  if (!lineItems || lineItems.length === 0) {
    throw new Error("At least one line item is required");
  }

  // The payments service does not yet have a dedicated invoice items endpoint.
  // For now, we collect items and pass them to createAndFinaliseInvoice.
  const items = lineItems
    .filter((item) => item.amount > 0)
    .map((item) => ({
      description: item.description,
      amount: item.amount,
    }));

  if (discountPence && discountPence > 0) {
    items.push({
      description: "Discount",
      amount: -discountPence,
    });
  }

  console.log(`[Payments] Prepared ${items.length} invoice items`);
  return items;
}

/**
 * Create and finalise an invoice via the payments service.
 * @param {object} _stripe - DEPRECATED: ignored, kept for backwards compat
 * @param {object} params
 * @param {string} params.stripeCustomerId - Customer ID
 * @param {string} [params.description]
 * @param {object} [params.metadata]
 * @param {string} [params.footer]
 * @returns {Promise<object>}
 */
async function createAndFinaliseInvoice(_stripe, params) {
  const { stripeCustomerId, description, metadata, footer } = params;

  console.log(`[Payments] Creating invoice for customer ${stripeCustomerId}`);

  // TODO: Wire through centralised payments service when /api/payments/invoice endpoint is ready.
  // The payments service needs a dedicated invoice creation endpoint.
  console.error("[Payments] createAndFinaliseInvoice not yet fully supported via centralised service");
  throw new Error("Invoice creation not yet available via centralised payments service");
}

/**
 * Complete invoice flow: find/create customer, add items, create and finalise invoice.
 * @param {object} _stripe - DEPRECATED: ignored, kept for backwards compat
 * @param {object} params
 * @param {string} params.customerEmail
 * @param {string} [params.customerName]
 * @param {string} [params.customerPhone]
 * @param {string} [params.companyName]
 * @param {string} [params.productName]
 * @param {Array<{description: string, amount: number}>} params.lineItems
 * @param {number} [params.discountPence]
 * @param {string} [params.description]
 * @param {object} [params.metadata]
 * @param {string} [params.footer]
 * @returns {Promise<object>}
 */
async function createFullInvoice(_stripe, params) {
  const {
    customerEmail,
    customerName,
    customerPhone,
    companyName,
    productName,
    lineItems,
    discountPence,
    description,
    metadata,
    footer,
  } = params;

  console.log(`[Payments] Full invoice flow for ${customerEmail}`);

  // Step 1: Find or create customer
  const customer = await findOrCreateStripeCustomer(null, {
    email: customerEmail,
    name: customerName,
    phone: customerPhone,
    company: companyName,
    productName,
  });

  // Step 2: Prepare invoice items
  const items = await createInvoiceItems(null, customer.id, lineItems, discountPence);

  // Step 3: Create and finalise the invoice
  // TODO: Wire through centralised payments service when /api/payments/invoice endpoint is ready.
  console.error("[Payments] createFullInvoice not yet fully supported via centralised service");
  throw new Error("Invoice creation not yet available via centralised payments service");
}

module.exports = {
  findOrCreateStripeCustomer,
  createInvoiceItems,
  createAndFinaliseInvoice,
  createFullInvoice,
};
