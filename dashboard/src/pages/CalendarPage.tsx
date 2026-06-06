"use client";

import React, { useState, useEffect } from "react";
import { useModulePage, ModulePageHeader, ModulePageSkeleton, ModulePageEmpty } from "./shared";

type CalendarEvent = { id: string; title: string; startTime: string; endTime: string; status: string; source?: string };
const statusColours: Record<string, string> = { blocked: "bg-red-500/20 text-red-400", available: "bg-emerald-500/20 text-emerald-400", tentative: "bg-amber-500/20 text-amber-400" };

export default function CalendarPage() {
  const { apiBase, adminSecret } = useModulePage();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminSecret) return;
    async function fetchData() {
      try {
        console.log("[CalendarAdmin] Fetching blocked slots");
        const res = await fetch(`${apiBase}/api/calendar/blocked`, { headers: { "x-admin-key": adminSecret } });
        if (res.ok) { const d = await res.json(); setEvents(d.events || d.slots || []); }
      } catch (err) { console.error("[CalendarAdmin] Error:", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [apiBase, adminSecret]);

  const icon = <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-blue-400"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>;

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="Calendar" description="Availability, time-slot blocking, and iCal sync" />
      {loading ? <ModulePageSkeleton rows={4} /> : events.length === 0 ? (
        <ModulePageEmpty icon={icon} message="No calendar events found." />
      ) : (
        <div className="space-y-2">{events.map((event) => (
          <div key={event.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center min-w-[60px]">
                <p className="text-lg font-bold text-white">{new Date(event.startTime).toLocaleDateString("en-GB", { day: "numeric" })}</p>
                <p className="text-[10px] text-gray-400 uppercase">{new Date(event.startTime).toLocaleDateString("en-GB", { month: "short" })}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-white">{event.title}</p>
                <p className="text-xs text-gray-400">{new Date(event.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} - {new Date(event.endTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {event.source && <span className="bg-gray-700/50 text-gray-300 text-[10px] px-2 py-0.5 rounded-full">{event.source}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColours[event.status] || statusColours.blocked}`}>{event.status}</span>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}
