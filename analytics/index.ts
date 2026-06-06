// Main entry point for @lozzalingo/analytics
// Client-side exports
export {
  getOrCreateSessionId,
  incrementSessionPageCount,
  isNewVisitor,
  detectDevice,
  detectBot,
  getHardwareInfo,
  getUTMParams,
  generateFingerprint,
  getPageLoadTime,
  categorizeReferrer,
  collectAnalyticsData,
} from './client/analytics';
export type { AnalyticsConfig } from './client/analytics';

export { default as VisitorTracker, createEcommerceTracker } from './client/VisitorTracker';
export type { VisitorTrackerProps } from './client/VisitorTracker';

// Server-side exports are in ./server/index.js (CommonJS)
// Import with: const { createVisitorRoutes } = require('@lozzalingo/analytics/server');
