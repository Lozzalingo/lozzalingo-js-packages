/**
 * @lozzalingo/outreach - Template Registry
 * Transactional emails (booking confirmation, invoice, payment) plus
 * scheduled outreach (reminders, follow-ups, stale enquiry nudges).
 *
 * HTML email templates: branded header with brandColour background,
 * white content area, detail tables, CTA buttons, configurable branding.
 *
 * Sites can override any template via options.templates.
 */

// ── Shared layout helpers ─────────────────────────────────────────────────────

function brandedHeader(title, options) {
  const { brandColour = "#FF6B35", brandName = "Events" } = options;
  return `
    <div style="background: ${brandColour}; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">${title || brandName}</h1>
    </div>`;
}

function brandedHeaderWithSubtitle(title, subtitle, options) {
  const { brandColour = "#FF6B35" } = options;
  return `
    <div style="background: ${brandColour}; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">${title}</h1>
      ${subtitle ? `<p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${subtitle}</p>` : ""}
    </div>`;
}

function greyHeader(title, subtitle) {
  return `
    <div style="background: #636363; padding: 25px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
      <h1 style="font-size: 24px; margin: 0 0 10px 0; font-weight: bold; color: white;">${title}</h1>
      ${subtitle ? `<p style="font-size: 15px; margin: 0; color: white;">${subtitle}</p>` : ""}
    </div>`;
}

function brandedFooter(options) {
  const { brandName = "Events" } = options;
  return `
    <div style="background: #f5f5f5; padding: 16px 24px; text-align: center; font-size: 12px; color: #888;">
      <p style="margin: 0;">${brandName}</p>
    </div>`;
}

function detailRow(label, value) {
  if (!value && value !== 0) return "";
  return `<tr><td style="padding: 6px 0; color: #666;">${label}</td><td style="padding: 6px 0;">${value}</td></tr>`;
}

function detailRowBold(label, value) {
  if (!value && value !== 0) return "";
  return `<tr><td style="padding: 6px 0; color: #666;">${label}</td><td style="padding: 6px 0; font-weight: bold;">${value}</td></tr>`;
}

function wrapSimple(inner, options) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      ${brandedHeader(options.brandName, options)}
      <div style="padding: 24px; line-height: 1.6;">
        ${inner}
      </div>
      ${brandedFooter(options)}
    </div>`;
}

function wrapFull(headerHtml, inner, options) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333333; background-color: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden;">
    ${headerHtml}
    <div style="padding: 30px;">
      ${inner}
    </div>
  </div>
</body>
</html>`;
}

function formatPence(pence) {
  if (!pence && pence !== 0) return null;
  return `\u00a3${(pence / 100).toFixed(2)}`;
}

// ── 1. Booking confirmation (to customer on enquiry creation) ─────────────────

function buildBookingConfirmationHtml(data, options) {
  return wrapSimple(
    `<p>Thanks for your enquiry, we'll be in touch shortly.</p>`,
    options,
  );
}

// ── 2. Enquiry notification (to admin) ────────────────────────────────────────

function buildEnquiryNotificationHtml(data, options) {
  const { brandColour = "#FF6B35" } = options;
  const submittedDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const phoneHtml = data.customerPhone
    ? `<a href="tel:${data.customerPhone}" style="color: ${brandColour};">${data.customerPhone}</a>`
    : "Not provided";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: ${brandColour}; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">New Enquiry</h1>
      </div>
      <div style="padding: 24px; line-height: 1.6;">
        <p style="margin: 0 0 4px 0; color: #888; font-size: 13px;">Booking Ref: ${data.bookingNumber || "N/A"}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
        <p style="margin: 0 0 16px 0;"><strong>Customer:</strong> ${data.customerName} (<a href="mailto:${data.customerEmail}" style="color: ${brandColour};">${data.customerEmail}</a>)</p>
        <p style="margin: 0 0 16px 0;"><strong>Phone:</strong> ${phoneHtml}</p>
        <p style="margin: 0 0 16px 0;"><strong>Company:</strong> ${data.companyName || "Not provided"}</p>
        ${data.productName ? `<p style="margin: 0 0 16px 0;"><strong>Product:</strong> ${data.productName}</p>` : ""}
        ${data.packageName ? `<p style="margin: 0 0 16px 0;"><strong>Package:</strong> ${data.packageName}</p>` : ""}
        <p style="margin: 0 0 16px 0;"><strong>Group Size:</strong> ${data.groupSize}</p>
        <p style="margin: 0 0 16px 0;"><strong>Preferred Date:</strong> ${data.eventDate}</p>
        <p style="margin: 0 0 16px 0;"><strong>Message:</strong> ${data.message || "None"}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
        <p style="margin: 0; color: #888; font-size: 13px;">Submitted: ${submittedDate}</p>
      </div>
    </div>`;
}

// ── 3. Invoice email (to customer, with bank details + Stripe button) ─────────

function buildInvoiceEmailHtml(data, options) {
  const { brandColour = "#FF6B35" } = options;
  const bankDetails = options.bankDetails || {};
  const formattedAmount = formatPence(data.amountDuePence) || "TBC";
  const formattedDate = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const bookingInfoHtml = (data.bookingNumber || data.eventDate || data.groupSize) ? `
    <div style="background: #fff5f5; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #f56565;">
      <h3 style="color: #c53030; font-size: 18px; margin-top: 0; margin-bottom: 15px;">Booking Information</h3>
      ${data.bookingNumber ? `<p style="margin: 8px 0; color: #333;"><strong>Booking Reference:</strong> ${data.bookingNumber}</p>` : ""}
      ${data.eventDate ? `<p style="margin: 8px 0; color: #333;"><strong>Event Date:</strong> ${data.eventDate}</p>` : ""}
      ${data.eventTime ? `<p style="margin: 8px 0; color: #333;"><strong>Time:</strong> ${data.eventTime}</p>` : ""}
      ${data.groupSize ? `<p style="margin: 8px 0; color: #333;"><strong>Group Size:</strong> ${data.groupSize} people</p>` : ""}
    </div>` : "";

  const bankDetailsHtml = (bankDetails.sortCode || bankDetails.accountNumber) ? `
    <div style="background: #e6fffa; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #38b2ac;">
      <h3 style="color: #234e52; font-size: 18px; margin-top: 0; margin-bottom: 15px;">Preferred Payment Method: Bank Transfer</h3>
      ${bankDetails.sortCode ? `<p style="margin: 8px 0; color: #333;"><strong>Bank/Sort Code:</strong> ${bankDetails.sortCode}</p>` : ""}
      ${bankDetails.accountNumber ? `<p style="margin: 8px 0; color: #333;"><strong>Account Number:</strong> ${bankDetails.accountNumber}</p>` : ""}
      ${bankDetails.iban ? `<p style="margin: 8px 0; color: #333;"><strong>IBAN:</strong> ${bankDetails.iban}</p>` : ""}
      ${bankDetails.bic ? `<p style="margin: 8px 0; color: #333;"><strong>BIC:</strong> ${bankDetails.bic}</p>` : ""}
      <p style="margin: 8px 0; color: #333;">Please include the invoice number (${data.invoiceNumber}) as the payment reference.</p>
    </div>` : "";

  const headerHtml = greyHeader(
    "Invoice Payment Required",
    `Hello ${data.customerFirstName}, thank you for choosing our services!`,
  );

  // Build line items breakdown if available
  let lineItemsHtml = "";
  const lineItems = Array.isArray(data.lineItems) ? data.lineItems : [];
  if (lineItems.length > 0) {
    const rows = lineItems.map(item => {
      const name = item.name || item.description || "Item";
      const qty = item.quantity || 1;
      const unitPence = item.unitPricePence || item.amount || 0;
      const totalPence = qty > 1 ? unitPence * qty : unitPence;
      const unitStr = formatPence(unitPence);
      const totalStr = formatPence(totalPence);
      return `<tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e9ecef; color: #333;">${name}</td>
        ${qty > 1 ? `<td style="padding: 10px 8px; border-bottom: 1px solid #e9ecef; color: #666; text-align: center;">${qty}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e9ecef; color: #666; text-align: right;">${unitStr}</td>` : `<td style="padding: 10px 8px; border-bottom: 1px solid #e9ecef; color: #666; text-align: center;">1</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e9ecef; color: #666; text-align: right;">${unitStr}</td>`}
        <td style="padding: 10px 8px; border-bottom: 1px solid #e9ecef; color: #333; text-align: right; font-weight: 600;">${totalStr}</td>
      </tr>`;
    }).join("");

    lineItemsHtml = `
    <div style="background: #fff; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 25px; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 12px 8px; text-align: left; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
            <th style="padding: 12px 8px; text-align: center; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
            <th style="padding: 12px 8px; text-align: right; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Unit Price</th>
            <th style="padding: 12px 8px; text-align: right; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background: #f8f9fa;">
            <td colspan="3" style="padding: 12px 8px; text-align: right; font-weight: bold; color: #333; font-size: 16px;">Total Due:</td>
            <td style="padding: 12px 8px; text-align: right; font-weight: bold; color: #667eea; font-size: 18px;">${formattedAmount}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  }

  const invoiceDetailsHtml = `
    <div style="background: #f8f9fa; border: 1px solid #e9ecef; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
      <h2 style="color: #333; font-size: 22px; margin-top: 0; margin-bottom: 20px;">Invoice Details</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; font-weight: bold; color: #666; width: 40%;">Invoice Number:</td><td style="padding: 8px 0; color: #333;">${data.invoiceNumber}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #666;">Service:</td><td style="padding: 8px 0; color: #333;">${data.productName || "Service"}</td></tr>
        ${data.companyName ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #666;">Organisation:</td><td style="padding: 8px 0; color: #333;">${data.companyName}</td></tr>` : ""}
        ${lineItems.length === 0 ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #666;">Amount Due:</td><td style="padding: 8px 0; font-size: 24px; font-weight: bold; color: #667eea;">${formattedAmount}</td></tr>` : ""}
        <tr><td style="padding: 8px 0; font-weight: bold; color: #666;">Due Date:</td><td style="padding: 8px 0; color: #333;">${formattedDate}</td></tr>
      </table>
    </div>`;

  const ctaHtml = data.hostedInvoiceUrl ? `
    <div style="text-align: center; margin: 20px 0; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
      <a href="${data.hostedInvoiceUrl}" style="background: #667eea; color: #ffffff; padding: 15px; border-radius: 6px; width: 100%; text-decoration: none; display: block; font-weight: 600; font-size: 16px; text-align: center; box-sizing: border-box;">
        Pay Invoice Securely
      </a>
    </div>` : "";

  return wrapFull(
    headerHtml,
    `${bookingInfoHtml}${bankDetailsHtml}${invoiceDetailsHtml}${lineItemsHtml}${ctaHtml}`,
    options,
  );
}

// ── 4. Payment confirmation (to customer) ─────────────────────────────────────

function buildPaymentConfirmationHtml(data, options) {
  const { brandName = "Events" } = options;

  const headerHtml = greyHeader("Payment Confirmed!", "Thank you for your payment");

  const inner = `
    <p>Hello ${data.customerFirstName},</p>
    <p>Your payment has been successfully processed!</p>
    <div style="background: #f8f9fa; border: 1px solid #e9ecef; padding: 25px; border-radius: 8px; margin: 20px 0;">
      <h2 style="color: #333; font-size: 18px; margin-top: 0; margin-bottom: 16px;">Payment Details:</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; font-weight: bold; color: #666;">Invoice Number:</td><td style="padding: 8px 0; color: #333;">${data.invoiceNumber}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #666;">Amount Paid:</td><td style="padding: 8px 0; color: #333; font-weight: bold;">${data.amountPaid}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #666;">Payment Date:</td><td style="padding: 8px 0; color: #333;">${data.paymentDate}</td></tr>
      </table>
    </div>
    <p>Thank you for choosing ${brandName}! We're excited to deliver an amazing experience for your group.</p>
    <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>`;

  return wrapFull(headerHtml, inner, options);
}

// ── 5. Internal payment notification (to admin) ───────────────────────────────

function buildInternalPaymentNotificationHtml(data, options) {
  const { brandColour = "#FF6B35" } = options;

  const lineItemsHtml = (data.lineItems || []).map(li =>
    `<li>${li.description} (Qty: ${li.quantity}, Amount: ${li.amount})</li>`
  ).join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: ${brandColour}; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Invoice Paid</h1>
      </div>
      <div style="padding: 24px; line-height: 1.6;">
        <p>Hello,</p>
        <p>An invoice has been paid! Here are the details:</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0;">
          ${detailRowBold("Customer Name:", data.customerName)}
          ${detailRow("Customer Email:", data.customerEmail)}
          ${detailRowBold("Invoice Number:", data.invoiceNumber)}
          <tr><td style="padding: 6px 0; color: #666;">Payment Status:</td><td style="padding: 6px 0; color: green; font-weight: bold;">Yes</td></tr>
          ${detailRowBold("Amount Paid:", data.amountPaid)}
          ${detailRow("Booking Reference:", data.bookingRef)}
          ${detailRow("Group Size:", data.groupSize)}
          ${detailRow("Start Date:", data.eventDate)}
        </table>
        ${lineItemsHtml ? `<p><strong>Items Purchased:</strong></p><ul>${lineItemsHtml}</ul>` : ""}
        ${data.hostedUrl ? `<p>You can view the invoice here:<br><a href="${data.hostedUrl}" style="color: ${brandColour};">${data.hostedUrl}</a></p>` : ""}
      </div>
    </div>`;
}

// ── 6-16. Scheduled outreach templates (reminders, follow-ups, nudges) ────────

function buildReminderHtml(data, options, timeframe) {
  const { brandName = "Events" } = options;
  return wrapSimple(`
    <h2 style="margin: 0 0 16px 0;">Your Event is ${timeframe}</h2>
    <p>Hi ${data.customerName || "there"},</p>
    <p>Just a friendly reminder that your event with ${brandName} is coming up ${timeframe}.</p>
    ${data.bookingNumber ? `<p><strong>Reference:</strong> ${data.bookingNumber}</p>` : ""}
    ${data.eventDate ? `<p><strong>Date:</strong> ${new Date(data.eventDate).toLocaleDateString("en-GB")}</p>` : ""}
    <p>If you have any questions, please get in touch.</p>
  `, options);
}

function buildFollowUpHtml(data, options) {
  const { brandName = "Events" } = options;
  return wrapSimple(`
    <h2 style="margin: 0 0 16px 0;">How Was Your Experience?</h2>
    <p>Hi ${data.customerName || "there"},</p>
    <p>We hope you enjoyed your recent event with ${brandName}!</p>
    <p>We would love to hear your feedback. Please reply to this email with any thoughts or suggestions.</p>
  `, options);
}

function buildEnquiryFollowUpHtml(data, options) {
  const { brandName = "Events" } = options;
  return wrapSimple(`
    <h2 style="margin: 0 0 16px 0;">Following Up on Your Enquiry</h2>
    <p>Hi ${data.customerName || "there"},</p>
    <p>We noticed you recently enquired about an event with ${brandName}. We wanted to check if you had any questions or would like to proceed.</p>
    ${data.bookingNumber ? `<p><strong>Reference:</strong> ${data.bookingNumber}</p>` : ""}
    <p>Just reply to this email and we will be happy to help.</p>
  `, options);
}

function buildPencilExpiringHtml(data, options) {
  const { brandName = "Events" } = options;
  return wrapSimple(`
    <h2 style="margin: 0 0 16px 0;">Your Booking Hold Expires Soon</h2>
    <p>Hi ${data.customerName || "there"},</p>
    <p>Your pencilled booking with ${brandName} is about to expire.</p>
    ${data.bookingNumber ? `<p><strong>Reference:</strong> ${data.bookingNumber}</p>` : ""}
    <p>Please complete your payment soon to secure your date, or get in touch if you need more time.</p>
  `, options);
}

function buildBookingQuotedHtml(data, options) {
  const { brandName = "Events", brandColour = "#FF6B35" } = options;
  const amount = formatPence(data.totalAmount);

  return wrapSimple(`
    <h2 style="margin: 0 0 16px 0;">Your Quote is Ready</h2>
    <p>Hi ${data.customerName || "there"},</p>
    <p>We have prepared a quote for your event with ${brandName}.</p>
    ${data.bookingNumber || amount ? `
    <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px 0; color: ${brandColour};">Quote Details</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        ${detailRowBold("Reference", data.bookingNumber)}
        ${amount ? detailRowBold("Quoted Amount", amount) : ""}
      </table>
    </div>` : ""}
    <p>Please reply to this email to proceed or if you have any questions.</p>
  `, options);
}

function buildBookingPencilledHtml(data, options) {
  const { brandName = "Events" } = options;
  return wrapSimple(`
    <h2 style="margin: 0 0 16px 0;">Date Pencilled In</h2>
    <p>Hi ${data.customerName || "there"},</p>
    <p>Great news! Your date has been pencilled in with ${brandName}.</p>
    ${data.bookingNumber ? `<p><strong>Reference:</strong> ${data.bookingNumber}</p>` : ""}
    ${data.eventDate ? `<p><strong>Date:</strong> ${new Date(data.eventDate).toLocaleDateString("en-GB")}</p>` : ""}
    <p>Please complete your payment to confirm the booking. The hold will expire if payment is not received within the specified timeframe.</p>
  `, options);
}

function buildBookingConfirmedHtml(data, options) {
  const { brandName = "Events" } = options;
  return wrapSimple(`
    <h2 style="margin: 0 0 16px 0;">Booking Confirmed</h2>
    <p>Hi ${data.customerName || "there"},</p>
    <p>Your booking with ${brandName} has been confirmed!</p>
    ${data.bookingNumber ? `<p><strong>Reference:</strong> ${data.bookingNumber}</p>` : ""}
    ${data.eventDate ? `<p><strong>Date:</strong> ${new Date(data.eventDate).toLocaleDateString("en-GB")}</p>` : ""}
    <p>We look forward to delivering a brilliant experience for your group.</p>
  `, options);
}

function buildBookingCancelledHtml(data, options) {
  const { brandName = "Events" } = options;
  return wrapSimple(`
    <h2 style="margin: 0 0 16px 0;">Booking Cancelled</h2>
    <p>Hi ${data.customerName || "there"},</p>
    <p>Your booking with ${brandName} has been cancelled.</p>
    ${data.bookingNumber ? `<p><strong>Reference:</strong> ${data.bookingNumber}</p>` : ""}
    <p>If this was a mistake or you would like to rebook, please get in touch.</p>
  `, options);
}

function buildPencilExpiredHtml(data, options) {
  const { brandName = "Events" } = options;
  return wrapSimple(`
    <h2 style="margin: 0 0 16px 0;">Booking Hold Expired</h2>
    <p>Hi ${data.customerName || "there"},</p>
    <p>Your pencilled booking with ${brandName} has expired as payment was not received in time.</p>
    ${data.bookingNumber ? `<p><strong>Reference:</strong> ${data.bookingNumber}</p>` : ""}
    <p>If you would still like to book, please get in touch and we will check availability.</p>
  `, options);
}

function buildPurchaseCompletedHtml(data, options) {
  const { brandName = "Events" } = options;
  return wrapSimple(`
    <h2 style="margin: 0 0 16px 0;">Purchase Complete</h2>
    <p>Hi ${data.customerName || data.customerEmail || "there"},</p>
    <p>Thank you for your purchase from ${brandName}!</p>
    <p>Your download is ready. Please check your account or follow the link provided.</p>
  `, options);
}

function buildSubscriptionRenewedHtml(data, options) {
  const { brandName = "Events" } = options;
  return wrapSimple(`
    <h2 style="margin: 0 0 16px 0;">Subscription Renewed</h2>
    <p>Hi ${data.customerName || data.customerEmail || "there"},</p>
    <p>Your subscription with ${brandName} has been successfully renewed.</p>
    <p>Thank you for your continued support!</p>
  `, options);
}

function buildSubscriptionCancelledHtml(data, options) {
  const { brandName = "Events" } = options;
  return wrapSimple(`
    <h2 style="margin: 0 0 16px 0;">Subscription Cancelled</h2>
    <p>Hi ${data.customerName || data.customerEmail || "there"},</p>
    <p>Your subscription with ${brandName} has been cancelled.</p>
    <p>We are sorry to see you go. If you change your mind, you can resubscribe at any time.</p>
  `, options);
}

// ── Booking paid (detailed) ──────────────────────────────────────────────────

function parseTaskSections(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function formatTaskSections(sections) {
  if (!sections || sections.length === 0) return "";
  return sections.map((s, i) => {
    let desc = `Section ${i + 1}: `;
    if (s.type === "location") desc += `Location - ${s.locationSlug || "TBC"}`;
    else if (s.type === "miscellaneous") {
      if (s.miscTheme === "bespoke") desc += `Miscellaneous (Bespoke: ${s.bespokeTheme || "TBC"})`;
      else desc += `Miscellaneous - ${s.miscTheme || "TBC"}`;
    }
    else if (s.type === "bespoke") desc += "Bespoke (questionnaire to follow)";
    return desc;
  }).join("<br>");
}

function capitalise(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function buildBookingPaidCustomerHtml(data, options) {
  const brandOrange = "#F26522";
  const brandDark = "#1a1a2e";
  const baseUrl = options.baseUrl || "https://bucketrace.com";
  const logoUrl = "https://bucketrace.com/logo.png";

  const eventDate = data.eventDate
    ? new Date(data.eventDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "TBC";

  const sections = parseTaskSections(data.taskSections);
  const durationHours = data.duration ? parseFloat(data.duration) : 0;
  const durationMins = durationHours * 60;

  // Task sections
  const locationSections = sections.filter(s => s.type === "location");
  const miscSections = sections.filter(s => s.type === "miscellaneous");
  const bespokeSections = sections.filter(s => s.type === "bespoke");
  const hasBespokeContent = bespokeSections.length > 0 || miscSections.some(s => s.miscTheme === "bespoke");

  let taskRowsHtml = "";
  if (locationSections.length > 0) {
    const locNames = locationSections.map(s => capitalise(s.locationSlug?.replace(/-/g, " ") || "")).filter(Boolean).join(", ");
    taskRowsHtml += `<tr><td style="padding: 8px 12px; color: ${brandOrange}; font-weight: bold; width: 120px; vertical-align: top;">Location</td><td style="padding: 8px 12px;">${locNames || data.locationName || "TBC"}</td></tr>`;
  }
  if (miscSections.length > 0) {
    const themes = miscSections.map(s => {
      if (s.miscTheme === "bespoke") return `Bespoke${s.bespokeTheme ? " (" + s.bespokeTheme + ")" : ""}`;
      return capitalise(s.miscTheme || "");
    }).filter(Boolean).join(", ");
    taskRowsHtml += `<tr><td style="padding: 8px 12px; color: ${brandOrange}; font-weight: bold; vertical-align: top;">Miscellaneous</td><td style="padding: 8px 12px;">${themes}</td></tr>`;
  }
  if (bespokeSections.length > 0) {
    taskRowsHtml += `<tr><td style="padding: 8px 12px; color: ${brandOrange}; font-weight: bold; vertical-align: top;">Bespoke</td><td style="padding: 8px 12px;">Personalised tasks</td></tr>`;
  }

  // Extras
  const extras = [];
  if (data.wantsMedals) extras.push("Participation Medals");
  if (data.wantsPhotoPrints) extras.push("Printable Experience Photos");

  // Schedule
  const fmt = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  let scheduleHtml = "";
  if (data.slotStartTime && durationMins > 0) {
    const [startH, startM] = data.slotStartTime.split(":").map(Number);
    const startTotal = startH * 60 + startM;
    const introMins = 30;
    const gameTime = durationMins - 60;

    const arrivalTime = startTotal;
    const briefTime = arrivalTime + (introMins - 5);
    const kickOffTime = arrivalTime + introMins;
    const returnTime = kickOffTime + gameTime;
    const scoresTime = returnTime + 10;
    const endTime = startTotal + durationMins;

    const startPointName = data.locationStartPoint || "Meeting point";
    const startPointLink = data.locationStartPointUrl
      ? `<a href="${data.locationStartPointUrl}" style="color: ${brandOrange}; font-weight: bold; text-decoration: none;">${startPointName} &#x2197;</a>`
      : startPointName;

    const scheduleRow = (time, emoji, text, highlight) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; color: ${highlight ? brandOrange : "#555"}; font-weight: ${highlight ? "bold" : "normal"}; font-size: 15px; width: 60px; vertical-align: top;">${fmt(time)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: ${highlight ? "#333" : "#555"};">${emoji} ${text}</td>
      </tr>`;

    scheduleHtml = `
      <div style="margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td colspan="2" style="background: ${brandDark}; padding: 16px; border-radius: 8px 8px 0 0;">
              <h3 style="margin: 0; color: white; font-size: 16px;">Your BucketRace Schedule</h3>
              ${data.locationStartPointUrl ? `<p style="margin: 6px 0 0 0; font-size: 13px; color: #ccc;">Meeting point: ${startPointLink.replace(`color: ${brandOrange}`, "color: #ffffff")}</p>` : ""}
            </td>
          </tr>
        </table>
        <table style="width: 100%; border-collapse: collapse; background: #fafafa; border-radius: 0 0 8px 8px; overflow: hidden;">
          ${scheduleRow(arrivalTime, "&#x1F3C1;", `<strong>Arrival</strong> at ${startPointName}. Hand out lists, submit practice task, teams discuss their route and how to earn the most points.`, true)}
          ${scheduleRow(briefTime, "&#x1F399;", "Brief Q&A, final tips, and... GO!", false)}
          ${scheduleRow(kickOffTime, "&#x1F3C3;", "<strong>Teams leave for their BucketRace!</strong>", true)}
          ${scheduleRow(returnTime, "&#x1F3E0;", "Teams return from BucketRace", false)}
          ${scheduleRow(scoresTime, "&#x1F3C6;", "<strong>Scores announced</strong>, presentation of prizes and group photos", true)}
          ${scheduleRow(endTime, "&#x1F44B;", "BucketRace finishes", false)}
        </table>
      </div>`;
  }

  // Group type context for greeting
  const groupLabel = data.groupType
    ? (data.groupType === "corporate" ? `${data.companyName || "your"} team event` : `your ${data.groupType} party`)
    : "your event";

  const totalPaid = data.totalPaid || data.totalAmount;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f0f0f0; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); overflow: hidden;">

    <!-- Header -->
    <div style="background: ${brandDark}; padding: 32px 30px; text-align: center;">
      <img src="${logoUrl}" alt="BucketRace" style="width: 80px; height: auto; margin-bottom: 16px;" />
      <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: -0.5px;">Booking Confirmed!</h1>
      <p style="color: ${brandOrange}; margin: 8px 0 0 0; font-size: 14px; font-weight: bold; letter-spacing: 1px;">${data.bookingNumber || ""}</p>
    </div>

    <!-- Welcome -->
    <div style="padding: 30px 30px 0 30px;">
      <p style="font-size: 17px; margin: 0 0 6px 0;">Hi ${data.customerName || "there"},</p>
      <p style="font-size: 15px; color: #555; margin: 0 0 24px 0;">Welcome BucketRacer extraordinaire! Thank you for choosing BucketRace for ${groupLabel}.</p>

      <!-- Booking details card -->
      <div style="background: linear-gradient(135deg, #fff8f3 0%, #fff 100%); border: 2px solid ${brandOrange}; border-radius: 10px; overflow: hidden; margin-bottom: 24px;">
        <div style="background: ${brandOrange}; padding: 10px 16px;">
          <h3 style="margin: 0; color: white; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">Your Booking Details</h3>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 10px 16px; color: #888; font-size: 13px; border-bottom: 1px solid #f5e6d9; width: 140px;">Reference</td><td style="padding: 10px 16px; font-weight: bold; border-bottom: 1px solid #f5e6d9;">${data.bookingNumber || ""}</td></tr>
          ${data.productName ? `<tr><td style="padding: 10px 16px; color: #888; font-size: 13px; border-bottom: 1px solid #f5e6d9;">Event</td><td style="padding: 10px 16px; font-weight: bold; border-bottom: 1px solid #f5e6d9;">${data.productName}</td></tr>` : ""}
          <tr><td style="padding: 10px 16px; color: #888; font-size: 13px; border-bottom: 1px solid #f5e6d9;">Date</td><td style="padding: 10px 16px; font-weight: bold; border-bottom: 1px solid #f5e6d9;">${eventDate}</td></tr>
          ${data.slotStartTime ? `<tr><td style="padding: 10px 16px; color: #888; font-size: 13px; border-bottom: 1px solid #f5e6d9;">Start Time</td><td style="padding: 10px 16px; font-weight: bold; border-bottom: 1px solid #f5e6d9;">${data.slotStartTime}</td></tr>` : (data.eventTime ? `<tr><td style="padding: 10px 16px; color: #888; font-size: 13px; border-bottom: 1px solid #f5e6d9;">Time</td><td style="padding: 10px 16px; font-weight: bold; border-bottom: 1px solid #f5e6d9;">${data.eventTime}</td></tr>` : "")}
          ${data.slotEndTime ? `<tr><td style="padding: 10px 16px; color: #888; font-size: 13px; border-bottom: 1px solid #f5e6d9;">End Time</td><td style="padding: 10px 16px; font-weight: bold; border-bottom: 1px solid #f5e6d9;">${data.slotEndTime}</td></tr>` : ""}
          ${data.duration ? `<tr><td style="padding: 10px 16px; color: #888; font-size: 13px; border-bottom: 1px solid #f5e6d9;">Duration</td><td style="padding: 10px 16px; font-weight: bold; border-bottom: 1px solid #f5e6d9;">${data.duration} hours</td></tr>` : ""}
          <tr><td style="padding: 10px 16px; color: #888; font-size: 13px; border-bottom: 1px solid #f5e6d9;">Group Size</td><td style="padding: 10px 16px; font-weight: bold; border-bottom: 1px solid #f5e6d9;">${data.groupSize || ""} players</td></tr>
          ${data.locationName ? `<tr><td style="padding: 10px 16px; color: #888; font-size: 13px; border-bottom: 1px solid #f5e6d9;">Location</td><td style="padding: 10px 16px; font-weight: bold; border-bottom: 1px solid #f5e6d9;">${data.locationName}</td></tr>` : ""}
          ${totalPaid ? `<tr><td style="padding: 10px 16px; color: #888; font-size: 13px;">Total Paid</td><td style="padding: 10px 16px; font-weight: bold; color: ${brandOrange}; font-size: 18px;">${formatPence(totalPaid)}</td></tr>` : ""}
        </table>
      </div>

      ${taskRowsHtml ? `
      <!-- Tasks -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px 0; font-size: 15px; color: ${brandDark}; border-bottom: 2px solid ${brandOrange}; padding-bottom: 6px; display: inline-block;">&#x1F9E9; Tasks</h3>
        <table style="width: 100%; border-collapse: collapse; background: #fafafa; border-radius: 8px; overflow: hidden;">
          ${taskRowsHtml}
        </table>
        ${hasBespokeContent ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #888; font-style: italic; padding-left: 12px;">As you have chosen a bespoke theme you will receive a draft copy of your game around a week before your booking date.</p>` : ""}
      </div>
      ` : ""}

      <!-- Style & Preferences -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px 0; font-size: 15px; color: ${brandDark}; border-bottom: 2px solid ${brandOrange}; padding-bottom: 6px; display: inline-block;">&#x1F3AD; Style</h3>
        <table style="width: 100%; border-collapse: collapse; background: #fafafa; border-radius: 8px; overflow: hidden;">
          ${data.style ? `<tr><td style="padding: 8px 12px; color: ${brandOrange}; font-weight: bold; width: 120px;">Vibe</td><td style="padding: 8px 12px;">${capitalise(data.style)}</td></tr>` : ""}
          ${data.drinkStyle ? `<tr><td style="padding: 8px 12px; color: ${brandOrange}; font-weight: bold;">Drinks</td><td style="padding: 8px 12px;">${capitalise(data.drinkStyle)}</td></tr>` : ""}
          ${data.firstPlacePrize ? `<tr><td style="padding: 8px 12px; color: ${brandOrange}; font-weight: bold;">Prize</td><td style="padding: 8px 12px;">${data.firstPlacePrize === "bring-our-own" ? "Bringing their own" : capitalise(data.firstPlacePrize)}</td></tr>` : ""}
        </table>
      </div>

      ${extras.length > 0 ? `
      <!-- Extras -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px 0; font-size: 15px; color: ${brandDark}; border-bottom: 2px solid ${brandOrange}; padding-bottom: 6px; display: inline-block;">&#x2B50; Extras</h3>
        ${extras.map(e => `<p style="margin: 6px 0; font-size: 14px; color: #555; padding-left: 12px;">&#x2714;&#xFE0F; ${e}</p>`).join("")}
      </div>
      ` : ""}

      <!-- Schedule -->
      ${scheduleHtml}

      <!-- Remember box -->
      <div style="background: ${brandDark}; padding: 20px; border-radius: 10px; margin: 24px 0; color: white;">
        <h3 style="margin: 0 0 12px 0; font-size: 15px; color: ${brandOrange};">&#x26A0;&#xFE0F; Before you go...</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #ccc;">
          <tr><td style="padding: 6px 0; vertical-align: top; width: 24px;">&#x1F4F1;</td><td style="padding: 6px 0;">One person per team needs a Smart Phone to submit tasks</td></tr>
          <tr><td style="padding: 6px 0; vertical-align: top;">&#x1F511;</td><td style="padding: 6px 0;">They will need to sign in through Google using any email address</td></tr>
          <tr><td style="padding: 6px 0; vertical-align: top;">&#x1F50B;</td><td style="padding: 6px 0;">More than 1 phone or battery pack advised</td></tr>
          <tr><td style="padding: 6px 0; vertical-align: top;">&#x1F45F;</td><td style="padding: 6px 0;"><em>Wear comfy footwear and do not forget to count your steps!</em></td></tr>
        </table>
      </div>

      ${data.message ? `
      <!-- Customer message -->
      <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; margin: 0 0 24px 0; border-left: 4px solid ${brandOrange};">
        <p style="font-weight: bold; margin: 0 0 4px 0; font-size: 13px; color: #888;">Your Message</p>
        <p style="margin: 0; font-size: 14px; color: #555;">${data.message}</p>
      </div>
      ` : ""}

      <!-- Footer -->
      <p style="font-size: 14px; color: #555;">Questions? Hit reply or drop us a line at <a href="mailto:info@bucketrace.com" style="color: ${brandOrange}; font-weight: bold; text-decoration: none;">info@bucketrace.com</a></p>
    </div>

    <!-- Brand footer -->
    <div style="background: ${brandDark}; padding: 20px; text-align: center;">
      <p style="margin: 0; color: #888; font-size: 12px;">BucketRace - The World's First Photo Scavenger Hunt</p>
      <p style="margin: 4px 0 0 0; color: #666; font-size: 11px;"><a href="https://bucketrace.com" style="color: ${brandOrange}; text-decoration: none;">bucketrace.com</a></p>
    </div>

  </div>
</body>
</html>`;
}

function buildBookingPaidAdminHtml(data, options) {
  const { brandColour = "#FF6B35" } = options;
  const eventDate = data.eventDate
    ? new Date(data.eventDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "TBC";

  const sections = parseTaskSections(data.taskSections);

  const phoneHtml = data.customerPhone
    ? `<a href="tel:${data.customerPhone}" style="color: ${brandColour};">${data.customerPhone}</a>`
    : "Not provided";

  return wrapFull(
    greyHeader("New Booking Paid", `${data.bookingNumber} - ${formatPence(data.totalPaid || data.totalAmount) || "TBC"}`),
    `
      <h3 style="margin: 0 0 16px 0; color: #333;">Customer Details</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0;">
        ${detailRowBold("Name", data.customerName)}
        ${detailRow("Email", `<a href="mailto:${data.customerEmail}" style="color: ${brandColour};">${data.customerEmail}</a>`)}
        ${detailRow("Phone", phoneHtml)}
        ${data.companyName ? detailRow("Company", data.companyName) : ""}
      </table>

      <h3 style="margin: 0 0 16px 0; color: #333;">Booking Details</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0;">
        ${detailRowBold("Reference", data.bookingNumber)}
        ${detailRow("Event", data.productName || data.eventTitle || "")}
        ${detailRow("Date", eventDate)}
        ${data.eventTime ? detailRow("Time", data.eventTime) : ""}
        ${detailRow("Group Size", data.groupSize ? `${data.groupSize} players` : "")}
        ${data.duration ? detailRow("Duration", `${data.duration} hours`) : ""}
        ${data.groupType ? detailRow("Group Type", data.groupType) : ""}
        ${data.style ? detailRow("Style", data.style) : ""}
        ${data.drinkStyle ? detailRow("Drink Style", data.drinkStyle) : ""}
        ${data.firstPlacePrize ? detailRow("First Place Prize", data.firstPlacePrize) : ""}
        ${detailRowBold("Total Paid", formatPence(data.totalPaid || data.totalAmount))}
      </table>

      ${sections.length > 0 ? `
        <h3 style="margin: 0 0 16px 0; color: #333;">Task Sections</h3>
        <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; margin: 0 0 24px 0;">
          <p style="margin: 0; font-size: 14px;">${formatTaskSections(sections)}</p>
        </div>
      ` : ""}

      <h3 style="margin: 0 0 16px 0; color: #333;">Add-ons</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0;">
        ${detailRow("Medals", data.wantsMedals ? "Yes" : "No")}
        ${detailRow("Photo Prints", data.wantsPhotoPrints ? "Yes" : "No")}
      </table>

      ${data.message ? `
        <h3 style="margin: 0 0 16px 0; color: #333;">Customer Message</h3>
        <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin: 0 0 24px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; font-size: 14px;">${data.message}</p>
        </div>
      ` : ""}

      <h3 style="margin: 0 0 16px 0; color: #333;">Actions Required</h3>
      <ul style="color: #555; padding-left: 20px;">
        <li>Confirm time slot and location with customer</li>
        ${sections.some(s => s.type === "bespoke") ? "<li>Send bespoke questionnaire</li>" : ""}
        ${sections.some(s => s.type === "miscellaneous" && s.miscTheme === "bespoke") ? "<li>Create bespoke misc tasks and send draft for approval</li>" : ""}
        <li>Send event organiser checklist</li>
      </ul>
    `,
    options,
  );
}

// ── Default template map ──────────────────────────────────────────────────────

/**
 * Default templates. Sites can override any of these.
 * Each template is a function: (data, options) => { subject, html }
 *
 * Transactional (immediate):
 *   booking_confirmation      - to customer on enquiry creation
 *   enquiry_notification      - to admin on enquiry creation
 *   invoice_email             - to customer when admin creates invoice
 *   payment_confirmation      - to customer on invoice.paid
 *   internal_payment_notification - to admin on payment
 *
 * Scheduled outreach:
 *   booking_created, booking_quoted, booking_pencilled, booking_paid,
 *   booking_confirmed, booking_cancelled, pencil_expiring, pencil_expired,
 *   event_reminder_7day, event_reminder_1day, post_event_followup,
 *   enquiry_followup_3day, purchase_completed, subscription_renewed,
 *   subscription_cancelled
 */
const DEFAULT_TEMPLATES = {
  // ── Transactional emails ──────────────────────────────────────────────────

  booking_confirmation: (data, options) => ({
    subject: `Enquiry Received - ${data.eventName || data.productName || options.brandName}`,
    html: buildBookingConfirmationHtml(data, options),
  }),

  enquiry_notification: (data, options) => ({
    subject: `New Enquiry - ${data.bookingNumber || data.productName} - ${data.customerName}`,
    html: buildEnquiryNotificationHtml(data, options),
  }),

  invoice_email: (data, options) => ({
    subject: `Invoice ${data.invoiceNumber} - ${formatPence(data.amountDuePence) || "TBC"} - ${data.productName || "Service"}`,
    html: buildInvoiceEmailHtml(data, options),
  }),

  payment_confirmation: (data, options) => ({
    subject: `Payment Confirmed - Invoice ${data.invoiceNumber} - ${data.amountPaid}`,
    html: buildPaymentConfirmationHtml(data, options),
  }),

  internal_payment_notification: (data, options) => ({
    subject: `Invoice Paid - ${data.customerName} (${data.customerEmail}) - Invoice #${data.invoiceNumber}`,
    html: buildInternalPaymentNotificationHtml(data, options),
  }),

  // ── Scheduled outreach ────────────────────────────────────────────────────

  booking_created: (data, options) => ({
    subject: `Booking enquiry received - ${options.brandName}`,
    html: wrapSimple(`
      <h2 style="margin: 0 0 16px 0;">Booking Enquiry Received</h2>
      <p>Hi ${data.customerName || "there"},</p>
      <p>Thanks for your enquiry with ${options.brandName}!</p>
      ${data.bookingNumber ? `<p><strong>Reference:</strong> ${data.bookingNumber}</p>` : ""}
      ${data.eventDate ? `<p><strong>Preferred Date:</strong> ${new Date(data.eventDate).toLocaleDateString("en-GB")}</p>` : ""}
      ${data.groupSize ? `<p><strong>Group Size:</strong> ${data.groupSize}</p>` : ""}
      <p>We will be in touch within 24 hours with more details.</p>
    `, options),
  }),

  booking_quoted: (data, options) => ({
    subject: `Your quote is ready - ${data.bookingNumber || options.brandName}`,
    html: buildBookingQuotedHtml(data, options),
  }),

  booking_pencilled: (data, options) => ({
    subject: `Date pencilled in - ${data.bookingNumber || options.brandName}`,
    html: buildBookingPencilledHtml(data, options),
  }),

  booking_paid: (data, options) => ({
    subject: `Booking Confirmed - ${data.bookingNumber} - ${options.brandName}`,
    html: buildBookingPaidCustomerHtml(data, options),
  }),

  booking_paid_admin: (data, options) => ({
    subject: `New Booking Paid - ${data.bookingNumber} - ${data.customerName} - ${formatPence(data.totalPaid || data.totalAmount) || "TBC"}`,
    html: buildBookingPaidAdminHtml(data, options),
  }),

  booking_confirmed: (data, options) => ({
    subject: `Booking confirmed - ${data.bookingNumber || options.brandName}`,
    html: buildBookingConfirmedHtml(data, options),
  }),

  booking_cancelled: (data, options) => ({
    subject: `Booking cancelled - ${data.bookingNumber || options.brandName}`,
    html: buildBookingCancelledHtml(data, options),
  }),

  pencil_expiring: (data, options) => ({
    subject: `Your booking hold expires soon - ${data.bookingNumber}`,
    html: buildPencilExpiringHtml(data, options),
  }),

  pencil_expired: (data, options) => ({
    subject: `Booking hold expired - ${data.bookingNumber || options.brandName}`,
    html: buildPencilExpiredHtml(data, options),
  }),

  event_reminder_7day: (data, options) => ({
    subject: `Your event is in 7 days - ${data.bookingNumber}`,
    html: buildReminderHtml(data, options, "7 days"),
  }),

  event_reminder_1day: (data, options) => ({
    subject: `Your event is tomorrow - ${data.bookingNumber}`,
    html: buildReminderHtml(data, options, "tomorrow"),
  }),

  post_event_followup: (data, options) => ({
    subject: `How was your experience? - ${options.brandName}`,
    html: buildFollowUpHtml(data, options),
  }),

  enquiry_followup_3day: (data, options) => ({
    subject: `Following up on your enquiry - ${options.brandName}`,
    html: buildEnquiryFollowUpHtml(data, options),
  }),

  purchase_completed: (data, options) => ({
    subject: `Purchase complete - ${options.brandName}`,
    html: buildPurchaseCompletedHtml(data, options),
  }),

  subscription_renewed: (data, options) => ({
    subject: `Subscription renewed - ${options.brandName}`,
    html: buildSubscriptionRenewedHtml(data, options),
  }),

  subscription_cancelled: (data, options) => ({
    subject: `Subscription cancelled - ${options.brandName}`,
    html: buildSubscriptionCancelledHtml(data, options),
  }),
};

/**
 * Get template for a trigger, with site overrides.
 * @param {string} triggerName
 * @param {object} overrides - Site-specific template overrides
 * @returns {Function|null} Template function (data, options) => { subject, html }
 */
function getTemplate(triggerName, overrides = {}) {
  return overrides[triggerName] || DEFAULT_TEMPLATES[triggerName] || null;
}

module.exports = { DEFAULT_TEMPLATES, getTemplate, formatPence };
