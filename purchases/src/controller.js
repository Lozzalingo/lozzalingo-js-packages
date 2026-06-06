const { generateDownloadToken, validateDownload } = require("./services/download-token");

function createPurchaseController(prisma, options = {}) {
  const {
    modelName = "purchase",
    defaultDownloadLimit = 3,
    defaultExpiryDays = 7,
    hooks = {},
  } = options;

  console.log("[Purchases] Initialising purchases controller");

  // --- Public handlers ---

  async function downloadByToken(req, res) {
    try {
      const { token } = req.params;

      const purchase = await prisma[modelName].findFirst({
        where: { downloadToken: token },
      });

      if (!purchase) {
        console.log("[Purchases] Download token not found:", token);
        return res.status(404).json({ error: "Purchase not found" });
      }

      const validation = validateDownload(purchase);

      if (!validation.allowed) {
        console.log("[Purchases] Download rejected:", validation.reason);
        return res.status(410).json({ error: validation.reason });
      }

      if (!hooks.getDownloadUrl) {
        console.error("[Purchases] getDownloadUrl hook is not configured");
        return res.status(500).json({ error: "Download not configured" });
      }

      const downloadUrl = await hooks.getDownloadUrl(purchase);

      // Increment download count
      await prisma[modelName].update({
        where: { id: purchase.id },
        data: { downloadCount: { increment: 1 } },
      });

      console.log("[Purchases] Download served for purchase:", purchase.id, "count:", purchase.downloadCount + 1);

      // Fire onDownload hook
      if (hooks.onDownload) {
        try {
          await hooks.onDownload(purchase);
        } catch (hookError) {
          console.error("[Purchases] onDownload hook failed:", hookError.message);
        }
      }

      return res.redirect(302, downloadUrl);
    } catch (error) {
      console.error("[Purchases] Failed to process download:", error.message);
      return res.status(500).json({ error: "Failed to process download" });
    }
  }

  async function getBySessionId(req, res) {
    try {
      const { sessionId } = req.params;

      const purchase = await prisma[modelName].findFirst({
        where: { stripeSessionId: sessionId },
      });

      if (!purchase) {
        console.log("[Purchases] Purchase not found for session:", sessionId);
        return res.status(404).json({ error: "Purchase not found" });
      }

      console.log("[Purchases] Found purchase for session:", sessionId);
      return res.json(purchase);
    } catch (error) {
      console.error("[Purchases] Failed to fetch purchase by session:", error.message);
      return res.status(500).json({ error: "Failed to fetch purchase" });
    }
  }

  async function getByEmail(req, res) {
    try {
      const { email } = req.params;

      const purchases = await prisma[modelName].findMany({
        where: { email },
        orderBy: { createdAt: "desc" },
      });

      console.log("[Purchases] Found", purchases.length, "purchases for:", email);
      return res.json(purchases);
    } catch (error) {
      console.error("[Purchases] Failed to fetch purchases by email:", error.message);
      return res.status(500).json({ error: "Failed to fetch purchases" });
    }
  }

  // --- Admin handlers ---

  async function getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const skip = (page - 1) * limit;

      const where = {};

      if (req.query.status) {
        where.status = req.query.status;
      }

      if (req.query.email) {
        where.email = req.query.email;
      }

      if (req.query.productType) {
        where.productType = req.query.productType;
      }

      if (req.query.search) {
        where.OR = [
          { email: { contains: req.query.search } },
          { productName: { contains: req.query.search } },
        ];
      }

      const sort = req.query.sort || "createdAt";
      const sortDir = req.query.sortDir || "desc";
      const orderBy = { [sort]: sortDir };

      const [records, total] = await Promise.all([
        prisma[modelName].findMany({ where, skip, take: limit, orderBy }),
        prisma[modelName].count({ where }),
      ]);

      console.log("[Purchases] Admin list: page", page, "of", Math.ceil(total / limit));
      return res.json({
        data: records,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      console.error("[Purchases] Failed to fetch purchases:", error.message);
      return res.status(500).json({ error: "Failed to fetch purchases" });
    }
  }

  async function getById(req, res) {
    try {
      const { id } = req.params;

      const purchase = await prisma[modelName].findUnique({
        where: { id },
      });

      if (!purchase) {
        console.log("[Purchases] Purchase not found:", id);
        return res.status(404).json({ error: "Purchase not found" });
      }

      return res.json(purchase);
    } catch (error) {
      console.error("[Purchases] Failed to fetch purchase:", error.message);
      return res.status(500).json({ error: "Failed to fetch purchase" });
    }
  }

  async function resetDownloads(req, res) {
    try {
      const { id } = req.params;

      const purchase = await prisma[modelName].update({
        where: { id },
        data: { downloadCount: 0 },
      });

      console.log("[Purchases] Reset download count for purchase:", id);
      return res.json(purchase);
    } catch (error) {
      console.error("[Purchases] Failed to reset downloads:", error.message);
      return res.status(500).json({ error: "Failed to reset downloads" });
    }
  }

  async function extendExpiry(req, res) {
    try {
      const { id } = req.params;
      const { days } = req.body;

      if (!days || days < 1) {
        return res.status(400).json({ error: "Valid number of days is required" });
      }

      const existing = await prisma[modelName].findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: "Purchase not found" });
      }

      const baseDate = existing.expiresAt ? new Date(existing.expiresAt) : new Date();
      const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

      const purchase = await prisma[modelName].update({
        where: { id },
        data: { expiresAt: newExpiry },
      });

      console.log("[Purchases] Extended expiry for purchase:", id, "to", newExpiry.toISOString());
      return res.json(purchase);
    } catch (error) {
      console.error("[Purchases] Failed to extend expiry:", error.message);
      return res.status(500).json({ error: "Failed to extend expiry" });
    }
  }

  async function revokeAccess(req, res) {
    try {
      const { id } = req.params;

      const purchase = await prisma[modelName].update({
        where: { id },
        data: { accessGranted: false },
      });

      console.log("[Purchases] Revoked access for purchase:", id);

      if (hooks.onAccessRevoked) {
        try {
          await hooks.onAccessRevoked(purchase);
        } catch (hookError) {
          console.error("[Purchases] onAccessRevoked hook failed:", hookError.message);
        }
      }

      return res.json(purchase);
    } catch (error) {
      console.error("[Purchases] Failed to revoke access:", error.message);
      return res.status(500).json({ error: "Failed to revoke access" });
    }
  }

  // --- Programmatic methods (called by webhook handlers, not HTTP) ---

  async function createFromPayment(data) {
    try {
      const {
        email,
        userId,
        productId,
        productName,
        stripeSessionId,
        stripePaymentId,
        downloadLimit,
        expiryDays,
      } = data;

      console.log("[Purchases] Creating purchase from payment:", { email, productId, stripeSessionId });

      // Idempotency check - if stripeSessionId already exists, return existing purchase
      if (stripeSessionId) {
        const existing = await prisma[modelName].findFirst({
          where: { stripeSessionId },
        });
        if (existing) {
          console.log("[Purchases] Duplicate session, returning existing:", existing.id);
          return existing;
        }
      }

      // Generate download token
      const downloadToken = generateDownloadToken();

      // Calculate expiry
      const effectiveExpiryDays = expiryDays !== undefined ? expiryDays : defaultExpiryDays;
      const expiresAt = effectiveExpiryDays > 0
        ? new Date(Date.now() + effectiveExpiryDays * 24 * 60 * 60 * 1000)
        : null;

      const purchase = await prisma[modelName].create({
        data: {
          email,
          userId: userId || null,
          productId,
          productName,
          productType: "ONE_OFF",
          stripeSessionId: stripeSessionId || null,
          stripePaymentId: stripePaymentId || null,
          status: "COMPLETED",
          downloadToken,
          downloadCount: 0,
          downloadLimit: downloadLimit || defaultDownloadLimit,
          expiresAt,
        },
      });

      console.log("[Purchases] Created purchase:", purchase.id);

      // Fire onPurchaseCreated hook
      if (hooks.onPurchaseCreated) {
        try {
          await hooks.onPurchaseCreated(purchase);
        } catch (hookError) {
          console.error("[Purchases] onPurchaseCreated hook failed:", hookError.message);
        }
      }

      return purchase;
    } catch (error) {
      console.error("[Purchases] Failed to create purchase from payment:", error.message);
      throw error;
    }
  }

  async function grantAccess(data) {
    try {
      const {
        email,
        userId,
        productId,
        productName,
        stripeSubscriptionId,
        accessExpiresAt,
      } = data;

      console.log("[Purchases] Granting access:", { email, productId, stripeSubscriptionId });

      // Find existing purchase by stripeSubscriptionId
      const existing = await prisma[modelName].findFirst({
        where: { stripeSubscriptionId },
      });

      let purchase;

      if (existing) {
        // Update existing
        purchase = await prisma[modelName].update({
          where: { id: existing.id },
          data: {
            accessGranted: true,
            accessExpiresAt: accessExpiresAt || null,
          },
        });
        console.log("[Purchases] Updated access for existing purchase:", purchase.id);
      } else {
        // Create new subscription purchase
        purchase = await prisma[modelName].create({
          data: {
            email,
            userId: userId || null,
            productId,
            productName,
            productType: "SUBSCRIPTION",
            status: "COMPLETED",
            stripeSubscriptionId,
            accessGranted: true,
            accessExpiresAt: accessExpiresAt || null,
          },
        });
        console.log("[Purchases] Created subscription purchase:", purchase.id);
      }

      // Fire onAccessGranted hook
      if (hooks.onAccessGranted) {
        try {
          await hooks.onAccessGranted(purchase);
        } catch (hookError) {
          console.error("[Purchases] onAccessGranted hook failed:", hookError.message);
        }
      }

      return purchase;
    } catch (error) {
      console.error("[Purchases] Failed to grant access:", error.message);
      throw error;
    }
  }

  async function revokeAccessBySubscription(stripeSubscriptionId) {
    try {
      console.log("[Purchases] Revoking access for subscription:", stripeSubscriptionId);

      const existing = await prisma[modelName].findFirst({
        where: { stripeSubscriptionId },
      });

      if (!existing) {
        console.log("[Purchases] No purchase found for subscription:", stripeSubscriptionId);
        return null;
      }

      const purchase = await prisma[modelName].update({
        where: { id: existing.id },
        data: { accessGranted: false },
      });

      console.log("[Purchases] Revoked access for purchase:", purchase.id);

      // Fire onAccessRevoked hook
      if (hooks.onAccessRevoked) {
        try {
          await hooks.onAccessRevoked(purchase);
        } catch (hookError) {
          console.error("[Purchases] onAccessRevoked hook failed:", hookError.message);
        }
      }

      return purchase;
    } catch (error) {
      console.error("[Purchases] Failed to revoke access by subscription:", error.message);
      throw error;
    }
  }

  return {
    // Public
    downloadByToken,
    getBySessionId,
    getByEmail,

    // Admin
    getAll,
    getById,
    resetDownloads,
    extendExpiry,
    revokeAccess,

    // Programmatic
    createFromPayment,
    grantAccess,
    revokeAccessBySubscription,
  };
}

module.exports = { createPurchaseController };
