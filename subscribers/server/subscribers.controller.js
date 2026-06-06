/**
 * @lozzalingo/subscribers - Subscriber Management Controller
 * CRUD with optIn/reactivation, GDPR compliance
 */

// ===================
// BOT DETECTION
// ===================

// In-memory rate limiter: { ipHash: [timestamp, ...] }
const _ipSignupTimes = {};
const IP_RATE_LIMIT = 3;        // max signups per IP
const IP_RATE_WINDOW = 3600;    // per hour (seconds)
const MIN_SUBMIT_TIME = 3;      // minimum seconds between form load and submit

function isScatteredDotEmail(email) {
  const local = email.split('@')[0];
  const dotCount = (local.match(/\./g) || []).length;
  const charCount = local.replace(/\./g, '').length;
  if (charCount === 0) return true;
  const dotRatio = dotCount / charCount;
  return dotRatio > 0.15 && dotCount >= 3;
}

function checkIpRateLimit(ip) {
  const now = Date.now() / 1000;
  const crypto = require('crypto');
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);

  if (_ipSignupTimes[ipHash]) {
    _ipSignupTimes[ipHash] = _ipSignupTimes[ipHash].filter(t => now - t < IP_RATE_WINDOW);
  } else {
    _ipSignupTimes[ipHash] = [];
  }

  if (_ipSignupTimes[ipHash].length >= IP_RATE_LIMIT) return true;

  _ipSignupTimes[ipHash].push(now);
  return false;
}

function detectBot(body, email, ip) {
  // 1. Honeypot field
  if (body.website || body.url) return { isBot: true, reason: 'honeypot' };

  // 2. Timestamp check — form submitted too fast
  if (body._ts) {
    try {
      const elapsed = Date.now() / 1000 - parseFloat(body._ts);
      if (elapsed < MIN_SUBMIT_TIME) return { isBot: true, reason: 'too_fast' };
    } catch (e) { /* ignore parse errors */ }
  }

  // 3. Scattered dot Gmail pattern
  if (email.includes('@gmail.com') && isScatteredDotEmail(email)) {
    return { isBot: true, reason: 'scattered_dots' };
  }

  // 4. IP rate limiting
  if (checkIpRateLimit(ip)) return { isBot: true, reason: 'rate_limited' };

  return { isBot: false, reason: null };
}

function createSubscriberController(prisma, options = {}) {
  console.log('[Subscribers] Initializing subscriber controller');

  async function subscribe(req, res) {
    try {
      const { email, source = 'website', feeds = [] } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.ip
        || '';

      // Bot detection — silently reject with fake success
      const botCheck = detectBot(req.body, email.toLowerCase(), clientIp);
      if (botCheck.isBot) {
        console.log(`[Subscribers] Bot blocked: ${email} (reason: ${botCheck.reason}, ip: ${clientIp})`);
        return res.status(201).json({ message: 'Subscribed successfully' });
      }

      console.log('[Subscribers] Subscribe request for:', email);

      // Check for existing subscriber
      const existing = await prisma.subscriber.findUnique({ where: { email } });

      if (existing) {
        if (existing.optIn) {
          console.log('[Subscribers] Already subscribed:', email);
          return res.status(200).json({ message: 'Already subscribed', subscriber: existing });
        }
        // Reactivate
        const updated = await prisma.subscriber.update({
          where: { email },
          data: { optIn: true, source, feeds: JSON.stringify(feeds) },
        });
        console.log('[Subscribers] Reactivated:', email);
        return res.status(200).json({ message: 'Subscription reactivated', subscriber: updated });
      }

      const subscriber = await prisma.subscriber.create({
        data: {
          email,
          source,
          feeds: JSON.stringify(feeds),
          ipAddress: req.ip || null,
        },
      });

      console.log('[Subscribers] New subscriber:', email);
      res.status(201).json({ message: 'Subscribed successfully', subscriber });
    } catch (error) {
      console.error('[Subscribers] Error subscribing:', error.message);
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  }

  async function getAll(req, res) {
    try {
      console.log('[Subscribers] Fetching all subscribers');
      const { page = 1, limit = 50, search, optIn } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = {};
      if (search) {
        where.email = { contains: search };
      }
      if (optIn !== undefined) {
        where.optIn = optIn === 'true';
      }

      const [subscribers, total] = await Promise.all([
        prisma.subscriber.findMany({
          where,
          orderBy: { subscribedAt: 'desc' },
          skip,
          take: parseInt(limit),
        }),
        prisma.subscriber.count({ where }),
      ]);

      res.json({
        subscribers,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
    } catch (error) {
      console.error('[Subscribers] Error fetching subscribers:', error.message);
      res.status(500).json({ error: 'Failed to fetch subscribers' });
    }
  }

  async function getStats(req, res) {
    try {
      console.log('[Subscribers] Fetching stats');
      const total = await prisma.subscriber.count();
      const active = await prisma.subscriber.count({ where: { optIn: true } });
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const today = await prisma.subscriber.count({
        where: { subscribedAt: { gte: todayStart } },
      });

      res.json({ total, active, inactive: total - active, today });
    } catch (error) {
      console.error('[Subscribers] Error fetching stats:', error.message);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }

  async function updateByEmail(req, res) {
    try {
      const { email } = req.params;
      const { optIn, feeds } = req.body;

      console.log('[Subscribers] Updating subscriber:', email);

      const data = {};
      if (optIn !== undefined) data.optIn = optIn;
      if (feeds !== undefined) data.feeds = JSON.stringify(feeds);

      const subscriber = await prisma.subscriber.update({
        where: { email },
        data,
      });

      res.json({ message: 'Updated', subscriber });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Subscriber not found' });
      }
      console.error('[Subscribers] Error updating subscriber:', error.message);
      res.status(500).json({ error: 'Failed to update subscriber' });
    }
  }

  async function unsubscribe(req, res) {
    try {
      const { email } = req.params;
      console.log('[Subscribers] Unsubscribe request for:', email);

      await prisma.subscriber.delete({ where: { email } });
      console.log('[Subscribers] Deleted subscriber:', email);
      res.json({ message: 'Unsubscribed successfully' });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Subscriber not found' });
      }
      console.error('[Subscribers] Error unsubscribing:', error.message);
      res.status(500).json({ error: 'Failed to unsubscribe' });
    }
  }

  async function exportCsv(req, res) {
    try {
      console.log('[Subscribers] Exporting CSV');
      const subscribers = await prisma.subscriber.findMany({
        where: { optIn: true },
        orderBy: { subscribedAt: 'desc' },
      });

      const csv = 'email,subscribedAt,source\n' +
        subscribers.map(s => `${s.email},${s.subscribedAt.toISOString()},${s.source || 'website'}`).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv');
      res.send(csv);
    } catch (error) {
      console.error('[Subscribers] Error exporting CSV:', error.message);
      res.status(500).json({ error: 'Failed to export' });
    }
  }

  async function getPopupConfig(req, res) {
    try {
      console.log('[Subscribers] Fetching popup config');
      let config = await prisma.subscriberPopupConfig.findFirst();
      if (!config) {
        config = { id: 1, config: '{}' };
      }
      res.json({ config: JSON.parse(config.config) });
    } catch (error) {
      console.error('[Subscribers] Error fetching popup config:', error.message);
      res.status(500).json({ error: 'Failed to fetch popup config' });
    }
  }

  async function savePopupConfig(req, res) {
    try {
      const { config } = req.body;
      console.log('[Subscribers] Saving popup config');

      const result = await prisma.subscriberPopupConfig.upsert({
        where: { id: 1 },
        update: { config: JSON.stringify(config) },
        create: { id: 1, config: JSON.stringify(config) },
      });

      res.json({ message: 'Popup config saved', config: JSON.parse(result.config) });
    } catch (error) {
      console.error('[Subscribers] Error saving popup config:', error.message);
      res.status(500).json({ error: 'Failed to save popup config' });
    }
  }

  async function getFeeds(req, res) {
    try {
      let popupConfig = await prisma.subscriberPopupConfig.findFirst();
      const config = popupConfig ? JSON.parse(popupConfig.config) : {};
      res.json({ feeds: config.feeds || [], popupConfig: config });
    } catch (error) {
      console.error('[Subscribers] Error fetching feeds:', error.message);
      res.status(500).json({ error: 'Failed to fetch feeds' });
    }
  }

  return {
    subscribe,
    getAll,
    getStats,
    updateByEmail,
    unsubscribe,
    exportCsv,
    getPopupConfig,
    savePopupConfig,
    getFeeds,
  };
}

module.exports = { createSubscriberController };
