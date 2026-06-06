/**
 * Module Metadata
 *
 * Static metadata for each framework package. The dashboard uses this to
 * render cards with descriptions, icons, category groupings, and standard
 * admin paths.
 *
 * adminPath is the STANDARD route across all Lozzalingo apps. Sites can
 * override via dashboard.adminPaths in lozzalingo.yaml, but the defaults
 * here are the blueprint every app should follow.
 *
 * Adding a new package? Just add an entry here - the dashboard picks it up
 * automatically when it appears in registeredFeatures.
 */

const MODULE_META = {
  // ── Core Infrastructure ───────────────────────────────────────────────────
  config: {
    label: "Config",
    description: "Centralised config with 3-tier resolution and feature flags",
    category: "infrastructure",
    icon: "cog",
    adminPath: "/admin/config",
  },
  logging: {
    label: "Logs",
    description: "Persistent structured logging with DB storage",
    category: "infrastructure",
    icon: "clipboard-list",
    adminPath: "/admin/logs",
  },
  email: {
    label: "Email",
    description: "Multi-template email service using Resend API",
    category: "infrastructure",
    icon: "envelope",
    adminPath: "/admin/email",
  },
  subscribers: {
    label: "Subscribers",
    description: "Newsletter subscriptions with popup config and GDPR compliance",
    category: "infrastructure",
    icon: "users",
    adminPath: "/admin/subscribers",
  },
  settings: {
    label: "Settings",
    description: "Encrypted settings storage with AES-256-GCM",
    category: "infrastructure",
    icon: "sliders",
    adminPath: "/admin/settings",
  },
  ops: {
    label: "Ops/Health",
    description: "Health monitoring, disk/memory checks, and operations dashboard",
    category: "infrastructure",
    icon: "heartbeat",
    adminPath: "/admin/ops",
  },
  storage: {
    label: "Storage",
    description: "Cloud storage with DigitalOcean Spaces and image compression",
    category: "infrastructure",
    icon: "cloud-upload",
    adminPath: "/admin/storage",
  },
  auth: {
    label: "Auth",
    description: "Password reset tokens, email verification, and middleware helpers",
    category: "infrastructure",
    icon: "lock",
    adminPath: "/admin/auth",
  },

  // ── Commerce ──────────────────────────────────────────────────────────────
  experiences: {
    label: "Experiences",
    description: "Product/experience management with packages and pricing",
    category: "commerce",
    icon: "star",
    adminPath: "/admin/events",
  },
  bookings: {
    label: "Bookings",
    description: "Booking lifecycle with status tracking and calendar integration",
    category: "commerce",
    icon: "calendar-check",
    adminPath: "/admin/bookings",
  },
  payments: {
    label: "Payments",
    description: "Stripe checkout, invoicing, and webhook handling",
    category: "commerce",
    icon: "credit-card",
    adminPath: "/admin/payments",
  },
  outreach: {
    label: "Outreach",
    description: "Automated email triggers and scheduled follow-ups",
    category: "commerce",
    icon: "paper-plane",
    adminPath: "/admin/outreach",
  },
  calendar: {
    label: "Calendar",
    description: "Availability system with time-slot blocking and iCal sync",
    category: "commerce",
    icon: "calendar",
    adminPath: "/admin/calendar",
  },
  pricing: {
    label: "Pricing",
    description: "Unified calculator for per-person, flat-rate, and min-reserve models",
    category: "commerce",
    icon: "tag",
    adminPath: "/admin/pricing",
  },
  purchases: {
    label: "Purchases",
    description: "Purchase tracking and order fulfilment",
    category: "commerce",
    icon: "shopping-bag",
    adminPath: "/admin/purchases",
  },

  // ── Content & External ────────────────────────────────────────────────────
  external_api: {
    label: "External API",
    description: "API key management and external article endpoints",
    category: "content",
    icon: "plug",
    adminPath: "/admin/external-api",
  },
  analytics: {
    label: "Analytics",
    description: "Visitor tracking with real-time Socket.IO updates",
    category: "content",
    icon: "chart-bar",
    adminPath: "/admin/analytics",
  },

  // ── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: {
    label: "Dashboard",
    description: "Auto-generated module dashboard showing active framework features",
    category: "infrastructure",
    icon: "chart-bar",
    // No adminPath - you're already on it
  },

  // ── Optional ──────────────────────────────────────────────────────────────
  game_engine: {
    label: "Game Engine",
    description: "Shared engine for quizzes and scavenger hunts via Socket.IO",
    category: "optional",
    icon: "gamepad",
    adminPath: "/admin/game-engine",
  },
  merchandise: {
    label: "Merchandise",
    description: "Product management with image upload and stock tracking",
    category: "optional",
    icon: "tshirt",
    adminPath: "/admin/merchandise",
  },
  orders: {
    label: "Orders",
    description: "Order management with status tracking and admin dashboard",
    category: "optional",
    icon: "box",
    adminPath: "/admin/orders",
  },
  marketplace_sync: {
    label: "Marketplace Sync",
    description: "Sync experiences to external marketplace platforms",
    category: "optional",
    icon: "sync",
    adminPath: "/admin/marketplace-sync",
  },
  restream: {
    label: "Restream",
    description: "Live streaming integration and management",
    category: "optional",
    icon: "video",
    adminPath: "/admin/restream",
  },
};

const CATEGORY_LABELS = {
  infrastructure: "Core Infrastructure",
  commerce: "Commerce",
  content: "Content & External",
  optional: "Optional Modules",
};

const CATEGORY_ORDER = ["infrastructure", "commerce", "content", "optional"];

module.exports = { MODULE_META, CATEGORY_LABELS, CATEGORY_ORDER };
