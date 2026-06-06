const { createPurchaseRoutes } = require("./routes");
const { createPurchaseController } = require("./controller");
const { generateDownloadToken, validateDownload } = require("./services/download-token");
const { checkAccess, requireAccess } = require("./services/access-control");

module.exports = {
  createPurchaseRoutes,
  createPurchaseController,
  generateDownloadToken,
  validateDownload,
  checkAccess,
  requireAccess,
};
