/**
 * @lozzalingo/blog-client
 *
 * Shared blog service client for all Lozzalingo JS sites.
 * SERVER-SIDE ONLY. The X-API-Key must never reach the browser.
 *
 * Usage:
 *
 *   const { BlogClient } = require('@lozzalingo/blog-client');
 *
 *   // Reads BLOG_SERVICE_URL, BLOG_API_KEY, BLOG_SITE_ID from env
 *   const blog = new BlogClient();
 *
 *   // Or pass config explicitly
 *   const blog = new BlogClient({
 *     serviceUrl: 'https://blog.laurence.computer',
 *     apiKey: 'your-key',
 *     siteId: '2',
 *     userAgent: 'FatBigQuiz/1.0',
 *   });
 *
 *   // Optional: inject a local-DB fallback
 *   const blog = new BlogClient({
 *     fallback: async (method, args) => {
 *       if (method === 'listArticles') return localDb.getArticles(args);
 *       if (method === 'getArticleBySlug') return localDb.getBySlug(args);
 *       return null;
 *     },
 *   });
 *
 *   // List articles
 *   const result = await blog.listArticles({ page: 1, perPage: 10, category: 'News' });
 *   // => { articles: [...], total: 42, page: 1, perPage: 10, pages: 5 }
 *
 *   // Single article
 *   const article = await blog.getArticleBySlug('my-article');
 *   // => { id, title, slug, content_html, excerpt, ... } or null
 *
 *   // Categories and tags
 *   const categories = await blog.listCategories();
 *   const tags = await blog.listTags();
 *
 *   // Sitemap entries (paginates automatically)
 *   const entries = await blog.getSitemapEntries();
 *   // => [{ slug, updatedAt, createdAt }, ...]
 *
 *   // RSS feed URL (public, no auth)
 *   const rssUrl = blog.getRssFeedUrl();
 *   // => "https://blog.laurence.computer/api/blog/rss/2"
 *
 * Console logging prefix: [Blog]
 */

const { BlogClient } = require('./client');
const { MemoryCache } = require('./cache');

module.exports = { BlogClient, MemoryCache };
