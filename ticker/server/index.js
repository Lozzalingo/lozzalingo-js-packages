/**
 * @lozzalingo/ticker - Server Routes
 *
 * GET /api/recent-sales   - 5 most recent sales for the homepage ticker
 * GET /api/sales-summary  - aggregate revenue/order stats for the leaderboard
 *
 * Both endpoints are protected by X-Ticker-Key header matching TICKER_API_KEY env var.
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

// ── Summary Adapters ─────────────────────────────────────────────────────────

/**
 * Orders summary - aggregate revenue and count from the Order model.
 */
async function summaryOrders(prisma) {
  console.log("[Ticker] Summarising orders");
  try {
    const result = await prisma.order.aggregate({
      where: {
        status: "paid",
        customerEmail: { notIn: TEST_EMAILS },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
      _min: { createdAt: true },
    });
    return {
      revenue: result._sum.totalAmount || 0,
      count: result._count.id || 0,
      firstDate: result._min.createdAt || null,
    };
  } catch (err) {
    console.error("[Ticker] Error summarising orders:", err);
    return { revenue: 0, count: 0, firstDate: null };
  }
}

/**
 * Bookings summary - aggregate from the Booking model.
 * Handles both totalAmount (BucketRace) and totalPrice (Kalluna) field names.
 */
async function summaryBookings(prisma) {
  console.log("[Ticker] Summarising bookings");
  try {
    // Determine which field the schema uses for total price
    const paidStatuses = ["PAID", "DEPOSIT_PAID", "COMPLETED"];
    const where = {
      status: { in: paidStatuses },
      AND: [
        { customerEmail: { notIn: TEST_EMAILS } },
      ],
    };

    // Try totalAmount first (BucketRace), fall back to totalPrice (Kalluna)
    let result;
    try {
      result = await prisma.booking.aggregate({
        where,
        _sum: { totalAmount: true },
        _count: { id: true },
        _min: { createdAt: true },
      });
      return {
        revenue: result._sum.totalAmount || 0,
        count: result._count.id || 0,
        firstDate: result._min.createdAt || null,
      };
    } catch {
      // totalAmount field doesn't exist, try totalPrice
      result = await prisma.booking.aggregate({
        where,
        _sum: { totalPrice: true },
        _count: { id: true },
        _min: { createdAt: true },
      });
      return {
        revenue: result._sum.totalPrice || 0,
        count: result._count.id || 0,
        firstDate: result._min.createdAt || null,
      };
    }
  } catch (err) {
    console.error("[Ticker] Error summarising bookings:", err);
    return { revenue: 0, count: 0, firstDate: null };
  }
}

/**
 * Purchases summary - aggregate from the Purchase model (digital products).
 * Joins to Product to get individual prices since Purchase has no total field.
 */
async function summaryPurchases(prisma) {
  console.log("[Ticker] Summarising purchases");
  try {
    const purchases = await prisma.purchase.findMany({
      where: {
        status: "completed",
        email: { notIn: TEST_EMAILS },
      },
      include: { product: { select: { price: true } } },
    });
    const revenue = purchases.reduce((sum, p) => {
      // Product price may be in pounds (Float) or pence (Int) depending on schema
      const price = p.product?.price || 0;
      // If price looks like pounds (has decimals or < 100 for reasonable products), convert to pence
      const pence = price < 500 ? Math.round(price * 100) : price;
      return sum + pence;
    }, 0);

    // Get the earliest purchase date
    const firstPurchase = purchases.length > 0
      ? purchases.reduce((earliest, p) => (new Date(p.createdAt) < new Date(earliest.createdAt) ? p : earliest))
      : null;

    return {
      revenue,
      count: purchases.length,
      firstDate: firstPurchase?.createdAt || null,
    };
  } catch (err) {
    console.error("[Ticker] Error summarising purchases:", err);
    return { revenue: 0, count: 0, firstDate: null };
  }
}

/**
 * Subscriptions summary - count active subscriptions.
 * Revenue is not tracked in the User model, so we report count only.
 */
async function summarySubscriptions(prisma) {
  console.log("[Ticker] Summarising subscriptions");
  try {
    const count = await prisma.user.count({
      where: {
        subscriptionStatus: "active",
        stripeSubscriptionId: { not: null },
        email: { notIn: TEST_EMAILS },
      },
    });
    return { revenue: 0, count, firstDate: null };
  } catch (err) {
    console.error("[Ticker] Error summarising subscriptions:", err);
    return { revenue: 0, count: 0, firstDate: null };
  }
}

const SUMMARY_ADAPTERS = {
  orders: summaryOrders,
  bookings: summaryBookings,
  purchases: summaryPurchases,
  subscriptions: summarySubscriptions,
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
 * @param {Function} [options.querySummary] - Custom async function for /summary: (prisma) => { total_revenue_pence, total_orders, first_sale_date }
 * @param {string} [options.currency="GBP"] - Currency code for summary response
 * @returns {express.Router}
 */
function createTickerRoutes(options = {}) {
  const {
    brandName = "Unknown",
    siteUrl = "https://example.com",
    querySales,
    querySummary,
    adapter,
    prisma,
    limit = 5,
    currency = "GBP",
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

  // ── GET /summary - aggregate stats for the leaderboard ──────────────────

  router.get("/summary", tickerAuth, async (req, res) => {
    try {
      console.log("[Ticker] Summary request received for", brandName);

      let totalRevenue = 0;
      let totalOrders = 0;
      let firstDate = null;

      if (querySummary) {
        // Custom summary function
        const result = await querySummary(prisma);
        totalRevenue = result.total_revenue_pence || 0;
        totalOrders = result.total_orders || 0;
        firstDate = result.first_sale_date || null;
      } else if (adapter) {
        // Built-in summary adapters
        const adapterNames = Array.isArray(adapter) ? adapter : [adapter];

        for (const name of adapterNames) {
          const summaryFn = SUMMARY_ADAPTERS[name];
          if (!summaryFn) {
            console.warn("[Ticker] No summary adapter for:", name);
            continue;
          }
          if (!prisma) {
            console.error("[Ticker] Prisma client required for summary adapter:", name);
            continue;
          }
          const result = await summaryFn(prisma);
          totalRevenue += result.revenue;
          totalOrders += result.count;
          // Track the earliest sale date across all adapters
          if (result.firstDate) {
            const d = new Date(result.firstDate);
            if (!firstDate || d < new Date(firstDate)) {
              firstDate = result.firstDate;
            }
          }
        }
      }

      const summary = {
        brand: brandName,
        total_revenue_pence: totalRevenue,
        total_orders: totalOrders,
        first_sale_date: firstDate ? formatDate(firstDate) : null,
        currency: currency,
      };

      console.log("[Ticker] Summary for", brandName, ":", totalOrders, "orders,", totalRevenue, "pence");
      return res.json(summary);
    } catch (err) {
      console.error("[Ticker] Error processing summary request:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

module.exports = { createTickerRoutes, tickerAuth, ADAPTERS, SUMMARY_ADAPTERS };
