const { createApiKeyService, hashApiKey } = require("../src/services/api-keys");
const { createApiKeyMiddleware } = require("../src/middleware");
const { createExternalApiController } = require("../src/controller");

// ── Mock Prisma ────────────────────────────────────────────────────────────────

const mockPrisma = {
  apiKey: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  blogPost: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

// ── Mock req/res helpers ───────────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {
    headers: {},
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ── API Key Service Tests ──────────────────────────────────────────────────────

describe("API Key Service", () => {
  const service = createApiKeyService(mockPrisma);

  beforeEach(() => jest.clearAllMocks());

  test("createKey generates lzl_ prefixed key and stores hash", async () => {
    mockPrisma.apiKey.create.mockResolvedValue({
      id: "key-1",
      name: "Test Key",
      keyHash: "abc",
      keyPrefix: "lzl_abcdefgh...",
      permissions: "articles:write",
      isActive: true,
    });

    const result = await service.createKey("Test Key");

    expect(result.apiKey).toMatch(/^lzl_/);
    expect(result.name).toBe("Test Key");
    expect(result.keyPrefix).toMatch(/^lzl_.*\.\.\.$/);

    // Verify hash was stored, not the raw key
    const createCall = mockPrisma.apiKey.create.mock.calls[0][0];
    expect(createCall.data.keyHash).not.toBe(result.apiKey);
    expect(createCall.data.keyHash).toBe(hashApiKey(result.apiKey));
  });

  test("createKey rejects empty name", async () => {
    await expect(service.createKey("")).rejects.toThrow("Key name is required");
    await expect(service.createKey("  ")).rejects.toThrow("Key name is required");
  });

  test("validateKey returns key data for valid key", async () => {
    const rawKey = "lzl_test123";
    const hash = hashApiKey(rawKey);

    mockPrisma.apiKey.findUnique.mockResolvedValue({
      id: "key-1",
      name: "Test",
      permissions: "articles:write",
      isActive: true,
    });
    mockPrisma.apiKey.update.mockResolvedValue({});

    const result = await service.validateKey(rawKey);

    expect(result).not.toBeNull();
    expect(result.id).toBe("key-1");
    expect(result.permissions).toBe("articles:write");
    expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledWith({ where: { keyHash: hash } });
  });

  test("validateKey returns null for revoked key", async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue({
      id: "key-1",
      name: "Revoked",
      permissions: "articles:write",
      isActive: false,
    });

    const result = await service.validateKey("lzl_revoked");
    expect(result).toBeNull();
  });

  test("validateKey returns null for empty key", async () => {
    const result = await service.validateKey("");
    expect(result).toBeNull();
  });

  test("revokeKey sets isActive to false", async () => {
    mockPrisma.apiKey.update.mockResolvedValue({});

    const result = await service.revokeKey("key-1");

    expect(result).toBe(true);
    expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: { isActive: false },
    });
  });

  test("deleteKey permanently removes key", async () => {
    mockPrisma.apiKey.delete.mockResolvedValue({});

    const result = await service.deleteKey("key-1");

    expect(result).toBe(true);
    expect(mockPrisma.apiKey.delete).toHaveBeenCalledWith({ where: { id: "key-1" } });
  });
});

// ── Middleware Tests ────────────────────────────────────────────────────────────

describe("API Key Middleware", () => {
  const mockService = {
    validateKey: jest.fn(),
  };
  const middleware = createApiKeyMiddleware(mockService);

  beforeEach(() => jest.clearAllMocks());

  test("rejects request with no API key", async () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "API key required" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects request with invalid API key", async () => {
    mockService.validateKey.mockResolvedValue(null);

    const req = mockReq({ headers: { "x-api-key": "lzl_invalid" } });
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("allows request with valid API key and attaches data", async () => {
    const keyData = { id: "key-1", name: "Test", permissions: "articles:write" };
    mockService.validateKey.mockResolvedValue(keyData);

    const req = mockReq({ headers: { "x-api-key": "lzl_valid" } });
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.apiKeyData).toEqual(keyData);
  });
});

// ── Controller Tests ───────────────────────────────────────────────────────────

describe("External API Controller", () => {
  beforeEach(() => jest.clearAllMocks());

  const controller = createExternalApiController(mockPrisma, {
    articleModelName: "blogPost",
  });

  test("getArticles returns articles list", async () => {
    const articles = [
      { id: "1", title: "Test", slug: "test" },
      { id: "2", title: "Test 2", slug: "test-2" },
    ];
    mockPrisma.blogPost.findMany.mockResolvedValue(articles);

    const req = mockReq({ query: {} });
    const res = mockRes();

    await controller.getArticles(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      articles,
      count: 2,
    });
  });

  test("createArticle rejects missing title", async () => {
    const req = mockReq({ body: { content: "Some content" } });
    const res = mockRes();

    await controller.createArticle(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("createArticle creates article with slug", async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValue(null); // slug is unique
    mockPrisma.blogPost.create.mockResolvedValue({
      id: "new-1",
      title: "My Blog Post",
      slug: "my-blog-post",
      published: false,
    });

    const req = mockReq({
      body: { title: "My Blog Post", content: "<p>Hello</p>" },
    });
    const res = mockRes();

    await controller.createArticle(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        slug: "my-blog-post",
      })
    );
  });

  test("deleteArticle returns 404 for missing article", async () => {
    mockPrisma.blogPost.findUnique.mockResolvedValue(null);

    const req = mockReq({ params: { id: "nonexistent" } });
    const res = mockRes();

    await controller.deleteArticle(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
