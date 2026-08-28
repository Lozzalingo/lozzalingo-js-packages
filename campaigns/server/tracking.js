/**
 * Campaign Tracking Utilities
 *
 * HMAC-signed tracking IDs for open/click engagement tracking.
 * Prevents spoofing while keeping URLs short enough for email clients.
 */

const crypto = require("crypto");

// Minimal 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/**
 * Generate a signed tracking ID for a campaign send.
 *
 * Format: base64url(campaignId:email).hmacSignature(16 chars)
 *
 * @param {string} campaignId
 * @param {string} email
 * @param {string} secret - HMAC signing key
 * @returns {string} Tracking ID
 */
function generateTrackingId(campaignId, email, secret) {
  const payload = `${campaignId}:${email}`;
  const encoded = Buffer.from(payload).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
    .substring(0, 16);
  return `${encoded}.${signature}`;
}

/**
 * Validate and decode a tracking ID.
 *
 * @param {string} trackingId
 * @param {string} secret - HMAC signing key
 * @returns {{ valid: boolean, campaignId?: string, email?: string }}
 */
function validateTrackingId(trackingId, secret) {
  try {
    const dotIndex = trackingId.lastIndexOf(".");
    if (dotIndex === -1) return { valid: false };

    const encoded = trackingId.substring(0, dotIndex);
    const signature = trackingId.substring(dotIndex + 1);

    const payload = Buffer.from(encoded, "base64url").toString("utf-8");
    const colonIndex = payload.indexOf(":");
    if (colonIndex === -1) return { valid: false };

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex")
      .substring(0, 16);

    // Constant-time comparison to prevent timing attacks
    if (
      signature.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
    ) {
      console.warn("[Campaigns] Invalid tracking signature");
      return { valid: false };
    }

    const campaignId = payload.substring(0, colonIndex);
    const email = payload.substring(colonIndex + 1);

    return { valid: true, campaignId, email };
  } catch (error) {
    console.error("[Campaigns] Tracking ID decode error:", error.message);
    return { valid: false };
  }
}

/**
 * Inject an open-tracking pixel into HTML email content.
 *
 * @param {string} html - Email HTML
 * @param {string} trackingUrl - Full URL to the tracking pixel endpoint
 * @returns {string} HTML with pixel injected before </body>
 */
function injectOpenPixel(html, trackingUrl) {
  const pixel = `<img src="${trackingUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixel}</body>`);
  }
  return html + pixel;
}

/**
 * Rewrite links in HTML for click tracking + UTM tagging.
 *
 * @param {string} html - Email HTML
 * @param {string} trackBaseUrl - Base URL for click tracking (e.g. https://site.com/api/campaigns/track)
 * @param {string} trackingId - Signed tracking ID
 * @param {string} campaignName - For UTM campaign parameter
 * @returns {string} HTML with links rewritten
 */
function rewriteLinks(html, trackBaseUrl, trackingId, campaignName) {
  const utmParams = campaignName
    ? `utm_source=campaign&utm_medium=email&utm_campaign=${encodeURIComponent(slugify(campaignName))}`
    : "";

  return html.replace(/href="([^"]+)"/g, (match, url) => {
    // Skip non-trackable links
    if (
      url.startsWith("mailto:") ||
      url.startsWith("tel:") ||
      url.startsWith("#") ||
      url.includes("/unsubscribe") ||
      url.includes("/track/")
    ) {
      return match;
    }

    // Add UTM params to original URL
    let taggedUrl = url;
    if (utmParams) {
      const separator = url.includes("?") ? "&" : "?";
      taggedUrl = `${url}${separator}${utmParams}`;
    }

    // Wrap in click tracking
    const trackUrl = `${trackBaseUrl}/click/${trackingId}?url=${encodeURIComponent(taggedUrl)}`;
    return `href="${trackUrl}"`;
  });
}

/**
 * Slugify a campaign name for UTM parameters.
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

module.exports = {
  TRANSPARENT_GIF,
  generateTrackingId,
  validateTrackingId,
  injectOpenPixel,
  rewriteLinks,
};
