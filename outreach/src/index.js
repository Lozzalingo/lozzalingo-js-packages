/**
 * @lozzalingo/outreach - Main Entry
 * Transactional emails (booking confirmation, invoice, payment) plus
 * automated outreach sequences triggered by booking and payment events.
 */

const { createOutreachRoutes } = require("./routes");
const { createOutreachController } = require("./controller");
const { createOutreachService } = require("./services/triggers");
const { processScheduledOutreach } = require("./services/scheduler");
const { DEFAULT_TEMPLATES, getTemplate, formatPence } = require("./services/templates");
const { getOutreachLog, getScheduledOutreach } = require("./services/log");

module.exports = {
  createOutreachRoutes,
  createOutreachController,
  createOutreachService,
  processScheduledOutreach,
  DEFAULT_TEMPLATES,
  getTemplate,
  formatPence,
  getOutreachLog,
  getScheduledOutreach,
};
