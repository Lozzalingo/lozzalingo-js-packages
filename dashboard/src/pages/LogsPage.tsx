"use client";

import React, { useState, useEffect } from "react";
import { useModulePage, ModulePageHeader, ModulePageSkeleton, ModulePageEmpty } from "./shared";

type LogEntry = { id: string; level: string; message: string; context?: string; createdAt: string };
type LogStats = { total: number; byLevel?: Record<string, number> };

const levelColours: Record<string, string> = {
  error: "bg-red-500/20 text-red-400", warn: "bg-amber-500/20 text-amber-400",
  info: "bg-blue-500/20 text-blue-400", debug: "bg-gray-500/20 text-gray-400",
};

export default function LogsPage() {
  const { apiBase, adminSecret } = useModulePage();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminSecret) return;
    async function fetchData() {
      try {
        console.log("[LogsAdmin] Fetching logs");
        const headers: Record<string, string> = { "x-admin-key": adminSecret };
        const [logsRes, statsRes] = await Promise.all([
          fetch(`${apiBase}/api/logs?limit=50`, { headers }),
          fetch(`${apiBase}/api/logs/stats`, { headers }),
        ]);
        if (logsRes.ok) { const d = await logsRes.json(); setLogs(d.logs || []); setTotal(d.total || 0); }
        if (statsRes.ok) { setStats(await statsRes.json()); }
        console.log("[LogsAdmin] Data loaded");
      } catch (err) { console.error("[LogsAdmin] Error:", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [apiBase, adminSecret]);

  const icon = <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-blue-400"><path d="M5.5 2A1.5 1.5 0 004 3.5V4h-.5A1.5 1.5 0 002 5.5v11A1.5 1.5 0 003.5 18h10a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0013.5 4H13v-.5A1.5 1.5 0 0011.5 2h-6z" /></svg>;

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="Logs" description="Persistent structured logs" />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Total Entries</p>
            <p className="text-2xl font-bold">{stats.total || total}</p>
          </div>
          {stats.byLevel && Object.entries(stats.byLevel).map(([level, count]) => (
            <div key={level} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm mb-1 capitalize">{level}</p>
              <p className={`text-2xl font-bold ${levelColours[level]?.split(" ")[1] || "text-gray-300"}`}>{count}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? <ModulePageSkeleton rows={5} /> : logs.length === 0 ? (
        <ModulePageEmpty icon={icon} message="No log entries yet." />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left p-4 w-20">Level</th><th className="text-left p-4">Message</th>
                <th className="text-left p-4 w-24">Context</th><th className="text-left p-4 w-40">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-4"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${levelColours[log.level] || levelColours.info}`}>{log.level}</span></td>
                  <td className="p-4 text-gray-300 font-mono text-xs">{log.message}</td>
                  <td className="p-4 text-gray-500 text-xs">{log.context || "-"}</td>
                  <td className="p-4 text-gray-400 text-xs">{new Date(log.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > logs.length && <p className="text-center text-gray-500 text-xs py-3">Showing {logs.length} of {total}</p>}
        </div>
      )}
    </div>
  );
}
