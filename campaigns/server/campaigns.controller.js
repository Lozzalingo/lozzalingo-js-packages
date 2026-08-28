/**
 * Campaign Controller
 *
 * All route handlers for campaign CRUD, sending, engagement tracking,
 * and subscriber hygiene.
 */

const { renderBlocks } = require("./block-renderer");
const { createCampaignService } = require("./campaigns.service");
const {
  TRANSPARENT_GIF,
  validateTrackingId,
} = require("./tracking");

/**
 * Create campaign controller.
 *
 * @param {object} prisma - PrismaClient instance
 * @param {object} emailService - Email service from @lozzalingo/email
 * @param {object} options
 */
function createCampaignsController(prisma, emailService, options = {}) {
  const {
    trackingSecret = process.env.NEXTAUTH_SECRET || "default-secret",
    inactiveThreshold = 3,
  } = options;

  const campaignService = createCampaignService(prisma, emailService, options);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const listCampaigns = async (req, res) => {
    try {
      const campaigns = await prisma.campaign.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { sends: true } } },
      });

      res.json({
        campaigns: campaigns.map((c) => ({
          ...c,
          blocks: typeof c.blocks === "string" ? JSON.parse(c.blocks) : c.blocks,
          totalSends: c._count.sends,
        })),
      });
    } catch (error) {
      console.error("[Campaigns] List error:", error.message);
      res.status(500).json({ error: "Failed to list campaigns" });
    }
  };

  const getCampaign = async (req, res) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
        include: {
          sends: {
            orderBy: { sentAt: "desc" },
            take: 50,
            select: {
              id: true,
              recipientEmail: true,
              sentAt: true,
              status: true,
              openedAt: true,
              openCount: true,
            },
          },
        },
      });

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      res.json({
        ...campaign,
        blocks: typeof campaign.blocks === "string" ? JSON.parse(campaign.blocks) : campaign.blocks,
      });
    } catch (error) {
      console.error("[Campaigns] Get error:", error.message);
      res.status(500).json({ error: "Failed to get campaign" });
    }
  };

  const createCampaign = async (req, res) => {
    try {
      const { name, subject, blocks, trigger, isActive } = req.body;

      if (!name || !subject) {
        return res.status(400).json({ error: "Name and subject are required" });
      }

      const campaign = await prisma.campaign.create({
        data: {
          name,
          subject,
          blocks: JSON.stringify(blocks || []),
          trigger: trigger || "manual",
          isActive: isActive !== false,
        },
      });

      console.log("[Campaigns] Created campaign:", campaign.id, campaign.name);
      res.status(201).json({
        ...campaign,
        blocks: blocks || [],
      });
    } catch (error) {
      console.error("[Campaigns] Create error:", error.message);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  };

  const updateCampaign = async (req, res) => {
    try {
      const { name, subject, blocks, trigger, isActive } = req.body;

      const existing = await prisma.campaign.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const data = {};
      if (name !== undefined) data.name = name;
      if (subject !== undefined) data.subject = subject;
      if (blocks !== undefined) data.blocks = JSON.stringify(blocks);
      if (trigger !== undefined) data.trigger = trigger;
      if (isActive !== undefined) data.isActive = isActive;

      const campaign = await prisma.campaign.update({
        where: { id: req.params.id },
        data,
      });

      console.log("[Campaigns] Updated campaign:", campaign.id);
      res.json({
        ...campaign,
        blocks: typeof campaign.blocks === "string" ? JSON.parse(campaign.blocks) : campaign.blocks,
      });
    } catch (error) {
      console.error("[Campaigns] Update error:", error.message);
      res.status(500).json({ error: "Failed to update campaign" });
    }
  };

  const deleteCampaign = async (req, res) => {
    try {
      const { id } = req.params;

      // Cascading delete: clicks, sends, then campaign
      await prisma.$transaction([
        prisma.campaignClick.deleteMany({ where: { campaignId: id } }),
        prisma.campaignSend.deleteMany({ where: { campaignId: id } }),
        prisma.campaign.delete({ where: { id } }),
      ]);

      console.log("[Campaigns] Deleted campaign:", id);
      res.json({ success: true });
    } catch (error) {
      console.error("[Campaigns] Delete error:", error.message);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  };

  const duplicateCampaign = async (req, res) => {
    try {
      const original = await prisma.campaign.findUnique({
        where: { id: req.params.id },
      });

      if (!original) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const copy = await prisma.campaign.create({
        data: {
          name: `${original.name} (Copy)`,
          subject: original.subject,
          blocks: original.blocks,
          trigger: original.trigger,
          isActive: false,
        },
      });

      console.log("[Campaigns] Duplicated campaign:", original.id, "->", copy.id);
      res.status(201).json({
        ...copy,
        blocks: typeof copy.blocks === "string" ? JSON.parse(copy.blocks) : copy.blocks,
      });
    } catch (error) {
      console.error("[Campaigns] Duplicate error:", error.message);
      res.status(500).json({ error: "Failed to duplicate campaign" });
    }
  };

  // ── Sending ─────────────────────────────────────────────────────────────────

  const sendCampaign = async (req, res) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
      });

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const result = await campaignService.sendToAllSubscribers(campaign);
      res.json(result);
    } catch (error) {
      console.error("[Campaigns] Send error:", error.message);
      res.status(500).json({ error: "Failed to send campaign" });
    }
  };

  const sendTestCampaign = async (req, res) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
      });

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const email =
        req.body.email ||
        process.env.ADMIN_EMAIL ||
        "laurencedotcomputer@gmail.com";

      const result = await campaignService.sendToRecipient(campaign, email);
      res.json({ success: result, sentTo: email });
    } catch (error) {
      console.error("[Campaigns] Test send error:", error.message);
      res.status(500).json({ error: "Failed to send test" });
    }
  };

  // ── Preview & Variables ─────────────────────────────────────────────────────

  const previewBlocks = async (req, res) => {
    try {
      const { blocks } = req.body;
      const vars = campaignService.resolvePreviewVariables();
      const html = renderBlocks(blocks || [], vars, options.style);
      res.json({ html });
    } catch (error) {
      console.error("[Campaigns] Preview error:", error.message);
      res.status(500).json({ error: "Failed to render preview" });
    }
  };

  const getVariables = async (req, res) => {
    try {
      const builtIn = [
        { name: "EMAIL", description: "Recipient email address", preview_value: "subscriber@example.com" },
        { name: "UNSUBSCRIBE_URL", description: "Unsubscribe link", preview_value: "#" },
      ];

      const custom = (options.variables || []).map((v) => ({
        name: v.name,
        description: v.description || "",
        preview_value: v.preview_value || "",
      }));

      res.json({ variables: [...builtIn, ...custom] });
    } catch (error) {
      console.error("[Campaigns] Variables error:", error.message);
      res.status(500).json({ error: "Failed to get variables" });
    }
  };

  // ── Subscriber counts & hygiene ─────────────────────────────────────────────

  const getSubscriberCount = async (req, res) => {
    try {
      const count = await prisma.subscriber.count({
        where: { optIn: true },
      });
      res.json({ count });
    } catch (error) {
      console.error("[Campaigns] Subscriber count error:", error.message);
      res.status(500).json({ error: "Failed to get subscriber count" });
    }
  };

  const getCampaignStats = async (req, res) => {
    try {
      const { id } = req.params;

      const totalSent = await prisma.campaignSend.count({
        where: { campaignId: id },
      });

      const delivered = await prisma.campaignSend.count({
        where: { campaignId: id, status: "sent" },
      });

      const failed = await prisma.campaignSend.count({
        where: { campaignId: id, status: "failed" },
      });

      const uniqueOpens = await prisma.campaignSend.count({
        where: { campaignId: id, openedAt: { not: null } },
      });

      const totalOpensAgg = await prisma.campaignSend.aggregate({
        _sum: { openCount: true },
        where: { campaignId: id },
      });

      const totalClicks = await prisma.campaignClick.count({
        where: { campaignId: id },
      });

      const uniqueClickers = await prisma.campaignClick.groupBy({
        by: ["recipientEmail"],
        where: { campaignId: id },
      });

      // Top links
      const clicksByUrl = await prisma.campaignClick.groupBy({
        by: ["url"],
        where: { campaignId: id },
        _count: { url: true },
        orderBy: { _count: { url: "desc" } },
        take: 10,
      });

      const openRate = delivered > 0 ? ((uniqueOpens / delivered) * 100).toFixed(1) : "0.0";
      const clickRate = delivered > 0 ? ((uniqueClickers.length / delivered) * 100).toFixed(1) : "0.0";

      res.json({
        totalSent,
        delivered,
        failed,
        uniqueOpens,
        totalOpens: totalOpensAgg._sum.openCount || 0,
        uniqueClickers: uniqueClickers.length,
        totalClicks,
        openRate,
        clickRate,
        topLinks: clicksByUrl.map((c) => ({ url: c.url, clicks: c._count.url })),
      });
    } catch (error) {
      console.error("[Campaigns] Stats error:", error.message);
      res.status(500).json({ error: "Failed to get campaign stats" });
    }
  };

  const getInactiveSubscribers = async (req, res) => {
    try {
      const threshold = parseInt(req.query.min_campaigns) || inactiveThreshold;

      // Find subscribers who received N+ campaigns but never opened any
      const subscribers = await prisma.subscriber.findMany({
        where: { optIn: true },
        select: { email: true, createdAt: true },
      });

      const inactive = [];

      for (const sub of subscribers) {
        const sendCount = await prisma.campaignSend.count({
          where: { recipientEmail: sub.email },
        });

        if (sendCount < threshold) continue;

        const openedCount = await prisma.campaignSend.count({
          where: { recipientEmail: sub.email, openedAt: { not: null } },
        });

        if (openedCount === 0) {
          const lastSend = await prisma.campaignSend.findFirst({
            where: { recipientEmail: sub.email },
            orderBy: { sentAt: "desc" },
            select: { sentAt: true },
          });

          inactive.push({
            email: sub.email,
            subscribedAt: sub.createdAt,
            campaignsReceived: sendCount,
            lastSentAt: lastSend?.sentAt || null,
          });
        }
      }

      res.json({ inactive, count: inactive.length, threshold });
    } catch (error) {
      console.error("[Campaigns] Inactive subscribers error:", error.message);
      res.status(500).json({ error: "Failed to get inactive subscribers" });
    }
  };

  const deactivateInactive = async (req, res) => {
    try {
      const { emails } = req.body;

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ error: "emails array is required" });
      }

      const result = await prisma.subscriber.updateMany({
        where: { email: { in: emails }, optIn: true },
        data: { optIn: false },
      });

      console.log(`[Campaigns] Deactivated ${result.count} inactive subscribers`);
      res.json({ deactivated: result.count });
    } catch (error) {
      console.error("[Campaigns] Deactivate error:", error.message);
      res.status(500).json({ error: "Failed to deactivate subscribers" });
    }
  };

  // ── Engagement Tracking (public) ────────────────────────────────────────────

  const trackOpen = async (req, res) => {
    // Always return the GIF, even if tracking fails
    res.set({
      "Content-Type": "image/gif",
      "Content-Length": TRANSPARENT_GIF.length,
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
    });

    try {
      const { trackingId } = req.params;
      const decoded = validateTrackingId(trackingId, trackingSecret);

      if (decoded.valid) {
        // Update the send record: set openedAt if first open, increment openCount
        await prisma.campaignSend.updateMany({
          where: {
            campaignId: decoded.campaignId,
            recipientEmail: decoded.email,
            openedAt: null,
          },
          data: { openedAt: new Date() },
        });

        await prisma.campaignSend.updateMany({
          where: {
            campaignId: decoded.campaignId,
            recipientEmail: decoded.email,
          },
          data: { openCount: { increment: 1 } },
        });
      }
    } catch (error) {
      console.error("[Campaigns] Track open error:", error.message);
    }

    res.end(TRANSPARENT_GIF);
  };

  const trackClick = async (req, res) => {
    const { trackingId } = req.params;
    const url = req.query.url;

    try {
      const decoded = validateTrackingId(trackingId, trackingSecret);

      if (decoded.valid && url) {
        await prisma.campaignClick.create({
          data: {
            campaignId: decoded.campaignId,
            recipientEmail: decoded.email,
            url: decodeURIComponent(url),
          },
        });
      }
    } catch (error) {
      console.error("[Campaigns] Track click error:", error.message);
    }

    // Always redirect, even if tracking fails
    if (url) {
      res.redirect(302, decodeURIComponent(url));
    } else {
      res.status(400).send("Missing URL");
    }
  };

  return {
    // CRUD
    listCampaigns,
    getCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    duplicateCampaign,
    // Sending
    sendCampaign,
    sendTestCampaign,
    // Preview & variables
    previewBlocks,
    getVariables,
    // Subscribers
    getSubscriberCount,
    getCampaignStats,
    getInactiveSubscribers,
    deactivateInactive,
    // Tracking (public)
    trackOpen,
    trackClick,
    // Service reference
    _service: campaignService,
  };
}

module.exports = { createCampaignsController };
