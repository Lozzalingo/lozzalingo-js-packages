/**
 * @lozzalingo/email - Multi-Template Email Service
 * Uses Resend API via raw fetch()
 * Factory pattern with configurable branding
 */

const { buildBaseStyles, buildEmailTemplate } = require('./templates');

const RESEND_API_URL = 'https://api.resend.com/emails';

function createEmailService(options = {}) {
  const {
    apiKey = process.env.RESEND_API_KEY,
    fromEmail = process.env.RESEND_FROM_EMAIL,
    replyTo = process.env.RESEND_REPLY_TO,
    brandName = 'Lozzalingo',
    websiteUrl = process.env.NEXTAUTH_URL || process.env.FRONTEND_URL || 'http://localhost:3000',
    adminEmail = process.env.ADMIN_EMAIL,
    style = {},
  } = options;

  console.log(`[Email] Initializing email service for ${brandName}`);

  async function sendEmail({ to, subject, html, text, headers: extraHeaders, maxRetries = 2 }) {
    if (!apiKey) {
      console.error('[Email] RESEND_API_KEY not configured');
      return false;
    }

    const unsubscribeUrl = `${websiteUrl}/unsubscribe`;
    const payload = {
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      reply_to: replyTo,
      subject,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        ...extraHeaders,
      },
    };
    if (text) payload.text = text;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok && data.id) {
          console.log(`[Email] Sent to ${to} (ID: ${data.id})`);
          return true;
        }

        // Rate limited — retry after delay
        if (response.status === 429 && attempt < maxRetries) {
          const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s
          console.log(`[Email] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Bounce detection — 400-level errors indicate bad recipient
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          console.error(`[Email] Bounce/reject for ${to}: ${response.status}`, data);
          return false; // Don't retry client errors
        }

        console.error(`[Email] Failed: ${response.status}`, data);
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt + 1) * 1000;
          console.log(`[Email] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`[Email] Error (attempt ${attempt + 1}):`, error.message);
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt + 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`[Email] All ${maxRetries + 1} attempts failed for ${to}`);
    return false;
  }

  async function sendWelcomeEmail(email, opts = {}) {
    const {
      features = [],
      ctaUrl = `${websiteUrl}/dashboard`,
      ctaText = 'Go to Dashboard',
    } = opts;

    console.log('[Email] Sending welcome email to:', email);

    const featureListHtml = features.length > 0
      ? `<div class="features"><strong>What you can do:</strong><ul>${features.map(f => `<li>${f}</li>`).join('')}</ul></div>`
      : '';

    const html = buildEmailTemplate({
      title: `Welcome to ${brandName}!`,
      body: `
        <h2>Thanks for signing up!</h2>
        <p>Your account has been created successfully.</p>
        ${featureListHtml}
        <p style="text-align: center;">
          <a href="${ctaUrl}" style="display: inline-block; background: ${style.primary || '#3b82f6'}; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">${ctaText}</a>
        </p>
        <p>If you have any questions, just reply to this email.</p>
      `,
      brandName,
      style,
    });

    const text = `Welcome to ${brandName}!\n\nThanks for signing up!\n\nGet started: ${ctaUrl}\n\n${brandName}`;

    return sendEmail({
      to: email,
      subject: `Welcome to ${brandName}!`,
      html,
      text,
    });
  }

  async function sendPasswordResetEmail(email, opts = {}) {
    const { resetUrl, expiresIn = '1 hour' } = opts;
    console.log('[Email] Sending password reset email to:', email);

    const html = buildEmailTemplate({
      title: 'Password Reset',
      body: `
        <h2>Reset Your Password</h2>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <p style="text-align: center;">
          <a href="${resetUrl}" style="display: inline-block; background: ${style.primary || '#3b82f6'}; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Reset Password</a>
        </p>
        <div class="warning">
          <p>This link will expire in ${expiresIn}. If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
        <p style="font-size: 12px; word-break: break-all; color: #6b7280;">Or copy this link: ${resetUrl}</p>
      `,
      brandName,
      style,
    });

    const text = `Password Reset\n\nWe received a request to reset your password.\n\nReset here: ${resetUrl}\n\nThis link expires in ${expiresIn}.\n\n${brandName}`;

    return sendEmail({
      to: email,
      subject: `${brandName} - Reset Your Password`,
      html,
      text,
    });
  }

  async function sendAdminNotification({ subject, body }) {
    const to = adminEmail;
    if (!to) {
      console.error('[Email] ADMIN_EMAIL not configured, skipping admin notification');
      return false;
    }

    console.log('[Email] Sending admin notification:', subject);

    const html = buildEmailTemplate({
      title: subject,
      body: `<p>${body}</p>`,
      brandName: `${brandName} Admin`,
      style,
    });

    return sendEmail({
      to,
      subject: `[${brandName}] ${subject}`,
      html,
      text: `${subject}\n\n${body}\n\n${brandName}`,
    });
  }

  async function sendCustomEmail(email, { subject, templateHtml, heading, body }) {
    console.log('[Email] Sending custom email to:', email);

    // Support both { templateHtml } and { heading, body } patterns
    let content = templateHtml;
    if (!content && (heading || body)) {
      content = `${heading ? `<h2>${heading}</h2>` : ''}${body || ''}`;
    }

    const html = buildEmailTemplate({
      title: subject,
      body: content,
      brandName,
      style,
    });

    return sendEmail({
      to: email,
      subject: `${brandName} - ${subject}`,
      html,
    });
  }

  return {
    sendEmail,
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendAdminNotification,
    sendCustomEmail,
    brandName,
    websiteUrl,
    style,
  };
}

module.exports = { createEmailService };
