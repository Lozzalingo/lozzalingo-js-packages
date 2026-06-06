"use client";

import React from "react";
import { ModulePageHeader } from "./shared";

export default function AuthPage() {
  const icon = <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-blue-400"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>;

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="Auth" description="Authentication middleware and token management" />
      <div className="space-y-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <span className="text-lg font-semibold mb-4 block">Auth Module Status</span>
          <div className="space-y-3 text-sm">
            {[
              { label: "Admin auth middleware", value: "Active", isCode: false },
              { label: "Password reset", value: "POST /api/shared-auth/forgot-password", isCode: true },
              { label: "Email verification", value: "POST /api/shared-auth/verify-email", isCode: true },
              { label: "Rate limiting", value: "Enabled", isCode: false },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                <span className="text-gray-400">{row.label}</span>
                {row.isCode ? <code className="text-gray-300 bg-gray-800 px-2 py-0.5 rounded font-mono text-xs">{row.value}</code>
                  : <span className="text-emerald-400 text-xs font-medium">{row.value}</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-sm font-semibold mb-2">About</p>
          <p className="text-sm text-gray-400">The auth module provides shared authentication utilities across all Lozzalingo sites, including password reset tokens, email verification flows, and admin middleware. It uses rate limiting to prevent abuse of auth endpoints.</p>
        </div>
      </div>
    </div>
  );
}
