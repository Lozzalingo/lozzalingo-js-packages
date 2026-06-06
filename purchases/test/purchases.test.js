const { generateDownloadToken, validateDownload } = require("../src/services/download-token");
const { checkAccess, requireAccess } = require("../src/services/access-control");
const { createPurchaseController } = require("../src/controller");

// --- Mock helpers ---

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    redirectUrl: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
    redirect(code, url) {
      res.statusCode = code;
      res.redirectUrl = url;
      return res;
    },
  };
  return res;
}

function mockReq(params = {}, query = {}, body = {}, user = null) {
  return { params, query, body, user };
}

// --- Mock Prisma ---

function createMockPrisma() {
  return {
    purchase: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };
}

// =====================
// download-token.js
// =====================

describe("generateDownloadToken", () => {
  test("returns a 32-character hex string", () => {
    const token = generateDownloadToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  test("returns unique values", () => {
    const token1 = generateDownloadToken();
    const token2 = generateDownloadToken();
    expect(token1).not.toBe(token2);
  });
});

describe("validateDownload", () => {
  test("allows when count < limit and not expired", () => {
    const purchase = {
      status: "COMPLETED",
      downloadCount: 1,
      downloadLimit: 3,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const result = validateDownload(purchase);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test("rejects when count >= limit", () => {
    const purchase = {
      status: "COMPLETED",
      downloadCount: 3,
      downloadLimit: 3,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const result = validateDownload(purchase);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Download limit reached");
  });

  test("rejects when expired", () => {
    const purchase = {
      status: "COMPLETED",
      downloadCount: 0,
      downloadLimit: 3,
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    };
    const result = validateDownload(purchase);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Download link has expired");
  });

  test("allows when expiresAt is null (no expiry)", () => {
    const purchase = {
      status: "COMPLETED",
      downloadCount: 0,
      downloadLimit: 3,
      expiresAt: null,
    };
    const result = validateDownload(purchase);
    expect(result.allowed).toBe(true);
  });
});

// =====================
// controller.js
// =====================

describe("Purchase Controller", () => {
  let mockPrisma;
  let controller;
  let hooks;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    hooks = {
      onPurchaseCreated: jest.fn(),
      onDownload: jest.fn(),
      onAccessGranted: jest.fn(),
      onAccessRevoked: jest.fn(),
      getDownloadUrl: jest.fn().mockResolvedValue("https://cdn.example.com/file.zip"),
    };
    controller = createPurchaseController(mockPrisma, { hooks });
  });

  // --- createFromPayment ---

  describe("createFromPayment", () => {
    test("creates purchase with COMPLETED status and token", async () => {
      mockPrisma.purchase.findFirst.mockResolvedValue(null);
      mockPrisma.purchase.create.mockImplementation(({ data }) => Promise.resolve({
        id: "uuid-1",
        ...data,
      }));

      const result = await controller.createFromPayment({
        email: "test@example.com",
        productId: "prod-1",
        productName: "Quiz Pack",
        stripeSessionId: "cs_123",
        stripePaymentId: "pi_123",
      });

      expect(result.status).toBe("COMPLETED");
      expect(result.downloadToken).toMatch(/^[0-9a-f]{32}$/);
      expect(result.productType).toBe("ONE_OFF");
      expect(mockPrisma.purchase.create).toHaveBeenCalledTimes(1);
    });

    test("returns existing purchase for duplicate stripeSessionId (idempotency)", async () => {
      const existing = {
        id: "uuid-existing",
        email: "test@example.com",
        stripeSessionId: "cs_123",
        status: "COMPLETED",
      };
      mockPrisma.purchase.findFirst.mockResolvedValue(existing);

      const result = await controller.createFromPayment({
        email: "test@example.com",
        productId: "prod-1",
        productName: "Quiz Pack",
        stripeSessionId: "cs_123",
      });

      expect(result.id).toBe("uuid-existing");
      expect(mockPrisma.purchase.create).not.toHaveBeenCalled();
    });

    test("fires onPurchaseCreated hook", async () => {
      mockPrisma.purchase.findFirst.mockResolvedValue(null);
      mockPrisma.purchase.create.mockImplementation(({ data }) => Promise.resolve({
        id: "uuid-1",
        ...data,
      }));

      await controller.createFromPayment({
        email: "test@example.com",
        productId: "prod-1",
        productName: "Quiz Pack",
        stripeSessionId: "cs_456",
      });

      expect(hooks.onPurchaseCreated).toHaveBeenCalledTimes(1);
    });
  });

  // --- downloadByToken ---

  describe("downloadByToken", () => {
    test("increments downloadCount", async () => {
      const purchase = {
        id: "uuid-1",
        downloadToken: "abc123",
        status: "COMPLETED",
        downloadCount: 1,
        downloadLimit: 3,
        expiresAt: null,
      };
      mockPrisma.purchase.findFirst.mockResolvedValue(purchase);
      mockPrisma.purchase.update.mockResolvedValue({ ...purchase, downloadCount: 2 });

      const req = mockReq({ token: "abc123" });
      const res = mockRes();
      await controller.downloadByToken(req, res);

      expect(mockPrisma.purchase.update).toHaveBeenCalledWith({
        where: { id: "uuid-1" },
        data: { downloadCount: { increment: 1 } },
      });
    });

    test("returns 404 for invalid token", async () => {
      mockPrisma.purchase.findFirst.mockResolvedValue(null);

      const req = mockReq({ token: "invalid" });
      const res = mockRes();
      await controller.downloadByToken(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe("Purchase not found");
    });

    test("returns 410 for expired purchase", async () => {
      const purchase = {
        id: "uuid-1",
        status: "COMPLETED",
        downloadCount: 0,
        downloadLimit: 3,
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
      };
      mockPrisma.purchase.findFirst.mockResolvedValue(purchase);

      const req = mockReq({ token: "expired-token" });
      const res = mockRes();
      await controller.downloadByToken(req, res);

      expect(res.statusCode).toBe(410);
      expect(res.body.error).toBe("Download link has expired");
    });

    test("returns 410 when download limit reached", async () => {
      const purchase = {
        id: "uuid-1",
        status: "COMPLETED",
        downloadCount: 3,
        downloadLimit: 3,
        expiresAt: null,
      };
      mockPrisma.purchase.findFirst.mockResolvedValue(purchase);

      const req = mockReq({ token: "limit-token" });
      const res = mockRes();
      await controller.downloadByToken(req, res);

      expect(res.statusCode).toBe(410);
      expect(res.body.error).toBe("Download limit reached");
    });

    test("calls getDownloadUrl hook and redirects", async () => {
      const purchase = {
        id: "uuid-1",
        status: "COMPLETED",
        downloadCount: 0,
        downloadLimit: 3,
        expiresAt: null,
      };
      mockPrisma.purchase.findFirst.mockResolvedValue(purchase);
      mockPrisma.purchase.update.mockResolvedValue({ ...purchase, downloadCount: 1 });

      const req = mockReq({ token: "valid-token" });
      const res = mockRes();
      await controller.downloadByToken(req, res);

      expect(hooks.getDownloadUrl).toHaveBeenCalledWith(purchase);
      expect(res.statusCode).toBe(302);
      expect(res.redirectUrl).toBe("https://cdn.example.com/file.zip");
    });
  });

  // --- grantAccess ---

  describe("grantAccess", () => {
    test("creates new purchase with accessGranted=true", async () => {
      mockPrisma.purchase.findFirst.mockResolvedValue(null);
      mockPrisma.purchase.create.mockImplementation(({ data }) => Promise.resolve({
        id: "uuid-sub-1",
        ...data,
      }));

      const result = await controller.grantAccess({
        email: "sub@example.com",
        productId: "QUIZ_DB",
        productName: "Quiz Database",
        stripeSubscriptionId: "sub_123",
      });

      expect(result.accessGranted).toBe(true);
      expect(result.productType).toBe("SUBSCRIPTION");
      expect(mockPrisma.purchase.create).toHaveBeenCalledTimes(1);
    });

    test("updates existing purchase by subscriptionId", async () => {
      const existing = {
        id: "uuid-sub-existing",
        stripeSubscriptionId: "sub_123",
        accessGranted: false,
      };
      mockPrisma.purchase.findFirst.mockResolvedValue(existing);
      mockPrisma.purchase.update.mockResolvedValue({
        ...existing,
        accessGranted: true,
        accessExpiresAt: null,
      });

      const result = await controller.grantAccess({
        email: "sub@example.com",
        productId: "QUIZ_DB",
        productName: "Quiz Database",
        stripeSubscriptionId: "sub_123",
      });

      expect(result.accessGranted).toBe(true);
      expect(mockPrisma.purchase.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.purchase.create).not.toHaveBeenCalled();
    });
  });

  // --- revokeAccessBySubscription ---

  describe("revokeAccessBySubscription", () => {
    test("sets accessGranted=false", async () => {
      const existing = {
        id: "uuid-sub-1",
        stripeSubscriptionId: "sub_123",
        accessGranted: true,
      };
      mockPrisma.purchase.findFirst.mockResolvedValue(existing);
      mockPrisma.purchase.update.mockResolvedValue({
        ...existing,
        accessGranted: false,
      });

      const result = await controller.revokeAccessBySubscription("sub_123");

      expect(result.accessGranted).toBe(false);
      expect(mockPrisma.purchase.update).toHaveBeenCalledWith({
        where: { id: "uuid-sub-1" },
        data: { accessGranted: false },
      });
    });
  });

  // --- Admin: resetDownloads ---

  describe("resetDownloads", () => {
    test("sets downloadCount to 0", async () => {
      mockPrisma.purchase.update.mockResolvedValue({
        id: "uuid-1",
        downloadCount: 0,
      });

      const req = mockReq({ id: "uuid-1" });
      const res = mockRes();
      await controller.resetDownloads(req, res);

      expect(mockPrisma.purchase.update).toHaveBeenCalledWith({
        where: { id: "uuid-1" },
        data: { downloadCount: 0 },
      });
      expect(res.body.downloadCount).toBe(0);
    });
  });

  // --- Admin: extendExpiry ---

  describe("extendExpiry", () => {
    test("updates expiresAt", async () => {
      const existing = {
        id: "uuid-1",
        expiresAt: new Date("2026-05-01T00:00:00Z"),
      };
      mockPrisma.purchase.findUnique.mockResolvedValue(existing);
      mockPrisma.purchase.update.mockImplementation(({ data }) => Promise.resolve({
        id: "uuid-1",
        expiresAt: data.expiresAt,
      }));

      const req = mockReq({ id: "uuid-1" }, {}, { days: 7 });
      const res = mockRes();
      await controller.extendExpiry(req, res);

      expect(mockPrisma.purchase.update).toHaveBeenCalledTimes(1);
      const updateCall = mockPrisma.purchase.update.mock.calls[0][0];
      const newExpiry = new Date(updateCall.data.expiresAt);
      const expectedExpiry = new Date(existing.expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      // Allow 1 second tolerance
      expect(Math.abs(newExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });
  });

  // --- Hook errors do not fail the operation ---

  describe("hook error resilience", () => {
    test("hook errors do not fail the operation", async () => {
      const failingHooks = {
        onPurchaseCreated: jest.fn().mockRejectedValue(new Error("Hook exploded")),
        getDownloadUrl: jest.fn().mockResolvedValue("https://cdn.example.com/file.zip"),
      };
      const ctrl = createPurchaseController(mockPrisma, { hooks: failingHooks });

      mockPrisma.purchase.findFirst.mockResolvedValue(null);
      mockPrisma.purchase.create.mockImplementation(({ data }) => Promise.resolve({
        id: "uuid-hook-test",
        ...data,
      }));

      // Should not throw even though hook fails
      const result = await ctrl.createFromPayment({
        email: "test@example.com",
        productId: "prod-1",
        productName: "Quiz Pack",
        stripeSessionId: "cs_hook_test",
      });

      expect(result.id).toBe("uuid-hook-test");
      expect(failingHooks.onPurchaseCreated).toHaveBeenCalledTimes(1);
    });
  });
});

// =====================
// access-control.js
// =====================

describe("Access Control", () => {
  let mockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
  });

  describe("checkAccess", () => {
    test("returns true for active access", async () => {
      mockPrisma.purchase.findFirst.mockResolvedValue({
        id: "uuid-1",
        accessGranted: true,
        accessExpiresAt: null,
      });

      const result = await checkAccess(mockPrisma, "purchase", "user@example.com", "QUIZ_DB");
      expect(result.hasAccess).toBe(true);
      expect(result.purchase).toBeDefined();
    });

    test("returns false for expired access", async () => {
      mockPrisma.purchase.findFirst.mockResolvedValue({
        id: "uuid-1",
        accessGranted: true,
        accessExpiresAt: new Date(Date.now() - 86400000).toISOString(),
      });

      const result = await checkAccess(mockPrisma, "purchase", "user@example.com", "QUIZ_DB");
      expect(result.hasAccess).toBe(false);
    });

    test("returns false for revoked access", async () => {
      // findFirst with accessGranted: true won't match revoked records
      mockPrisma.purchase.findFirst.mockResolvedValue(null);

      const result = await checkAccess(mockPrisma, "purchase", "user@example.com", "QUIZ_DB");
      expect(result.hasAccess).toBe(false);
    });
  });

  describe("requireAccess middleware", () => {
    test("returns 403 when no access", async () => {
      mockPrisma.purchase.findFirst.mockResolvedValue(null);

      const middleware = requireAccess(mockPrisma, "QUIZ_DB");
      const req = { user: { email: "user@example.com" } };
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    test("calls next() when access granted", async () => {
      mockPrisma.purchase.findFirst.mockResolvedValue({
        id: "uuid-1",
        accessGranted: true,
        accessExpiresAt: null,
      });

      const middleware = requireAccess(mockPrisma, "QUIZ_DB");
      const req = { user: { email: "user@example.com" } };
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
