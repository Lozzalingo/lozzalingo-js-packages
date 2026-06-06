"use client";

import React, { useState, useEffect } from "react";

// ── Icon Map ────────────────────────────────────────────────────────────────
// Simple SVG icons to avoid a react-icons dependency in the shared package.
// Each returns a 16x16 SVG element.

const ICONS: Record<string, React.ReactNode> = {
  cog: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  ),
  "clipboard-list": (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M5.5 2A1.5 1.5 0 004 3.5V4h-.5A1.5 1.5 0 002 5.5v11A1.5 1.5 0 003.5 18h10a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0013.5 4H13v-.5A1.5 1.5 0 0011.5 2h-6zM13 5.5v1a.5.5 0 01-.5.5h-8a.5.5 0 01-.5-.5v-1h9zM6 9.5a.5.5 0 01.5-.5h4a.5.5 0 010 1h-4a.5.5 0 01-.5-.5zm.5 2.5a.5.5 0 000 1h4a.5.5 0 000-1h-4z" />
    </svg>
  ),
  envelope: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  ),
  sliders: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
    </svg>
  ),
  heartbeat: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
    </svg>
  ),
  "cloud-upload": (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 0113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  "calendar-check": (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm6.7 8.7a1 1 0 00-1.4-1.4L9 11.586 7.707 10.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l3-3z" clipRule="evenodd" />
    </svg>
  ),
  "credit-card": (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
      <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
    </svg>
  ),
  "paper-plane": (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
  "shopping-bag": (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
    </svg>
  ),
  plug: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
    </svg>
  ),
  "chart-bar": (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  ),
  gamepad: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M8 5a1 1 0 011 1v1h2V6a1 1 0 112 0v1h1a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h1V6a1 1 0 011-1zM6 11a1 1 0 100 2 1 1 0 000-2zm7-1a1 1 0 100 2 1 1 0 000-2z" />
    </svg>
  ),
  tshirt: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4z" clipRule="evenodd" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
      <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  ),
  sync: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
    </svg>
  ),
  "puzzle-piece": (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
    </svg>
  ),
};

// ── Category Colour Map ─────────────────────────────────────────────────────

const CATEGORY_COLOURS: Record<string, { accent: string; iconBg: string; border: string }> = {
  infrastructure: {
    accent: "text-blue-400",
    iconBg: "bg-blue-500/20",
    border: "border-blue-500/20",
  },
  commerce: {
    accent: "text-emerald-400",
    iconBg: "bg-emerald-500/20",
    border: "border-emerald-500/20",
  },
  content: {
    accent: "text-amber-400",
    iconBg: "bg-amber-500/20",
    border: "border-amber-500/20",
  },
  optional: {
    accent: "text-purple-400",
    iconBg: "bg-purple-500/20",
    border: "border-purple-500/20",
  },
};

// ── Types ───────────────────────────────────────────────────────────────────

type ModuleInfo = {
  key: string;
  label: string;
  description: string;
  category: string;
  icon: string;
  enabled: boolean;
  registered: boolean;
  route: string | null;
  adminPath: string | null;
};

type DashboardData = {
  site: { name: string; tagline?: string };
  modules: ModuleInfo[];
  categories: Record<string, string>;
  summary: { total: number; enabled: number; registered: number };
};

type ModulesDashboardProps = {
  apiBase: string;
  adminSecret?: string;
  showDisabled?: boolean;
};

// ── Component ───────────────────────────────────────────────────────────────

export default function ModulesDashboard({
  apiBase,
  adminSecret,
  showDisabled = false,
}: ModulesDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchModules() {
      try {
        console.log("[ModulesDashboard] Fetching modules");
        const headers: Record<string, string> = {};
        if (adminSecret) {
          headers["x-admin-secret"] = adminSecret;
          headers["x-admin-key"] = adminSecret;
        }

        const res = await fetch(`${apiBase}/api/dashboard/modules`, { headers });
        if (!res.ok) {
          throw new Error(`Failed to fetch modules: ${res.status}`);
        }
        const json = await res.json();
        setData(json);
        console.log("[ModulesDashboard] Loaded", json.summary.enabled, "active modules");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[ModulesDashboard] Error:", message);
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchModules();
  }, [apiBase, adminSecret]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 bg-gray-800 rounded w-56 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-5 text-red-400">
        <p className="font-semibold mb-1">Failed to load modules</p>
        <p className="text-sm text-red-400/70">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  // Group modules by category
  const grouped: Record<string, ModuleInfo[]> = {};
  for (const mod of data.modules) {
    if (!showDisabled && !mod.enabled) continue;
    if (!grouped[mod.category]) grouped[mod.category] = [];
    grouped[mod.category].push(mod);
  }

  const categoryOrder = ["infrastructure", "commerce", "content", "optional"];

  return (
    <div className="space-y-8">
      {/* Summary bar */}
      <div className="flex items-center gap-6">
        <h2 className="text-xl font-bold text-white">Active Modules</h2>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>
            <span className="text-emerald-400 font-semibold">{data.summary.registered}</span> registered
          </span>
          <span className="text-gray-600">|</span>
          <span>
            <span className="text-blue-400 font-semibold">{data.summary.enabled}</span> enabled
          </span>
          <span className="text-gray-600">|</span>
          <span>
            <span className="text-gray-300 font-semibold">{data.summary.total}</span> total
          </span>
        </div>
      </div>

      {/* Category groups */}
      {categoryOrder.map((catKey) => {
        const modules = grouped[catKey];
        if (!modules || modules.length === 0) return null;
        const catColour = CATEGORY_COLOURS[catKey] || CATEGORY_COLOURS.optional;
        const catLabel = data.categories[catKey] || catKey;

        return (
          <div key={catKey}>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-3 font-semibold">
              {catLabel}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {modules.map((mod) => (
                <ModuleCard key={mod.key} module={mod} catColour={catColour} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Module Card ─────────────────────────────────────────────────────────────

function ModuleCard({
  module: mod,
  catColour,
}: {
  module: ModuleInfo;
  catColour: { accent: string; iconBg: string; border: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const icon = ICONS[mod.icon] || ICONS["puzzle-piece"];
  const isActive = mod.enabled && mod.registered;
  const opacity = mod.enabled ? "" : "opacity-40";
  const hasAdminPage = mod.adminPath && isActive;

  function handleClick() {
    if (hasAdminPage) {
      window.location.href = mod.adminPath!;
    } else {
      setExpanded((prev) => !prev);
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`bg-gray-900 border ${isActive ? catColour.border : "border-gray-800"} rounded-xl p-4 transition cursor-pointer group ${opacity} ${
        hasAdminPage
          ? "hover:border-gray-500 hover:bg-gray-800/50"
          : "hover:border-gray-600"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 ${catColour.iconBg} rounded-lg flex items-center justify-center ${catColour.accent}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white leading-tight">{mod.label}</h3>
            {mod.route && (
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">{mod.route}</p>
            )}
          </div>
        </div>

        {/* Status dot */}
        <div className="flex items-center gap-1.5 mt-1">
          {isActive ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Active
            </span>
          ) : mod.enabled ? (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Enabled
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
              Off
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed mt-2">{mod.description}</p>

      {/* Footer - navigable link or expand hint */}
      <div className="mt-3 flex items-center justify-between">
        {hasAdminPage ? (
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${catColour.accent} group-hover:underline`}>
            Open
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </span>
        ) : isActive ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 group-hover:text-gray-400">
            {expanded ? "Less" : "Details"}
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </span>
        ) : (
          <span />
        )}
      </div>

      {/* Expanded detail panel */}
      {expanded && isActive && (
        <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
          {mod.route && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">API Route</span>
              <code className="text-[11px] text-gray-300 bg-gray-800 px-2 py-0.5 rounded font-mono">{mod.route}</code>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Status</span>
            <span className="text-[11px] text-emerald-400">Registered and running</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Package</span>
            <code className="text-[11px] text-gray-300 bg-gray-800 px-2 py-0.5 rounded font-mono">@lozzalingo/{mod.key.replace(/_/g, "-")}</code>
          </div>
        </div>
      )}
    </div>
  );
}
