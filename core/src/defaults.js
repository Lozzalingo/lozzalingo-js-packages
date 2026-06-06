/**
 * Default Configuration
 *
 * Mirrors the Python framework's DEFAULT_CONFIG in lozzalingo/__init__.py.
 * All features default to true except niche ones.
 */

const DEFAULT_CONFIG = {
  site: {
    name: "Lozzalingo Site",
    tagline: "",
    baseUrl: "http://localhost:3001",
  },

  // Feature flags - mirrors Python framework's features dict
  features: {
    // Core infrastructure (default on)
    config: true,
    logging: true,
    email: true,
    settings: true,
    ops: true,
    storage: true,
    auth: true,
    subscribers: true,

    // Commerce (default on)
    experiences: true,
    bookings: true,
    payments: true,
    outreach: true,
    calendar: true,
    external_api: true,

    // Dashboard (default on - shows active modules)
    dashboard: true,

    // Optional (default off)
    analytics: false,
    game_engine: false,
    merchandise: false,
    orders: false,
    marketplace_sync: false,
    purchases: false,
    pricing: false,
    restream: false,
  },

  // Default route mount paths
  routes: {
    health: "/api/health",
    logging: "/api/logs",
    clientErrors: "/api/logs/client",
    email: "/api/emails",
    subscribers: "/api/shared-subscribers",
    settings: "/api/app-settings",
    ops: "/api/ops",
    storage: "/api/storage",
    auth: "/api/shared-auth",
    calendar: "/api/calendar",
    experiences: "/api",
    bookings: "/api/bookings",
    payments: "/api/payments",
    outreach: "/api/outreach",
    external_api: "/api/external",
    external_api_admin: "/api/admin/api-keys",
    dashboard: "/api/dashboard",
    analytics: "/api/analytics",
    merchandise: "/api/merchandise",
    orders: "/api/orders",
    marketplace_sync: "/api/marketplace-sync",
    purchases: "/api/purchases",
  },

  // CORS defaults
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-admin-secret",
      "x-admin-key",
      "x-api-key",
    ],
  },

  // Package-specific config (mirrors Python's per-module config sections)
  email: {
    brandName: null, // Falls back to site.name
    style: { primary: "#3b82f6", headerBg: "#0a0a0a" },
  },

  calendar: {
    domain: null,
    calendarName: null,
  },

  bookings: {
    modelName: "booking",
    brandPrefix: "LZ",
  },

  payments: {
    // All from env vars by default
  },

  outreach: {
    adminEmail: null, // From ADMIN_EMAIL env var
    brandName: null, // Falls back to site.name
  },

  experiences: {
    // Standard config
  },

  external_api: {
    articleModelName: "blogPost",
  },
};

module.exports = { DEFAULT_CONFIG };
