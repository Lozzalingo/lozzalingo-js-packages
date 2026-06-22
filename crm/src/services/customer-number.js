/**
 * Customer Number Generation
 *
 * Generates human-readable customer reference numbers like #BR0001, #FBQ0001.
 * The prefix comes from lozzalingo.yaml crm.customerPrefix config.
 */

/**
 * Generate a customer number from a prefix and sequence number.
 * @param {string} prefix - Brand prefix, e.g. "BR", "FBQ"
 * @param {number} sequenceNumber - Sequential number
 * @returns {string} Customer number, e.g. "#BR0001"
 */
function generateCustomerNumber(prefix, sequenceNumber) {
  return `#${prefix}${String(sequenceNumber).padStart(4, "0")}`;
}

/**
 * Get the next available customer number for a given prefix.
 * @param {object} prisma - Prisma client
 * @param {string} prefix - Brand prefix, e.g. "BR", "FBQ"
 * @returns {Promise<string>} Next customer number
 */
async function getNextCustomerNumber(prisma, prefix) {
  const pattern = `#${prefix}`;

  // Find the highest existing customer number with this prefix
  const latest = await prisma.customer.findFirst({
    where: { customerNumber: { startsWith: pattern } },
    orderBy: { customerNumber: "desc" },
    select: { customerNumber: true },
  });

  if (!latest) {
    return generateCustomerNumber(prefix, 1);
  }

  // Extract the numeric portion and increment
  const numStr = latest.customerNumber.replace(pattern, "");
  const num = parseInt(numStr, 10);

  if (isNaN(num)) {
    console.error("[CRM] Could not parse customer number:", latest.customerNumber);
    return generateCustomerNumber(prefix, 1);
  }

  return generateCustomerNumber(prefix, num + 1);
}

module.exports = { generateCustomerNumber, getNextCustomerNumber };
