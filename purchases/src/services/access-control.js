/**
 * Check if a user has active access to a product.
 * Checks: accessGranted=true AND (accessExpiresAt is null OR accessExpiresAt > now)
 * @param {object} prisma
 * @param {string} modelName
 * @param {string} email
 * @param {string} productId
 * @returns {Promise<{ hasAccess: boolean, purchase?: object }>}
 */
async function checkAccess(prisma, modelName, email, productId) {
  try {
    const purchase = await prisma[modelName].findFirst({
      where: {
        email,
        productId,
        productType: "SUBSCRIPTION",
        accessGranted: true,
      },
    });

    if (!purchase) {
      return { hasAccess: false };
    }

    // Check if access has expired
    if (purchase.accessExpiresAt && new Date(purchase.accessExpiresAt) < new Date()) {
      return { hasAccess: false, purchase };
    }

    return { hasAccess: true, purchase };
  } catch (error) {
    console.error("[Purchases] Failed to check access:", error.message);
    return { hasAccess: false };
  }
}

/**
 * Express middleware factory: require active access to a product.
 * Looks up user email from req.user.email (assumes auth middleware upstream).
 * @param {object} prisma
 * @param {string} productId
 * @param {string} modelName
 * @returns {Function} Express middleware
 */
function requireAccess(prisma, productId, modelName = "purchase") {
  return async (req, res, next) => {
    try {
      const email = req.user && req.user.email;

      if (!email) {
        console.log("[Purchases] Access denied, no user email found on request");
        return res.status(403).json({ error: "Access denied" });
      }

      const { hasAccess } = await checkAccess(prisma, modelName, email, productId);

      if (!hasAccess) {
        console.log("[Purchases] Access denied for", email, "to product", productId);
        return res.status(403).json({ error: "Access denied" });
      }

      console.log("[Purchases] Access granted for", email, "to product", productId);
      return next();
    } catch (error) {
      console.error("[Purchases] Access check middleware failed:", error.message);
      return res.status(500).json({ error: "Failed to verify access" });
    }
  };
}

module.exports = { checkAccess, requireAccess };
