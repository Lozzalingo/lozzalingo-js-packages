"use client";

import React, { useState } from "react";

/**
 * Standard Lozzalingo registration page.
 * Mirrors the Python framework's auth/register.html template.
 */

type RegisterPageProps = {
  brandName?: string;
  brandLogo?: string;
  signInPath?: string;
  /** API endpoint for registration (default: /api/auth/register) */
  registerEndpoint?: string;
};

export default function RegisterPage({
  brandName = "Lozzalingo",
  brandLogo,
  signInPath = "/sign-in",
  registerEndpoint = "/api/auth/register",
}: RegisterPageProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate (matching Python's register route validation)
    if (!firstName || !lastName || !email || !password) {
      setError("All fields are required");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      console.log("[Auth] Registration attempt for:", email);

      const res = await fetch(registerEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(data.message || "Account created! Please check your email to verify your account.");
        console.log("[Auth] Registration successful");
      } else {
        setError(data.error || "Failed to create account");
        console.log("[Auth] Registration failed:", data.error);
      }
    } catch (err) {
      console.error("[Auth] Registration error:", err);
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
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-gray-400 text-sm mt-1">Sign up for {brandName}</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-4 py-3 mb-6 text-emerald-400 text-sm">
            {success}
            <a href={signInPath} className="block mt-2 text-emerald-300 hover:underline font-medium">
              Go to sign in
            </a>
          </div>
        )}

        {/* Registration form */}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First"
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  data-action="register_first_name"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last"
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  data-action="register_last_name"
                />
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                data-action="register_email"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                data-action="register_password"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                data-action="register_confirm_password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition"
              data-action="register_submit"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}

        {/* Sign in link */}
        <p className="text-center text-gray-400 text-sm mt-6">
          Already have an account?{" "}
          <a href={signInPath} className="text-blue-400 hover:underline font-medium">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
