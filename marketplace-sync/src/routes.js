/**
 * Marketplace Sync API Routes
 * Mount with: app.use('/api/marketplace', createMarketplaceRoutes(prisma, options))
 */

const express = require("express");
const { SyncEngine } = require("./sync-engine");

function createMarketplaceRoutes(prisma, options = {}) {
  const router = express.Router();
  const authMiddleware = options.authMiddleware || ((req, res, next) => next());
  const syncEngine = new SyncEngine(prisma, options.adapters || {});

  // GET /api/marketplace/status - list all marketplace listings
  router.get("/status", authMiddleware, async (req, res) => {
    try {
      const { experienceId } = req.query;
      const listings = await syncEngine.getStatus(experienceId || null);
      console.log("[Marketplace] Status check:", listings.length, "listings");
      res.json({ listings });
    } catch (err) {
      console.error("[Marketplace] Status error:", err.message);
      res.status(500).json({ error: "Failed to fetch marketplace status" });
    }
  });

  // POST /api/marketplace/push - push experience to platforms
  router.post("/push", authMiddleware, async (req, res) => {
    try {
      const { experienceId, platforms } = req.body;

      if (!experienceId) {
        return res.status(400).json({ error: "experienceId is required" });
      }

      console.log("[Marketplace] Push request for:", experienceId, "platforms:", platforms || "all");
      const result = await syncEngine.pushExperience(experienceId, platforms);
      res.json(result);
    } catch (err) {
      console.error("[Marketplace] Push error:", err.message);
      res.status(500).json({ error: "Failed to push to marketplace" });
    }
  });

  // POST /api/marketplace/remove - remove experience from platforms
  router.post("/remove", authMiddleware, async (req, res) => {
    try {
      const { experienceId, platforms } = req.body;

      if (!experienceId) {
        return res.status(400).json({ error: "experienceId is required" });
      }

      console.log("[Marketplace] Remove request for:", experienceId);
      const result = await syncEngine.removeExperience(experienceId, platforms);
      res.json(result);
    } catch (err) {
      console.error("[Marketplace] Remove error:", err.message);
      res.status(500).json({ error: "Failed to remove from marketplace" });
    }
  });

  // POST /api/marketplace/pull-bookings - import bookings from external platforms
  router.post("/pull-bookings", authMiddleware, async (req, res) => {
    try {
      const { experienceId } = req.body;

      if (!experienceId) {
        return res.status(400).json({ error: "experienceId is required" });
      }

      console.log("[Marketplace] Pull bookings for:", experienceId);
      const result = await syncEngine.pullBookings(experienceId);
      res.json(result);
    } catch (err) {
      console.error("[Marketplace] Pull bookings error:", err.message);
      res.status(500).json({ error: "Failed to pull bookings" });
    }
  });

  // GET /api/marketplace/platforms - list available platforms
  router.get("/platforms", (req, res) => {
    const platforms = [
      { id: "EVENTBRITE", name: "Eventbrite", description: "Events platform", configured: !!syncEngine.adapters.EVENTBRITE },
      { id: "DESIGN_MY_NIGHT", name: "Design My Night", description: "Nightlife & experiences", configured: !!syncEngine.adapters.DESIGN_MY_NIGHT },
      { id: "GROUPON", name: "Groupon", description: "Deal marketplace", configured: !!syncEngine.adapters.GROUPON },
      { id: "WOWCHER", name: "Wowcher", description: "UK deal platform", configured: !!syncEngine.adapters.WOWCHER },
      { id: "FEVER", name: "Fever", description: "Experience discovery", configured: !!syncEngine.adapters.FEVER },
    ];
    res.json({ platforms });
  });

  return router;
}

module.exports = { createMarketplaceRoutes };
