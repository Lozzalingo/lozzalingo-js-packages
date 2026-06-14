export type CalEvent = {
  id: string;
  title: string;
  subtitle?: string;
  startTime: string;
  endTime: string;
  type: string;
};

export type BookingCalendarSource = {
  id: string;
  customerName?: string | null;
  groupSize?: number | null;
  eventDate?: string | null;
  eventTime?: string | null;
  slotStartTime?: string | null;
  slotEndTime?: string | null;
  duration?: string | null;
  bufferHours?: number | null;
  status?: string | null;
  locationName?: string | null;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

type BookingCalendarOptions = {
  visibility?: "admin" | "public";
  /** Custom status-to-type mapping. Defaults to BucketRace statuses. */
  statusMap?: Record<string, CalEvent["type"]>;
};

const DEFAULT_STATUS_MAP: Record<string, CalEvent["type"]> = {
  ENQUIRY: "enquiry",
  INVOICE_SENT: "enquiry",
  CONFIRMED: "confirmed",
  DEPOSIT_PAID: "confirmed",
  PAID: "paid",
  COMPLETED: "paid",
  LOST: "blocked",
  QUALIFIED_OUT: "blocked",
  CANCELLED: "blocked",
};

export function bookingToCalEvent(
  b: BookingCalendarSource,
  options: BookingCalendarOptions = {}
): CalEvent | null {
  if (!b.eventDate) return null;
  const dateStr = b.eventDate.split("T")[0];

  let startTime: string;
  let endTime: string;

  if (b.slotStartTime && b.slotEndTime) {
    startTime = `${dateStr}T${b.slotStartTime}:00`;
    endTime = `${dateStr}T${b.slotEndTime}:00`;
  } else if (b.eventTime) {
    const rangeMatch = b.eventTime.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (rangeMatch) {
      startTime = `${dateStr}T${pad(parseInt(rangeMatch[1]))}:${rangeMatch[2]}:00`;
      endTime = `${dateStr}T${pad(parseInt(rangeMatch[3]))}:${rangeMatch[4]}:00`;
    } else {
      const timeMatch = b.eventTime.match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) return null;
      const startMin = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
      const dur = parseFloat(b.duration || "2") * 60;
      const endMin = startMin + dur;
      startTime = `${dateStr}T${pad(Math.floor(startMin / 60))}:${pad(Math.round(startMin % 60))}:00`;
      endTime = `${dateStr}T${pad(Math.floor(endMin / 60))}:${pad(Math.round(endMin % 60))}:00`;
    }
  } else {
    return null;
  }

  const bufferMins = b.bufferHours || 0;
  if (bufferMins > 0) {
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    startDate.setMinutes(startDate.getMinutes() - bufferMins);
    endDate.setMinutes(endDate.getMinutes() + bufferMins);
    startTime = `${dateStr}T${pad(startDate.getHours())}:${pad(startDate.getMinutes())}:00`;
    endTime = `${dateStr}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;
  }

  const statusMap = options.statusMap || DEFAULT_STATUS_MAP;
  const isPublic = options.visibility === "public";

  return {
    id: b.id,
    title: isPublic ? "Booked" : b.customerName || "Booking",
    subtitle: isPublic ? undefined : `${b.groupSize || 0} ppl${b.locationName ? ` - ${b.locationName}` : ""}`,
    startTime,
    endTime,
    type: statusMap[b.status || ""] || "confirmed",
  };
}
