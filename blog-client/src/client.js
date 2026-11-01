/**
 * @lozzalingo/blog-client - Shared blog service client.
 *
 * SERVER-SIDE ONLY. The X-API-Key must never reach the browser.
 * Do not import this module from client components or use NEXT_PUBLIC_ env vars.
 *
 * Env vars:
 *   BLOG_SERVICE_URL  - Base URL (default https://blog.laurence.computer)
 *   BLOG_API_KEY      - X-API-Key header value (required)
 *   BLOG_SITE_ID      - Numeric site identifier (required)
 *
 * Console logging prefix: [Blog]
 */

const { MemoryCache } = require('./cache');

const REQUEST_TIMEOUT_MS = 8000;
const SITEMAP_TIMEOUT_MS = 10000;

/**
 * @typedef {Object} BlogClientConfig
 * @property {string}  [serviceUrl]  - Blog service base URL.
 * @property {string}  [apiKey]      - X-API-Key for the blog service.
 * @property {string}  [siteId]      - Site identifier.
 * @property {string}  [userAgent]   - User-Agent header value (default "LozzalingoSite/1.0").
 * @property {number}  [cacheTtlMs]  - Cache TTL in milliseconds (default 60 000).
 * @property {Function} [fallback]   - Optional local-DB fallback hook. Called with (method, args)
 *                                     when the service is unavailable. Should return the same shape
 *                                     as the method it replaces, or null.
 */

class BlogClient {
  /**
   * Create a new BlogClient instance.
   * @param {BlogClientConfig} [config]
   */
  constructor(config = {}) {
    this._serviceUrl = (config.serviceUrl || process.env.BLOG_SERVICE_URL || 'https://blog.laurence.computer').replace(/\/+$/, '');
    this._apiKey = config.apiKey || process.env.BLOG_API_KEY || '';
    this._siteId = config.siteId || process.env.BLOG_SITE_ID || '';
    this._userAgent = config.userAgent || 'LozzalingoSite/1.0';
    this._cache = new MemoryCache(config.cacheTtlMs);
    this._fallback = typeof config.fallback === 'function' ? config.fallback : null;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** @returns {boolean} Whether the service URL and API key are configured. */
  isConfigured() {
    return Boolean(this._serviceUrl && this._apiKey && this._siteId);
  }

  /**
   * Execute an authenticated GET against the blog service.
   * @param {string} path    - Path relative to serviceUrl (e.g. "/api/blog/articles").
   * @param {URLSearchParams} [params] - Query parameters.
   * @param {number} [timeoutMs] - Request timeout (default 8 000 ms).
   * @returns {Promise<Response>}
   */
  async _get(path, params, timeoutMs = REQUEST_TIMEOUT_MS) {
    const qs = params ? `?${params}` : '';
    const url = `${this._serviceUrl}${path}${qs}`;

    return fetch(url, {
      headers: {
        'X-API-Key': this._apiKey,
        'User-Agent': this._userAgent,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  /**
   * Try the local-DB fallback hook if one was provided.
   * @param {string} method - Method name (e.g. "listArticles").
   * @param {*} args        - Arguments to pass through.
   * @returns {Promise<*>}  - Fallback result or null.
   */
  async _tryFallback(method, args) {
    if (!this._fallback) return null;
    try {
      return await this._fallback(method, args);
    } catch (err) {
      console.error(`[Blog] Local fallback failed for ${method}:`, err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * List published articles with pagination, filtering, and search.
   *
   * @param {Object}  [options]
   * @param {number}  [options.page=1]
   * @param {number}  [options.perPage=10]
   * @param {string}  [options.category]  - Filter by category name.
   * @param {string}  [options.tag]       - Filter by tag name.
   * @param {string}  [options.search]    - Full-text search query.
   * @param {string}  [options.status='published'] - Article status filter.
   * @returns {Promise<{ articles: Object[], total: number, page: number, perPage: number, pages: number } | null>}
   */
  async listArticles({ page = 1, perPage = 10, category, tag, search, status = 'published' } = {}) {
    if (!this.isConfigured()) {
      console.log('[Blog] Not configured, falling back');
      return this._tryFallback('listArticles', { page, perPage, category, tag, search, status });
    }

    const cacheKey = `list:${page}:${perPage}:${category || ''}:${tag || ''}:${search || ''}:${status}`;
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        site_id: this._siteId,
        status,
        page: String(page),
        per_page: String(perPage),
      });
      if (category) params.set('category', category);
      if (tag) params.set('tag', tag);
      if (search) params.set('search', search);

      const resp = await this._get('/api/blog/articles', params);

      if (!resp.ok) {
        console.log(`[Blog] listArticles failed: HTTP ${resp.status}`);
        return this._tryFallback('listArticles', { page, perPage, category, tag, search, status });
      }

      const data = await resp.json();
      const articles = data.articles || [];
      const total = data.total || articles.length;

      const result = {
        articles,
        total,
        page,
        perPage,
        pages: Math.ceil(total / perPage),
      };

      this._cache.set(cacheKey, result);
      console.log(`[Blog] Fetched ${articles.length} articles (page ${page}, total ${total})`);
      return result;
    } catch (err) {
      console.error('[Blog] listArticles unavailable:', err.message);
      return this._tryFallback('listArticles', { page, perPage, category, tag, search, status });
    }
  }

  /**
   * Fetch a single article by its slug.
   *
   * @param {string} slug
   * @returns {Promise<Object | null>} The raw article object, or null if not found / unavailable.
   */
  async getArticleBySlug(slug) {
    if (!this.isConfigured()) {
      console.log('[Blog] Not configured, falling back');
      return this._tryFallback('getArticleBySlug', slug);
    }

    const cacheKey = `slug:${slug}`;
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({ site_id: this._siteId });
      const resp = await this._get(`/api/blog/articles/slug/${encodeURIComponent(slug)}`, params);

      if (resp.status === 404) return null;
      if (!resp.ok) {
        console.log(`[Blog] getArticleBySlug failed: HTTP ${resp.status}`);
        return this._tryFallback('getArticleBySlug', slug);
      }

      const article = await resp.json();
      if (article.status !== 'published') return null;

      this._cache.set(cacheKey, article);
      return article;
    } catch (err) {
      console.error(`[Blog] getArticleBySlug unavailable for "${slug}":`, err.message);
      return this._tryFallback('getArticleBySlug', slug);
    }
  }

  /**
   * Fetch a single article by its numeric ID.
   *
   * @param {string|number} id
   * @returns {Promise<Object | null>} The raw article object, or null if not found / unavailable.
   */
  async getArticleById(id) {
    if (!this.isConfigured()) {
      console.log('[Blog] Not configured, falling back');
      return this._tryFallback('getArticleById', id);
    }

    const cacheKey = `id:${id}`;
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({ site_id: this._siteId });
      const resp = await this._get(`/api/blog/articles/${encodeURIComponent(String(id))}`, params);

      if (resp.status === 404) return null;
      if (!resp.ok) {
        console.log(`[Blog] getArticleById failed: HTTP ${resp.status}`);
        return this._tryFallback('getArticleById', id);
      }

      const article = await resp.json();
      this._cache.set(cacheKey, article);
      return article;
    } catch (err) {
      console.error(`[Blog] getArticleById unavailable for "${id}":`, err.message);
      return this._tryFallback('getArticleById', id);
    }
  }

  /**
   * List all categories for this site.
   *
   * @returns {Promise<Array<{ id: string, name: string, slug: string, article_count: number }> | null>}
   */
  async listCategories() {
    if (!this.isConfigured()) {
      console.log('[Blog] Not configured, falling back');
      return this._tryFallback('listCategories', {});
    }

    const cacheKey = 'categories';
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({ site_id: this._siteId });
      const resp = await this._get('/api/blog/categories', params);

      if (!resp.ok) {
        console.log(`[Blog] listCategories failed: HTTP ${resp.status}`);
        return this._tryFallback('listCategories', {});
      }

      const data = await resp.json();
      const categories = data.categories || data || [];

      this._cache.set(cacheKey, categories);
      console.log(`[Blog] Fetched ${categories.length} categories`);
      return categories;
    } catch (err) {
      console.error('[Blog] listCategories unavailable:', err.message);
      return this._tryFallback('listCategories', {});
    }
  }

  /**
   * List all tags for this site.
   *
   * @returns {Promise<Array<{ id: string, name: string, slug: string }> | null>}
   */
  async listTags() {
    if (!this.isConfigured()) {
      console.log('[Blog] Not configured, falling back');
      return this._tryFallback('listTags', {});
    }

    const cacheKey = 'tags';
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({ site_id: this._siteId });
      const resp = await this._get('/api/blog/tags', params);

      if (!resp.ok) {
        console.log(`[Blog] listTags failed: HTTP ${resp.status}`);
        return this._tryFallback('listTags', {});
      }

      const data = await resp.json();
      const tags = data.tags || data || [];

      this._cache.set(cacheKey, tags);
      console.log(`[Blog] Fetched ${tags.length} tags`);
      return tags;
    } catch (err) {
      console.error('[Blog] listTags unavailable:', err.message);
      return this._tryFallback('listTags', {});
    }
  }

  // ---------------------------------------------------------------------------
  // Sitemap & RSS helpers
  // ---------------------------------------------------------------------------

  /**
   * Fetch all published article slugs and dates for sitemap generation.
   * Paginates through all results automatically.
   *
   * @returns {Promise<Array<{ slug: string, updatedAt: string, createdAt: string }> | null>}
   */
  async getSitemapEntries() {
    if (!this.isConfigured()) {
      console.log('[Blog] Not configured, falling back');
      return this._tryFallback('getSitemapEntries', {});
    }

    const cacheKey = 'sitemap';
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

    try {
      const entries = [];
      let page = 1;

      while (true) {
        const params = new URLSearchParams({
          site_id: this._siteId,
          status: 'published',
          page: String(page),
          per_page: '100',
        });

        const resp = await this._get('/api/blog/articles', params, SITEMAP_TIMEOUT_MS);
        if (!resp.ok) {
          console.log(`[Blog] getSitemapEntries page ${page} failed: HTTP ${resp.status}`);
          return entries.length > 0 ? entries : this._tryFallback('getSitemapEntries', {});
        }

        const data = await resp.json();
        const batch = data.articles || [];

        for (const a of batch) {
          entries.push({
            slug: a.slug,
            updatedAt: a.updated_at || a.created_at || '',
            createdAt: a.published_at || a.created_at || '',
          });
        }

        if (!batch.length || entries.length >= (data.total || 0)) break;
        page++;
      }

      this._cache.set(cacheKey, entries);
      console.log(`[Blog] Fetched ${entries.length} sitemap entries`);
      return entries;
    } catch (err) {
      console.error('[Blog] getSitemapEntries unavailable:', err.message);
      return this._tryFallback('getSitemapEntries', {});
    }
  }

  /**
   * Return the public RSS feed URL for this site.
   * The blog service exposes /api/blog/rss/<site_id> without authentication.
   *
   * @returns {string}
   */
  getRssFeedUrl() {
    return `${this._serviceUrl}/api/blog/rss/${this._siteId}`;
  }

  // ---------------------------------------------------------------------------
  // Cache management
  // ---------------------------------------------------------------------------

  /** Clear the in-memory cache (useful after publishing a new article). */
  clearCache() {
    this._cache.clear();
    console.log('[Blog] Cache cleared');
  }
}

module.exports = { BlogClient };
