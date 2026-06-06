const { createEmailService } = require('./email.service');
const { createEmailRoutes } = require('./email.routes');
const { buildEmailTemplate } = require('./templates');

module.exports = { createEmailService, createEmailRoutes, buildEmailTemplate };
