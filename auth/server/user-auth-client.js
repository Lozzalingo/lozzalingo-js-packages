/**
 * UserAuthClient - client for communicating with the auth service on behalf of users.
 *
 * Requires Node 18+ (native fetch).
 */

class UserAuthClient {
  /**
   * @param {object} opts
   * @param {string} opts.siteId        - Identifier for the current site / tenant.
   * @param {string} [opts.authServiceUrl] - Base URL of the auth service (default: AUTH_SERVICE_URL env var).
   * @param {string} [opts.apiKey]         - Site-level API key  (default: AUTH_SITE_API_KEY env var).
   */
  constructor({ siteId, authServiceUrl, apiKey } = {}) {
    this.siteId = siteId;
    this.authServiceUrl = (authServiceUrl || process.env.AUTH_SERVICE_URL || '').replace(/\/+$/, '');
    this.apiKey = apiKey || process.env.AUTH_SITE_API_KEY || '';

    if (!this.authServiceUrl) {
      console.error('[UserAuthClient] AUTH_SERVICE_URL is not set');
    }
    if (!this.apiKey) {
      console.error('[UserAuthClient] AUTH_SITE_API_KEY is not set');
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Build headers common to every request. */
  _headers(token) {
    const h = {
      'Content-Type': 'application/json',
      'X-Site-API-Key': this.apiKey,
    };
    if (token) {
      h['Authorization'] = `Bearer ${token}`;
    }
    return h;
  }

  /**
   * Generic request helper.
   * @param {string} endpoint - Path relative to /api/users (e.g. "register").
   * @param {object} opts
   * @param {string} [opts.method]  - HTTP method (default POST).
   * @param {object} [opts.body]    - JSON body.
   * @param {string} [opts.token]   - Bearer token for authenticated calls.
   * @returns {Promise<object|null>} Parsed JSON or null on error.
   */
  async _request(endpoint, { method = 'POST', body, token } = {}) {
    const url = `${this.authServiceUrl}/api/users/${endpoint}`;
    const fetchOpts = {
      method,
      headers: this._headers(token),
    };

    if (body) {
      fetchOpts.body = JSON.stringify(body);
    }

    try {
      console.log(`[UserAuthClient] ${method} ${url}`);
      const res = await fetch(url, fetchOpts);
      const json = await res.json();

      if (!res.ok) {
        console.error(`[UserAuthClient] ${method} ${url} responded ${res.status}:`, json);
      }

      return json;
    } catch (err) {
      console.error(`[UserAuthClient] ${method} ${url} failed:`, err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Register a new user.
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.password
   * @param {string} [params.displayName]
   */
  async register({ email, password, displayName }) {
    return this._request('register', {
      body: { siteId: this.siteId, email, password, displayName },
    });
  }

  /**
   * Log in with email and password.
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.password
   */
  async login({ email, password }) {
    return this._request('login', {
      body: { siteId: this.siteId, email, password },
    });
  }

  /**
   * Log out (invalidate a session / token).
   * @param {string} token - The user's current auth token.
   */
  async logout(token) {
    return this._request('logout', { token });
  }

  /**
   * Verify an email address using the token from a verification email.
   * @param {string} verificationToken
   */
  async verifyEmail(verificationToken) {
    return this._request('verify-email', {
      body: { token: verificationToken },
    });
  }

  /**
   * Request a password-reset email.
   * @param {string} email
   */
  async forgotPassword(email) {
    return this._request('forgot-password', {
      body: { siteId: this.siteId, email },
    });
  }

  /**
   * Reset the password using a reset token.
   * @param {object} params
   * @param {string} params.token       - The reset token from the email.
   * @param {string} params.newPassword - The new password.
   */
  async resetPassword({ token, newPassword }) {
    return this._request('reset-password', {
      body: { token, newPassword },
    });
  }

  /**
   * Get the authenticated user's profile.
   * @param {string} token - Bearer token.
   */
  async getProfile(token) {
    return this._request('profile', { method: 'GET', token });
  }

  /**
   * Update the authenticated user's profile.
   * @param {string} token - Bearer token.
   * @param {object} data  - Fields to update.
   */
  async updateProfile(token, data) {
    return this._request('profile', { method: 'PUT', body: data, token });
  }

  /**
   * Handle an OAuth callback - create or link a user from an OAuth provider.
   * @param {object} params
   * @param {string} params.provider
   * @param {string} params.providerId
   * @param {string} params.email
   * @param {string} [params.displayName]
   * @param {string} [params.avatarUrl]
   */
  async oauthCallback({ provider, providerId, email, displayName, avatarUrl }) {
    return this._request('oauth-callback', {
      body: { siteId: this.siteId, provider, providerId, email, displayName, avatarUrl },
    });
  }
}

module.exports = { UserAuthClient };
