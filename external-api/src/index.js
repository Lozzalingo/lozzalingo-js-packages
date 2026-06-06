/**
 * @lozzalingo/external-api
 *
 * API key management and external article endpoints.
 * Mirrors the Python lozzalingo-framework external_api module.
 *
 * Flow:
 * 1. Admin creates an API key via admin endpoints
 * 2. Raw key shown once, only SHA-256 hash stored
 * 3. External services (e.g. AI Blog Builder) use X-API-Key header
 * 4. Articles are created/updated/deleted via authenticated endpoints
 */

const { createExternalApiRoutes } = require("./routes");
const { createExternalApiController } = require("./controller");
const { createApiKeyService, generateApiKey, hashApiKey } = require("./services/api-keys");
const { createApiKeyMiddleware } = require("./middleware");

module.exports = {
  createExternalApiRoutes,
  createExternalApiController,
  createApiKeyService,
  createApiKeyMiddleware,
  generateApiKey,
  hashApiKey,
};
