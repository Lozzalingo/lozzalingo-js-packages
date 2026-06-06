"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";

/**
 * Standard Lozzalingo sign-in page.
 * Mirrors the Python framework's auth/sign-in.html template.
 *
 * Features:
 * - Email/password sign-in
 * - OAuth buttons (Google, GitHub) if enabled
 * - Link to register and forgot password
 * - Branded with site name and logo
 */

type SignInPageProps = {
  brandName?: string;
  brandLogo?: string;
  enableGoogle?: boolean;
  enableGithub?: boolean;
  registerPath?: string;
  forgotPasswordPath?: string;
  callbackUrl?: string;
};

export default function SignInPage({
  brandName = "Lozzalingo",
  brandLogo,
  enableGoogle = !!(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
  enableGithub = !!(process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID),
  registerPath = "/register",
  forgotPasswordPath = "/forgot-password",
  callbackUrl = "/admin",
}: SignInPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("[Auth] Sign-in attempt for:", email);

      const result = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        if (result.error === "EMAIL_NOT_VERIFIED") {
          setError("Please verify your email address before signing in.");
        } else {
          setError("Invalid email or password");
        }
        console.log("[Auth] Sign-in failed:", result.error);
      } else if (result?.url) {
        console.log("[Auth] Sign-in successful, redirecting");
        window.location.href = result.url;
      }
    } catch (err) {
      console.error("[Auth] Sign-in error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          {brandLogo && (
            <div className="flex justify-center mb-4">
              <img src={brandLogo} alt={brandName} className="h-12" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* OAuth buttons (matching Python template's oauth-buttons section) */}
        {(enableGoogle || enableGithub) && (
          <>
            <div className="space-y-3 mb-6">
              {enableGoogle && (
                <button
                  onClick={() => signIn("google", { callbackUrl })}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-medium py-3 px-4 rounded-lg transition"
                  data-action="oauth_google"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31l-.1.07 3.18 2.47c.18-.13 2.05-2.06 2.05-5.06z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>
              )}
              {enableGithub && (
                <button
                  onClick={() => signIn("github", { callbackUrl })}
                  className="w-full flex items-center justify-center gap-3 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition border border-gray-700"
                  data-action="oauth_github"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Continue with GitHub
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-gray-500 text-xs uppercase">or</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>
          </>
        )}

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              data-action="signin_email"
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-gray-400 text-xs">Password</label>
              <a href={forgotPasswordPath} className="text-blue-400 text-xs hover:underline">
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              data-action="signin_password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition"
            data-action="signin_submit"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Register link */}
        <p className="text-center text-gray-400 text-sm mt-6">
          Don&apos;t have an account?{" "}
          <a href={registerPath} className="text-blue-400 hover:underline font-medium">
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
