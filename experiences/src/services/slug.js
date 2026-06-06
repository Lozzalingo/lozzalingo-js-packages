/**
 * Slug generation and uniqueness utilities for experiences.
 */

/**
 * Generate URL-safe slug from title.
 * @param {string} title
 * @returns {string} slug
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Ensure slug is unique, appending -2, -3 etc if needed.
 * @param {object} prisma - Prisma client
 * @param {string} modelName - Prisma model name
 * @param {string} slug - Base slug
 * @param {string|null} excludeId - ID to exclude (for updates)
 * @returns {Promise<string>} unique slug
 */
async function ensureUniqueSlug(prisma, modelName, slug, excludeId = null) {
  let candidate = slug;
  let suffix = 1;

  while (true) {
    const where = { slug: candidate };
    if (excludeId) {
      where.NOT = { id: excludeId };
    }

    const existing = await prisma[modelName].findFirst({ where });
    if (!existing) {
      return candidate;
    }

    suffix += 1;
    candidate = `${slug}-${suffix}`;
  }
}

module.exports = { generateSlug, ensureUniqueSlug };
