"use client";

import React, { useState, useEffect } from "react";
import { useModulePage, ModulePageHeader, ModulePageSkeleton, ModulePageEmpty } from "./shared";

type Setting = { key: string; value: string; category: string; isSecret: boolean; description?: string };

export default function SettingsPage() {
  const { apiBase, adminSecret } = useModulePage();
  const [settings, setSettings] = useState<Record<string, Setting[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!adminSecret) return;
    async function fetchData() {
      try {
        console.log("[SettingsAdmin] Fetching settings");
        const res = await fetch(`${apiBase}/api/app-settings`, { headers: { "x-admin-key": adminSecret } });
        if (res.ok) { const d = await res.json(); setSettings(d.settings || {}); }
      } catch (err) { console.error("[SettingsAdmin] Error:", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [apiBase, adminSecret]);

  function toggleExpand(key: string) {
    setExpandedKeys((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

  const allSettings = Object.entries(settings);
  const totalCount = allSettings.reduce((sum, [, items]) => sum + items.length, 0);
  const icon = <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-blue-400"><path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" /></svg>;

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="Settings" description="Encrypted application settings (AES-256-GCM)" />
      {loading ? <ModulePageSkeleton /> : totalCount === 0 ? (
        <ModulePageEmpty icon={icon} message="No settings stored yet." />
      ) : (
        <div className="space-y-4">{allSettings.map(([category, items]) => (
          <div key={category} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <p className="text-sm font-semibold text-white capitalize">{category}</p>
              <p className="text-xs text-gray-500">{items.length} setting{items.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="divide-y divide-gray-800/50">{items.map((setting) => {
              const isExpanded = expandedKeys.has(setting.key);
              let parsedValue: unknown = null;
              try { parsedValue = JSON.parse(setting.value); } catch { /* not JSON */ }
              return (
                <div key={setting.key} className="hover:bg-gray-800/30">
                  <button onClick={() => toggleExpand(setting.key)} className="w-full p-4 flex items-center justify-between text-left">
                    <div>
                      <p className="text-sm text-white font-medium font-mono">{setting.key}</p>
                      {setting.description && <p className="text-xs text-gray-500 mt-0.5">{setting.description}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      {setting.isSecret && <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-medium">Secret</span>}
                      <svg viewBox="0 0 20 20" fill="currentColor" className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      {setting.isSecret ? <p className="text-xs text-gray-500 italic">Value is encrypted and hidden.</p>
                        : parsedValue && typeof parsedValue === "object" ? <pre className="text-xs text-gray-300 bg-gray-800 p-3 rounded-lg overflow-x-auto max-h-64 font-mono">{JSON.stringify(parsedValue, null, 2)}</pre>
                        : <code className="text-xs text-gray-300 bg-gray-800 px-3 py-2 rounded-lg block font-mono">{setting.value}</code>}
                    </div>
                  )}
                </div>
              );
            })}</div>
          </div>
        ))}</div>
      )}
    </div>
  );
}
