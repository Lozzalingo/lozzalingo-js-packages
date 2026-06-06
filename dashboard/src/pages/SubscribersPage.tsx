"use client";

import React, { useState, useEffect } from "react";
import { useModulePage, ModulePageHeader, ModulePageSkeleton, ModulePageEmpty } from "./shared";

type Subscriber = { email: string; source: string; optIn: boolean; createdAt: string };
type Stats = { total: number; optedIn: number; thisMonth: number };

export default function SubscribersPage() {
  const { apiBase, adminSecret } = useModulePage();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminSecret) return;
    async function fetchData() {
      try {
        console.log("[SubscribersAdmin] Fetching subscribers");
        const headers: Record<string, string> = { "x-admin-key": adminSecret };
        const [subsRes, statsRes] = await Promise.all([
          fetch(`${apiBase}/api/shared-subscribers?limit=50`, { headers }),
          fetch(`${apiBase}/api/shared-subscribers/stats`, { headers }),
        ]);
        if (subsRes.ok) { const d = await subsRes.json(); setSubscribers(d.subscribers || []); setTotal(d.total || 0); }
        if (statsRes.ok) { setStats(await statsRes.json()); }
        console.log("[SubscribersAdmin] Data loaded");
      } catch (err) { console.error("[SubscribersAdmin] Error:", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [apiBase, adminSecret]);

  const icon = <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-blue-400"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>;

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="Subscribers" description="Newsletter subscriptions and opt-in management">
        <button
          onClick={() => window.open(`${apiBase}/api/shared-subscribers/export?adminKey=${adminSecret}`, "_blank")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition"
        >
          Export CSV
        </button>
      </ModulePageHeader>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total", value: stats.total, colour: "" },
            { label: "Opted In", value: stats.optedIn, colour: "text-emerald-400" },
            { label: "This Month", value: stats.thisMonth, colour: "text-blue-400" },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.colour}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? <ModulePageSkeleton rows={5} /> : subscribers.length === 0 ? (
        <ModulePageEmpty icon={icon} message="No subscribers yet." />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left p-4">Email</th><th className="text-left p-4">Source</th>
                <th className="text-left p-4">Opted In</th><th className="text-left p-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((sub) => (
                <tr key={sub.email} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-4 text-white font-medium">{sub.email}</td>
                  <td className="p-4"><span className="bg-gray-700/50 text-gray-300 text-xs px-2 py-0.5 rounded-full">{sub.source || "unknown"}</span></td>
                  <td className="p-4"><span className={`text-xs font-medium ${sub.optIn ? "text-emerald-400" : "text-red-400"}`}>{sub.optIn ? "Yes" : "No"}</span></td>
                  <td className="p-4 text-gray-400">{new Date(sub.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > subscribers.length && <p className="text-center text-gray-500 text-xs py-3">Showing {subscribers.length} of {total}</p>}
        </div>
      )}
    </div>
  );
}
