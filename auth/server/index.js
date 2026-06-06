const { createAuthController } = require('./auth.controller');
const { createAuthRoutes } = require('./auth.routes');
const { createAuthMiddleware } = require('./middleware');
module.exports = { createAuthController, createAuthRoutes, createAuthMiddleware };
