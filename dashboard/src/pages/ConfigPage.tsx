"use client";

import React, { useState, useEffect } from "react";
import { useModulePage, ModulePageHeader, ModulePageSkeleton } from "./shared";

export default function ConfigPage() {
  const { apiBase, adminSecret } = useModulePage();
  const [features, setFeatures] = useState<string[]>([]);
  const [settingCategories, setSettingCategories] = useState<Record<string, unknown[]>>({});
  const [testResults, setTestResults] = useState<Record<string, { success?: boolean; error?: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminSecret) return;
    async function fetchData() {
      try {
        console.log("[ConfigAdmin] Fetching config data");
        const headers: Record<string, string> = { "x-admin-key": adminSecret };
        const [healthRes, settingsRes] = await Promise.all([
          fetch(`${apiBase}/api/health`, { headers }),
          fetch(`${apiBase}/api/app-settings`, { headers }),
        ]);
        if (healthRes.ok) { const d = await healthRes.json(); setFeatures(d.features || []); }
        if (settingsRes.ok) { const d = await settingsRes.json(); setSettingCategories(d.settings || {}); }
      } catch (err) { console.error("[ConfigAdmin] Error:", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [apiBase, adminSecret]);

  async function testConnection(service: string) {
    try {
      console.log("[ConfigAdmin] Testing", service, "connection");
      const res = await fetch(`${apiBase}/api/app-settings/test-${service}`, { method: "POST", headers: { "x-admin-key": adminSecret } });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [service]: data }));
    } catch (err) {
      console.error(`[ConfigAdmin] ${service} test error:`, err);
      setTestResults((prev) => ({ ...prev, [service]: { success: false, error: "Connection failed" } }));
    }
  }

  const icon = <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-blue-400"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>;

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="Config" description="Configuration and service connections" />
      {loading ? <ModulePageSkeleton /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {["stripe", "resend"].map((service) => (
              <div key={service} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold capitalize mb-3">{service} Connection</h3>
                <button onClick={() => testConnection(service)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition" data-action={`config_test_${service}`}>Test Connection</button>
                {testResults[service] && <p className={`text-sm mt-3 ${testResults[service].success ? "text-emerald-400" : "text-red-400"}`}>{testResults[service].success ? "Connected!" : testResults[service].error || "Failed"}</p>}
              </div>
            ))}
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-3 font-semibold">Registered Features</p>
            <div className="flex flex-wrap gap-2">{features.map((f) => (
              <span key={f} className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-medium">{f}</span>
            ))}</div>
          </div>
          {Object.keys(settingCategories).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Stored Settings</p>
                <a href="/admin/settings" className="text-blue-400 hover:underline text-xs font-medium">View all settings</a>
              </div>
              <div className="space-y-2">{Object.entries(settingCategories).map(([cat, items]) => (
                <div key={cat} className="flex items-center justify-between py-2 border-b border-gray-800/50">
                  <span className="text-sm text-white capitalize">{cat}</span>
                  <span className="text-xs text-gray-400">{Array.isArray(items) ? items.length : 0} setting{Array.isArray(items) && items.length !== 1 ? "s" : ""}</span>
                </div>
              ))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
