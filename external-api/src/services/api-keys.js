/**
 * API Key Service
 *
 * Generates, validates, and manages API keys.
 * Keys are stored as SHA-256 hashes - the raw key is only returned once at creation.
 * Mirrors the Python lozzalingo-framework external_api module.
 */

const crypto = require("crypto");

const KEY_PREFIX = "lzl";

/**
 * Generate a new API key in the format lzl_{random}
 */
function generateApiKey() {
  const randomPart = crypto.randomBytes(32).toString("base64url");
  return `${KEY_PREFIX}_${randomPart}`;
}

/**
 * SHA-256 hash an API key for storage
 */
function hashApiKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Create the API key service bound to a Prisma client
 */
function createApiKeyService(prisma) {
  console.log("[ExternalAPI] Initialising API key service");

  /**
   * Create a new API key. Returns the raw key only once.
   */
  async function createKey(name, options = {}) {
    const { permissions = "articles:write", createdBy = null } = options;

    if (!name || !name.trim()) {
      throw new Error("Key name is required");
    }

    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.slice(0, 12) + "...";

    try {
      const record = await prisma.apiKey.create({
        data: {
          name: name.trim(),
          keyHash,
          keyPrefix,
          permissions,
          createdBy,
          isActive: true,
        },
      });

      console.log("[ExternalAPI] API key created:", record.id, "name:", name);

      return {
        id: record.id,
        apiKey, // Only returned at creation
        name: record.name,
        keyPrefix,
        permissions: record.permissions,
      };
    } catch (error) {
      console.error("[ExternalAPI] Failed to create API key:", error.message);
      throw error;
    }
  }

  /**
   * Validate an API key. Returns key data if valid, null otherwise.
   * Updates lastUsedAt on each successful validation.
   */
  async function validateKey(rawKey) {
    if (!rawKey) return null;

    const keyHash = hashApiKey(rawKey);

    try {
      const record = await prisma.apiKey.findUnique({
        where: { keyHash },
      });

      if (!record || !record.isActive) return null;

      // Update lastUsedAt (fire and forget)
      prisma.apiKey
        .update({
          where: { id: record.id },
          data: { lastUsedAt: new Date() },
        })
        .catch((err) =>
          console.error("[ExternalAPI] Failed to update lastUsedAt:", err.message)
        );

      return {
        id: record.id,
        name: record.name,
        permissions: record.permissions,
        isActive: record.isActive,
      };
    } catch (error) {
      console.error("[ExternalAPI] Failed to validate API key:", error.message);
      return null;
    }
  }

  /**
   * List all API keys (metadata only, never the raw key)
   */
  async function listKeys() {
    try {
      const keys = await prisma.apiKey.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          permissions: true,
          createdAt: true,
          lastUsedAt: true,
          isActive: true,
        },
      });

      console.log("[ExternalAPI] Listed", keys.length, "API keys");
      return keys;
    } catch (error) {
      console.error("[ExternalAPI] Failed to list API keys:", error.message);
      return [];
    }
  }

  /**
   * Soft-revoke an API key (sets isActive to false)
   */
  async function revokeKey(keyId) {
    try {
      await prisma.apiKey.update({
        where: { id: keyId },
        data: { isActive: false },
      });
      console.log("[ExternalAPI] API key revoked:", keyId);
      return true;
    } catch (error) {
      console.error("[ExternalAPI] Failed to revoke API key:", error.message);
      return false;
    }
  }

  /**
   * Permanently delete an API key
   */
  async function deleteKey(keyId) {
    try {
      await prisma.apiKey.delete({ where: { id: keyId } });
      console.log("[ExternalAPI] API key deleted permanently:", keyId);
      return true;
    } catch (error) {
      console.error("[ExternalAPI] Failed to delete API key:", error.message);
      return false;
    }
  }

  return { createKey, validateKey, listKeys, revokeKey, deleteKey };
}

module.exports = { createApiKeyService, generateApiKey, hashApiKey };
