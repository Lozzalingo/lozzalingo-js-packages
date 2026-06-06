/**
 * @lozzalingo/auth - Shared NextAuth Configuration
 *
 * Mirrors the Python framework's auth module. Every Lozzalingo app gets the
 * same auth system: email/password sign-in, registration, email verification,
 * password reset, and optional OAuth (Google, GitHub).
 *
 * Usage in any app:
 *
 *   // app/api/auth/[...nextauth]/route.ts
 *   import { createAuthHandler } from "@lozzalingo/auth/client";
 *   const handler = createAuthHandler({ prisma });
 *   export { handler as GET, handler as POST };
 *
 * The sign-in page is at /sign-in (matching Python framework's /sign-in route).
 */

import type { NextAuthOptions, User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import NextAuth from "next-auth";

type LozzalingoAuthConfig = {
  /** Prisma client instance */
  prisma: any;
  /** Brand name for sign-in page display */
  brandName?: string;
  /** Enable Google OAuth (requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env vars) */
  enableGoogle?: boolean;
  /** Enable GitHub OAuth (requires GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET env vars) */
  enableGithub?: boolean;
  /** Custom sign-in page path (defaults to /sign-in to match Python framework) */
  signInPage?: string;
  /** Additional NextAuth options to merge */
  extraOptions?: Partial<NextAuthOptions>;
};

/**
 * Create the standard Lozzalingo NextAuth options.
 * Mirrors Python framework's auth module: email/password + optional OAuth.
 */
export function createAuthOptions(config: LozzalingoAuthConfig): NextAuthOptions {
  const {
    prisma,
    brandName = "Lozzalingo",
    enableGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    enableGithub = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    signInPage = "/sign-in",
    extraOptions = {},
  } = config;

  const providers: NextAuthOptions["providers"] = [];

  // ── Credentials Provider (email/password) ───────────────────────────────
  providers.push(
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        console.log("[Auth] Sign-in attempt for:", email);

        const user = await prisma.user.findFirst({
          where: { email },
        });

        if (!user || !user.password) {
          console.log("[Auth] User not found or no password set:", email);
          return null;
        }

        // Check email verification (matching Python framework behaviour)
        if (user.emailVerified === false) {
          console.log("[Auth] Email not verified:", email);
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        // Verify password with bcryptjs
        const bcrypt = require("bcryptjs");

        const isValid = await bcrypt.compare(credentials.password, user.password);
        console.log("[Auth] Password valid:", isValid);

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.firstName
            ? `${user.firstName} ${user.lastName || ""}`.trim()
            : user.email,
          role: user.role || "user",
        } as NextAuthUser & { role: string };
      },
    })
  );

  // ── OAuth Providers (matching Python framework's Google + GitHub) ──────
  if (enableGoogle) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      })
    );
    console.log("[Auth] Google OAuth enabled");
  }

  if (enableGithub) {
    providers.push(
      GitHubProvider({
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      })
    );
    console.log("[Auth] GitHub OAuth enabled");
  }

  const authOptions: NextAuthOptions = {
    providers,
    pages: {
      signIn: signInPage,
      error: signInPage,
    },
    session: {
      strategy: "jwt",
    },
    callbacks: {
      async signIn({ user, account }) {
        if (!account) return false;

        // OAuth sign-in: auto-create or link user (mirrors Python's oauth_callback)
        if (account.provider !== "credentials" && user.email) {
          const email = user.email.toLowerCase();
          console.log(`[Auth] OAuth sign-in via ${account.provider} for:`, email);

          let dbUser = await prisma.user.findFirst({ where: { email } });

          if (!dbUser) {
            // Auto-create user for OAuth (verified by default, matching Python)
            const nameParts = (user.name || "").split(" ");
            const bcrypt = require("bcryptjs");

            dbUser = await prisma.user.create({
              data: {
                email,
                firstName: nameParts[0] || "",
                lastName: nameParts.slice(1).join(" ") || "",
                role: "user",
                avatar: user.image || null,
              },
            });
            console.log("[Auth] Created new OAuth user:", email);
          }
        }

        return true;
      },

      async jwt({ token, user }) {
        // On initial sign-in, user object is available
        if (user) {
          token.id = user.id;
          token.role = (user as any).role || "user";
        }

        // Always refresh role from DB to pick up admin changes
        const email = (token.email as string)?.toLowerCase();
        if (email) {
          const dbUser = await prisma.user.findFirst({ where: { email } });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role || "user";
            token.firstName = dbUser.firstName;
          }
        }

        return token;
      },

      async session({ session, token }) {
        if (session.user) {
          (session.user as any).id = token.id;
          (session.user as any).role = token.role;
          (session.user as any).firstName = token.firstName;
        }
        return session;
      },
    },
    ...extraOptions,
  };

  return authOptions;
}

/**
 * Create the NextAuth route handler.
 * Usage: export { handler as GET, handler as POST }
 */
export function createAuthHandler(config: LozzalingoAuthConfig) {
  const options = createAuthOptions(config);
  return NextAuth(options);
}
