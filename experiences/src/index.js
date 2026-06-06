const { createExperienceRoutes } = require("./routes");
const { createExperienceController } = require("./controller");
const { generateSlug, ensureUniqueSlug } = require("./services/slug");

module.exports = {
  createExperienceRoutes,
  createExperienceController,
  generateSlug,
  ensureUniqueSlug,
};
