/**
 * @lozzalingo/logging - Client Error Endpoint
 * POST /api/logs/client — Receives browser errors, stores in AppLog
 * No auth required (client-side), rate-limited by IP
 */

const express = require('express');

function createClientErrorRoutes(prisma) {
  const router = express.Router();

  // Simple in-memory rate limiter (per IP, 10 errors/minute)
  const ipCounts = new Map();
  setInterval(() => ipCounts.clear(), 60_000);

  router.post('/', async (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;

    // Rate limit
    const count = ipCounts.get(ip) || 0;
    if (count >= 10) {
      return res.status(429).json({ error: 'Too many errors reported' });
    }
    ipCounts.set(ip, count + 1);

    const { message, stack, source, line, column, url, userAgent, project } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    try {
      await prisma.appLog.create({
        data: {
          level: 'ERROR',
          source: 'client-error',
          message: String(message).slice(0, 1000),
          details: JSON.stringify({
            stack: stack ? String(stack).slice(0, 2000) : null,
            sourceFile: source || null,
            line: line || null,
            column: column || null,
            url: url || null,
            project: project || null,
          }),
          ipAddress: ip,
          userAgent: (userAgent || req.headers['user-agent'] || '').slice(0, 500),
          requestPath: url || null,
        },
      });

      console.log(`[ClientError] ${project || '?'}: ${String(message).slice(0, 100)}`);
      res.json({ ok: true });
    } catch (error) {
      console.error('[ClientError] Failed to store error:', error.message);
      res.status(500).json({ error: 'Failed to store error' });
    }
  });

  return router;
}

module.exports = { createClientErrorRoutes };
