"use client";

import React, { useState, useEffect } from "react";
import { useModulePage, ModulePageHeader, ModulePageSkeleton } from "./shared";

type HealthData = {
  status: string;
  uptime: number;
  uptimeFormatted: string;
  memory: { total: string; free: string; used: string; usedPercent: number };
  disk: { total: string; used: string; free: string; usedPercent: number };
  cpu: { cores: number; model: string; loadAvg: number[] };
  platform: string;
};

const statusColours: Record<string, string> = {
  ok: "text-emerald-400 bg-emerald-500/20",
  warning: "text-amber-400 bg-amber-500/20",
  critical: "text-red-400 bg-red-500/20",
};

function ProgressBar({ percent, thresholds = [70, 90] }: { percent: number; thresholds?: [number, number] }) {
  const colour = percent > thresholds[1] ? "bg-red-500" : percent > thresholds[0] ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${colour}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

export default function OpsPage() {
  const { apiBase, adminSecret } = useModulePage();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminSecret) return;
    async function fetchHealth() {
      try {
        console.log("[OpsAdmin] Fetching health data");
        const res = await fetch(`${apiBase}/api/ops/health`, {
          headers: { "x-admin-key": adminSecret },
        });
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
          console.log("[OpsAdmin] Health data loaded, status:", data.status);
        }
      } catch (err) {
        console.error("[OpsAdmin] Error fetching health:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [apiBase, adminSecret]);

  const icon = <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-blue-400"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>;

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="Ops/Health" description="System health and server monitoring" />

      {loading ? (
        <ModulePageSkeleton />
      ) : health ? (
        <div className="space-y-6">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${statusColours[health.status] || statusColours.critical}`}>
            <span className="w-2 h-2 rounded-full bg-current" />
            {health.status.toUpperCase()} - Uptime: {health.uptimeFormatted}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm font-medium mb-4">Memory</p>
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{health.memory.used} used</span>
                  <span>{health.memory.total} total</span>
                </div>
                <ProgressBar percent={health.memory.usedPercent} />
              </div>
              <p className="text-2xl font-bold">{health.memory.usedPercent}%</p>
              <p className="text-xs text-gray-500 mt-1">{health.memory.free} free</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm font-medium mb-4">Disk</p>
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{health.disk.used} used</span>
                  <span>{health.disk.total} total</span>
                </div>
                <ProgressBar percent={health.disk.usedPercent} />
              </div>
              <p className="text-2xl font-bold">{health.disk.usedPercent}%</p>
              <p className="text-xs text-gray-500 mt-1">{health.disk.free} free</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm font-medium mb-4">CPU</p>
              <p className="text-sm text-white font-medium mb-2">{health.cpu.model}</p>
              <p className="text-2xl font-bold">{health.cpu.cores} cores</p>
              <div className="mt-3 space-y-1">
                {["1m", "5m", "15m"].map((label, i) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-gray-500">Load ({label})</span>
                    <span className="text-gray-300">{health.cpu.loadAvg[i]?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Platform</p>
            <p className="text-sm text-gray-300">{health.platform}</p>
          </div>
        </div>
      ) : (
        <p className="text-gray-500">Failed to load health data.</p>
      )}
    </div>
  );
}
