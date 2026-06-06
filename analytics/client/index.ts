// Client-side analytics exports
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
} from './analytics';
export type { AnalyticsConfig } from './analytics';

export { default as VisitorTracker, createEcommerceTracker } from './VisitorTracker';
export type { VisitorTrackerProps } from './VisitorTracker';
