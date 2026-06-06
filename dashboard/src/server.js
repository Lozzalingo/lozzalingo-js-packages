/**
 * @lozzalingo/dashboard - Server Routes
 *
 * Exposes a /modules endpoint that returns the full list of features
 * from the running Lozzalingo instance - both enabled and disabled,
 * with metadata for rendering dashboard cards.
 *
 * Usage:
 *   const { createDashboardRoutes } = require('@lozzalingo/dashboard/server');
 *   app.use('/api/dashboard', createDashboardRoutes(lz));
 */

const express = require("express");
const { MODULE_META, CATEGORY_LABELS, CATEGORY_ORDER } = require("./module-meta");

/**
 * Create the dashboard router.
 *
 * @param {import('@lozzalingo/core').Lozzalingo} lz - The Lozzalingo instance
 * @param {object} [opts]
 * @param {Function} [opts.authMiddleware] - Optional admin auth middleware
 * @param {Record<string, string>} [opts.adminPaths] - Per-module admin path overrides (e.g. { bookings: '/admin/bookings' })
 * @returns {express.Router}
 */
function createDashboardRoutes(lz, opts = {}) {
  const adminPathOverrides = opts.adminPaths || {};
  const router = express.Router();

  if (opts.authMiddleware) {
    router.use(opts.authMiddleware);
  }

  router.get("/modules", (req, res) => {
    console.log("[Dashboard] Modules list requested");

    const registeredFeatures = lz.getRegisteredFeatures();
    const allFeatures = lz.config.features || {};
    const routes = lz.config.routes || {};

    // Build module list - every feature in the config, with its status
    const modules = [];

    for (const [featureKey, enabled] of Object.entries(allFeatures)) {
      const meta = MODULE_META[featureKey] || {
        label: featureKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: "",
        category: "optional",
        icon: "puzzle-piece",
      };

      const registered = registeredFeatures.includes(featureKey);

      modules.push({
        key: featureKey,
        label: meta.label,
        description: meta.description,
        category: meta.category,
        icon: meta.icon,
        enabled: !!enabled,
        registered,
        route: routes[featureKey] || null,
        adminPath: adminPathOverrides[featureKey] || meta.adminPath || null,
      });
    }

    // Sort by category order, then alphabetically within each category
    modules.sort((a, b) => {
      const catA = CATEGORY_ORDER.indexOf(a.category);
      const catB = CATEGORY_ORDER.indexOf(b.category);
      if (catA !== catB) return catA - catB;
      return a.label.localeCompare(b.label);
    });

    console.log("[Dashboard] Returning", modules.length, "modules");

    res.json({
      site: lz.config.site,
      modules,
      categories: CATEGORY_LABELS,
      summary: {
        total: modules.length,
        enabled: modules.filter((m) => m.enabled).length,
        registered: registeredFeatures.length,
      },
    });
  });

  return router;
}

module.exports = { createDashboardRoutes };
