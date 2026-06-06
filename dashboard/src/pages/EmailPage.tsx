"use client";

import React, { useState, useEffect } from "react";
import { useModulePage, ModulePageHeader, ModulePageSkeleton, ModulePageEmpty } from "./shared";

type EmailLog = { id: string; to: string; subject: string; template?: string; status: string; sentAt: string };

export default function EmailPage() {
  const { apiBase, adminSecret } = useModulePage();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminSecret) return;
    async function fetchData() {
      try {
        console.log("[EmailAdmin] Fetching email logs");
        const res = await fetch(`${apiBase}/api/emails/logs`, { headers: { "x-admin-key": adminSecret } });
        if (res.ok) { const d = await res.json(); setLogs(d.logs || d.emails || []); }
      } catch (err) { console.error("[EmailAdmin] Error:", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [apiBase, adminSecret]);

  const icon = <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-blue-400"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>;

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="Email" description="Email service logs and delivery tracking" />
      {loading ? <ModulePageSkeleton /> : logs.length === 0 ? (
        <ModulePageEmpty icon={icon} message="No email logs recorded yet." hint="Emails sent via the framework will appear here." />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left p-4">To</th><th className="text-left p-4">Subject</th>
              <th className="text-left p-4 w-28">Template</th><th className="text-left p-4 w-24">Status</th><th className="text-left p-4 w-40">Sent</th>
            </tr></thead>
            <tbody>{logs.map((log) => (
              <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-4 text-white font-medium">{log.to}</td>
                <td className="p-4 text-gray-300">{log.subject}</td>
                <td className="p-4"><span className="bg-gray-700/50 text-gray-300 text-xs px-2 py-0.5 rounded-full">{log.template || "custom"}</span></td>
                <td className="p-4"><span className={`text-xs font-medium ${log.status === "sent" ? "text-emerald-400" : "text-red-400"}`}>{log.status}</span></td>
                <td className="p-4 text-gray-400 text-xs">{new Date(log.sentAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
