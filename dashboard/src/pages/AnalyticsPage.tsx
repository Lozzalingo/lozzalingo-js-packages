"use client";

import React, { useState, useEffect } from "react";
import { useModulePage, ModulePageHeader, ModulePageSkeleton, ModulePageEmpty } from "./shared";

type OverviewStats = { totalVisitors: number; uniqueVisitors: number; pageViews: number; bounceRate?: number };
type TopPage = { path: string; views: number };
type DeviceStats = { desktop: number; mobile: number; tablet: number };

export default function AnalyticsPage() {
  const { apiBase, adminSecret } = useModulePage();
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [devices, setDevices] = useState<DeviceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminSecret) return;
    async function fetchData() {
      try {
        console.log("[AnalyticsAdmin] Fetching analytics data");
        const headers: Record<string, string> = { "x-admin-key": adminSecret };
        const [overviewRes, pagesRes, devicesRes] = await Promise.all([
          fetch(`${apiBase}/api/analytics/overview`, { headers }).catch(() => null),
          fetch(`${apiBase}/api/analytics/pages`, { headers }).catch(() => null),
          fetch(`${apiBase}/api/analytics/devices`, { headers }).catch(() => null),
        ]);
        if (overviewRes?.ok) setOverview(await overviewRes.json());
        if (pagesRes?.ok) { const d = await pagesRes.json(); setTopPages(d.pages || []); }
        if (devicesRes?.ok) setDevices(await devicesRes.json());
        console.log("[AnalyticsAdmin] Data loaded");
      } catch (err) { console.error("[AnalyticsAdmin] Error:", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [apiBase, adminSecret]);

  const icon = <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-blue-400"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>;

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="Analytics" description="Visitor tracking and traffic insights" />
      {loading ? <ModulePageSkeleton /> : (
        <div className="space-y-6">
          {overview ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Visitors", value: overview.totalVisitors, colour: "" },
                { label: "Unique Visitors", value: overview.uniqueVisitors, colour: "text-emerald-400" },
                { label: "Page Views", value: overview.pageViews, colour: "text-amber-400" },
                ...(overview.bounceRate != null ? [{ label: "Bounce Rate", value: `${overview.bounceRate}%`, colour: "text-purple-400" }] : []),
              ].map((s) => (
                <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <p className="text-gray-400 text-sm mb-2">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.colour}`}>{s.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <ModulePageEmpty icon={icon} message="Analytics data will appear here once visitors are tracked." hint="The analytics module is active and collecting data." />
          )}
          {devices && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-4 font-semibold">Devices</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[{ label: "Desktop", value: devices.desktop }, { label: "Mobile", value: devices.mobile }, { label: "Tablet", value: devices.tablet }].map((d) => (
                  <div key={d.label}><p className="text-lg font-bold">{d.value}</p><p className="text-xs text-gray-400">{d.label}</p></div>
                ))}
              </div>
            </div>
          )}
          {topPages.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800"><p className="text-sm font-semibold">Top Pages</p></div>
              <table className="w-full text-sm"><tbody>{topPages.slice(0, 10).map((page) => (
                <tr key={page.path} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-4 text-gray-300 font-mono text-xs">{page.path}</td>
                  <td className="p-4 text-right text-white font-semibold">{page.views}</td>
                </tr>
              ))}</tbody></table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
