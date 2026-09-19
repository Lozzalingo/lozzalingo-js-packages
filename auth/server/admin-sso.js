/**
 * @lozzalingo/auth - Admin SSO Middleware
 * Reads auth_token cookie from auth.laurence.computer, verifies HS256 JWT,
 * and checks is_super_admin or site_access for the current site.
 *
 * Only for admin routes. Does NOT touch NextAuth or public user auth.
 */

const { verifyHS256 } = require('./jwt-verify');

/**
 * Parse cookies from a raw Cookie header string.
 * Falls back to req.cookies if already parsed (e.g. by cookie-parser).
 */
function parseCookies(req) {
  if (req.cookies) return req.cookies;

  const header = req.headers.cookie;
  if (!header) return {};

  const cookies = {};
  header.split(';').forEach((pair) => {
    const [name, ...rest] = pair.trim().split('=');
    if (name) {
      cookies[name.trim()] = decodeURIComponent(rest.join('=').trim());
    }
  });
  return cookies;
}

/**
 * Build the full current URL for redirect purposes.
 */
function getCurrentUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const path = req.originalUrl || req.url;
  return `${protocol}://${host}${path}`;
}

/**
 * Create an admin SSO middleware that verifies auth_token JWTs.
 *
 * @param {string} siteId - identifier for this site (checked against site_access array in JWT)
 * @param {object} [options]
 * @param {string} [options.secret] - JWT secret, defaults to AUTH_JWT_SECRET env var
 * @param {string} [options.authServiceUrl] - auth service URL, defaults to AUTH_SERVICE_URL env var
 * @param {string} [options.cookieName] - cookie name, defaults to 'auth_token'
 * @returns {function} Express middleware
 */
function requireAdminSSO(siteId, options = {}) {
  const secret = options.secret || process.env.AUTH_JWT_SECRET;
  const authServiceUrl = (options.authServiceUrl || process.env.AUTH_SERVICE_URL || 'https://auth.laurence.computer').replace(/\/$/, '');
  const cookieName = options.cookieName || 'auth_token';

  if (!secret) {
    console.error('[AdminSSO] AUTH_JWT_SECRET not set - SSO middleware will reject all requests');
  }

  if (!siteId) {
    console.error('[AdminSSO] No siteId provided - SSO middleware will reject all requests');
  }

  return (req, res, next) => {
    // 1. Extract token from cookie
    const cookies = parseCookies(req);
    const token = cookies[cookieName];

    if (!token) {
      console.log('[AdminSSO] No auth_token cookie found, redirecting to login');
      const redirectUrl = `${authServiceUrl}/login?redirect=${encodeURIComponent(getCurrentUrl(req))}`;

      // API requests get JSON, browser requests get redirect
      if (req.headers.accept?.includes('application/json') || req.xhr) {
        return res.status(401).json({
          error: 'Authentication required',
          loginUrl: redirectUrl,
        });
      }
      return res.redirect(redirectUrl);
    }

    // 2. Verify JWT
    if (!secret) {
      console.error('[AdminSSO] Cannot verify JWT - AUTH_JWT_SECRET not configured');
      return res.status(500).json({ error: 'SSO not configured' });
    }

    const { valid, payload, error } = verifyHS256(token, secret);

    if (!valid) {
      console.log('[AdminSSO] JWT verification failed:', error);
      const redirectUrl = `${authServiceUrl}/login?redirect=${encodeURIComponent(getCurrentUrl(req))}`;

      if (req.headers.accept?.includes('application/json') || req.xhr) {
        return res.status(401).json({
          error: 'Invalid or expired session',
          loginUrl: redirectUrl,
        });
      }
      return res.redirect(redirectUrl);
    }

    // 3. Check admin access
    const { is_super_admin, site_access, email, sub, user_id } = payload;

    // Super admins have access to everything
    if (is_super_admin === true) {
      req.adminUser = {
        id: user_id || sub,
        email,
        isSuperAdmin: true,
        source: 'sso',
      };
      console.log('[AdminSSO] Super admin authenticated:', email);
      return next();
    }

    // Check site_access array
    if (Array.isArray(site_access) && site_access.includes(siteId)) {
      req.adminUser = {
        id: user_id || sub,
        email,
        isSuperAdmin: false,
        siteAccess: site_access,
        source: 'sso',
      };
      console.log('[AdminSSO] Site admin authenticated:', email, 'for', siteId);
      return next();
    }

    // Authenticated but no access to this site
    console.log('[AdminSSO] Access denied for', email, '- no access to site:', siteId);
    return res.status(403).json({
      error: 'You do not have admin access to this site',
      site: siteId,
    });
  };
}

module.exports = { requireAdminSSO, parseCookies, getCurrentUrl };
