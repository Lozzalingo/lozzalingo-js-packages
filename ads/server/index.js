/**
 * @lozzalingo/ads - Server Routes
 *
 * GET /embed - public, CORS-enabled endpoint returning randomised products
 *              for cross-site ad embedding.
 *
 * Mirrors the Python framework's merchandise_public module.
 *
 * Usage:
 *   const { createAdsRoutes } = require("@lozzalingo/ads/server");
 *   app.use("/api/products", createAdsRoutes(prisma, {
 *     shopName: "Fat Big Quiz",
 *     baseUrl: "https://fatbigquiz.com",
 *   }));
 */

const express = require("express");

/**
 * Safely parse a JSON string, returning fallback on failure.
 */
function safeParseJson(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Format price in pence to display string.
 */
function formatPriceDisplay(pricePence) {
  if (!pricePence && pricePence !== 0) return "Free";
  const pounds = (pricePence / 100).toFixed(2);
  return `\u00A3${pounds}`;
}

/**
 * Shuffle an array in place (Fisher-Yates).
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Create the ads routes.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} options
 * @param {string} [options.modelName="merchProduct"] - Prisma model name for products
 * @param {string} [options.shopName] - Brand name shown in product cards
 * @param {string} [options.baseUrl] - Public URL of this site
 * @param {string} [options.productUrlPattern="/shop/{id}"] - URL pattern for product links
 * @returns {express.Router}
 */
function createAdsRoutes(prisma, options = {}) {
  const {
    modelName = "merchProduct",
    shopName = "Shop",
    baseUrl = "http://localhost:3000",
    productUrlPattern = "/shop/{id}",
  } = options;

  const router = express.Router();

  /**
   * GET /embed
   *
   * Public endpoint returning randomised in-stock products for cross-site embedding.
   * No auth required. Accepts ?limit=N (default 6, max 20).
   */
  router.get("/embed", async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 6, 1), 20);
      console.log("[Ads] Embed request for", shopName, "limit:", limit);

      // Check if the model exists
      if (!prisma[modelName]) {
        console.warn("[Ads] Model", modelName, "not found in Prisma client");
        return res.json({ success: true, products: [], count: 0 });
      }

      // Query active products that are in stock, preorder, or limited edition
      let products;
      try {
        products = await prisma[modelName].findMany({
          where: {
            isActive: true,
            OR: [
              { stockQuantity: { gt: 0 } },
              { isPreorder: true },
              { limitedEdition: true },
            ],
          },
          orderBy: { sortOrder: "asc" },
          take: 50, // fetch more than needed, then shuffle and slice
        });
      } catch (queryErr) {
        // Some schemas may not have all optional fields (limitedEdition, isPreorder)
        // Fall back to simpler query
        console.warn("[Ads] Extended query failed, trying simple query:", queryErr.message);
        products = await prisma[modelName].findMany({
          where: { isActive: true },
          take: 50,
        });
      }

      // Shuffle and take the requested limit
      shuffle(products);
      const selected = products.slice(0, limit);

      // Format for the embed response
      const formatted = selected.map((product) => {
        const imageUrls = safeParseJson(product.imageUrls, []);
        const firstImage = imageUrls.length > 0 ? imageUrls[0] : null;

        // Build absolute product URL
        const productUrl = baseUrl.replace(/\/$/, "") + productUrlPattern
          .replace("{id}", product.id)
          .replace("{slug}", product.slug || product.id);

        return {
          id: product.id,
          name: product.name,
          description: product.description || "",
          price_display: formatPriceDisplay(product.price),
          price_pence: product.price || 0,
          image_url: firstImage || "",
          product_url: productUrl,
          limited_edition: product.limitedEdition || false,
          is_preorder: product.isPreorder || false,
          category: product.category || null,
          shop_name: shopName,
        };
      });

      console.log("[Ads] Returning", formatted.length, "products for", shopName);
      return res.json({
        success: true,
        products: formatted,
        count: formatted.length,
      });
    } catch (err) {
      console.error("[Ads] Error processing embed request:", err);
      return res.json({ success: true, products: [], count: 0 });
    }
  });

  return router;
}

module.exports = { createAdsRoutes };
