/**
 * @lozzalingo/ticker - Server Routes
 *
 * GET /api/recent-sales
 *
 * Returns the 5 most recent paid/completed sales in a standard format.
 * Protected by X-Ticker-Key header matching TICKER_API_KEY env var.
 * Filters out test purchases from known internal emails.
 *
 * Usage:
 *   // Option A: Custom query function (full control)
 *   const { createTickerRoutes } = require("@lozzalingo/ticker/server");
 *   app.use("/api/recent-sales", createTickerRoutes({
 *     brandName: "Fat Big Quiz",
 *     siteUrl: "https://fatbigquiz.com",
 *     querySales: async (prisma) => { ... },
 *   }));
 *
 *   // Option B: Use a built-in adapter for common Prisma models
 *   app.use("/api/recent-sales", createTickerRoutes({
 *     brandName: "BucketRace",
 *     siteUrl: "https://bucketrace.com",
 *     adapter: "orders",   // "orders" | "bookings" | "purchases"
 *     prisma,
 *   }));
 */

const express = require("express");

// Internal/test emails to exclude from ticker results
const TEST_EMAILS = [
  "laurencestephan@hotmail.com",
  "laurencedotcomputer@gmail.com",
];

/**
 * Validate the X-Ticker-Key header against TICKER_API_KEY env var.
 */
function tickerAuth(req, res, next) {
  const apiKey = process.env.TICKER_API_KEY;
  if (!apiKey) {
    console.error("[Ticker] TICKER_API_KEY env var not set");
    return res.status(500).json({ error: "Ticker not configured" });
  }

  const provided = req.headers["x-ticker-key"];
  if (!provided || provided !== apiKey) {
    console.warn("[Ticker] Unauthorised request, missing or invalid X-Ticker-Key");
    return res.status(401).json({ error: "Unauthorised" });
  }

  next();
}

/**
 * Filter out test emails from sales results.
 */
function filterTestSales(sales) {
  return sales.filter((sale) => {
    const email = (sale._email || "").toLowerCase();
    return !TEST_EMAILS.includes(email);
  });
}

/**
 * Format a date to YYYY-MM-DD.
 */
function formatDate(date) {
  if (!date) return new Date().toISOString().split("T")[0];
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

// ── Built-in Adapters ────────────────────────────────────────────────────────

/**
 * Orders adapter - queries the standard Order + OrderItem models.
 * Works for AIB, FBQ, and any app using @lozzalingo/orders schema.
 */
async function queryOrders(prisma, brandName, siteUrl) {
  console.log("[Ticker] Querying orders for", brandName);
  try {
    const orders = await prisma.order.findMany({
      where: { status: "paid" },
      orderBy: { createdAt: "desc" },
      take: 10, // fetch extra to allow for test email filtering
      include: { items: true },
    });

    return orders.map((order) => {
      const itemNames = order.items.map((i) => i.productName).join(", ");
      const title = itemNames
        ? `${brandName} - ${itemNames}`
        : `${brandName} - Order ${order.orderNumber}`;

      return {
        title,
        url: siteUrl,
        date: formatDate(order.createdAt),
        type: "purchase",
        _email: order.customerEmail,
      };
    });
  } catch (err) {
    console.error("[Ticker] Error querying orders:", err);
    return [];
  }
}

/**
 * Bookings adapter - queries Booking model with PAID or COMPLETED status.
 * Works for BucketRace, Kalluna, and any app using @lozzalingo/bookings schema.
 */
async function queryBookings(prisma, brandName, siteUrl) {
  console.log("[Ticker] Querying bookings for", brandName);
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ["PAID", "DEPOSIT_PAID", "COMPLETED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return bookings.map((booking) => {
      const description = booking.eventName || booking.packageName || booking.notes || "";
      const title = description
        ? `${brandName} - ${description}`
        : `${brandName} - Booking`;

      return {
        title,
        url: siteUrl,
        date: formatDate(booking.createdAt),
        type: "purchase",
        _email: booking.email || booking.customerEmail || "",
      };
    });
  } catch (err) {
    console.error("[Ticker] Error querying bookings:", err);
    return [];
  }
}

/**
 * Purchases adapter - queries the Purchase model (digital products).
 * Works for FBQ and any app using @lozzalingo/purchases schema.
 */
async function queryPurchases(prisma, brandName, siteUrl) {
  console.log("[Ticker] Querying purchases for", brandName);
  try {
    const purchases = await prisma.purchase.findMany({
      where: { status: "completed" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { product: true },
    });

    return purchases.map((purchase) => {
      const productName = purchase.product?.name || "Digital Product";
      return {
        title: `${brandName} - ${productName}`,
        url: siteUrl,
        date: formatDate(purchase.createdAt),
        type: "purchase",
        _email: purchase.email || "",
      };
    });
  } catch (err) {
    console.error("[Ticker] Error querying purchases:", err);
    return [];
  }
}

/**
 * Subscriptions adapter - queries users with active Stripe subscriptions.
 * Works for AIB and any app tracking subscriptions on the User model.
 */
async function querySubscriptions(prisma, brandName, siteUrl) {
  console.log("[Ticker] Querying subscriptions for", brandName);
  try {
    const users = await prisma.user.findMany({
      where: {
        subscriptionStatus: "active",
        stripeSubscriptionId: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    return users.map((user) => ({
      title: `${brandName} - Subscription`,
      url: siteUrl,
      date: formatDate(user.updatedAt),
      type: "subscription",
      _email: user.email || "",
    }));
  } catch (err) {
    console.error("[Ticker] Error querying subscriptions:", err);
    return [];
  }
}

const ADAPTERS = {
  orders: queryOrders,
  bookings: queryBookings,
  purchases: queryPurchases,
  subscriptions: querySubscriptions,
};

// ── Route Factory ────────────────────────────────────────────────────────────

/**
 * Create the ticker route handler.
 *
 * @param {object} options
 * @param {string} options.brandName - Brand name shown in ticker (e.g. "BucketRace")
 * @param {string} options.siteUrl - Public URL of the app (e.g. "https://bucketrace.com")
 * @param {Function} [options.querySales] - Custom async function: (prisma) => Sale[]
 *   Each Sale must have: { title, url, date, type, _email }
 *   _email is used for test filtering and stripped from the response.
 * @param {string|string[]} [options.adapter] - Built-in adapter name(s): "orders" | "bookings" | "purchases" | "subscriptions"
 * @param {import('@prisma/client').PrismaClient} [options.prisma] - Required when using adapter
 * @param {number} [options.limit=5] - Max number of results to return
 * @returns {express.Router}
 */
function createTickerRoutes(options = {}) {
  const {
    brandName = "Unknown",
    siteUrl = "https://example.com",
    querySales,
    adapter,
    prisma,
    limit = 5,
  } = options;

  const router = express.Router();

  router.get("/", tickerAuth, async (req, res) => {
    try {
      console.log("[Ticker] Request received for", brandName);
      let allSales = [];

      if (querySales) {
        // Custom query function
        const results = await querySales(prisma);
        allSales = results.map((sale) => ({
          title: sale.title || `${brandName} - Sale`,
          url: sale.url || siteUrl,
          date: formatDate(sale.date),
          type: sale.type || "purchase",
          _email: sale._email || sale.email || "",
        }));
      } else if (adapter) {
        // Built-in adapter(s)
        const adapterNames = Array.isArray(adapter) ? adapter : [adapter];

        for (const name of adapterNames) {
          const queryFn = ADAPTERS[name];
          if (!queryFn) {
            console.warn("[Ticker] Unknown adapter:", name);
            continue;
          }
          if (!prisma) {
            console.error("[Ticker] Prisma client required for adapter:", name);
            continue;
          }
          const results = await queryFn(prisma, brandName, siteUrl);
          allSales.push(...results);
        }

        // Sort combined results by date descending
        allSales.sort((a, b) => new Date(b.date) - new Date(a.date));
      } else {
        console.warn("[Ticker] No querySales function or adapter provided");
        return res.json({ sales: [] });
      }

      // Filter out test emails
      const filtered = filterTestSales(allSales);

      // Take the requested limit and strip internal _email field
      const sales = filtered.slice(0, limit).map(({ _email, ...sale }) => sale);

      console.log("[Ticker] Returning", sales.length, "sales for", brandName);
      return res.json({ sales });
    } catch (err) {
      console.error("[Ticker] Error processing request:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

module.exports = { createTickerRoutes, tickerAuth, ADAPTERS };
