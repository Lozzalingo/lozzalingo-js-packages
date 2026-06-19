"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FaCalendarAlt, FaUsers, FaLock, FaCheck,
  FaEnvelope, FaPhone, FaBuilding, FaUser, FaTheaterMasks,
  FaClock, FaMedal, FaCamera, FaStar, FaMapMarkerAlt, FaPuzzlePiece, FaPlus, FaTimes, FaInfoCircle, FaArrowDown,
} from "react-icons/fa";
import type {
  BookingFormProps, BookingConfig, TaskSectionType, TaskSection,
  TaskSectionTypeConfig, NormalizedProduct, NormalizedLocation, CalEvent,
} from "./types";
import { DEFAULT_BOOKING_CONFIG } from "./defaults";
import { formatPence, calculateTotal, getTaskSectionPricePence } from "./pricing";

// Re-export types and defaults for convenience
export { DEFAULT_BOOKING_CONFIG } from "./defaults";
export type { BookingFormProps, BookingConfig, BookingFormSection, BookingAddOn, TaskSectionTypeConfig, BookingPayload, BookingFormApi, NormalizedProduct, NormalizedLocation } from "./types";

// Icon mapping for task section types
const TASK_SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  location: FaMapMarkerAlt,
  miscellaneous: FaPuzzlePiece,
  bespoke: FaStar,
};

export default function BookingForm({
  api,
  defaultConfig,
  getImageUrl = () => "",
  publicEventPath = "/tickets",
  contactEmail = "info@example.com",
  calendarApiBaseUrl,
  preselectedProductSlug,
  preselectedLocationSlug,
  showModeToggle = true,
  showEventSelector = true,
}: BookingFormProps) {
  const router = useRouter();

  // ─── Config State ──────────────────────────────────────────────────────────
  const [bookingConfig, setBookingConfig] = useState<BookingConfig>(defaultConfig);

  // Derived config values (replaces module-level mutable variables)
  const cfg = bookingConfig;
  const DURATIONS = cfg.durations;
  const STYLES = cfg.styles;
  const DRINK_STYLES = cfg.drinkStyles;
  const FIRST_PLACE_PRIZES = cfg.firstPlacePrizes;
  const MISC_THEMES = cfg.miscThemes;
  const TASK_SECTION_TYPES = cfg.taskSectionTypes;

  // Fetch config overrides from API
  useEffect(() => {
    if (!api.fetchConfig) return;
    const controller = new AbortController();
    api.fetchConfig()
      .then((overrides) => {
        if (!overrides) return;
        const merged = { ...defaultConfig, ...overrides };
        setBookingConfig(merged);
        console.log("[BookingForm] Loaded booking config from settings");
      })
      .catch(() => { /* Settings not available, using defaults */ });
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Form State ────────────────────────────────────────────────────────────
  const [bookingMode, setBookingMode] = useState<"private" | "public">("private");
  const [products, setProducts] = useState<NormalizedProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [locations, setLocations] = useState<NormalizedLocation[]>([]);
  const [taskSections, setTaskSections] = useState<TaskSection[]>([]);
  const [form, setForm] = useState({
    firstName: "", lastName: "", companyName: "", email: "", phone: "",
    groupSize: "", productId: "", groupType: "", otherGroupType: "", style: "", drinkStyle: "", firstPlacePrize: "",
    duration: "2", timeBlocking: "" as "" | "buffer" | "whole-day", bufferHours: "60",
    wantsMedals: false, wantsPhotoPrints: false,
    eventDate: "", eventTime: "", slotStartTime: "", slotEndTime: "", message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitMessage, setSubmitMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalEvent[]>([]);
  const [blockedCalendarEvents, setBlockedCalendarEvents] = useState<CalEvent[]>([]);

  // ─── Data Loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("[BookingForm] Fetching products and locations");
        const [prods, locs] = await Promise.all([api.fetchProducts(), api.fetchLocations()]);
        setProducts(prods);
        if (preselectedProductSlug) {
          const f = prods.find((p) => p.slug === preselectedProductSlug);
          if (f) setForm((prev) => ({ ...prev, productId: f.id }));
        }
        setLocations(locs);
        if (preselectedLocationSlug && locs.some((l) => l.slug === preselectedLocationSlug)) {
          console.log(`[BookingForm] Pre-selecting location: ${preselectedLocationSlug}`);
          setTaskSections([{ type: "location", locationSlug: preselectedLocationSlug }]);
        }
      } catch { console.error("[BookingForm] Failed to load data"); }
      finally { setLoadingProducts(false); }
    };
    fetchData();
  }, [preselectedProductSlug, preselectedLocationSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (api.fetchCalendarBookings) {
      api.fetchCalendarBookings()
        .then((events) => { setCalendarEvents(events); console.log(`[BookingForm] Loaded ${events.length} calendar events`); })
        .catch((err) => console.error("[BookingForm] Failed to fetch calendar events:", err));
    }
    if (api.fetchBlockedEvents) {
      api.fetchBlockedEvents()
        .then((events) => { setBlockedCalendarEvents(events); console.log(`[BookingForm] Loaded ${events.length} blocked events`); })
        .catch((err) => console.error("[BookingForm] Failed to fetch blocked events:", err));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived Values ────────────────────────────────────────────────────────
  const selectedProduct = products.find((p) => p.id === form.productId);
  const groupSizeNum = parseInt(form.groupSize) || 0;

  // Per-product task section types
  const activeTaskSectionTypes = useMemo(() => {
    if (selectedProduct?.slug && cfg.productTaskSectionTypes?.[selectedProduct.slug]) {
      return cfg.productTaskSectionTypes[selectedProduct.slug];
    }
    return TASK_SECTION_TYPES;
  }, [selectedProduct?.slug, cfg, TASK_SECTION_TYPES]);

  // Per-product group types
  const activeGroupTypes = useMemo(() => {
    if (selectedProduct?.slug && cfg.productGroupTypes?.[selectedProduct.slug]) {
      return cfg.productGroupTypes[selectedProduct.slug];
    }
    return cfg.groupTypes;
  }, [selectedProduct?.slug, cfg]);

  // Travel charge from location section
  const locationSection = taskSections.find((s) => s.type === "location");
  const isCustomRoute = locationSection?.locationSlug === "custom-route";
  const selectedLocation = locationSection && !isCustomRoute ? locations.find((l) => l.slug === locationSection.locationSlug) : null;
  const locationTravelZone = isCustomRoute ? "custom" : (selectedLocation?.travelZone || (() => {
    if (!selectedLocation) return "london";
    if (selectedLocation.region === "London") return "london";
    if (selectedLocation.country === "UK" || selectedLocation.region === "UK") return "medium";
    if (selectedLocation.country && selectedLocation.country !== "UK") return "international";
    return "london";
  })());
  const travelChargeInfo = isCustomRoute ? { label: "Custom location", pence: 0, canInstantBook: false } : (cfg.travelCharges[locationTravelZone] || cfg.travelCharges.london);
  const travelChargePence = travelChargeInfo.pence;
  const canInstantBook = travelChargeInfo.canInstantBook;

  const totalPence = groupSizeNum > 0 ? calculateTotal(groupSizeNum, taskSections, form.wantsMedals, form.wantsPhotoPrints, travelChargePence, cfg, activeTaskSectionTypes) : 0;
  const isCorporate = form.groupType === "corporate";
  const isOther = form.groupType === "other";
  const durationMinutes = form.duration ? parseFloat(form.duration) * 60 : 0;
  const sectionCount = taskSections.length;

  // Calendar events with preview
  const calEvents = useMemo<CalEvent[]>(() => {
    const events = [...calendarEvents, ...blockedCalendarEvents];
    if (form.slotStartTime && form.slotEndTime && form.eventDate) {
      events.push({
        id: "selected-slot-preview",
        title: "Your Booking",
        subtitle: selectedProduct?.name || undefined,
        startTime: form.slotStartTime,
        endTime: form.slotEndTime,
        type: "selected",
      });
    }
    return events;
  }, [calendarEvents, blockedCalendarEvents, form.slotStartTime, form.slotEndTime, form.eventDate, form.eventTime, selectedProduct?.name]);

  // ─── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (form.duration) {
      const dur = DURATIONS.find((d) => d.value === form.duration);
      if (dur && sectionCount < dur.minSections) setForm((prev) => ({ ...prev, duration: "" }));
    }
  }, [sectionCount, form.duration, DURATIONS]);

  // Remove task sections not available for the current product
  useEffect(() => {
    const enabledIds = new Set(activeTaskSectionTypes.filter((t) => t.enabled).map((t) => t.id));
    const filtered = taskSections.filter((s) => enabledIds.has(s.type));
    if (filtered.length !== taskSections.length) {
      setTaskSections(filtered);
      console.log("[BookingForm] Removed task sections not available for this product");
    }
  }, [activeTaskSectionTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear group type if not available for the current product
  useEffect(() => {
    if (form.groupType && !activeGroupTypes.some((gt) => gt.value === form.groupType)) {
      setForm((prev) => ({ ...prev, groupType: "", otherGroupType: "", companyName: "" }));
      console.log("[BookingForm] Cleared group type not available for this product");
    }
  }, [activeGroupTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const addSection = (type: TaskSectionType) => { if (taskSections.length < 3) { setTaskSections([...taskSections, { type }]); clearError("task-sections"); } };
  const removeSection = (i: number) => { setTaskSections(taskSections.filter((_, idx) => idx !== i)); };
  const updateSection = (i: number, u: Partial<TaskSection>) => { setTaskSections(taskSections.map((s, idx) => idx === i ? { ...s, ...u } : s)); clearError("task-sections"); };

  const clearError = (field: string) => {
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const scrollToFirstError = (errors: Record<string, string>) => {
    const firstKey = Object.keys(errors)[0];
    if (!firstKey) return;
    const el = document.getElementById(`field-${firstKey}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = el.querySelector<HTMLElement>("input, select, textarea");
      if (focusable) setTimeout(() => focusable.focus(), 400);
    }
  };

  // ─── Validation ────────────────────────────────────────────────────────────
  const sectionsValid = taskSections.length >= 1 && taskSections.every((s) => {
    if (s.type === "location") {
      if (!s.locationSlug) return false;
      if (s.locationSlug === "custom-route" && !s.customStartAddress?.trim()) return false;
      if (s.useCustomStart && !s.customStartAddress?.trim()) return false;
      if (s.useCustomEnd && !s.customEndAddress?.trim()) return false;
      return true;
    }
    if (s.type === "miscellaneous") return s.miscTheme === "bespoke" ? !!s.bespokeTheme : !!s.miscTheme;
    return s.type === "bespoke";
  });

  const needsDateTime = canInstantBook;

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!form.firstName || !form.lastName) errors.name = "Please enter your first and last name.";
    if (!form.email) errors.email = "Please enter your email address.";
    if (!form.phone) errors.phone = "Please enter your phone number.";
    if (isCorporate && !form.companyName) errors.company = "Company name is required for corporate bookings.";
    if (isOther && !form.otherGroupType) errors["other-group-type"] = "Please tell us what type of group this is.";
    if (!form.productId) errors.event = "Please choose your event.";
    if (groupSizeNum < cfg.minPlayers) errors["group-size"] = `Minimum group size is ${cfg.minPlayers} players.`;
    if (!form.groupType) errors["group-type"] = "Please select a group type.";
    if (!form.style) errors.style = "Please select a style.";
    if (!form.drinkStyle) errors["drink-style"] = "Please choose sober or boozy.";
    if (!form.firstPlacePrize) errors["first-place-prize"] = "Please choose a first place prize.";
    if (taskSections.length === 0) errors["task-sections"] = "Please add at least one task section.";
    else if (!sectionsValid) errors["task-sections"] = "Please complete all task sections.";
    if (!form.duration) errors.duration = "Please choose a duration.";
    if (canInstantBook && (!form.eventDate || !form.eventTime)) errors["date-time"] = "Please select a date and time.";
    return errors;
  };

  // ─── Submission ────────────────────────────────────────────────────────────
  const handleModeSwitch = (mode: "private" | "public") => {
    if (mode === "public" && publicEventPath) { router.push(publicEventPath); return; }
    setBookingMode(mode);
  };
  const handleDateSelect = (date: string) => { setForm((prev) => ({ ...prev, eventDate: date })); clearError("date-time"); };
  const handleTimeSlotSelect = (date: string, startTime: string, endTime: string, label: string) => { setForm((prev) => ({ ...prev, eventDate: date, eventTime: label, slotStartTime: startTime, slotEndTime: endTime })); clearError("date-time"); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setSubmitMessage(null);
    try {
      const errors = validateForm();
      if (Object.keys(errors).length > 0) {
        console.log("[BookingForm] Validation failed:", Object.keys(errors));
        setFormErrors(errors);
        scrollToFirstError(errors);
        setSubmitting(false);
        return;
      }
      setFormErrors({});
      const customerName = `${form.firstName} ${form.lastName}`.trim();
      const priceInPence = calculateTotal(groupSizeNum, taskSections, form.wantsMedals, form.wantsPhotoPrints, travelChargePence, cfg, activeTaskSectionTypes);
      const payload = {
        eventTitle: selectedProduct?.name || "Booking", imageUrl: getImageUrl(selectedProduct?.coverImage) || undefined, customerEmail: form.email, customerName, customerPhone: form.phone,
        companyName: form.companyName || undefined, groupSize: groupSizeNum, eventDate: form.eventDate || undefined, priceInPence,
        message: form.message || undefined, productSlug: selectedProduct?.slug, groupType: form.groupType === "other" ? `other: ${form.otherGroupType}` : form.groupType, style: form.style,
        drinkStyle: form.drinkStyle, firstPlacePrize: form.firstPlacePrize, taskSections: JSON.stringify(taskSections),
        duration: form.duration, eventTime: form.eventTime || undefined, slotStartTime: form.slotStartTime || undefined, slotEndTime: form.slotEndTime || undefined,
        wantsMedals: form.wantsMedals, wantsPhotoPrints: form.wantsPhotoPrints,
        timeBlocking: form.timeBlocking || undefined, bufferHours: form.timeBlocking === "buffer" ? form.bufferHours : undefined,
        travelChargePence, locationSlug: locationSection?.locationSlug || undefined,
      };

      if (!canInstantBook) {
        console.log("[BookingForm] Submitting enquiry:", payload);
        const result = await api.submitEnquiry({ ...payload, status: "ENQUIRY" });
        if (result.success) { setSubmitMessage({ type: "success", text: result.message || "Enquiry submitted! We will be in touch shortly." }); }
        else { setSubmitMessage({ type: "error", text: result.message || "Something went wrong." }); }
      } else {
        console.log("[BookingForm] Submitting checkout:", { product: selectedProduct?.name, groupSize: groupSizeNum, total: priceInPence });
        const result = await api.submitCheckout(payload);
        if (result.url) { window.location.href = result.url; return; }
        else { setSubmitMessage({ type: "error", text: result.error || "Something went wrong." }); }
      }
    } catch (err: unknown) {
      console.error("[BookingForm] Network error:", err);
      setSubmitMessage({ type: "error", text: `Could not reach our server. Email us at ${contactEmail}.` });
    }
    finally { setSubmitting(false); }
  };

  // ─── Section Renderers ─────────────────────────────────────────────────────
  const sortedSections = [...(cfg.bookingSections || DEFAULT_BOOKING_CONFIG.bookingSections)].sort((a, b) => a.order - b.order);

  // We need SharedCalendar - import dynamically to avoid hard dep on @lozzalingo/calendar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [SharedCalendar, setSharedCalendar] = useState<React.ComponentType<any> | null>(null);
  useEffect(() => {
    // Dynamic import - the consuming app must have @lozzalingo/calendar installed
    import("@lozzalingo/calendar/ui/SharedCalendar")
      .then((mod) => setSharedCalendar(() => mod.default))
      .catch(() => console.warn("[BookingForm] SharedCalendar not available - calendar section will not render"));
  }, []);

  const sectionRenderers: Record<string, () => React.ReactNode> = {
    "your-details": () => (
      <section key="your-details">
        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2"><FaUser className="text-cta" /> Your Details</h2>
        <div className="space-y-4">
          <div id="field-name" className="grid sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-text-primary mb-1">First Name *</label><input type="text" required value={form.firstName} onChange={(e) => { setForm({ ...form, firstName: e.target.value }); clearError("name"); }} className={`w-full px-4 py-3 rounded-lg border ${formErrors.name ? "border-red-500 ring-2 ring-red-200" : "border-border"} focus:ring-2 focus:ring-cta focus:border-cta transition`} placeholder="Jane" /></div>
            <div><label className="block text-sm font-medium text-text-primary mb-1">Last Name *</label><input type="text" required value={form.lastName} onChange={(e) => { setForm({ ...form, lastName: e.target.value }); clearError("name"); }} className={`w-full px-4 py-3 rounded-lg border ${formErrors.name ? "border-red-500 ring-2 ring-red-200" : "border-border"} focus:ring-2 focus:ring-cta focus:border-cta transition`} placeholder="Smith" /></div>
            {formErrors.name && <p className="text-sm text-red-600 col-span-full">{formErrors.name}</p>}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div id="field-email"><label className="block text-sm font-medium text-text-primary mb-1"><FaEnvelope className="inline mr-1 text-text-secondary" />Email *</label><input type="email" required value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); clearError("email"); }} className={`w-full px-4 py-3 rounded-lg border ${formErrors.email ? "border-red-500 ring-2 ring-red-200" : "border-border"} focus:ring-2 focus:ring-cta focus:border-cta transition`} placeholder="jane@company.com" />{formErrors.email && <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>}</div>
            <div id="field-phone"><label className="block text-sm font-medium text-text-primary mb-1"><FaPhone className="inline mr-1 text-text-secondary" />Phone *</label><input type="tel" required value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); clearError("phone"); }} className={`w-full px-4 py-3 rounded-lg border ${formErrors.phone ? "border-red-500 ring-2 ring-red-200" : "border-border"} focus:ring-2 focus:ring-cta focus:border-cta transition`} placeholder="+44 7700 900000" />{formErrors.phone && <p className="text-sm text-red-600 mt-1">{formErrors.phone}</p>}</div>
          </div>
        </div>
      </section>
    ),
    "choose-event": () => (
      <section key="choose-event">
        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2"><FaUsers className="text-cta" /> Choose Your Event</h2>
        <div className="space-y-4">
          <div id="field-group-size"><label className="block text-sm font-medium text-text-primary mb-1">Group Size * <span className="font-normal text-text-secondary">(minimum {cfg.minPlayers})</span></label><div className="relative"><FaUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" /><input type="number" required min={cfg.minPlayers} value={form.groupSize} onChange={(e) => { setForm({ ...form, groupSize: e.target.value }); clearError("group-size"); }} className={`w-full pl-10 pr-4 py-3 rounded-lg border ${formErrors["group-size"] ? "border-red-500 ring-2 ring-red-200" : "border-border"} focus:ring-2 focus:ring-cta focus:border-cta transition`} placeholder={String(cfg.minPlayers)} /></div>{formErrors["group-size"] ? <p className="text-sm text-red-600 mt-1">{formErrors["group-size"]}</p> : groupSizeNum > 0 && groupSizeNum < cfg.minPlayers && <p className="text-xs text-cta mt-1">Minimum {cfg.minPlayers} players required</p>}</div>
          {showEventSelector && (
            <div id="field-event"><label className="block text-sm font-medium text-text-primary mb-1">Choose Your Event *</label><select required value={form.productId} onChange={(e) => { setForm({ ...form, productId: e.target.value }); clearError("event"); }} className={`w-full px-4 py-3 rounded-lg border ${formErrors.event ? "border-red-500 ring-2 ring-red-200" : "border-border"} focus:ring-2 focus:ring-cta focus:border-cta transition bg-white`}><option value="">Select an event...</option>{loadingProducts ? <option disabled>Loading...</option> : products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.duration ? ` (${p.duration})` : ""}</option>)}</select>{formErrors.event && <p className="text-sm text-red-600 mt-1">{formErrors.event}</p>}</div>
          )}
          <div className="p-5 bg-surface rounded-xl border border-border">
            <h3 className="font-bold text-text-primary mb-3">What&apos;s Included</h3>
            <ul className="space-y-2">{cfg.whatsIncluded.map((item) => (<li key={item} className="text-sm text-text-secondary flex items-start gap-2"><FaCheck className="text-success text-xs mt-1 flex-shrink-0" /><span>{item}</span></li>))}</ul>
            <div className="mt-4 pt-3 border-t border-border"><p className="text-sm text-text-primary font-semibold">{formatPence(cfg.pricePerPerson)} per person</p><p className="text-xs text-text-secondary mt-1">Minimum reserve: {formatPence(cfg.minReserve)} (covers {cfg.minPlayers} players). Additional players at {formatPence(cfg.pricePerPerson)} each.</p></div>
          </div>
          <div id="field-first-place-prize"><label className="block text-sm font-medium text-text-primary mb-2">First Place Prize *</label><div className={`grid grid-cols-1 sm:grid-cols-3 gap-2 ${formErrors["first-place-prize"] ? "ring-2 ring-red-200 rounded-lg" : ""}`}>{FIRST_PLACE_PRIZES.map((fp) => (<label key={fp.value} className={`py-3 px-3 rounded-lg text-sm font-medium transition border text-center cursor-pointer ${form.firstPlacePrize === fp.value ? "bg-cta text-white border-cta" : "bg-white text-text-secondary border-border hover:border-cta/50"}`}><input type="radio" name="firstPlacePrize" value={fp.value} checked={form.firstPlacePrize === fp.value} onChange={(e) => { setForm({ ...form, firstPlacePrize: e.target.value }); clearError("first-place-prize"); }} className="sr-only" required />{fp.label}</label>))}</div>{formErrors["first-place-prize"] && <p className="text-sm text-red-600 mt-1">{formErrors["first-place-prize"]}</p>}</div>
        </div>
      </section>
    ),
    "group-type": () => (
      <section key="group-type">
        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2"><FaTheaterMasks className="text-cta" /> Group Type</h2>
        <div className="space-y-5">
          <div id="field-group-type">
            <label className="block text-sm font-medium text-text-primary mb-2">What type of group is this? *</label>
            <div className={`grid grid-cols-2 sm:grid-cols-6 gap-2 ${formErrors["group-type"] ? "ring-2 ring-red-200 rounded-lg" : ""}`}>{activeGroupTypes.map((gt) => (<label key={gt.value} className={`py-2.5 px-3 rounded-lg text-sm font-medium transition border text-center cursor-pointer ${form.groupType === gt.value ? "bg-cta text-white border-cta" : "bg-white text-text-secondary border-border hover:border-cta/50"}`}><input type="radio" name="groupType" value={gt.value} checked={form.groupType === gt.value} onChange={(e) => { setForm({ ...form, groupType: e.target.value }); clearError("group-type"); }} className="sr-only" required />{gt.label}</label>))}</div>
            {formErrors["group-type"] && <p className="text-sm text-red-600 mt-1">{formErrors["group-type"]}</p>}
            {isCorporate && (<div id="field-company" className="mt-3 animate-fade-in"><label className="block text-sm font-medium text-text-primary mb-1"><FaBuilding className="inline mr-1 text-text-secondary" />Company / Organisation *</label><input type="text" required value={form.companyName} onChange={(e) => { setForm({ ...form, companyName: e.target.value }); clearError("company"); }} className={`w-full px-4 py-3 rounded-lg border ${formErrors.company ? "border-red-500 ring-2 ring-red-200" : "border-border"} focus:ring-2 focus:ring-cta focus:border-cta transition`} placeholder="Acme Corp" />{formErrors.company ? <p className="text-sm text-red-600 mt-1">{formErrors.company}</p> : !form.companyName && <p className="text-xs text-cta mt-1">Required for corporate bookings</p>}</div>)}
            {isOther && (<div id="field-other-group-type" className="mt-3 animate-fade-in"><label className="block text-sm font-medium text-text-primary mb-1">Please specify *</label><input type="text" required value={form.otherGroupType} onChange={(e) => { setForm({ ...form, otherGroupType: e.target.value }); clearError("other-group-type"); }} className={`w-full px-4 py-3 rounded-lg border ${formErrors["other-group-type"] ? "border-red-500 ring-2 ring-red-200" : "border-border"} focus:ring-2 focus:ring-cta focus:border-cta transition`} placeholder="e.g. Reunion, Team social, Leaving do" />{formErrors["other-group-type"] ? <p className="text-sm text-red-600 mt-1">{formErrors["other-group-type"]}</p> : !form.otherGroupType && <p className="text-xs text-cta mt-1">Please tell us what type of group this is</p>}</div>)}
          </div>
          <div id="field-style"><label className="block text-sm font-medium text-text-primary mb-2">Style *</label><div className={`grid grid-cols-2 gap-2 ${formErrors.style ? "ring-2 ring-red-200 rounded-lg" : ""}`}>{STYLES.map((s) => (<label key={s.value} className={`py-3 px-4 rounded-lg font-medium transition border text-center cursor-pointer ${form.style === s.value ? "bg-cta text-white border-cta" : "bg-white text-text-secondary border-border hover:border-cta/50"}`}><input type="radio" name="style" value={s.value} checked={form.style === s.value} onChange={(e) => { setForm({ ...form, style: e.target.value }); clearError("style"); }} className="sr-only" required />{s.label}</label>))}</div>{formErrors.style && <p className="text-sm text-red-600 mt-1">{formErrors.style}</p>}</div>
          <div id="field-drink-style"><label className="block text-sm font-medium text-text-primary mb-2">Would you like the tasks to include the occasional tipple? *</label><div className={`grid grid-cols-2 gap-2 ${formErrors["drink-style"] ? "ring-2 ring-red-200 rounded-lg" : ""}`}>{DRINK_STYLES.map((ds) => (<label key={ds.value} className={`py-3 px-4 rounded-lg font-medium transition border text-center cursor-pointer ${form.drinkStyle === ds.value ? "bg-cta text-white border-cta" : "bg-white text-text-secondary border-border hover:border-cta/50"}`}><input type="radio" name="drinkStyle" value={ds.value} checked={form.drinkStyle === ds.value} onChange={(e) => { setForm({ ...form, drinkStyle: e.target.value }); clearError("drink-style"); }} className="sr-only" required />{ds.label}</label>))}</div>{formErrors["drink-style"] && <p className="text-sm text-red-600 mt-1">{formErrors["drink-style"]}</p>}</div>
        </div>
      </section>
    ),
    "task-sections": () => (
      <section key="task-sections" id="field-task-sections">
        <h2 className="text-lg font-bold text-text-primary mb-2 flex items-center gap-2"><FaPuzzlePiece className="text-cta" /> Task Sections *</h2>
        <p className="text-sm text-text-secondary mb-4">Choose 1 to 3 task sections. More sections unlock longer game time.</p>
        <div className="space-y-4 mb-4">
          {taskSections.map((section, index) => (
            <div key={index} className="p-4 bg-surface rounded-xl border border-border animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-text-primary">Section {index + 1}: {activeTaskSectionTypes.find((t) => t.id === section.type)?.label || (section.type === "location" ? "Location" : section.type === "miscellaneous" ? "Miscellaneous" : "Personalised")}</span>
                <button type="button" onClick={() => removeSection(index)} className="text-text-secondary hover:text-error transition p-1" data-action={`booking_remove_section_${index}`}><FaTimes className="text-sm" /></button>
              </div>
              {section.type === "location" && (() => {
                const loc = locations.find((l) => l.slug === section.locationSlug);
                const zone = loc?.travelZone || (loc?.region === "London" ? "london" : (loc?.country === "UK" || loc?.region === "UK") ? "medium" : (loc?.country && loc.country !== "UK") ? "international" : "");
                const charge = zone ? cfg.travelCharges[zone] : null;
                const isLoop = loc ? (!loc.endPoint || loc.routeType === "Loop") : true;
                return (
                  <div className="space-y-4">
                    <p className="text-xs text-text-secondary">Location tasks revolve around a specific area, giving the game a clear heading. These tasks are worth less individually, but unlock bonus points.</p>
                    <select value={section.locationSlug || ""} onChange={(e) => updateSection(index, { locationSlug: e.target.value, useCustomStart: false, customStartAddress: "", useCustomEnd: false, customEndAddress: "" })} className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-cta focus:border-cta transition bg-white text-sm">
                      <option value="">Select a location...</option>
                      {(() => {
                        const displayGroups = ["London", "UK", "International"];
                        const grouped: Record<string, NormalizedLocation[]> = {};
                        for (const l of locations) {
                          const displayGroup = l.region === "London" ? "London" : (l.country === "UK" || l.region === "UK") ? "UK" : "International";
                          if (!grouped[displayGroup]) grouped[displayGroup] = [];
                          grouped[displayGroup].push(l);
                        }
                        for (const r of Object.keys(grouped)) { grouped[r].sort((a, b) => a.name.localeCompare(b.name)); }
                        return displayGroups.filter((r) => grouped[r]?.length > 0).map((r) => (<optgroup key={r} label={r}>{grouped[r].map((l) => (<option key={l.slug} value={l.slug}>{l.name}</option>))}</optgroup>));
                      })()}
                      <optgroup label="Other"><option value="custom-route">Somewhere else...</option></optgroup>
                    </select>
                    {section.locationSlug === "custom-route" && (
                      <div className="animate-fade-in space-y-3">
                        <input type="text" value={section.customStartAddress || ""} onChange={(e) => updateSection(index, { customStartAddress: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-cta focus:border-cta transition text-sm" placeholder="Enter your desired location, e.g. Liverpool, Brighton" />
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="text-sm text-amber-800 font-semibold flex items-center gap-2"><FaInfoCircle /> Custom location - pricing on request</p><p className="text-xs text-amber-700 mt-1">We will get back to you with a custom quote for this location. Submit an enquiry below.</p></div>
                      </div>
                    )}
                    {loc && (
                      <div className="animate-fade-in space-y-4">
                        {charge && charge.pence > 0 && (<div className="flex items-center gap-2 text-sm text-cta font-semibold bg-orange-50 border border-orange-200 rounded-lg p-3"><FaInfoCircle /> Travel charge: +{formatPence(charge.pence)} ({charge.label})</div>)}
                        {charge && !charge.canInstantBook && (<div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="text-sm text-amber-800 font-semibold flex items-center gap-2"><FaInfoCircle /> This location requires a custom quote</p><p className="text-xs text-amber-700 mt-1">You can submit an enquiry below and we will get back to you with pricing.</p></div>)}
                        <div>
                          <label className="block text-xs font-semibold text-text-primary mb-2">Starting Point</label>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <label className={`py-2 px-3 rounded-lg text-xs font-medium transition border text-center cursor-pointer ${!section.useCustomStart ? "bg-cta text-white border-cta" : "bg-white text-text-secondary border-border hover:border-cta/50"}`}><input type="radio" className="sr-only" checked={!section.useCustomStart} onChange={() => updateSection(index, { useCustomStart: false, customStartAddress: "" })} />Public Starting Point</label>
                            <label className={`py-2 px-3 rounded-lg text-xs font-medium transition border text-center cursor-pointer ${section.useCustomStart ? "bg-cta text-white border-cta" : "bg-white text-text-secondary border-border hover:border-cta/50"}`}><input type="radio" className="sr-only" checked={!!section.useCustomStart} onChange={() => updateSection(index, { useCustomStart: true })} />Our Own Venue</label>
                          </div>
                          {!section.useCustomStart && loc.startPoint && (<div className="flex items-center gap-2 bg-surface rounded-lg border border-border p-3"><FaMapMarkerAlt className="text-cta flex-shrink-0" /><span className="text-sm text-text-primary font-medium">{loc.startPoint}</span>{loc.startPointUrl && (<a href={loc.startPointUrl} target="_blank" rel="noopener noreferrer" className="text-cta hover:underline text-xs ml-auto flex-shrink-0">View map</a>)}</div>)}
                          {section.useCustomStart && (<input type="text" value={section.customStartAddress || ""} onChange={(e) => updateSection(index, { customStartAddress: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-cta focus:border-cta transition text-sm" placeholder="Enter your office or venue address" />)}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-text-primary mb-2">End Point{isLoop && !section.useCustomEnd && <span className="font-normal text-text-secondary ml-1">(looping route, ends where it starts)</span>}</label>
                          {!isLoop && (<div className="grid grid-cols-2 gap-2 mb-2"><label className={`py-2 px-3 rounded-lg text-xs font-medium transition border text-center cursor-pointer ${!section.useCustomEnd ? "bg-cta text-white border-cta" : "bg-white text-text-secondary border-border hover:border-cta/50"}`}><input type="radio" className="sr-only" checked={!section.useCustomEnd} onChange={() => updateSection(index, { useCustomEnd: false, customEndAddress: "" })} />Public End Point</label><label className={`py-2 px-3 rounded-lg text-xs font-medium transition border text-center cursor-pointer ${section.useCustomEnd ? "bg-cta text-white border-cta" : "bg-white text-text-secondary border-border hover:border-cta/50"}`}><input type="radio" className="sr-only" checked={!!section.useCustomEnd} onChange={() => updateSection(index, { useCustomEnd: true })} />Our Own Venue</label></div>)}
                          {isLoop && !section.useCustomEnd && (<div className="flex items-center gap-2 bg-surface rounded-lg border border-border p-3"><FaMapMarkerAlt className="text-emerald-500 flex-shrink-0" /><span className="text-sm text-text-secondary">Same as starting point (loop route)</span><button type="button" onClick={() => updateSection(index, { useCustomEnd: true })} className="text-xs text-cta hover:underline ml-auto">Change</button></div>)}
                          {!isLoop && !section.useCustomEnd && loc.endPoint && (<div className="flex items-center gap-2 bg-surface rounded-lg border border-border p-3"><FaMapMarkerAlt className="text-emerald-500 flex-shrink-0" /><span className="text-sm text-text-primary font-medium">{loc.endPoint}</span>{loc.endPointUrl && (<a href={loc.endPointUrl} target="_blank" rel="noopener noreferrer" className="text-cta hover:underline text-xs ml-auto flex-shrink-0">View map</a>)}</div>)}
                          {section.useCustomEnd && (<input type="text" value={section.customEndAddress || ""} onChange={(e) => updateSection(index, { customEndAddress: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-cta focus:border-cta transition text-sm" placeholder="Enter your office or venue address" />)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-secondary"><span className={`px-2 py-0.5 rounded-full font-medium ${isLoop && !section.useCustomEnd ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{section.useCustomStart || section.useCustomEnd ? "Custom Route" : isLoop ? "Loop Route" : "A to B Route"}</span>{loc.routeType === "A to B" && !section.useCustomEnd && <span>Different start and end points</span>}</div>
                        {(section.useCustomStart || section.useCustomEnd) && (<div className="animate-fade-in"><label className="block text-xs font-semibold text-text-primary mb-2">Venue Details</label><textarea rows={3} value={section.venueNotes || ""} onChange={(e) => updateSection(index, { venueNotes: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-cta focus:border-cta transition text-sm resize-none" placeholder="How do we access the building? Do we need a pass? Will we meet in a meeting room or a public space like the canteen? Anything else we should know?" /></div>)}
                      </div>
                    )}
                  </div>
                );
              })()}
              {section.type === "miscellaneous" && (<div>
                <p className="text-xs text-text-secondary mb-2">Themed tasks broken into Easy (20pts), Medium (40pts) and Hard (50pts+). We will send you a draft copy.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{MISC_THEMES.map((t) => (<label key={t.value} className={`py-2 px-2 rounded-lg text-xs font-medium transition border text-center cursor-pointer ${section.miscTheme === t.value ? "bg-cta text-white border-cta" : "bg-white text-text-secondary border-border hover:border-cta/50"}`}><input type="radio" name={`miscTheme-${index}`} value={t.value} checked={section.miscTheme === t.value} onChange={(e) => updateSection(index, { miscTheme: e.target.value, bespokeTheme: "" })} className="sr-only" />{t.label}</label>))}</div>
                {section.miscTheme === "bespoke" && (<div className="mt-3 animate-fade-in"><input type="text" value={section.bespokeTheme || ""} onChange={(e) => updateSection(index, { bespokeTheme: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-cta focus:border-cta transition text-sm" placeholder="e.g. Disney, 90s, or Football" /><p className="text-xs text-text-secondary mt-1">Can&apos;t be too specific - we need to fill between 30 and 40 tasks.</p></div>)}
              </div>)}
              {section.type === "bespoke" && (() => {
                const bespokeConfig = activeTaskSectionTypes.find((t) => t.id === "bespoke");
                const pricePence = bespokeConfig ? Math.round(parseFloat(bespokeConfig.pricePounds || "0") * 100) : cfg.bespokeSectonPrice;
                return (<div><p className="text-xs text-text-secondary mb-2">A set of 20 personalised tasks tailored towards a person or company. We will send you a questionnaire to fill in, then send you the tasks for your approval.</p>{pricePence > 0 && <div className="flex items-center gap-2 text-sm text-cta font-semibold"><FaInfoCircle /><span>+{formatPence(pricePence)}</span></div>}</div>);
              })()}
            </div>
          ))}
        </div>
        {taskSections.length < 3 && (() => {
          const enabledTypes = activeTaskSectionTypes.filter((t) => t.enabled);
          const cols = enabledTypes.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
          return (
            <div className={`grid grid-cols-1 ${cols} gap-2`}>
              {enabledTypes.map((sType) => {
                const typeId = sType.id as TaskSectionType;
                const alreadyAdded = taskSections.some((s) => s.type === typeId);
                const Icon = TASK_SECTION_ICONS[typeId] || FaPuzzlePiece;
                const pricePence = Math.round(parseFloat(sType.pricePounds || "0") * 100);
                return (<button key={sType.id} type="button" onClick={() => addSection(typeId)} disabled={alreadyAdded} className={`p-3 rounded-xl border-2 border-dashed text-center transition-all ${alreadyAdded ? "opacity-40 cursor-not-allowed border-gray-200" : "border-border hover:border-cta/50 cursor-pointer hover:bg-orange-50"}`} data-action={`booking_add_${sType.id}`}><Icon className="text-cta mx-auto mb-1" /><span className="text-xs font-medium text-text-primary block">{sType.label}</span><span className="text-[10px] text-text-secondary">{pricePence > 0 ? `+${formatPence(pricePence)}` : sType.description}</span></button>);
              })}
            </div>
          );
        })()}
        {formErrors["task-sections"] ? <p className="text-sm text-red-600 mt-2 flex items-center gap-1"><FaInfoCircle /> {formErrors["task-sections"]}</p> : taskSections.length === 0 && <p className="text-xs text-cta mt-2 flex items-center gap-1"><FaInfoCircle /> Add at least one task section to continue.</p>}
      </section>
    ),
    "duration": () => (
      <section key="duration" id="field-duration">
        <h2 className="text-lg font-bold text-text-primary mb-2 flex items-center gap-2"><FaClock className="text-cta" /> Duration *</h2>
        <p className="text-sm text-text-secondary mb-4">{sectionCount === 0 ? "Defaults to 2 hours. Add task sections above to unlock longer durations." : `You have ${sectionCount} task section${sectionCount > 1 ? "s" : ""} - ${sectionCount === 1 ? "1 hour" : sectionCount === 2 ? "up to 1.5 hours" : "up to 2 hours"} of game time available.`}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
          {DURATIONS.map((d) => {
            const isSelected = form.duration === d.value;
            const isLocked = sectionCount < d.minSections;
            return (<div key={d.value} className="relative group"><label className={`block p-4 rounded-xl border-2 text-center transition-all ${isLocked ? "opacity-40 cursor-not-allowed border-gray-200 bg-gray-50" : isSelected ? "border-cta bg-orange-50 cursor-pointer" : "border-border bg-white hover:border-cta/50 cursor-pointer"}`}><input type="radio" name="duration" value={d.value} checked={isSelected} onChange={(e) => { if (!isLocked) { setForm({ ...form, duration: e.target.value }); clearError("duration"); } }} className="sr-only" disabled={isLocked} /><span className="block text-xl font-bold text-text-primary">{d.total}</span><span className="block text-xs text-text-secondary mt-1">{d.gameTime} game time</span></label>{isLocked && (<div className="absolute inset-0 flex items-end justify-center pb-1 pointer-events-none"><span className="hidden group-hover:block text-[10px] text-cta bg-white border border-cta/20 rounded px-2 py-0.5 shadow-sm whitespace-nowrap">Add more task sections to unlock</span></div>)}</div>);
          })}
        </div>
        {formErrors.duration && <p className="text-sm text-red-600 mb-3">{formErrors.duration}</p>}
        {form.duration && (
          <div className="p-5 bg-surface rounded-xl border border-border animate-fade-in">
            <p className="text-sm text-text-secondary mb-3">Here&apos;s how your {DURATIONS.find((d) => d.value === form.duration)?.total} breaks down:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3"><div className="w-8 h-8 rounded-full bg-cta/10 flex items-center justify-center flex-shrink-0"><span className="text-cta font-bold text-[10px]">30m</span></div><div><p className="font-medium text-text-primary">Introduction</p><p className="text-sm text-text-secondary">Rules explained, players divided into teams, and FAQs answered</p></div></div>
              <div className="flex items-start gap-3"><div className="w-8 h-8 rounded-full bg-cta/10 flex items-center justify-center flex-shrink-0"><span className="text-cta font-bold text-[10px]">{DURATIONS.find((d) => d.value === form.duration)?.gameTime.replace(" hours", "h").replace(" hour", "h")}</span></div><div><p className="font-medium text-text-primary">Game Time</p><p className="text-sm text-text-secondary">The main event - explore, compete, and complete challenges</p></div></div>
              <div className="flex items-start gap-3"><div className="w-8 h-8 rounded-full bg-cta/10 flex items-center justify-center flex-shrink-0"><span className="text-cta font-bold text-[10px]">30m</span></div><div><p className="font-medium text-text-primary">Wrap-up</p><p className="text-sm text-text-secondary">Highlights showcase, final scores, and trophy presentation</p></div></div>
            </div>
          </div>
        )}
      </section>
    ),
    "time-blocking": () => (
      <section key="time-blocking">
        <h2 className="text-lg font-bold text-text-primary mb-2 flex items-center gap-2"><FaLock className="text-cta" /> Time Blocking</h2>
        <p className="text-sm text-text-secondary mb-4">Would you like to reserve extra time around your event?</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[{ value: "", label: "None", desc: "Event time only" }, { value: "buffer", label: "Buffer", desc: "Block time either side" }, { value: "whole-day", label: "Whole Day", desc: "Block the entire day" }].map((mode) => (
            <label key={mode.value} className={`block p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${form.timeBlocking === mode.value ? "border-cta bg-orange-50" : "border-border bg-white hover:border-cta/50"}`}><input type="radio" name="timeBlocking" value={mode.value} checked={form.timeBlocking === mode.value} onChange={(e) => setForm({ ...form, timeBlocking: e.target.value as "" | "buffer" | "whole-day" })} className="sr-only" /><span className="block text-sm font-bold text-text-primary">{mode.label}</span><span className="block text-xs text-text-secondary mt-1">{mode.desc}</span></label>
          ))}
        </div>
        {form.timeBlocking === "buffer" && (<div className="mt-4 animate-fade-in"><label className="block text-sm font-medium text-text-primary mb-2">Buffer (mins)</label><select value={form.bufferHours} onChange={(e) => setForm({ ...form, bufferHours: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-cta focus:border-cta transition bg-white"><option value="30">30 mins</option><option value="60">60 mins</option><option value="90">90 mins</option></select></div>)}
      </section>
    ),
    "add-ons": () => (
      <section key="add-ons">
        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2"><FaPlus className="text-cta" /> Add-ons</h2>
        <div className="space-y-3">
          <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${form.wantsMedals ? "border-cta bg-orange-50" : "border-border bg-white hover:border-cta/50"}`}><input type="checkbox" checked={form.wantsMedals} onChange={(e) => setForm({ ...form, wantsMedals: e.target.checked })} className="sr-only" /><div className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${form.wantsMedals ? "border-cta bg-cta" : "border-border"}`}>{form.wantsMedals && <FaCheck className="text-white text-[10px]" />}</div><div className="flex-1"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><FaMedal className="text-highlight" /><span className="font-semibold text-text-primary">Participation Medals</span></div><span className="font-bold text-cta">+{formatPence(cfg.medalsPricePP)} <span className="text-sm font-normal text-text-secondary">/ person</span></span></div><p className="text-sm text-text-secondary mt-1">A medal for every player to take home</p></div></label>
          <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${form.wantsPhotoPrints ? "border-cta bg-orange-50" : "border-border bg-white hover:border-cta/50"}`}><input type="checkbox" checked={form.wantsPhotoPrints} onChange={(e) => setForm({ ...form, wantsPhotoPrints: e.target.checked })} className="sr-only" /><div className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${form.wantsPhotoPrints ? "border-cta bg-cta" : "border-border"}`}>{form.wantsPhotoPrints && <FaCheck className="text-white text-[10px]" />}</div><div className="flex-1"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><FaCamera className="text-info" /><span className="font-semibold text-text-primary">Printable Experience Photos</span></div><span className="font-bold text-cta">+{formatPence(cfg.photoPrintsPricePP)} <span className="text-sm font-normal text-text-secondary">/ person</span></span></div><p className="text-sm text-text-secondary mt-1">Printed experience photos, similar to theme park on-ride photos</p></div></label>
        </div>
      </section>
    ),
    "date-time": () => (
      <section key="date-time" id="field-date-time">
        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2"><FaCalendarAlt className="text-cta" /> Choose Date & Time</h2>
        <p className="text-sm text-text-secondary mb-4">Minimum 7 days notice. Select a date, then pick a time slot.{form.duration && parseFloat(form.duration) > 2 && ` Showing slots for ${DURATIONS.find((d) => d.value === form.duration)?.total || form.duration + " hours"}.`}</p>
        {formErrors["date-time"] && <p className="text-sm text-red-600 mb-3">{formErrors["date-time"]}</p>}
        {form.eventDate && (<div className="mb-4 p-3 bg-surface rounded-lg border border-border flex items-center gap-2"><FaCalendarAlt className="text-cta" /><span className="font-semibold text-text-primary">{new Date(form.eventDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}{form.eventTime && ` at ${form.eventTime}`}</span></div>)}
        {SharedCalendar && (
          <SharedCalendar
            events={calEvents}
            fetchAvailability={false}
            availabilityDuration={durationMinutes || 120}
            durationMinutes={durationMinutes || 120}
            apiBaseUrl={calendarApiBaseUrl || ""}
            onSlotClick={(date: string) => { handleDateSelect(date); }}
            onSelectTimeSlot={handleTimeSlotSelect}
            theme="light"
            selectedEventId={null}
          />
        )}
      </section>
    ),
    "message": () => (
      <section key="message"><h2 className="text-lg font-bold text-text-primary mb-4">Tell Us About Your Event</h2><textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-cta focus:border-cta transition resize-none" placeholder={cfg.messagePlaceholder || "Anything else we should know?"} /></section>
    ),
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {showModeToggle && publicEventPath && (
        <div className="flex gap-2 mb-8">
          <button type="button" onClick={() => handleModeSwitch("private")} className={`flex-1 py-3 px-4 rounded-lg font-semibold transition border text-center ${bookingMode === "private" ? "bg-primary text-white border-primary" : "bg-white text-text-secondary border-border hover:border-primary"}`} data-action="booking_mode_private">Private Event</button>
          <button type="button" onClick={() => handleModeSwitch("public")} className="flex-1 py-3 px-4 rounded-lg font-semibold transition border bg-white text-text-secondary border-border hover:border-primary text-center" data-action="booking_mode_public">Public Event</button>
        </div>
      )}

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
        <FaCheck className="text-emerald-500 mt-0.5 flex-shrink-0" />
        <div><p className="font-semibold text-emerald-800 text-sm">Book instantly, no waiting</p><p className="text-xs text-emerald-700 mt-0.5">Fill in the form below, pay securely via Stripe, and your event is confirmed straight away.</p></div>
      </div>

      <div>
        <button type="button" onClick={() => { const el = document.getElementById("field-date-time"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="w-full flex items-center justify-between p-4 bg-surface rounded-xl border border-border hover:border-cta/50 transition" data-action="booking_check_availability_toggle">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-cta/10 flex items-center justify-center"><FaCalendarAlt className="text-cta" /></div><div className="text-left"><p className="font-semibold text-text-primary text-sm">Check availability</p><p className="text-xs text-text-secondary">Pick a date to see available time slots</p></div></div>
          <FaArrowDown className="text-text-secondary" />
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {sortedSections.filter((s) => s.enabled && sectionRenderers[s.id]).map((sec) => {
          const renderer = sectionRenderers[sec.id];
          if (!renderer) return null;
          return (<div key={sec.id} className="bg-surface/50 rounded-xl border border-border p-5 md:p-6">{renderer()}</div>);
        })}

        {groupSizeNum >= cfg.minPlayers && (
          <div className="p-5 bg-surface rounded-xl border border-border">
            <h3 className="font-bold text-text-primary mb-3">Booking Summary</h3>
            <div className="space-y-2 text-sm">
              {selectedProduct && <div className="flex justify-between text-text-secondary"><span>{selectedProduct.name}</span></div>}
              <div className="flex justify-between text-text-secondary"><span>{groupSizeNum} {groupSizeNum === 1 ? "player" : "players"} x {formatPence(cfg.pricePerPerson)}</span><span>{formatPence(groupSizeNum * cfg.pricePerPerson)}</span></div>
              {groupSizeNum * cfg.pricePerPerson < cfg.minReserve && <div className="flex justify-between text-text-secondary text-xs italic"><span>Minimum reserve ({cfg.minPlayers} players)</span><span>{formatPence(cfg.minReserve)}</span></div>}
              {taskSections.map((s, i) => {
                if (s.type === "miscellaneous" && s.miscTheme === "bespoke") return <div key={`ts-${i}`} className="flex justify-between text-text-secondary"><span>Bespoke theme</span><span>+{formatPence(cfg.miscBespokePrice)}</span></div>;
                const sectionPricePence = getTaskSectionPricePence(s.type, activeTaskSectionTypes, cfg.bespokeSectonPrice);
                if (sectionPricePence > 0) {
                  const sectionLabel = activeTaskSectionTypes.find((t) => t.id === s.type)?.label || s.type;
                  return <div key={`ts-${i}`} className="flex justify-between text-text-secondary"><span>{sectionLabel} task section</span><span>+{formatPence(sectionPricePence)}</span></div>;
                }
                return null;
              })}
              {form.wantsMedals && <div className="flex justify-between text-text-secondary"><span>Medals ({groupSizeNum} x {formatPence(cfg.medalsPricePP)})</span><span>+{formatPence(groupSizeNum * cfg.medalsPricePP)}</span></div>}
              {form.wantsPhotoPrints && <div className="flex justify-between text-text-secondary"><span>Photos ({groupSizeNum} x {formatPence(cfg.photoPrintsPricePP)})</span><span>+{formatPence(groupSizeNum * cfg.photoPrintsPricePP)}</span></div>}
              {travelChargePence > 0 && <div className="flex justify-between text-text-secondary"><span>Travel charge ({travelChargeInfo.label})</span><span>+{formatPence(travelChargePence)}</span></div>}
              {!canInstantBook && <div className="flex justify-between text-amber-600 text-xs italic"><span>International location - pricing on request</span></div>}
              <div className="border-t border-border pt-2 flex justify-between font-bold text-text-primary text-lg"><span>Total</span><span className="text-cta">{canInstantBook ? formatPence(totalPence) : "On request"}</span></div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {submitMessage && (<div className={`p-4 rounded-lg border text-sm font-medium ${submitMessage.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>{submitMessage.text}</div>)}
          <button type="submit" disabled={submitting} className="w-full bg-cta text-white font-bold py-4 rounded-lg hover:bg-cta-dark transition disabled:opacity-50 disabled:cursor-not-allowed text-lg flex items-center justify-center gap-2" data-action="booking_pay_submit">
            <FaLock className="text-sm" />
            {submitting ? (canInstantBook ? "Redirecting to payment..." : "Submitting enquiry...") : canInstantBook ? (totalPence > 0 ? `Book & Pay Now ${formatPence(totalPence)}` : "Book & Pay Now") : "Submit Enquiry"}
          </button>
          <p className="text-center text-text-secondary text-xs flex items-center justify-center gap-1"><FaLock className="text-[10px]" /> {canInstantBook ? "Secure payment powered by Stripe" : "We will respond within 24 hours with a custom quote"}</p>
        </div>
      </form>

      <div className="mt-6 pt-6 border-t border-border text-center"><p className="text-text-secondary text-sm">Not ready to book? Still got questions?{" "}<a href={`mailto:${contactEmail}`} className="text-cta font-semibold hover:underline" data-action="booking_email_fallback">Send us a message</a></p></div>
    </div>
  );
}
