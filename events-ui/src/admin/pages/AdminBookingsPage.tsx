"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useEventsConfig } from "../../context/EventsProvider";
import {
  FaCalendarCheck, FaPlus, FaSearch, FaChevronDown, FaChevronUp,
  FaEnvelope, FaFileInvoice, FaSync, FaCheck, FaTimes, FaUser,
  FaPhone, FaBuilding, FaUsers, FaClock, FaMapMarkerAlt, FaPuzzlePiece,
  FaMedal, FaCamera, FaStar, FaExclamationTriangle, FaPaperPlane, FaGamepad,
  FaTrash, FaExternalLinkAlt,
} from "react-icons/fa";

import SharedCalendar, { type CalEvent } from "@lozzalingo/calendar/ui/SharedCalendar";
import { bookingToCalEvent } from "../../lib/booking-calendar";

// ── Types ────────────────────────────────────────────────────────────────────

type Booking = {
  id: string;
  bookingNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  companyName?: string;
  groupSize: number;
  eventDate: string;
  eventTime?: string;
  message?: string;
  status: string;
  bookingType: string;
  groupType?: string;
  style?: string;
  drinkStyle?: string;
  firstPlacePrize?: string;
  taskSections?: string;
  duration?: string;
  slotStartTime?: string;
  slotEndTime?: string;
  timeBlocking?: string;
  bufferHours?: number;
  totalPaid: number;
  specialRequests?: string;
  wantsMedals: boolean;
  wantsPhotoPrints: boolean;
  productId?: string;
  packageId?: string;
  locationName?: string;
  notes?: string;
  source?: string;
  assignedTo?: string;
  calendarEventId?: string;
  createdAt: string;
  updatedAt: string;
};

type Product = {
  id: string;
  slug: string;
  name: string;
};

type LocationOption = {
  id: string;
  slug: string;
  name: string;
};

type InvoiceLineItem = { name: string; unitPricePence: number; quantity: number };

type Invoice = {
  id: string;
  bookingId: string;
  stripeInvoiceId?: string;
  invoiceNumber?: string;
  hostedInvoiceUrl?: string;
  status: "DRAFT" | "SENT" | "PAID" | "VOID" | "UNCOLLECTIBLE";
  totalAmountPence: number;
  currency: string;
  lineItems: InvoiceLineItem[];
  description?: string;
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
};

const INVOICE_STATUS_COLOURS: Record<string, string> = {
  DRAFT: "bg-gray-500/20 text-gray-400",
  SENT: "bg-amber-500/20 text-amber-400",
  PAID: "bg-green-500/20 text-green-400",
  VOID: "bg-red-500/20 text-red-400",
  UNCOLLECTIBLE: "bg-red-500/20 text-red-400",
};

const STATUSES = ["ENQUIRY", "INVOICE_SENT", "CONFIRMED", "DEPOSIT_PAID", "PAID", "COMPLETED", "LOST", "QUALIFIED_OUT", "CANCELLED"];

const STATUS_COLOURS: Record<string, string> = {
  ENQUIRY: "bg-blue-500/20 text-blue-400",
  INVOICE_SENT: "bg-amber-500/20 text-amber-400",
  CONFIRMED: "bg-emerald-500/20 text-emerald-400",
  DEPOSIT_PAID: "bg-teal-500/20 text-teal-400",
  PAID: "bg-green-500/20 text-green-400",
  COMPLETED: "bg-gray-500/20 text-gray-400",
  LOST: "bg-red-500/20 text-red-400",
  QUALIFIED_OUT: "bg-orange-500/20 text-orange-400",
  CANCELLED: "bg-red-500/20 text-red-400",
};

// ── Booking config defaults (overridden by /api/app-settings/booking_config) ────
type OptionItem = { value: string; label: string };

const DEFAULT_GROUP_TYPES: OptionItem[] = [
  { value: "corporate", label: "Corporate" }, { value: "hen", label: "Hen" }, { value: "birthday", label: "Birthday" },
  { value: "sten", label: "Sten" }, { value: "stag", label: "Stag" }, { value: "other", label: "Other" },
];
const DEFAULT_STYLES: OptionItem[] = [{ value: "professional", label: "Professional" }, { value: "cheeky", label: "Cheeky" }];
const DEFAULT_DRINK_STYLES: OptionItem[] = [{ value: "sober", label: "Sober" }, { value: "boozy", label: "Boozy" }];
const DEFAULT_FIRST_PLACE_PRIZES: OptionItem[] = [{ value: "prosecco", label: "Prosecco" }, { value: "no-secco", label: "No-secco" }, { value: "bring-our-own", label: "We'll bring our own" }];
const DEFAULT_MISC_THEMES: OptionItem[] = [
  { value: "no-theme", label: "No Theme" },
  { value: "halloween", label: "Halloween" }, { value: "christmas", label: "Christmas" }, { value: "easter", label: "Easter" },
  { value: "summer", label: "Summer" }, { value: "winter", label: "Winter" }, { value: "guy-fawkes", label: "Guy Fawkes" },
  { value: "valentines", label: "Valentines" }, { value: "bespoke", label: "Bespoke Theme" },
];

function formatPence(pence?: number | null): string {
  if (!pence && pence !== 0) return "-";
  return `\u00A3${(pence / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function parseTaskSections(raw?: string): Array<{ type: string; locationSlug?: string; miscTheme?: string; bespokeTheme?: string }> {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdminBookingsPage() {
  const { apiBase, adminSecret } = useEventsConfig();
  const headers: Record<string, string> = { "x-admin-key": adminSecret || "", "Content-Type": "application/json" };

  // Data
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Booking config (loaded from single source of truth)
  const [groupTypes, setGroupTypes] = useState<OptionItem[]>(DEFAULT_GROUP_TYPES);
  const [styles, setStyles] = useState<OptionItem[]>(DEFAULT_STYLES);
  const [drinkStyles, setDrinkStyles] = useState<OptionItem[]>(DEFAULT_DRINK_STYLES);
  const [firstPlacePrizes, setFirstPlacePrizes] = useState<OptionItem[]>(DEFAULT_FIRST_PLACE_PRIZES);
  const [miscThemes, setMiscThemes] = useState<OptionItem[]>(DEFAULT_MISC_THEMES);

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string; type: "success" | "error" } | null>(null);

  // Edit state
  const [editingBooking, setEditingBooking] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | number | boolean | null>>({});

  // Invoice state
  const [invoicesByBooking, setInvoicesByBooking] = useState<Record<string, Invoice[]>>({});
  const [creatingInvoice, setCreatingInvoice] = useState<string | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<{ lineItems: Array<{ name: string; unitPricePence: string; quantity: string }>; description: string }>({
    lineItems: [{ name: "", unitPricePence: "", quantity: "1" }],
    description: "",
  });

  function startEditing(b: Booking) {
    setEditingBooking(b.id);
    setEditForm({
      customerName: b.customerName, customerEmail: b.customerEmail,
      customerPhone: b.customerPhone || "", companyName: b.companyName || "",
      groupSize: b.groupSize, eventDate: b.eventDate ? b.eventDate.split("T")[0] : "",
      eventTime: b.eventTime || "", duration: b.duration || "",
      groupType: b.groupType || "", style: b.style || "",
      drinkStyle: b.drinkStyle || "", firstPlacePrize: b.firstPlacePrize || "",
      locationName: b.locationName || "", message: b.message || "",
      notes: b.notes || "",
      wantsMedals: b.wantsMedals || false, wantsPhotoPrints: b.wantsPhotoPrints || false,
      taskSections: b.taskSections || "[]", specialRequests: b.specialRequests || "",
      productId: b.productId || "", packageId: b.packageId || "",
      slotStartTime: b.slotStartTime || "", slotEndTime: b.slotEndTime || "",
      bookingType: b.bookingType || "PRIVATE", timeBlocking: b.timeBlocking || "buffer",
      bufferHours: b.bufferHours ?? "",
      source: b.source || "", assignedTo: b.assignedTo || "",
    });
  }

  async function saveEdit(bookingId: string) {
    setActionLoading(bookingId);
    try {
      console.log("[AdminBookings] Saving edit:", bookingId);
      const res = await fetch(`${apiBase}/api/bookings/admin/bookings/${bookingId}`, {
        method: "PUT", headers, body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setActionMessage({ id: bookingId, text: "Booking updated", type: "success" });
        setEditingBooking(null);
        fetchBookings();
      } else {
        const data = await res.json().catch(() => null);
        setActionMessage({ id: bookingId, text: data?.error || "Failed to update", type: "error" });
      }
    } catch { setActionMessage({ id: bookingId, text: "Network error", type: "error" }); }
    finally { setActionLoading(null); setTimeout(() => setActionMessage(null), 3000); }
  }

  // Create form
  const [createForm, setCreateForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", companyName: "",
    groupSize: "10", productId: "", groupType: "corporate", style: "professional",
    drinkStyle: "sober", firstPlacePrize: "prosecco", duration: "2",
    eventDate: "", eventTime: "", message: "", locationName: "",
    wantsMedals: false, wantsPhotoPrints: false,
    taskSections: "[]", notes: "", source: "admin",
    timeBlocking: "buffer", bufferHours: "",
  });

  // Time slots state
  const [availableSlots, setAvailableSlots] = useState<Array<{ startTime: string; endTime: string; label: string; available: boolean }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  async function fetchTimeSlots(date: string, duration: string) {
    if (!date || !duration) { setAvailableSlots([]); return; }
    setLoadingSlots(true);
    try {
      const durationMinutes = Math.round(parseFloat(duration) * 60);
      console.log(`[AdminBookings] Fetching time slots for ${date}, ${durationMinutes}m`);
      const res = await fetch(`${apiBase}/api/calendar/time-slots/${date}?duration=${durationMinutes}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(data.slots || []);
        console.log(`[AdminBookings] Got ${data.slots?.length || 0} slots, ${data.slots?.filter((s: { available: boolean }) => s.available).length || 0} available`);
      }
    } catch { console.error("[AdminBookings] Failed to fetch time slots"); }
    finally { setLoadingSlots(false); }
  }

  // Re-fetch slots when duration changes
  useEffect(() => {
    if (createForm.eventDate && createForm.duration) {
      fetchTimeSlots(createForm.eventDate, createForm.duration);
    }
  }, [createForm.duration]);

  // ── Fetch data ──────────────────────────────────────────────────────────

  const fetchBookings = useCallback(async () => {
    try {
      console.log("[AdminBookings] Fetching bookings");
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`${apiBase}/api/bookings/admin/bookings?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.data || []);
        console.log(`[AdminBookings] Loaded ${data.data?.length || 0} bookings`);
      }
    } catch (err) { console.error("[AdminBookings] Failed to fetch bookings:", err); }
    finally { setLoading(false); }
  }, [statusFilter, adminSecret]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [pRes, lRes, cfgRes] = await Promise.all([
          fetch(`${apiBase}/api/products`),
          fetch(`${apiBase}/api/locations`),
          fetch(`${apiBase}/api/app-settings/booking_config`),
        ]);
        if (pRes.ok) { const d = await pRes.json(); setProducts(Array.isArray(d) ? d : []); }
        if (lRes.ok) { const d = await lRes.json(); setLocations(Array.isArray(d) ? d : d.locations || d.data || []); }
        if (cfgRes.ok) {
          const data = await cfgRes.json();
          if (data?.value) {
            try {
              const cfg = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
              if (cfg.groupTypes?.length) setGroupTypes(cfg.groupTypes);
              if (cfg.styles?.length) setStyles(cfg.styles);
              if (cfg.drinkStyles?.length) setDrinkStyles(cfg.drinkStyles);
              if (cfg.firstPlacePrizes?.length) setFirstPlacePrizes(cfg.firstPlacePrizes);
              if (cfg.miscThemes?.length) setMiscThemes(cfg.miscThemes);
              console.log("[AdminBookings] Loaded booking config from settings");
            } catch (e) {
              console.error("[AdminBookings] Failed to parse booking config:", e);
            }
          }
        }
      } catch (err) { console.error("[AdminBookings] Failed to fetch metadata:", err); }
    };
    fetchMeta();
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────

  async function updateStatus(bookingId: string, newStatus: string) {
    setActionLoading(bookingId);
    try {
      console.log(`[AdminBookings] Updating status: ${bookingId} -> ${newStatus}`);
      const res = await fetch(`${apiBase}/api/bookings/admin/bookings/${bookingId}/status`, {
        method: "PUT", headers, body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setActionMessage({ id: bookingId, text: `Status updated to ${newStatus}`, type: "success" });
        fetchBookings();
      } else {
        setActionMessage({ id: bookingId, text: "Failed to update status", type: "error" });
      }
    } catch { setActionMessage({ id: bookingId, text: "Network error", type: "error" }); }
    finally { setActionLoading(null); setTimeout(() => setActionMessage(null), 3000); }
  }

  async function sendInvoice(bookingId: string, test = false) {
    setActionLoading(bookingId);
    try {
      console.log(`[AdminBookings] ${test ? "Test " : ""}Send invoice: ${bookingId}`);
      const res = await fetch(`${apiBase}/api/bookings/admin/bookings/${bookingId}/send-invoice`, {
        method: "POST", headers, body: JSON.stringify({ test }),
      });
      if (res.ok) {
        setActionMessage({ id: bookingId, text: test ? "Test invoice sent" : "Invoice sent", type: "success" });
        fetchInvoices(bookingId);
        fetchBookings();
      } else {
        const data = await res.json().catch(() => null);
        setActionMessage({ id: bookingId, text: data?.error || "Failed to send invoice", type: "error" });
      }
    } catch { setActionMessage({ id: bookingId, text: "Network error", type: "error" }); }
    finally { setActionLoading(null); setTimeout(() => setActionMessage(null), 3000); }
  }

  async function resendConfirmation(bookingId: string, test = false) {
    setActionLoading(bookingId);
    try {
      console.log(`[AdminBookings] ${test ? "Test " : ""}Resend confirmation: ${bookingId}`);
      const res = await fetch(`${apiBase}/api/bookings/admin/bookings/${bookingId}/resend-confirmation`, {
        method: "POST", headers, body: JSON.stringify({ test }),
      });
      if (res.ok) {
        setActionMessage({ id: bookingId, text: test ? "Test confirmation sent" : "Confirmation resent", type: "success" });
      } else {
        const data = await res.json().catch(() => null);
        setActionMessage({ id: bookingId, text: data?.error || "Failed to send", type: "error" });
      }
    } catch { setActionMessage({ id: bookingId, text: "Network error", type: "error" }); }
    finally { setActionLoading(null); setTimeout(() => setActionMessage(null), 3000); }
  }


  async function pushToSheet(bookingId: string) {
    setActionLoading(bookingId);
    try {
      console.log(`[AdminBookings] Pushing booking to Game Builder: ${bookingId}`);
      const res = await fetch(`${apiBase}/api/bookings/admin/bookings/${bookingId}/push-to-sheet`, {
        method: "POST", headers,
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setActionMessage({ id: bookingId, text: data?.message || "Pushed to Game Builder", type: "success" });
      } else {
        setActionMessage({ id: bookingId, text: data?.error || "Failed to push to Game Builder", type: "error" });
      }
    } catch { setActionMessage({ id: bookingId, text: "Network error", type: "error" }); }
    finally { setActionLoading(null); setTimeout(() => setActionMessage(null), 4000); }
  }

  async function deleteBooking(bookingId: string, bookingNumber: string) {
    if (!confirm(`Delete booking ${bookingNumber}? This cannot be undone.`)) return;
    setActionLoading(bookingId);
    try {
      console.log(`[AdminBookings] Deleting booking: ${bookingId}`);
      const res = await fetch(`${apiBase}/api/bookings/admin/bookings/${bookingId}`, {
        method: "DELETE", headers,
      });
      if (res.ok) {
        setActionMessage({ id: bookingId, text: `Booking ${bookingNumber} deleted`, type: "success" });
        setExpandedId(null);
        fetchBookings();
      } else {
        const data = await res.json().catch(() => null);
        setActionMessage({ id: bookingId, text: data?.error || "Failed to delete", type: "error" });
      }
    } catch { setActionMessage({ id: bookingId, text: "Network error", type: "error" }); }
    finally { setActionLoading(null); setTimeout(() => setActionMessage(null), 3000); }
  }

  // ── Invoice functions ──────────────────────────────────────────────────

  async function fetchInvoices(bookingId: string) {
    try {
      console.log(`[AdminBookings] Fetching invoices for: ${bookingId}`);
      const res = await fetch(`${apiBase}/api/bookings/admin/bookings/${bookingId}/invoices`, { headers });
      if (res.ok) {
        const data = await res.json();
        setInvoicesByBooking((prev) => ({ ...prev, [bookingId]: data.data || [] }));
        console.log(`[AdminBookings] Loaded ${data.data?.length || 0} invoices`);
      }
    } catch (err) { console.error("[AdminBookings] Failed to fetch invoices:", err); }
  }

  async function createNewInvoice(bookingId: string) {
    setActionLoading(bookingId);
    try {
      const lineItems = invoiceForm.lineItems
        .filter((item) => item.name && item.unitPricePence && item.quantity)
        .map((item) => ({
          name: item.name,
          unitPricePence: Math.round(parseFloat(item.unitPricePence) * 100),
          quantity: parseInt(item.quantity),
        }));

      if (lineItems.length === 0) {
        setActionMessage({ id: bookingId, text: "Add at least one line item", type: "error" });
        return;
      }

      console.log(`[AdminBookings] Creating invoice with ${lineItems.length} items for: ${bookingId}`);
      const res = await fetch(`${apiBase}/api/bookings/admin/bookings/${bookingId}/invoices`, {
        method: "POST", headers, body: JSON.stringify({ lineItems, description: invoiceForm.description || undefined }),
      });

      if (res.ok) {
        setActionMessage({ id: bookingId, text: "Invoice created", type: "success" });
        setCreatingInvoice(null);
        setInvoiceForm({ lineItems: [{ name: "", unitPricePence: "", quantity: "1" }], description: "" });
        fetchInvoices(bookingId);
      } else {
        const data = await res.json().catch(() => null);
        setActionMessage({ id: bookingId, text: data?.error || "Failed to create invoice", type: "error" });
      }
    } catch { setActionMessage({ id: bookingId, text: "Network error", type: "error" }); }
    finally { setActionLoading(null); setTimeout(() => setActionMessage(null), 3000); }
  }

  async function sendInvoiceById(bookingId: string, invoiceId: string, test = false) {
    setActionLoading(bookingId);
    try {
      console.log(`[AdminBookings] ${test ? "Test s" : "S"}ending invoice ${invoiceId}`);
      const res = await fetch(`${apiBase}/api/bookings/admin/bookings/${bookingId}/invoices/${invoiceId}/send`, {
        method: "POST", headers, body: JSON.stringify({ test }),
      });
      if (res.ok) {
        setActionMessage({ id: bookingId, text: test ? "Test invoice sent" : "Invoice sent", type: "success" });
        fetchInvoices(bookingId);
        fetchBookings();
      } else {
        const data = await res.json().catch(() => null);
        setActionMessage({ id: bookingId, text: data?.error || "Failed to send invoice", type: "error" });
      }
    } catch { setActionMessage({ id: bookingId, text: "Network error", type: "error" }); }
    finally { setActionLoading(null); setTimeout(() => setActionMessage(null), 3000); }
  }

  async function checkInvoicePayment(bookingId: string, invoiceId: string) {
    setActionLoading(bookingId);
    try {
      console.log(`[AdminBookings] Checking invoice payment: ${invoiceId}`);
      const res = await fetch(`${apiBase}/api/bookings/admin/bookings/${bookingId}/invoices/${invoiceId}/check-payment`, {
        method: "POST", headers,
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setActionMessage({
          id: bookingId,
          text: data?.paid ? (data?.message || "Payment received") : (data?.message || "Payment not received yet"),
          type: data?.paid ? "success" : "error",
        });
        fetchInvoices(bookingId);
        fetchBookings();
      } else {
        setActionMessage({ id: bookingId, text: data?.error || "Failed to check payment", type: "error" });
      }
    } catch { setActionMessage({ id: bookingId, text: "Network error", type: "error" }); }
    finally { setActionLoading(null); setTimeout(() => setActionMessage(null), 4000); }
  }

  async function resendInvoiceConfirmation(bookingId: string, invoiceId: string, test = false) {
    setActionLoading(bookingId);
    try {
      console.log(`[AdminBookings] ${test ? "Test r" : "R"}esend invoice confirmation: ${invoiceId}`);
      const res = await fetch(`${apiBase}/api/bookings/admin/bookings/${bookingId}/invoices/${invoiceId}/resend-confirmation`, {
        method: "POST", headers, body: JSON.stringify({ test }),
      });
      if (res.ok) {
        setActionMessage({ id: bookingId, text: test ? "Test confirmation sent" : "Confirmation resent", type: "success" });
      } else {
        const data = await res.json().catch(() => null);
        setActionMessage({ id: bookingId, text: data?.error || "Failed to send", type: "error" });
      }
    } catch { setActionMessage({ id: bookingId, text: "Network error", type: "error" }); }
    finally { setActionLoading(null); setTimeout(() => setActionMessage(null), 3000); }
  }

  async function deleteInvoiceById(bookingId: string, invoiceId: string) {
    setActionLoading(bookingId);
    try {
      console.log(`[AdminBookings] Deleting invoice: ${invoiceId}`);
      const res = await fetch(`${apiBase}/api/bookings/admin/bookings/${bookingId}/invoices/${invoiceId}`, {
        method: "DELETE", headers,
      });
      if (res.ok) {
        setActionMessage({ id: bookingId, text: "Invoice deleted", type: "success" });
        fetchInvoices(bookingId);
      } else {
        const data = await res.json().catch(() => null);
        setActionMessage({ id: bookingId, text: data?.error || "Failed to delete", type: "error" });
      }
    } catch { setActionMessage({ id: bookingId, text: "Network error", type: "error" }); }
    finally { setActionLoading(null); setTimeout(() => setActionMessage(null), 3000); }
  }

  async function createBooking(andInvoice = false) {
    setActionLoading("create");
    try {
      const customerName = `${createForm.firstName} ${createForm.lastName}`.trim();
      console.log(`[AdminBookings] Creating booking for ${customerName}`);

      const res = await fetch(`${apiBase}/api/bookings/bookings`, {
        method: "POST", headers,
        body: JSON.stringify({
          customerName,
          customerEmail: createForm.email,
          customerPhone: createForm.phone,
          companyName: createForm.companyName || undefined,
          firstName: createForm.firstName,
          lastName: createForm.lastName,
          groupSize: parseInt(createForm.groupSize),
          eventDate: createForm.eventDate,
          eventTime: createForm.eventTime || undefined,
          message: createForm.message || undefined,
          productId: createForm.productId || undefined,
          groupType: createForm.groupType,
          style: createForm.style,
          drinkStyle: createForm.drinkStyle,
          firstPlacePrize: createForm.firstPlacePrize,
          duration: createForm.duration,
          locationName: createForm.locationName || undefined,
          wantsMedals: createForm.wantsMedals,
          wantsPhotoPrints: createForm.wantsPhotoPrints,
          taskSections: createForm.taskSections,
          source: "admin",
          bookingType: "PRIVATE",
          timeBlocking: createForm.timeBlocking || undefined,
          bufferHours: createForm.bufferHours ? parseInt(createForm.bufferHours) : undefined,
        }),
      });

      if (res.ok) {
        const booking = await res.json();
        console.log(`[AdminBookings] Created: ${booking.bookingNumber}`);

        if (andInvoice) {
          await sendInvoice(booking.id);
        }

        setShowCreateForm(false);
        setCreateForm({
          firstName: "", lastName: "", email: "", phone: "", companyName: "",
          groupSize: "10", productId: "", groupType: "corporate", style: "professional",
          drinkStyle: "sober", firstPlacePrize: "prosecco", duration: "2",
          eventDate: "", eventTime: "", message: "", locationName: "",
          wantsMedals: false, wantsPhotoPrints: false,
          taskSections: "[]", notes: "", source: "admin",
          timeBlocking: "buffer", bufferHours: "",
        });
        fetchBookings();
        setActionMessage({ id: "create", text: `Booking ${booking.bookingNumber} created${andInvoice ? " and invoice sent" : ""}`, type: "success" });
      } else {
        const data = await res.json().catch(() => null);
        setActionMessage({ id: "create", text: data?.error || "Failed to create booking", type: "error" });
      }
    } catch (err) { console.error("[AdminBookings] Create error:", err); setActionMessage({ id: "create", text: "Network error", type: "error" }); }
    finally { setActionLoading(null); setTimeout(() => setActionMessage(null), 5000); }
  }

  // ── Calendar events from bookings ───────────────────────────────────────
  const calEvents = useMemo(
    () => bookings.map((booking) => bookingToCalEvent(booking)).filter((e): e is NonNullable<typeof e> => e !== null) as CalEvent[],
    [bookings]
  );

  // ── Filter bookings ─────────────────────────────────────────────────────

  const filtered = bookings.filter((b) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return b.customerName.toLowerCase().includes(q) ||
        b.customerEmail.toLowerCase().includes(q) ||
        b.bookingNumber.toLowerCase().includes(q) ||
        (b.companyName && b.companyName.toLowerCase().includes(q));
    }
    return true;
  });

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FaCalendarCheck className="text-emerald-500" /> Bookings
          </h1>
          <p className="text-gray-500 text-sm mt-1">{bookings.length} total bookings</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          data-action="admin_booking_create_toggle"
        >
          <FaPlus className="text-xs" /> New Booking
        </button>
      </div>

      {/* Action message */}
      {actionMessage && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in ${actionMessage.type === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
          {actionMessage.type === "success" ? <FaCheck /> : <FaExclamationTriangle />}
          {actionMessage.text}
        </div>
      )}

      {/* ── Calendar View ────────────────────────────────────────── */}
      {!showCreateForm && (
        <div className="mb-6">
          <SharedCalendar
            events={calEvents}
            onEventClick={(ev) => {
              console.log("[AdminBookings] Calendar event clicked:", ev.id);
              setExpandedId(ev.id);
            }}
            onSlotClick={(date) => {
              console.log("[AdminBookings] Calendar slot clicked:", date);
              setShowCreateForm(true);
              setCreateForm((prev) => ({ ...prev, eventDate: date }));
              fetchTimeSlots(date, createForm.duration);
            }}
            theme="dark"
            selectedEventId={expandedId}
          />
        </div>
      )}

      {/* ── Create Form ──────────────────────────────────────────── */}
      {showCreateForm && (
        <div className="bg-gray-900 border border-emerald-500/30 rounded-xl p-6 mb-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2"><FaPlus className="text-sm" /> Create New Booking</h2>

          {/* Row 1: Name, Email, Phone, Company, Product */}
          <div className="grid grid-cols-6 gap-4 mb-4">
            <div><label className="text-gray-400 text-xs block mb-1">First Name *</label><input type="text" value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" /></div>
            <div><label className="text-gray-400 text-xs block mb-1">Last Name *</label><input type="text" value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" /></div>
            <div><label className="text-gray-400 text-xs block mb-1"><FaEnvelope className="inline mr-1" />Email *</label><input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" /></div>
            <div><label className="text-gray-400 text-xs block mb-1"><FaPhone className="inline mr-1" />Phone *</label><input type="tel" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" /></div>
            <div><label className="text-gray-400 text-xs block mb-1"><FaBuilding className="inline mr-1" />Company</label><input type="text" value={createForm.companyName} onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" /></div>
            <div><label className="text-gray-400 text-xs block mb-1">Product</label><select value={createForm.productId} onChange={(e) => setCreateForm({ ...createForm, productId: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"><option value="">Select...</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          </div>

          {/* Row 2: Date, Time, Duration, Time Blocking, Buffer, Buffer (mins) */}
          <div className="grid grid-cols-6 gap-4 mb-4">
            <div><label className="text-gray-400 text-xs block mb-1">Date *</label><input type="date" value={createForm.eventDate} onChange={(e) => { setCreateForm({ ...createForm, eventDate: e.target.value, eventTime: "" }); fetchTimeSlots(e.target.value, createForm.duration); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" /></div>
            <div><label className="text-gray-400 text-xs block mb-1">Time</label><input type="text" value={createForm.eventTime} onChange={(e) => setCreateForm({ ...createForm, eventTime: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" placeholder="12:30" /></div>
            <div><label className="text-gray-400 text-xs block mb-1"><FaClock className="inline mr-1" />Duration</label><select value={createForm.duration} onChange={(e) => setCreateForm({ ...createForm, duration: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"><option value="2">2h</option><option value="2.5">2.5h</option><option value="3">3h</option></select></div>
            <div><label className="text-gray-400 text-xs block mb-1">Time Blocking</label><select value={createForm.timeBlocking} onChange={(e) => setCreateForm({ ...createForm, timeBlocking: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"><option value="none">None</option><option value="buffer">Buffer</option><option value="whole-day">Whole day</option></select></div>
            <div><label className="text-gray-400 text-xs block mb-1">Buffer (mins)</label><input type="number" min="0" step="15" value={createForm.bufferHours} onChange={(e) => setCreateForm({ ...createForm, bufferHours: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" placeholder="Default" /></div>
            <div></div>
          </div>

          {/* Time slot picker */}
          {createForm.eventDate && (
            <div className="mb-4">
              <label className="text-gray-400 text-xs block mb-2">Available Time Slots {loadingSlots && <span className="text-gray-600">(loading...)</span>}</label>
              {availableSlots.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.label}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => setCreateForm({ ...createForm, eventTime: slot.label })}
                      className={`py-1.5 px-2 rounded text-[10px] font-medium transition border text-center ${
                        !slot.available
                          ? "bg-red-500/10 text-red-400/50 border-red-500/20 cursor-not-allowed line-through"
                          : createForm.eventTime === slot.label
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500"
                          : "bg-gray-800 text-gray-400 border-gray-700 hover:border-emerald-500/50 hover:text-white"
                      }`}
                      data-action={`admin_slot_${slot.label.replace(/[: -]/g, "")}`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              ) : !loadingSlots ? (
                <p className="text-gray-500 text-xs">No time slots available for this date.</p>
              ) : null}
              {createForm.eventTime && (
                <p className="text-emerald-400 text-xs mt-2 flex items-center gap-1"><FaCheck className="text-[8px]" /> Selected: {createForm.eventTime}</p>
              )}
            </div>
          )}

          {/* Row 3: Group Size, Group Type, Style, Drink, 1st Prize */}
          <div className="grid grid-cols-5 gap-4 mb-4">
            <div><label className="text-gray-400 text-xs block mb-1"><FaUsers className="inline mr-1" />Group Size</label><input type="number" min="6" value={createForm.groupSize} onChange={(e) => setCreateForm({ ...createForm, groupSize: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" /></div>
            <div><label className="text-gray-400 text-xs block mb-1">Group Type</label><select value={createForm.groupType} onChange={(e) => setCreateForm({ ...createForm, groupType: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none">{groupTypes.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>
            <div><label className="text-gray-400 text-xs block mb-1">Style</label><select value={createForm.style} onChange={(e) => setCreateForm({ ...createForm, style: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none">{styles.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
            <div><label className="text-gray-400 text-xs block mb-1">Drink Style</label><select value={createForm.drinkStyle} onChange={(e) => setCreateForm({ ...createForm, drinkStyle: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none">{drinkStyles.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
            <div><label className="text-gray-400 text-xs block mb-1">1st Prize</label><select value={createForm.firstPlacePrize} onChange={(e) => setCreateForm({ ...createForm, firstPlacePrize: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none">{firstPlacePrizes.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
          </div>

          {/* Row 4: Location + Add-ons */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div><label className="text-gray-400 text-xs block mb-1"><FaMapMarkerAlt className="inline mr-1" />Location</label><select value={createForm.locationName} onChange={(e) => setCreateForm({ ...createForm, locationName: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"><option value="">Select...</option>{locations.map((l) => <option key={l.slug} value={l.name}>{l.name}</option>)}</select></div>
            <div><label className="text-gray-400 text-xs block mb-1"><FaMedal className="inline mr-1 text-amber-400" />Add-ons</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-gray-400 text-xs cursor-pointer"><input type="checkbox" checked={createForm.wantsMedals} onChange={(e) => setCreateForm({ ...createForm, wantsMedals: e.target.checked })} className="rounded border-gray-600" /><FaMedal className="text-amber-400" /> Medals</label>
                <label className="flex items-center gap-2 text-gray-400 text-xs cursor-pointer"><input type="checkbox" checked={createForm.wantsPhotoPrints} onChange={(e) => setCreateForm({ ...createForm, wantsPhotoPrints: e.target.checked })} className="rounded border-gray-600" /><FaCamera className="text-blue-400" /> Photos</label>
              </div>
            </div>
          </div>

          {/* Row 4b: Task Sections (full width) */}
          <div className="mb-4">
            <label className="text-gray-400 text-xs block mb-1"><FaPuzzlePiece className="inline mr-1" />Task Sections</label>
            {(() => {
              const sections = parseTaskSections(createForm.taskSections);
              const updateSections = (updated: typeof sections) => setCreateForm({ ...createForm, taskSections: JSON.stringify(updated) });
              const hasLocation = sections.some((s) => s.type === "location");
              return (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasLocation} onChange={(e) => { if (e.target.checked) { const loc = locations.find((l) => l.name === createForm.locationName); updateSections([...sections, { type: "location", locationSlug: loc?.slug || "" }]); } else { updateSections(sections.filter((s) => s.type !== "location")); } }} className="rounded border-gray-600" />
                    <FaMapMarkerAlt className="text-emerald-400 text-xs" />
                    <span className="text-xs text-gray-300">Location</span>
                    {hasLocation && createForm.locationName && <span className="text-xs text-gray-500">({createForm.locationName})</span>}
                  </label>
                  {sections.filter((s) => s.type !== "location").map((s, i) => {
                    const realIndex = sections.indexOf(s);
                    return (
                      <div key={realIndex} className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-2 py-1.5">
                        <FaPuzzlePiece className="text-gray-500 text-xs flex-shrink-0" />
                        {s.type === "miscellaneous" ? (
                          <>
                            <select value={s.miscTheme || ""} onChange={(e) => { const updated = [...sections]; updated[realIndex] = { ...s, miscTheme: e.target.value, bespokeTheme: e.target.value === "bespoke" ? s.bespokeTheme || "" : undefined }; updateSections(updated); }} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-purple-500 outline-none"><option value="">Select theme...</option>{miscThemes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
                            {s.miscTheme === "bespoke" && <input type="text" value={s.bespokeTheme || ""} onChange={(e) => { const updated = [...sections]; updated[realIndex] = { ...s, bespokeTheme: e.target.value }; updateSections(updated); }} placeholder="Describe bespoke theme..." className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-purple-500 outline-none" />}
                          </>
                        ) : s.type === "bespoke" ? (
                          <>
                            <span className="text-xs text-amber-400">Bespoke</span>
                            <input type="text" value={s.bespokeTheme || ""} onChange={(e) => { const updated = [...sections]; updated[realIndex] = { ...s, bespokeTheme: e.target.value }; updateSections(updated); }} placeholder="Describe bespoke theme..." className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-amber-500 outline-none" />
                          </>
                        ) : <span className="text-xs text-gray-300">{s.type}</span>}
                        <button type="button" onClick={() => { const updated = [...sections]; updated.splice(realIndex, 1); updateSections(updated); }} className="text-gray-500 hover:text-red-400 ml-auto flex-shrink-0"><FaTimes className="text-[8px]" /></button>
                      </div>
                    );
                  })}
                  {sections.length < 3 && (
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => updateSections([...sections, { type: "miscellaneous", miscTheme: "" }])} className="bg-gray-800 border border-purple-500/20 hover:border-purple-500/50 rounded px-2 py-1 text-[10px] text-purple-400/70 hover:text-purple-300 transition">+ miscellaneous</button>
                      <button type="button" onClick={() => updateSections([...sections, { type: "bespoke", bespokeTheme: "" }])} className="bg-gray-800 border border-amber-500/20 hover:border-amber-500/50 rounded px-2 py-1 text-[10px] text-amber-400/70 hover:text-amber-300 transition">+ bespoke</button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="mb-4">
            <label className="text-gray-400 text-xs block mb-1">Message / Notes</label>
            <textarea value={createForm.message} onChange={(e) => setCreateForm({ ...createForm, message: e.target.value })} rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none resize-none" placeholder="Internal notes or customer message..." />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => createBooking(false)} disabled={actionLoading === "create" || !createForm.firstName || !createForm.email || !createForm.eventDate} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition" data-action="admin_booking_save"><FaCheck className="text-[10px]" />{actionLoading === "create" ? "Saving..." : "Save Booking"}</button>
            <button onClick={() => createBooking(true)} disabled={actionLoading === "create" || !createForm.firstName || !createForm.email || !createForm.eventDate} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition" data-action="admin_booking_save_invoice"><FaFileInvoice className="text-[10px]" />{actionLoading === "create" ? "Saving..." : "Save & Send Invoice"}</button>
            <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-white text-xs transition">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-2.5 text-gray-500 text-xs" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, email, reference, or company..." className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={fetchBookings} className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-gray-400 hover:text-emerald-400 transition" data-action="admin_bookings_refresh"><FaSync className="text-sm" /></button>
      </div>

      {/* ── Booking List ─────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading bookings...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">{searchQuery || statusFilter ? "No bookings match your filters" : "No bookings yet"}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => {
            const isExpanded = expandedId === b.id;
            const sections = parseTaskSections(b.taskSections);

            return (
              <div key={b.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                {/* Summary row */}
                <button
                  onClick={() => { const newId = isExpanded ? null : b.id; setExpandedId(newId); if (newId) fetchInvoices(b.id); }}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/50 transition"
                  data-action={`admin_booking_toggle_${b.bookingNumber}`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="text-xs font-mono text-gray-500 w-28 flex-shrink-0">{b.bookingNumber}</span>
                    <span className="text-sm font-medium text-white truncate">{b.customerName}</span>
                    {b.companyName && <span className="text-xs text-gray-500 truncate hidden sm:inline">({b.companyName})</span>}
                    <span className="text-xs text-gray-400">{b.groupSize} ppl</span>
                    <span className="text-xs text-gray-400">{formatDate(b.eventDate)}</span>
                    {b.eventTime && <span className="text-xs text-gray-500">{b.eventTime}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-emerald-400">{formatPence(b.totalPaid)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOURS[b.status] || "bg-gray-700 text-gray-400"}`}>{b.status}</span>
                    {isExpanded ? <FaChevronUp className="text-gray-500 text-xs" /> : <FaChevronDown className="text-gray-500 text-xs" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-800 p-4 bg-gray-900/50 animate-fade-in">
                    {/* Action message for this booking */}
                    {actionMessage && actionMessage.id === b.id && (
                      <div className={`mb-3 p-2 rounded text-xs flex items-center gap-2 ${actionMessage.type === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                        {actionMessage.type === "success" ? <FaCheck /> : <FaExclamationTriangle />}
                        {actionMessage.text}
                      </div>
                    )}

                    {/* Edit / View toggle button */}
                    <div className="flex items-center justify-end mb-3">
                      {editingBooking === b.id ? (
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(b.id)} disabled={actionLoading === b.id} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white px-3 py-1 rounded text-xs font-medium transition"><FaCheck className="text-[8px]" />{actionLoading === b.id ? "Saving..." : "Save"}</button>
                          <button onClick={() => setEditingBooking(null)} className="text-gray-400 hover:text-white text-xs transition">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => startEditing(b)} className="flex items-center gap-1 text-gray-400 hover:text-emerald-400 text-xs transition"><FaUser className="text-[8px]" /> Edit</button>
                      )}
                    </div>

                    {editingBooking === b.id ? (
                      /* ── EDIT MODE ─────────────────────────────────── */
                      <div className="space-y-3">
                        {/* Row 1: Name, Email, Phone, Company, Product */}
                        <div className="grid grid-cols-5 gap-3">
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Name</label><input value={String(editForm.customerName || "")} onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" /></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Email</label><input value={String(editForm.customerEmail || "")} onChange={(e) => setEditForm({ ...editForm, customerEmail: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" /></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Phone</label><input value={String(editForm.customerPhone || "")} onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" /></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Company</label><input value={String(editForm.companyName || "")} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" /></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Product</label><select value={String(editForm.productId || "")} onChange={(e) => setEditForm({ ...editForm, productId: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"><option value="">-</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                        </div>
                        {/* Row 2: Date, Time, Duration, Time Blocking, Buffer, Buffer (mins) */}
                        <div className="grid grid-cols-6 gap-3">
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Date</label><input type="date" value={String(editForm.eventDate || "")} onChange={(e) => setEditForm({ ...editForm, eventDate: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" /></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Time</label><input value={String(editForm.eventTime || "")} onChange={(e) => setEditForm({ ...editForm, eventTime: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" placeholder="12:30" /></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Duration</label><select value={String(editForm.duration || "")} onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"><option value="">-</option><option value="2">2h</option><option value="2.5">2.5h</option><option value="3">3h</option></select></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Time Blocking</label><select value={String(editForm.timeBlocking || "buffer")} onChange={(e) => setEditForm({ ...editForm, timeBlocking: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"><option value="none">None</option><option value="buffer">Buffer</option><option value="whole-day">Whole day</option></select></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Buffer (mins)</label><input type="number" min="0" step="15" value={String(editForm.bufferHours ?? "")} onChange={(e) => setEditForm({ ...editForm, bufferHours: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" placeholder="Default" /></div>
                          <div></div>
                        </div>
                        {/* Row 3: Group Size, Group Type, Style, Drink, 1st Prize */}
                        <div className="grid grid-cols-5 gap-3">
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Group Size</label><input type="number" value={String(editForm.groupSize || "")} onChange={(e) => setEditForm({ ...editForm, groupSize: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" /></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Group Type</label><select value={String(editForm.groupType || "")} onChange={(e) => setEditForm({ ...editForm, groupType: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"><option value="">-</option>{groupTypes.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Style</label><select value={String(editForm.style || "")} onChange={(e) => setEditForm({ ...editForm, style: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"><option value="">-</option>{styles.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Drink</label><select value={String(editForm.drinkStyle || "")} onChange={(e) => setEditForm({ ...editForm, drinkStyle: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"><option value="">-</option>{drinkStyles.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">1st Prize</label><select value={String(editForm.firstPlacePrize || "")} onChange={(e) => setEditForm({ ...editForm, firstPlacePrize: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"><option value="">-</option>{firstPlacePrizes.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
                        </div>
                        {/* Row 4: Location + Add-ons */}
                        <div className="grid grid-cols-3 gap-3">
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Location</label><select value={String(editForm.locationName || "")} onChange={(e) => setEditForm({ ...editForm, locationName: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"><option value="">-</option>{locations.map((l) => <option key={l.slug} value={l.name}>{l.name}</option>)}</select></div>
                          <div className="col-span-2"><label className="text-gray-500 text-[10px] block mb-0.5">Add-ons</label>
                            <div className="flex gap-4 mt-0.5">
                              <label className="flex items-center gap-1 text-gray-400 text-[10px] cursor-pointer"><input type="checkbox" checked={!!editForm.wantsMedals} onChange={(e) => setEditForm({ ...editForm, wantsMedals: e.target.checked })} className="rounded border-gray-600" /><FaMedal className="text-amber-400" /> Medals</label>
                              <label className="flex items-center gap-1 text-gray-400 text-[10px] cursor-pointer"><input type="checkbox" checked={!!editForm.wantsPhotoPrints} onChange={(e) => setEditForm({ ...editForm, wantsPhotoPrints: e.target.checked })} className="rounded border-gray-600" /><FaCamera className="text-blue-400" /> Photos</label>
                            </div>
                          </div>
                        </div>
                        {/* Row 4b: Task Sections (full width) */}
                        <div>
                          <label className="text-gray-500 text-[10px] block mb-0.5">Task Sections</label>
                          {(() => {
                            const sections = parseTaskSections(String(editForm.taskSections || "[]"));
                            const updateSections = (updated: typeof sections) => setEditForm({ ...editForm, taskSections: JSON.stringify(updated) });
                            const hasLocation = sections.some((s) => s.type === "location");
                            return (
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" checked={hasLocation} onChange={(e) => { if (e.target.checked) { const loc = locations.find((l) => l.name === String(editForm.locationName || "")); updateSections([...sections, { type: "location", locationSlug: loc?.slug || "" }]); } else { updateSections(sections.filter((s) => s.type !== "location")); } }} className="rounded border-gray-600" />
                                  <FaMapMarkerAlt className="text-emerald-400 text-[10px]" />
                                  <span className="text-[10px] text-gray-300">Location</span>
                                  {hasLocation && editForm.locationName && <span className="text-[10px] text-gray-500">({String(editForm.locationName)})</span>}
                                </label>
                                {sections.filter((s) => s.type !== "location").map((s, i) => {
                                  const realIndex = sections.indexOf(s);
                                  return (
                                    <div key={realIndex} className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-2 py-1.5">
                                      <FaPuzzlePiece className="text-gray-500 text-[10px] flex-shrink-0" />
                                      {s.type === "miscellaneous" ? (
                                        <>
                                          <select value={s.miscTheme || ""} onChange={(e) => { const updated = [...sections]; updated[realIndex] = { ...s, miscTheme: e.target.value, bespokeTheme: e.target.value === "bespoke" ? s.bespokeTheme || "" : undefined }; updateSections(updated); }} className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-[10px] text-white focus:border-purple-500 outline-none"><option value="">Select theme...</option>{miscThemes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
                                          {s.miscTheme === "bespoke" && <input type="text" value={s.bespokeTheme || ""} onChange={(e) => { const updated = [...sections]; updated[realIndex] = { ...s, bespokeTheme: e.target.value }; updateSections(updated); }} placeholder="Describe bespoke theme..." className="flex-1 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-[10px] text-white focus:border-purple-500 outline-none" />}
                                        </>
                                      ) : s.type === "bespoke" ? (
                                        <>
                                          <span className="text-[10px] text-amber-400">Bespoke</span>
                                          <input type="text" value={s.bespokeTheme || ""} onChange={(e) => { const updated = [...sections]; updated[realIndex] = { ...s, bespokeTheme: e.target.value }; updateSections(updated); }} placeholder="Describe bespoke theme..." className="flex-1 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-[10px] text-white focus:border-amber-500 outline-none" />
                                        </>
                                      ) : <span className="text-[10px] text-gray-300">{s.type}</span>}
                                      <button type="button" onClick={() => { const updated = [...sections]; updated.splice(realIndex, 1); updateSections(updated); }} className="text-gray-500 hover:text-red-400 ml-auto flex-shrink-0"><FaTimes className="text-[8px]" /></button>
                                    </div>
                                  );
                                })}
                                {sections.length < 3 && (
                                  <div className="flex gap-1.5">
                                    <button type="button" onClick={() => updateSections([...sections, { type: "miscellaneous", miscTheme: "" }])} className="bg-gray-800 border border-purple-500/20 hover:border-purple-500/50 rounded px-2 py-0.5 text-[9px] text-purple-400/70 hover:text-purple-300 transition">+ miscellaneous</button>
                                    <button type="button" onClick={() => updateSections([...sections, { type: "bespoke", bespokeTheme: "" }])} className="bg-gray-800 border border-amber-500/20 hover:border-amber-500/50 rounded px-2 py-0.5 text-[9px] text-amber-400/70 hover:text-amber-300 transition">+ bespoke</button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        {/* Messages and notes */}
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Message</label><textarea value={String(editForm.message || "")} onChange={(e) => setEditForm({ ...editForm, message: e.target.value })} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none resize-none" /></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Special Requests</label><textarea value={String(editForm.specialRequests || "")} onChange={(e) => setEditForm({ ...editForm, specialRequests: e.target.value })} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none resize-none" placeholder="Dietary requirements, accessibility needs..." /></div>
                        </div>
                        <div><label className="text-gray-500 text-[10px] block mb-0.5">Internal Notes</label><textarea value={String(editForm.notes || "")} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} className="w-full bg-gray-800 border border-amber-500/30 rounded px-2 py-1.5 text-xs text-amber-300 focus:border-amber-500 outline-none resize-none" /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Source</label><input value={String(editForm.source || "")} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" /></div>
                          <div><label className="text-gray-500 text-[10px] block mb-0.5">Assigned To</label><input value={String(editForm.assignedTo || "")} onChange={(e) => setEditForm({ ...editForm, assignedTo: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" /></div>
                        </div>
                      </div>
                    ) : (
                      /* ── VIEW MODE ─────────────────────────────────── */
                    <>
                    <div className="grid grid-cols-3 gap-6">
                      {/* Column 1: Customer */}
                      <div>
                        <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Customer</h4>
                        <div className="space-y-1 text-sm">
                          <p className="text-white flex items-center gap-2"><FaUser className="text-gray-600 text-xs" />{b.customerName}</p>
                          <p className="text-gray-400 flex items-center gap-2"><FaEnvelope className="text-gray-600 text-xs" /><a href={`mailto:${b.customerEmail}`} className="hover:text-emerald-400 transition">{b.customerEmail}</a></p>
                          {b.customerPhone && <p className="text-gray-400 flex items-center gap-2"><FaPhone className="text-gray-600 text-xs" /><a href={`tel:${b.customerPhone}`} className="hover:text-emerald-400 transition">{b.customerPhone}</a></p>}
                          {b.companyName && <p className="text-gray-400 flex items-center gap-2"><FaBuilding className="text-gray-600 text-xs" />{b.companyName}</p>}
                        </div>
                      </div>

                      {/* Column 2: Booking details */}
                      <div>
                        <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Details</h4>
                        <div className="space-y-1 text-sm text-gray-400">
                          <p><span className="text-gray-600">Group:</span> {b.groupSize} players ({b.groupType || "-"})</p>
                          <p><span className="text-gray-600">Date:</span> {formatDate(b.eventDate)} {b.eventTime || ""}</p>
                          {b.duration && <p><span className="text-gray-600">Duration:</span> {b.duration}h</p>}
                          {b.style && <p><span className="text-gray-600">Style:</span> {b.style}</p>}
                          {b.drinkStyle && <p><span className="text-gray-600">Drink:</span> {b.drinkStyle}</p>}
                          {b.firstPlacePrize && <p><span className="text-gray-600">1st Prize:</span> {b.firstPlacePrize}</p>}
                          {b.locationName && <p><span className="text-gray-600">Location:</span> {b.locationName}</p>}
                          <p><span className="text-gray-600">Add-ons:</span> {[b.wantsMedals && "Medals", b.wantsPhotoPrints && "Photos"].filter(Boolean).join(", ") || "None"}</p>
                        </div>
                        {sections.length > 0 && (
                          <div className="mt-2">
                            <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Task Sections</h4>
                            {sections.map((s, i) => (
                              <p key={i} className="text-xs text-gray-400">
                                <FaPuzzlePiece className="inline text-gray-600 mr-1" />
                                {s.type}{s.locationSlug ? `: ${s.locationSlug}` : ""}{s.miscTheme ? `: ${s.miscTheme}` : ""}{s.bespokeTheme ? ` (${s.bespokeTheme})` : ""}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Column 3: Actions */}
                      <div>
                        <div className="space-y-1 text-sm text-gray-400 mb-4">
                          <p><span className="text-gray-600">Paid:</span> <span className="text-emerald-400 font-medium">{formatPence(b.totalPaid)}</span></p>
                          <p><span className="text-gray-600">Source:</span> {b.source || "website"}</p>
                        </div>

                        {/* Status change */}
                        <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Status</h4>
                        <select
                          value={b.status}
                          onChange={(e) => updateStatus(b.id, e.target.value)}
                          disabled={actionLoading === b.id}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 outline-none mb-3"
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>

                        {/* Action buttons */}
                        <div className="space-y-2">
                          <button onClick={() => pushToSheet(b.id)} disabled={actionLoading === b.id} className="w-full flex items-center justify-center gap-1 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 disabled:opacity-50 px-2 py-1.5 rounded text-[10px] font-medium transition" data-action={`admin_push_sheet_${b.bookingNumber}`}><FaGamepad /> {actionLoading === b.id ? "Pushing..." : "Push to Game Builder"}</button>
                          <button onClick={() => deleteBooking(b.id, b.bookingNumber)} disabled={actionLoading === b.id} className="w-full flex items-center justify-center gap-1 bg-red-600/10 text-red-400 hover:bg-red-600/20 disabled:opacity-50 px-2 py-1.5 rounded text-[10px] font-medium transition mt-2" data-action={`admin_delete_${b.bookingNumber}`}><FaTimes /> Delete Booking</button>
                        </div>
                      </div>
                    </div>

                    {/* ── Invoices Section ────────────────────────────── */}
                    <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Invoices</h4>
                        <button
                          onClick={() => { setCreatingInvoice(creatingInvoice === b.id ? null : b.id); setInvoiceForm({ lineItems: [{ name: "", unitPricePence: "", quantity: "1" }], description: "" }); }}
                          className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition"
                        ><FaPlus className="text-[8px]" /> New Invoice</button>
                      </div>

                      {/* Create invoice form */}
                      {creatingInvoice === b.id && (
                        <div className="mb-3 p-3 bg-gray-900 rounded-lg border border-amber-500/20 space-y-2">
                          <p className="text-[10px] text-amber-400 font-semibold">New Invoice</p>
                          {invoiceForm.lineItems.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-end">
                              <div className="flex-1"><label className="text-gray-500 text-[10px] block mb-0.5">Name</label><input value={item.name} onChange={(e) => { const items = [...invoiceForm.lineItems]; items[idx] = { ...items[idx], name: e.target.value }; setInvoiceForm({ ...invoiceForm, lineItems: items }); }} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-amber-500 outline-none" placeholder="e.g. Additional players" /></div>
                              <div className="w-24"><label className="text-gray-500 text-[10px] block mb-0.5">Price (£)</label><input type="number" step="0.01" min="0" value={item.unitPricePence} onChange={(e) => { const items = [...invoiceForm.lineItems]; items[idx] = { ...items[idx], unitPricePence: e.target.value }; setInvoiceForm({ ...invoiceForm, lineItems: items }); }} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-amber-500 outline-none" placeholder="30.00" /></div>
                              <div className="w-16"><label className="text-gray-500 text-[10px] block mb-0.5">Qty</label><input type="number" min="1" value={item.quantity} onChange={(e) => { const items = [...invoiceForm.lineItems]; items[idx] = { ...items[idx], quantity: e.target.value }; setInvoiceForm({ ...invoiceForm, lineItems: items }); }} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-amber-500 outline-none" /></div>
                              <div className="w-20 text-right"><label className="text-gray-500 text-[10px] block mb-0.5">Subtotal</label><p className="text-xs text-white py-1.5">{item.unitPricePence && item.quantity ? `£${(parseFloat(item.unitPricePence) * parseInt(item.quantity || "0")).toFixed(2)}` : "-"}</p></div>
                              {invoiceForm.lineItems.length > 1 && (
                                <button onClick={() => { const items = invoiceForm.lineItems.filter((_, i) => i !== idx); setInvoiceForm({ ...invoiceForm, lineItems: items }); }} className="text-red-400 hover:text-red-300 pb-1.5"><FaTimes className="text-[10px]" /></button>
                              )}
                            </div>
                          ))}
                          <button onClick={() => setInvoiceForm({ ...invoiceForm, lineItems: [...invoiceForm.lineItems, { name: "", unitPricePence: "", quantity: "1" }] })} className="text-[10px] text-gray-400 hover:text-amber-400 transition"><FaPlus className="inline text-[8px] mr-1" />Add line item</button>
                          <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                            <div className="text-xs text-white font-medium">
                              Total: £{invoiceForm.lineItems.reduce((sum, item) => sum + (parseFloat(item.unitPricePence || "0") * parseInt(item.quantity || "0")), 0).toFixed(2)}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setCreatingInvoice(null)} className="text-[10px] text-gray-400 hover:text-white transition">Cancel</button>
                              <button onClick={() => createNewInvoice(b.id)} disabled={actionLoading === b.id} className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-700 text-white px-3 py-1 rounded text-[10px] font-medium transition">{actionLoading === b.id ? "Creating..." : "Create Draft"}</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Invoice list */}
                      {(invoicesByBooking[b.id] || []).length > 0 ? (
                        <div className="space-y-2">
                          {(invoicesByBooking[b.id] || []).map((inv) => (
                            <div key={inv.id} className="p-2 bg-gray-900 rounded border border-gray-700">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${INVOICE_STATUS_COLOURS[inv.status] || "bg-gray-500/20 text-gray-400"}`}>{inv.status}</span>
                                  <span className="text-xs text-white font-medium">{formatPence(inv.totalAmountPence)}</span>
                                  {inv.invoiceNumber && <span className="text-[10px] text-gray-500">{inv.invoiceNumber}</span>}
                                </div>
                                <div className="flex items-center gap-1">
                                  {inv.hostedInvoiceUrl && (
                                    <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-amber-400 transition p-1" title="View in Stripe"><FaExternalLinkAlt className="text-[9px]" /></a>
                                  )}
                                  {inv.status === "DRAFT" && (
                                    <>
                                      <button onClick={() => sendInvoiceById(b.id, inv.id)} disabled={actionLoading === b.id} className="text-[10px] text-amber-400 hover:text-amber-300 disabled:opacity-50 px-1.5 py-0.5 bg-amber-600/20 rounded transition">Send</button>
                                      <button onClick={() => sendInvoiceById(b.id, inv.id, true)} disabled={actionLoading === b.id} className="text-[10px] text-gray-400 hover:text-amber-400 disabled:opacity-50 px-1.5 py-0.5 rounded transition" title="Test send to admin email">Test</button>
                                      <button onClick={() => deleteInvoiceById(b.id, inv.id)} disabled={actionLoading === b.id} className="text-red-400 hover:text-red-300 disabled:opacity-50 p-1 transition" title="Delete draft"><FaTrash className="text-[9px]" /></button>
                                    </>
                                  )}
                                  {inv.status === "SENT" && (
                                    <>
                                      <button onClick={() => checkInvoicePayment(b.id, inv.id)} disabled={actionLoading === b.id} className="text-[10px] text-sky-400 hover:text-sky-300 disabled:opacity-50 px-1.5 py-0.5 bg-sky-600/20 rounded transition"><FaSync className="inline text-[8px] mr-0.5" />Check Payment</button>
                                      <button onClick={() => sendInvoiceById(b.id, inv.id)} disabled={actionLoading === b.id} className="text-[10px] text-amber-400 hover:text-amber-300 disabled:opacity-50 px-1.5 py-0.5 bg-amber-600/20 rounded transition">Resend</button>
                                      <button onClick={() => sendInvoiceById(b.id, inv.id, true)} disabled={actionLoading === b.id} className="text-[10px] text-gray-400 hover:text-amber-400 disabled:opacity-50 px-1.5 py-0.5 rounded transition" title="Test resend to admin email">Test</button>
                                    </>
                                  )}
                                  {inv.status === "PAID" && (
                                    <>
                                      <button onClick={() => resendInvoiceConfirmation(b.id, inv.id)} disabled={actionLoading === b.id} className="text-[10px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50 px-1.5 py-0.5 bg-emerald-600/20 rounded transition"><FaEnvelope className="inline text-[8px] mr-0.5" />Resend Confirmation</button>
                                      <button onClick={() => resendInvoiceConfirmation(b.id, inv.id, true)} disabled={actionLoading === b.id} className="text-[10px] text-gray-400 hover:text-emerald-400 disabled:opacity-50 px-1.5 py-0.5 rounded transition" title="Test confirmation to admin email">Test</button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-0.5">
                                {inv.lineItems.map((item, i) => (
                                  <p key={i} className="text-[10px] text-gray-400">{item.name} - {formatPence(item.unitPricePence)} x {item.quantity} = {formatPence(item.unitPricePence * item.quantity)}</p>
                                ))}
                              </div>
                              {inv.sentAt && <p className="text-[9px] text-gray-600 mt-1">Sent {new Date(inv.sentAt).toLocaleString("en-GB")}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-600">No invoices yet</p>
                      )}
                    </div>

                    {/* Message */}
                    {b.message && (
                      <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Customer Message</p>
                        <p className="text-sm text-gray-300">{b.message}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {b.notes && (
                      <div className="mt-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <p className="text-[10px] text-amber-500 uppercase tracking-wider font-semibold mb-1">Internal Notes</p>
                        <p className="text-sm text-amber-300">{b.notes}</p>
                      </div>
                    )}
                    </>
                    )}

                    <p className="text-[10px] text-gray-600 mt-3">Created {new Date(b.createdAt).toLocaleString("en-GB")}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
