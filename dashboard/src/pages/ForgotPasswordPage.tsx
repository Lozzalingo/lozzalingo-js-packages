"use client";

import React, { useState } from "react";
import { useModulePage } from "./shared";

/**
 * Standard Lozzalingo forgot password page.
 * Mirrors the Python framework's auth/forgot-password.html template.
 */

type ForgotPasswordPageProps = {
  brandName?: string;
  signInPath?: string;
};

export default function ForgotPasswordPage({
  brandName = "Lozzalingo",
  signInPath = "/sign-in",
}: ForgotPasswordPageProps) {
  const { apiBase } = useModulePage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("[Auth] Password reset requested for:", email);
      const res = await fetch(`${apiBase}/api/shared-auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      if (res.ok) {
        setSent(true);
        console.log("[Auth] Password reset email sent");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send reset email");
      }
    } catch (err) {
      console.error("[Auth] Forgot password error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
          <p className="text-gray-400 text-sm mt-1">
            {sent ? "Check your email" : "Enter your email to receive a reset link"}
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {sent ? (
          <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-4 py-3 mb-6 text-emerald-400 text-sm">
            <p>If an account exists with that email, a password reset link has been sent.</p>
            <p className="mt-2 text-gray-400">The link expires in 1 hour.</p>
          </div>
        ) : (
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
                data-action="forgot_email"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition"
              data-action="forgot_submit"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <p className="text-center text-gray-400 text-sm mt-6">
          <a href={signInPath} className="text-blue-400 hover:underline font-medium">
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
