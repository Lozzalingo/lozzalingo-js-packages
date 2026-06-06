/**
 * Comprehensive Visitor Analytics Controller (Shared)
 * Factory pattern - accepts prisma instance and options
 */
const axios = require("axios");
const requestIp = require("request-ip");

// Bot detection patterns (40+ known bots)
const BOT_PATTERNS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
  'sogou', 'exabot', 'facebot', 'facebookexternalhit', 'ia_archiver',
  'alexacrawler', 'mj12bot', 'ahrefsbot', 'semrushbot', 'dotbot', 'rogerbot',
  'linkedinbot', 'embedly', 'quora link preview', 'showyoubot', 'outbrain',
  'pinterest', 'pinterestbot', 'slackbot', 'vkshare', 'w3c_validator',
  'whatsapp', 'redditbot', 'applebot', 'twitterbot', 'scrapy', 'wget',
  'curl', 'python-requests', 'go-http-client', 'java/', 'apache-httpclient',
  'headlesschrome', 'phantomjs', 'petalbot', 'bytespider', 'gptbot',
  'claudebot', 'anthropic-ai', 'ccbot', 'chatgpt-user', 'google-inspectiontool',
  'google-safety', 'google-extended',
  'uptimerobot', 'monitoring', 'pingdom', 'statuspage', 'datadog',
];

function isKnownBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}

// IP Geolocation cache (24-hour TTL)
const geoCache = new Map();
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Get geolocation for IP address with caching
 */
async function getGeolocation(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' ||
      ip.startsWith('192.168.') || ip.startsWith('10.') ||
      ip.startsWith('172.16.') || ip.startsWith('172.17.') ||
      ip === 'unknown') {
    return {
      city: 'Local',
      country: 'Local',
      region: null,
      latitude: null,
      longitude: null,
    };
  }

  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.timestamp < GEO_CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 3000 });
    if (response.data.status === "success") {
      const data = {
        city: response.data.city,
        country: response.data.country,
        region: response.data.regionName,
        latitude: response.data.lat,
        longitude: response.data.lon,
      };
      geoCache.set(ip, { data, timestamp: Date.now() });
      return data;
    }
  } catch (error) {
    console.error("[Analytics] Geolocation error:", error.message);
  }

  return { city: null, country: null, region: null, latitude: null, longitude: null };
}

// Platform detection dictionaries
const SOCIAL_PLATFORMS = {
  'facebook.com': 'Facebook',
  'fb.me': 'Facebook',
  'fb.com': 'Facebook',
  'l.facebook.com': 'Facebook',
  'lm.facebook.com': 'Facebook',
  'm.facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'l.instagram.com': 'Instagram',
  'twitter.com': 'Twitter/X',
  'x.com': 'Twitter/X',
  't.co': 'Twitter/X',
  'linkedin.com': 'LinkedIn',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'tiktok.com': 'TikTok',
  'pinterest.com': 'Pinterest',
  'reddit.com': 'Reddit',
  'redd.it': 'Reddit',
  'snapchat.com': 'Snapchat',
  'sc-cdn.net': 'Snapchat',
  'whatsapp.com': 'WhatsApp',
  'telegram.org': 'Telegram',
  't.me': 'Telegram',
  'discord.gg': 'Discord',
  'discord.com': 'Discord',
};

const SEARCH_ENGINES = {
  'google.com': 'Google',
  'google.co.uk': 'Google',
  'google.co.za': 'Google',
  'google.ca': 'Google',
  'google.com.au': 'Google',
  'google.de': 'Google',
  'google.fr': 'Google',
  'google.es': 'Google',
  'google.it': 'Google',
  'google.nl': 'Google',
  'google.be': 'Google',
  'google.ie': 'Google',
  'bing.com': 'Bing',
  'yahoo.com': 'Yahoo',
  'duckduckgo.com': 'DuckDuckGo',
  'yandex.com': 'Yandex',
  'yandex.ru': 'Yandex',
  'baidu.com': 'Baidu',
  'ecosia.org': 'Ecosia',
};

/**
 * Parse referrer and return specific platform info
 */
function parseReferrer(referrerUrl, siteDomain) {
  const result = {
    source: 'Direct',
    category: 'Direct',
    platform: null,
    isSocial: false,
    isSearch: false,
  };

  if (!referrerUrl) return result;

  const ref = referrerUrl.toLowerCase();

  // Internal navigation (same site) - treat as Direct
  if (siteDomain && new RegExp(siteDomain.replace('.', '\\.'), 'i').test(ref)) {
    return result;
  }

  try {
    let hostname = ref;
    if (ref.includes('://')) {
      hostname = ref.split('://')[1].split('/')[0];
    }
    hostname = hostname.replace('www.', '');

    if (ref.includes('fbclid=')) {
      return { source: 'Facebook', category: 'Social Media', platform: 'Facebook', isSocial: true, isSearch: false };
    }

    if (ref.includes('igshid=') || ref.includes('utm_source=ig')) {
      return { source: 'Instagram', category: 'Social Media', platform: 'Instagram', isSocial: true, isSearch: false };
    }

    for (const [domain, platform] of Object.entries(SOCIAL_PLATFORMS)) {
      if (hostname.includes(domain) || hostname === domain) {
        return { source: platform, category: 'Social Media', platform, isSocial: true, isSearch: false };
      }
    }

    for (const [domain, engine] of Object.entries(SEARCH_ENGINES)) {
      if (hostname.includes(domain) || hostname === domain) {
        return { source: engine, category: 'Organic Search', platform: engine, isSocial: false, isSearch: true };
      }
    }

    if (/mail\.|gmail\.|outlook\.|mailchimp\.|campaign-archive/i.test(ref)) {
      return { source: 'Email', category: 'Email', platform: 'Email', isSocial: false, isSearch: false };
    }

    if (/googleads\.|doubleclick\.|googlesyndication\.|ads\.|ad\./i.test(ref)) {
      return { source: 'Google Ads', category: 'Paid Ads', platform: 'Google Ads', isSocial: false, isSearch: false };
    }

    const displayName = hostname.split('.')[0];
    return {
      source: hostname,
      category: 'Referral',
      platform: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      isSocial: false,
      isSearch: false,
    };
  } catch (e) {
    return { source: 'Referral', category: 'Referral', platform: null, isSocial: false, isSearch: false };
  }
}

/**
 * Categorize referrer source
 */
function categorizeReferrer(referrer, siteDomain) {
  const parsed = parseReferrer(referrer, siteDomain);
  return parsed.category;
}

/**
 * Helper: Get start date based on time range
 */
function getStartDate(timeRange) {
  const now = new Date();
  switch (timeRange) {
    case 'today':
      return new Date(now.setHours(0, 0, 0, 0));
    case 'yesterday':
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      return yesterday;
    case 'week':
      const week = new Date();
      week.setDate(week.getDate() - 7);
      week.setHours(0, 0, 0, 0);
      return week;
    case 'month':
      const month = new Date();
      month.setMonth(month.getMonth() - 1);
      month.setHours(0, 0, 0, 0);
      return month;
    case '3months':
      const threeMonths = new Date();
      threeMonths.setMonth(threeMonths.getMonth() - 3);
      threeMonths.setHours(0, 0, 0, 0);
      return threeMonths;
    default:
      return new Date(0);
  }
}

/**
 * Create visitor controller with injected prisma and options
 */
function createVisitorController(prisma, options = {}) {
  const { siteDomain = 'localhost', features = {} } = options;

  // Stealth bot reclassification — runs at most once per hour
  let lastBotReclassification = null;
  async function reclassifyStealthBots() {
    const now = Date.now();
    if (lastBotReclassification && (now - lastBotReclassification) < 3600000) return;

    try {
      // Find fingerprints that have page_view events but zero interactive events
      // (page_exit, button_click, etc.) — real browsers always produce these
      const suspects = await prisma.$queryRaw`
        SELECT fingerprint FROM (
          SELECT
            fingerprint,
            COUNT(CASE WHEN "eventType" = 'page_view' THEN 1 END) as page_views,
            COUNT(CASE WHEN "eventType" IN ('page_exit', 'button_click', 'add_to_cart', 'checkout_start', 'purchase') THEN 1 END) as interactions
          FROM "Visitor"
          WHERE fingerprint IS NOT NULL
          AND ("isBot" IS NULL OR "isBot" = false)
          GROUP BY fingerprint
          HAVING page_views > 0 AND interactions = 0
        ) AS suspects
      `;

      if (suspects.length > 0) {
        const fps = suspects.map(s => s.fingerprint);
        const result = await prisma.visitor.updateMany({
          where: { fingerprint: { in: fps }, isBot: { not: true } },
          data: { isBot: true, botType: 'stealth_crawler' },
        });
        if (result.count > 0) {
          console.log(`[Analytics] Reclassified ${result.count} stealth bot events (${fps.length} fingerprints)`);
        }
      }

      lastBotReclassification = now;
    } catch (error) {
      console.error("[Analytics] Bot reclassification error:", error.message);
    }
  }

  const trackView = async (req, res) => {
    try {
      const ip = requestIp.getClientIp(req) || req.body.ip || 'unknown';
      const userAgent = req.get('User-Agent') || req.body.userAgent || '';

      // Comprehensive bot detection
      if (isKnownBot(userAgent) && !req.body.isBot) {
        req.body.isBot = true;
        req.body.botType = 'crawler';
        console.log("[Analytics] Bot detected:", userAgent.substring(0, 60));
      }

      const geo = await getGeolocation(ip);

      const {
        sessionId, sessionPageCount, isNewVisitor = true,
        deviceType, deviceBrand, deviceConfidence, browser, browserVersion, os, osVersion,
        screenWidth, screenHeight, viewportWidth, viewportHeight, pixelRatio, colorDepth,
        touchPoints, orientation, hardwareCores, deviceMemory, connectionType,
        fingerprint, canvasHash, webglHash,
        isBot = false, botType, jsEnabled = true,
        pageLoadTime, timeOnPage,
        utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
        eventType = 'page_view', eventData,
        productViewed, addedToCart = false, checkoutStarted = false, purchaseComplete = false, orderValue,
        path, referrer, referrerCategory,
      } = req.body;

      console.log("[Analytics] Tracking view:", path, "from:", ip);

      const visitor = await prisma.visitor.create({
        data: {
          ip,
          path: path || req.originalUrl || '/',
          referrer: referrer || req.get('Referrer') || null,
          referrerCategory: referrerCategory || categorizeReferrer(referrer || req.get('Referrer'), siteDomain),
          city: geo.city, country: geo.country, region: geo.region,
          latitude: geo.latitude, longitude: geo.longitude,
          sessionId, sessionPageCount, isNewVisitor,
          userAgent, deviceType, deviceBrand, deviceConfidence,
          browser, browserVersion, os, osVersion,
          screenWidth, screenHeight, viewportWidth, viewportHeight,
          pixelRatio, colorDepth, touchPoints, orientation,
          hardwareCores, deviceMemory, connectionType,
          fingerprint, canvasHash, webglHash,
          isBot, botType, jsEnabled,
          pageLoadTime, timeOnPage,
          utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
          eventType,
          eventData: eventData ? JSON.stringify(eventData) : null,
          productViewed, addedToCart, checkoutStarted, purchaseComplete, orderValue,
        },
      });

      // Emit socket event for real-time updates (if socket.io is configured)
      if (req.app.get('io')) {
        req.app.get('io').emit('newVisitorAdded', {
          id: visitor.id, path: visitor.path, country: visitor.country,
          deviceType: visitor.deviceType, timestamp: visitor.timestamp,
        });
      }

      console.log("[Analytics] Tracked visitor:", visitor.id);
      res.status(200).json({ success: true, visitorId: visitor.id });
    } catch (error) {
      console.error("[Analytics] Error tracking visitor:", error);
      res.status(500).json({ error: "Failed to track view" });
    }
  };

  const updateVisitor = async (req, res) => {
    try {
      const { visitorId, timeOnPage, pageLoadTime, eventType } = req.body;

      if (!visitorId) {
        return res.status(400).json({ error: "Visitor ID required" });
      }

      await prisma.visitor.update({
        where: { id: visitorId },
        data: {
          timeOnPage,
          pageLoadTime,
          ...(eventType && { eventType }),
        },
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("[Analytics] Error updating visitor:", error);
      res.status(500).json({ error: "Failed to update visitor" });
    }
  };

  const trackEvent = async (req, res) => {
    try {
      const ip = requestIp.getClientIp(req) || 'unknown';
      const {
        eventType, eventData, productViewed, addedToCart,
        checkoutStarted, purchaseComplete, orderValue, path,
      } = req.body;

      const recentVisitor = await prisma.visitor.findFirst({
        where: { ip },
        orderBy: { timestamp: 'desc' },
        select: { sessionId: true, fingerprint: true },
      });

      const visitor = await prisma.visitor.create({
        data: {
          ip,
          path: path || '/',
          eventType,
          eventData: eventData ? JSON.stringify(eventData) : null,
          productViewed,
          addedToCart: addedToCart || false,
          checkoutStarted: checkoutStarted || false,
          purchaseComplete: purchaseComplete || false,
          orderValue,
          sessionId: recentVisitor?.sessionId,
          fingerprint: recentVisitor?.fingerprint,
        },
      });

      console.log("[Analytics] Tracked event:", eventType, visitor.id);
      res.status(200).json({ success: true, visitorId: visitor.id });
    } catch (error) {
      console.error("[Analytics] Error tracking event:", error);
      res.status(500).json({ error: "Failed to track event" });
    }
  };

  const getVisitorChange = async (req, res) => {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const todayCount = await prisma.visitor.count({
        where: { timestamp: { gte: startOfToday }, isBot: { not: true } },
      });

      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);

      const yesterdayCount = await prisma.visitor.count({
        where: { timestamp: { gte: startOfYesterday, lt: startOfToday }, isBot: { not: true } },
      });

      const percentageChange = yesterdayCount > 0
        ? ((todayCount - yesterdayCount) / yesterdayCount) * 100
        : 0;

      res.json({ todayCount, yesterdayCount, percentageChange: percentageChange.toFixed(1) });
    } catch (error) {
      console.error("[Analytics] Error calculating visitor change:", error);
      res.status(500).json({ error: "Failed to calculate visitor change" });
    }
  };

  const getOverviewStats = async (req, res) => {
    try {
      // Reclassify stealth bots before returning stats (runs at most once/hour)
      await reclassifyStealthBots();

      const { timeRange = 'today' } = req.query;
      const startDate = getStartDate(timeRange);

      const whereClause = { timestamp: { gte: startDate }, isBot: { not: true } };

      const totalPageViews = await prisma.visitor.count({ where: whereClause });

      const uniqueVisitors = await prisma.visitor.groupBy({
        by: ['fingerprint'],
        where: { ...whereClause, fingerprint: { not: null } },
      });

      const newVisitors = await prisma.visitor.count({
        where: { ...whereClause, isNewVisitor: true },
      });

      const avgSessionTime = await prisma.visitor.aggregate({
        _avg: { timeOnPage: true },
        where: { ...whereClause, timeOnPage: { not: null } },
      });

      const avgPagesPerSession = await prisma.visitor.aggregate({
        _avg: { sessionPageCount: true },
        where: { ...whereClause, sessionPageCount: { not: null } },
      });

      const singlePageSessions = await prisma.visitor.count({
        where: { ...whereClause, sessionPageCount: 1 },
      });

      const bounceRate = totalPageViews > 0
        ? ((singlePageSessions / totalPageViews) * 100).toFixed(1)
        : 0;

      res.json({
        totalPageViews,
        uniqueVisitors: uniqueVisitors.length,
        newVisitors,
        returningVisitors: Math.max(0, uniqueVisitors.length - newVisitors),
        avgSessionDuration: Math.round(avgSessionTime._avg.timeOnPage || 0),
        avgPagesPerSession: (avgPagesPerSession._avg.sessionPageCount || 0).toFixed(1),
        bounceRate,
      });
    } catch (error) {
      console.error("[Analytics] Error getting overview stats:", error);
      res.status(500).json({ error: "Failed to get overview stats" });
    }
  };

  const getDeviceStats = async (req, res) => {
    try {
      const { timeRange = 'today' } = req.query;
      const startDate = getStartDate(timeRange);

      const whereClause = { timestamp: { gte: startDate }, isBot: { not: true } };

      const deviceTypes = await prisma.visitor.groupBy({
        by: ['deviceType'],
        where: whereClause,
        _count: { deviceType: true },
      });

      const browsers = await prisma.visitor.groupBy({
        by: ['browser'],
        where: { ...whereClause, browser: { not: null } },
        _count: { browser: true },
        orderBy: { _count: { browser: 'desc' } },
        take: 10,
      });

      const operatingSystems = await prisma.visitor.groupBy({
        by: ['os'],
        where: { ...whereClause, os: { not: null } },
        _count: { os: true },
        orderBy: { _count: { os: 'desc' } },
        take: 10,
      });

      const deviceBrands = await prisma.visitor.groupBy({
        by: ['deviceBrand'],
        where: { ...whereClause, deviceBrand: { not: null } },
        _count: { deviceBrand: true },
        orderBy: { _count: { deviceBrand: 'desc' } },
        take: 10,
      });

      // Screen resolutions - use JS-side concatenation instead of SQL CONCAT()
      let screenResolutions = [];
      try {
        const rawResolutions = await prisma.visitor.groupBy({
          by: ['screenWidth', 'screenHeight'],
          where: {
            ...whereClause,
            screenWidth: { not: null },
            screenHeight: { not: null },
          },
          _count: { screenWidth: true },
          orderBy: { _count: { screenWidth: 'desc' } },
          take: 10,
        });
        screenResolutions = rawResolutions.map(r => ({
          resolution: `${r.screenWidth}x${r.screenHeight}`,
          count: r._count.screenWidth,
        }));
      } catch (err) {
        console.error("[Analytics] Screen resolution query error:", err.message);
      }

      res.json({
        deviceTypes: deviceTypes.map(d => ({ name: d.deviceType || 'Unknown', count: d._count.deviceType })),
        browsers: browsers.map(b => ({ name: b.browser, count: b._count.browser })),
        operatingSystems: operatingSystems.map(o => ({ name: o.os, count: o._count.os })),
        deviceBrands: deviceBrands.map(d => ({ name: d.deviceBrand, count: d._count.deviceBrand })),
        screenResolutions,
      });
    } catch (error) {
      console.error("[Analytics] Error getting device stats:", error);
      res.status(500).json({ error: "Failed to get device stats" });
    }
  };

  const getGeographicStats = async (req, res) => {
    try {
      const { timeRange = 'today' } = req.query;
      const startDate = getStartDate(timeRange);

      const whereClause = { timestamp: { gte: startDate }, isBot: { not: true } };

      const countries = await prisma.visitor.groupBy({
        by: ['country'],
        where: { ...whereClause, country: { not: null } },
        _count: { country: true },
        orderBy: { _count: { country: 'desc' } },
        take: 20,
      });

      const cities = await prisma.visitor.groupBy({
        by: ['city', 'country'],
        where: { ...whereClause, city: { not: null } },
        _count: { city: true },
        orderBy: { _count: { city: 'desc' } },
        take: 20,
      });

      const locations = await prisma.visitor.findMany({
        where: { ...whereClause, latitude: { not: null }, longitude: { not: null } },
        select: { latitude: true, longitude: true, city: true, country: true },
        take: 500,
      });

      res.json({
        countries: countries.map(c => ({ name: c.country, count: c._count.country })),
        cities: cities.map(c => ({ name: `${c.city}, ${c.country}`, count: c._count.city })),
        locations,
      });
    } catch (error) {
      console.error("[Analytics] Error getting geographic stats:", error);
      res.status(500).json({ error: "Failed to get geographic stats" });
    }
  };

  const getTrafficTimeline = async (req, res) => {
    try {
      const { timeRange = 'week' } = req.query;
      const startDate = getStartDate(timeRange);

      // Use Prisma groupBy with date extraction instead of raw SQL
      // This works across both MySQL and SQLite
      let timeline = [];
      try {
        const visitors = await prisma.visitor.findMany({
          where: {
            timestamp: { gte: startDate },
            isBot: { not: true },
          },
          select: {
            timestamp: true,
            fingerprint: true,
            isNewVisitor: true,
          },
          orderBy: { timestamp: 'asc' },
        });

        // Group by date in JS for cross-database compatibility
        const dateMap = {};
        visitors.forEach(v => {
          const date = v.timestamp.toISOString().split('T')[0];
          if (!dateMap[date]) {
            dateMap[date] = { pageViews: 0, fingerprints: new Set(), newVisitors: 0 };
          }
          dateMap[date].pageViews++;
          if (v.fingerprint) dateMap[date].fingerprints.add(v.fingerprint);
          if (v.isNewVisitor) dateMap[date].newVisitors++;
        });

        timeline = Object.entries(dateMap)
          .map(([date, data]) => ({
            date,
            pageViews: data.pageViews,
            uniqueVisitors: data.fingerprints.size,
            newVisitors: data.newVisitors,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
      } catch (err) {
        console.error("[Analytics] Timeline query error:", err.message);
      }

      res.json({ timeline });
    } catch (error) {
      console.error("[Analytics] Error getting traffic timeline:", error);
      res.status(500).json({ error: "Failed to get traffic timeline" });
    }
  };

  const getReferrerStats = async (req, res) => {
    try {
      const { timeRange = 'today' } = req.query;
      const startDate = getStartDate(timeRange);

      const visitors = await prisma.visitor.findMany({
        where: { timestamp: { gte: startDate }, isBot: { not: true } },
        select: {
          sessionId: true, referrer: true, timestamp: true,
          sessionPageCount: true, timeOnPage: true,
        },
        orderBy: { timestamp: 'asc' },
      });

      const sessionMap = new Map();
      const sessionEngagement = new Map();

      visitors.forEach(v => {
        const sessionKey = v.sessionId || `anon_${v.fingerprint || v.ip || v.id}`;

        if (!sessionMap.has(sessionKey)) {
          sessionMap.set(sessionKey, { referrer: v.referrer, timestamp: v.timestamp });
          sessionEngagement.set(sessionKey, { pageCount: 1, totalTime: v.timeOnPage || 0 });
        } else {
          const engagement = sessionEngagement.get(sessionKey);
          engagement.pageCount++;
          engagement.totalTime += v.timeOnPage || 0;
        }
      });

      const platformData = {};
      const categoryCounts = {};
      let totalSessions = 0;

      sessionMap.forEach((session, sessionKey) => {
        const parsed = parseReferrer(session.referrer, siteDomain);
        let platform = parsed.source;
        let category = parsed.category;

        if (platform.toLowerCase() === 'direct') {
          platform = 'Direct';
          category = 'Direct';
        }

        if (platform.toLowerCase().includes('localhost') || platform.includes('127.0.0.1')) {
          return;
        }

        totalSessions++;
        const engagement = sessionEngagement.get(sessionKey);

        if (!platformData[platform]) {
          platformData[platform] = { sessions: 0, totalPages: 0, totalTime: 0, category };
        }
        platformData[platform].sessions++;
        platformData[platform].totalPages += engagement.pageCount;
        platformData[platform].totalTime += engagement.totalTime;

        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });

      const sortedPlatforms = Object.entries(platformData)
        .map(([name, data]) => ({
          name,
          count: data.sessions,
          avgPages: data.sessions > 0 ? (data.totalPages / data.sessions).toFixed(1) : '0',
          avgTime: data.sessions > 0 ? Math.round(data.totalTime / data.sessions) : 0,
        }))
        .sort((a, b) => b.count - a.count);

      const sortedCategories = Object.entries(categoryCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const socialPlatforms = sortedPlatforms.filter(p =>
        ['Facebook', 'Instagram', 'Twitter/X', 'Snapchat', 'TikTok', 'YouTube', 'LinkedIn', 'Pinterest', 'Reddit', 'WhatsApp', 'Telegram', 'Discord'].includes(p.name)
      );

      const searchEngines = sortedPlatforms.filter(p =>
        ['Google', 'Bing', 'Yahoo', 'DuckDuckGo', 'Yandex', 'Baidu', 'Ecosia'].includes(p.name)
      );

      // UTM sources
      const utmVisitors = await prisma.visitor.findMany({
        where: { timestamp: { gte: startDate }, isBot: { not: true }, utmSource: { not: null } },
        select: { sessionId: true, utmSource: true, utmMedium: true, utmCampaign: true, timestamp: true },
        orderBy: { timestamp: 'asc' },
      });

      const utmSessionMap = new Map();
      utmVisitors.forEach(v => {
        const sessionKey = v.sessionId || `anon_${v.fingerprint || v.ip || v.id}`;
        const utmKey = `${v.utmSource}|${v.utmMedium || ''}|${v.utmCampaign || ''}`;
        if (!utmSessionMap.has(sessionKey)) {
          utmSessionMap.set(sessionKey, utmKey);
        }
      });

      const utmCounts = {};
      utmSessionMap.forEach(utmKey => {
        utmCounts[utmKey] = (utmCounts[utmKey] || 0) + 1;
      });

      const utmSources = Object.entries(utmCounts)
        .map(([key, count]) => {
          const [source, medium, campaign] = key.split('|');
          return { source, medium: medium || null, campaign: campaign || null, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      res.json({
        categories: sortedCategories,
        platforms: sortedPlatforms.slice(0, 20),
        socialPlatforms,
        searchEngines,
        referrers: sortedPlatforms.filter(p => p.name !== 'Direct').slice(0, 20),
        utmSources,
        totalVisits: totalSessions,
      });
    } catch (error) {
      console.error("[Analytics] Error getting referrer stats:", error);
      res.status(500).json({ error: "Failed to get referrer stats" });
    }
  };

  const getTopPages = async (req, res) => {
    try {
      const { timeRange = 'today' } = req.query;
      const startDate = getStartDate(timeRange);

      const pages = await prisma.visitor.groupBy({
        by: ['path'],
        where: { timestamp: { gte: startDate }, isBot: { not: true }, path: { not: null } },
        _count: { path: true },
        _avg: { timeOnPage: true },
        orderBy: { _count: { path: 'desc' } },
        take: 20,
      });

      res.json({
        pages: pages.map(p => ({
          path: p.path,
          views: p._count.path,
          avgTimeOnPage: Math.round(p._avg.timeOnPage || 0),
        })),
      });
    } catch (error) {
      console.error("[Analytics] Error getting top pages:", error);
      res.status(500).json({ error: "Failed to get top pages" });
    }
  };

  const getEcommerceFunnel = async (req, res) => {
    try {
      const { timeRange = 'today' } = req.query;
      const startDate = getStartDate(timeRange);
      const whereClause = { timestamp: { gte: startDate }, isBot: { not: true } };

      const productViews = await prisma.visitor.count({
        where: { ...whereClause, eventType: 'product_view' },
      });

      const addedToCart = await prisma.visitor.count({
        where: { ...whereClause, addedToCart: true },
      });

      const checkoutStarted = await prisma.visitor.count({
        where: { ...whereClause, checkoutStarted: true },
      });

      const purchases = await prisma.visitor.count({
        where: { ...whereClause, purchaseComplete: true },
      });

      const revenue = await prisma.visitor.aggregate({
        _sum: { orderValue: true },
        where: { ...whereClause, purchaseComplete: true },
      });

      const topProducts = await prisma.visitor.groupBy({
        by: ['productViewed'],
        where: { ...whereClause, productViewed: { not: null } },
        _count: { productViewed: true },
        orderBy: { _count: { productViewed: 'desc' } },
        take: 10,
      });

      res.json({
        funnel: { productViews, addedToCart, checkoutStarted, purchases },
        conversionRates: {
          viewToCart: productViews > 0 ? ((addedToCart / productViews) * 100).toFixed(1) : 0,
          cartToCheckout: addedToCart > 0 ? ((checkoutStarted / addedToCart) * 100).toFixed(1) : 0,
          checkoutToPurchase: checkoutStarted > 0 ? ((purchases / checkoutStarted) * 100).toFixed(1) : 0,
          overall: productViews > 0 ? ((purchases / productViews) * 100).toFixed(2) : 0,
        },
        totalRevenue: revenue._sum.orderValue || 0,
        topProducts: topProducts.map(p => ({ productId: p.productViewed, views: p._count.productViewed })),
      });
    } catch (error) {
      console.error("[Analytics] Error getting e-commerce funnel:", error);
      res.status(500).json({ error: "Failed to get e-commerce funnel" });
    }
  };

  const getRecentActivity = async (req, res) => {
    try {
      const { limit = 20 } = req.query;

      const activities = await prisma.visitor.findMany({
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit),
        select: {
          id: true, path: true, eventType: true, eventData: true,
          country: true, city: true, deviceType: true, browser: true,
          os: true, timestamp: true, referrerCategory: true, isBot: true,
        },
      });

      res.json({ activities });
    } catch (error) {
      console.error("[Analytics] Error getting recent activity:", error);
      res.status(500).json({ error: "Failed to get recent activity" });
    }
  };

  const getBotStats = async (req, res) => {
    try {
      const { timeRange = 'today' } = req.query;
      const startDate = getStartDate(timeRange);

      const botCount = await prisma.visitor.count({
        where: { timestamp: { gte: startDate }, isBot: true },
      });

      const humanCount = await prisma.visitor.count({
        where: { timestamp: { gte: startDate }, isBot: { not: true } },
      });

      const botTypes = await prisma.visitor.groupBy({
        by: ['botType'],
        where: { timestamp: { gte: startDate }, isBot: true, botType: { not: null } },
        _count: { botType: true },
        orderBy: { _count: { botType: 'desc' } },
      });

      res.json({
        humanCount,
        botCount,
        total: humanCount + botCount,
        botPercentage: ((botCount / (humanCount + botCount)) * 100).toFixed(1),
        botTypes: botTypes.map(b => ({ type: b.botType, count: b._count.botType })),
      });
    } catch (error) {
      console.error("[Analytics] Error getting bot stats:", error);
      res.status(500).json({ error: "Failed to get bot stats" });
    }
  };

  const getInteractionStats = async (req, res) => {
    try {
      const { timeRange = 'today' } = req.query;
      const startDate = getStartDate(timeRange);

      const interactions = await prisma.visitor.groupBy({
        by: ['eventType'],
        where: {
          timestamp: { gte: startDate },
          isBot: { not: true },
          eventType: { not: null, notIn: ['page_view'] },
        },
        _count: { eventType: true },
        orderBy: { _count: { eventType: 'desc' } },
        take: 20,
      });

      const buttonClicks = await prisma.visitor.findMany({
        where: {
          timestamp: { gte: startDate },
          isBot: { not: true },
          eventType: 'button_click',
          eventData: { not: null },
        },
        select: { eventData: true },
      });

      const buttonCounts = {};
      buttonClicks.forEach(click => {
        try {
          const data = typeof click.eventData === 'string'
            ? JSON.parse(click.eventData)
            : click.eventData;
          const buttonName = data?.buttonName || data?.button || 'Unknown';
          buttonCounts[buttonName] = (buttonCounts[buttonName] || 0) + 1;
        } catch (e) {
          // Skip invalid JSON
        }
      });

      const sortedButtons = Object.entries(buttonCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      res.json({
        interactions: interactions.map(i => ({ type: i.eventType, count: i._count.eventType })),
        buttonClicks: sortedButtons,
      });
    } catch (error) {
      console.error("[Analytics] Error getting interaction stats:", error);
      res.status(500).json({ error: "Failed to get interaction stats" });
    }
  };

  /**
   * Combined summary endpoint for Mission Ctrl.
   * Returns overview + top pages + top referrers + top countries in one call.
   * Protected by API key (not admin session).
   */
  const getSummary = async (req, res) => {
    const key = req.query.key || '';
    const expectedKey = process.env.MISSION_CTRL_API_KEY || '';
    if (!expectedKey || key !== expectedKey) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const days = parseInt(req.query.days) || 1;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    try {
      const whereClause = { timestamp: { gte: startDate }, isBot: { not: true } };

      // Overview
      const totalPageViews = await prisma.visitor.count({ where: whereClause });
      const uniqueFingerprints = await prisma.visitor.groupBy({
        by: ['fingerprint'],
        where: { ...whereClause, fingerprint: { not: null } },
      });
      const avgTime = await prisma.visitor.aggregate({
        _avg: { timeOnPage: true },
        where: { ...whereClause, timeOnPage: { not: null } },
      });

      // Bot count
      const botCount = await prisma.visitor.count({
        where: { timestamp: { gte: startDate }, isBot: true },
      });

      // Top pages
      const pages = await prisma.visitor.groupBy({
        by: ['path'],
        where: { ...whereClause, path: { not: null } },
        _count: { path: true },
        _avg: { timeOnPage: true },
        orderBy: { _count: { path: 'desc' } },
        take: 10,
      });

      // Top countries
      const countries = await prisma.visitor.groupBy({
        by: ['country'],
        where: { ...whereClause, country: { not: null } },
        _count: { country: true },
        orderBy: { _count: { country: 'desc' } },
        take: 10,
      });

      // Top referrers (by referrerCategory)
      const referrerData = await prisma.visitor.groupBy({
        by: ['referrerCategory'],
        where: { ...whereClause, referrerCategory: { not: null } },
        _count: { referrerCategory: true },
        orderBy: { _count: { referrerCategory: 'desc' } },
        take: 10,
      });

      console.log("[Analytics] Summary requested by Mission Ctrl");

      res.json({
        overview: {
          totalPageViews,
          uniqueVisitors: uniqueFingerprints.length,
          avgSessionDuration: Math.round(avgTime._avg.timeOnPage || 0),
        },
        botCount,
        pages: pages.map(p => ({ path: p.path, views: p._count.path })),
        countries: countries
          .filter(c => c.country !== 'Local')
          .map(c => ({ name: c.country, count: c._count.country })),
        referrers: referrerData
          .filter(r => r.referrerCategory !== 'Direct')
          .map(r => ({ name: r.referrerCategory, count: r._count.referrerCategory })),
      });
    } catch (error) {
      console.error("[Analytics] Summary error:", error);
      res.status(500).json({ error: "Failed to get summary" });
    }
  };

  return {
    trackView,
    updateVisitor,
    trackEvent,
    getVisitorChange,
    getOverviewStats,
    getDeviceStats,
    getGeographicStats,
    getTrafficTimeline,
    getReferrerStats,
    getTopPages,
    getEcommerceFunnel,
    getRecentActivity,
    getBotStats,
    getInteractionStats,
    getSummary,
  };
}

module.exports = { createVisitorController };
