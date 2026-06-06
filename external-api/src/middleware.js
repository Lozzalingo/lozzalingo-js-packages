/**
 * External API Authentication Middleware
 *
 * Validates X-API-Key header against stored hashes.
 * Attaches key data to req.apiKeyData on success.
 */

function createApiKeyMiddleware(apiKeyService) {
  return async function requireApiKey(req, res, next) {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      console.log("[ExternalAPI] Request rejected - no API key provided:", req.method, req.originalUrl);
      return res.status(401).json({
        error: "API key required",
        message: "Include X-API-Key header with your request",
      });
    }

    const keyData = await apiKeyService.validateKey(apiKey);

    if (!keyData) {
      console.log("[ExternalAPI] Request rejected - invalid API key:", req.method, req.originalUrl);
      return res.status(401).json({
        error: "Invalid API key",
        message: "The provided API key is invalid or has been revoked",
      });
    }

    // Attach key data for downstream use
    req.apiKeyData = keyData;
    next();
  };
}

module.exports = { createApiKeyMiddleware };
