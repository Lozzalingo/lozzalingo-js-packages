const { createCrmRoutes } = require("./routes");
const { createCrmController } = require("./controller");
const { findOrCreateCustomer } = require("./services/customer");
const { recordActivity } = require("./services/activity");
const { recalculateScore } = require("./services/scoring");
const { recordCampaignSend, updateCampaignSend } = require("./services/campaign");
const { generateCustomerNumber, getNextCustomerNumber } = require("./services/customer-number");

module.exports = {
  createCrmRoutes,
  createCrmController,
  findOrCreateCustomer,
  recordActivity,
  recalculateScore,
  recordCampaignSend,
  updateCampaignSend,
  generateCustomerNumber,
  getNextCustomerNumber,
};
