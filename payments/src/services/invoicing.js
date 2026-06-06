/**
 * Stripe Invoicing Service
 *
 * Creates proper Stripe invoices with line items, finalises them,
 * and returns the hosted invoice URL for payment.
 *
 * Stripe Invoice API integration
 * (not checkout sessions) for send_invoice collection method.
 */

/**
 * Finds an existing Stripe customer by email, or creates a new one.
 * @param {Stripe} stripe - Stripe instance
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.name
 * @param {string} params.phone
 * @param {string} params.company
 * @param {string} params.productName - Context for customer description
 * @returns {Promise<object>} Stripe customer object
 */
async function findOrCreateStripeCustomer(stripe, { email, name, phone, company, productName }) {
  console.log(`[Payments] Looking up Stripe customer: ${email}`);

  const existing = await stripe.customers.list({ email, limit: 1 });

  if (existing.data.length > 0) {
    const customer = existing.data[0];
    console.log(`[Payments] Found existing Stripe customer: ${customer.id}`);

    const description = `Customer for ${company || "N/A"} - ${productName || "Service"}`;
    const needsUpdate =
      customer.name !== name ||
      customer.phone !== (phone || null) ||
      !customer.description ||
      !customer.description.includes(company || "");

    if (needsUpdate) {
      console.log(`[Payments] Updating Stripe customer: ${customer.id}`);
      const updated = await stripe.customers.update(customer.id, {
        name,
        phone: phone || undefined,
        description,
      });
      return updated;
    }

    return customer;
  }

  console.log(`[Payments] Creating new Stripe customer for: ${email}`);
  const customer = await stripe.customers.create({
    name,
    email,
    phone: phone || undefined,
    description: `Customer for ${company || "N/A"} - ${productName || "Service"}`,
  });

  console.log(`[Payments] Stripe customer created: ${customer.id}`);
  return customer;
}

/**
 * Creates invoice items on a Stripe customer.
 * @param {Stripe} stripe - Stripe instance
 * @param {string} customerId - Stripe customer ID
 * @param {Array<{description: string, unitPricePence: number, quantity: number}>} lineItems
 * @param {number} discountPence - Discount in pence (applied as negative line item)
 * @returns {Promise<Array>} Created invoice items
 */
async function createInvoiceItems(stripe, customerId, lineItems, discountPence) {
  const created = [];

  for (const item of lineItems) {
    const unitPrice = Math.round(item.unitPricePence || 0);
    const quantity = parseInt(item.quantity) || 0;

    if (unitPrice <= 0 || quantity <= 0) {
      console.log(`[Payments] Skipping item - invalid price (${unitPrice}) or quantity (${quantity})`);
      continue;
    }

    const amountPence = unitPrice * quantity;
    const description = `${item.description || "Service"} - \u00a3${(unitPrice / 100).toFixed(2)} x ${quantity}`;

    console.log(`[Payments] Creating invoice item: ${description} = \u00a3${(amountPence / 100).toFixed(2)}`);

    const invoiceItem = await stripe.invoiceItems.create({
      customer: customerId,
      amount: amountPence,
      currency: "gbp",
      description,
    });

    created.push(invoiceItem);
  }

  if (discountPence && discountPence > 0) {
    console.log(`[Payments] Applying discount: -\u00a3${(discountPence / 100).toFixed(2)}`);

    const discountItem = await stripe.invoiceItems.create({
      customer: customerId,
      amount: -Math.abs(discountPence),
      currency: "gbp",
      description: "Discount",
    });

    created.push(discountItem);
  }

  if (created.length === 0) {
    throw new Error("No valid invoice items created. Cannot create empty invoice.");
  }

  console.log(`[Payments] Created ${created.length} invoice items`);
  return created;
}

/**
 * Creates a Stripe invoice for pending items, then finalises it.
 * @param {Stripe} stripe - Stripe instance
 * @param {object} params
 * @param {string} params.stripeCustomerId
 * @param {string} params.description
 * @param {number} params.daysUntilDue - Days until payment due (default: 1)
 * @param {object} params.metadata - Invoice metadata
 * @param {string} params.footer - Custom footer text (e.g. bank details)
 * @returns {Promise<object>} Finalised Stripe invoice
 */
async function createAndFinaliseInvoice(stripe, { stripeCustomerId, description, daysUntilDue = 1, metadata = {}, footer }) {
  console.log(`[Payments] Creating invoice for customer: ${stripeCustomerId}`);

  const invoiceParams = {
    customer: stripeCustomerId,
    description,
    collection_method: "send_invoice",
    days_until_due: daysUntilDue,
    auto_advance: false,
    metadata,
    pending_invoice_items_behavior: "include",
  };

  if (footer) {
    invoiceParams.footer = footer;
  }

  const invoice = await stripe.invoices.create(invoiceParams);

  console.log(`[Payments] Invoice created: ${invoice.id} - finalising...`);

  const finalised = await stripe.invoices.finalizeInvoice(invoice.id);

  console.log(`[Payments] Invoice finalised: ${finalised.number} - \u00a3${(finalised.amount_due / 100).toFixed(2)}`);
  console.log(`[Payments] Payment URL: ${finalised.hosted_invoice_url}`);

  return finalised;
}

/**
 * Complete invoice flow: find/create customer, add line items, create and finalise invoice.
 * @param {Stripe} stripe - Stripe instance
 * @param {object} params
 * @param {string} params.customerEmail
 * @param {string} params.customerName
 * @param {string} params.customerPhone
 * @param {string} params.companyName
 * @param {string} params.productName
 * @param {Array<{description: string, unitPricePence: number, quantity: number}>} params.lineItems
 * @param {number} params.discountPence
 * @param {number} params.daysUntilDue - Default 1
 * @param {object} params.metadata - Invoice metadata
 * @param {string} params.footer - Custom footer text
 * @returns {Promise<object>} Finalised Stripe invoice with hosted_invoice_url
 */
async function createFullInvoice(stripe, {
  customerEmail, customerName, customerPhone, companyName, productName,
  lineItems, discountPence, daysUntilDue = 1, metadata = {}, footer,
}) {
  try {
    console.log(`[Payments] Starting full invoice flow for ${customerEmail}`);

    const customer = await findOrCreateStripeCustomer(stripe, {
      email: customerEmail,
      name: customerName,
      phone: customerPhone,
      company: companyName,
      productName,
    });

    await createInvoiceItems(stripe, customer.id, lineItems, discountPence);

    const description = `${productName || "Service"} - ${companyName || customerName}`;
    const invoice = await createAndFinaliseInvoice(stripe, {
      stripeCustomerId: customer.id,
      description,
      daysUntilDue,
      metadata,
      footer,
    });

    console.log(`[Payments] Full invoice flow complete: ${invoice.number} - \u00a3${(invoice.amount_due / 100).toFixed(2)}`);

    return invoice;
  } catch (error) {
    console.error(`[Payments] Error creating invoice for ${customerEmail}:`, error.message);
    throw error;
  }
}

module.exports = {
  findOrCreateStripeCustomer,
  createInvoiceItems,
  createAndFinaliseInvoice,
  createFullInvoice,
};
