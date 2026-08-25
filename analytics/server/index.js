// Server-side analytics exports
const { createVisitorController } = require("./visitors.controller");
const { createVisitorRoutes } = require("./visitors.routes");

/**
 * Convenience factory: creates a trackConversion function bound to your prisma instance.
 * Usage:
 *   const { createTrackConversion } = require('@lozzalingo/analytics/server');
 *   const trackConversion = createTrackConversion(prisma, { siteDomain: 'mysite.com' });
 *   await trackConversion({ userId: '...', orderValue: 29.99, productId: 'plan-pro' });
 */
function createTrackConversion(prisma, options = {}) {
  const controller = createVisitorController(prisma, options);
  return controller.trackConversion;
}

module.exports = { createVisitorController, createVisitorRoutes, createTrackConversion };
