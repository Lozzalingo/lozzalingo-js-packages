# @lozzalingo/blog-client

Shared blog service client for all Lozzalingo JS sites. Server-side only.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BLOG_SERVICE_URL` | No | `https://blog.laurence.computer` | Blog service base URL |
| `BLOG_API_KEY` | Yes | - | X-API-Key for authentication |
| `BLOG_SITE_ID` | Yes | - | Numeric site identifier |

**Never use NEXT_PUBLIC_ prefixed variables for these values.** The API key must stay server-side.

## Quick Start

```js
const { BlogClient } = require('@lozzalingo/blog-client');

const blog = new BlogClient();

// List published articles
const result = await blog.listArticles({ page: 1, perPage: 10 });

// Get single article
const article = await blog.getArticleBySlug('my-post');

// Categories and tags
const categories = await blog.listCategories();
const tags = await blog.listTags();

// Sitemap (paginates automatically)
const entries = await blog.getSitemapEntries();

// RSS (public, no auth needed)
const rssUrl = blog.getRssFeedUrl();
```

## Local-DB Fallback

Inject a fallback function that is called when the blog service is unreachable:

```js
const blog = new BlogClient({
  fallback: async (method, args) => {
    if (method === 'listArticles') {
      const posts = await prisma.blogPost.findMany({ ... });
      return { articles: posts, total: posts.length, page: 1, perPage: 10, pages: 1 };
    }
    if (method === 'getArticleBySlug') {
      return prisma.blogPost.findUnique({ where: { slug: args } });
    }
    return null;
  },
});
```

## API

### `new BlogClient(config?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serviceUrl` | string | `BLOG_SERVICE_URL` env | Blog service base URL |
| `apiKey` | string | `BLOG_API_KEY` env | API key |
| `siteId` | string | `BLOG_SITE_ID` env | Site ID |
| `userAgent` | string | `LozzalingoSite/1.0` | User-Agent header |
| `cacheTtlMs` | number | `60000` | Cache TTL in ms |
| `fallback` | function | null | `(method, args) => result` |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `listArticles(opts)` | `{ articles, total, page, perPage, pages }` or null | Paginated article list |
| `getArticleBySlug(slug)` | article object or null | Single article by slug |
| `getArticleById(id)` | article object or null | Single article by ID |
| `listCategories()` | array or null | All categories for the site |
| `listTags()` | array or null | All tags for the site |
| `getSitemapEntries()` | `[{ slug, updatedAt, createdAt }]` or null | All slugs for sitemap |
| `getRssFeedUrl()` | string | Public RSS feed URL |
| `clearCache()` | void | Flush the in-memory cache |
| `isConfigured()` | boolean | Whether env vars are set |

### `listArticles` Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `perPage` | number | 10 | Articles per page |
| `category` | string | - | Filter by category name |
| `tag` | string | - | Filter by tag name |
| `search` | string | - | Full-text search |
| `status` | string | `published` | Article status |

## Response Shape

Articles are returned in the blog service's native shape (not adapted). Each consuming site should apply its own adapter if the frontend expects different field names. Common fields:

```
id, title, slug, content_html, excerpt, og_image_url, status,
seo_title, seo_description, author, category_id, category_name,
tags, published_at, created_at, updated_at
```

## Graceful Degradation

All methods return `null` (or empty arrays) on failure, never throw. Errors are logged with the `[Blog]` prefix. If a fallback hook is configured, it is tried before returning null.
