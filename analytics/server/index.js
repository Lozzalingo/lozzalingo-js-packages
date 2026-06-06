// Server-side analytics exports
const { createVisitorController } = require("./visitors.controller");
const { createVisitorRoutes } = require("./visitors.routes");

module.exports = { createVisitorController, createVisitorRoutes };
