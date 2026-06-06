/**
 * @lozzalingo/merchandise - Product Management Controller
 */

function createMerchandiseController(prisma, storageService, options = {}) {
  const { modelName = 'product' } = options;

  console.log('[Merchandise] Initializing merchandise controller');

  async function getAll(req, res) {
    try {
      console.log('[Merchandise] Fetching products');
      const { page = 1, limit = 50, active, search } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const isAdmin = req.query.admin === 'true';

      const where = {};
      if (!isAdmin) {
        where.isActive = true;
      } else if (active !== undefined) {
        where.isActive = active === 'true';
      }
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
        ];
      }

      const [products, total] = await Promise.all([
        prisma[modelName].findMany({
          where,
          orderBy: { sortOrder: 'asc' },
          skip,
          take: parseInt(limit),
        }),
        prisma[modelName].count({ where }),
      ]);

      // Parse imageUrls JSON
      const parsed = products.map(p => ({
        ...p,
        imageUrls: safeParseJson(p.imageUrls, []),
      }));

      res.json({
        products: parsed,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
    } catch (error) {
      console.error('[Merchandise] Error fetching products:', error.message);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  }

  async function getById(req, res) {
    try {
      const { id } = req.params;
      console.log('[Merchandise] Fetching product:', id);

      const product = await prisma[modelName].findUnique({
        where: { id: parseInt(id) || id },
      });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({
        ...product,
        imageUrls: safeParseJson(product.imageUrls, []),
      });
    } catch (error) {
      console.error('[Merchandise] Error fetching product:', error.message);
      res.status(500).json({ error: 'Failed to fetch product' });
    }
  }

  async function create(req, res) {
    try {
      const {
        name, description, price, stockQuantity = 0,
        isActive = true, isPreorder = false, limitedEdition = false,
        imageUrls = [], sortOrder = 0,
      } = req.body;

      if (!name || price === undefined) {
        return res.status(400).json({ error: 'Name and price are required' });
      }

      console.log('[Merchandise] Creating product:', name);

      const product = await prisma[modelName].create({
        data: {
          name,
          description,
          price: parseInt(price),
          stockQuantity: parseInt(stockQuantity),
          isActive,
          isPreorder,
          limitedEdition,
          imageUrls: JSON.stringify(imageUrls),
          sortOrder: parseInt(sortOrder),
        },
      });

      console.log('[Merchandise] Product created:', product.id);
      res.status(201).json({
        ...product,
        imageUrls: safeParseJson(product.imageUrls, []),
      });
    } catch (error) {
      console.error('[Merchandise] Error creating product:', error.message);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }

  async function update(req, res) {
    try {
      const { id } = req.params;
      const {
        name, description, price, stockQuantity,
        isActive, isPreorder, limitedEdition, imageUrls, sortOrder,
      } = req.body;

      console.log('[Merchandise] Updating product:', id);

      const data = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (price !== undefined) data.price = parseInt(price);
      if (stockQuantity !== undefined) data.stockQuantity = parseInt(stockQuantity);
      if (isActive !== undefined) data.isActive = isActive;
      if (isPreorder !== undefined) data.isPreorder = isPreorder;
      if (limitedEdition !== undefined) data.limitedEdition = limitedEdition;
      if (imageUrls !== undefined) data.imageUrls = JSON.stringify(imageUrls);
      if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder);

      const product = await prisma[modelName].update({
        where: { id: parseInt(id) || id },
        data,
      });

      console.log('[Merchandise] Product updated:', product.id);
      res.json({
        ...product,
        imageUrls: safeParseJson(product.imageUrls, []),
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Product not found' });
      }
      console.error('[Merchandise] Error updating product:', error.message);
      res.status(500).json({ error: 'Failed to update product' });
    }
  }

  async function remove(req, res) {
    try {
      const { id } = req.params;
      console.log('[Merchandise] Deleting product:', id);

      await prisma[modelName].delete({
        where: { id: parseInt(id) || id },
      });

      console.log('[Merchandise] Product deleted');
      res.json({ message: 'Product deleted' });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Product not found' });
      }
      console.error('[Merchandise] Error deleting product:', error.message);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  }

  async function reorder(req, res) {
    try {
      const { items } = req.body; // [{ id, sortOrder }]

      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array is required' });
      }

      console.log('[Merchandise] Reordering products');

      for (const item of items) {
        await prisma[modelName].update({
          where: { id: parseInt(item.id) || item.id },
          data: { sortOrder: item.sortOrder },
        });
      }

      console.log(`[Merchandise] Reordered ${items.length} products`);
      res.json({ message: 'Products reordered' });
    } catch (error) {
      console.error('[Merchandise] Error reordering:', error.message);
      res.status(500).json({ error: 'Failed to reorder products' });
    }
  }

  async function uploadImages(req, res) {
    if (!storageService) {
      return res.status(501).json({ error: 'Storage service not configured' });
    }

    try {
      const { id } = req.params;
      console.log('[Merchandise] Uploading images for product:', id);

      const product = await prisma[modelName].findUnique({
        where: { id: parseInt(id) || id },
      });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const files = req.files ? (Array.isArray(req.files.images) ? req.files.images : [req.files.images]) : [];
      if (files.length === 0) {
        return res.status(400).json({ error: 'No images provided' });
      }

      const existingUrls = safeParseJson(product.imageUrls, []);
      const newUrls = [];

      for (const file of files) {
        const url = await storageService.uploadFile(file.data, file.name, 'products');
        newUrls.push(url);
      }

      const allUrls = [...existingUrls, ...newUrls];
      await prisma[modelName].update({
        where: { id: parseInt(id) || id },
        data: { imageUrls: JSON.stringify(allUrls) },
      });

      console.log(`[Merchandise] Uploaded ${newUrls.length} images for product ${id}`);
      res.json({ imageUrls: allUrls });
    } catch (error) {
      console.error('[Merchandise] Error uploading images:', error.message);
      res.status(500).json({ error: 'Failed to upload images' });
    }
  }

  return { getAll, getById, create, update, remove, reorder, uploadImages };
}

function safeParseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = { createMerchandiseController };
