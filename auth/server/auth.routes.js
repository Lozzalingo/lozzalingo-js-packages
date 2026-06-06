/**
 * @lozzalingo/auth - Auth Routes
 */

const express = require('express');
const { createAuthController } = require('./auth.controller');
const { createAuthMiddleware } = require('./middleware');

// Inline Zod validation for auth (no project-specific dependency)
let zodValidate;
try {
  const { z } = require('zod');
  const forgotSchema = z.object({ email: z.string().email() });
  const resetSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });

  function makeValidator(schema) {
    return (req, res, next) => {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.issues[0].message });
      }
      req.body = result.data;
      next();
    };
  }
  zodValidate = { forgot: makeValidator(forgotSchema), reset: makeValidator(resetSchema) };
} catch {
  const noop = (req, res, next) => next();
  zodValidate = { forgot: noop, reset: noop };
}

function createAuthRoutes(prisma, emailService, options = {}) {
  const router = express.Router();
  const controller = createAuthController(prisma, emailService, options);
  const { rateLimit } = createAuthMiddleware(prisma);

  // Rate limit auth endpoints: 5 requests per minute
  const authLimiter = rateLimit(5, 60000);

  router.post('/forgot-password', authLimiter, zodValidate.forgot, controller.forgotPassword);
  router.post('/reset-password', authLimiter, zodValidate.reset, controller.resetPassword);
  router.post('/verify-email', controller.verifyEmail);
  router.post('/resend-verification', authLimiter, controller.resendVerification);

  return router;
}

module.exports = { createAuthRoutes };
