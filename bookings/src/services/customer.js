/**
 * Find or create a customer record by email.
 * If the customer exists, updates any changed fields (firstName, lastName, phone, company).
 * If not, creates a new customer.
 *
 * Find or create a customer by email.
 *
 * @param {object} prisma - Prisma client instance
 * @param {object} params
 * @param {string} params.firstName
 * @param {string} params.lastName
 * @param {string} params.email
 * @param {string|null} params.phone
 * @param {string|null} params.company
 * @param {string} params.source
 * @returns {Promise<object|null>} Customer record or null on error
 */
async function findOrCreateCustomer(prisma, { firstName, lastName, email, phone, company, source }) {
  try {
    let customer = await prisma.customer.findUnique({ where: { email } });

    if (customer) {
      const updates = {};
      if (firstName && firstName !== customer.firstName) updates.firstName = firstName;
      if (lastName && lastName !== customer.lastName) updates.lastName = lastName;
      if (phone && phone !== customer.phone) updates.phone = phone;
      if (company && company !== customer.company) updates.company = company;

      if (Object.keys(updates).length > 0) {
        customer = await prisma.customer.update({
          where: { email },
          data: updates,
        });
        console.log(`[Bookings] Updated existing customer: ${email}`);
      }
    } else {
      customer = await prisma.customer.create({
        data: {
          firstName,
          lastName,
          email,
          phone: phone || null,
          company: company || null,
          source: source || "website",
        },
      });
      console.log(`[Bookings] Created new customer: ${email}`);
    }

    return customer;
  } catch (error) {
    console.error("[Bookings] Failed in findOrCreateCustomer:", error.message);
    return null;
  }
}

module.exports = { findOrCreateCustomer };
