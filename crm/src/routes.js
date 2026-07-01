/**
 * @lozzalingo/crm - Routes
 *
 * Admin API routes for CRM management.
 * All routes are behind admin auth middleware.
 */

const express = require("express");

/**
 * Create CRM routes.
 *
 * @param {object} prisma - Prisma client
 * @param {object} [options]
 * @param {function} [options.authMiddleware] - Admin auth middleware
 * @param {string} [options.customerPrefix] - Brand prefix, e.g. "BR"
 * @param {object} [options.scoring] - Scoring weights
 * @param {string} [options.campaignModel] - Prisma model name for campaigns
 * @param {string} [options.campaignSendModel] - Prisma model name for campaign sends
 * @returns {express.Router}
 */
function createCrmRoutes(prisma, options = {}) {
  const router = express.Router();
  const {
    authMiddleware,
    customerPrefix = "LZ",
    scoring = {},
    campaignModel = "campaign",
    campaignSendModel = "campaignSend",
  } = options;

  const { recalculateScore } = require("./services/scoring");

  // Apply auth to all CRM routes
  if (authMiddleware) {
    router.use(authMiddleware);
  }

  // ── GET /customers - Paginated list with search and filters ──────────────

  router.get("/customers", async (req, res) => {
    try {
      const {
        search,
        status,
        minScore,
        maxScore,
        page = "1",
        limit = "50",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      // Build where clause
      const where = {};

      if (search) {
        where.OR = [
          { email: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { company: { contains: search } },
          { customerNumber: { contains: search } },
        ];
      }

      if (status) {
        where.status = status;
      }

      // Fetch customers with score
      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          include: { score: { select: { score: true } } },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take,
        }),
        prisma.customer.count({ where }),
      ]);

      // Filter by score range if specified (post-query since score is a relation)
      let filtered = customers;
      if (minScore || maxScore) {
        filtered = customers.filter((c) => {
          const s = c.score?.score || 0;
          if (minScore && s < parseInt(minScore)) return false;
          if (maxScore && s > parseInt(maxScore)) return false;
          return true;
        });
      }

      console.log(`[CRM] Listed ${filtered.length} customers (page ${page}, total ${total})`);

      res.json({
        customers: filtered,
        pagination: {
          page: parseInt(page),
          limit: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      });
    } catch (error) {
      console.error("[CRM] Failed to list customers:", error.message);
      res.status(500).json({ error: "Failed to list customers" });
    }
  });

  // ── GET /customers/:id - Full customer detail ────────────────────────────

  router.get("/customers/:id", async (req, res) => {
    try {
      // Build include - bookings relation is site-specific (not all sites have it)
      const include = {
        score: true,
        activities: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        marketingPreferences: true,
      };

      // Check if the Customer model has a bookings relation
      const customerFields = prisma.customer.fields || {};
      const hasBookings = !!customerFields.bookings || !!prisma.booking;
      if (hasBookings) {
        try {
          // Test if bookings relation exists on Customer by checking Prisma model metadata
          const testInclude = {
            ...include,
            bookings: {
              orderBy: { createdAt: "desc" },
              take: 20,
              select: {
                id: true,
                bookingNumber: true,
                customerName: true,
                status: true,
                eventDate: true,
                totalAmount: true,
                groupSize: true,
                createdAt: true,
              },
            },
          };
          const customer = await prisma.customer.findUnique({
            where: { id: req.params.id },
            include: testInclude,
          });

          if (!customer) {
            return res.status(404).json({ error: "Customer not found" });
          }

          // Parse score breakdown
          if (customer.score?.breakdown) {
            try {
              customer.score.breakdown = JSON.parse(customer.score.breakdown);
            } catch (e) {
              // Already parsed or invalid
            }
          }

          // Fetch campaign sends
          let campaignSends = [];
          try {
            campaignSends = await prisma[campaignSendModel].findMany({
              where: { customerId: req.params.id },
              orderBy: { sentAt: "desc" },
              take: 50,
              include: {
                campaign: { select: { name: true, subject: true } },
              },
            });
          } catch (e) {
            console.error("[CRM] Failed to fetch campaign sends:", e.message);
          }

          console.log(`[CRM] Customer detail: ${customer.customerNumber || customer.id}`);
          return res.json({ ...customer, campaignSends });
        } catch (bookingErr) {
          // Bookings relation doesn't exist on this site, fall through
          console.log("[CRM] Bookings relation not available, fetching without");
        }
      }

      // Fallback: fetch without bookings
      const customer = await prisma.customer.findUnique({
        where: { id: req.params.id },
        include,
      });

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Parse score breakdown
      if (customer.score?.breakdown) {
        try {
          customer.score.breakdown = JSON.parse(customer.score.breakdown);
        } catch (e) {
          // Already parsed or invalid
        }
      }

      // Fetch campaign sends
      let campaignSends = [];
      try {
        campaignSends = await prisma[campaignSendModel].findMany({
          where: { customerId: req.params.id },
          orderBy: { sentAt: "desc" },
          take: 50,
          include: {
            campaign: { select: { name: true, subject: true } },
          },
        });
      } catch (e) {
        console.error("[CRM] Failed to fetch campaign sends:", e.message);
      }

      console.log(`[CRM] Customer detail: ${customer.customerNumber || customer.id}`);
      res.json({ ...customer, bookings: [], campaignSends });
    } catch (error) {
      console.error("[CRM] Failed to get customer:", error.message);
      res.status(500).json({ error: "Failed to get customer" });
    }
  });

  // ── PUT /customers/:id - Update customer ─────────────────────────────────

  router.put("/customers/:id", async (req, res) => {
    try {
      const allowedFields = [
        "firstName", "lastName", "phone", "company", "jobTitle",
        "dateOfBirth", "country", "region", "source", "status",
        "marketingOptIn", "referralName", "referralEmail",
        "linkedinUrl", "instagramHandle", "websiteUrl", "notes",
      ];

      const data = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }

      // Convert dateOfBirth string to Date
      if (data.dateOfBirth && typeof data.dateOfBirth === "string") {
        data.dateOfBirth = new Date(data.dateOfBirth);
      }

      const customer = await prisma.customer.update({
        where: { id: req.params.id },
        data,
      });

      console.log(`[CRM] Updated customer: ${customer.customerNumber || customer.id}`);
      res.json(customer);
    } catch (error) {
      console.error("[CRM] Failed to update customer:", error.message);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // ── DELETE /customers/:id - Delete customer and related data ─────────────

  router.delete("/customers/:id", async (req, res) => {
    try {
      const customerId = req.params.id;

      // Check customer exists
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, customerNumber: true, email: true },
      });

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Delete related records first (foreign key constraints)
      await Promise.all([
        prisma.customerActivity.deleteMany({ where: { customerId } }),
        prisma.customerScore.deleteMany({ where: { customerId } }),
        prisma.marketingPreference.deleteMany({ where: { customerId } }),
        prisma[campaignSendModel].deleteMany({ where: { customerId } }),
        prisma.subscriberConfirmation.deleteMany({ where: { customerId } }),
      ]);

      // Delete the customer
      await prisma.customer.delete({ where: { id: customerId } });

      console.log(`[CRM] Deleted customer: ${customer.customerNumber} (${customer.email})`);
      res.json({ success: true, deleted: customer.customerNumber });
    } catch (error) {
      console.error("[CRM] Failed to delete customer:", error.message);
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  // ── GET /customers/:id/activities - Activity history ─────────────────────

  router.get("/customers/:id/activities", async (req, res) => {
    try {
      const { page = "1", limit = "50" } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [activities, total] = await Promise.all([
        prisma.customerActivity.findMany({
          where: { customerId: req.params.id },
          orderBy: { createdAt: "desc" },
          skip,
          take: parseInt(limit),
        }),
        prisma.customerActivity.count({
          where: { customerId: req.params.id },
        }),
      ]);

      res.json({ activities, total });
    } catch (error) {
      console.error("[CRM] Failed to get activities:", error.message);
      res.status(500).json({ error: "Failed to get activities" });
    }
  });

  // ── POST /customers/:id/recalculate - Force score recalculation ──────────

  router.post("/customers/:id/recalculate", async (req, res) => {
    try {
      const score = await recalculateScore(
        prisma,
        req.params.id,
        scoring,
        { campaignSendModel }
      );

      if (!score) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Parse breakdown for response
      let breakdown;
      try {
        breakdown = JSON.parse(score.breakdown);
      } catch (e) {
        breakdown = score.breakdown;
      }

      res.json({ score: score.score, breakdown });
    } catch (error) {
      console.error("[CRM] Failed to recalculate score:", error.message);
      res.status(500).json({ error: "Failed to recalculate score" });
    }
  });

  // ── GET /dashboard - CRM overview stats ──────────────────────────────────

  router.get("/dashboard", async (req, res) => {
    try {
      const [
        totalCustomers,
        activeCustomers,
        unsubscribed,
        withScore,
        recentActivity,
      ] = await Promise.all([
        prisma.customer.count(),
        prisma.customer.count({ where: { status: "ACTIVE" } }),
        prisma.customer.count({ where: { status: "UNSUBSCRIBED" } }),
        prisma.customerScore.aggregate({
          _avg: { score: true },
          _max: { score: true },
          _min: { score: true },
        }),
        prisma.customerActivity.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      // Top scoring customers
      const topCustomers = await prisma.customerScore.findMany({
        orderBy: { score: "desc" },
        take: 10,
        include: {
          customer: {
            select: {
              id: true,
              customerNumber: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true,
            },
          },
        },
      });

      res.json({
        totalCustomers,
        activeCustomers,
        unsubscribed,
        averageScore: Math.round(withScore._avg.score || 0),
        maxScore: withScore._max.score || 0,
        recentActivityCount: recentActivity,
        topCustomers: topCustomers.map((s) => ({
          ...s.customer,
          score: s.score,
        })),
      });
    } catch (error) {
      console.error("[CRM] Failed to get dashboard:", error.message);
      res.status(500).json({ error: "Failed to get dashboard data" });
    }
  });

  console.log("[CRM] Routes registered");
  return router;
}

module.exports = { createCrmRoutes };
