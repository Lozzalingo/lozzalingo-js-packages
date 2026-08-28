/**
 * Campaign Sending Service
 *
 * Handles the logic of sending campaigns to subscribers with rate limiting,
 * engagement tracking injection, and send recording.
 */

const { renderBlocks } = require("./block-renderer");
const {
  generateTrackingId,
  injectOpenPixel,
  rewriteLinks,
} = require("./tracking");

/**
 * Create campaign sending service.
 *
 * @param {object} prisma - PrismaClient instance
 * @param {object} emailService - Email service from @lozzalingo/email
 * @param {object} options
 * @param {string} options.brandName - Brand name for email template
 * @param {object} options.style - Email style config
 * @param {string} options.websiteUrl - Site base URL
 * @param {string} options.trackingSecret - HMAC secret for tracking IDs
 * @param {string} options.trackingBaseUrl - Base URL for tracking endpoints
 * @param {Array} options.variables - Custom template variable definitions
 */
function createCampaignService(prisma, emailService, options = {}) {
  const {
    brandName = "Lozzalingo",
    style = {},
    websiteUrl = "http://localhost:3000",
    trackingSecret = process.env.NEXTAUTH_SECRET || "default-secret",
    trackingBaseUrl,
    variables = [],
  } = options;

  const trackBase =
    trackingBaseUrl || `${websiteUrl}/api/campaigns/track`;

  /**
   * Resolve template variables for a specific recipient.
   */
  function resolveVariables(email) {
    const vars = {
      EMAIL: email,
      UNSUBSCRIBE_URL: `${websiteUrl}/unsubscribe?email=${encodeURIComponent(email)}`,
    };

    // Resolve custom variables
    for (const v of variables) {
      try {
        if (v.resolver && typeof v.resolver === "function") {
          vars[v.name] = v.resolver(email);
        } else {
          vars[v.name] = v.preview_value || "";
        }
      } catch (err) {
        console.error(`[Campaigns] Variable ${v.name} resolver error:`, err.message);
        vars[v.name] = v.preview_value || "";
      }
    }

    return vars;
  }

  /**
   * Resolve preview variables (uses preview_value instead of resolver).
   */
  function resolvePreviewVariables() {
    const vars = {
      EMAIL: "subscriber@example.com",
      UNSUBSCRIBE_URL: `${websiteUrl}/unsubscribe?email=subscriber@example.com`,
    };

    for (const v of variables) {
      vars[v.name] = v.preview_value || `{{${v.name}}}`;
    }

    return vars;
  }

  /**
   * Render a campaign's content for a specific recipient, with tracking injected.
   *
   * @param {object} campaign - Campaign record from DB
   * @param {string} recipientEmail - Recipient's email
   * @param {boolean} injectTracking - Whether to inject open pixel and click tracking
   * @returns {string} Fully rendered HTML email
   */
  function renderForRecipient(campaign, recipientEmail, injectTracking = true) {
    const blocks =
      typeof campaign.blocks === "string"
        ? JSON.parse(campaign.blocks)
        : campaign.blocks;

    const vars = resolveVariables(recipientEmail);
    let bodyHtml = renderBlocks(blocks, vars, style);

    // Wrap in email template
    let html;
    try {
      const { buildEmailTemplate } = require("@lozzalingo/email/server/templates");
      html = buildEmailTemplate({
        title: campaign.name,
        body: bodyHtml,
        brandName,
        style,
      });
    } catch (err) {
      // Fallback if email package templates not available
      html = `<!DOCTYPE html><html><body>${bodyHtml}</body></html>`;
    }

    if (injectTracking) {
      const trackingId = generateTrackingId(
        campaign.id,
        recipientEmail,
        trackingSecret
      );

      // Inject open tracking pixel
      const openUrl = `${trackBase}/open/${trackingId}`;
      html = injectOpenPixel(html, openUrl);

      // Rewrite links for click tracking + UTM
      html = rewriteLinks(html, trackBase, trackingId, campaign.name);
    }

    return html;
  }

  /**
   * Send a campaign to all active subscribers.
   *
   * @param {object} campaign - Campaign record
   * @returns {{ sent: number, skipped: number, failed: number }}
   */
  async function sendToAllSubscribers(campaign) {
    console.log(`[Campaigns] Starting send for campaign: ${campaign.name}`);

    // Get active subscribers
    const subscribers = await prisma.subscriber.findMany({
      where: { optIn: true },
      select: { email: true },
    });

    // Get already-sent emails for this campaign
    const alreadySent = await prisma.campaignSend.findMany({
      where: { campaignId: campaign.id },
      select: { recipientEmail: true },
    });
    const sentSet = new Set(alreadySent.map((s) => s.recipientEmail));

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const subscriber of subscribers) {
      if (sentSet.has(subscriber.email)) {
        skipped++;
        continue;
      }

      try {
        const html = renderForRecipient(campaign, subscriber.email, true);

        const result = await emailService.sendEmail({
          to: subscriber.email,
          subject: campaign.subject,
          html,
        });

        await prisma.campaignSend.create({
          data: {
            campaignId: campaign.id,
            recipientEmail: subscriber.email,
            status: result ? "sent" : "failed",
            errorMessage: result ? null : "Email service returned false",
          },
        });

        if (result) {
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(
          `[Campaigns] Failed to send to ${subscriber.email}:`,
          error.message
        );

        await prisma.campaignSend.create({
          data: {
            campaignId: campaign.id,
            recipientEmail: subscriber.email,
            status: "failed",
            errorMessage: error.message.substring(0, 500),
          },
        });

        failed++;
      }

      // Rate limit: 0.6s between sends
      await new Promise((r) => setTimeout(r, 600));
    }

    // Update campaign stats
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        sendCount: { increment: sent },
        lastSentAt: new Date(),
      },
    });

    console.log(
      `[Campaigns] Send complete for "${campaign.name}": ${sent} sent, ${skipped} skipped, ${failed} failed`
    );

    return { sent, skipped, failed };
  }

  /**
   * Send a campaign to a single recipient (test send).
   * Does NOT record in campaignSends.
   *
   * @param {object} campaign - Campaign record
   * @param {string} email - Recipient email
   * @returns {boolean} Whether the send succeeded
   */
  async function sendToRecipient(campaign, email) {
    try {
      const html = renderForRecipient(campaign, email, false);

      const result = await emailService.sendEmail({
        to: email,
        subject: `[TEST] ${campaign.subject}`,
        html,
      });

      console.log(`[Campaigns] Test send to ${email}: ${result ? "success" : "failed"}`);
      return !!result;
    } catch (error) {
      console.error(`[Campaigns] Test send failed:`, error.message);
      return false;
    }
  }

  /**
   * Handle the new_subscriber trigger.
   * Sends all active campaigns with trigger='new_subscriber' to the new subscriber.
   *
   * @param {string} subscriberEmail - New subscriber's email
   */
  async function handleNewSubscriberTrigger(subscriberEmail) {
    try {
      const triggeredCampaigns = await prisma.campaign.findMany({
        where: { isActive: true, trigger: "new_subscriber" },
      });

      if (triggeredCampaigns.length === 0) return;

      console.log(
        `[Campaigns] Triggering ${triggeredCampaigns.length} campaign(s) for new subscriber: ${subscriberEmail}`
      );

      for (const campaign of triggeredCampaigns) {
        try {
          const html = renderForRecipient(campaign, subscriberEmail, true);

          const result = await emailService.sendEmail({
            to: subscriberEmail,
            subject: campaign.subject,
            html,
          });

          if (result) {
            await prisma.campaignSend.create({
              data: {
                campaignId: campaign.id,
                recipientEmail: subscriberEmail,
                status: "sent",
              },
            });

            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { sendCount: { increment: 1 }, lastSentAt: new Date() },
            });
          }
        } catch (err) {
          console.error(
            `[Campaigns] Triggered campaign "${campaign.name}" failed for ${subscriberEmail}:`,
            err.message
          );
        }
      }
    } catch (error) {
      console.error("[Campaigns] Trigger handler error:", error.message);
    }
  }

  return {
    resolveVariables,
    resolvePreviewVariables,
    renderForRecipient,
    sendToAllSubscribers,
    sendToRecipient,
    handleNewSubscriberTrigger,
  };
}

module.exports = { createCampaignService };
