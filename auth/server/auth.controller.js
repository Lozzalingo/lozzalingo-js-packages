/**
 * @lozzalingo/auth - Auth Controller
 * Password reset, email verification tokens
 */

const crypto = require('crypto');

function createAuthController(prisma, emailService, options = {}) {
  const {
    resetTokenExpiry = 60 * 60 * 1000, // 1 hour
    verificationTokenExpiry = 24 * 60 * 60 * 1000, // 24 hours
    websiteUrl = process.env.NEXTAUTH_URL || process.env.FRONTEND_URL || 'http://localhost:3000',
  } = options;

  console.log('[Auth] Initializing auth controller');

  function generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async function forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      console.log('[Auth] Password reset requested for:', email);

      // Find user
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // Don't reveal if user exists
        console.log('[Auth] User not found, returning success anyway:', email);
        return res.json({ message: 'If an account exists, a reset email has been sent' });
      }

      // Generate token
      const token = generateToken();
      const expiresAt = new Date(Date.now() + resetTokenExpiry);

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      // Send email
      if (emailService) {
        const resetUrl = `${websiteUrl}/reset-password?token=${token}`;
        await emailService.sendPasswordResetEmail(email, { resetUrl, expiresIn: '1 hour' });
        console.log('[Auth] Password reset email sent to:', email);
      }

      res.json({ message: 'If an account exists, a reset email has been sent' });
    } catch (error) {
      console.error('[Auth] Forgot password error:', error.message);
      res.status(500).json({ error: 'Failed to process request' });
    }
  }

  async function resetPassword(req, res) {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: 'Token and password are required' });
      }

      console.log('[Auth] Password reset attempt');

      // Find valid token
      const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

      if (!resetToken || resetToken.used || new Date() > resetToken.expiresAt) {
        console.log('[Auth] Invalid or expired reset token');
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      // Hash password - try bcryptjs first, then bcrypt
      let hashedPassword;
      try {
        const bcrypt = require('bcryptjs');
        hashedPassword = await bcrypt.hash(password, 10);
      } catch {
        try {
          const bcrypt = require('bcrypt');
          hashedPassword = await bcrypt.hash(password, 10);
        } catch (e) {
          console.error('[Auth] No bcrypt library available:', e.message);
          return res.status(500).json({ error: 'Password hashing unavailable' });
        }
      }

      // Update password and mark token as used
      await prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      });

      await prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      });

      console.log('[Auth] Password reset successful for userId:', resetToken.userId);
      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('[Auth] Reset password error:', error.message);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }

  async function verifyEmail(req, res) {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'Token is required' });
      }

      console.log('[Auth] Email verification attempt');

      const verificationToken = await prisma.emailVerificationToken.findUnique({ where: { token } });

      if (!verificationToken || verificationToken.used || new Date() > verificationToken.expiresAt) {
        console.log('[Auth] Invalid or expired verification token');
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }

      // Mark token as used
      await prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { used: true },
      });

      console.log('[Auth] Email verified for userId:', verificationToken.userId);
      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      console.error('[Auth] Verify email error:', error.message);
      res.status(500).json({ error: 'Failed to verify email' });
    }
  }

  async function resendVerification(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      console.log('[Auth] Resend verification requested for:', email);

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.json({ message: 'If an account exists, a verification email has been sent' });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + verificationTokenExpiry);

      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      if (emailService) {
        const verifyUrl = `${websiteUrl}/verify-email?token=${token}`;
        await emailService.sendCustomEmail(email, {
          subject: 'Verify Your Email',
          templateHtml: `
            <h2>Verify Your Email</h2>
            <p>Click the button below to verify your email address:</p>
            <p style="text-align: center;">
              <a href="${verifyUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Verify Email</a>
            </p>
            <p style="font-size: 12px; color: #6b7280;">This link expires in 24 hours.</p>
          `,
        });
        console.log('[Auth] Verification email sent to:', email);
      }

      res.json({ message: 'If an account exists, a verification email has been sent' });
    } catch (error) {
      console.error('[Auth] Resend verification error:', error.message);
      res.status(500).json({ error: 'Failed to process request' });
    }
  }

  return { forgotPassword, resetPassword, verifyEmail, resendVerification };
}

module.exports = { createAuthController };
