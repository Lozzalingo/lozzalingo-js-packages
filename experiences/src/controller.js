const { generateSlug, ensureUniqueSlug } = require("./services/slug");

/**
 * Create an experiences controller with the given Prisma client and options.
 * Product/package/image/section/theme controller.
 *
 * @param {object} prisma - Prisma client instance
 * @param {object} options - Configuration options
 * @returns {object} Controller methods
 */
function createExperienceController(prisma, options = {}) {
  const { hooks = {} } = options;

  console.log("[Experiences] Initialising experiences controller");

  // ── PRODUCTS ──────────────────────────────────────────────────────────────

  /**
   * GET /products - Public list of active products with packages, images, sections.
   */
  async function getAllProducts(req, res) {
    try {
      const { category, active } = req.query;
      const where = {};

      if (active !== "false") where.isActive = true;
      if (category) where.category = category;

      const products = await prisma.product.findMany({
        where,
        orderBy: { displayOrder: "asc" },
        include: {
          packages: {
            where: { isActive: true },
            orderBy: { displayOrder: "asc" },
          },
          images: { orderBy: { sortOrder: "asc" } },
          sections: { orderBy: { displayOrder: "asc" } },
          calendarEvents: {
            where: {
              isPublic: true,
              status: { in: ["SCHEDULED", "LIVE"] },
              startTime: { gte: new Date() },
            },
            orderBy: { startTime: "asc" },
            take: 50,
          },
        },
      });

      console.log(`[Experiences] Fetched ${products.length} products`);
      return res.json(products);
    } catch (error) {
      console.error("[Experiences] Failed to fetch products:", error.message);
      return res.status(500).json({ error: "Failed to fetch products" });
    }
  }

  /**
   * GET /products/slug/:slug - Get product by slug (public).
   */
  async function getProductBySlug(req, res) {
    try {
      const { slug } = req.params;
      const product = await prisma.product.findUnique({
        where: { slug },
        include: {
          packages: {
            where: { isActive: true },
            orderBy: { displayOrder: "asc" },
          },
          images: { orderBy: { sortOrder: "asc" } },
          sections: { orderBy: { displayOrder: "asc" } },
          calendarEvents: {
            where: {
              isPublic: true,
              status: { in: ["SCHEDULED", "LIVE"] },
              startTime: { gte: new Date() },
            },
            orderBy: { startTime: "asc" },
            take: 50,
          },
        },
      });

      if (!product) {
        console.log(`[Experiences] Product not found: ${slug}`);
        return res.status(404).json({ error: "Product not found" });
      }

      console.log(`[Experiences] Fetched product: ${product.name}`);
      return res.json(product);
    } catch (error) {
      console.error("[Experiences] Failed to fetch product:", error.message);
      return res.status(500).json({ error: "Failed to fetch product" });
    }
  }

  /**
   * GET /products/:id - Get product by ID (public).
   */
  async function getProductById(req, res) {
    try {
      const { id } = req.params;
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          packages: { orderBy: { displayOrder: "asc" } },
          images: { orderBy: { sortOrder: "asc" } },
          sections: { orderBy: { displayOrder: "asc" } },
        },
      });

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      return res.json(product);
    } catch (error) {
      console.error("[Experiences] Failed to fetch product:", error.message);
      return res.status(500).json({ error: "Failed to fetch product" });
    }
  }

  /**
   * GET /admin/products - Admin list of all products (all statuses).
   */
  async function getAllProductsAdmin(req, res) {
    try {
      console.log("[Experiences] Admin fetching all products");
      const products = await prisma.product.findMany({
        orderBy: { displayOrder: "asc" },
        include: {
          packages: { orderBy: { displayOrder: "asc" } },
          images: { orderBy: { sortOrder: "asc" } },
          sections: { orderBy: { displayOrder: "asc" } },
        },
      });
      return res.json(products);
    } catch (error) {
      console.error("[Experiences] Failed to fetch admin products:", error.message);
      return res.status(500).json({ error: "Failed to fetch products" });
    }
  }

  /**
   * POST /admin/products - Create product.
   */
  async function createProduct(req, res) {
    try {
      const {
        name, slug, description, shortDesc, coverImage, category,
        tags, format,
        themes, maxGroupSize, venue, duration, ticketLimit,
        isActive, displayOrder,
      } = req.body;

      if (!name || !slug || !description) {
        console.log("[Experiences] Validation failed - missing required fields");
        return res.status(400).json({ error: "Name, slug, and description are required" });
      }

      console.log(`[Experiences] Creating product: ${name}`);
      const product = await prisma.product.create({
        data: {
          name,
          slug,
          description,
          shortDesc: shortDesc || null,
          coverImage: coverImage || null,
          category: category || null,
          tags: tags ? (typeof tags === "string" ? tags : JSON.stringify(tags)) : null,
          format: format || null,
          themes: themes ? (typeof themes === "string" ? themes : JSON.stringify(themes)) : null,
          maxGroupSize: maxGroupSize || null,
          venue: venue ? (typeof venue === "string" ? venue : JSON.stringify(venue)) : null,
          duration: duration || null,
          ticketLimit: ticketLimit || null,
          isActive: isActive !== false,
          displayOrder: displayOrder || 0,
        },
      });

      console.log(`[Experiences] Created product: ${product.id} - ${product.name}`);

      if (hooks.onCreated) {
        try {
          await hooks.onCreated(product);
        } catch (hookError) {
          console.error("[Experiences] onCreated hook failed:", hookError.message);
        }
      }

      return res.status(201).json(product);
    } catch (error) {
      if (error.code === "P2002") {
        console.log(`[Experiences] Duplicate slug: ${req.body.slug}`);
        return res.status(409).json({ error: "A product with this slug already exists" });
      }
      console.error("[Experiences] Failed to create product:", error.message);
      return res.status(500).json({ error: "Failed to create product" });
    }
  }

  /**
   * PUT /admin/products/:id - Update product.
   */
  async function updateProduct(req, res) {
    try {
      const { id } = req.params;
      const {
        name, slug, description, shortDesc, coverImage, category,
        tags, format,
        themes, maxGroupSize, venue, duration, ticketLimit,
        isActive, displayOrder,
      } = req.body;

      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }

      const data = {};
      if (name !== undefined) data.name = name;
      if (slug !== undefined) data.slug = slug;
      if (description !== undefined) data.description = description;
      if (shortDesc !== undefined) data.shortDesc = shortDesc;
      if (coverImage !== undefined) data.coverImage = coverImage;
      if (category !== undefined) data.category = category;
      if (tags !== undefined) data.tags = typeof tags === "string" ? tags : JSON.stringify(tags);
      if (format !== undefined) data.format = format;
      if (themes !== undefined) data.themes = typeof themes === "string" ? themes : JSON.stringify(themes);
      if (maxGroupSize !== undefined) data.maxGroupSize = maxGroupSize;
      if (venue !== undefined) data.venue = typeof venue === "string" ? venue : JSON.stringify(venue);
      if (duration !== undefined) data.duration = duration;
      if (ticketLimit !== undefined) data.ticketLimit = ticketLimit;
      if (isActive !== undefined) data.isActive = isActive;
      if (displayOrder !== undefined) data.displayOrder = displayOrder;

      console.log(`[Experiences] Updating product: ${id} - fields: ${Object.keys(data).join(", ")}`);
      const product = await prisma.product.update({
        where: { id },
        data,
        include: {
          packages: { orderBy: { displayOrder: "asc" } },
          images: { orderBy: { sortOrder: "asc" } },
          sections: { orderBy: { displayOrder: "asc" } },
        },
      });

      console.log(`[Experiences] Updated product: ${product.name}`);

      if (hooks.onUpdated) {
        try {
          await hooks.onUpdated(product, existing);
        } catch (hookError) {
          console.error("[Experiences] onUpdated hook failed:", hookError.message);
        }
      }

      return res.json(product);
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({ error: "A product with this slug already exists" });
      }
      console.error("[Experiences] Failed to update product:", error.message);
      return res.status(500).json({ error: "Failed to update product" });
    }
  }

  /**
   * PUT /admin/products/:id/toggle - Toggle product active status.
   */
  async function toggleProduct(req, res) {
    try {
      const { id } = req.params;
      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const updated = await prisma.product.update({
        where: { id },
        data: { isActive: !product.isActive },
      });

      console.log(`[Experiences] Toggled product ${id}: isActive=${updated.isActive}`);
      return res.json(updated);
    } catch (error) {
      console.error("[Experiences] Failed to toggle product:", error.message);
      return res.status(500).json({ error: "Failed to toggle product" });
    }
  }

  /**
   * DELETE /admin/products/:id - Delete product (only if no bookings).
   */
  async function deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const existing = await prisma.product.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }

      console.log(`[Experiences] Deleting product: ${id}`);
      await prisma.product.delete({ where: { id } });

      if (hooks.onDeleted) {
        try {
          await hooks.onDeleted(existing);
        } catch (hookError) {
          console.error("[Experiences] onDeleted hook failed:", hookError.message);
        }
      }

      return res.status(204).send();
    } catch (error) {
      console.error("[Experiences] Failed to delete product:", error.message);
      return res.status(500).json({ error: "Failed to delete product" });
    }
  }

  // ── PACKAGES ──────────────────────────────────────────────────────────────

  /**
   * GET /packages/product/:productId - List packages for a product (public).
   */
  async function getPackagesByProduct(req, res) {
    try {
      const { productId } = req.params;
      const { active } = req.query;

      const where = { productId };
      if (active !== "false") where.isActive = true;

      const packages = await prisma.package.findMany({
        where,
        orderBy: { displayOrder: "asc" },
        include: {
          product: { select: { name: true, slug: true } },
        },
      });

      console.log(`[Experiences] Fetched ${packages.length} packages for product ${productId}`);
      return res.json(packages);
    } catch (error) {
      console.error("[Experiences] Failed to fetch packages:", error.message);
      return res.status(500).json({ error: "Failed to fetch packages" });
    }
  }

  /**
   * GET /packages/:id - Get package by ID (public).
   */
  async function getPackageById(req, res) {
    try {
      const { id } = req.params;
      const pkg = await prisma.package.findUnique({
        where: { id },
        include: {
          product: { select: { name: true, slug: true } },
        },
      });

      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      return res.json(pkg);
    } catch (error) {
      console.error("[Experiences] Failed to fetch package:", error.message);
      return res.status(500).json({ error: "Failed to fetch package" });
    }
  }

  /**
   * POST /admin/packages - Create package.
   */
  async function createPackage(req, res) {
    try {
      const {
        productId, name, slug, description, duration,
        minPlayers, maxPlayers, pricePerPerson, flatPrice,
        minReserve, additionalPlayerPrice, includes,
        isActive, displayOrder, bookingType,
      } = req.body;

      if (!productId || !name || !slug || !bookingType) {
        console.log("[Experiences] Package validation failed - missing required fields");
        return res.status(400).json({ error: "productId, name, slug, and bookingType are required" });
      }

      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        console.log(`[Experiences] Product not found: ${productId}`);
        return res.status(404).json({ error: "Product not found" });
      }

      console.log(`[Experiences] Creating package: ${name} for product ${product.name}`);
      const pkg = await prisma.package.create({
        data: {
          productId,
          name,
          slug,
          description: description || null,
          duration: duration || null,
          minPlayers: minPlayers ? parseInt(minPlayers) : null,
          maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
          pricePerPerson: pricePerPerson ? parseInt(pricePerPerson) : null,
          flatPrice: flatPrice ? parseInt(flatPrice) : null,
          minReserve: minReserve ? parseInt(minReserve) : null,
          additionalPlayerPrice: additionalPlayerPrice ? parseInt(additionalPlayerPrice) : null,
          includes: includes ? (typeof includes === "string" ? includes : JSON.stringify(includes)) : null,
          isActive: isActive !== false,
          displayOrder: displayOrder || 0,
          bookingType: bookingType.toUpperCase(),
        },
        include: { product: { select: { name: true } } },
      });

      console.log(`[Experiences] Created package: ${pkg.id} - ${pkg.name}`);
      return res.status(201).json(pkg);
    } catch (error) {
      if (error.code === "P2002") {
        console.log(`[Experiences] Duplicate package slug: ${req.body.slug}`);
        return res.status(409).json({ error: "A package with this slug already exists for this product" });
      }
      console.error("[Experiences] Failed to create package:", error.message);
      return res.status(500).json({ error: "Failed to create package" });
    }
  }

  /**
   * PUT /admin/packages/:id - Update package.
   */
  async function updatePackage(req, res) {
    try {
      const { id } = req.params;
      const {
        name, slug, description, duration,
        minPlayers, maxPlayers, pricePerPerson, flatPrice,
        minReserve, additionalPlayerPrice, includes,
        isActive, displayOrder, bookingType,
      } = req.body;

      const existing = await prisma.package.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Package not found" });
      }

      console.log(`[Experiences] Updating package: ${id}`);
      const pkg = await prisma.package.update({
        where: { id },
        data: {
          name, slug, description, duration,
          minPlayers: minPlayers !== undefined ? (minPlayers ? parseInt(minPlayers) : null) : undefined,
          maxPlayers: maxPlayers !== undefined ? (maxPlayers ? parseInt(maxPlayers) : null) : undefined,
          pricePerPerson: pricePerPerson !== undefined ? (pricePerPerson ? parseInt(pricePerPerson) : null) : undefined,
          flatPrice: flatPrice !== undefined ? (flatPrice ? parseInt(flatPrice) : null) : undefined,
          minReserve: minReserve !== undefined ? (minReserve ? parseInt(minReserve) : null) : undefined,
          additionalPlayerPrice: additionalPlayerPrice !== undefined ? (additionalPlayerPrice ? parseInt(additionalPlayerPrice) : null) : undefined,
          includes: includes !== undefined ? (typeof includes === "string" ? includes : JSON.stringify(includes)) : undefined,
          isActive, displayOrder,
          bookingType: bookingType ? bookingType.toUpperCase() : undefined,
        },
        include: { product: { select: { name: true } } },
      });

      console.log(`[Experiences] Updated package: ${pkg.name}`);
      return res.json(pkg);
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({ error: "A package with this slug already exists for this product" });
      }
      console.error("[Experiences] Failed to update package:", error.message);
      return res.status(500).json({ error: "Failed to update package" });
    }
  }

  /**
   * DELETE /admin/packages/:id - Delete package.
   */
  async function deletePackage(req, res) {
    try {
      const { id } = req.params;
      const existing = await prisma.package.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: "Package not found" });
      }

      console.log(`[Experiences] Deleting package: ${id}`);
      await prisma.package.delete({ where: { id } });
      return res.status(204).send();
    } catch (error) {
      console.error("[Experiences] Failed to delete package:", error.message);
      return res.status(500).json({ error: "Failed to delete package" });
    }
  }

  // ── PRODUCT IMAGES ────────────────────────────────────────────────────────

  /**
   * GET /admin/products/:id/images - List gallery images.
   */
  async function getProductImages(req, res) {
    try {
      const images = await prisma.productImage.findMany({
        where: { productId: req.params.id },
        orderBy: { sortOrder: "asc" },
      });
      return res.json(images);
    } catch (error) {
      console.error("[Experiences] Failed to fetch product images:", error.message);
      return res.status(500).json({ error: "Failed to fetch product images" });
    }
  }

  /**
   * POST /admin/products/:id/images - Add images to gallery.
   */
  async function addProductImages(req, res) {
    try {
      const { id } = req.params;
      const { images } = req.body;

      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "images array is required" });
      }

      const maxSort = await prisma.productImage.aggregate({
        where: { productId: id },
        _max: { sortOrder: true },
      });
      let nextOrder = (maxSort._max.sortOrder || 0) + 1;

      const created = await prisma.$transaction(
        images.map((img) =>
          prisma.productImage.create({
            data: {
              productId: id,
              url: img.url,
              alt: img.alt || null,
              sortOrder: img.sortOrder !== undefined ? img.sortOrder : nextOrder++,
            },
          })
        )
      );

      console.log(`[Experiences] Added ${created.length} images to product ${id}`);
      return res.status(201).json(created);
    } catch (error) {
      console.error("[Experiences] Failed to add product images:", error.message);
      return res.status(500).json({ error: "Failed to add product images" });
    }
  }

  /**
   * PUT /admin/products/:id/images/reorder - Reorder gallery images.
   */
  async function reorderProductImages(req, res) {
    try {
      const { id } = req.params;
      const { imageIds } = req.body;

      if (!imageIds || !Array.isArray(imageIds)) {
        return res.status(400).json({ error: "imageIds array is required" });
      }

      await prisma.$transaction(
        imageIds.map((imageId, index) =>
          prisma.productImage.update({
            where: { id: imageId },
            data: { sortOrder: index },
          })
        )
      );

      const images = await prisma.productImage.findMany({
        where: { productId: id },
        orderBy: { sortOrder: "asc" },
      });

      console.log(`[Experiences] Reordered images for product ${id}`);
      return res.json(images);
    } catch (error) {
      console.error("[Experiences] Failed to reorder images:", error.message);
      return res.status(500).json({ error: "Failed to reorder images" });
    }
  }

  /**
   * DELETE /admin/images/:imageId - Delete image.
   */
  async function deleteProductImage(req, res) {
    try {
      const { imageId } = req.params;
      await prisma.productImage.delete({ where: { id: parseInt(imageId) } });
      console.log(`[Experiences] Deleted image: ${imageId}`);
      return res.status(204).send();
    } catch (error) {
      console.error("[Experiences] Failed to delete image:", error.message);
      return res.status(500).json({ error: "Failed to delete image" });
    }
  }

  // ── PRODUCT SECTIONS ──────────────────────────────────────────────────────

  /**
   * POST /admin/products/:id/sections - Create section.
   */
  async function createProductSection(req, res) {
    try {
      const { id } = req.params;
      const { title, type, content, listItems, displayOrder, isCollapsible } = req.body;

      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      let order = displayOrder;
      if (order === undefined || order === null) {
        const maxSection = await prisma.productSection.findFirst({
          where: { productId: id },
          orderBy: { displayOrder: "desc" },
        });
        order = (maxSection?.displayOrder || 0) + 1;
      }

      const section = await prisma.productSection.create({
        data: {
          productId: id,
          title,
          type: type || "text",
          content: content || null,
          listItems: listItems ? (typeof listItems === "string" ? listItems : JSON.stringify(listItems)) : null,
          isCollapsible: isCollapsible !== undefined ? isCollapsible : true,
          displayOrder: order,
        },
      });

      console.log(`[Experiences] Created section: ${section.id} for product ${id}`);
      return res.status(201).json(section);
    } catch (error) {
      console.error("[Experiences] Failed to create section:", error.message);
      return res.status(500).json({ error: "Failed to create section" });
    }
  }

  /**
   * PUT /admin/sections/:sectionId - Update section.
   */
  async function updateProductSection(req, res) {
    try {
      const { sectionId } = req.params;
      const { title, type, content, listItems, displayOrder, isCollapsible } = req.body;

      const data = {};
      if (title !== undefined) data.title = title;
      if (type !== undefined) data.type = type;
      if (content !== undefined) data.content = content || null;
      if (listItems !== undefined) data.listItems = listItems ? (typeof listItems === "string" ? listItems : JSON.stringify(listItems)) : null;
      if (isCollapsible !== undefined) data.isCollapsible = isCollapsible;
      if (displayOrder !== undefined) data.displayOrder = displayOrder;

      const section = await prisma.productSection.update({
        where: { id: parseInt(sectionId) },
        data,
      });

      console.log(`[Experiences] Updated section: ${sectionId}`);
      return res.json(section);
    } catch (error) {
      console.error("[Experiences] Failed to update section:", error.message);
      return res.status(500).json({ error: "Failed to update section" });
    }
  }

  /**
   * PUT /admin/products/:id/sections/reorder - Reorder sections.
   */
  async function reorderProductSections(req, res) {
    try {
      const { id } = req.params;
      const { sectionIds } = req.body;

      if (!sectionIds || !Array.isArray(sectionIds)) {
        return res.status(400).json({ error: "sectionIds array is required" });
      }

      await Promise.all(
        sectionIds.map((sId, index) =>
          prisma.productSection.update({
            where: { id: parseInt(sId) },
            data: { displayOrder: index },
          })
        )
      );

      const sections = await prisma.productSection.findMany({
        where: { productId: id },
        orderBy: { displayOrder: "asc" },
      });

      console.log(`[Experiences] Reordered sections for product ${id}`);
      return res.json(sections);
    } catch (error) {
      console.error("[Experiences] Failed to reorder sections:", error.message);
      return res.status(500).json({ error: "Failed to reorder sections" });
    }
  }

  /**
   * DELETE /admin/sections/:sectionId - Delete section.
   */
  async function deleteProductSection(req, res) {
    try {
      const { sectionId } = req.params;
      await prisma.productSection.delete({ where: { id: parseInt(sectionId) } });
      console.log(`[Experiences] Deleted section: ${sectionId}`);
      return res.status(204).send();
    } catch (error) {
      console.error("[Experiences] Failed to delete section:", error.message);
      return res.status(500).json({ error: "Failed to delete section" });
    }
  }

  // ── THEMES ────────────────────────────────────────────────────────────────

  /**
   * GET /admin/themes - List all themes.
   */
  async function getAllThemes(req, res) {
    try {
      const themes = await prisma.theme.findMany({
        orderBy: { displayOrder: "asc" },
        include: { _count: { select: { products: true } } },
      });
      return res.json(themes);
    } catch (error) {
      console.error("[Experiences] Failed to fetch themes:", error.message);
      return res.status(500).json({ error: "Failed to fetch themes" });
    }
  }

  /**
   * POST /admin/themes - Create theme.
   */
  async function createTheme(req, res) {
    try {
      const { name, slug, description, coverImage, displayOrder } = req.body;
      if (!name || !slug) {
        return res.status(400).json({ error: "Name and slug are required" });
      }

      const theme = await prisma.theme.create({
        data: {
          name,
          slug,
          description: description || null,
          coverImage: coverImage || null,
          displayOrder: displayOrder || 0,
        },
      });

      console.log(`[Experiences] Created theme: ${theme.id} - ${theme.name}`);
      return res.status(201).json(theme);
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({ error: "A theme with this name or slug already exists" });
      }
      console.error("[Experiences] Failed to create theme:", error.message);
      return res.status(500).json({ error: "Failed to create theme" });
    }
  }

  /**
   * PUT /admin/themes/:id - Update theme.
   */
  async function updateTheme(req, res) {
    try {
      const { name, slug, description, coverImage, displayOrder, isActive } = req.body;
      const theme = await prisma.theme.update({
        where: { id: parseInt(req.params.id) },
        data: { name, slug, description, coverImage, displayOrder, isActive },
      });

      console.log(`[Experiences] Updated theme: ${req.params.id}`);
      return res.json(theme);
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({ error: "A theme with this name or slug already exists" });
      }
      console.error("[Experiences] Failed to update theme:", error.message);
      return res.status(500).json({ error: "Failed to update theme" });
    }
  }

  /**
   * DELETE /admin/themes/:id - Delete theme.
   */
  async function deleteTheme(req, res) {
    try {
      await prisma.theme.delete({ where: { id: parseInt(req.params.id) } });
      console.log(`[Experiences] Deleted theme: ${req.params.id}`);
      return res.status(204).send();
    } catch (error) {
      console.error("[Experiences] Failed to delete theme:", error.message);
      return res.status(500).json({ error: "Failed to delete theme" });
    }
  }

  /**
   * PUT /admin/products/:id/themes - Set product themes (replace all).
   */
  async function setProductThemes(req, res) {
    try {
      const { id } = req.params;
      const { themeIds } = req.body;

      if (!themeIds || !Array.isArray(themeIds)) {
        return res.status(400).json({ error: "themeIds array is required" });
      }

      await prisma.productTheme.deleteMany({ where: { productId: id } });
      if (themeIds.length > 0) {
        await prisma.productTheme.createMany({
          data: themeIds.map((themeId) => ({ productId: id, themeId: parseInt(themeId) })),
        });
      }

      const updated = await prisma.productTheme.findMany({
        where: { productId: id },
        include: { theme: true },
      });

      console.log(`[Experiences] Set ${themeIds.length} themes for product ${id}`);
      return res.json(updated);
    } catch (error) {
      console.error("[Experiences] Failed to set product themes:", error.message);
      return res.status(500).json({ error: "Failed to set product themes" });
    }
  }

  return {
    // Products
    getAllProducts,
    getProductBySlug,
    getProductById,
    getAllProductsAdmin,
    createProduct,
    updateProduct,
    toggleProduct,
    deleteProduct,
    // Packages
    getPackagesByProduct,
    getPackageById,
    createPackage,
    updatePackage,
    deletePackage,
    // Product images
    getProductImages,
    addProductImages,
    reorderProductImages,
    deleteProductImage,
    // Product sections
    createProductSection,
    updateProductSection,
    reorderProductSections,
    deleteProductSection,
    // Themes
    getAllThemes,
    createTheme,
    updateTheme,
    deleteTheme,
    setProductThemes,
  };
}

module.exports = { createExperienceController };
