"use client";

import React from "react";
import { ModulePageHeader } from "./shared";

export default function ExternalApiPage() {
  const icon = <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-blue-400"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>;

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="External API" description="API key management and external article endpoints" />
      <div className="space-y-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-sm font-semibold mb-4">Endpoints</p>
          <div className="space-y-3 text-sm">
            {[
              { method: "GET", path: "/api/external/articles", access: "Public", colour: "text-emerald-400" },
              { method: "POST", path: "/api/external/articles", access: "API Key Required", colour: "text-amber-400" },
              { method: "GET", path: "/api/admin/api-keys", access: "Admin Only", colour: "text-red-400" },
              { method: "POST", path: "/api/admin/api-keys", access: "Admin Only", colour: "text-red-400" },
            ].map((ep) => (
              <div key={`${ep.method} ${ep.path}`} className="flex items-center justify-between">
                <code className="text-gray-300 bg-gray-800 px-2 py-1 rounded font-mono text-xs">{ep.method} {ep.path}</code>
                <span className={`${ep.colour} text-xs font-medium`}>{ep.access}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-sm font-semibold mb-2">About</p>
          <p className="text-sm text-gray-400">The External API module lets external services (like AI Blog Builder) publish content to this site using API keys. Articles are published as blog posts and managed via the blog admin page.</p>
        </div>
      </div>
    </div>
  );
}
