const { createLoggingService } = require('./logging.service');
const { createLoggingRoutes } = require('./logging.routes');
const { createClientErrorRoutes } = require('./client-error.routes');

module.exports = { createLoggingService, createLoggingRoutes, createClientErrorRoutes };
