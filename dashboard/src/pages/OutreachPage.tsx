"use client";

import React, { useState, useEffect } from "react";
import { useModulePage, ModulePageHeader, ModulePageSkeleton, ModulePageEmpty } from "./shared";

type OutreachLog = { id: string; trigger: string; email: string; status: string; createdAt: string };
type ScheduledItem = { id: string; trigger: string; email: string; scheduledFor: string };

export default function OutreachPage() {
  const { apiBase, adminSecret } = useModulePage();
  const [logs, setLogs] = useState<OutreachLog[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"log" | "scheduled">("log");

  useEffect(() => {
    if (!adminSecret) return;
    async function fetchData() {
      try {
        console.log("[OutreachAdmin] Fetching outreach data");
        const headers: Record<string, string> = { "x-admin-key": adminSecret };
        const [logRes, schedRes] = await Promise.all([
          fetch(`${apiBase}/api/outreach/log`, { headers }),
          fetch(`${apiBase}/api/outreach/scheduled`, { headers }),
        ]);
        if (logRes.ok) { const d = await logRes.json(); setLogs(d.log || d.logs || []); }
        if (schedRes.ok) { const d = await schedRes.json(); setScheduled(d.scheduled || []); }
        console.log("[OutreachAdmin] Data loaded");
      } catch (err) { console.error("[OutreachAdmin] Error:", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [apiBase, adminSecret]);

  async function cancelScheduled(id: string) {
    try {
      await fetch(`${apiBase}/api/outreach/scheduled/${id}`, { method: "DELETE", headers: { "x-admin-key": adminSecret } });
      setScheduled((prev) => prev.filter((s) => s.id !== id));
      console.log("[OutreachAdmin] Cancelled:", id);
    } catch (err) { console.error("[OutreachAdmin] Cancel error:", err); }
  }

  const icon = <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-blue-400"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>;

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="Outreach" description="Automated email triggers and scheduled follow-ups" />

      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        <button onClick={() => setTab("log")} className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === "log" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}>Outreach Log</button>
        <button onClick={() => setTab("scheduled")} className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${tab === "scheduled" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}>
          Scheduled {scheduled.length > 0 && <span className="bg-amber-500/20 text-amber-400 text-xs px-1.5 py-0.5 rounded-full">{scheduled.length}</span>}
        </button>
      </div>

      {loading ? <ModulePageSkeleton /> : tab === "log" ? (
        logs.length === 0 ? <ModulePageEmpty icon={icon} message="No outreach emails sent yet." /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left p-4">Trigger</th><th className="text-left p-4">Email</th>
                <th className="text-left p-4 w-24">Status</th><th className="text-left p-4 w-40">Sent</th>
              </tr></thead>
              <tbody>{logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-4"><span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full font-medium">{log.trigger.replace(/_/g, " ")}</span></td>
                  <td className="p-4 text-white">{log.email}</td>
                  <td className="p-4"><span className={`text-xs font-medium ${log.status === "sent" ? "text-emerald-400" : "text-red-400"}`}>{log.status}</span></td>
                  <td className="p-4 text-gray-400 text-xs">{new Date(log.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
      ) : (
        scheduled.length === 0 ? <ModulePageEmpty icon={icon} message="No scheduled outreach emails." /> : (
          <div className="space-y-2">{scheduled.map((item) => (
            <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full font-medium">{item.trigger.replace(/_/g, " ")}</span>
                <span className="text-white text-sm ml-3">{item.email}</span>
                <span className="text-gray-500 text-xs ml-3">Scheduled for {new Date(item.scheduledFor).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <button onClick={() => cancelScheduled(item.id)} className="text-red-400 hover:text-red-300 transition p-2 text-xs">Cancel</button>
            </div>
          ))}</div>
        )
      )}
    </div>
  );
}
