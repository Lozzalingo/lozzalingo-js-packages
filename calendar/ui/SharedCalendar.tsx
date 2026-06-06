"use client";

/**
 * SharedCalendar - Month overview with day drill-down
 *
 * Default view: month grid showing mini event previews per day.
 * Click a day to drill into a full day view with time grid (09:00-20:00).
 * On admin pages, can also show the classic week view.
 * Prevents duplicate bookings by clearly showing booked vs available slots.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { FaChevronLeft, FaChevronRight, FaArrowLeft } from "react-icons/fa";

// ── Constants ──────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 52; // px per hour row
const START_HOUR = 9;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const GRID_HEIGHT = HOURS.length * HOUR_HEIGHT;
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ── Types ──────────────────────────────────────────────────────────────────

export type CalEvent = {
  id: string;
  title: string;
  subtitle?: string;
  startTime: string; // ISO or YYYY-MM-DDTHH:mm:ss
  endTime: string;
  type: "available" | "confirmed" | "paid" | "enquiry" | "pending" | "blocked" | "selected";
};

type TimeSlot = {
  startTime: string;
  endTime: string;
  label: string;
  available: boolean;
};

type Props = {
  events: CalEvent[];
  onEventClick?: (event: CalEvent) => void;
  onSlotClick?: (date: string, hour: number) => void;
  onSelectTimeSlot?: (date: string, startTime: string, endTime: string, label: string) => void;
  theme?: "light" | "dark";
  selectedEventId?: string | null;
  initialDate?: string; // YYYY-MM-DD, jump to this week on load
  fetchAvailability?: boolean; // Auto-fetch blocked slots from time-slots API
  availabilityDuration?: number; // Duration in minutes for availability check (default 120)
  apiBaseUrl?: string; // API base URL for self-fetching (required if fetchAvailability=true)
  durationMinutes?: number; // If set, enables time-slot picker when a day is clicked
  minNoticeDays?: number; // Minimum days notice for bookable dates (default 7)
};

type ViewMode = "month" | "day";

// ── Colour map ─────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<CalEvent["type"], { bg: string; border: string; text: string; label: string; dot: string }> = {
  available: { bg: "bg-emerald-500", border: "border-l-emerald-700", text: "text-white", label: "Available", dot: "bg-emerald-500" },
  confirmed: { bg: "bg-teal-500", border: "border-l-teal-700", text: "text-white", label: "Confirmed", dot: "bg-teal-500" },
  paid: { bg: "bg-green-600", border: "border-l-green-800", text: "text-white", label: "Booked", dot: "bg-green-600" },
  enquiry: { bg: "bg-sky-400", border: "border-l-sky-600", text: "text-white", label: "Enquiry", dot: "bg-sky-400" },
  pending: { bg: "bg-amber-400", border: "border-l-amber-600", text: "text-amber-900", label: "Pending", dot: "bg-amber-400" },
  blocked: { bg: "bg-gray-400", border: "border-l-gray-600", text: "text-white", label: "Blocked", dot: "bg-gray-400" },
  selected: { bg: "bg-orange-500", border: "border-l-orange-700", text: "text-white", label: "Your Booking", dot: "bg-orange-500" },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDayOfWeekIndex(d: Date): number {
  const day = d.getDay();
  return day === 0 ? 6 : day - 1; // Mon=0 .. Sun=6
}

function dateRangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

/** Get all dates for a month grid (includes padding days from prev/next month) */
function getMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startPad = getDayOfWeekIndex(firstDay); // days to show from prev month
  const gridStart = addDays(firstDay, -startPad);
  // Always show 6 rows (42 cells) for consistent height
  const dates: Date[] = [];
  for (let i = 0; i < 42; i++) {
    dates.push(addDays(gridStart, i));
  }
  return dates;
}

// ── Shared: render a single day column (for day view) ─────────────────────

function DayColumn({
  d,
  todayKey,
  minDate,
  eventsByDate,
  selectedEventId,
  onSlotClick,
  setSelectedDate,
  onEventClick,
  dk,
}: {
  d: Date;
  todayKey: string;
  minDate: string;
  eventsByDate: Record<string, CalEvent[]>;
  selectedEventId?: string | null;
  onSlotClick?: (date: string, hour: number) => void;
  setSelectedDate: (date: string) => void;
  onEventClick?: (event: CalEvent) => void;
  dk: boolean;
}) {
  const key = toDateKey(d);
  const isPast = key < todayKey;
  const isUnbookable = key < minDate;
  const dayEvents = eventsByDate[key] || [];

  return (
    <div className="relative">
      {/* Hour cells (clickable) */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          className={`absolute w-full border-b transition-colors ${
            isUnbookable
              ? dk
                ? "border-gray-800/60 bg-gray-900/60 cursor-not-allowed"
                : "border-gray-100 bg-gray-100/60 cursor-not-allowed"
              : dk
              ? `border-gray-800/60 cursor-pointer ${isPast ? "" : "hover:bg-gray-800/40"}`
              : `border-gray-100 cursor-pointer ${isPast ? "bg-gray-50/40" : "hover:bg-blue-50/40"}`
          }`}
          style={{
            top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`,
            height: `${HOUR_HEIGHT}px`,
          }}
          onClick={() => {
            if (isPast || key < minDate) return;
            setSelectedDate(key);
            onSlotClick?.(key, hour);
          }}
          data-action={`cal_slot_${key}_${hour}`}
        >
          <div
            className={`absolute w-full top-1/2 border-b border-dashed ${
              dk ? "border-gray-800/30" : "border-gray-100/80"
            }`}
          />
        </div>
      ))}

      {/* Event blocks */}
      {dayEvents.map((ev) => {
        const evStart = new Date(ev.startTime);
        const evEnd = new Date(ev.endTime);
        const dayKey = toDateKey(d);
        const evStartKey = toDateKey(evStart);
        const evEndKey = toDateKey(evEnd);
        const isMultiDay = evStartKey !== evEndKey;

        // Clamp start/end to this day's operating hours for multi-day events
        let sMin: number;
        let eMin: number;
        if (isMultiDay) {
          sMin = dayKey === evStartKey ? evStart.getHours() * 60 + evStart.getMinutes() : START_HOUR * 60;
          eMin = dayKey === evEndKey ? evEnd.getHours() * 60 + evEnd.getMinutes() : END_HOUR * 60;
          // If the event starts before operating hours on the first day, clamp to start
          if (sMin < START_HOUR * 60) sMin = START_HOUR * 60;
          if (eMin < START_HOUR * 60) eMin = END_HOUR * 60; // ends before grid, fill whole day
          if (eMin > END_HOUR * 60) eMin = END_HOUR * 60;
        } else {
          sMin = evStart.getHours() * 60 + evStart.getMinutes();
          eMin = evEnd.getHours() * 60 + evEnd.getMinutes();
        }

        // Skip if entirely outside operating hours
        if (sMin >= END_HOUR * 60 || eMin <= START_HOUR * 60) return null;
        if (sMin < START_HOUR * 60) sMin = START_HOUR * 60;
        if (eMin > END_HOUR * 60) eMin = END_HOUR * 60;

        const top = ((sMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
        const height = Math.max(((eMin - sMin) / 60) * HOUR_HEIGHT, 22);
        const st = TYPE_STYLES[ev.type] || TYPE_STYLES.confirmed;
        const isSel = ev.id === selectedEventId;

        // Display label for multi-day events
        const displayTitle = isMultiDay
          ? dayKey === evStartKey ? ev.title : `${ev.title} (cont.)`
          : ev.title;

        return (
          <div
            key={ev.id}
            className={`absolute left-[2px] right-[2px] rounded-md border-l-4 px-1.5 py-0.5 overflow-hidden cursor-pointer transition-all
              ${st.bg} ${st.text} ${st.border}
              ${isSel ? "ring-2 ring-blue-400 shadow-lg z-30" : "z-10 hover:shadow-md hover:brightness-110"}
            `}
            style={{ top: `${top + 1}px`, height: `${height - 2}px` }}
            onClick={(e) => {
              e.stopPropagation();
              console.log(`[SharedCalendar] Event clicked: ${ev.id} (${ev.title})`);
              onEventClick?.(ev);
            }}
            data-action={`cal_event_${ev.id}`}
          >
            <p className="text-[10px] font-bold truncate leading-tight">{displayTitle}</p>
            {height > 32 && ev.subtitle && (
              <p className="text-[9px] opacity-80 truncate">{ev.subtitle}</p>
            )}
            {height > 46 && (
              <p className="text-[9px] opacity-70 mt-0.5">
                {isMultiDay && dayKey !== evStartKey && dayKey !== evEndKey
                  ? "All day"
                  : `${evStart.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} - ${evEnd.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                }
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SharedCalendar({
  events,
  onEventClick,
  onSlotClick,
  onSelectTimeSlot,
  theme = "light",
  selectedEventId,
  initialDate,
  fetchAvailability = false,
  availabilityDuration = 120,
  apiBaseUrl = "",
  durationMinutes,
  minNoticeDays = 7,
}: Props) {
  // First bookable date
  const firstBookable = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + minNoticeDays);
    return d;
  }, [minNoticeDays]);

  // View mode: month overview or day drill-down
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  // Month view: which month/year to display
  const [viewMonth, setViewMonth] = useState(() => firstBookable.getMonth());
  const [viewYear, setViewYear] = useState(() => firstBookable.getFullYear());

  // Day view: which date to show
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = new Date(firstBookable);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const hasJumped = useRef(false);
  const todayKey = toDateKey(new Date());
  const dk = theme === "dark";

  // Self-fetched blocked events from time-slots API
  const [fetchedEvents, setFetchedEvents] = useState<CalEvent[]>([]);

  // Time-slot picker state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotLabel, setSelectedSlotLabel] = useState<string | null>(null);

  // Minimum bookable date
  const minDate = useMemo(() => toDateKey(firstBookable), [firstBookable]);

  // Jump to initialDate once
  useEffect(() => {
    if (initialDate && !hasJumped.current) {
      hasJumped.current = true;
      const d = new Date(initialDate + "T12:00:00");
      setViewMonth(d.getMonth());
      setViewYear(d.getFullYear());
      setViewDate(d);
    }
  }, [initialDate]);

  // Month grid dates
  const monthGrid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  // For fetchAvailability, compute the week dates from the current view
  const weekDates = useMemo(() => {
    if (viewMode === "day") {
      // Just the single day for fetching
      return [viewDate];
    }
    // For month view, use the full month grid for fetching
    return monthGrid;
  }, [viewMode, viewDate, monthGrid]);

  const blockingEvents = useMemo(
    () => events.filter((event) => event.type !== "available" && event.type !== "selected"),
    [events]
  );
  const blockingEventKey = useMemo(
    () => blockingEvents.map((event) => `${event.id}:${event.startTime}:${event.endTime}:${event.type}`).join("|"),
    [blockingEvents]
  );

  // Fetch blocked slots from time-slots API
  useEffect(() => {
    if (!fetchAvailability) return;
    const today = toDateKey(new Date());

    const fetchSlots = async () => {
      const newEvents: CalEvent[] = [];
      for (const d of weekDates) {
        const dateKey = toDateKey(d);
        if (dateKey < today) continue;
        try {
          const res = await fetch(
            `${apiBaseUrl}/api/calendar/time-slots/${dateKey}?duration=${availabilityDuration}`
          );
          if (!res.ok) continue;
          const data = await res.json();
          let blockStart: string | null = null;
          let blockEnd: string | null = null;
          for (const slot of data.slots || []) {
            if (!slot.available) {
              if (!blockStart) blockStart = slot.startTime;
              blockEnd = slot.endTime;
            } else if (blockStart && blockEnd) {
              newEvents.push({ id: `blocked-${blockStart}`, title: "Booked", startTime: blockStart, endTime: blockEnd, type: "blocked" });
              blockStart = null;
              blockEnd = null;
            }
          }
          if (blockStart && blockEnd) {
            newEvents.push({ id: `blocked-${blockStart}`, title: "Booked", startTime: blockStart, endTime: blockEnd, type: "blocked" });
          }
        } catch {
          console.error(`[SharedCalendar] Failed to fetch slots for ${dateKey}`);
        }
      }
      setFetchedEvents(newEvents);
      console.log(`[SharedCalendar] Fetched ${newEvents.length} blocked ranges`);
    };

    fetchSlots();
  }, [fetchAvailability, availabilityDuration, weekDates]);

  // Fetch time slots when a date is selected and durationMinutes is set
  useEffect(() => {
    if (!selectedDate || !durationMinutes || !apiBaseUrl) {
      setTimeSlots([]);
      return;
    }
    const fetchSlots = async () => {
      setLoadingSlots(true);
      setSelectedSlotLabel(null);
      try {
        console.log(`[SharedCalendar] Fetching time slots for ${selectedDate}, ${durationMinutes}m`);
        const res = await fetch(`${apiBaseUrl}/api/calendar/time-slots/${selectedDate}?duration=${durationMinutes}`);
        if (res.ok) {
          const result = await res.json();
          const slots = result.slots || [];
          const slotsWithCalendarBlocks = slots.map((slot: TimeSlot) => {
            const blockedByBookingEvent = blockingEvents.some((event) =>
              dateRangesOverlap(
                new Date(slot.startTime),
                new Date(slot.endTime),
                new Date(event.startTime),
                new Date(event.endTime)
              )
            );
            return blockedByBookingEvent ? { ...slot, available: false } : slot;
          });
          setTimeSlots(slotsWithCalendarBlocks);
          console.log(`[SharedCalendar] Got ${result.slots?.length || 0} time slots`);
        }
      } catch {
        console.error("[SharedCalendar] Failed to fetch time slots");
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [selectedDate, durationMinutes, apiBaseUrl, blockingEventKey]);

  // Merge passed events with fetched events
  const allEvents = useMemo(() => [...events, ...fetchedEvents], [events, fetchedEvents]);

  // Group events by date (multi-day events appear on every day they span)
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of allEvents) {
      const start = new Date(ev.startTime);
      const end = new Date(ev.endTime);
      // Walk each day from start to end
      const d = new Date(start);
      d.setHours(0, 0, 0, 0);
      // If the event ends at midnight (local time) on the last day, don't include it.
      // All-day events from iCal end at midnight of the next day in the source timezone.
      // After UTC conversion this becomes 23:00 or 00:00 depending on DST, so check local.
      const endDay = new Date(end);
      const endsAtLocalMidnight = end.getHours() === 0 && end.getMinutes() === 0;
      if (endsAtLocalMidnight && toDateKey(start) !== toDateKey(end)) {
        endDay.setDate(endDay.getDate() - 1);
      }
      endDay.setHours(0, 0, 0, 0);
      while (d <= endDay) {
        const key = toDateKey(d);
        if (!map[key]) map[key] = [];
        map[key].push(ev);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [allEvents]);

  // Only show legend for types present in data
  const activeTypes = useMemo(() => {
    const types = new Set(allEvents.map((e) => e.type));
    return Object.entries(TYPE_STYLES).filter(([t]) => types.has(t as CalEvent["type"]));
  }, [allEvents]);

  // Scroll to current time when entering day view
  useEffect(() => {
    if (viewMode !== "day" || !scrollRef.current) return;
    const h = new Date().getHours();
    if (h >= START_HOUR && h < END_HOUR) {
      scrollRef.current.scrollTop = Math.max(0, (h - START_HOUR) * HOUR_HEIGHT - 40);
    }
  }, [viewMode, viewDate]);

  // Current time indicator (day view)
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowInRange = nowMin >= START_HOUR * 60 && nowMin < END_HOUR * 60;
  const nowTop = ((nowMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;

  // Navigation
  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);
  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const prevDay = useCallback(() => setViewDate((d) => addDays(d, -1)), []);
  const nextDay = useCallback(() => setViewDate((d) => addDays(d, 1)), []);

  const openDay = useCallback((d: Date) => {
    const key = toDateKey(d);
    if (key < minDate) return;
    setViewDate(d);
    setViewMode("day");
    setSelectedDate(key);
    onSlotClick?.(key, START_HOUR);
  }, [minDate, onSlotClick]);

  const backToMonth = useCallback(() => {
    setViewMode("month");
    // Sync month view to the current day being viewed
    setViewMonth(viewDate.getMonth());
    setViewYear(viewDate.getFullYear());
  }, [viewDate]);

  // Day view helpers
  const viewDateKey = toDateKey(viewDate);
  const viewDateIsToday = viewDateKey === todayKey;
  const viewDateIsUnbookable = viewDateKey < minDate;
  const viewDayIndex = getDayOfWeekIndex(viewDate);

  // ── Time-slot picker (shared) ─────────────────────────────────────────────

  const timeSlotPicker = durationMinutes && selectedDate ? (
    <div className={`px-4 py-4 border-t ${dk ? "border-gray-700" : "border-gray-200"}`}>
      <h4 className={`text-sm font-semibold mb-2 ${dk ? "text-white" : "text-gray-900"}`}>
        {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        {" - "}
        <span className={dk ? "text-gray-400" : "text-gray-500"}>
          {durationMinutes >= 60
            ? `${durationMinutes / 60} hour${durationMinutes > 60 ? "s" : ""}`
            : `${durationMinutes} min`}
        </span>
      </h4>

      {loadingSlots ? (
        <p className={`text-xs ${dk ? "text-gray-500" : "text-gray-400"}`}>Loading available times...</p>
      ) : timeSlots.length === 0 ? (
        <p className={`text-xs ${dk ? "text-gray-500" : "text-gray-400"}`}>No time slots available for this date and duration.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
          {timeSlots.map((slot) => {
            const isSel = selectedSlotLabel === slot.label;
            return (
              <button
                key={slot.label}
                type="button"
                disabled={!slot.available}
                onClick={() => {
                  setSelectedSlotLabel(slot.label);
                  onSelectTimeSlot?.(selectedDate, slot.startTime, slot.endTime, slot.label);
                  onSlotClick?.(selectedDate, parseInt(slot.label.split(":")[0]));
                }}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition border text-center ${
                  !slot.available
                    ? dk
                      ? "bg-red-500/10 text-red-400/50 border-red-500/20 cursor-not-allowed line-through"
                      : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through"
                    : isSel
                    ? dk
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500"
                      : "bg-emerald-500 text-white border-emerald-600"
                    : dk
                    ? "bg-gray-800 text-gray-300 border-gray-700 hover:border-emerald-500/50"
                    : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400"
                }`}
                data-action={`cal_timeslot_${slot.label.replace(/[: -]/g, "")}`}
              >
                {slot.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  ) : null;

  // ── Legend (shared) ────────────────────────────────────────────────────────

  const legend = activeTypes.length > 0 ? (
    <div
      className={`flex flex-wrap items-center gap-3 px-4 py-2 border-t text-[10px] ${
        dk ? "border-gray-700 text-gray-500" : "border-gray-200 text-gray-400"
      }`}
    >
      {activeTypes.map(([type, style]) => (
        <div key={type} className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-sm ${style.bg}`} />
          <span>{style.label}</span>
        </div>
      ))}
    </div>
  ) : null;

  // ── Time gutter (day view) ────────────────────────────────────────────────

  const timeGutter = (
    <div className={`relative border-r ${dk ? "border-gray-800" : "border-gray-200"}`}>
      {HOURS.map((hour) => (
        <div
          key={hour}
          className={`absolute right-0 pr-2 text-[10px] font-medium leading-none ${
            dk ? "text-gray-600" : "text-gray-400"
          }`}
          style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, transform: "translateY(-50%)" }}
        >
          {String(hour).padStart(2, "0")}:00
        </div>
      ))}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // DAY VIEW: Full time grid for a single day
  // ══════════════════════════════════════════════════════════════════════════

  if (viewMode === "day") {
    return (
      <div
        className={`rounded-xl border overflow-hidden ${
          dk ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200 shadow-sm"
        }`}
      >
        {/* ── Day header ──────────────────────────────────────── */}
        <div
          className={`flex items-center justify-between px-3 py-2.5 border-b ${
            dk ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <button
            type="button"
            onClick={backToMonth}
            className={`flex items-center gap-1.5 p-2 rounded-lg transition text-xs font-medium ${
              dk ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"
            }`}
            data-action="cal_back_month"
          >
            <FaArrowLeft className="text-[10px]" />
            <span className="hidden sm:inline">{MONTH_NAMES[viewDate.getMonth()]}</span>
            <span className="sm:hidden">Back</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevDay}
              className={`p-2 rounded-lg transition ${dk ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
              data-action="cal_prev_day"
            >
              <FaChevronLeft className="text-xs" />
            </button>
            <div className="text-center min-w-[140px]">
              <div className={`text-[10px] font-medium uppercase tracking-wide ${dk ? "text-gray-500" : "text-gray-400"}`}>
                {DAYS_LONG[viewDayIndex]}
              </div>
              <div className={`text-sm font-bold ${
                viewDateIsUnbookable
                  ? dk ? "text-gray-600" : "text-gray-300"
                  : viewDateIsToday
                  ? "text-blue-500"
                  : dk ? "text-white" : "text-gray-900"
              }`}>
                {viewDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
              {viewDateIsUnbookable && (
                <div className={`text-[10px] mt-0.5 ${dk ? "text-gray-600" : "text-gray-400"}`}>
                  Not available yet
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={nextDay}
              className={`p-2 rounded-lg transition ${dk ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
              data-action="cal_next_day"
            >
              <FaChevronRight className="text-xs" />
            </button>
          </div>

          <div className="w-[60px]" /> {/* Spacer to balance the back button */}
        </div>

        {/* ── Time grid ───────────────────────────────────────── */}
        <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: `${7 * HOUR_HEIGHT}px` }}>
          <div className="relative" style={{ height: `${GRID_HEIGHT}px` }}>
            <div className="grid grid-cols-[48px_1fr] absolute inset-0">
              {timeGutter}
              <DayColumn
                d={viewDate}
                todayKey={todayKey}
                minDate={minDate}
                eventsByDate={eventsByDate}
                selectedEventId={selectedEventId}
                onSlotClick={onSlotClick}
                setSelectedDate={setSelectedDate}
                onEventClick={onEventClick}
                dk={dk}
              />
            </div>

            {/* Current time indicator */}
            {viewDateIsToday && nowInRange && (
              <div
                className="absolute z-20 pointer-events-none"
                style={{ top: `${nowTop}px`, left: "44px", right: "0" }}
              >
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full flex-shrink-0 -ml-[5px]" />
                  <div className="flex-1 h-[2px] bg-red-500" />
                </div>
              </div>
            )}
          </div>
        </div>

        {timeSlotPicker}
        {legend}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MONTH VIEW: Grid of days with mini event previews
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        dk ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200 shadow-sm"
      }`}
    >
      {/* ── Month header ──────────────────────────────────────── */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 border-b ${
          dk ? "border-gray-700" : "border-gray-200"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={prevMonth}
            className={`p-1.5 rounded-lg transition ${dk ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
            data-action="cal_prev_month"
          >
            <FaChevronLeft className="text-xs" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className={`p-1.5 rounded-lg transition ${dk ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
            data-action="cal_next_month"
          >
            <FaChevronRight className="text-xs" />
          </button>
          <h3 className={`text-sm font-semibold ml-2 ${dk ? "text-white" : "text-gray-900"}`}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h3>
        </div>
      </div>

      {/* ── Day-of-week headers ───────────────────────────────── */}
      <div
        className={`grid grid-cols-7 border-b ${dk ? "border-gray-700" : "border-gray-200"}`}
      >
        {DAYS_SHORT.map((day, i) => (
          <div
            key={day}
            className={`text-center py-1.5 text-[10px] font-medium uppercase tracking-wide ${
              i > 0 ? "border-l" : ""
            } ${dk ? "border-gray-800 text-gray-500" : "border-gray-100 text-gray-400"}`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* ── Month grid ────────────────────────────────────────── */}
      <div className={`grid grid-cols-7 ${dk ? "bg-gray-900" : "bg-white"}`}>
        {monthGrid.map((d, i) => {
          const key = toDateKey(d);
          const isCurrentMonth = d.getMonth() === viewMonth;
          const isToday = key === todayKey;
          const isUnbookable = key < minDate;
          const isPast = key < todayKey;
          const dayEvents = eventsByDate[key] || [];
          const isBookable = isCurrentMonth && !isUnbookable && !isPast;

          return (
            <div
              key={key}
              className={`
                relative min-h-[72px] sm:min-h-[80px] p-1 sm:p-1.5 border-b
                ${i % 7 > 0 ? "border-l" : ""}
                ${dk ? "border-gray-800" : "border-gray-100"}
                ${!isCurrentMonth
                  ? dk ? "bg-gray-950/50" : "bg-gray-50/50"
                  : isUnbookable
                  ? dk ? "bg-gray-900/80" : "bg-gray-50/80"
                  : ""
                }
                ${isBookable ? dk ? "hover:bg-gray-800/50 cursor-pointer" : "hover:bg-blue-50/40 cursor-pointer" : ""}
                ${!isBookable && isCurrentMonth ? "cursor-not-allowed" : ""}
                ${!isCurrentMonth ? "cursor-default" : ""}
                transition-colors
              `}
              onClick={() => {
                if (!isBookable) return;
                openDay(d);
              }}
              data-action={`cal_month_${key}`}
            >
              {/* Date number */}
              <div className="flex items-start justify-between">
                <span
                  className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                    isToday
                      ? "bg-blue-500 text-white"
                      : !isCurrentMonth
                      ? dk ? "text-gray-700" : "text-gray-300"
                      : isUnbookable
                      ? dk ? "text-gray-600" : "text-gray-300"
                      : dk
                      ? "text-gray-200"
                      : "text-gray-800"
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>

              {/* Mini event indicators */}
              {isCurrentMonth && dayEvents.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => {
                    const st = TYPE_STYLES[ev.type] || TYPE_STYLES.confirmed;
                    const evStart = new Date(ev.startTime);
                    const evEnd = new Date(ev.endTime);
                    const evStartKey = toDateKey(evStart);
                    const evEndKey = toDateKey(evEnd);
                    const isMultiDay = evStartKey !== evEndKey;
                    // Show appropriate time label
                    // All-day events start/end at midnight in the source timezone.
                    // Check local time since the browser converts to the user's timezone.
                    const startsAtLocalMidnight = evStart.getHours() === 0 && evStart.getMinutes() === 0;
                    const endsAtLocalMidnight = evEnd.getHours() === 0 && evEnd.getMinutes() === 0;
                    const timeStr = isMultiDay
                      ? key === evStartKey
                        ? startsAtLocalMidnight ? "All day" : evStart.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                        : key === evEndKey && !endsAtLocalMidnight
                        ? "until " + evEnd.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                        : "All day"
                      : evStart.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                    // For public view, show "Blocked" not the real title
                    const displayTitle = ev.type === "blocked" ? "Blocked" : ev.title;
                    return (
                      <div
                        key={ev.id}
                        className={`${st.bg} ${st.text} rounded px-1 py-px truncate`}
                      >
                        <span className="text-[9px] font-medium leading-tight">
                          <span className="hidden sm:inline">{timeStr} </span>{displayTitle}
                        </span>
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className={`text-[9px] font-medium px-1 ${dk ? "text-gray-500" : "text-gray-400"}`}>
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {legend}
    </div>
  );
}
