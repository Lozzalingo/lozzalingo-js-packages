/**
 * Lozzalingo - JS Framework Orchestrator
 * =======================================
 *
 * Mirrors the Python framework's Lozzalingo class in lozzalingo/__init__.py.
 * Reads a config file, registers all enabled packages, wires hooks between them.
 *
 * Usage:
 *   const { Lozzalingo } = require('@lozzalingo/core');
 *   const lz = new Lozzalingo(app, prisma);
 *
 * Or with explicit config:
 *   const lz = new Lozzalingo(app, prisma, { site: { name: 'BucketRace' } });
 */

const express = require("express");
const { loadConfigFile, deepMerge, deepClone } = require("./config-loader");
const { DEFAULT_CONFIG } = require("./defaults");

class Lozzalingo {
  /**
   * @param {express.Application} app - Express app instance
   * @param {import('@prisma/client').PrismaClient} prisma - Prisma client
   * @param {object} [userConfig] - Optional config overrides (merged on top of file + defaults)
   */
  constructor(app, prisma, userConfig = {}) {
    this.app = app;
    this.prisma = prisma;
    this.services = {};
    this.controllers = {};
    this.registeredFeatures = [];
    this._adminMiddleware = null;

    // 1. Load and merge config: defaults <- file <- userConfig
    this._loadConfig(userConfig);

    // 2. Set up middleware (CORS, JSON, raw body for Stripe)
    this._setupMiddleware();

    // 3. Set up admin auth
    this._setupAdminAuth();

    // 4. Health endpoint
    this._setupHealth();

    // 5. Create shared services (order matters - email before outreach)
    this._createServices();

    // 6. Register all enabled features
    this._registerFeatures();

    // 7. Wire cross-package hooks
    this._wireHooks();

    console.log(
      "[Core] Lozzalingo ready.",
      this.registeredFeatures.length,
      "features registered:",
      this.registeredFeatures.join(", ")
    );
  }

  // ── Config ─────────────────────────────────────────────────────────────────

  _loadConfig(userConfig) {
    // Start with defaults
    this.config = deepClone(DEFAULT_CONFIG);

    // Merge file config (looks for lozzalingo.yaml etc.)
    const fileConfig = loadConfigFile(process.cwd());
    deepMerge(this.config, fileConfig);

    // Merge user config (passed to constructor)
    deepMerge(this.config, userConfig);

    // Fill in derived values
    if (!this.config.email.brandName) {
      this.config.email.brandName = this.config.site.name;
    }
    if (!this.config.outreach.brandName) {
      this.config.outreach.brandName = this.config.site.name;
    }
    if (!this.config.outreach.adminEmail) {
      this.config.outreach.adminEmail = process.env.ADMIN_EMAIL;
    }

    console.log("[Core] Config loaded for:", this.config.site.name);
  }

  /**
   * Check if a feature is enabled.
   */
  isEnabled(feature) {
    return !!this.config.features[feature];
  }

  // ── Middleware ──────────────────────────────────────────────────────────────

  _setupMiddleware() {
    const app = this.app;

    // Stripe webhook raw body MUST come before express.json()
    if (this.isEnabled("payments")) {
      const paymentsPath = this.config.routes.payments || "/api/payments";
      app.use(
        `${paymentsPath}/webhook`,
        express.raw({ type: "application/json" })
      );
      console.log("[Core] Raw body middleware registered for", `${paymentsPath}/webhook`);
    }

    // JSON body parser
    app.use(express.json());

    // CORS
    try {
      const cors = require("cors");
      app.use(cors(this.config.cors));
      console.log("[Core] CORS middleware registered");
    } catch (e) {
      console.warn("[Core] cors package not installed, skipping CORS middleware");
    }

    // File upload (optional)
    try {
      const fileUpload = require("express-fileupload");
      app.use(fileUpload());
      console.log("[Core] File upload middleware registered");
    } catch (e) {
      // Optional - not a problem
    }
  }

  // ── Admin Auth ─────────────────────────────────────────────────────────────

  _setupAdminAuth() {
    const nextAuthSecret = process.env.NEXTAUTH_SECRET;

    // Fallback static keys for backward compatibility (API integrations, etc.)
    const adminKeys = [
      this.config.auth?.adminKey,
      process.env.ADMIN_API_KEY,
      process.env.ADMIN_SECRET,
    ].filter(Boolean);

    // Lazy-load JWT decode utilities
    let _decodeJWT;
    async function decodeNextAuthJWT(token) {
      if (!nextAuthSecret) return null;
      if (!_decodeJWT) {
        try {
          const { jwtDecrypt } = require("jose");
          const hkdf = require("@panva/hkdf");
          _decodeJWT = async (rawToken) => {
            const encKey = await hkdf.default("sha256", nextAuthSecret, "", "NextAuth.js Generated Encryption Key", 32);
            const { payload } = await jwtDecrypt(rawToken, encKey, { clockTolerance: 15 });
            return payload;
          };
        } catch (err) {
          console.warn("[Auth] JWT decode unavailable (jose/@panva/hkdf missing):", err.message);
          _decodeJWT = async () => null;
        }
      }
      return _decodeJWT(token);
    }

    this._adminMiddleware = async (req, res, next) => {
      // Extract token from Authorization header or legacy x-admin headers
      const bearerToken = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null;
      const headerKey = req.headers["x-admin-key"] || req.headers["x-admin-secret"] || req.query.adminKey;
      const token = bearerToken || headerKey;

      // 1. Allow localhost passthrough for local development
      const isLocalDev = token === "localhost" && (req.hostname === "localhost" || req.hostname === "127.0.0.1");
      if (isLocalDev) return next();

      // 2. Try decoding as NextAuth JWT (primary auth method)
      if (token && nextAuthSecret) {
        try {
          const payload = await decodeNextAuthJWT(token);
          if (payload && (payload.role === "admin" || payload.role === "superadmin")) {
            req.adminUser = payload;
            return next();
          }
          if (payload) {
            console.log("[Auth] Valid JWT but insufficient role:", payload.role, "for", req.method, req.originalUrl);
            return res.status(403).json({ error: "Admin role required" });
          }
        } catch (e) {
          // Not a valid JWT, fall through to static key check
        }
      }

      // 3. Fallback: static key comparison (for API integrations)
      if (token && adminKeys.includes(token)) {
        return next();
      }

      console.log("[Auth] Admin auth rejected for:", req.method, req.originalUrl);
      return res.status(403).json({ error: "Admin access required" });
    };

    console.log("[Core] Admin auth middleware configured (JWT + static key fallback)");
  }

  /**
   * Get the admin auth middleware (for site-specific routes).
   */
  get adminMiddleware() {
    return this._adminMiddleware;
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  _setupHealth() {
    const healthPath = this.config.routes.health || "/api/health";
    const siteName = this.config.site.name;

    this.app.get(healthPath, (req, res) => {
      console.log("[Health] Health check requested");
      res.json({
        status: "ok",
        app: siteName,
        timestamp: new Date().toISOString(),
        features: this.registeredFeatures,
      });
    });
  }

  // ── Service Creation ───────────────────────────────────────────────────────

  _createServices() {
    // Config service
    this._tryCreate("config", () => {
      const { createConfig } = require("@lozzalingo/config/server");
      this.services.config = createConfig({ APP_NAME: this.config.site.name });
    });

    // Logging service
    this._tryCreate("logging", () => {
      const { createLoggingService } = require("@lozzalingo/logging/server");
      this.services.logging = createLoggingService(this.prisma);
    });

    // Email service
    this._tryCreate("email", () => {
      const { createEmailService } = require("@lozzalingo/email/server");
      this.services.email = createEmailService({
        brandName: this.config.email.brandName,
        style: this.config.email.style,
      });
    });

    // Storage service
    this._tryCreate("storage", () => {
      const { createStorageService } = require("@lozzalingo/storage/server");
      this.services.storage = createStorageService();
    });

    // Outreach service (needs email)
    this._tryCreate("outreach", () => {
      if (!this.services.email) {
        console.warn("[Core] Outreach requires email service, skipping");
        return;
      }
      const { createOutreachService } = require("@lozzalingo/outreach/services/triggers");
      this.services.outreach = createOutreachService(this.prisma, this.services.email, {
        adminEmail: this.config.outreach.adminEmail,
        brandName: this.config.outreach.brandName,
        baseUrl: this.config.site.baseUrl || process.env.FRONTEND_URL,
      });
    });

    // Booking controller (needs outreach + calendar for hooks - wired later)
    // Shared hooks object - populated by _wireHooks() after all services are ready.
    // The controller references this object, so mutations in _wireHooks are picked up.
    this._bookingHooks = {};
    this._tryCreate("bookings", () => {
      const { createBookingController } = require("@lozzalingo/bookings");
      this.controllers.booking = createBookingController(this.prisma, {
        modelName: this.config.bookings.modelName,
        brandPrefix: this.config.bookings.brandPrefix,
        hooks: this._bookingHooks,
      });
    });
  }

  // ── Feature Registration ───────────────────────────────────────────────────

  _registerFeatures() {
    // Order mirrors Python framework's _register_modules()

    // Core infrastructure
    this._registerLogging();
    this._registerEmail();
    this._registerSubscribers();
    this._registerSettings();
    this._registerOps();
    this._registerStorage();
    this._registerAuth();

    // Experiences and bookings
    this._registerExperiences();
    this._registerCalendar();
    this._registerBookings();
    this._registerPayments();
    this._registerOutreach();

    // External API
    this._registerExternalApi();

    // Optional features
    this._registerAnalytics();
    this._registerMerchandise();
    this._registerOrders();
    this._registerMarketplaceSync();
    this._registerPurchases();
  }

  _registerLogging() {
    if (!this.isEnabled("logging")) return;
    this._tryRegister("logging", () => {
      const { createLoggingRoutes, createClientErrorRoutes } = require("@lozzalingo/logging/server");
      this.app.use(this.config.routes.logging, createLoggingRoutes(this.prisma));
      this.app.use(this.config.routes.clientErrors, createClientErrorRoutes(this.prisma));
    });
  }

  _registerEmail() {
    if (!this.isEnabled("email") || !this.services.email) return;
    this._tryRegister("email", () => {
      const { createEmailRoutes } = require("@lozzalingo/email/server");
      this.app.use(
        this.config.routes.email,
        createEmailRoutes(this.services.email, this.prisma)
      );
    });
  }

  _registerSubscribers() {
    if (!this.isEnabled("subscribers")) return;
    this._tryRegister("subscribers", () => {
      const { createSubscriberRoutes } = require("@lozzalingo/subscribers/server");
      this.app.use(this.config.routes.subscribers, createSubscriberRoutes(this.prisma));
    });
  }

  _registerSettings() {
    if (!this.isEnabled("settings")) return;
    this._tryRegister("settings", () => {
      const { createSettingsRoutes } = require("@lozzalingo/settings/server");
      this.app.use(
        this.config.routes.settings,
        createSettingsRoutes(this.prisma, {
          secretKey: process.env.NEXTAUTH_SECRET,
        })
      );
    });
  }

  _registerOps() {
    if (!this.isEnabled("ops")) return;
    this._tryRegister("ops", () => {
      const { createOpsRoutes } = require("@lozzalingo/ops/server");
      this.app.use(this.config.routes.ops, createOpsRoutes(this.prisma));
    });
  }

  _registerStorage() {
    if (!this.isEnabled("storage") || !this.services.storage) return;
    this._tryRegister("storage", () => {
      const { createStorageRoutes } = require("@lozzalingo/storage/server");
      this.app.use(this.config.routes.storage, createStorageRoutes(this.services.storage));
    });
  }

  _registerAuth() {
    if (!this.isEnabled("auth")) return;
    this._tryRegister("auth", () => {
      const { createAuthRoutes } = require("@lozzalingo/auth/server");
      this.app.use(
        this.config.routes.auth,
        createAuthRoutes(this.prisma, this.services.email)
      );
    });
  }

  _registerExperiences() {
    if (!this.isEnabled("experiences")) return;
    this._tryRegister("experiences", () => {
      const { createExperienceRoutes, createExperienceController } = require("@lozzalingo/experiences");
      this.controllers.experience = createExperienceController(this.prisma);
      this.app.use(
        this.config.routes.experiences,
        createExperienceRoutes(this.prisma, {
          authMiddleware: this._adminMiddleware,
        })
      );
    });
  }

  _registerCalendar() {
    if (!this.isEnabled("calendar")) return;
    this._tryRegister("calendar", () => {
      const { createCalendarRoutes } = require("@lozzalingo/calendar/routes");
      this.app.use(
        this.config.routes.calendar,
        createCalendarRoutes(this.prisma, {
          domain: this.config.calendar.domain,
          calendarName: this.config.calendar.calendarName,
        })
      );
    });
  }

  _registerBookings() {
    if (!this.isEnabled("bookings")) return;
    this._tryRegister("bookings", () => {
      const { createBookingRoutes } = require("@lozzalingo/bookings");
      this.app.use(
        this.config.routes.bookings,
        createBookingRoutes(this.prisma, {
          modelName: this.config.bookings.modelName,
          brandPrefix: this.config.bookings.brandPrefix,
          authMiddleware: this._adminMiddleware,
          hooks: this._bookingHooks,
        })
      );
    });
  }

  _registerPayments() {
    if (!this.isEnabled("payments")) return;
    this._tryRegister("payments", () => {
      const { createPaymentRoutes } = require("@lozzalingo/payments/routes");

      // Build webhook handlers (auto-wired to bookings if both enabled)
      const webhookHandlers = {};
      if (this.controllers.booking) {
        webhookHandlers["checkout.session.completed"] = async (session) => {
          const { bookingId } = session.metadata || {};
          if (bookingId) {
            console.log("[Payments] Checkout completed for booking:", bookingId);
            await this.controllers.booking.markAsPaid(
              bookingId,
              session.id,
              session.payment_intent,
              session.amount_total
            );
          }
        };
      }

      this.app.use(
        this.config.routes.payments,
        createPaymentRoutes({
          stripeSecretKey:
            this.config.payments?.stripeSecretKey || process.env.STRIPE_SECRET_KEY,
          webhookSecret:
            this.config.payments?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET,
          baseUrl: this.config.site.baseUrl || process.env.FRONTEND_URL,
          authMiddleware: this._adminMiddleware,
          webhookHandlers,
        })
      );
    });
  }

  _registerOutreach() {
    if (!this.isEnabled("outreach") || !this.services.outreach) return;
    this._tryRegister("outreach", () => {
      const { createOutreachRoutes } = require("@lozzalingo/outreach/routes");
      this.app.use(
        this.config.routes.outreach,
        createOutreachRoutes(this.prisma, {
          authMiddleware: this._adminMiddleware,
        })
      );
    });
  }

  _registerExternalApi() {
    if (!this.isEnabled("external_api")) return;
    this._tryRegister("external_api", () => {
      const { createExternalApiRoutes } = require("@lozzalingo/external-api/routes");
      const { apiRouter, adminRouter } = createExternalApiRoutes(this.prisma, {
        articleModelName: this.config.external_api?.articleModelName || "blogPost",
        authMiddleware: this._adminMiddleware,
      });
      this.app.use(this.config.routes.external_api, apiRouter);
      this.app.use(this.config.routes.external_api_admin, adminRouter);
    });
  }

  _registerAnalytics() {
    if (!this.isEnabled("analytics")) return;
    this._tryRegister("analytics", () => {
      // Analytics has both client and server components
      const analyticsPath = this.config.routes.analytics || "/api/analytics";
      console.log("[Core] Analytics registered at", analyticsPath);
      // Site-specific analytics setup can be done via lz.app
    });
  }

  _registerMerchandise() {
    if (!this.isEnabled("merchandise")) return;
    this._tryRegister("merchandise", () => {
      console.log("[Core] Merchandise feature enabled");
      // Site-specific merchandise setup
    });
  }

  _registerOrders() {
    if (!this.isEnabled("orders")) return;
    this._tryRegister("orders", () => {
      console.log("[Core] Orders feature enabled");
      // Site-specific orders setup
    });
  }

  _registerMarketplaceSync() {
    if (!this.isEnabled("marketplace_sync")) return;
    this._tryRegister("marketplace_sync", () => {
      console.log("[Core] Marketplace sync feature enabled");
    });
  }

  _registerPurchases() {
    if (!this.isEnabled("purchases")) return;
    this._tryRegister("purchases", () => {
      console.log("[Core] Purchases feature enabled");
    });
  }

  // ── Cross-Package Hooks ────────────────────────────────────────────────────

  _wireHooks() {
    // Wire bookings -> outreach + calendar (same pattern every site uses)
    if (this.controllers.booking && this.services.outreach) {
      console.log("[Core] Wiring bookings -> outreach hooks");

      const outreach = this.services.outreach;
      const prisma = this.prisma;

      // Dynamically import calendar slot functions if calendar is enabled
      let bookSlot, releaseSlot, createAndBlockSlot, checkTimeWindowAvailable;
      if (this.isEnabled("calendar")) {
        try {
          const slots = require("@lozzalingo/calendar/services/slots");
          bookSlot = slots.bookSlot;
          releaseSlot = slots.releaseSlot;
        } catch (e) {
          console.warn("[Core] Calendar slots not available:", e.message);
        }
        try {
          const timeSlots = require("@lozzalingo/calendar/services/time-slots");
          createAndBlockSlot = timeSlots.createAndBlockSlot;
          checkTimeWindowAvailable = timeSlots.checkTimeWindowAvailable;
        } catch (e) {
          console.warn("[Core] Calendar time-slots not available:", e.message);
        }
      }

      /**
       * Parse a booking's eventDate + eventTime + duration into start/end Date objects.
       * Handles both "HH:MM" and "HH:MM - HH:MM" formats for eventTime.
       */
      /**
       * Parse a booking's eventDate + eventTime + duration into start/end Date objects.
       * Handles both "HH:MM" and "HH:MM - HH:MM" formats for eventTime.
       * Times are always interpreted as Europe/London to avoid UTC/BST drift
       * between local dev (BST) and Docker (UTC).
       */
      function parseBookingTimeWindow(booking) {
        if (!booking.eventDate || !booking.eventTime) return null;
        const dateStr = new Date(booking.eventDate).toISOString().split("T")[0];

        // Convert a London wall-clock time to a UTC Date.
        // e.g. "14:00" on 2026-06-10 in London (BST, UTC+1) -> 13:00 UTC
        function londonToUTC(date, hours, minutes) {
          // Start with a UTC guess
          const utcGuess = new Date(`${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`);
          // Check what London wall-clock time this UTC corresponds to
          const formatter = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/London",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          const londonTime = formatter.format(utcGuess);
          const [londonH, londonM] = londonTime.split(":").map(Number);
          // Adjust by the difference to get the correct UTC
          const offsetMs = ((londonH - hours) * 60 + (londonM - minutes)) * 60 * 1000;
          return new Date(utcGuess.getTime() - offsetMs);
        }

        // Try range format first: "10:00 - 13:00"
        const rangeMatch = booking.eventTime.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (rangeMatch) {
          const startTime = londonToUTC(dateStr, parseInt(rangeMatch[1]), parseInt(rangeMatch[2]));
          const endTime = londonToUTC(dateStr, parseInt(rangeMatch[3]), parseInt(rangeMatch[4]));
          return { startTime, endTime };
        }

        // Simple format: "10:00" - needs duration to calculate end
        const simpleMatch = booking.eventTime.match(/^(\d{1,2}):(\d{2})$/);
        if (simpleMatch && booking.duration) {
          const durationMinutes = Math.round(parseFloat(booking.duration) * 60);
          const startTime = londonToUTC(dateStr, parseInt(simpleMatch[1]), parseInt(simpleMatch[2]));
          const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
          return { startTime, endTime };
        }

        return null;
      }

      // Populate the shared hooks object - both the controller and routes
      // reference the same object, so mutations here take effect everywhere.
      const bookingModelName = this.config.bookings.modelName || "booking";
      let stripe = null;
      if (this.isEnabled("payments")) {
        const stripeSecretKey =
          this.config.payments?.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
        if (stripeSecretKey) {
          try {
            const Stripe = require("stripe");
            stripe = new Stripe(stripeSecretKey);
          } catch (stripeErr) {
            console.warn("[Bookings] Stripe client unavailable for payment checks:", stripeErr.message);
          }
        }
      }

      // Enrich a booking with product name and location details for email templates
      async function enrichBooking(booking) {
        const enriched = { ...booking };
        try {
          if (booking.productId) {
            const product = await prisma.product.findUnique({ where: { id: booking.productId } });
            if (product) enriched.productName = product.name;
          }
          // Look up location details from taskSections or locationName
          const sections = booking.taskSections ? JSON.parse(booking.taskSections) : [];
          const locationSection = sections.find((s) => s.type === "location");
          const locationSlug = locationSection?.locationSlug;
          if (locationSlug) {
            const location = await prisma.location.findFirst({ where: { slug: locationSlug } });
            if (location) {
              enriched.locationStartPoint = location.startPoint;
              enriched.locationStartPointUrl = location.startPointUrl;
              enriched.locationEndPoint = location.endPoint;
              enriched.locationEndPointUrl = location.endPointUrl;
              enriched.locationRouteType = location.routeType;
              if (!enriched.locationName) enriched.locationName = location.name;
            }
          } else if (booking.locationName && !locationSlug) {
            const location = await prisma.location.findFirst({ where: { name: booking.locationName } });
            if (location) {
              enriched.locationStartPoint = location.startPoint;
              enriched.locationStartPointUrl = location.startPointUrl;
              enriched.locationEndPoint = location.endPoint;
              enriched.locationEndPointUrl = location.endPointUrl;
              enriched.locationRouteType = location.routeType;
            }
          }
        } catch (err) {
          console.error("[Bookings] Failed to enrich booking data:", err.message);
        }
        return enriched;
      }

      Object.assign(this._bookingHooks, {
        // Pre-creation availability check - rejects if time slot is already taken
        onCheckAvailability: async (bookingData) => {
          if (!checkTimeWindowAvailable || !bookingData.eventDate || !bookingData.eventTime) {
            return { available: true };
          }
          const window = parseBookingTimeWindow(bookingData);
          if (!window) return { available: true };
          console.log(`[Bookings] Checking availability: ${window.startTime.toISOString()} - ${window.endTime.toISOString()}`);
          // Buffer is already baked into stored slot times, so no additional
          // travel buffer needed for the availability check
          const result = await checkTimeWindowAvailable(prisma, window.startTime, window.endTime, {
            travelBufferMinutes: 0,
          });
          if (!result.available) {
            console.log(`[Bookings] Time slot NOT available - ${result.conflicts.length} conflict(s)`);
          }
          return result;
        },

        onCreated: async (booking) => {
          console.log("[Bookings] Booking created:", booking.bookingNumber);

          // Calendar slot creation rules:
          // - ENQUIRY bookings: NO slot (they haven't committed to a time)
          // - Bookings going to checkout (INVOICE_SENT): PENCILLED for 5 mins
          // - Already confirmed/paid (admin-created): BOOKED immediately
          const isPaid = ["PAID", "CONFIRMED", "DEPOSIT_PAID", "COMPLETED"].includes(booking.status);
          const isEnquiry = booking.status === "ENQUIRY";
          const shouldCreateSlot = !isEnquiry && createAndBlockSlot && booking.eventDate && booking.eventTime;

          if (shouldCreateSlot) {
            try {
              const window = parseBookingTimeWindow(booking);
              if (window) {
                const slotStatus = isPaid ? "BOOKED" : "PENCILLED";

                // Apply buffer to stored calendar event times so the calendar
                // displays the full blocked window (buffer + event + buffer).
                // bufferHours is a legacy field name that stores minutes.
                const bufferMs = (booking.timeBlocking === "buffer" && booking.bufferHours)
                  ? booking.bufferHours * 60 * 1000
                  : 0;
                const slotStart = new Date(window.startTime.getTime() - bufferMs);
                const slotEnd = new Date(window.endTime.getTime() + bufferMs);

                console.log(`[Bookings] Creating ${slotStatus} calendar slot for ${booking.bookingNumber}: ${slotStart.toISOString()} - ${slotEnd.toISOString()} (buffer: ${booking.bufferHours || 0}m)`);
                // Buffer is already baked into the slot times, so set travelBuffer to 0
                // to avoid double-counting in the availability check
                const bufferOpts = { travelBufferMinutes: 0 };

                const result = await createAndBlockSlot(prisma, {
                  title: `${booking.customerName} - ${booking.bookingNumber}`,
                  startTime: slotStart,
                  endTime: slotEnd,
                  bookingId: booking.id,
                  productId: booking.productId || null,
                  locationName: booking.locationName || null,
                  timeBlockingMode: booking.timeBlocking || "buffer",
                  slotStatus,
                }, bufferOpts);

                if (result.success && result.slot) {
                  // Store buffer-inclusive slot times in London wall-clock format
                  const timeFmt = new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false,
                  });
                  const [sh, sm] = timeFmt.format(slotStart).split(":");
                  const [eh, em] = timeFmt.format(slotEnd).split(":");
                  await prisma[bookingModelName].update({
                    where: { id: booking.id },
                    data: {
                      calendarEventId: result.slot.id,
                      slotStartTime: `${sh}:${sm}`,
                      slotEndTime: `${eh}:${em}`,
                    },
                  });
                  console.log(`[Bookings] Calendar slot linked to booking ${booking.bookingNumber}: ${result.slot.id}`);
                } else {
                  console.warn(`[Bookings] Calendar slot not created for ${booking.bookingNumber}: ${result.reason || "unknown"}`);
                }
              }
            } catch (calErr) {
              console.error("[Bookings] Failed to create calendar slot:", calErr.message);
            }
          }

          await outreach.trigger("booking_created", booking);
        },
        onStatusChanged: async (booking, oldStatus) => {
          if (oldStatus === booking.status) return;

          if (booking.status === "PAID") {
            await this._bookingHooks.onPaid?.(booking);
          }

          if (booking.status === "CANCELLED") {
            await this._bookingHooks.onCancelled?.(booking);
          }
        },
        onCheckPayment: async (booking) => {
          if (!stripe) {
            return { paid: false, reason: "Stripe is not configured" };
          }

          if (booking.stripeSessionId) {
            const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
            const paid = session.payment_status === "paid";
            return {
              paid,
              paymentStatus: session.payment_status,
              amountPaid: session.amount_total,
              stripeSessionId: session.id,
              stripePaymentId: session.payment_intent || null,
              message: paid ? "Payment received" : "Stripe Checkout session is not paid yet",
            };
          }

          if (booking.stripePaymentId) {
            const paymentIntent = await stripe.paymentIntents.retrieve(booking.stripePaymentId);
            const paid = paymentIntent.status === "succeeded";
            return {
              paid,
              paymentStatus: paymentIntent.status,
              amountPaid: paymentIntent.amount_received || paymentIntent.amount,
              stripePaymentId: paymentIntent.id,
              message: paid ? "Payment received" : "Stripe payment is not complete yet",
            };
          }

          // Check Invoice model for any sent invoices linked to this booking
          if (stripe.invoices?.search) {
            const sentInvoices = await prisma.invoice.findMany({
              where: { bookingId: booking.id, status: "SENT", invoiceNumber: { not: null } },
              orderBy: { createdAt: "desc" },
            });

            for (const inv of sentInvoices) {
              const escapedNumber = String(inv.invoiceNumber).replace(/'/g, "\\'");
              const stripeInvoices = await stripe.invoices.search({
                query: `number:'${escapedNumber}'`,
                limit: 1,
              });
              const stripeInvoice = stripeInvoices.data?.[0];
              if (stripeInvoice) {
                const paid = stripeInvoice.status === "paid" || stripeInvoice.paid === true;
                if (paid) {
                  // Mark the local invoice as paid too
                  await prisma.invoice.update({
                    where: { id: inv.id },
                    data: { status: "PAID", paidAt: new Date() },
                  });
                  console.log(`[Bookings] Invoice ${inv.invoiceNumber} marked as paid`);
                }
                return {
                  paid,
                  paymentStatus: stripeInvoice.status,
                  amountPaid: stripeInvoice.amount_paid,
                  stripePaymentId: stripeInvoice.payment_intent || null,
                  message: paid ? "Payment received" : `Stripe invoice ${inv.invoiceNumber} is not paid yet`,
                };
              }
            }
          }

          // Check if there are any invoices at all for this booking
          const invoiceCount = await prisma.invoice.count({ where: { bookingId: booking.id } });
          const missing = [
            !booking.stripeSessionId && "stripeSessionId",
            !booking.stripePaymentId && "stripePaymentId",
            invoiceCount === 0 && "no invoices",
          ].filter(Boolean);
          console.log(`[Bookings] Check payment failed for ${booking.bookingNumber} - ${missing.join(", ")}`);
          return {
            paid: false,
            reason: invoiceCount > 0
              ? "Invoices exist but none have been paid via Stripe yet."
              : `No Stripe session, payment intent, or invoices found. Send an invoice or process a payment first.`,
          };
        },
        onCheckInvoicePayment: async (booking, invoice) => {
          if (!stripe) {
            return { paid: false, reason: "Stripe is not configured" };
          }

          if (!invoice.invoiceNumber) {
            return { paid: false, reason: "Invoice has no Stripe invoice number" };
          }

          console.log(`[Bookings] Checking Stripe payment for invoice ${invoice.invoiceNumber}`);

          if (stripe.invoices?.search) {
            const escapedNumber = String(invoice.invoiceNumber).replace(/'/g, "\\'");
            const stripeInvoices = await stripe.invoices.search({
              query: `number:'${escapedNumber}'`,
              limit: 1,
            });
            const stripeInvoice = stripeInvoices.data?.[0];
            if (stripeInvoice) {
              const paid = stripeInvoice.status === "paid" || stripeInvoice.paid === true;
              return {
                paid,
                paymentStatus: stripeInvoice.status,
                amountPaid: stripeInvoice.amount_paid,
                stripePaymentId: stripeInvoice.payment_intent || null,
                message: paid ? "Payment received" : `Invoice ${invoice.invoiceNumber} is not paid yet`,
              };
            }
          }

          return { paid: false, reason: `Invoice ${invoice.invoiceNumber} not found in Stripe` };
        },
        onPaid: async (booking) => {
          console.log("[Bookings] Booking paid:", booking.bookingNumber);
          if (booking.calendarEventId && bookSlot) {
            await bookSlot(prisma, "calendarEvent", booking.calendarEventId, booking.id);
          }
          const enriched = await enrichBooking(booking);
          await outreach.trigger("booking_paid", enriched);
          await outreach.trigger("booking_paid_admin", enriched);
          await outreach.cancelScheduled(booking.id, "enquiry_followup_3day");
        },
        onCancelled: async (booking) => {
          console.log("[Bookings] Booking cancelled:", booking.bookingNumber);
          if (booking.calendarEventId && releaseSlot) {
            await releaseSlot(prisma, "calendarEvent", booking.calendarEventId);
          }
          await outreach.trigger("booking_cancelled", booking);
          await outreach.cancelScheduled(booking.id);
        },
        onResendConfirmation: async (booking, opts) => {
          const isTest = !!opts?.test;
          console.log(`[Bookings] ${isTest ? "Test c" : "C"}onfirmation resend for:`, booking.bookingNumber);

          const enriched = await enrichBooking(booking);
          if (isTest) {
            const adminEmail = process.env.ADMIN_EMAIL;
            if (!adminEmail) throw new Error("No ADMIN_EMAIL set - cannot send test confirmation");
            await outreach.trigger("booking_paid", { ...enriched, customerEmail: adminEmail });
            await outreach.trigger("booking_paid_admin", enriched);
          } else {
            await outreach.trigger("booking_paid", enriched);
            await outreach.trigger("booking_paid_admin", enriched);
          }
        },
        onSendInvoice: async (booking, opts) => {
          function formatPence(p) { return `\u00a3${(p / 100).toFixed(2)}`; }

          const isTest = !!opts?.test;
          console.log(`[Bookings] ${isTest ? "Test i" : "I"}nvoice trigger for:`, booking.bookingNumber);

          const productName = booking.productId
            ? (await prisma.product.findUnique({ where: { id: booking.productId } }))?.name || "Scavenger Hunt"
            : "Scavenger Hunt";

          const { createFullInvoice } = require("@lozzalingo/payments/services/invoicing");

          // Use line items from opts (new multi-invoice flow) or fall back to booking amount (legacy)
          let lineItems;
          if (opts?.lineItems && opts.lineItems.length > 0) {
            lineItems = opts.lineItems.map((item) => ({
              description: item.name || item.description,
              unitPricePence: item.unitPricePence,
              quantity: item.quantity,
            }));
            console.log(`[Bookings] Using ${lineItems.length} custom line items`);
          } else {
            const amountPence = booking.quotedPrice || booking.totalAmount;
            if (!amountPence || amountPence <= 0) {
              console.error("[Bookings] Cannot create invoice - no amount set on booking");
              throw new Error("No amount set on booking. Set Total or Quoted price first.");
            }
            lineItems = [
              {
                description: `${productName} - ${booking.groupSize} players`,
                unitPricePence: amountPence,
                quantity: 1,
              },
            ];
          }

          if (isTest) {
            // Test mode: create a real Stripe invoice on the TEST account, send email to admin
            const adminEmail = process.env.ADMIN_EMAIL;
            if (!adminEmail) {
              throw new Error("No ADMIN_EMAIL set - cannot send test invoice");
            }

            const testKey = process.env.STRIPE_TEST_SECRET_KEY;
            if (!testKey) {
              throw new Error("No STRIPE_TEST_SECRET_KEY set - cannot create test invoice");
            }

            const Stripe = require("stripe");
            const testStripe = new Stripe(testKey);

            const totalPence = lineItems.reduce((s, i) => s + (i.unitPricePence * i.quantity), 0);
            console.log(`[Bookings] Creating TEST Stripe invoice for ${adminEmail} - ${formatPence(totalPence)}`);

            const invoice = await createFullInvoice(testStripe, {
              customerEmail: adminEmail,
              customerName: `[TEST] ${booking.customerName}`,
              customerPhone: booking.customerPhone,
              companyName: booking.companyName,
              productName,
              lineItems,
              daysUntilDue: 7,
              metadata: {
                bookingId: booking.id,
                bookingNumber: booking.bookingNumber,
                test: "true",
              },
            });

            // Send invoice email to admin via outreach (do not update booking)
            await outreach.trigger("invoice_email", {
              ...booking,
              invoiceNumber: invoice.number,
              amountDuePence: invoice.amount_due,
              hostedInvoiceUrl: invoice.hosted_invoice_url,
              customerEmail: adminEmail,
              productName,
            });

            console.log(`[Bookings] Test invoice ${invoice.number} sent to ${adminEmail} - ${invoice.hosted_invoice_url}`);
            return {
              stripeInvoiceId: invoice.id,
              invoiceNumber: invoice.number,
              hostedInvoiceUrl: invoice.hosted_invoice_url,
            };
          }

          // Live mode: create real Stripe invoice and email the customer
          if (!stripe) {
            throw new Error("Stripe is not configured");
          }

          if (!booking.customerEmail) {
            throw new Error("No customer email on booking");
          }

          const totalPence = lineItems.reduce((s, i) => s + (i.unitPricePence * i.quantity), 0);
          console.log(`[Bookings] Creating Stripe invoice for ${booking.customerEmail} - ${formatPence(totalPence)}`);

          const invoice = await createFullInvoice(stripe, {
            customerEmail: booking.customerEmail,
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
            companyName: booking.companyName,
            productName,
            lineItems,
            daysUntilDue: 7,
            metadata: {
              bookingId: booking.id,
              bookingNumber: booking.bookingNumber,
            },
          });

          // Send invoice email to customer via outreach
          await outreach.trigger("invoice_email", {
            ...booking,
            invoiceNumber: invoice.number,
            amountDuePence: invoice.amount_due,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            customerEmail: booking.customerEmail,
            productName,
          });

          console.log(`[Bookings] Invoice ${invoice.number} sent to ${booking.customerEmail} - ${invoice.hosted_invoice_url}`);

          return {
            stripeInvoiceId: invoice.id,
            invoiceNumber: invoice.number,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
          };
        },
      });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Try to create a service. Logs and continues if the package is not installed.
   */
  _tryCreate(name, factory) {
    if (!this.isEnabled(name)) return;
    try {
      factory();
    } catch (err) {
      if (err.code === "MODULE_NOT_FOUND") {
        console.warn(`[Core] Package for '${name}' not installed, skipping service`);
      } else {
        console.error(`[Core] Failed to create '${name}' service:`, err.message);
      }
    }
  }

  /**
   * Try to register a feature's routes. Logs and continues on failure.
   */
  _tryRegister(name, registrar) {
    try {
      registrar();
      this.registeredFeatures.push(name);
      console.log(`[Core] Registered: ${name}`);
    } catch (err) {
      if (err.code === "MODULE_NOT_FOUND") {
        console.warn(`[Core] Package for '${name}' not installed, skipping`);
      } else {
        console.error(`[Core] Failed to register '${name}':`, err.message);
      }
    }
  }

  /**
   * Get the list of registered features.
   */
  getRegisteredFeatures() {
    return [...this.registeredFeatures];
  }
}

/**
 * Functional shorthand: createLozzalingo(app, prisma, config?)
 */
function createLozzalingo(app, prisma, config) {
  return new Lozzalingo(app, prisma, config);
}

module.exports = { Lozzalingo, createLozzalingo };
