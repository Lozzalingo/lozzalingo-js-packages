const { createExperienceController } = require("../src/controller");
const { generateSlug, ensureUniqueSlug } = require("../src/services/slug");

// Helper to create mock req/res
function mockReqRes(overrides = {}) {
  const req = {
    params: {},
    query: {},
    body: {},
    ...overrides,
  };

  const res = {
    statusCode: 200,
    body: null,
    _sent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send() {
      this._sent = true;
      return this;
    },
  };

  return { req, res };
}

// Mock Prisma client
function createMockPrisma() {
  return {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    package: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    productImage: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    productSection: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    theme: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    productTheme: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe("Experiences Controller - Products", () => {
  let mockPrisma;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    controller = createExperienceController(mockPrisma);
  });

  // ── getAllProducts ──────────────────────────────────────────────────────

  test("getAllProducts returns active products by default", async () => {
    const products = [
      { id: "p1", name: "Scavenger Hunt", isActive: true, packages: [], images: [], sections: [] },
      { id: "p2", name: "Quiz Night", isActive: true, packages: [], images: [], sections: [] },
    ];
    mockPrisma.product.findMany.mockResolvedValue(products);

    const { req, res } = mockReqRes({ query: {} });
    await controller.getAllProducts(req, res);

    expect(res.body).toEqual(products);
    const callArgs = mockPrisma.product.findMany.mock.calls[0][0];
    expect(callArgs.where.isActive).toBe(true);
    expect(callArgs.orderBy).toEqual({ displayOrder: "asc" });
  });

  test("getAllProducts filters by category", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    const { req, res } = mockReqRes({ query: { category: "outdoor" } });
    await controller.getAllProducts(req, res);

    const callArgs = mockPrisma.product.findMany.mock.calls[0][0];
    expect(callArgs.where.category).toBe("outdoor");
  });

  test("getAllProducts includes inactive when active=false", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    const { req, res } = mockReqRes({ query: { active: "false" } });
    await controller.getAllProducts(req, res);

    const callArgs = mockPrisma.product.findMany.mock.calls[0][0];
    expect(callArgs.where.isActive).toBeUndefined();
  });

  test("getAllProducts includes packages, images, sections", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    const { req, res } = mockReqRes({ query: {} });
    await controller.getAllProducts(req, res);

    const callArgs = mockPrisma.product.findMany.mock.calls[0][0];
    expect(callArgs.include.packages).toBeDefined();
    expect(callArgs.include.images).toBeDefined();
    expect(callArgs.include.sections).toBeDefined();
  });

  // ── getProductBySlug ───────────────────────────────────────────────────

  test("getProductBySlug returns product with related data", async () => {
    const product = { id: "p1", name: "Scavenger Hunt", slug: "scavenger-hunt", packages: [], images: [], sections: [] };
    mockPrisma.product.findUnique.mockResolvedValue(product);

    const { req, res } = mockReqRes({ params: { slug: "scavenger-hunt" } });
    await controller.getProductBySlug(req, res);

    expect(res.body.name).toBe("Scavenger Hunt");
    expect(mockPrisma.product.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "scavenger-hunt" } })
    );
  });

  test("getProductBySlug returns 404 for missing product", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({ params: { slug: "nonexistent" } });
    await controller.getProductBySlug(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Product not found");
  });

  // ── getProductById ─────────────────────────────────────────────────────

  test("getProductById returns product", async () => {
    const product = { id: "p1", name: "Scavenger Hunt", packages: [], images: [], sections: [] };
    mockPrisma.product.findUnique.mockResolvedValue(product);

    const { req, res } = mockReqRes({ params: { id: "p1" } });
    await controller.getProductById(req, res);

    expect(res.body.name).toBe("Scavenger Hunt");
  });

  test("getProductById returns 404 for missing product", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({ params: { id: "nonexistent" } });
    await controller.getProductById(req, res);

    expect(res.statusCode).toBe(404);
  });

  // ── createProduct ──────────────────────────────────────────────────────

  test("createProduct creates with all fields", async () => {
    const product = { id: "p1", name: "Scavenger Hunt", slug: "scavenger-hunt", description: "Fun event" };
    mockPrisma.product.create.mockResolvedValue(product);

    const { req, res } = mockReqRes({
      body: { name: "Scavenger Hunt", slug: "scavenger-hunt", description: "Fun event" },
    });
    await controller.createProduct(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe("Scavenger Hunt");
  });

  test("createProduct validates required fields", async () => {
    const { req, res } = mockReqRes({ body: { name: "Test" } });
    await controller.createProduct(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Name, slug, and description are required");
  });

  test("createProduct handles duplicate slug", async () => {
    mockPrisma.product.create.mockRejectedValue({ code: "P2002" });

    const { req, res } = mockReqRes({
      body: { name: "Test", slug: "test", description: "Desc" },
    });
    await controller.createProduct(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("A product with this slug already exists");
  });

  test("createProduct serialises themes as JSON", async () => {
    const themes = ["halloween", "christmas"];
    mockPrisma.product.create.mockResolvedValue({ id: "p1", name: "Test", themes: JSON.stringify(themes) });

    const { req, res } = mockReqRes({
      body: { name: "Test", slug: "test", description: "Desc", themes },
    });
    await controller.createProduct(req, res);

    const createCall = mockPrisma.product.create.mock.calls[0][0];
    expect(createCall.data.themes).toBe(JSON.stringify(themes));
  });

  test("createProduct serialises venue as JSON", async () => {
    const venue = { name: "The Pub", address: "123 High St" };
    mockPrisma.product.create.mockResolvedValue({ id: "p1", name: "Test" });

    const { req, res } = mockReqRes({
      body: { name: "Test", slug: "test", description: "Desc", venue },
    });
    await controller.createProduct(req, res);

    const createCall = mockPrisma.product.create.mock.calls[0][0];
    expect(createCall.data.venue).toBe(JSON.stringify(venue));
  });

  test("createProduct fires onCreated hook", async () => {
    const onCreated = jest.fn();
    const controllerWithHook = createExperienceController(mockPrisma, { hooks: { onCreated } });

    const product = { id: "p1", name: "Test", slug: "test" };
    mockPrisma.product.create.mockResolvedValue(product);

    const { req, res } = mockReqRes({
      body: { name: "Test", slug: "test", description: "Desc" },
    });
    await controllerWithHook.createProduct(req, res);

    expect(onCreated).toHaveBeenCalledWith(product);
  });

  test("createProduct hook errors do not fail the request", async () => {
    const onCreated = jest.fn().mockRejectedValue(new Error("Hook failed"));
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const controllerWithHook = createExperienceController(mockPrisma, { hooks: { onCreated } });

    mockPrisma.product.create.mockResolvedValue({ id: "p1", name: "Test" });

    const { req, res } = mockReqRes({
      body: { name: "Test", slug: "test", description: "Desc" },
    });
    await controllerWithHook.createProduct(req, res);

    expect(res.statusCode).toBe(201);
    expect(consoleSpy).toHaveBeenCalledWith("[Experiences] onCreated hook failed:", "Hook failed");
    consoleSpy.mockRestore();
  });

  // ── updateProduct ──────────────────────────────────────────────────────

  test("updateProduct does partial update", async () => {
    const existing = { id: "p1", name: "Old", slug: "old", description: "Desc" };
    mockPrisma.product.findUnique.mockResolvedValue(existing);
    mockPrisma.product.update.mockResolvedValue({ ...existing, name: "New" });

    const { req, res } = mockReqRes({ params: { id: "p1" }, body: { name: "New" } });
    await controller.updateProduct(req, res);

    const updateCall = mockPrisma.product.update.mock.calls[0][0];
    expect(updateCall.data.name).toBe("New");
    expect(updateCall.data.slug).toBeUndefined();
  });

  test("updateProduct returns 404 for missing product", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({ params: { id: "nonexistent" }, body: { name: "New" } });
    await controller.updateProduct(req, res);

    expect(res.statusCode).toBe(404);
  });

  test("updateProduct fires onUpdated hook with previous record", async () => {
    const onUpdated = jest.fn();
    const controllerWithHook = createExperienceController(mockPrisma, { hooks: { onUpdated } });

    const previous = { id: "p1", name: "Old" };
    const updated = { id: "p1", name: "New" };
    mockPrisma.product.findUnique.mockResolvedValue(previous);
    mockPrisma.product.update.mockResolvedValue(updated);

    const { req, res } = mockReqRes({ params: { id: "p1" }, body: { name: "New" } });
    await controllerWithHook.updateProduct(req, res);

    expect(onUpdated).toHaveBeenCalledWith(updated, previous);
  });

  // ── toggleProduct ──────────────────────────────────────────────────────

  test("toggleProduct flips isActive", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: "p1", isActive: true });
    mockPrisma.product.update.mockResolvedValue({ id: "p1", isActive: false });

    const { req, res } = mockReqRes({ params: { id: "p1" } });
    await controller.toggleProduct(req, res);

    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { isActive: false },
    });
    expect(res.body.isActive).toBe(false);
  });

  test("toggleProduct returns 404 for missing product", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({ params: { id: "nonexistent" } });
    await controller.toggleProduct(req, res);

    expect(res.statusCode).toBe(404);
  });

  // ── deleteProduct ──────────────────────────────────────────────────────

  test("deleteProduct returns 204 on success", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: "p1", name: "Test" });
    mockPrisma.product.delete.mockResolvedValue({});

    const { req, res } = mockReqRes({ params: { id: "p1" } });
    await controller.deleteProduct(req, res);

    expect(res.statusCode).toBe(204);
    expect(res._sent).toBe(true);
  });

  test("deleteProduct returns 404 for missing product", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({ params: { id: "nonexistent" } });
    await controller.deleteProduct(req, res);

    expect(res.statusCode).toBe(404);
  });

  test("deleteProduct fires onDeleted hook", async () => {
    const onDeleted = jest.fn();
    const controllerWithHook = createExperienceController(mockPrisma, { hooks: { onDeleted } });

    const product = { id: "p1", name: "Test" };
    mockPrisma.product.findUnique.mockResolvedValue(product);
    mockPrisma.product.delete.mockResolvedValue({});

    const { req, res } = mockReqRes({ params: { id: "p1" } });
    await controllerWithHook.deleteProduct(req, res);

    expect(onDeleted).toHaveBeenCalledWith(product);
  });
});

describe("Experiences Controller - Packages", () => {
  let mockPrisma;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    controller = createExperienceController(mockPrisma);
  });

  test("getPackagesByProduct returns active packages by default", async () => {
    const packages = [{ id: "pkg1", name: "Standard", productId: "p1" }];
    mockPrisma.package.findMany.mockResolvedValue(packages);

    const { req, res } = mockReqRes({ params: { productId: "p1" }, query: {} });
    await controller.getPackagesByProduct(req, res);

    expect(res.body).toEqual(packages);
    const callArgs = mockPrisma.package.findMany.mock.calls[0][0];
    expect(callArgs.where.productId).toBe("p1");
    expect(callArgs.where.isActive).toBe(true);
  });

  test("getPackagesByProduct includes inactive when active=false", async () => {
    mockPrisma.package.findMany.mockResolvedValue([]);

    const { req, res } = mockReqRes({ params: { productId: "p1" }, query: { active: "false" } });
    await controller.getPackagesByProduct(req, res);

    const callArgs = mockPrisma.package.findMany.mock.calls[0][0];
    expect(callArgs.where.isActive).toBeUndefined();
  });

  test("getPackageById returns package with product info", async () => {
    const pkg = { id: "pkg1", name: "Standard", product: { name: "Hunt", slug: "hunt" } };
    mockPrisma.package.findUnique.mockResolvedValue(pkg);

    const { req, res } = mockReqRes({ params: { id: "pkg1" } });
    await controller.getPackageById(req, res);

    expect(res.body.name).toBe("Standard");
    expect(res.body.product.name).toBe("Hunt");
  });

  test("getPackageById returns 404 for missing package", async () => {
    mockPrisma.package.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({ params: { id: "nonexistent" } });
    await controller.getPackageById(req, res);

    expect(res.statusCode).toBe(404);
  });

  test("createPackage validates required fields", async () => {
    const { req, res } = mockReqRes({ body: { name: "Test" } });
    await controller.createPackage(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("productId, name, slug, and bookingType are required");
  });

  test("createPackage verifies product exists", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({
      body: { productId: "nonexistent", name: "Test", slug: "test", bookingType: "PRIVATE" },
    });
    await controller.createPackage(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Product not found");
  });

  test("createPackage creates with correct data", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: "p1", name: "Hunt" });
    const pkg = { id: "pkg1", name: "Standard", product: { name: "Hunt" } };
    mockPrisma.package.create.mockResolvedValue(pkg);

    const { req, res } = mockReqRes({
      body: {
        productId: "p1", name: "Standard", slug: "standard",
        bookingType: "private", pricePerPerson: 2500,
        minPlayers: 4, maxPlayers: 20,
      },
    });
    await controller.createPackage(req, res);

    expect(res.statusCode).toBe(201);
    const createCall = mockPrisma.package.create.mock.calls[0][0];
    expect(createCall.data.bookingType).toBe("PRIVATE");
    expect(createCall.data.pricePerPerson).toBe(2500);
    expect(createCall.data.minPlayers).toBe(4);
  });

  test("createPackage serialises includes as JSON", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: "p1", name: "Hunt" });
    mockPrisma.package.create.mockResolvedValue({ id: "pkg1", name: "Test", product: { name: "Hunt" } });

    const includes = ["drinks", "food"];
    const { req, res } = mockReqRes({
      body: { productId: "p1", name: "Test", slug: "test", bookingType: "PRIVATE", includes },
    });
    await controller.createPackage(req, res);

    const createCall = mockPrisma.package.create.mock.calls[0][0];
    expect(createCall.data.includes).toBe(JSON.stringify(includes));
  });

  test("createPackage handles duplicate slug", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: "p1", name: "Hunt" });
    mockPrisma.package.create.mockRejectedValue({ code: "P2002" });

    const { req, res } = mockReqRes({
      body: { productId: "p1", name: "Test", slug: "test", bookingType: "PRIVATE" },
    });
    await controller.createPackage(req, res);

    expect(res.statusCode).toBe(409);
  });

  test("updatePackage returns 404 for missing package", async () => {
    mockPrisma.package.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({ params: { id: "nonexistent" }, body: { name: "New" } });
    await controller.updatePackage(req, res);

    expect(res.statusCode).toBe(404);
  });

  test("updatePackage parses integer fields", async () => {
    mockPrisma.package.findUnique.mockResolvedValue({ id: "pkg1" });
    mockPrisma.package.update.mockResolvedValue({ id: "pkg1", name: "Updated", product: { name: "Hunt" } });

    const { req, res } = mockReqRes({
      params: { id: "pkg1" },
      body: { pricePerPerson: "3000", minPlayers: "6" },
    });
    await controller.updatePackage(req, res);

    const updateCall = mockPrisma.package.update.mock.calls[0][0];
    expect(updateCall.data.pricePerPerson).toBe(3000);
    expect(updateCall.data.minPlayers).toBe(6);
  });

  test("deletePackage returns 204 on success", async () => {
    mockPrisma.package.findUnique.mockResolvedValue({ id: "pkg1" });
    mockPrisma.package.delete.mockResolvedValue({});

    const { req, res } = mockReqRes({ params: { id: "pkg1" } });
    await controller.deletePackage(req, res);

    expect(res.statusCode).toBe(204);
  });

  test("deletePackage returns 404 for missing package", async () => {
    mockPrisma.package.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({ params: { id: "nonexistent" } });
    await controller.deletePackage(req, res);

    expect(res.statusCode).toBe(404);
  });
});

describe("Experiences Controller - Product Images", () => {
  let mockPrisma;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    controller = createExperienceController(mockPrisma);
  });

  test("getProductImages returns sorted images", async () => {
    const images = [
      { id: 1, url: "img1.jpg", sortOrder: 0 },
      { id: 2, url: "img2.jpg", sortOrder: 1 },
    ];
    mockPrisma.productImage.findMany.mockResolvedValue(images);

    const { req, res } = mockReqRes({ params: { id: "p1" } });
    await controller.getProductImages(req, res);

    expect(res.body).toEqual(images);
    const callArgs = mockPrisma.productImage.findMany.mock.calls[0][0];
    expect(callArgs.orderBy).toEqual({ sortOrder: "asc" });
  });

  test("addProductImages validates images array", async () => {
    const { req, res } = mockReqRes({ params: { id: "p1" }, body: {} });
    await controller.addProductImages(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("images array is required");
  });

  test("addProductImages creates images in transaction", async () => {
    mockPrisma.productImage.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
    const created = [
      { id: 1, url: "img1.jpg", sortOrder: 3 },
      { id: 2, url: "img2.jpg", sortOrder: 4 },
    ];
    mockPrisma.$transaction.mockResolvedValue(created);

    const { req, res } = mockReqRes({
      params: { id: "p1" },
      body: { images: [{ url: "img1.jpg" }, { url: "img2.jpg", alt: "Photo" }] },
    });
    await controller.addProductImages(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(created);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  test("reorderProductImages validates imageIds array", async () => {
    const { req, res } = mockReqRes({ params: { id: "p1" }, body: {} });
    await controller.reorderProductImages(req, res);

    expect(res.statusCode).toBe(400);
  });

  test("reorderProductImages updates sort order and returns images", async () => {
    const reordered = [
      { id: 2, sortOrder: 0 },
      { id: 1, sortOrder: 1 },
    ];
    mockPrisma.$transaction.mockResolvedValue([]);
    mockPrisma.productImage.findMany.mockResolvedValue(reordered);

    const { req, res } = mockReqRes({
      params: { id: "p1" },
      body: { imageIds: [2, 1] },
    });
    await controller.reorderProductImages(req, res);

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(res.body).toEqual(reordered);
  });

  test("deleteProductImage returns 204", async () => {
    mockPrisma.productImage.delete.mockResolvedValue({});

    const { req, res } = mockReqRes({ params: { imageId: "5" } });
    await controller.deleteProductImage(req, res);

    expect(res.statusCode).toBe(204);
    expect(mockPrisma.productImage.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });
});

describe("Experiences Controller - Product Sections", () => {
  let mockPrisma;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    controller = createExperienceController(mockPrisma);
  });

  test("createProductSection validates title required", async () => {
    const { req, res } = mockReqRes({ params: { id: "p1" }, body: {} });
    await controller.createProductSection(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Title is required");
  });

  test("createProductSection auto-increments displayOrder", async () => {
    mockPrisma.productSection.findFirst.mockResolvedValue({ displayOrder: 3 });
    const section = { id: 1, title: "Overview", type: "text", displayOrder: 4 };
    mockPrisma.productSection.create.mockResolvedValue(section);

    const { req, res } = mockReqRes({
      params: { id: "p1" },
      body: { title: "Overview" },
    });
    await controller.createProductSection(req, res);

    expect(res.statusCode).toBe(201);
    const createCall = mockPrisma.productSection.create.mock.calls[0][0];
    expect(createCall.data.displayOrder).toBe(4);
    expect(createCall.data.type).toBe("text");
    expect(createCall.data.isCollapsible).toBe(true);
  });

  test("createProductSection serialises listItems as JSON", async () => {
    mockPrisma.productSection.findFirst.mockResolvedValue(null);
    mockPrisma.productSection.create.mockResolvedValue({ id: 1, title: "Steps" });

    const listItems = ["Step 1", "Step 2", "Step 3"];
    const { req, res } = mockReqRes({
      params: { id: "p1" },
      body: { title: "Steps", type: "steps", listItems },
    });
    await controller.createProductSection(req, res);

    const createCall = mockPrisma.productSection.create.mock.calls[0][0];
    expect(createCall.data.listItems).toBe(JSON.stringify(listItems));
  });

  test("updateProductSection does partial update", async () => {
    mockPrisma.productSection.update.mockResolvedValue({ id: 1, title: "Updated" });

    const { req, res } = mockReqRes({
      params: { sectionId: "1" },
      body: { title: "Updated" },
    });
    await controller.updateProductSection(req, res);

    const updateCall = mockPrisma.productSection.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe(1);
    expect(updateCall.data.title).toBe("Updated");
    expect(updateCall.data.type).toBeUndefined();
  });

  test("reorderProductSections validates sectionIds array", async () => {
    const { req, res } = mockReqRes({ params: { id: "p1" }, body: {} });
    await controller.reorderProductSections(req, res);

    expect(res.statusCode).toBe(400);
  });

  test("reorderProductSections updates display order", async () => {
    mockPrisma.productSection.update.mockResolvedValue({});
    const sections = [{ id: 2, displayOrder: 0 }, { id: 1, displayOrder: 1 }];
    mockPrisma.productSection.findMany.mockResolvedValue(sections);

    const { req, res } = mockReqRes({
      params: { id: "p1" },
      body: { sectionIds: [2, 1] },
    });
    await controller.reorderProductSections(req, res);

    expect(mockPrisma.productSection.update).toHaveBeenCalledTimes(2);
    expect(res.body).toEqual(sections);
  });

  test("deleteProductSection returns 204", async () => {
    mockPrisma.productSection.delete.mockResolvedValue({});

    const { req, res } = mockReqRes({ params: { sectionId: "3" } });
    await controller.deleteProductSection(req, res);

    expect(res.statusCode).toBe(204);
    expect(mockPrisma.productSection.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });
});

describe("Experiences Controller - Themes", () => {
  let mockPrisma;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    controller = createExperienceController(mockPrisma);
  });

  test("getAllThemes returns themes with product counts", async () => {
    const themes = [
      { id: 1, name: "Halloween", _count: { products: 3 } },
      { id: 2, name: "Christmas", _count: { products: 1 } },
    ];
    mockPrisma.theme.findMany.mockResolvedValue(themes);

    const { req, res } = mockReqRes();
    await controller.getAllThemes(req, res);

    expect(res.body).toEqual(themes);
    const callArgs = mockPrisma.theme.findMany.mock.calls[0][0];
    expect(callArgs.include._count.select.products).toBe(true);
  });

  test("createTheme validates required fields", async () => {
    const { req, res } = mockReqRes({ body: { name: "Test" } });
    await controller.createTheme(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Name and slug are required");
  });

  test("createTheme creates with correct data", async () => {
    const theme = { id: 1, name: "Halloween", slug: "halloween" };
    mockPrisma.theme.create.mockResolvedValue(theme);

    const { req, res } = mockReqRes({
      body: { name: "Halloween", slug: "halloween", description: "Spooky events" },
    });
    await controller.createTheme(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe("Halloween");
  });

  test("createTheme handles duplicate", async () => {
    mockPrisma.theme.create.mockRejectedValue({ code: "P2002" });

    const { req, res } = mockReqRes({ body: { name: "Halloween", slug: "halloween" } });
    await controller.createTheme(req, res);

    expect(res.statusCode).toBe(409);
  });

  test("updateTheme updates fields", async () => {
    mockPrisma.theme.update.mockResolvedValue({ id: 1, name: "Updated" });

    const { req, res } = mockReqRes({ params: { id: "1" }, body: { name: "Updated" } });
    await controller.updateTheme(req, res);

    expect(mockPrisma.theme.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ name: "Updated" }),
    });
  });

  test("deleteTheme returns 204", async () => {
    mockPrisma.theme.delete.mockResolvedValue({});

    const { req, res } = mockReqRes({ params: { id: "5" } });
    await controller.deleteTheme(req, res);

    expect(res.statusCode).toBe(204);
    expect(mockPrisma.theme.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  test("setProductThemes replaces all themes", async () => {
    mockPrisma.productTheme.deleteMany.mockResolvedValue({});
    mockPrisma.productTheme.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.productTheme.findMany.mockResolvedValue([
      { productId: "p1", themeId: 1, theme: { name: "Halloween" } },
      { productId: "p1", themeId: 2, theme: { name: "Christmas" } },
    ]);

    const { req, res } = mockReqRes({
      params: { id: "p1" },
      body: { themeIds: [1, 2] },
    });
    await controller.setProductThemes(req, res);

    expect(mockPrisma.productTheme.deleteMany).toHaveBeenCalledWith({ where: { productId: "p1" } });
    expect(mockPrisma.productTheme.createMany).toHaveBeenCalledWith({
      data: [
        { productId: "p1", themeId: 1 },
        { productId: "p1", themeId: 2 },
      ],
    });
    expect(res.body).toHaveLength(2);
  });

  test("setProductThemes validates themeIds array", async () => {
    const { req, res } = mockReqRes({ params: { id: "p1" }, body: {} });
    await controller.setProductThemes(req, res);

    expect(res.statusCode).toBe(400);
  });

  test("setProductThemes handles empty themeIds", async () => {
    mockPrisma.productTheme.deleteMany.mockResolvedValue({});
    mockPrisma.productTheme.findMany.mockResolvedValue([]);

    const { req, res } = mockReqRes({
      params: { id: "p1" },
      body: { themeIds: [] },
    });
    await controller.setProductThemes(req, res);

    expect(mockPrisma.productTheme.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.productTheme.createMany).not.toHaveBeenCalled();
    expect(res.body).toEqual([]);
  });
});

describe("Slug Service", () => {
  test("generateSlug creates URL-safe slug from title", () => {
    expect(generateSlug("My Quiz Night")).toBe("my-quiz-night");
    expect(generateSlug("Hello  World!")).toBe("hello-world");
    expect(generateSlug("  Spaces  ")).toBe("spaces");
    expect(generateSlug("Special @#$ Characters")).toBe("special-characters");
  });

  test("ensureUniqueSlug appends suffix for duplicates", async () => {
    const mockPrisma = {
      product: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: "existing" })
          .mockResolvedValueOnce(null),
      },
    };

    const result = await ensureUniqueSlug(mockPrisma, "product", "test");
    expect(result).toBe("test-2");
  });

  test("ensureUniqueSlug excludes given ID", async () => {
    const mockPrisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    await ensureUniqueSlug(mockPrisma, "product", "test", "exclude-id");
    expect(mockPrisma.product.findFirst).toHaveBeenCalledWith({
      where: { slug: "test", NOT: { id: "exclude-id" } },
    });
  });
});
