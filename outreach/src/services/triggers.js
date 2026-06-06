/**
 * @lozzalingo/outreach - Trigger Service
 * Wires triggers to email sending via @lozzalingo/email.
 * Handles deduplication, logging, and scheduled follow-ups.
 *
 * Supports both:
 * - Transactional emails (booking confirmation, invoice, payment) sent immediately
 * - Scheduled outreach (reminders, follow-ups) processed via cron
 */

const { getTemplate } = require("./templates");

/**
 * Create the outreach service. Wires triggers to email sending.
 *
 * @param {object} prisma
 * @param {object} emailService - Instance from @lozzalingo/email createEmailService()
 * @param {object} options
 * @param {object} options.templates - Brand-specific template overrides
 * @param {string} options.adminEmail - Admin notification email (receives enquiry + payment notifications)
 * @param {string} options.brandName - For email templates
 * @param {string} options.brandColour - Hex colour for branded email headers
 * @param {string} options.baseUrl - For links in emails
 * @param {object} options.bankDetails - Bank transfer details for invoice emails
 * @param {string} options.bankDetails.sortCode
 * @param {string} options.bankDetails.accountNumber
 * @param {string} options.bankDetails.iban
 * @param {string} options.bankDetails.bic
 * @returns {object} Outreach service
 */
function createOutreachService(prisma, emailService, options = {}) {
  const {
    templates: templateOverrides = {},
    adminEmail,
    brandName = "Lozzalingo",
    brandColour = "#FF6B35",
    baseUrl = "",
    bankDetails = {},
  } = options;

  const templateOptions = { brandName, brandColour, baseUrl, adminEmail, bankDetails };

  console.log("[Outreach] Initialising outreach service for", brandName);

  // Triggers that go to admin instead of customer
  const ADMIN_TRIGGERS = new Set([
    "enquiry_notification",
    "internal_payment_notification",
    "booking_paid_admin",
  ]);

  /**
   * Fire a trigger immediately.
   * @param {string} triggerName - e.g. "booking_confirmation", "invoice_email"
   * @param {object} data - Booking, invoice, or other context object
   * @returns {Promise<{ sent: boolean, logId?: string, reason?: string }>}
   */
  async function trigger(triggerName, data) {
    try {
      console.log("[Outreach] Firing trigger:", triggerName);

      // 1. Look up template for this trigger
      const template = getTemplate(triggerName, templateOverrides);
      if (!template) {
        console.error("[Outreach] No template found for trigger:", triggerName);
        return { sent: false, reason: "no_template" };
      }

      // 2. Check deduplication: same trigger + same bookingId within 5 minutes = skip
      const bookingId = data.id || data.bookingId || null;
      const purchaseId = data.purchaseId || null;

      if (bookingId || purchaseId) {
        try {
          const dedupeWhere = {
            trigger: triggerName,
            sentAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
          };
          if (bookingId) dedupeWhere.bookingId = bookingId;
          if (purchaseId) dedupeWhere.purchaseId = purchaseId;

          const recentDuplicate = await prisma.outreachLog.findFirst({
            where: dedupeWhere,
          });

          if (recentDuplicate) {
            console.log("[Outreach] Skipping duplicate:", triggerName, "for", bookingId || purchaseId);
            return { sent: false, reason: "duplicate" };
          }
        } catch (dedupeError) {
          console.error("[Outreach] Deduplication check failed:", dedupeError.message);
          // Continue with send - better to send a duplicate than miss an email
        }
      }

      // 3. Build email content using template + data
      const { subject, html } = template(data, templateOptions);

      // 4. Determine recipient: admin triggers go to adminEmail, others to customer
      let recipientEmail;
      let replyTo;

      if (ADMIN_TRIGGERS.has(triggerName)) {
        recipientEmail = adminEmail;
        // For enquiry notifications, set reply-to as the customer email
        if (triggerName === "enquiry_notification" && data.customerEmail) {
          replyTo = data.customerEmail;
        }
      } else {
        recipientEmail = data.customerEmail || data.email || data.recipientEmail;
      }

      if (!recipientEmail) {
        console.error("[Outreach] No recipient email found for trigger:", triggerName);
        return { sent: false, reason: "no_recipient" };
      }

      // 5. Send via emailService
      let sent = false;
      let error = null;

      try {
        const sendPayload = { to: recipientEmail, subject, html };
        if (replyTo) {
          sendPayload.headers = { "Reply-To": replyTo };
        }
        sent = await emailService.sendEmail(sendPayload);
      } catch (sendError) {
        console.error("[Outreach] Email send failed:", sendError.message);
        error = sendError.message;
        sent = false;
      }

      // 6. Log to OutreachLog (success or failure)
      let logId = null;
      try {
        const logEntry = await prisma.outreachLog.create({
          data: {
            trigger: triggerName,
            recipientEmail,
            subject,
            status: sent ? "SENT" : "FAILED",
            error: error || (sent ? null : "Email service returned false"),
            bookingId: bookingId || null,
            purchaseId: purchaseId || null,
          },
        });
        logId = logEntry.id;
        console.log("[Outreach] Logged:", triggerName, "status:", sent ? "SENT" : "FAILED", "logId:", logId);
      } catch (logError) {
        console.error("[Outreach] Failed to log outreach:", logError.message);
      }

      // 7. Return result
      return { sent, logId };
    } catch (error) {
      console.error("[Outreach] Trigger failed:", triggerName, error.message);
      return { sent: false, reason: "error" };
    }
  }

  /**
   * Schedule a future outreach.
   * @param {string} triggerName
   * @param {object} data
   * @param {Date} sendAt - When to send
   * @returns {Promise<{ scheduleId: string }>}
   */
  async function schedule(triggerName, data, sendAt) {
    try {
      console.log("[Outreach] Scheduling:", triggerName, "for", sendAt);

      const recipientEmail = data.customerEmail || data.email || data.recipientEmail;
      const bookingId = data.id || data.bookingId || null;

      const record = await prisma.outreachSchedule.create({
        data: {
          trigger: triggerName,
          recipientEmail: recipientEmail || "",
          bookingId: bookingId || null,
          scheduledFor: sendAt,
          status: "PENDING",
        },
      });

      console.log("[Outreach] Scheduled:", triggerName, "scheduleId:", record.id);
      return { scheduleId: record.id };
    } catch (error) {
      console.error("[Outreach] Failed to schedule:", triggerName, error.message);
      throw error;
    }
  }

  /**
   * Cancel a scheduled outreach (e.g. when booking is cancelled before reminder fires).
   * @param {string} bookingId
   * @param {string} triggerName - Optional, cancel all if not specified
   * @returns {Promise<{ cancelled: number }>}
   */
  async function cancelScheduled(bookingId, triggerName = null) {
    try {
      console.log("[Outreach] Cancelling scheduled:", bookingId, triggerName || "(all)");

      const where = {
        bookingId,
        status: "PENDING",
      };

      if (triggerName) {
        where.trigger = triggerName;
      }

      const result = await prisma.outreachSchedule.updateMany({
        where,
        data: { status: "CANCELLED" },
      });

      console.log("[Outreach] Cancelled", result.count, "scheduled outreach(es)");
      return { cancelled: result.count };
    } catch (error) {
      console.error("[Outreach] Failed to cancel scheduled:", error.message);
      throw error;
    }
  }

  return { trigger, schedule, cancelScheduled };
}

module.exports = { createOutreachService };
