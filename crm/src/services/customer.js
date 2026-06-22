/**
 * CRM-aware Customer Service
 *
 * Extended version of @lozzalingo/bookings findOrCreateCustomer.
 * Handles fingerprint linking, customer numbers, and lastActivityAt tracking.
 */

const { getNextCustomerNumber } = require("./customer-number");

/**
 * Find or create a customer by email. CRM-aware version with extended fields.
 *
 * @param {object} prisma - Prisma client
 * @param {object} params
 * @param {string} params.firstName
 * @param {string} params.lastName
 * @param {string} params.email
 * @param {string|null} [params.phone]
 * @param {string|null} [params.company]
 * @param {string|null} [params.jobTitle]
 * @param {string|null} [params.country]
 * @param {string|null} [params.region]
 * @param {string|null} [params.fingerprint]
 * @param {string|null} [params.ipAddress]
 * @param {string} [params.source]
 * @param {string} params.customerPrefix - Brand prefix for customer number, e.g. "BR"
 * @returns {Promise<object|null>} Customer record or null on error
 */
async function findOrCreateCustomer(prisma, {
  firstName,
  lastName,
  email,
  phone,
  company,
  jobTitle,
  country,
  region,
  fingerprint,
  ipAddress,
  source,
  customerPrefix = "LZ",
}) {
  try {
    let customer = await prisma.customer.findUnique({ where: { email } });

    if (customer) {
      // Update sparse fields and always refresh lastActivityAt
      const updates = { lastActivityAt: new Date() };

      if (firstName && firstName !== customer.firstName) updates.firstName = firstName;
      if (lastName && lastName !== customer.lastName) updates.lastName = lastName;
      if (phone && !customer.phone) updates.phone = phone;
      if (company && !customer.company) updates.company = company;
      if (jobTitle && !customer.jobTitle) updates.jobTitle = jobTitle;
      if (country && !customer.country) updates.country = country;
      if (region && !customer.region) updates.region = region;
      if (fingerprint && !customer.fingerprint) updates.fingerprint = fingerprint;
      if (ipAddress && !customer.ipAddress) updates.ipAddress = ipAddress;

      customer = await prisma.customer.update({
        where: { email },
        data: updates,
      });

      console.log(`[CRM] Updated existing customer: ${email}`);
    } else {
      // Generate a customer number
      const customerNumber = await getNextCustomerNumber(prisma, customerPrefix);

      customer = await prisma.customer.create({
        data: {
          customerNumber,
          firstName: firstName || "Unknown",
          lastName: lastName || "",
          email,
          phone: phone || null,
          company: company || null,
          jobTitle: jobTitle || null,
          country: country || null,
          region: region || null,
          fingerprint: fingerprint || null,
          ipAddress: ipAddress || null,
          source: source || "website",
          lastActivityAt: new Date(),
        },
      });

      console.log(`[CRM] Created new customer: ${customerNumber} ${email}`);
    }

    return customer;
  } catch (error) {
    console.error("[CRM] Failed in findOrCreateCustomer:", error.message);
    return null;
  }
}

module.exports = { findOrCreateCustomer };
