/**
 * @lozzalingo/email - Email Routes
 * POST /test   — Send test email (admin)
 * GET  /logs   — Email send history (if logging provided)
 */

const express = require('express');

function createEmailRoutes(emailService, prisma) {
  const router = express.Router();

  // POST /test — Send test email
  router.post('/test', async (req, res) => {
    try {
      const { email, type = 'welcome' } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      console.log(`[Email] Sending test email (${type}) to:`, email);
      let success = false;

      switch (type) {
        case 'welcome':
          success = await emailService.sendWelcomeEmail(email, {
            features: ['Feature 1', 'Feature 2', 'Feature 3'],
          });
          break;
        case 'password-reset':
          success = await emailService.sendPasswordResetEmail(email, {
            resetUrl: `${emailService.websiteUrl}/reset-password?token=test-token-12345`,
            expiresIn: '1 hour',
          });
          break;
        case 'admin':
          success = await emailService.sendAdminNotification({
            subject: 'Test Admin Notification',
            body: 'This is a test admin notification from the email dashboard.',
          });
          break;
        case 'custom':
          success = await emailService.sendCustomEmail(email, {
            subject: 'Test Custom Email',
            templateHtml: '<h2>Custom Email Test</h2><p>This is a test of the custom email template system.</p>',
          });
          break;
        default:
          return res.status(400).json({ error: `Invalid email type: ${type}` });
      }

      res.json({ success, type, email });
    } catch (error) {
      console.error('[Email] Test email error:', error.message);
      res.status(500).json({ error: 'Failed to send test email' });
    }
  });

  // GET /logs — Email send history from AppLog (if prisma provided)
  if (prisma) {
    router.get('/logs', async (req, res) => {
      try {
        console.log('[Email] Fetching email logs');
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [logs, total] = await Promise.all([
          prisma.appLog.findMany({
            where: { source: '[Email]' },
            orderBy: { timestamp: 'desc' },
            skip,
            take: parseInt(limit),
          }),
          prisma.appLog.count({ where: { source: '[Email]' } }),
        ]);

        res.json({
          logs,
          total,
          page: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
        });
      } catch (error) {
        console.error('[Email] Error fetching email logs:', error.message);
        res.status(500).json({ error: 'Failed to fetch email logs' });
      }
    });
  }

  return router;
}

module.exports = { createEmailRoutes };
