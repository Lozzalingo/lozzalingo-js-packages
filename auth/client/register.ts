/**
 * @lozzalingo/auth - Registration API Route
 *
 * Mirrors the Python framework's /register POST handler.
 * Creates a user with email verification.
 *
 * Usage in any app:
 *
 *   // app/api/auth/register/route.ts
 *   import { createRegisterHandler } from "@lozzalingo/auth/client";
 *   import prisma from "@/lib/prisma";
 *   const { POST } = createRegisterHandler({ prisma });
 *   export { POST };
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

type RegisterConfig = {
  prisma: any;
  /** Optional email service for sending verification emails */
  emailService?: any;
  /** Verification token expiry in ms (default 24 hours) */
  verificationTokenExpiry?: number;
};

export function createRegisterHandler(config: RegisterConfig) {
  const {
    prisma,
    emailService,
    verificationTokenExpiry = 24 * 60 * 60 * 1000,
  } = config;

  async function POST(req: NextRequest) {
    try {
      const body = await req.json();
      const { email, password, firstName, lastName } = body;

      console.log("[Auth] Registration attempt for:", email);

      // Validate required fields (matching Python's register route)
      if (!email || !password || !firstName || !lastName) {
        return NextResponse.json(
          { error: "All fields are required" },
          { status: 400 }
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: "Please enter a valid email address" },
          { status: 400 }
        );
      }

      // Validate password strength (matching Python's validate_password_strength)
      if (password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }

      const normalisedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const existing = await prisma.user.findFirst({
        where: { email: normalisedEmail },
      });

      if (existing) {
        console.log("[Auth] Account already exists:", normalisedEmail);
        return NextResponse.json(
          { error: "An account already exists with this email" },
          { status: 400 }
        );
      }

      // Hash password
      const bcrypt = require("bcryptjs");
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user (unverified, matching Python's verified=False default)
      const user = await prisma.user.create({
        data: {
          email: normalisedEmail,
          password: hashedPassword,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role: "user",
        },
      });

      console.log("[Auth] User created:", normalisedEmail);

      // Generate verification token (matching Python's secrets.token_urlsafe(32))
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + verificationTokenExpiry);

      // Store verification token if the model exists
      try {
        await prisma.emailVerificationToken.create({
          data: {
            userId: user.id,
            token,
            expiresAt,
          },
        });

        // Send verification email if email service is available
        if (emailService) {
          const baseUrl = process.env.NEXTAUTH_URL || process.env.FRONTEND_URL || "http://localhost:3000";
          const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

          await emailService.sendCustomEmail(normalisedEmail, {
            subject: "Verify Your Email",
            heading: "Verify Your Email",
            body: `
              <p>Hi ${firstName},</p>
              <p>Please verify your email address by clicking the button below:</p>
              <p style="text-align: center; margin: 24px 0;">
                <a href="${verifyUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Verify Email</a>
              </p>
              <p style="font-size: 12px; color: #6b7280;">This link expires in 24 hours.</p>
            `,
          });
          console.log("[Auth] Verification email sent to:", normalisedEmail);
        }
      } catch (err) {
        console.log("[Auth] Verification token skipped (model may not exist):", (err as Error).message);
      }

      return NextResponse.json({
        success: true,
        message: "Account created! Please check your email to verify your account.",
      });
    } catch (error) {
      console.error("[Auth] Registration error:", (error as Error).message);
      return NextResponse.json(
        { error: "Failed to create account" },
        { status: 500 }
      );
    }
  }

  return { POST };
}
