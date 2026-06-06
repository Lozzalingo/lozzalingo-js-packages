/**
 * @lozzalingo/auth - Auth Middleware
 * Admin check, auth check, and rate limiting
 */

function createAuthMiddleware(prisma) {
  console.log('[Auth] Initializing auth middleware');

  // Simple in-memory rate limiter
  const rateLimitStore = new Map();

  function requireAdmin(req, res, next) {
    // Assumes session/user is already attached by NextAuth or similar
    if (!req.user || req.user.role !== 'admin') {
      console.log('[Auth] Admin access denied');
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  }

  function requireAuth(req, res, next) {
    if (!req.user) {
      console.log('[Auth] Authentication required');
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  }

  function rateLimit(maxRequests = 5, windowMs = 60000) {
    return (req, res, next) => {
      const key = req.ip || 'unknown';
      const now = Date.now();

      if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return next();
      }

      const entry = rateLimitStore.get(key);
      if (now > entry.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return next();
      }

      entry.count++;
      if (entry.count > maxRequests) {
        console.log(`[Auth] Rate limit exceeded for ${key}`);
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      next();
    };
  }

  // Cleanup stale entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 300000);

  return { requireAdmin, requireAuth, rateLimit };
}

module.exports = { createAuthMiddleware };
