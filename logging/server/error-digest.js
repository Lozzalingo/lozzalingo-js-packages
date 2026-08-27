/**
 * Daily Error Digest Email
 *
 * Queries ERROR and CRITICAL logs from today, groups by source,
 * and sends a summary email at a configurable hour (default 21:00 London).
 *
 * Only sends when there are errors to report.
 */

const { buildEmailTemplate } = require("@lozzalingo/email/server/templates");

/**
 * Get the start of today (midnight) in a given timezone, returned as a UTC Date.
 */
function getStartOfTodayInTimezone(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year").value;
  const month = parts.find((p) => p.type === "month").value;
  const day = parts.find((p) => p.type === "day").value;

  // Build an ISO string for midnight in the target timezone
  // Then convert to UTC by parsing with timezone offset
  const midnightLocal = new Date(`${year}-${month}-${day}T00:00:00`);

  // Calculate the offset: what time is it in the timezone vs UTC?
  const utcHour = now.getUTCHours();
  const localHour = parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).format(now)
  );
  const offsetHours = localHour - utcHour;

  // Midnight in the timezone, expressed as UTC
  const midnightUTC = new Date(midnightLocal.getTime() - offsetHours * 60 * 60 * 1000);
  return midnightUTC;
}

/**
 * Build the HTML body for the error digest email.
 */
function buildDigestBody(errors, criticalCount, errorCount) {
  // Group by source
  const grouped = {};
  for (const err of errors) {
    const source = err.source || "unknown";
    if (!grouped[source]) grouped[source] = [];
    grouped[source].push(err);
  }

  // Summary box
  let html = `
    <h2>Daily Error Digest</h2>
    <div class="summary">
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0; color:#4b5563;">Total errors</td>
          <td style="padding:6px 0; text-align:right; font-weight:600;">${errorCount + criticalCount}</td>
        </tr>`;

  if (criticalCount > 0) {
    html += `
        <tr>
          <td style="padding:6px 0; color:#dc2626; font-weight:600;">Critical</td>
          <td style="padding:6px 0; text-align:right; font-weight:600; color:#dc2626;">${criticalCount}</td>
        </tr>`;
  }

  html += `
        <tr>
          <td style="padding:6px 0; color:#4b5563;">Error</td>
          <td style="padding:6px 0; text-align:right; font-weight:600;">${errorCount}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#4b5563;">Sources</td>
          <td style="padding:6px 0; text-align:right; font-weight:600;">${Object.keys(grouped).length}</td>
        </tr>
      </table>
    </div>`;

  // Errors grouped by source
  for (const [source, items] of Object.entries(grouped)) {
    html += `<h3 style="margin:24px 0 8px 0; font-size:16px; color:#1f2937;">${source} (${items.length})</h3>`;
    html += `<table style="width:100%; border-collapse:collapse; font-size:13px;">`;
    html += `<tr style="border-bottom:2px solid #e5e5e5;">
      <th style="text-align:left; padding:8px 4px; color:#6b7280;">Time</th>
      <th style="text-align:left; padding:8px 4px; color:#6b7280;">Level</th>
      <th style="text-align:left; padding:8px 4px; color:#6b7280;">Message</th>
    </tr>`;

    for (const item of items) {
      const time = new Date(item.timestamp).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const isCritical = item.level === "CRITICAL";
      const rowBg = isCritical ? "background:#fef2f2;" : "";
      const levelColour = isCritical ? "#dc2626" : "#ea580c";
      const message = (item.message || "").substring(0, 200);

      html += `<tr style="border-bottom:1px solid #f3f4f6; ${rowBg}">
        <td style="padding:6px 4px; white-space:nowrap; color:#6b7280;">${time}</td>
        <td style="padding:6px 4px; font-weight:600; color:${levelColour};">${item.level}</td>
        <td style="padding:6px 4px; color:#374151;">${escapeHtml(message)}</td>
      </tr>`;

      // Show truncated details if present
      if (item.details) {
        let detailStr = item.details;
        if (typeof detailStr === "string" && detailStr.length > 300) {
          detailStr = detailStr.substring(0, 300) + "...";
        }
        html += `<tr style="${rowBg}">
          <td colspan="3" style="padding:2px 4px 8px 4px; font-size:11px; color:#9ca3af; font-family:monospace; word-break:break-all;">${escapeHtml(detailStr)}</td>
        </tr>`;
      }
    }

    html += `</table>`;
  }

  html += `<p style="margin-top:24px; font-size:13px; color:#9ca3af;">View full details in the admin dashboard at /admin/logs</p>`;

  return html;
}

/**
 * Escape HTML entities to prevent injection in email content.
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Create the error digest service.
 *
 * @param {object} prisma - PrismaClient instance
 * @param {object} emailService - Email service from @lozzalingo/email
 * @param {object} options
 * @param {string} options.recipientEmail - Who receives the digest
 * @param {string} options.brandName - Site/brand name for subject line
 * @param {object} options.style - Email template style overrides
 * @param {number} options.cronHour - Hour to send (24h format, default 21)
 * @param {string} options.timezone - IANA timezone (default Europe/London)
 */
function createErrorDigestService(prisma, emailService, options = {}) {
  const {
    recipientEmail = "laurencedotcomputer@gmail.com",
    brandName = "Lozzalingo",
    style = {},
    cronHour = 21,
    timezone = "Europe/London",
  } = options;

  let _lastDigestDate = null;

  /**
   * Query today's errors and send the digest email.
   * Returns { sent, errorCount, criticalCount } or { sent: false, reason }.
   */
  async function sendErrorDigest() {
    try {
      const startOfDay = getStartOfTodayInTimezone(timezone);

      const errors = await prisma.appLog.findMany({
        where: {
          level: { in: ["ERROR", "CRITICAL"] },
          timestamp: { gte: startOfDay },
        },
        orderBy: [{ level: "asc" }, { timestamp: "desc" }],
        // CRITICAL sorts before ERROR alphabetically
      });

      if (errors.length === 0) {
        console.log("[ErrorDigest] No errors today, skipping digest");
        return { sent: false, reason: "no_errors" };
      }

      const criticalCount = errors.filter((e) => e.level === "CRITICAL").length;
      const errorCount = errors.filter((e) => e.level === "ERROR").length;

      const body = buildDigestBody(errors, criticalCount, errorCount);

      const dateStr = new Date().toLocaleDateString("en-GB", {
        timeZone: timezone,
        day: "numeric",
        month: "short",
      });

      const subject = `[${brandName}] Error Digest: ${errors.length} issue${errors.length !== 1 ? "s" : ""}${criticalCount > 0 ? ` (${criticalCount} critical)` : ""} - ${dateStr}`;

      const html = buildEmailTemplate({
        title: "Error Digest",
        body,
        brandName,
        style,
      });

      await emailService.sendEmail({
        to: recipientEmail,
        subject,
        html,
      });

      console.log(
        `[ErrorDigest] Sent digest to ${recipientEmail}: ${errorCount} errors, ${criticalCount} critical`
      );

      return { sent: true, errorCount, criticalCount };
    } catch (error) {
      console.error("[ErrorDigest] Failed to send digest:", error.message);
      return { sent: false, reason: "send_failed", error: error.message };
    }
  }

  /**
   * Start the hourly check. Fires the digest when the current hour
   * in the configured timezone matches cronHour.
   */
  function startErrorDigestCron() {
    console.log(
      `[ErrorDigest] Cron started (daily at ${cronHour}:00 ${timezone}, recipient: ${recipientEmail})`
    );

    setInterval(() => {
      try {
        const now = new Date();
        const currentHour = parseInt(
          new Intl.DateTimeFormat("en-GB", {
            timeZone: timezone,
            hour: "2-digit",
            hour12: false,
          }).format(now)
        );

        const todayStr = new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(now);

        if (currentHour === cronHour && _lastDigestDate !== todayStr) {
          _lastDigestDate = todayStr;
          console.log("[ErrorDigest] Triggering daily digest...");
          sendErrorDigest().catch((err) => {
            console.error("[ErrorDigest] Cron send failed:", err.message);
          });
        }
      } catch (err) {
        console.error("[ErrorDigest] Cron tick error:", err.message);
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  return { sendErrorDigest, startErrorDigestCron };
}

module.exports = { createErrorDigestService };
