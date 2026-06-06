/**
 * Marketplace Sync Engine
 * Orchestrates push/pull operations across all enabled platforms
 */

const { EventbriteAdapter } = require("./adapters/eventbrite");
const { DesignMyNightAdapter } = require("./adapters/designmynight");
const { GrouponAdapter } = require("./adapters/groupon");
const { WowcherAdapter } = require("./adapters/wowcher");
const { FeverAdapter } = require("./adapters/fever");

const ADAPTERS = {
  EVENTBRITE: EventbriteAdapter,
  DESIGN_MY_NIGHT: DesignMyNightAdapter,
  GROUPON: GrouponAdapter,
  WOWCHER: WowcherAdapter,
  FEVER: FeverAdapter,
};

class SyncEngine {
  constructor(prisma, config = {}) {
    this.prisma = prisma;
    this.config = config;
    this.adapters = {};

    // Initialize adapters for configured platforms
    for (const [platform, AdapterClass] of Object.entries(ADAPTERS)) {
      const platformConfig = config[platform.toLowerCase()] || {};
      if (platformConfig.enabled || platformConfig.apiKey || platformConfig.apiToken) {
        this.adapters[platform] = new AdapterClass(platformConfig);
        console.log(`[MarketplaceSync] Initialized ${platform} adapter`);
      }
    }
  }

  /**
   * Push an experience to all enabled platforms (or specific ones)
   */
  async pushExperience(experienceId, platforms = null) {
    const experience = await this.prisma.experience.findUnique({
      where: { id: experienceId },
      include: { provider: true },
    });

    if (!experience) {
      console.error("[MarketplaceSync] Experience not found:", experienceId);
      return { success: false, error: "Experience not found" };
    }

    // Get calendar events for this experience
    let calendarEvent = null;
    try {
      calendarEvent = await this.prisma.calendarEvent.findFirst({
        where: {
          experienceId,
          status: { in: ["SCHEDULED", "LIVE"] },
          startTime: { gte: new Date() },
        },
        orderBy: { startTime: "asc" },
      });
    } catch {
      // CalendarEvent may not exist in all schemas
    }

    const targetPlatforms = platforms || Object.keys(this.adapters);
    const results = {};

    for (const platform of targetPlatforms) {
      const adapter = this.adapters[platform];
      if (!adapter) {
        results[platform] = { success: false, error: "Adapter not configured" };
        continue;
      }

      // Check for existing listing
      const existing = await this.prisma.marketplaceListing.findFirst({
        where: { experienceId, platform },
      });

      let result;
      if (existing?.externalId) {
        // Update existing
        result = await adapter.update(existing.externalId, experience, calendarEvent);
        if (result.success) {
          await this.prisma.marketplaceListing.update({
            where: { id: existing.id },
            data: { syncedAt: new Date(), syncErrors: null, status: "LIVE" },
          });
        } else {
          await this.prisma.marketplaceListing.update({
            where: { id: existing.id },
            data: { syncErrors: result.error },
          });
        }
      } else {
        // Create new
        result = await adapter.push(experience, calendarEvent);
        if (result.success) {
          await this.prisma.marketplaceListing.upsert({
            where: { id: existing?.id || "new" },
            create: {
              experienceId,
              platform,
              externalId: result.externalId,
              externalUrl: result.externalUrl,
              status: "LIVE",
              syncedAt: new Date(),
            },
            update: {
              externalId: result.externalId,
              externalUrl: result.externalUrl,
              status: "LIVE",
              syncedAt: new Date(),
              syncErrors: null,
            },
          });
        } else if (!existing) {
          await this.prisma.marketplaceListing.create({
            data: {
              experienceId,
              platform,
              status: "DRAFT",
              syncErrors: result.error,
            },
          });
        }
      }

      results[platform] = result;
    }

    console.log("[MarketplaceSync] Push results for", experience.title, ":", results);
    return { success: true, results };
  }

  /**
   * Remove an experience from all platforms
   */
  async removeExperience(experienceId, platforms = null) {
    const listings = await this.prisma.marketplaceListing.findMany({
      where: {
        experienceId,
        ...(platforms ? { platform: { in: platforms } } : {}),
        externalId: { not: null },
      },
    });

    const results = {};

    for (const listing of listings) {
      const adapter = this.adapters[listing.platform];
      if (!adapter) continue;

      const result = await adapter.remove(listing.externalId);
      if (result.success) {
        await this.prisma.marketplaceListing.update({
          where: { id: listing.id },
          data: { status: "REMOVED", syncedAt: new Date() },
        });
      }

      results[listing.platform] = result;
    }

    console.log("[MarketplaceSync] Remove results:", results);
    return { success: true, results };
  }

  /**
   * Pull bookings from all platforms for an experience
   */
  async pullBookings(experienceId) {
    const listings = await this.prisma.marketplaceListing.findMany({
      where: {
        experienceId,
        status: "LIVE",
        externalId: { not: null },
      },
    });

    const allBookings = [];

    for (const listing of listings) {
      const adapter = this.adapters[listing.platform];
      if (!adapter) continue;

      const result = await adapter.pullBookings(listing.externalId);
      if (result.success) {
        for (const booking of result.bookings) {
          allBookings.push({
            ...booking,
            platform: listing.platform,
            experienceId,
          });
        }
        await this.prisma.marketplaceListing.update({
          where: { id: listing.id },
          data: { syncedAt: new Date() },
        });
      }
    }

    console.log("[MarketplaceSync] Pulled", allBookings.length, "bookings total");
    return { success: true, bookings: allBookings };
  }

  /**
   * Get sync status for all marketplace listings
   */
  async getStatus(experienceId = null) {
    const where = experienceId ? { experienceId } : {};
    const listings = await this.prisma.marketplaceListing.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return listings.map((l) => ({
      id: l.id,
      experienceId: l.experienceId,
      platform: l.platform,
      status: l.status,
      externalId: l.externalId,
      externalUrl: l.externalUrl,
      syncedAt: l.syncedAt,
      syncErrors: l.syncErrors,
    }));
  }
}

module.exports = { SyncEngine, ADAPTERS };
