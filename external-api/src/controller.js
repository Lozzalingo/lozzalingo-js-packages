/**
 * External API Controller
 *
 * Handles CRUD for articles via external API key authentication,
 * plus admin endpoints for API key management.
 *
 * Mirrors the Python lozzalingo-framework external_api module.
 */

const { createApiKeyService } = require("./services/api-keys");
const { createApiKeyMiddleware } = require("./middleware");

function createExternalApiController(prisma, options = {}) {
  const {
    articleModelName = "blogPost",
    categoryModelName = "category",
    slugField = "slug",
    hooks = {},
  } = options;

  const apiKeyService = createApiKeyService(prisma);
  const requireApiKey = createApiKeyMiddleware(apiKeyService);

  console.log("[ExternalAPI] Initialising controller, articleModel:", articleModelName, "categoryModel:", categoryModelName);

  // ── Category resolution ─────────────────────────────────────────────────────

  /**
   * Resolve a category ID from a category object { name, slug } or plain name.
   * Looks up by name (case-insensitive) in the category model.
   * Returns the category ID or null if not found.
   */
  async function resolveCategoryId(categoryData) {
    if (!categoryData) return null;

    const name = typeof categoryData === "string" ? categoryData : categoryData.name;
    if (!name) return null;

    try {
      // Try exact match first
      const categories = await prisma[categoryModelName].findMany({
        where: { name },
        take: 1,
      });

      if (categories.length > 0) {
        console.log("[ExternalAPI] Resolved category:", name, "->", categories[0].id);
        return categories[0].id;
      }

      // Try case-insensitive match
      const allCategories = await prisma[categoryModelName].findMany();
      const matched = allCategories.find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );

      if (matched) {
        console.log("[ExternalAPI] Resolved category (case-insensitive):", name, "->", matched.id);
        return matched.id;
      }

      console.log("[ExternalAPI] Category not found:", name);
      return null;
    } catch (error) {
      console.error("[ExternalAPI] Failed to resolve category:", error.message);
      return null;
    }
  }

  // ── Slug generation ──────────────────────────────────────────────────────────

  function createSlug(title, providedSlug) {
    const base = (providedSlug || title)
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[-\s]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return base;
  }

  async function ensureUniqueSlug(slug) {
    let candidate = slug;
    let counter = 1;

    while (true) {
      const existing = await prisma[articleModelName].findUnique({
        where: { [slugField]: candidate },
      });
      if (!existing) return candidate;
      candidate = `${slug}-${counter}`;
      counter++;
    }
  }

  // ── Article endpoints (API key auth) ─────────────────────────────────────────

  async function getArticles(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const status = req.query.status;

      const where = {};
      if (status === "published") where.published = true;
      if (status === "draft") where.published = false;

      const articles = await prisma[articleModelName].findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      console.log("[ExternalAPI] Listed", articles.length, "articles");
      return res.json({ success: true, articles, count: articles.length });
    } catch (error) {
      console.error("[ExternalAPI] Failed to list articles:", error.message);
      return res.status(500).json({ error: "Failed to fetch articles" });
    }
  }

  async function getArticleById(req, res) {
    try {
      const article = await prisma[articleModelName].findUnique({
        where: { id: req.params.id },
      });

      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      return res.json({ success: true, article });
    } catch (error) {
      console.error("[ExternalAPI] Failed to get article:", error.message);
      return res.status(500).json({ error: "Failed to fetch article" });
    }
  }

  async function createArticle(req, res) {
    try {
      const data = req.body;

      if (!data || !data.title || !data.content) {
        return res.status(400).json({ error: "Title and content are required" });
      }

      const slug = await ensureUniqueSlug(createSlug(data.title, data.slug));

      const createData = {
        title: data.title,
        slug,
        content: data.content,
        coverImage: data.image_url || data.coverImage || null,
        published: data.status === "published",
        excerpt: data.excerpt || null,
        metaTitle: data.meta_title || data.metaTitle || null,
        metaDescription: data.meta_description || data.metaDescription || null,
        authorId: data.author_id || data.authorId || "external-api",
        categoryId: data.category_id || data.categoryId || null,
      };

      // Resolve category by name if categoryId not provided directly
      if (!createData.categoryId && data.category) {
        const resolvedId = await resolveCategoryId(data.category);
        if (resolvedId) {
          createData.categoryId = resolvedId;
          console.log("[ExternalAPI] Category resolved from name:", data.category.name || data.category, "->", resolvedId);
        }
      }

      // Allow source tracking (same as Python)
      if (data.source_id || data.sourceId) {
        createData.sourceId = data.source_id || data.sourceId;
      }
      if (data.source_url || data.sourceUrl) {
        createData.sourceUrl = data.source_url || data.sourceUrl;
      }

      const article = await prisma[articleModelName].create({ data: createData });

      console.log("[ExternalAPI] Article created:", article.id, "slug:", article.slug);

      if (hooks.onCreated) {
        try {
          await hooks.onCreated(article);
        } catch (hookError) {
          console.error("[ExternalAPI] onCreated hook failed:", hookError.message);
        }
      }

      return res.status(201).json({
        success: true,
        id: article.id,
        slug: article.slug,
        status: article.published ? "published" : "draft",
        message: "Article created successfully",
      });
    } catch (error) {
      console.error("[ExternalAPI] Failed to create article:", error.message);
      return res.status(500).json({ error: "Failed to create article" });
    }
  }

  async function updateArticle(req, res) {
    try {
      const data = req.body;

      if (!data) {
        return res.status(400).json({ error: "Request body required" });
      }

      const existing = await prisma[articleModelName].findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Article not found" });
      }

      const updateData = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.content !== undefined) updateData.content = data.content;
      if (data.image_url !== undefined || data.coverImage !== undefined) {
        updateData.coverImage = data.image_url || data.coverImage;
      }
      if (data.status !== undefined) updateData.published = data.status === "published";
      if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
      if (data.meta_title !== undefined || data.metaTitle !== undefined) {
        updateData.metaTitle = data.meta_title || data.metaTitle;
      }
      if (data.meta_description !== undefined || data.metaDescription !== undefined) {
        updateData.metaDescription = data.meta_description || data.metaDescription;
      }

      // Resolve category by name or ID
      if (data.category_id !== undefined || data.categoryId !== undefined) {
        updateData.categoryId = data.category_id || data.categoryId || null;
      } else if (data.category) {
        const resolvedId = await resolveCategoryId(data.category);
        if (resolvedId) {
          updateData.categoryId = resolvedId;
          console.log("[ExternalAPI] Category updated from name:", data.category.name || data.category, "->", resolvedId);
        }
      }

      // Regenerate slug if title changed
      if (data.title && data.title !== existing.title) {
        updateData.slug = await ensureUniqueSlug(createSlug(data.title));
      }

      const article = await prisma[articleModelName].update({
        where: { id: req.params.id },
        data: updateData,
      });

      console.log("[ExternalAPI] Article updated:", article.id);

      if (hooks.onUpdated) {
        try {
          await hooks.onUpdated(article, existing);
        } catch (hookError) {
          console.error("[ExternalAPI] onUpdated hook failed:", hookError.message);
        }
      }

      return res.json({ success: true, message: "Article updated successfully" });
    } catch (error) {
      console.error("[ExternalAPI] Failed to update article:", error.message);
      return res.status(500).json({ error: "Failed to update article" });
    }
  }

  async function deleteArticle(req, res) {
    try {
      const existing = await prisma[articleModelName].findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Article not found" });
      }

      await prisma[articleModelName].delete({ where: { id: req.params.id } });

      console.log("[ExternalAPI] Article deleted:", req.params.id);

      if (hooks.onDeleted) {
        try {
          await hooks.onDeleted(existing);
        } catch (hookError) {
          console.error("[ExternalAPI] onDeleted hook failed:", hookError.message);
        }
      }

      return res.json({ success: true, message: "Article deleted", id: req.params.id });
    } catch (error) {
      console.error("[ExternalAPI] Failed to delete article:", error.message);
      return res.status(500).json({ error: "Failed to delete article" });
    }
  }

  // ── API key admin endpoints (session auth) ───────────────────────────────────

  async function listApiKeys(req, res) {
    try {
      const keys = await apiKeyService.listKeys();
      return res.json(keys);
    } catch (error) {
      console.error("[ExternalAPI] Failed to list API keys:", error.message);
      return res.status(500).json({ error: "Failed to fetch API keys" });
    }
  }

  async function createApiKey(req, res) {
    try {
      const { name, permissions } = req.body || {};

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const result = await apiKeyService.createKey(name, { permissions });

      return res.status(201).json({
        success: true,
        id: result.id,
        apiKey: result.apiKey, // Only shown once
        name: result.name,
        keyPrefix: result.keyPrefix,
        permissions: result.permissions,
        message: "API key created. Copy it now - it will not be shown again!",
      });
    } catch (error) {
      console.error("[ExternalAPI] Failed to create API key:", error.message);
      return res.status(500).json({ error: "Failed to create API key" });
    }
  }

  async function revokeApiKey(req, res) {
    try {
      const success = await apiKeyService.revokeKey(req.params.id);
      if (success) {
        return res.json({ success: true, message: "API key revoked successfully" });
      }
      return res.status(404).json({ error: "API key not found" });
    } catch (error) {
      console.error("[ExternalAPI] Failed to revoke API key:", error.message);
      return res.status(500).json({ error: "Failed to revoke API key" });
    }
  }

  async function deleteApiKey(req, res) {
    try {
      const success = await apiKeyService.deleteKey(req.params.id);
      if (success) {
        return res.json({ success: true, message: "API key permanently deleted" });
      }
      return res.status(404).json({ error: "API key not found" });
    } catch (error) {
      console.error("[ExternalAPI] Failed to delete API key:", error.message);
      return res.status(500).json({ error: "Failed to delete API key" });
    }
  }

  return {
    // Article endpoints
    getArticles,
    getArticleById,
    createArticle,
    updateArticle,
    deleteArticle,
    // API key admin endpoints
    listApiKeys,
    createApiKey,
    revokeApiKey,
    deleteApiKey,
    // Middleware and service (for custom wiring)
    requireApiKey,
    apiKeyService,
  };
}

module.exports = { createExternalApiController };
