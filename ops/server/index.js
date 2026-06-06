const { createOpsController } = require('./ops.controller');
const { createOpsRoutes } = require('./ops.routes');
const { getHealthStatus } = require('./health');
module.exports = { createOpsController, createOpsRoutes, getHealthStatus };
