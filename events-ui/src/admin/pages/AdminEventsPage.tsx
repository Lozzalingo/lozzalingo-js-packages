"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useEventsConfig } from "../../context/EventsProvider";
import { getImageUrl } from "../../lib/utils";
import {
  FaBox,
  FaPlus,
  FaEdit,
  FaTrash,
  FaToggleOn,
  FaToggleOff,
  FaChevronDown,
  FaChevronRight,
  FaTimes,
  FaSave,
  FaImage,
  FaGripVertical,
  FaArrowUp,
  FaArrowDown,
  FaListUl,
  FaAlignLeft,
  FaTags,
  FaExternalLinkAlt,
  FaMapMarkerAlt,
  FaPalette,
  FaCheck,
  FaEye,
  FaEyeSlash,
  FaCopy,
  FaTicketAlt,
  FaUpload,
  FaRedo,
} from "react-icons/fa";
import {
  slugify,
  poundsToPence,
  penceToPounds,
  formatPrice,
  ActionBar,
  ViewLinkBtn,
  EditBtn,
  DuplicateBtn,
  DeleteBtn,
  ToggleBtn,
  Button,
} from "../ui";
import { DEFAULT_BOOKING_CONFIG } from "@lozzalingo/booking-form/defaults";
import type { BookingAddOn } from "@lozzalingo/booking-form/types";
import { configureStorage, uploadImage } from "@lozzalingo/storage/client";

type Package = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration: string | null;
  bookingType: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  pricePerPerson: number | null;
  flatPrice: number | null;
  minReserve: number | null;
  additionalPlayerPrice: number | null;
  includes: string | null;
  displayOrder: number;
  isActive: boolean;
  _count?: { bookings: number };
};

type ProductImage = {
  id: number;
  url: string;
  alt: string | null;
  sortOrder: number;
};

type SectionType = "text" | "list" | "steps" | "bullets" | "cards" | "checklist" | "gallery" | "themes" | "venue";

type ProductSection = {
  id: number;
  title: string;
  type: SectionType;
  content: string | null;
  listItems: string | null;
  displayOrder: number;
  isCollapsible: boolean;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDesc: string | null;
  coverImage: string | null;
  category: string;
  themes: string | null;
  maxGroupSize: number | null;
  venue: string | null;
  duration: string | null;
  ticketLimit: number | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  packages: Package[];
  images: ProductImage[];
  sections: ProductSection[];
  _count: { packages: number; bookings: number };
};

type ProductForm = {
  name: string;
  slug: string;
  description: string;
  shortDesc: string;
  coverImage: string;
  category: string;
  themes: string;
  maxGroupSize: string;
  venue: string;
  duration: string;
  ticketLimit: string;
  displayOrder: number;
  isActive: boolean;
};

type PackageForm = {
  name: string;
  slug: string;
  description: string;
  duration: string;
  bookingType: string;
  minPlayers: string;
  maxPlayers: string;
  pricePerPerson: string;
  flatPrice: string;
  minReserve: string;
  additionalPlayerPrice: string;
  whatsIncluded: string;
  displayOrder: number;
  isActive: boolean;
};

const emptyProductForm: ProductForm = {
  name: "",
  slug: "",
  description: "",
  shortDesc: "",
  coverImage: "",
  category: "scavenger-hunt",
  themes: "",
  maxGroupSize: "",
  venue: "",
  duration: "",
  ticketLimit: "",
  displayOrder: 0,
  isActive: true,
};

type SectionForm = {
  title: string;
  type: SectionType;
  content: string;
  listItems: string; // newline-separated in the form
  displayOrder: number;
  isCollapsible: boolean;
};

const emptySectionForm: SectionForm = {
  title: "",
  type: "text",
  content: "",
  listItems: "",
  displayOrder: 0,
  isCollapsible: true,
};

const SECTION_PRESETS = [
  "Gallery",
  "Themes",
  "Venue",
  "How does it work?",
  "On Game Day",
  "Locations",
  "Platforms",
  "What you'll need",
  "Rules",
  "Scoring",
  "Task Examples",
];

// Booking section presets - known sections with renderers in BookingForm
const BOOKING_SECTION_PRESETS: { id: string; title: string; icon: string }[] = [
  { id: "your-details", title: "Your Details", icon: "FaUser" },
  { id: "choose-event", title: "Choose Your Event", icon: "FaUsers" },
  { id: "group-type", title: "Group Type", icon: "FaTheaterMasks" },
  { id: "task-sections", title: "Task Sections", icon: "FaPuzzlePiece" },
  { id: "duration", title: "Duration", icon: "FaClock" },
  { id: "time-blocking", title: "Time Blocking", icon: "FaLock" },
  { id: "add-ons", title: "Add-ons", icon: "FaPlus" },
  { id: "date-time", title: "Choose Date & Time", icon: "FaCalendarAlt" },
  { id: "message", title: "Tell Us About Your Event", icon: "" },
];

const emptyPackageForm: PackageForm = {
  name: "",
  slug: "",
  description: "",
  duration: "",
  bookingType: "PRIVATE",
  minPlayers: "",
  maxPlayers: "",
  pricePerPerson: "",
  flatPrice: "",
  minReserve: "",
  additionalPlayerPrice: "",
  whatsIncluded: "",
  displayOrder: 0,
  isActive: true,
};

/** Cover image field with upload, drag-and-drop, and URL input */
function CoverImageField({
  value,
  onChange,
  slug,
  bgClass = "bg-gray-900",
  cdnBase,
  storageFolder,
}: {
  value: string;
  onChange: (url: string) => void;
  slug?: string;
  bgClass?: string;
  cdnBase: string;
  storageFolder: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const STORAGE_FOLDER = `${storageFolder}/events`;

  function resolveUrl(raw: string): string {
    if (!raw) return "";
    if (raw.startsWith("http")) return raw;
    return `${cdnBase}/${storageFolder}/events/${raw}`;
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      console.log(`[CoverImage] Uploading ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
      const result = await uploadImage(file, STORAGE_FOLDER);
      console.log(`[CoverImage] Upload complete: ${result.url}`);
      onChange(result.url);
    } catch (err) {
      console.error("[CoverImage] Upload error:", err);
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      uploadFile(file);
    }
  }

  const previewUrl = resolveUrl(value);

  return (
    <div>
      <label className="text-gray-400 text-xs block mb-1">Cover Image</label>
      <div
        className={`relative border rounded-lg overflow-hidden transition ${
          dragOver ? "border-emerald-500 bg-emerald-500/5" : "border-gray-700"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Preview + upload area */}
        <div className="flex items-center gap-3 p-2">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Cover preview"
              className="w-16 h-16 rounded-md object-cover flex-shrink-0 border border-gray-700"
            />
          ) : (
            <div className="w-16 h-16 rounded-md flex-shrink-0 border border-gray-700 flex items-center justify-center bg-gray-800">
              <FaImage className="text-gray-600 text-lg" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Image URL or drag and drop a file"
              className={`w-full ${bgClass} border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 outline-none`}
              data-action="admin_products_form_cover_image"
            />
            <div className="flex items-center gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 disabled:opacity-30"
                data-action="admin_products_form_cover_upload"
              >
                <FaUpload className="text-[10px]" />
                {uploading ? "Uploading..." : "Upload"}
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition bg-red-600/10 text-red-400 hover:bg-red-600/20"
                  data-action="admin_products_form_cover_remove"
                >
                  <FaTimes className="text-[9px]" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
        {dragOver && (
          <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center pointer-events-none">
            <p className="text-emerald-400 text-xs font-medium">Drop image here</p>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

export function AdminEventsPage() {
  const { apiBase, cdnBase, storageFolder, adminSecret, brand } = useEventsConfig();

  // Configure shared storage client for image uploads
  useEffect(() => {
    configureStorage({ baseUrl: apiBase });
  }, [apiBase]);

  // Storage folder for event images on DigitalOcean Spaces
  const STORAGE_FOLDER = `${storageFolder}/events`;

  const CATEGORIES = brand.categories || ["scavenger-hunt", "public-event", "other"];

  const authHeader = adminSecret || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Product form state
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);

  // Package form state
  const [showPackageForm, setShowPackageForm] = useState<string | null>(null);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState<PackageForm>(emptyPackageForm);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletePackageConfirm, setDeletePackageConfirm] = useState<string | null>(null);

  // Gallery state
  const [showEditProduct, setShowEditProduct] = useState<string | null>(null);
  const [showPackages, setShowPackages] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [newImageAlt, setNewImageAlt] = useState("");
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());

  // Section state - supports multiple inline editors open at once
  const [showSections, setShowSections] = useState<string | null>(null);
  const [openSectionForms, setOpenSectionForms] = useState<Record<string, SectionForm>>({});
  const [deleteSectionConfirm, setDeleteSectionConfirm] = useState<number | null>(null);
  const [dragSectionId, setDragSectionId] = useState<number | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<number | null>(null);

  // Themes state
  const [showThemes, setShowThemes] = useState<string | null>(null);
  const [newTheme, setNewTheme] = useState("");

  // Venue state
  const [showVenue, setShowVenue] = useState<string | null>(null);
  const [venueForm, setVenueForm] = useState({ name: "", address: "", lat: "", lng: "" });

  // Booking config state
  const [showBookingSections, setShowBookingSections] = useState(false);
  const [expandedBookingSection, setExpandedBookingSection] = useState<string | null>(null);
  const [newBookingSectionForm, setNewBookingSectionForm] = useState<{ id: string; title: string; icon: string } | null>(null);
  const [deleteBookingSectionConfirm, setDeleteBookingSectionConfirm] = useState<string | null>(null);
  const [dragBookingSectionId, setDragBookingSectionId] = useState<string | null>(null);
  const [dragOverBookingSectionId, setDragOverBookingSectionId] = useState<string | null>(null);
  const [expandedFieldGroup, setExpandedFieldGroup] = useState<string | null>(null);
  // Dynamic pricing fields and travel zones
  type PricingField = { id: string; label: string; value: string; category: "base" | "addon"; perPerson: boolean; mandatory?: boolean; pricingType?: "fixed" | "per-person" };
  type TravelZone = { id: string; label: string; pence: string; canInstantBook: boolean };
  type TaskSectionTypeConfig = { id: string; label: string; description: string; enabled: boolean; pricePounds: string };

  const DEFAULT_TASK_SECTION_TYPES: TaskSectionTypeConfig[] = [
    { id: "location", label: "Location", description: "Area-based tasks", enabled: true, pricePounds: "0" },
    { id: "miscellaneous", label: "Miscellaneous", description: "Themed tasks", enabled: true, pricePounds: "0" },
    { id: "bespoke", label: "Personalised", description: "Custom tasks tailored to you", enabled: true, pricePounds: "30.00" },
  ];

  const DEFAULT_PRICING_FIELDS: PricingField[] = [
    { id: "price-per-person", label: "Price per person", value: "30.00", category: "base", perPerson: false },
    { id: "min-players", label: "Min players", value: "6", category: "base", perPerson: false },
    { id: "min-reserve", label: "Min reserve", value: "180.00", category: "base", perPerson: false },
    { id: "personalised-section", label: "Personalised section", value: "30.00", category: "addon", perPerson: false },
    { id: "bespoke-misc-theme", label: "Bespoke misc theme", value: "50.00", category: "addon", perPerson: false },
    { id: "medals", label: "Medals", value: "5.00", category: "addon", perPerson: true },
    { id: "photo-prints", label: "Photo prints", value: "5.00", category: "addon", perPerson: true },
  ];

  const DEFAULT_TRAVEL_ZONES: TravelZone[] = [
    { id: "london", label: "London", pence: "0", canInstantBook: true },
    { id: "close", label: "Close to London", pence: "120.00", canInstantBook: true },
    { id: "medium", label: "Medium distance", pence: "160.00", canInstantBook: true },
    { id: "far", label: "Far UK", pence: "200.00", canInstantBook: true },
    { id: "international", label: "Outside UK", pence: "0", canInstantBook: false },
  ];

  const [bookingConfig, setBookingConfig] = useState({
    pricingFields: DEFAULT_PRICING_FIELDS as PricingField[],
    travelZones: DEFAULT_TRAVEL_ZONES as TravelZone[],
    taskSectionTypes: DEFAULT_TASK_SECTION_TYPES as TaskSectionTypeConfig[],
    productTaskSectionTypes: {} as Record<string, TaskSectionTypeConfig[]>,
    productGroupTypes: {} as Record<string, string>,
    whatsIncluded: "Professional BucketRace host\nPhysical handouts for your team\nTrophies for 1st, 2nd, and 3rd place\nA prize for first place\nDigital copy of team photos and videos",
    timeBlockingMode: "buffer",
    groupTypes: "corporate:Corporate\nhen:Hen\nbirthday:Birthday\nsten:Sten\nstag:Stag\nother:Other",
    styles: "professional:Professional\ncheeky:Cheeky",
    drinkStyles: "sober:Sober\nboozy:Boozy",
    firstPlacePrizes: "prosecco:Prosecco\nno-secco:No-secco\nbring-our-own:We'll bring our own",
    miscThemes: "halloween:Halloween\nchristmas:Christmas\neaster:Easter\nsummer:Summer\nwinter:Winter\nguy-fawkes:Guy Fawkes\nvalentines:Valentines\nbespoke:Bespoke Theme (+\u00A350)",
    bookingSections: [...DEFAULT_BOOKING_CONFIG.bookingSections],
    addOns: [...DEFAULT_BOOKING_CONFIG.addOns],
    messagePlaceholder: "Anything else we should know?",
    durationMode: "auto" as "auto" | "manual",
    durations: [...DEFAULT_BOOKING_CONFIG.durations],
  });
  const [savingBookingConfig, setSavingBookingConfig] = useState(false);

  // Helper to convert value:label arrays to textarea strings
  function valueLabelToText(arr: { value: string; label: string }[]): string {
    return (arr || []).map((item) => `${item.value}:${item.label}`).join("\n");
  }
  // Helper to convert textarea strings back to value:label arrays
  function textToValueLabel(text: string): { value: string; label: string }[] {
    return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { value: line.toLowerCase().replace(/\s+/g, "-"), label: line };
      return { value: line.slice(0, idx).trim(), label: line.slice(idx + 1).trim() };
    });
  }

  // Fetch booking config
  useEffect(() => {
    fetch(`${apiBase}/api/app-settings/booking_config`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.value) {
          try {
            const cfg = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
            // Load dynamic pricing fields if present, otherwise construct from legacy keys
            const pricingFields: PricingField[] = cfg.pricingFields || [
              { id: "price-per-person", label: "Price per person", value: ((cfg.pricePerPerson || 3000) / 100).toFixed(2), category: "base" as const, perPerson: false },
              { id: "min-players", label: "Min players", value: String(cfg.minPlayers || 6), category: "base" as const, perPerson: false },
              { id: "min-reserve", label: "Min reserve", value: ((cfg.minReserve || 18000) / 100).toFixed(2), category: "base" as const, perPerson: false },
              { id: "personalised-section", label: "Personalised section", value: ((cfg.bespokeSectonPrice || 3000) / 100).toFixed(2), category: "addon" as const, perPerson: false },
              { id: "bespoke-misc-theme", label: "Bespoke misc theme", value: ((cfg.miscBespokePrice || 5000) / 100).toFixed(2), category: "addon" as const, perPerson: false },
              { id: "medals", label: "Medals", value: ((cfg.medalsPricePP || 500) / 100).toFixed(2), category: "addon" as const, perPerson: true },
              { id: "photo-prints", label: "Photo prints", value: ((cfg.photoPrintsPricePP || 500) / 100).toFixed(2), category: "addon" as const, perPerson: true },
            ];

            // Load dynamic travel zones if present, otherwise construct from legacy
            const travelZones: TravelZone[] = cfg.travelZones || [
              { id: "london", label: "London", pence: "0", canInstantBook: true },
              { id: "close", label: "Close to London", pence: ((cfg.travelCharges?.close?.pence || 12000) / 100).toFixed(2), canInstantBook: cfg.travelCharges?.close?.canInstantBook ?? true },
              { id: "medium", label: "Medium distance", pence: ((cfg.travelCharges?.medium?.pence || 16000) / 100).toFixed(2), canInstantBook: cfg.travelCharges?.medium?.canInstantBook ?? true },
              { id: "far", label: "Far UK", pence: ((cfg.travelCharges?.far?.pence || 20000) / 100).toFixed(2), canInstantBook: cfg.travelCharges?.far?.canInstantBook ?? true },
              { id: "international", label: "Outside UK", pence: "0", canInstantBook: false },
            ];

            // Load task section types if present, otherwise use defaults
            const taskSectionTypes: TaskSectionTypeConfig[] = cfg.taskSectionTypes || [...DEFAULT_TASK_SECTION_TYPES];

            const productTaskSectionTypes: Record<string, TaskSectionTypeConfig[]> = cfg.productTaskSectionTypes || {};

            // Load per-product group types: stored as value:label text per slug
            const productGroupTypes: Record<string, string> = {};
            if (cfg.productGroupTypes) {
              for (const [slug, arr] of Object.entries(cfg.productGroupTypes)) {
                if (Array.isArray(arr)) {
                  productGroupTypes[slug] = (arr as { value: string; label: string }[]).map((g) => `${g.value}:${g.label}`).join("\n");
                } else if (typeof arr === "string") {
                  productGroupTypes[slug] = arr;
                }
              }
            }

            setBookingConfig({
              pricingFields,
              travelZones,
              taskSectionTypes,
              productTaskSectionTypes,
              productGroupTypes,
              whatsIncluded: (cfg.whatsIncluded || []).join("\n"),
              timeBlockingMode: cfg.timeBlockingMode || "buffer",
              groupTypes: valueLabelToText(cfg.groupTypes || DEFAULT_BOOKING_CONFIG.groupTypes),
              styles: valueLabelToText(cfg.styles || DEFAULT_BOOKING_CONFIG.styles),
              drinkStyles: valueLabelToText(cfg.drinkStyles || DEFAULT_BOOKING_CONFIG.drinkStyles),
              firstPlacePrizes: valueLabelToText(cfg.firstPlacePrizes || DEFAULT_BOOKING_CONFIG.firstPlacePrizes),
              miscThemes: valueLabelToText(cfg.miscThemes || DEFAULT_BOOKING_CONFIG.miscThemes),
              bookingSections: cfg.bookingSections || [...DEFAULT_BOOKING_CONFIG.bookingSections],
              addOns: cfg.addOns || [...DEFAULT_BOOKING_CONFIG.addOns],
              messagePlaceholder: cfg.messagePlaceholder || "Anything else we should know?",
              durationMode: cfg.durationMode || "auto",
              durations: cfg.durations || [...DEFAULT_BOOKING_CONFIG.durations],
            });
            console.log("[AdminEvents] Loaded booking config from settings");
          } catch (err) {
            console.error("[AdminEvents] Failed to parse booking config:", err);
          }
        }
      })
      .catch((err) => {
        console.error("[AdminEvents] Failed to fetch booking config:", err);
      });
  }, []);

  // Booking sections helpers
  function moveBookingSection(index: number, direction: "up" | "down") {
    const sections = [...bookingConfig.bookingSections].sort((a, b) => a.order - b.order);
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return;
    const tempOrder = sections[index].order;
    sections[index] = { ...sections[index], order: sections[swapIdx].order };
    sections[swapIdx] = { ...sections[swapIdx], order: tempOrder };
    setBookingConfig({ ...bookingConfig, bookingSections: sections });
    console.log(`[AdminEvents] Moved booking section ${sections[index].id} ${direction}`);
  }

  function toggleBookingSectionEnabled(sectionId: string) {
    const sections = bookingConfig.bookingSections.map((s) =>
      s.id === sectionId ? { ...s, enabled: !s.enabled } : s
    );
    setBookingConfig({ ...bookingConfig, bookingSections: sections });
  }

  function updateBookingSectionField(sectionId: string, field: string, value: unknown) {
    const sections = bookingConfig.bookingSections.map((s) => {
      if (s.id !== sectionId) return s;
      if (field === "title" || field === "description") {
        return { ...s, [field]: value as string };
      }
      return { ...s, fields: { ...(s.fields || {}), [field]: value } };
    });
    setBookingConfig({ ...bookingConfig, bookingSections: sections });
  }

  function updateAddOn(addOnId: string, updates: Partial<BookingAddOn>) {
    const addOns = bookingConfig.addOns.map((a) =>
      a.id === addOnId ? { ...a, ...updates } : a
    );
    setBookingConfig({ ...bookingConfig, addOns: addOns });
  }

  function addNewAddOn() {
    const id = `addon-${Date.now()}`;
    setBookingConfig({
      ...bookingConfig,
      addOns: [...bookingConfig.addOns, { id, name: "New Add-on", icon: "FaPlus", description: "", pricePP: 0, enabled: true }],
    });
    console.log("[AdminEvents] Added new add-on:", id);
  }

  function removeAddOn(addOnId: string) {
    setBookingConfig({
      ...bookingConfig,
      addOns: bookingConfig.addOns.filter((a) => a.id !== addOnId),
    });
    console.log("[AdminEvents] Removed add-on:", addOnId);
  }

  function addBookingSection(preset: { id: string; title: string; icon: string }) {
    const maxOrder = bookingConfig.bookingSections.reduce((max, s) => Math.max(max, s.order), 0);
    const newSection = { ...preset, enabled: true, order: maxOrder + 1 };
    setBookingConfig({
      ...bookingConfig,
      bookingSections: [...bookingConfig.bookingSections, newSection],
    });
    console.log("[AdminEvents] Added booking section:", preset.id);
  }

  function addCustomBookingSection() {
    if (!newBookingSectionForm) return;
    const id = newBookingSectionForm.id || `custom-${Date.now()}`;
    const maxOrder = bookingConfig.bookingSections.reduce((max, s) => Math.max(max, s.order), 0);
    setBookingConfig({
      ...bookingConfig,
      bookingSections: [...bookingConfig.bookingSections, {
        id,
        title: newBookingSectionForm.title || "New Section",
        icon: newBookingSectionForm.icon || "",
        enabled: true,
        order: maxOrder + 1,
      }],
    });
    setNewBookingSectionForm(null);
    console.log("[AdminEvents] Added custom booking section:", id);
  }

  function removeBookingSection(sectionId: string) {
    setBookingConfig({
      ...bookingConfig,
      bookingSections: bookingConfig.bookingSections.filter((s) => s.id !== sectionId),
    });
    setDeleteBookingSectionConfirm(null);
    console.log("[AdminEvents] Removed booking section:", sectionId);
  }

  function dropBookingSection(dragId: string, dropId: string) {
    if (dragId === dropId) return;
    const sorted = [...bookingConfig.bookingSections].sort((a, b) => a.order - b.order);
    const dragIdx = sorted.findIndex((s) => s.id === dragId);
    const dropIdx = sorted.findIndex((s) => s.id === dropId);
    if (dragIdx === -1 || dropIdx === -1) return;
    const [moved] = sorted.splice(dragIdx, 1);
    sorted.splice(dropIdx, 0, moved);
    const reordered = sorted.map((s, i) => ({ ...s, order: i + 1 }));
    setBookingConfig({ ...bookingConfig, bookingSections: reordered });
    console.log(`[AdminEvents] Reordered booking section ${dragId} to position ${dropIdx + 1}`);
  }

  function resetBookingSectionsToDefault() {
    setBookingConfig({
      ...bookingConfig,
      bookingSections: [...DEFAULT_BOOKING_CONFIG.bookingSections],
    });
    console.log("[AdminEvents] Reset booking sections to defaults");
  }

  // Dynamic pricing field helpers
  function addPricingField(category: "base" | "addon") {
    const id = `field-${Date.now()}`;
    setBookingConfig({
      ...bookingConfig,
      pricingFields: [...bookingConfig.pricingFields, { id, label: "New field", value: "0.00", category, perPerson: false }],
    });
    console.log("[AdminEvents] Added pricing field:", id, category);
  }

  function updatePricingField(id: string, updates: Partial<PricingField>) {
    setBookingConfig({
      ...bookingConfig,
      pricingFields: bookingConfig.pricingFields.map((f) => f.id === id ? { ...f, ...updates } : f),
    });
  }

  function removePricingField(id: string) {
    setBookingConfig({
      ...bookingConfig,
      pricingFields: bookingConfig.pricingFields.filter((f) => f.id !== id),
    });
    console.log("[AdminEvents] Removed pricing field:", id);
  }

  function addTravelZone() {
    const id = `zone-${Date.now()}`;
    setBookingConfig({
      ...bookingConfig,
      travelZones: [...bookingConfig.travelZones, { id, label: "New zone", pence: "0", canInstantBook: true }],
    });
    console.log("[AdminEvents] Added travel zone:", id);
  }

  function updateTravelZone(id: string, updates: Partial<TravelZone>) {
    setBookingConfig({
      ...bookingConfig,
      travelZones: bookingConfig.travelZones.map((z) => z.id === id ? { ...z, ...updates } : z),
    });
  }

  function removeTravelZone(id: string) {
    setBookingConfig({
      ...bookingConfig,
      travelZones: bookingConfig.travelZones.filter((z) => z.id !== id),
    });
    console.log("[AdminEvents] Removed travel zone:", id);
  }

  // Task section type helpers (per-product)
  function getProductTaskSectionTypes(productSlug: string): TaskSectionTypeConfig[] {
    return bookingConfig.productTaskSectionTypes[productSlug] || bookingConfig.taskSectionTypes;
  }

  function setProductTaskSectionTypes(productSlug: string, types: TaskSectionTypeConfig[]) {
    setBookingConfig({
      ...bookingConfig,
      productTaskSectionTypes: { ...bookingConfig.productTaskSectionTypes, [productSlug]: types },
    });
  }

  function addTaskSectionType(productSlug: string) {
    const current = getProductTaskSectionTypes(productSlug);
    const id = `section-type-${Date.now()}`;
    setProductTaskSectionTypes(productSlug, [...current, { id, label: "New section type", description: "Description", enabled: true, pricePounds: "0" }]);
    console.log("[AdminEvents] Added task section type for", productSlug, ":", id);
  }

  function updateTaskSectionType(productSlug: string, id: string, updates: Partial<TaskSectionTypeConfig>) {
    const current = getProductTaskSectionTypes(productSlug);
    setProductTaskSectionTypes(productSlug, current.map((t) => t.id === id ? { ...t, ...updates } : t));
  }

  function removeTaskSectionType(productSlug: string, id: string) {
    const current = getProductTaskSectionTypes(productSlug);
    setProductTaskSectionTypes(productSlug, current.filter((t) => t.id !== id));
    console.log("[AdminEvents] Removed task section type for", productSlug, ":", id);
  }

  function resetTaskSectionTypesToDefault(productSlug: string) {
    const updated = { ...bookingConfig.productTaskSectionTypes };
    delete updated[productSlug];
    setBookingConfig({ ...bookingConfig, productTaskSectionTypes: updated });
    console.log("[AdminEvents] Reset task section types to defaults for", productSlug);
  }

  // Per-product group type helpers
  function getProductGroupTypes(productSlug: string): string {
    return bookingConfig.productGroupTypes[productSlug] ?? bookingConfig.groupTypes;
  }

  function setProductGroupTypes(productSlug: string, text: string) {
    setBookingConfig({
      ...bookingConfig,
      productGroupTypes: { ...bookingConfig.productGroupTypes, [productSlug]: text },
    });
  }

  function resetProductGroupTypes(productSlug: string) {
    const updated = { ...bookingConfig.productGroupTypes };
    delete updated[productSlug];
    setBookingConfig({ ...bookingConfig, productGroupTypes: updated });
    console.log("[AdminEvents] Reset group types to defaults for", productSlug);
  }

  // Field group helpers
  function getFieldGroups(sectionId: string): { id: string; label: string; enabled: boolean }[] {
    const sec = bookingConfig.bookingSections.find((s) => s.id === sectionId);
    return (sec as any)?.fieldGroups || [];
  }
  function updateFieldGroup(sectionId: string, fieldGroupId: string, updates: Partial<{ label: string; enabled: boolean }>) {
    const sections = bookingConfig.bookingSections.map((s) => {
      if (s.id !== sectionId) return s;
      const fgs = ((s as any).fieldGroups || []).map((fg: any) => fg.id === fieldGroupId ? { ...fg, ...updates } : fg);
      return { ...s, fieldGroups: fgs };
    });
    setBookingConfig({ ...bookingConfig, bookingSections: sections });
  }
  function removeFieldGroup(sectionId: string, fieldGroupId: string) {
    const sections = bookingConfig.bookingSections.map((s) => {
      if (s.id !== sectionId) return s;
      return { ...s, fieldGroups: ((s as any).fieldGroups || []).filter((fg: any) => fg.id !== fieldGroupId) };
    });
    setBookingConfig({ ...bookingConfig, bookingSections: sections });
    console.log("[AdminEvents] Removed field group", fieldGroupId, "from", sectionId);
  }
  function addFieldGroup(sectionId: string, id: string, label: string) {
    const sections = bookingConfig.bookingSections.map((s) => {
      if (s.id !== sectionId) return s;
      const existing = ((s as any).fieldGroups || []);
      if (existing.some((fg: any) => fg.id === id)) return s;
      return { ...s, fieldGroups: [...existing, { id, label, enabled: true }] };
    });
    setBookingConfig({ ...bookingConfig, bookingSections: sections });
    console.log("[AdminEvents] Added field group", id, "to", sectionId);
  }

  // Value:label list CRUD helpers (works on newline-separated "value:Label" text)
  function listAddItem(text: string, defaultValue = "new-item", defaultLabel = "New Item"): string {
    return text ? text + `\n${defaultValue}:${defaultLabel}` : `${defaultValue}:${defaultLabel}`;
  }
  function listRemoveItem(text: string, idx: number): string {
    return text.split("\n").filter(Boolean).filter((_, i) => i !== idx).join("\n");
  }
  function listUpdateItem(text: string, idx: number, value: string, label: string): string {
    const lines = text.split("\n").filter(Boolean);
    lines[idx] = `${value}:${label}`;
    return lines.join("\n");
  }
  function listParseItems(text: string): { value: string; label: string }[] {
    return text.split("\n").filter(Boolean).map((line) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) return { value: line.toLowerCase().replace(/\s+/g, "-"), label: line };
      return { value: line.slice(0, colonIdx).trim(), label: line.slice(colonIdx + 1).trim() };
    });
  }

  // Duration helpers
  function addDuration() {
    setBookingConfig({
      ...bookingConfig,
      durations: [...bookingConfig.durations, { value: "1", label: "1 hour", gameTime: "30 minutes", total: "1 hour", minSections: 0 }],
    });
    console.log("[AdminEvents] Added duration option");
  }
  function updateDuration(idx: number, updates: Partial<typeof bookingConfig.durations[0]>) {
    const durations = bookingConfig.durations.map((d, i) => i === idx ? { ...d, ...updates } : d);
    setBookingConfig({ ...bookingConfig, durations });
  }
  function removeDuration(idx: number) {
    setBookingConfig({ ...bookingConfig, durations: bookingConfig.durations.filter((_, i) => i !== idx) });
    console.log("[AdminEvents] Removed duration option at index", idx);
  }

  async function saveBookingConfig() {
    setSavingBookingConfig(true);
    try {
      // Helper to find a pricing field value by ID
      const pf = (id: string): number => {
        const field = bookingConfig.pricingFields.find((f) => f.id === id);
        if (!field) return 0;
        // "min-players" is a count, not currency
        if (id === "min-players") return parseInt(field.value) || 0;
        return Math.round(parseFloat(field.value || "0") * 100);
      };

      // Build travel charges object from dynamic zones (legacy compat)
      const travelCharges: Record<string, { label: string; pence: number; canInstantBook: boolean }> = {};
      for (const zone of bookingConfig.travelZones) {
        travelCharges[zone.id] = {
          label: zone.label,
          pence: Math.round(parseFloat(zone.pence || "0") * 100),
          canInstantBook: zone.canInstantBook,
        };
      }

      const cfg = {
        // Dynamic arrays (new format)
        pricingFields: bookingConfig.pricingFields,
        travelZones: bookingConfig.travelZones,
        // Legacy keys for BookingForm backward compat
        pricePerPerson: pf("price-per-person"),
        minPlayers: pf("min-players"),
        minReserve: pf("min-reserve"),
        bespokeSectonPrice: pf("personalised-section"),
        miscBespokePrice: pf("bespoke-misc-theme"),
        medalsPricePP: pf("medals"),
        photoPrintsPricePP: pf("photo-prints"),
        travelCharges,
        whatsIncluded: bookingConfig.whatsIncluded.split("\n").map((s: string) => s.trim()).filter(Boolean),
        timeBlockingMode: bookingConfig.timeBlockingMode || "buffer",
        groupTypes: textToValueLabel(bookingConfig.groupTypes),
        styles: textToValueLabel(bookingConfig.styles),
        drinkStyles: textToValueLabel(bookingConfig.drinkStyles),
        firstPlacePrizes: textToValueLabel(bookingConfig.firstPlacePrizes),
        miscThemes: textToValueLabel(bookingConfig.miscThemes),
        bookingSections: bookingConfig.bookingSections,
        addOns: bookingConfig.addOns,
        messagePlaceholder: bookingConfig.messagePlaceholder,
        taskSectionTypes: bookingConfig.taskSectionTypes,
        productTaskSectionTypes: bookingConfig.productTaskSectionTypes,
        productGroupTypes: Object.fromEntries(
          Object.entries(bookingConfig.productGroupTypes).map(([slug, text]) => [slug, textToValueLabel(text)])
        ),
        durationMode: bookingConfig.durationMode,
        durations: bookingConfig.durations,
      };

      console.log("[AdminEvents] Saving booking config:", cfg);
      const res = await fetch(`${apiBase}/api/app-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": authHeader },
        body: JSON.stringify({ key: "booking_config", value: JSON.stringify(cfg), category: "booking", description: "Booking form configuration (pricing, sections, add-ons, travel charges)" }),
      });
      if (res.ok) {
        console.log("[AdminEvents] Booking config saved");
        setShowBookingSections(false);
        setExpandedBookingSection(null);
      } else {
        console.error("[AdminEvents] Failed to save booking config:", res.status);
      }
    } catch (err) {
      console.error("[AdminEvents] Error saving booking config:", err);
    } finally {
      setSavingBookingConfig(false);
    }
  }

  useEffect(() => {
    if (!adminSecret) return;
    fetchProducts();
  }, [adminSecret]);

  async function fetchProducts(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      console.log("[AdminProducts] Fetching products");
      // Try admin endpoint first, fall back to public endpoint
      let res = await fetch(`${apiBase}/api/admin/products`, {
        headers: { "x-admin-key": authHeader },
      });
      if (!res.ok) {
        console.log("[AdminProducts] Admin endpoint failed, falling back to public");
        res = await fetch(`${apiBase}/api/products?active=false`);
      }
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        console.log(`[AdminProducts] Loaded ${data.length} products`);
      } else {
        console.error("[AdminProducts] Failed to fetch products:", res.status);
      }
    } catch (err) {
      console.error("[AdminProducts] Error:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  /** Refresh a single product in local state without refetching the whole list */
  async function refreshProduct(productId: string) {
    try {
      const res = await fetch(`${apiBase}/api/products/${productId}`, {
        headers: { "x-admin-key": authHeader },
      });
      if (res.ok) {
        const updated = await res.json();
        setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...updated } : p)));
      }
    } catch (err) {
      console.error("[AdminProducts] refreshProduct error:", err);
    }
  }

  async function toggleActive(id: string) {
    setActionLoading(id);
    try {
      console.log(`[AdminProducts] Toggling product ${id}`);
      const res = await fetch(`${apiBase}/api/admin/products/${id}/toggle`, {
        method: "PUT",
        headers: { "x-admin-key": authHeader },
      });
      if (res.ok) {
        const updated = await res.json();
        setProducts((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, isActive: updated.isActive } : p
          )
        );
        console.log(`[AdminProducts] Toggled ${id} to ${updated.isActive}`);
      } else {
        console.error("[AdminProducts] Toggle failed:", res.status);
      }
    } catch (err) {
      console.error("[AdminProducts] Toggle error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function saveProduct() {
    setActionLoading("saving-product");
    try {
      const isEditing = !!editingProductId;
      const url = isEditing
        ? `${apiBase}/api/admin/products/${editingProductId}`
        : `${apiBase}/api/admin/products`;
      const method = isEditing ? "PUT" : "POST";

      console.log(`[AdminProducts] ${isEditing ? "Updating" : "Creating"} product`);
      const res = await fetch(url, {
        method,
        headers: {
          "x-admin-key": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: productForm.name,
          slug: productForm.slug,
          description: productForm.description || "No description yet",
          shortDesc: productForm.shortDesc || null,
          coverImage: productForm.coverImage || null,
          category: productForm.category,
          maxGroupSize: productForm.maxGroupSize ? parseInt(productForm.maxGroupSize) : null,
          duration: productForm.duration || null,
          ticketLimit: productForm.ticketLimit ? parseInt(productForm.ticketLimit) : null,
          displayOrder: productForm.displayOrder,
          isActive: productForm.isActive,
        }),
      });
      if (res.ok) {
        console.log(`[AdminProducts] Product saved successfully`);
        setShowProductForm(false);
        setEditingProductId(null);
        setProductForm(emptyProductForm);
        if (isEditing && editingProductId) {
          refreshProduct(editingProductId);
        } else {
          fetchProducts(false);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("[AdminProducts] Save failed:", res.status, err);
      }
    } catch (err) {
      console.error("[AdminProducts] Save error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteProduct(id: string) {
    setActionLoading(id);
    try {
      console.log(`[AdminProducts] Deleting product ${id}`);
      const res = await fetch(`${apiBase}/api/admin/products/${id}`, {
        method: "DELETE",
        headers: { "x-admin-key": authHeader },
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        setDeleteConfirm(null);
        console.log(`[AdminProducts] Deleted product ${id}`);
      } else {
        console.error("[AdminProducts] Delete failed:", res.status);
      }
    } catch (err) {
      console.error("[AdminProducts] Delete error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function duplicateProduct(product: Product) {
    setActionLoading(product.id);
    try {
      const newSlug = `${product.slug}-copy`;
      const newName = `${product.name} (Copy)`;
      console.log(`[AdminProducts] Duplicating product "${product.name}" as "${newName}"`);

      // 1. Create the new product
      const res = await fetch(`${apiBase}/api/admin/products`, {
        method: "POST",
        headers: {
          "x-admin-key": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newName,
          slug: newSlug,
          description: product.description || "No description yet",
          shortDesc: product.shortDesc || null,
          coverImage: product.coverImage || null,
          category: product.category,
          maxGroupSize: product.maxGroupSize || null,
          duration: product.duration || null,
          ticketLimit: product.ticketLimit || null,
          displayOrder: (product.displayOrder || 0) + 1,
          isActive: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[AdminProducts] Duplicate create failed:", res.status, err);
        return;
      }

      const newProduct = await res.json();
      const newId = newProduct.id;
      console.log(`[AdminProducts] Created duplicate product ${newId}`);

      // 2. Duplicate packages
      if (product.packages?.length) {
        for (const pkg of product.packages) {
          await fetch(`${apiBase}/api/admin/packages`, {
            method: "POST",
            headers: {
              "x-admin-key": authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productId: newId,
              name: pkg.name,
              slug: pkg.slug,
              description: pkg.description || null,
              duration: pkg.duration || null,
              bookingType: pkg.bookingType,
              minPlayers: pkg.minPlayers || null,
              maxPlayers: pkg.maxPlayers || null,
              pricePerPerson: pkg.pricePerPerson || null,
              flatPrice: pkg.flatPrice || null,
              minReserve: pkg.minReserve || null,
              additionalPlayerPrice: pkg.additionalPlayerPrice || null,
              includes: pkg.includes || null,
              displayOrder: pkg.displayOrder || 0,
              isActive: pkg.isActive,
            }),
          });
        }
        console.log(`[AdminProducts] Duplicated ${product.packages.length} packages`);
      }

      // 3. Duplicate sections
      if (product.sections?.length) {
        for (const section of product.sections) {
          await fetch(`${apiBase}/api/admin/products/${newId}/sections`, {
            method: "POST",
            headers: {
              "x-admin-key": authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: section.title,
              type: section.type,
              content: section.content || null,
              listItems: section.listItems || null,
              isCollapsible: section.isCollapsible,
              displayOrder: section.displayOrder || 0,
            }),
          });
        }
        console.log(`[AdminProducts] Duplicated ${product.sections.length} sections`);
      }

      // 4. Duplicate gallery images
      if (product.images?.length) {
        for (const img of product.images) {
          await fetch(`${apiBase}/api/admin/products/${newId}/images`, {
            method: "POST",
            headers: {
              "x-admin-key": authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: img.url,
              alt: img.alt || null,
              sortOrder: img.sortOrder || 0,
            }),
          });
        }
        console.log(`[AdminProducts] Duplicated ${product.images.length} gallery images`);
      }

      console.log(`[AdminProducts] Duplicate complete for "${newName}"`);
      fetchProducts(false);
    } catch (err) {
      console.error("[AdminProducts] Duplicate error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function savePackage(productId: string) {
    setActionLoading("saving-package");
    try {
      const isEditing = !!editingPackageId;
      const url = isEditing
        ? `${apiBase}/api/admin/packages/${editingPackageId}`
        : `${apiBase}/api/admin/packages`;
      const method = isEditing ? "PUT" : "POST";

      const whatsIncludedArray = packageForm.whatsIncluded
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        name: packageForm.name,
        slug: packageForm.slug,
        description: packageForm.description || null,
        duration: packageForm.duration || null,
        bookingType: packageForm.bookingType,
        minPlayers: packageForm.minPlayers ? parseInt(packageForm.minPlayers) : null,
        maxPlayers: packageForm.maxPlayers ? parseInt(packageForm.maxPlayers) : null,
        pricePerPerson: packageForm.pricePerPerson
          ? poundsToPence(parseFloat(packageForm.pricePerPerson))
          : null,
        flatPrice: packageForm.flatPrice
          ? poundsToPence(parseFloat(packageForm.flatPrice))
          : null,
        minReserve: packageForm.minReserve
          ? poundsToPence(parseFloat(packageForm.minReserve))
          : null,
        additionalPlayerPrice: packageForm.additionalPlayerPrice
          ? poundsToPence(parseFloat(packageForm.additionalPlayerPrice))
          : null,
        includes: whatsIncludedArray.length > 0 ? JSON.stringify(whatsIncludedArray) : null,
        displayOrder: packageForm.displayOrder,
        isActive: packageForm.isActive,
      };

      if (!isEditing) {
        body.productId = productId;
      }

      console.log(`[AdminProducts] ${isEditing ? "Updating" : "Creating"} package`);
      const res = await fetch(url, {
        method,
        headers: {
          "x-admin-key": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        console.log(`[AdminProducts] Package saved successfully`);
        setShowPackageForm(null);
        setEditingPackageId(null);
        setPackageForm(emptyPackageForm);
        refreshProduct(productId);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("[AdminProducts] Package save failed:", res.status, err);
      }
    } catch (err) {
      console.error("[AdminProducts] Package save error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function deletePackage(id: string) {
    setActionLoading(id);
    try {
      console.log(`[AdminProducts] Deleting package ${id}`);
      const res = await fetch(`${apiBase}/api/admin/packages/${id}`, {
        method: "DELETE",
        headers: { "x-admin-key": authHeader },
      });
      if (res.ok) {
        setDeletePackageConfirm(null);
        // Optimistic: remove package from local state
        setProducts((prev) =>
          prev.map((p) => ({
            ...p,
            packages: p.packages.filter((pkg) => pkg.id !== id),
          }))
        );
        console.log(`[AdminProducts] Deleted package ${id}`);
      } else {
        console.error("[AdminProducts] Package delete failed:", res.status);
      }
    } catch (err) {
      console.error("[AdminProducts] Package delete error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function addGalleryImage(productId: string) {
    if (!newImageUrl.trim()) return;
    setActionLoading("adding-image");
    try {
      console.log(`[AdminProducts] Adding gallery image to ${productId}`);
      const res = await fetch(`${apiBase}/api/admin/products/${productId}/images`, {
        method: "POST",
        headers: {
          "x-admin-key": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images: [{ url: newImageUrl.trim(), alt: newImageAlt.trim() || null }],
        }),
      });
      if (res.ok) {
        console.log("[AdminProducts] Gallery image added");
        setNewImageUrl("");
        setNewImageAlt("");
        refreshProduct(productId);
      } else {
        console.error("[AdminProducts] Failed to add image:", res.status);
      }
    } catch (err) {
      console.error("[AdminProducts] Error adding image:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function uploadGalleryImages(productId: string, files: FileList) {
    setGalleryUploading(true);
    try {
      console.log(`[AdminProducts] Uploading ${files.length} gallery image(s) for ${productId}`);
      for (const file of Array.from(files)) {
        console.log(`[AdminProducts] Uploading gallery file: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);

        // Upload to Spaces via storage client
        let url: string;
        try {
          const result = await uploadImage(file, STORAGE_FOLDER);
          url = result.url;
          console.log(`[AdminProducts] Gallery file uploaded: ${url}`);
        } catch (uploadErr) {
          console.error(`[AdminProducts] Gallery upload failed for ${file.name}:`, uploadErr);
          continue;
        }

        // Add to product gallery
        const addRes = await fetch(`${apiBase}/api/admin/products/${productId}/images`, {
          method: "POST",
          headers: {
            "x-admin-key": authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            images: [{ url, alt: null }],
          }),
        });

        if (addRes.ok) {
          console.log(`[AdminProducts] Gallery image added: ${file.name}`);
        } else {
          console.error(`[AdminProducts] Failed to add gallery image: ${file.name}`, addRes.status);
        }
      }

      refreshProduct(productId);
    } catch (err) {
      console.error("[AdminProducts] Gallery upload error:", err);
    } finally {
      setGalleryUploading(false);
      if (galleryFileRef.current) galleryFileRef.current.value = "";
    }
  }

  async function deleteGalleryImage(imageId: number) {
    setActionLoading(`del-img-${imageId}`);
    // Optimistic: remove from local state immediately
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        images: p.images.filter((img) => img.id !== imageId),
      }))
    );
    try {
      console.log(`[AdminProducts] Deleting gallery image ${imageId}`);
      const res = await fetch(`${apiBase}/api/admin/images/${imageId}`, {
        method: "DELETE",
        headers: { "x-admin-key": authHeader },
      });
      if (!res.ok) {
        console.error("[AdminProducts] Failed to delete image:", res.status);
        fetchProducts(false); // Revert on failure
      }
    } catch (err) {
      console.error("[AdminProducts] Error deleting image:", err);
      fetchProducts(false);
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteSelectedImages() {
    if (selectedImages.size === 0) return;
    const ids = Array.from(selectedImages);
    console.log(`[AdminProducts] Batch deleting ${ids.length} gallery images`);
    setActionLoading("batch-delete");

    // Optimistic: remove all selected from local state
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        images: p.images.filter((img) => !selectedImages.has(img.id)),
      }))
    );
    setSelectedImages(new Set());

    // Delete in parallel
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`${apiBase}/api/admin/images/${id}`, {
          method: "DELETE",
          headers: { "x-admin-key": authHeader },
        })
      )
    );

    const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
    if (failed.length > 0) {
      console.error(`[AdminProducts] ${failed.length}/${ids.length} deletes failed, refreshing`);
      fetchProducts(false);
    } else {
      console.log(`[AdminProducts] All ${ids.length} images deleted`);
    }
    setActionLoading(null);
  }

  async function rotateGalleryImage(imageId: number, degrees: number = 90) {
    setActionLoading(`rotate-img-${imageId}`);
    try {
      console.log(`[AdminProducts] Rotating image ${imageId} by ${degrees} degrees`);
      const res = await fetch(`${apiBase}/api/admin/images/${imageId}/rotate`, {
        method: "POST",
        headers: {
          "x-admin-key": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ degrees }),
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`[AdminProducts] Image rotated, new URL: ${data.url}`);
        // Update local state with cache-busted URL
        setProducts((prev) =>
          prev.map((p) => ({
            ...p,
            images: p.images.map((img) =>
              img.id === imageId ? { ...img, url: data.url } : img
            ),
          }))
        );
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("[AdminProducts] Rotate failed:", res.status, err);
      }
    } catch (err) {
      console.error("[AdminProducts] Rotate error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function reorderGalleryImage(productId: string, images: ProductImage[], imageId: number, direction: "up" | "down") {
    const idx = images.findIndex((img) => img.id === imageId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === images.length - 1) return;

    const newImages = [...images];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newImages[idx], newImages[swapIdx]] = [newImages[swapIdx], newImages[idx]];

    // Optimistic update - no full refetch, no flash
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, images: newImages } : p))
    );

    try {
      console.log(`[AdminProducts] Reordering gallery images for ${productId}`);
      const res = await fetch(`${apiBase}/api/admin/products/${productId}/images/reorder`, {
        method: "PUT",
        headers: {
          "x-admin-key": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageIds: newImages.map((img) => img.id) }),
      });
      if (!res.ok) {
        console.error("[AdminProducts] Gallery reorder failed, reverting");
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, images } : p))
        );
      } else {
        console.log("[AdminProducts] Gallery reordered");
      }
    } catch (err) {
      console.error("[AdminProducts] Error reordering:", err);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, images } : p))
      );
    }
  }

  // ─── Section CRUD ─────────────────────────────────────────────────────────────

  async function saveSection(productId: string, formKey: string) {
    setActionLoading("saving-section");
    try {
      const form = openSectionForms[formKey];
      if (!form) return;

      const isEditing = formKey !== `new-${productId}`;
      const sectionId = isEditing ? parseInt(formKey) : null;
      const url = isEditing
        ? `${apiBase}/api/admin/sections/${sectionId}`
        : `${apiBase}/api/admin/products/${productId}/sections`;
      const method = isEditing ? "PUT" : "POST";

      const listItemsArray = form.listItems
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const isSpecialType = ["gallery", "themes", "venue"].includes(form.type);
      const body: Record<string, unknown> = {
        title: form.title,
        type: form.type,
        content: form.type === "text" ? (form.content || null) : null,
        listItems: !isSpecialType && form.type !== "text" && listItemsArray.length > 0
          ? JSON.stringify(listItemsArray)
          : null,
        displayOrder: form.displayOrder,
        isCollapsible: form.isCollapsible,
      };

      console.log(`[AdminProducts] ${isEditing ? "Updating" : "Creating"} section: ${form.title}`);
      const res = await fetch(url, {
        method,
        headers: {
          "x-admin-key": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        console.log("[AdminProducts] Section saved");
        closeSectionForm(formKey);
        refreshProduct(productId);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("[AdminProducts] Section save failed:", res.status, err);
      }
    } catch (err) {
      console.error("[AdminProducts] Section save error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteSection(sectionId: number, productId?: string) {
    setActionLoading(`del-sec-${sectionId}`);
    // Optimistic: remove section from local state
    if (productId) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, sections: p.sections.filter((s) => s.id !== sectionId) }
            : p
        )
      );
    }
    try {
      console.log(`[AdminProducts] Deleting section ${sectionId}`);
      const res = await fetch(`${apiBase}/api/admin/sections/${sectionId}`, {
        method: "DELETE",
        headers: { "x-admin-key": authHeader },
      });
      if (res.ok) {
        console.log("[AdminProducts] Section deleted");
        setDeleteSectionConfirm(null);
      } else {
        console.error("[AdminProducts] Section delete failed:", res.status);
        if (productId) refreshProduct(productId);
      }
    } catch (err) {
      console.error("[AdminProducts] Section delete error:", err);
      if (productId) refreshProduct(productId);
    } finally {
      setActionLoading(null);
    }
  }

  async function dropSection(productId: string, sections: ProductSection[], fromId: number, toId: number) {
    if (fromId === toId) return;
    const fromIdx = sections.findIndex((s) => s.id === fromId);
    const toIdx = sections.findIndex((s) => s.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;

    const newSections = [...sections];
    const [moved] = newSections.splice(fromIdx, 1);
    newSections.splice(toIdx, 0, moved);

    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, sections: newSections } : p))
    );

    try {
      console.log(`[AdminProducts] Reordering sections for ${productId} via drag`);
      const res = await fetch(`${apiBase}/api/admin/products/${productId}/sections/reorder`, {
        method: "PUT",
        headers: {
          "x-admin-key": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sectionIds: newSections.map((s) => s.id) }),
      });
      if (!res.ok) {
        console.error("[AdminProducts] Section reorder failed, reverting");
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, sections } : p))
        );
      } else {
        console.log("[AdminProducts] Sections reordered");
      }
    } catch (err) {
      console.error("[AdminProducts] Section reorder error:", err);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, sections } : p))
      );
    }
  }

  function moveSectionUpDown(productId: string, sections: ProductSection[], sectionIdx: number, direction: "up" | "down") {
    const targetIdx = direction === "up" ? sectionIdx - 1 : sectionIdx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    dropSection(productId, sections, sections[sectionIdx].id, sections[targetIdx].id);
  }

  async function toggleSectionCollapsible(productId: string, section: ProductSection) {
    const newVal = !section.isCollapsible;
    // Optimistic update
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, sections: p.sections.map((s) => (s.id === section.id ? { ...s, isCollapsible: newVal } : s)) }
          : p
      )
    );
    try {
      console.log(`[AdminProducts] Toggling section ${section.id} collapsible=${newVal}`);
      const res = await fetch(`${apiBase}/api/admin/sections/${section.id}`, {
        method: "PUT",
        headers: { "x-admin-key": authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ isCollapsible: newVal }),
      });
      if (!res.ok) {
        console.error("[AdminProducts] Toggle collapsible failed, reverting");
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId
              ? { ...p, sections: p.sections.map((s) => (s.id === section.id ? { ...s, isCollapsible: !newVal } : s)) }
              : p
          )
        );
      }
    } catch (err) {
      console.error("[AdminProducts] Toggle collapsible error:", err);
    }
  }

  async function formatAllPages(sourceProduct: Product) {
    if (!confirm(`Apply section order and visibility from "${sourceProduct.name}" to all other products?`)) return;
    const sourceOrder = (sourceProduct.sections || [])
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((s) => ({ title: s.title, type: s.type, isCollapsible: s.isCollapsible }));

    console.log(`[AdminProducts] Formatting all pages to match "${sourceProduct.name}" (${sourceOrder.length} sections)`);

    const otherProducts = products.filter((p) => p.id !== sourceProduct.id);
    for (const product of otherProducts) {
      const sections = product.sections || [];
      // Match sections by title (case-insensitive) and reorder + update collapsible
      const reordered: number[] = [];
      for (const template of sourceOrder) {
        const match = sections.find(
          (s) => s.title.toLowerCase() === template.title.toLowerCase() && s.type === template.type
        );
        if (match) {
          reordered.push(match.id);
          // Update collapsible if different
          if (match.isCollapsible !== template.isCollapsible) {
            try {
              await fetch(`${apiBase}/api/admin/sections/${match.id}`, {
                method: "PUT",
                headers: { "x-admin-key": authHeader, "Content-Type": "application/json" },
                body: JSON.stringify({ isCollapsible: template.isCollapsible }),
              });
            } catch (err) {
              console.error(`[AdminProducts] Error updating collapsible for section ${match.id}:`, err);
            }
          }
        }
      }
      // Add any sections not in the template at the end
      for (const s of sections) {
        if (!reordered.includes(s.id)) reordered.push(s.id);
      }

      if (reordered.length > 0) {
        try {
          await fetch(`${apiBase}/api/admin/products/${product.id}/sections/reorder`, {
            method: "PUT",
            headers: { "x-admin-key": authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ sectionIds: reordered }),
          });
          console.log(`[AdminProducts] Formatted "${product.name}" sections`);
        } catch (err) {
          console.error(`[AdminProducts] Error reordering sections for ${product.id}:`, err);
        }
      }
    }
    // Refresh
    fetchProducts(false);
    console.log("[AdminProducts] Format all pages complete");
  }

  // ─── Themes CRUD ─────────────────────────────────────────────────────────────

  function getThemesArray(product: Product): string[] {
    if (!product.themes) return [];
    try {
      const arr = JSON.parse(product.themes);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  async function saveThemes(productId: string, themes: string[]) {
    setActionLoading("saving-themes");
    try {
      console.log(`[AdminProducts] Saving themes for ${productId}:`, themes);
      const res = await fetch(`${apiBase}/api/admin/products/${productId}`, {
        method: "PUT",
        headers: {
          "x-admin-key": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ themes: JSON.stringify(themes) }),
      });
      if (res.ok) {
        console.log("[AdminProducts] Themes saved");
        // Optimistic: update themes in local state
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, themes: JSON.stringify(themes) } : p))
        );
      } else {
        console.error("[AdminProducts] Themes save failed:", res.status);
      }
    } catch (err) {
      console.error("[AdminProducts] Themes save error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  function addTheme(productId: string, product: Product) {
    if (!newTheme.trim()) return;
    const themes = getThemesArray(product);
    if (themes.includes(newTheme.trim())) return;
    themes.push(newTheme.trim());
    setNewTheme("");
    saveThemes(productId, themes);
  }

  function removeTheme(productId: string, product: Product, theme: string) {
    const themes = getThemesArray(product).filter((t) => t !== theme);
    saveThemes(productId, themes);
  }

  // ─── Venue CRUD ─────────────────────────────────────────────────────────────

  function getVenueObj(product: Product): { name: string; address: string; lat?: string; lng?: string } {
    if (!product.venue) return { name: "", address: "" };
    try {
      return JSON.parse(product.venue);
    } catch {
      return { name: "", address: "" };
    }
  }

  function startEditVenue(product: Product) {
    const v = getVenueObj(product);
    setVenueForm({
      name: v.name || "",
      address: v.address || "",
      lat: v.lat || "",
      lng: v.lng || "",
    });
    setShowVenue(product.id);
  }

  async function saveVenue(productId: string) {
    setActionLoading("saving-venue");
    try {
      const venueObj: Record<string, string> = {};
      if (venueForm.name) venueObj.name = venueForm.name;
      if (venueForm.address) venueObj.address = venueForm.address;
      if (venueForm.lat) venueObj.lat = venueForm.lat;
      if (venueForm.lng) venueObj.lng = venueForm.lng;

      console.log(`[AdminProducts] Saving venue for ${productId}:`, venueObj);
      const res = await fetch(`${apiBase}/api/admin/products/${productId}`, {
        method: "PUT",
        headers: {
          "x-admin-key": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          venue: Object.keys(venueObj).length > 0 ? JSON.stringify(venueObj) : null,
        }),
      });
      if (res.ok) {
        console.log("[AdminProducts] Venue saved");
        // Optimistic: update venue in local state
        const venueJson = Object.keys(venueObj).length > 0 ? JSON.stringify(venueObj) : null;
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, venue: venueJson } : p))
        );
      } else {
        console.error("[AdminProducts] Venue save failed:", res.status);
      }
    } catch (err) {
      console.error("[AdminProducts] Venue save error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  function startEditSection(section: ProductSection) {
    let listItemsText = "";
    if (section.listItems) {
      try {
        const arr = JSON.parse(section.listItems);
        listItemsText = Array.isArray(arr) ? arr.join("\n") : section.listItems;
      } catch {
        listItemsText = section.listItems;
      }
    }
    setOpenSectionForms((prev) => ({
      ...prev,
      [String(section.id)]: {
        title: section.title,
        type: section.type as SectionType,
        content: section.content || "",
        listItems: listItemsText,
        displayOrder: section.displayOrder,
        isCollapsible: section.isCollapsible !== false,
      },
    }));
  }

  function openNewSectionForm(productId: string, preset?: string) {
    // For special section types, create the section directly without opening a form
    if (preset === "Gallery" || preset === "Themes" || preset === "Venue") {
      createSpecialSection(productId, preset);
      return;
    }
    const key = `new-${productId}`;
    const form: SectionForm = {
      ...emptySectionForm,
      title: preset || "",
      type: preset && ["Locations", "Platforms"].includes(preset) ? "list"
          : preset && ["What you'll need"].includes(preset) ? "bullets"
          : preset && ["Rules"].includes(preset) ? "steps"
          : preset && ["How does it work?", "On Game Day"].includes(preset) ? "steps"
          : preset && ["Task Examples"].includes(preset) ? "checklist"
          : preset && ["Scoring"].includes(preset) ? "cards"
          : "text",
    };
    setOpenSectionForms((prev) => ({ ...prev, [key]: form }));
  }

  async function createSpecialSection(productId: string, preset: string) {
    const typeMap: Record<string, SectionType> = { Gallery: "gallery", Themes: "themes", Venue: "venue" };
    const sectionType = typeMap[preset];
    if (!sectionType) return;
    setActionLoading("saving-section");
    try {
      console.log(`[AdminProducts] Creating ${preset} section for ${productId}`);
      const res = await fetch(`${apiBase}/api/admin/products/${productId}/sections`, {
        method: "POST",
        headers: { "x-admin-key": authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ title: preset, type: sectionType }),
      });
      if (res.ok) {
        console.log(`[AdminProducts] ${preset} section created`);
        refreshProduct(productId);
      } else {
        console.error(`[AdminProducts] Failed to create ${preset} section:`, res.status);
      }
    } catch (err) {
      console.error(`[AdminProducts] Error creating ${preset} section:`, err);
    } finally {
      setActionLoading(null);
    }
  }

  function closeSectionForm(formKey: string) {
    setOpenSectionForms((prev) => {
      const next = { ...prev };
      delete next[formKey];
      return next;
    });
  }

  function updateSectionForm(formKey: string, updates: Partial<SectionForm>) {
    setOpenSectionForms((prev) => ({
      ...prev,
      [formKey]: { ...prev[formKey], ...updates },
    }));
  }

  function startEditProduct(product: Product) {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDesc: product.shortDesc || "",
      coverImage: product.coverImage || "",
      category: product.category,
      themes: product.themes || "",
      maxGroupSize: product.maxGroupSize ? String(product.maxGroupSize) : "",
      venue: product.venue || "",
      duration: product.duration || "",
      ticketLimit: product.ticketLimit ? String(product.ticketLimit) : "",
      displayOrder: product.displayOrder,
      isActive: product.isActive,
    });
    setShowProductForm(true);
  }

  function startEditPackage(pkg: Package, productId: string) {
    setEditingPackageId(pkg.id);
    let whatsIncludedText = "";
    if (pkg.includes) {
      try {
        const arr = JSON.parse(pkg.includes);
        whatsIncludedText = Array.isArray(arr) ? arr.join("\n") : pkg.includes;
      } catch {
        whatsIncludedText = pkg.includes;
      }
    }
    setPackageForm({
      name: pkg.name,
      slug: pkg.slug,
      description: pkg.description || "",
      duration: pkg.duration || "",
      bookingType: pkg.bookingType,
      minPlayers: pkg.minPlayers ? String(pkg.minPlayers) : "",
      maxPlayers: pkg.maxPlayers ? String(pkg.maxPlayers) : "",
      pricePerPerson: penceToPounds(pkg.pricePerPerson),
      flatPrice: penceToPounds(pkg.flatPrice),
      minReserve: penceToPounds(pkg.minReserve),
      additionalPlayerPrice: penceToPounds(pkg.additionalPlayerPrice),
      whatsIncluded: whatsIncludedText,
      displayOrder: pkg.displayOrder,
      isActive: pkg.isActive,
    });
    setShowPackageForm(productId);
  }

  function cancelProductForm() {
    setShowProductForm(false);
    setEditingProductId(null);
    setProductForm(emptyProductForm);
  }

  function cancelPackageForm() {
    setShowPackageForm(null);
    setEditingPackageId(null);
    setPackageForm(emptyPackageForm);
  }

  const activeCount = products.filter((p) => p.isActive).length;
  const totalPackages = products.reduce((sum, p) => sum + (p._count?.packages || 0), 0);

  function renderPackageFormFields(productId: string) {
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-gray-400 text-xs block mb-1">Name *</label>
            <input
              type="text"
              value={packageForm.name}
              onChange={(e) => {
                const name = e.target.value;
                setPackageForm((f) => ({
                  ...f,
                  name,
                  slug: editingPackageId ? f.slug : slugify(name),
                }));
              }}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              data-action="admin_package_form_name"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Slug *</label>
            <input
              type="text"
              value={packageForm.slug}
              onChange={(e) =>
                setPackageForm((f) => ({ ...f, slug: e.target.value }))
              }
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              data-action="admin_package_form_slug"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Duration</label>
            <input
              type="text"
              value={packageForm.duration}
              onChange={(e) =>
                setPackageForm((f) => ({ ...f, duration: e.target.value }))
              }
              placeholder="e.g. 2 hours"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              data-action="admin_package_form_duration"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Booking Type *</label>
            <select
              value={packageForm.bookingType}
              onChange={(e) =>
                setPackageForm((f) => ({ ...f, bookingType: e.target.value }))
              }
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              data-action="admin_package_form_booking_type"
            >
              <option value="PRIVATE">Private</option>
              <option value="PUBLIC">Public</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Min Players</label>
            <input
              type="number"
              value={packageForm.minPlayers}
              onChange={(e) =>
                setPackageForm((f) => ({ ...f, minPlayers: e.target.value }))
              }
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              data-action="admin_package_form_min_players"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Max Players</label>
            <input
              type="number"
              value={packageForm.maxPlayers}
              onChange={(e) =>
                setPackageForm((f) => ({ ...f, maxPlayers: e.target.value }))
              }
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              data-action="admin_package_form_max_players"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Price Per Person (GBP)</label>
            <input
              type="number"
              step="0.01"
              value={packageForm.pricePerPerson}
              onChange={(e) =>
                setPackageForm((f) => ({ ...f, pricePerPerson: e.target.value }))
              }
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              data-action="admin_package_form_price_per_person"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Flat Price (GBP)</label>
            <input
              type="number"
              step="0.01"
              value={packageForm.flatPrice}
              onChange={(e) =>
                setPackageForm((f) => ({ ...f, flatPrice: e.target.value }))
              }
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              data-action="admin_package_form_flat_price"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Min Reserve (GBP)</label>
            <input
              type="number"
              step="0.01"
              value={packageForm.minReserve}
              onChange={(e) =>
                setPackageForm((f) => ({ ...f, minReserve: e.target.value }))
              }
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              data-action="admin_package_form_min_reserve"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Additional Player Price (GBP)</label>
            <input
              type="number"
              step="0.01"
              value={packageForm.additionalPlayerPrice}
              onChange={(e) =>
                setPackageForm((f) => ({ ...f, additionalPlayerPrice: e.target.value }))
              }
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              data-action="admin_package_form_additional_player_price"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Display Order</label>
            <input
              type="number"
              value={packageForm.displayOrder}
              onChange={(e) =>
                setPackageForm((f) => ({
                  ...f,
                  displayOrder: parseInt(e.target.value) || 0,
                }))
              }
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              data-action="admin_package_form_display_order"
            />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <label className="text-gray-400 text-xs">Active</label>
            <button
              type="button"
              onClick={() =>
                setPackageForm((f) => ({ ...f, isActive: !f.isActive }))
              }
              className="text-2xl"
              data-action="admin_package_form_toggle_active"
            >
              {packageForm.isActive ? (
                <FaToggleOn className="text-emerald-400" />
              ) : (
                <FaToggleOff className="text-gray-600" />
              )}
            </button>
          </div>
          <div className="md:col-span-3">
            <label className="text-gray-400 text-xs block mb-1">Description</label>
            <textarea
              value={packageForm.description}
              onChange={(e) =>
                setPackageForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none resize-none"
              data-action="admin_package_form_description"
            />
          </div>
          <div className="md:col-span-3">
            <label className="text-gray-400 text-xs block mb-1">
              What&apos;s Included (one item per line)
            </label>
            <textarea
              value={packageForm.whatsIncluded}
              onChange={(e) =>
                setPackageForm((f) => ({ ...f, whatsIncluded: e.target.value }))
              }
              rows={3}
              placeholder={"Professional host\nAll equipment\nPrizes for winners"}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none resize-none"
              data-action="admin_package_form_whats_included"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => savePackage(productId)}
            disabled={
              !packageForm.name ||
              !packageForm.slug ||
              actionLoading === "saving-package"
            }
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition"
            data-action="admin_package_form_save"
          >
            <FaSave className="text-[10px]" />
            {actionLoading === "saving-package" ? "Saving..." : "Save Package"}
          </button>
          <button
            onClick={cancelPackageForm}
            className="text-gray-400 hover:text-white text-xs transition"
            data-action="admin_package_form_cancel_btn"
          >
            Cancel
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="p-8 text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Products</h1>
          <p className="text-gray-400 text-sm">
            {products.length} total &middot; {activeCount} active &middot;{" "}
            {totalPackages} packages
          </p>
        </div>
        <button
          onClick={() => {
            setEditingProductId(null);
            setProductForm(emptyProductForm);
            setShowProductForm(true);
          }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          data-action="admin_products_create"
        >
          <FaPlus className="text-xs" />
          Create Product
        </button>
      </div>

      {/* Create Product Form (top-level, only for new products) */}
      {showProductForm && !editingProductId && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Create Product</h2>
            <button onClick={cancelProductForm} className="text-gray-500 hover:text-white transition" data-action="admin_products_form_cancel">
              <FaTimes />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs block mb-1">Name *</label>
              <input type="text" value={productForm.name} onChange={(e) => { const name = e.target.value; setProductForm((f) => ({ ...f, name, slug: slugify(name) })); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" data-action="admin_products_form_name" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Slug *</label>
              <input type="text" value={productForm.slug} onChange={(e) => setProductForm((f) => ({ ...f, slug: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" data-action="admin_products_form_slug" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Category</label>
              <select value={productForm.category} onChange={(e) => setProductForm((f) => ({ ...f, category: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" data-action="admin_products_form_category">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <CoverImageField
                value={productForm.coverImage}
                onChange={(url) => setProductForm((f) => ({ ...f, coverImage: url }))}
                slug={productForm.slug}
                bgClass="bg-gray-800"
                cdnBase={cdnBase}
                storageFolder={storageFolder}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button onClick={saveProduct} disabled={!productForm.name || !productForm.slug || actionLoading === "saving-product"} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition" data-action="admin_products_form_save">
              <FaSave className="text-xs" />
              {actionLoading === "saving-product" ? "Saving..." : "Create Product"}
            </button>
            <button onClick={cancelProductForm} className="text-gray-400 hover:text-white px-4 py-2 text-sm transition" data-action="admin_products_form_cancel_btn">Cancel</button>
          </div>
        </div>
      )}

      {/* Product List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
            >
              {/* Product Row */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition"
                onClick={() =>
                  setExpandedId(expandedId === product.id ? null : product.id)
                }
                data-action={`admin_product_toggle_${product.slug}`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-gray-600 text-sm">
                    {expandedId === product.id ? (
                      <FaChevronDown />
                    ) : (
                      <FaChevronRight />
                    )}
                  </span>
                  {product.coverImage && (
                    <img
                      src={getImageUrl(product.coverImage, cdnBase, storageFolder)}
                      alt={product.name}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div>
                    <p className="font-medium text-sm">
                      {product.name}
                      <span
                        className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          product.isActive
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        product.category === "public-event"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-purple-500/20 text-purple-400"
                      }`}>
                        {product.category === "public-event" ? "Public" : "Private"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {product.category.replace(/-/g, " ")} &middot;{" "}
                      {product.packages?.length || 0} package
                      {(product.packages?.length || 0) !== 1 ? "s" : ""} &middot;{" "}
                      {product.images?.length || 0} gallery image
                      {(product.images?.length || 0) !== 1 ? "s" : ""}
                      {product.duration && <> &middot; {product.duration}</>}
                      {product.maxGroupSize && <> &middot; max {product.maxGroupSize}</>}
                    </p>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <ActionBar>
                    <ViewLinkBtn
                      href={`/events/${product.slug}`}
                      data-action={`admin_product_view_${product.slug}`}
                    />
                    <EditBtn
                      onClick={() => {
                        if (expandedId !== product.id) {
                          setExpandedId(product.id);
                        }
                        startEditProduct(product);
                        setShowEditProduct(showEditProduct === product.id ? null : product.id);
                      }}
                      data-action={`admin_product_edit_${product.slug}`}
                    />
                    <DuplicateBtn
                      onClick={() => duplicateProduct(product)}
                      disabled={actionLoading === product.id}
                      data-action={`admin_product_duplicate_${product.slug}`}
                    />
                    <ToggleBtn
                      isActive={product.isActive}
                      onClick={() => toggleActive(product.id)}
                      disabled={actionLoading === product.id}
                      data-action={`admin_product_toggle_active_${product.slug}`}
                    />
                    {deleteConfirm === product.id ? (
                      <>
                        <Button variant="danger" size="sm" onClick={() => deleteProduct(product.id)} data-action="admin_product_delete_confirm">
                          {actionLoading === product.id ? "Deleting..." : "Confirm"}
                        </Button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 hover:text-white text-[11px] px-2 py-1" data-action="admin_product_delete_cancel">Cancel</button>
                      </>
                    ) : (
                      <DeleteBtn
                        onClick={() => setDeleteConfirm(product.id)}
                        data-action={`admin_product_delete_${product.slug}`}
                      />
                    )}
                  </ActionBar>
                </div>
              </div>

              {/* Expanded - Edit, Packages, Gallery, Themes, Venue, Sections */}
              <div
                className={`grid transition-all duration-300 ease-in-out ${expandedId === product.id ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className={`overflow-hidden ${expandedId === product.id ? "" : "pointer-events-none"}`}>
                <div className="border-t border-gray-800 p-4 bg-gray-900/50">

                  {/* Edit Product */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <FaEdit className="text-emerald-400" />
                        Edit Product
                      </h3>
                      <button
                        onClick={() => {
                          if (showEditProduct !== product.id) startEditProduct(product);
                          setShowEditProduct(showEditProduct === product.id ? null : product.id);
                        }}
                        className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                        data-action={`admin_product_toggle_edit_${product.slug}`}
                      >
                        <FaEdit className="text-[10px]" />
                        {showEditProduct === product.id ? "Hide Edit Product" : "Edit Product"}
                      </button>
                    </div>

                    {showEditProduct === product.id && editingProductId === product.id && showProductForm && (
                      <div className="bg-gray-800 border border-emerald-500/30 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-gray-400 text-xs block mb-1">Name *</label>
                            <input type="text" value={productForm.name} onChange={(e) => { const name = e.target.value; setProductForm((f) => ({ ...f, name, slug: editingProductId ? f.slug : slugify(name) })); }} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" data-action="admin_products_form_name" />
                          </div>
                          <div>
                            <label className="text-gray-400 text-xs block mb-1">Slug *</label>
                            <input type="text" value={productForm.slug} onChange={(e) => setProductForm((f) => ({ ...f, slug: e.target.value }))} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" data-action="admin_products_form_slug" />
                          </div>
                          <div>
                            <label className="text-gray-400 text-xs block mb-1">Category</label>
                            <select value={productForm.category} onChange={(e) => setProductForm((f) => ({ ...f, category: e.target.value }))} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" data-action="admin_products_form_category">
                              {CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>
                              ))}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-gray-400 text-xs block mb-1">Short Description</label>
                            <input type="text" value={productForm.shortDesc} onChange={(e) => setProductForm((f) => ({ ...f, shortDesc: e.target.value }))} placeholder="Brief summary for cards/listings" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" data-action="admin_products_form_short_description" />
                          </div>
                          <div className="md:col-span-2">
                            <CoverImageField
                              value={productForm.coverImage}
                              onChange={(url) => setProductForm((f) => ({ ...f, coverImage: url }))}
                              slug={productForm.slug}
                              bgClass="bg-gray-950"
                              cdnBase={cdnBase}
                              storageFolder={storageFolder}
                            />
                          </div>
                          <div>
                            <label className="text-gray-400 text-xs block mb-1">Duration</label>
                            <input type="text" value={productForm.duration} onChange={(e) => setProductForm((f) => ({ ...f, duration: e.target.value }))} placeholder="2-3 hours" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" data-action="admin_products_form_duration" />
                          </div>
                          <div>
                            <label className="text-gray-400 text-xs block mb-1">Max Group Size</label>
                            <input type="number" value={productForm.maxGroupSize} onChange={(e) => setProductForm((f) => ({ ...f, maxGroupSize: e.target.value }))} placeholder="5000" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" data-action="admin_products_form_max_group" />
                          </div>
                          <div>
                            <label className="text-gray-400 text-xs block mb-1">Ticket Limit</label>
                            <input type="number" value={productForm.ticketLimit} onChange={(e) => setProductForm((f) => ({ ...f, ticketLimit: e.target.value }))} placeholder="100" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" data-action="admin_products_form_ticket_limit" />
                          </div>
                          <div>
                            <label className="text-gray-400 text-xs block mb-1">Display Order</label>
                            <input type="number" value={productForm.displayOrder} onChange={(e) => setProductForm((f) => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" data-action="admin_products_form_display_order" />
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="text-gray-400 text-xs">Active</label>
                            <button type="button" onClick={() => setProductForm((f) => ({ ...f, isActive: !f.isActive }))} className="text-xl" data-action="admin_products_form_toggle_active">
                              {productForm.isActive ? <FaToggleOn className="text-emerald-400" /> : <FaToggleOff className="text-gray-600" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-4">
                          <button onClick={saveProduct} disabled={!productForm.name || !productForm.slug || actionLoading === "saving-product"} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition" data-action="admin_products_form_save">
                            <FaSave className="text-[10px]" />
                            {actionLoading === "saving-product" ? "Saving..." : "Save Product"}
                          </button>
                          <button onClick={() => { cancelProductForm(); setShowEditProduct(null); }} className="text-gray-400 hover:text-white text-xs transition" data-action="admin_products_form_cancel_btn">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Listing Sections Management (unified - includes gallery, themes, venue) */}
                  <div className="mb-6 pt-4 border-t border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <FaListUl className="text-blue-400" />
                        Listing Sections ({product.sections?.length || 0})
                      </h3>
                      <div className="flex items-center gap-2">
                        {showSections === product.id && (
                          <button
                            onClick={() => formatAllPages(product)}
                            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                            title="Apply this section order and visibility to all other products"
                            data-action={`admin_format_all_pages_${product.slug}`}
                          >
                            <FaCopy className="text-[10px]" />
                            Format All Pages
                          </button>
                        )}
                        <button
                          onClick={() => setShowSections(showSections === product.id ? null : product.id)}
                          className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                          data-action={`admin_product_toggle_sections_${product.slug}`}
                        >
                          <FaListUl className="text-[10px]" />
                          {showSections === product.id ? "Hide Listing Sections" : "Manage Listing Sections"}
                        </button>
                      </div>
                    </div>

                    {showSections === product.id && (
                      <div className="space-y-3">
                        {/* Add Section buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => openNewSectionForm(product.id)}
                            disabled={!!openSectionForms[`new-${product.id}`]}
                            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
                            data-action={`admin_sections_add_custom_${product.slug}`}
                          >
                            <FaPlus className="text-[10px]" />
                            New Section
                          </button>
                          {SECTION_PRESETS.filter(
                            (preset) => {
                              const typeMap: Record<string, string> = { Gallery: "gallery", Themes: "themes", Venue: "venue" };
                              const specialType = typeMap[preset];
                              if (specialType) return !(product.sections || []).some((s) => s.type === specialType);
                              return !(product.sections || []).some((s) => s.title === preset);
                            }
                          ).map((preset) => (
                            <button
                              key={preset}
                              onClick={() => openNewSectionForm(product.id, preset)}
                              disabled={!!openSectionForms[`new-${product.id}`]}
                              className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-400 hover:text-blue-400 px-2.5 py-1 rounded-lg text-[10px] font-medium transition border border-gray-700"
                              data-action={`admin_sections_quick_add_${preset.toLowerCase().replace(/\s+/g, "_")}`}
                            >
                              <FaPlus className="text-[8px]" />
                              {preset}
                            </button>
                          ))}
                        </div>

                        {/* New Section Form (appears above existing sections) */}
                        {openSectionForms[`new-${product.id}`] && (() => {
                          const formKey = `new-${product.id}`;
                          const form = openSectionForms[formKey];
                          return (
                            <div className="bg-gray-800 border border-blue-500/50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-blue-400">New Section</h4>
                                <button onClick={() => closeSectionForm(formKey)} className="text-gray-500 hover:text-white transition" data-action="admin_section_form_cancel">
                                  <FaTimes className="text-sm" />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="text-gray-400 text-xs block mb-1">Title *</label>
                                  <input type="text" value={form.title} onChange={(e) => updateSectionForm(formKey, { title: e.target.value })} placeholder="e.g. How does it work?" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" data-action="admin_section_form_title" />
                                </div>
                                <div>
                                  <label className="text-gray-400 text-xs block mb-1">Type</label>
                                  <select value={form.type} onChange={(e) => updateSectionForm(formKey, { type: e.target.value as SectionType })} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" data-action="admin_section_form_type">
                                    <option value="text">Text (rich HTML)</option>
                                    <option value="list">List (tags/badges)</option>
                                    <option value="steps">Steps (numbered)</option>
                                    <option value="bullets">Bullets (list)</option>
                                    <option value="cards">Cards (categorised)</option>
                                    <option value="checklist">Checklist (task list)</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-gray-400 text-xs block mb-1">Display Order</label>
                                  <input type="number" value={form.displayOrder} onChange={(e) => updateSectionForm(formKey, { displayOrder: parseInt(e.target.value) || 0 })} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" data-action="admin_section_form_display_order" />
                                </div>
                                <div className="flex items-center gap-3 pt-5">
                                  <label className="text-gray-400 text-xs">Collapsible</label>
                                  <button type="button" onClick={() => updateSectionForm(formKey, { isCollapsible: !form.isCollapsible })} className="text-2xl" data-action="admin_section_form_toggle_collapsible">
                                    {form.isCollapsible ? <FaToggleOn className="text-blue-400" /> : <FaToggleOff className="text-gray-600" />}
                                  </button>
                                </div>
                                {form.type === "text" && (
                                  <div className="md:col-span-3">
                                    <label className="text-gray-400 text-xs block mb-1">Content (HTML)</label>
                                    <textarea value={form.content} onChange={(e) => updateSectionForm(formKey, { content: e.target.value })} rows={5} placeholder="<p>Your content here...</p>" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-blue-500 outline-none resize-none" data-action="admin_section_form_content" />
                                  </div>
                                )}
                                {["list", "steps", "bullets", "cards", "checklist"].includes(form.type) && (
                                  <div className="md:col-span-3">
                                    <label className="text-gray-400 text-xs block mb-1">
                                      {form.type === "steps" ? "Steps (one per line)" : form.type === "bullets" ? "Bullet items (one per line)" : form.type === "cards" ? "Cards (Category: detail, one per line)" : form.type === "checklist" ? "Tasks (Category: task description, one per line)" : "List Items (one per line)"}
                                    </label>
                                    <textarea value={form.listItems} onChange={(e) => updateSectionForm(formKey, { listItems: e.target.value })} rows={5} placeholder={form.type === "steps" ? "Enquire through our website\nReceive a product brochure\nChoose your package\nConfirm your booking" : form.type === "cards" ? "Location: Find a taxi serving coffee in Shoreditch\nPhoto: Create a human pyramid in Hyde Park\nVideo: Re-enact a famous movie scene" : "Item one\nItem two\nItem three"} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none resize-none" data-action="admin_section_form_list_items" />
                                    {form.listItems && (
                                      <div className={form.type === "cards" || form.type === "checklist" ? "space-y-1.5 mt-2" : "flex flex-wrap gap-1.5 mt-2"}>
                                        {form.listItems.split("\n").filter(Boolean).map((item, i) => (
                                          form.type === "steps" ? (
                                            <div key={i} className="flex items-start gap-2 text-[11px]">
                                              <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                                              <span className="text-gray-300">{item.trim()}</span>
                                            </div>
                                          ) : form.type === "cards" ? (
                                            <div key={i} className="flex items-start gap-2 text-[11px] bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
                                              {item.includes(":") ? (<><span className="text-red-400 font-semibold">{item.split(":")[0]}:</span><span className="text-gray-300">{item.split(":").slice(1).join(":")}</span></>) : <span className="text-gray-300">{item.trim()}</span>}
                                            </div>
                                          ) : form.type === "checklist" ? (
                                            <div key={i} className="flex items-start gap-2 text-[11px] bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                                              <span className="w-4 h-4 border border-amber-500 rounded flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-amber-400">{i + 1}</span>
                                              {item.includes(":") ? (<><span className="text-amber-400 font-semibold">{item.split(":")[0]}:</span><span className="text-gray-300">{item.split(":").slice(1).join(":")}</span></>) : <span className="text-gray-300">{item.trim()}</span>}
                                            </div>
                                          ) : form.type === "bullets" ? (
                                            <div key={i} className="flex items-start gap-2 text-[11px]">
                                              <span className="text-orange-400 mt-0.5">&#8226;</span>
                                              <span className="text-gray-300">{item.trim()}</span>
                                            </div>
                                          ) : (
                                            <span key={i} className="inline-flex items-center bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-medium">{item.trim()}</span>
                                          )
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-4">
                                <button onClick={() => saveSection(product.id, formKey)} disabled={!form.title || actionLoading === "saving-section"} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition" data-action="admin_section_form_save">
                                  <FaSave className="text-[10px]" />
                                  {actionLoading === "saving-section" ? "Saving..." : "Save Section"}
                                </button>
                                <button onClick={() => closeSectionForm(formKey)} className="text-gray-400 hover:text-white text-xs transition" data-action="admin_section_form_cancel_btn">Cancel</button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Sections List - each with inline editor below */}
                        {product.sections && product.sections.length > 0 ? (
                          <div className="space-y-2">
                            {product.sections.map((section, idx) => {
                              const formKey = String(section.id);
                              const isEditing = !!openSectionForms[formKey];
                              const isSpecial = ["gallery", "themes", "venue"].includes(section.type);
                              const sectionIcon = section.type === "gallery" ? <FaImage className="text-purple-400 text-xs" />
                                : section.type === "themes" ? <FaPalette className="text-yellow-400 text-xs" />
                                : section.type === "venue" ? <FaMapMarkerAlt className="text-rose-400 text-xs" />
                                : section.type === "text" ? <FaAlignLeft className="text-blue-400 text-xs" />
                                : section.type === "steps" ? <FaTags className="text-green-400 text-xs" />
                                : section.type === "cards" ? <FaTags className="text-red-400 text-xs" />
                                : section.type === "checklist" ? <FaCheck className="text-amber-400 text-xs" />
                                : <FaTags className="text-orange-400 text-xs" />;
                              const sectionBadge = section.type === "gallery" ? "bg-purple-500/20 text-purple-400"
                                : section.type === "themes" ? "bg-yellow-500/20 text-yellow-400"
                                : section.type === "venue" ? "bg-rose-500/20 text-rose-400"
                                : section.type === "text" ? "bg-blue-500/20 text-blue-400"
                                : section.type === "steps" ? "bg-green-500/20 text-green-400"
                                : section.type === "cards" ? "bg-red-500/20 text-red-400"
                                : section.type === "checklist" ? "bg-amber-500/20 text-amber-400"
                                : "bg-orange-500/20 text-orange-400";

                              return (
                                <div
                                  key={section.id}
                                  draggable
                                  onDragStart={(e) => {
                                    setDragSectionId(section.id);
                                    e.dataTransfer.effectAllowed = "move";
                                    e.dataTransfer.setData("text/plain", String(section.id));
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = "move";
                                    setDragOverSectionId(section.id);
                                  }}
                                  onDragLeave={() => {
                                    if (dragOverSectionId === section.id) setDragOverSectionId(null);
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (dragSectionId !== null) {
                                      dropSection(product.id, product.sections, dragSectionId, section.id);
                                    }
                                    setDragSectionId(null);
                                    setDragOverSectionId(null);
                                  }}
                                  onDragEnd={() => {
                                    setDragSectionId(null);
                                    setDragOverSectionId(null);
                                  }}
                                  className={`transition-all ${dragOverSectionId === section.id && dragSectionId !== section.id ? "border-t-2 border-blue-500" : ""} ${dragSectionId === section.id ? "opacity-40" : ""}`}
                                >
                                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 transition" title="Drag to reorder">
                                          <FaGripVertical className="text-xs" />
                                        </span>
                                        {sectionIcon}
                                        <p className="text-sm font-medium">{section.title}</p>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sectionBadge}`}>
                                          {section.type}
                                        </span>
                                        {!section.isCollapsible && (
                                          <span className="text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded">always visible</span>
                                        )}
                                        {section.type === "gallery" && (
                                          <span className="text-[10px] text-gray-500">({product.images?.length || 0} images)</span>
                                        )}
                                        {section.type === "themes" && (
                                          <span className="text-[10px] text-gray-500">({getThemesArray(product).length})</span>
                                        )}
                                        {section.type === "venue" && product.venue && (() => {
                                          const v = getVenueObj(product);
                                          return v.name ? <span className="text-[10px] text-gray-500">{v.name}</span> : null;
                                        })()}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => moveSectionUpDown(product.id, product.sections, idx, "up")}
                                          disabled={idx === 0}
                                          className="text-gray-500 hover:text-white disabled:opacity-20 transition"
                                          title="Move up"
                                          data-action={`admin_section_move_up_${section.id}`}
                                        >
                                          <FaArrowUp className="text-xs" />
                                        </button>
                                        <button
                                          onClick={() => moveSectionUpDown(product.id, product.sections, idx, "down")}
                                          disabled={idx === product.sections.length - 1}
                                          className="text-gray-500 hover:text-white disabled:opacity-20 transition"
                                          title="Move down"
                                          data-action={`admin_section_move_down_${section.id}`}
                                        >
                                          <FaArrowDown className="text-xs" />
                                        </button>
                                        <button
                                          onClick={() => toggleSectionCollapsible(product.id, section)}
                                          className={`${section.isCollapsible ? "text-gray-500 hover:text-amber-400" : "text-amber-400"} transition`}
                                          title={section.isCollapsible ? "Collapsible - click to make always visible" : "Always visible - click to make collapsible"}
                                          data-action={`admin_section_toggle_visible_${section.id}`}
                                        >
                                          {section.isCollapsible ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
                                        </button>
                                        {isSpecial ? (
                                          <button
                                            onClick={() => {
                                              if (section.type === "gallery") setShowGallery(showGallery === product.id ? null : product.id);
                                              else if (section.type === "themes") setShowThemes(showThemes === product.id ? null : product.id);
                                              else if (section.type === "venue") { if (showVenue === product.id) setShowVenue(null); else startEditVenue(product); }
                                            }}
                                            className={`${
                                              (section.type === "gallery" && showGallery === product.id) ||
                                              (section.type === "themes" && showThemes === product.id) ||
                                              (section.type === "venue" && showVenue === product.id)
                                                ? "text-blue-400" : "text-gray-500 hover:text-blue-400"
                                            } transition`}
                                            data-action={`admin_section_toggle_${section.id}`}
                                          >
                                            <FaEdit className="text-sm" />
                                          </button>
                                        ) : (
                                          <button onClick={() => isEditing ? closeSectionForm(formKey) : startEditSection(section)} className={`${isEditing ? "text-blue-400" : "text-gray-500 hover:text-blue-400"} transition`} data-action={`admin_section_edit_${section.id}`}>
                                            <FaEdit className="text-sm" />
                                          </button>
                                        )}
                                        <button onClick={() => setDeleteSectionConfirm(section.id)} className="text-gray-500 hover:text-red-400 transition" data-action={`admin_section_delete_${section.id}`}>
                                          <FaTrash className="text-xs" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Preview content for standard types (hidden when editing) */}
                                    {!isEditing && section.type === "text" && section.content && (
                                      <p className="text-xs text-gray-500 mt-1 truncate">
                                        {section.content.replace(/<[^>]+>/g, "").slice(0, 120)}...
                                      </p>
                                    )}
                                    {!isEditing && section.type === "list" && section.listItems && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {(() => {
                                          try {
                                            const items = JSON.parse(section.listItems);
                                            return Array.isArray(items) ? items.slice(0, 8).map((item: string, i: number) => (
                                              <span key={i} className="inline-flex items-center bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full text-[10px] font-medium">{item}</span>
                                            )) : null;
                                          } catch { return null; }
                                        })()}
                                        {(() => {
                                          try {
                                            const items = JSON.parse(section.listItems);
                                            return Array.isArray(items) && items.length > 8 ? (
                                              <span className="text-[10px] text-gray-500">+{items.length - 8} more</span>
                                            ) : null;
                                          } catch { return null; }
                                        })()}
                                      </div>
                                    )}

                                    {/* Preview for themes (collapsed - always visible) */}
                                    {section.type === "themes" && showThemes !== product.id && getThemesArray(product).length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mt-2">
                                        {getThemesArray(product).map((theme) => (
                                          <span key={theme} className="inline-flex items-center bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-medium">{theme}</span>
                                        ))}
                                      </div>
                                    )}

                                    {/* Preview for venue (collapsed - always visible) */}
                                    {section.type === "venue" && showVenue !== product.id && product.venue && (() => {
                                      const v = getVenueObj(product);
                                      return v.name ? (
                                        <p className="text-xs text-gray-400 mt-1">
                                          <span className="text-rose-400 font-medium">{v.name}</span>
                                          {v.address && <> - {v.address}</>}
                                        </p>
                                      ) : null;
                                    })()}

                                    {/* Preview for gallery (collapsed - thumbnail strip) */}
                                    {section.type === "gallery" && showGallery !== product.id && product.images && product.images.length > 0 && (
                                      <div className="flex gap-1 mt-2 overflow-hidden">
                                        {product.images.slice(0, 6).map((img, i) => (
                                          <img
                                            key={img.id}
                                            src={img.url.startsWith("http") ? img.url : `${cdnBase}/${storageFolder}/events/${img.url}`}
                                            alt={img.alt || `Image ${i + 1}`}
                                            className="w-10 h-10 rounded object-cover"
                                          />
                                        ))}
                                        {product.images.length > 6 && (
                                          <span className="text-[10px] text-gray-500 flex items-center">+{product.images.length - 6}</span>
                                        )}
                                      </div>
                                    )}

                                    {/* Delete confirmation */}
                                    {deleteSectionConfirm === section.id && (
                                      <div className="mt-3 pt-3 border-t border-gray-700">
                                        <p className="text-xs text-red-400 mb-2">Delete &quot;{section.title}&quot; section?</p>
                                        <div className="flex items-center gap-2">
                                          <button onClick={() => deleteSection(section.id, product.id)} disabled={actionLoading === `del-sec-${section.id}`} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium transition" data-action="admin_section_delete_confirm">
                                            {actionLoading === `del-sec-${section.id}` ? "Deleting..." : "Delete"}
                                          </button>
                                          <button onClick={() => setDeleteSectionConfirm(null)} className="text-gray-400 hover:text-white text-xs transition" data-action="admin_section_delete_cancel">Cancel</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* === GALLERY INLINE EDITOR === */}
                                  {section.type === "gallery" && showGallery === product.id && (
                                    <div className="bg-gray-800/50 border border-purple-500/30 rounded-lg p-4 mt-1 ml-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-purple-400">Manage Gallery</h4>
                                        <button onClick={() => { setShowGallery(null); setSelectedImages(new Set()); }} className="text-gray-500 hover:text-white transition" data-action="admin_gallery_close">
                                          <FaTimes className="text-sm" />
                                        </button>
                                      </div>
                                      {/* Add Image Form */}
                                      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 mb-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <p className="text-xs text-gray-400 font-medium">Add Images</p>
                                          <button
                                            onClick={() => galleryFileRef.current?.click()}
                                            disabled={galleryUploading}
                                            className="flex items-center gap-1.5 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 disabled:opacity-30 px-2.5 py-1 rounded-md text-[11px] font-medium transition"
                                            data-action="admin_gallery_upload_files"
                                          >
                                            <FaUpload className="text-[10px]" />
                                            {galleryUploading ? "Uploading..." : "Upload Files"}
                                          </button>
                                          <input
                                            ref={galleryFileRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={(e) => {
                                              if (e.target.files?.length) uploadGalleryImages(product.id, e.target.files);
                                            }}
                                            className="hidden"
                                          />
                                        </div>
                                        <div className="flex gap-2">
                                          <input type="text" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="Or paste image URL" className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 outline-none" data-action="admin_gallery_image_url" />
                                          <input type="text" value={newImageAlt} onChange={(e) => setNewImageAlt(e.target.value)} placeholder="Alt text (optional)" className="w-40 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 outline-none" data-action="admin_gallery_image_alt" />
                                          <button onClick={() => addGalleryImage(product.id)} disabled={!newImageUrl.trim() || actionLoading === "adding-image"} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-2 rounded-lg text-xs font-medium transition" data-action="admin_gallery_add_image">
                                            <FaPlus className="text-[10px]" />
                                            Add
                                          </button>
                                        </div>
                                      </div>
                                      {/* Image Grid */}
                                      {product.images && product.images.length > 0 ? (
                                        <>
                                          {/* Selection toolbar */}
                                          <div className="flex items-center gap-2 mb-2">
                                            <button
                                              onClick={() => {
                                                const allIds = new Set(product.images.map((img) => img.id));
                                                const allSelected = product.images.every((img) => selectedImages.has(img.id));
                                                setSelectedImages(allSelected ? new Set() : allIds);
                                              }}
                                              className="text-[11px] text-gray-400 hover:text-white transition"
                                              data-action="admin_gallery_select_all"
                                            >
                                              {product.images.every((img) => selectedImages.has(img.id)) ? "Deselect All" : "Select All"}
                                            </button>
                                            {selectedImages.size > 0 && (
                                              <>
                                                <span className="text-[11px] text-gray-500">{selectedImages.size} selected</span>
                                                <button
                                                  onClick={deleteSelectedImages}
                                                  disabled={actionLoading === "batch-delete"}
                                                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-30 transition"
                                                  data-action="admin_gallery_delete_selected"
                                                >
                                                  <FaTrash className="text-[9px]" />
                                                  {actionLoading === "batch-delete" ? "Deleting..." : "Delete Selected"}
                                                </button>
                                              </>
                                            )}
                                          </div>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {product.images.map((img, imgIdx) => {
                                              const isSelected = selectedImages.has(img.id);
                                              return (
                                                <div
                                                  key={img.id}
                                                  className={`relative group bg-gray-900 rounded-lg overflow-hidden cursor-pointer border-2 transition ${
                                                    isSelected ? "border-red-500" : "border-gray-700 hover:border-gray-600"
                                                  }`}
                                                  onClick={() => {
                                                    setSelectedImages((prev) => {
                                                      const next = new Set(prev);
                                                      if (next.has(img.id)) next.delete(img.id);
                                                      else next.add(img.id);
                                                      return next;
                                                    });
                                                  }}
                                                >
                                                  <div className="aspect-video relative">
                                                    <img src={img.url.startsWith("http") ? img.url : `${cdnBase}/${storageFolder}/events/${img.url}`} alt={img.alt || `Image ${imgIdx + 1}`} className="w-full h-full object-cover" />
                                                    {/* Selection checkbox */}
                                                    <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                                                      isSelected ? "bg-red-500 border-red-500" : "border-white/50 bg-black/30 opacity-0 group-hover:opacity-100"
                                                    }`}>
                                                      {isSelected && <FaCheck className="text-white text-[8px]" />}
                                                    </div>
                                                    {/* Action buttons */}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                      <button onClick={() => reorderGalleryImage(product.id, product.images, img.id, "up")} disabled={imgIdx === 0} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white p-1.5 rounded transition" title="Move up" data-action={`admin_gallery_move_up_${img.id}`}><FaArrowUp className="text-xs" /></button>
                                                      <button onClick={() => reorderGalleryImage(product.id, product.images, img.id, "down")} disabled={imgIdx === product.images.length - 1} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white p-1.5 rounded transition" title="Move down" data-action={`admin_gallery_move_down_${img.id}`}><FaArrowDown className="text-xs" /></button>
                                                      <button onClick={() => rotateGalleryImage(img.id, 90)} disabled={actionLoading === `rotate-img-${img.id}`} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white p-1.5 rounded transition" title="Rotate 90° clockwise" data-action={`admin_gallery_rotate_${img.id}`}>{actionLoading === `rotate-img-${img.id}` ? <span className="text-[9px] animate-spin">&#8635;</span> : <FaRedo className="text-xs" />}</button>
                                                      <button onClick={() => deleteGalleryImage(img.id)} disabled={actionLoading === `del-img-${img.id}`} className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded transition" title="Delete" data-action={`admin_gallery_delete_${img.id}`}><FaTrash className="text-xs" /></button>
                                                    </div>
                                                  </div>
                                                  <div className="px-2 py-1"><p className="text-[10px] text-gray-500 truncate">#{imgIdx + 1} {img.alt || img.url.split("/").pop()}</p></div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </>
                                      ) : (
                                        <p className="text-gray-600 text-xs text-center py-4">No gallery images yet. Add some above.</p>
                                      )}
                                    </div>
                                  )}

                                  {/* === THEMES INLINE EDITOR === */}
                                  {section.type === "themes" && showThemes === product.id && (
                                    <div className="bg-gray-800/50 border border-yellow-500/30 rounded-lg p-4 mt-1 ml-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-yellow-400">Manage Themes</h4>
                                        <button onClick={() => setShowThemes(null)} className="text-gray-500 hover:text-white transition" data-action="admin_themes_close">
                                          <FaTimes className="text-sm" />
                                        </button>
                                      </div>
                                      <div className="flex gap-2 mb-3">
                                        <input type="text" value={newTheme} onChange={(e) => setNewTheme(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTheme(product.id, product); } }} placeholder="Add a theme (e.g. Halloween)" className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-yellow-500 outline-none" data-action="admin_themes_input" />
                                        <button onClick={() => addTheme(product.id, product)} disabled={!newTheme.trim() || actionLoading === "saving-themes"} className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-2 rounded-lg text-xs font-medium transition" data-action="admin_themes_add">
                                          <FaPlus className="text-[10px]" />
                                          Add
                                        </button>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {getThemesArray(product).map((theme) => (
                                          <span key={theme} className="inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 rounded-full text-xs font-medium">
                                            {theme}
                                            <button onClick={() => removeTheme(product.id, product, theme)} className="text-yellow-600 hover:text-red-400 transition" data-action={`admin_themes_remove_${theme}`}>
                                              <FaTimes className="text-[8px]" />
                                            </button>
                                          </span>
                                        ))}
                                        {getThemesArray(product).length === 0 && (
                                          <p className="text-gray-600 text-xs">No themes yet. Add one above.</p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* === VENUE INLINE EDITOR === */}
                                  {section.type === "venue" && showVenue === product.id && (
                                    <div className="bg-gray-800/50 border border-rose-500/30 rounded-lg p-4 mt-1 ml-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-rose-400">Manage Venue</h4>
                                        <button onClick={() => setShowVenue(null)} className="text-gray-500 hover:text-white transition" data-action="admin_venue_close">
                                          <FaTimes className="text-sm" />
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                          <label className="text-gray-400 text-xs block mb-1">Venue Name</label>
                                          <input type="text" value={venueForm.name} onChange={(e) => setVenueForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Golden Square" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-rose-500 outline-none" data-action="admin_venue_name" />
                                        </div>
                                        <div>
                                          <label className="text-gray-400 text-xs block mb-1">Address</label>
                                          <input type="text" value={venueForm.address} onChange={(e) => setVenueForm((f) => ({ ...f, address: e.target.value }))} placeholder="e.g. Brewer St, Soho, London W1F 9HR" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-rose-500 outline-none" data-action="admin_venue_address" />
                                        </div>
                                        <div>
                                          <label className="text-gray-400 text-xs block mb-1">Latitude</label>
                                          <input type="text" value={venueForm.lat} onChange={(e) => setVenueForm((f) => ({ ...f, lat: e.target.value }))} placeholder="51.5116145" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-rose-500 outline-none" data-action="admin_venue_lat" />
                                        </div>
                                        <div>
                                          <label className="text-gray-400 text-xs block mb-1">Longitude</label>
                                          <input type="text" value={venueForm.lng} onChange={(e) => setVenueForm((f) => ({ ...f, lng: e.target.value }))} placeholder="-0.1354104" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-rose-500 outline-none" data-action="admin_venue_lng" />
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 mt-4">
                                        <button onClick={() => saveVenue(product.id)} disabled={actionLoading === "saving-venue"} className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition" data-action="admin_venue_save">
                                          <FaSave className="text-[10px]" />
                                          {actionLoading === "saving-venue" ? "Saving..." : "Save Venue"}
                                        </button>
                                        <button onClick={() => setShowVenue(null)} className="text-gray-400 hover:text-white text-xs transition" data-action="admin_venue_cancel">Cancel</button>
                                      </div>
                                    </div>
                                  )}

                                  {/* === STANDARD SECTION INLINE EDITOR === */}
                                  {!isSpecial && isEditing && (() => {
                                    const form = openSectionForms[formKey];
                                    return (
                                      <div className="bg-gray-800/50 border border-blue-500/30 rounded-lg p-4 mt-1 ml-4">
                                        <div className="flex items-center justify-between mb-3">
                                          <h4 className="text-sm font-semibold text-blue-400">Edit: {section.title}</h4>
                                          <button onClick={() => closeSectionForm(formKey)} className="text-gray-500 hover:text-white transition" data-action={`admin_section_edit_cancel_${section.id}`}>
                                            <FaTimes className="text-sm" />
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                          <div>
                                            <label className="text-gray-400 text-xs block mb-1">Title *</label>
                                            <input type="text" value={form.title} onChange={(e) => updateSectionForm(formKey, { title: e.target.value })} placeholder="e.g. How does it work?" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                                          </div>
                                          <div>
                                            <label className="text-gray-400 text-xs block mb-1">Type</label>
                                            <select value={form.type} onChange={(e) => updateSectionForm(formKey, { type: e.target.value as SectionType })} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none">
                                              <option value="text">Text (rich HTML)</option>
                                              <option value="list">List (tags/badges)</option>
                                              <option value="steps">Steps (numbered)</option>
                                              <option value="bullets">Bullets (list)</option>
                                              <option value="cards">Cards (categorised)</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-gray-400 text-xs block mb-1">Display Order</label>
                                            <input type="number" value={form.displayOrder} onChange={(e) => updateSectionForm(formKey, { displayOrder: parseInt(e.target.value) || 0 })} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                                          </div>
                                          {form.type === "text" && (
                                            <div className="md:col-span-3">
                                              <label className="text-gray-400 text-xs block mb-1">Content (HTML)</label>
                                              <textarea value={form.content} onChange={(e) => updateSectionForm(formKey, { content: e.target.value })} rows={5} placeholder="<p>Your content here...</p>" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-blue-500 outline-none resize-none" />
                                            </div>
                                          )}
                                          {["list", "steps", "bullets", "cards", "checklist"].includes(form.type) && (
                                            <div className="md:col-span-3">
                                              <label className="text-gray-400 text-xs block mb-1">
                                                {form.type === "steps" ? "Steps (one per line)" : form.type === "bullets" ? "Bullet items (one per line)" : form.type === "cards" ? "Cards (Category: detail, one per line)" : form.type === "checklist" ? "Tasks (Category: task description, one per line)" : "List Items (one per line)"}
                                              </label>
                                              <textarea value={form.listItems} onChange={(e) => updateSectionForm(formKey, { listItems: e.target.value })} rows={5} placeholder={form.type === "steps" ? "Enquire through our website\nReceive a product brochure" : form.type === "cards" ? "Location: Find a taxi serving coffee\nPhoto: Create a human pyramid" : "Item one\nItem two"} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none resize-none" />
                                              {form.listItems && (
                                                <div className={form.type === "cards" ? "space-y-1.5 mt-2" : "flex flex-wrap gap-1.5 mt-2"}>
                                                  {form.listItems.split("\n").filter(Boolean).map((item, i) => (
                                                    form.type === "steps" ? (
                                                      <div key={i} className="flex items-start gap-2 text-[11px]">
                                                        <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                                                        <span className="text-gray-300">{item.trim()}</span>
                                                      </div>
                                                    ) : form.type === "cards" ? (
                                                      <div key={i} className="flex items-start gap-2 text-[11px] bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
                                                        {item.includes(":") ? (<><span className="text-red-400 font-semibold">{item.split(":")[0]}:</span><span className="text-gray-300">{item.split(":").slice(1).join(":")}</span></>) : <span className="text-gray-300">{item.trim()}</span>}
                                                      </div>
                                                    ) : form.type === "bullets" ? (
                                                      <div key={i} className="flex items-start gap-2 text-[11px]">
                                                        <span className="text-orange-400 mt-0.5">&#8226;</span>
                                                        <span className="text-gray-300">{item.trim()}</span>
                                                      </div>
                                                    ) : (
                                                      <span key={i} className="inline-flex items-center bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-medium">{item.trim()}</span>
                                                    )
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-4">
                                          <button onClick={() => saveSection(product.id, formKey)} disabled={!form.title || actionLoading === "saving-section"} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition" data-action={`admin_section_save_${section.id}`}>
                                            <FaSave className="text-[10px]" />
                                            {actionLoading === "saving-section" ? "Saving..." : "Save"}
                                          </button>
                                          <button onClick={() => closeSectionForm(formKey)} className="text-gray-400 hover:text-white text-xs transition">Cancel</button>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs text-center py-4">
                            No sections yet. Add one above or use the quick-add presets.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Booking Configuration */}
                  <div className="mb-6 pt-4 border-t border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <FaTicketAlt className="text-emerald-400" />
                        Booking Configuration ({bookingConfig.bookingSections.length})
                      </h3>
                      <div className="flex items-center gap-2">
                        {showBookingSections && (
                          <button
                            onClick={resetBookingSectionsToDefault}
                            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                            title="Reset all booking sections to the default configuration"
                            data-action={`admin_booking_sections_reset_${product.slug}`}
                          >
                            <FaCopy className="text-[10px]" />
                            Reset to Defaults
                          </button>
                        )}
                        <button
                          onClick={() => setShowBookingSections(!showBookingSections)}
                          className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                          data-action={`admin_booking_sections_toggle_${product.slug}`}
                        >
                          <FaListUl className="text-[10px]" />
                          {showBookingSections ? "Hide Booking Sections" : "Manage Booking Sections"}
                        </button>
                      </div>
                    </div>

                    {/* Summary view (shown when sections editor is closed) */}
                    {!showBookingSections && (
                      <>
                        <div className="flex flex-wrap gap-2 text-xs mb-3">
                          {bookingConfig.pricingFields.map((field) => (
                            <div key={field.id} className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-center min-w-[80px]">
                              <p className="text-gray-500 text-[9px] uppercase">{field.label}</p>
                              <p className="text-white font-bold">
                                {field.id === "min-players" ? field.value : `${field.category === "addon" ? "+" : ""}\u00A3${field.value}${field.perPerson ? "/pp" : ""}`}
                              </p>
                            </div>
                          ))}
                          {bookingConfig.travelZones.length > 0 && (
                            <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-center min-w-[80px]">
                              <p className="text-gray-500 text-[9px] uppercase">Travel zones</p>
                              <p className="text-white font-bold">{bookingConfig.travelZones.length}</p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 mb-3">
                          {[...bookingConfig.bookingSections].sort((a, b) => a.order - b.order).map((sec) => (
                            <div key={sec.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-gray-900/50">
                              <span className="text-gray-600 font-mono w-4 text-right">{sec.order}</span>
                              <span className="text-gray-500 w-4 text-center">{sec.icon ? "\u25CF" : "\u25CB"}</span>
                              <span className="text-gray-300 flex-1">{sec.title}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${sec.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-700 text-gray-500"}`}>
                                {sec.enabled ? "ON" : "OFF"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Booking Sections editor (matching Listing Sections pattern) */}
                    {showBookingSections && (
                      <div className="space-y-3">
                        {/* Quick-add buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setNewBookingSectionForm({ id: "", title: "", icon: "" })}
                            disabled={!!newBookingSectionForm}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
                            data-action="admin_booking_section_add_custom"
                          >
                            <FaPlus className="text-[10px]" />
                            New Section
                          </button>
                          {BOOKING_SECTION_PRESETS.filter(
                            (preset) => !bookingConfig.bookingSections.some((s) => s.id === preset.id)
                          ).map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => addBookingSection(preset)}
                              className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-emerald-400 px-2.5 py-1 rounded-lg text-[10px] font-medium transition border border-gray-700"
                              data-action={`admin_booking_section_quick_add_${preset.id}`}
                            >
                              <FaPlus className="text-[8px]" />
                              {preset.title}
                            </button>
                          ))}
                        </div>

                        {/* New Section Form */}
                        {newBookingSectionForm && (
                          <div className="bg-gray-800 border border-emerald-500/50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-emerald-400">New Booking Section</h4>
                              <button onClick={() => setNewBookingSectionForm(null)} className="text-gray-500 hover:text-white transition" data-action="admin_booking_section_form_cancel">
                                <FaTimes className="text-sm" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="text-gray-400 text-xs block mb-1">Section ID *</label>
                                <input type="text" value={newBookingSectionForm.id} onChange={(e) => setNewBookingSectionForm({ ...newBookingSectionForm, id: e.target.value.toLowerCase().replace(/\s+/g, "-") })} placeholder="e.g. dietary-requirements" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 outline-none" data-action="admin_booking_section_form_id" />
                              </div>
                              <div>
                                <label className="text-gray-400 text-xs block mb-1">Title *</label>
                                <input type="text" value={newBookingSectionForm.title} onChange={(e) => setNewBookingSectionForm({ ...newBookingSectionForm, title: e.target.value })} placeholder="e.g. Dietary Requirements" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" data-action="admin_booking_section_form_title" />
                              </div>
                              <div>
                                <label className="text-gray-400 text-xs block mb-1">Icon (React Icon name)</label>
                                <input type="text" value={newBookingSectionForm.icon} onChange={(e) => setNewBookingSectionForm({ ...newBookingSectionForm, icon: e.target.value })} placeholder="e.g. FaUtensils" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 outline-none" data-action="admin_booking_section_form_icon" />
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-4">
                              <button
                                onClick={addCustomBookingSection}
                                disabled={!newBookingSectionForm.id || !newBookingSectionForm.title || bookingConfig.bookingSections.some((s) => s.id === newBookingSectionForm.id)}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition"
                                data-action="admin_booking_section_form_save"
                              >
                                <FaSave className="text-[10px]" />
                                Add Section
                              </button>
                              <button onClick={() => setNewBookingSectionForm(null)} className="text-gray-400 hover:text-white text-xs transition" data-action="admin_booking_section_form_cancel_btn">Cancel</button>
                              {bookingConfig.bookingSections.some((s) => s.id === newBookingSectionForm.id) && newBookingSectionForm.id && (
                                <span className="text-red-400 text-xs">Section ID already exists</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Sections List with drag-and-drop, inline editors, and delete */}
                        {bookingConfig.bookingSections.length > 0 ? (
                          <div className="space-y-2">
                            {[...bookingConfig.bookingSections].sort((a, b) => a.order - b.order).map((sec, idx) => {
                              const isExpanded = expandedBookingSection === sec.id;
                              const isPreset = BOOKING_SECTION_PRESETS.some((p) => p.id === sec.id);
                              return (
                                <div
                                  key={sec.id}
                                  draggable
                                  onDragStart={(e) => {
                                    setDragBookingSectionId(sec.id);
                                    e.dataTransfer.effectAllowed = "move";
                                    e.dataTransfer.setData("text/plain", sec.id);
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = "move";
                                    setDragOverBookingSectionId(sec.id);
                                  }}
                                  onDragLeave={() => {
                                    if (dragOverBookingSectionId === sec.id) setDragOverBookingSectionId(null);
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (dragBookingSectionId) {
                                      dropBookingSection(dragBookingSectionId, sec.id);
                                    }
                                    setDragBookingSectionId(null);
                                    setDragOverBookingSectionId(null);
                                  }}
                                  onDragEnd={() => {
                                    setDragBookingSectionId(null);
                                    setDragOverBookingSectionId(null);
                                  }}
                                  className={`transition-all ${dragOverBookingSectionId === sec.id && dragBookingSectionId !== sec.id ? "border-t-2 border-emerald-500" : ""} ${dragBookingSectionId === sec.id ? "opacity-40" : ""}`}
                                >
                                  <div className={`border rounded-lg transition ${isExpanded ? "border-emerald-500/50 bg-gray-800" : "border-gray-700 bg-gray-800/50"}`}>
                                    {/* Section row */}
                                    <div className="flex items-center gap-2 px-3 py-2">
                                      <span className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 transition" title="Drag to reorder">
                                        <FaGripVertical className="text-xs" />
                                      </span>
                                      <span className="text-gray-600 font-mono text-xs w-4 text-right">{sec.order}</span>
                                      <span className="text-gray-400 text-xs flex-1 font-medium">{sec.title}</span>
                                      {isPreset && (
                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">preset</span>
                                      )}
                                      {!isPreset && (
                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400">custom</span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => toggleBookingSectionEnabled(sec.id)}
                                        className="text-xl"
                                        data-action={`admin_booking_section_toggle_${sec.id}`}
                                      >
                                        {sec.enabled ? <FaToggleOn className="text-emerald-400" /> : <FaToggleOff className="text-gray-600" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setExpandedBookingSection(isExpanded ? null : sec.id)}
                                        className={`${isExpanded ? "text-emerald-400" : "text-gray-500 hover:text-emerald-400"} transition`}
                                        data-action={`admin_booking_section_edit_${sec.id}`}
                                      >
                                        <FaEdit className="text-sm" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteBookingSectionConfirm(sec.id)}
                                        className="text-gray-500 hover:text-red-400 transition"
                                        data-action={`admin_booking_section_delete_${sec.id}`}
                                      >
                                        <FaTrash className="text-xs" />
                                      </button>
                                    </div>

                                    {/* Delete confirmation */}
                                    {deleteBookingSectionConfirm === sec.id && (
                                      <div className="px-3 pb-3 pt-1 border-t border-gray-700">
                                        <p className="text-xs text-red-400 mb-2">Remove &quot;{sec.title}&quot; from booking form?</p>
                                        <div className="flex items-center gap-2">
                                          <button onClick={() => removeBookingSection(sec.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium transition" data-action="admin_booking_section_delete_confirm">
                                            Remove
                                          </button>
                                          <button onClick={() => setDeleteBookingSectionConfirm(null)} className="text-gray-400 hover:text-white text-xs transition" data-action="admin_booking_section_delete_cancel">Cancel</button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Expanded section editor */}
                                    {isExpanded && (
                                      <div className="px-3 pb-3 pt-1 border-t border-gray-700 space-y-3 animate-fade-in">
                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <label className="text-gray-400 text-xs block mb-1">Title</label>
                                            <input type="text" value={sec.title} onChange={(e) => updateBookingSectionField(sec.id, "title", e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" data-action={`admin_booking_section_title_${sec.id}`} />
                                          </div>
                                          <div>
                                            <label className="text-gray-400 text-xs block mb-1">Description</label>
                                            <input type="text" value={sec.description || ""} onChange={(e) => updateBookingSectionField(sec.id, "description", e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" placeholder="Optional description text" data-action={`admin_booking_section_desc_${sec.id}`} />
                                          </div>
                                        </div>

                                        {/* Field Groups */}
                                        <div>
                                          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Fields</p>
                                          <div className="space-y-1">
                                            {getFieldGroups(sec.id).map((fg) => {
                                              const fgKey = `${sec.id}::${fg.id}`;
                                              const isFgExpanded = expandedFieldGroup === fgKey;
                                              return (
                                                <div key={fg.id} className={`border rounded-lg transition ${isFgExpanded ? "border-emerald-500/30 bg-gray-800/80" : "border-gray-700/50 bg-gray-800/30"}`}>
                                                  <div className="flex items-center gap-2 px-2.5 py-1.5">
                                                    <button type="button" onClick={() => updateFieldGroup(sec.id, fg.id, { enabled: !fg.enabled })} className="text-base">
                                                      {fg.enabled ? <FaToggleOn className="text-emerald-400" /> : <FaToggleOff className="text-gray-600" />}
                                                    </button>
                                                    <input type="text" value={fg.label} onChange={(e) => updateFieldGroup(sec.id, fg.id, { label: e.target.value })} className="flex-1 bg-transparent border-none text-xs text-gray-300 focus:text-white outline-none px-0" />
                                                    <button type="button" onClick={() => setExpandedFieldGroup(isFgExpanded ? null : fgKey)} className={`${isFgExpanded ? "text-emerald-400" : "text-gray-600 hover:text-gray-400"} transition`}>
                                                      <FaEdit className="text-[10px]" />
                                                    </button>
                                                    <button type="button" onClick={() => removeFieldGroup(sec.id, fg.id)} className="text-gray-600 hover:text-red-400 transition">
                                                      <FaTrash className="text-[10px]" />
                                                    </button>
                                                  </div>

                                                  {/* Field group editor */}
                                                  {isFgExpanded && (
                                                    <div className="px-2.5 pb-2.5 pt-1 border-t border-gray-700/50 space-y-2 animate-fade-in">
                                                      {/* whats-included */}
                                                      {fg.id === "whats-included" && (
                                                        <textarea value={bookingConfig.whatsIncluded} onChange={(e) => setBookingConfig({ ...bookingConfig, whatsIncluded: e.target.value })} rows={4} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none resize-none" placeholder="One item per line..." />
                                                      )}
                                                      {/* first-place-prizes */}
                                                      {fg.id === "first-place-prizes" && (
                                                        <div className="space-y-1.5">
                                                          {listParseItems(bookingConfig.firstPlacePrizes).map((item, i) => (
                                                            <div key={i} className="flex items-center gap-2">
                                                              <input type="text" value={item.value} onChange={(e) => setBookingConfig({ ...bookingConfig, firstPlacePrizes: listUpdateItem(bookingConfig.firstPlacePrizes, i, e.target.value, item.label) })} className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-emerald-500 outline-none" placeholder="value" />
                                                              <input type="text" value={item.label} onChange={(e) => setBookingConfig({ ...bookingConfig, firstPlacePrizes: listUpdateItem(bookingConfig.firstPlacePrizes, i, item.value, e.target.value) })} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" placeholder="Label" />
                                                              <button type="button" onClick={() => setBookingConfig({ ...bookingConfig, firstPlacePrizes: listRemoveItem(bookingConfig.firstPlacePrizes, i) })} className="text-gray-500 hover:text-red-400 transition text-xs"><FaTrash /></button>
                                                            </div>
                                                          ))}
                                                          <button type="button" onClick={() => setBookingConfig({ ...bookingConfig, firstPlacePrizes: listAddItem(bookingConfig.firstPlacePrizes, "new-prize", "New Prize") })} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition"><FaPlus className="text-[8px]" /> Add prize</button>
                                                        </div>
                                                      )}
                                                      {/* base-pricing */}
                                                      {fg.id === "base-pricing" && (
                                                        <div className="space-y-1.5">
                                                          {bookingConfig.pricingFields.filter((f) => f.category === "base").map((field) => (
                                                            <div key={field.id} className="flex items-center gap-2">
                                                              <input type="text" value={field.label} onChange={(e) => updatePricingField(field.id, { label: e.target.value })} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                              <input type="number" step="0.01" value={field.value} onChange={(e) => updatePricingField(field.id, { value: e.target.value })} className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                              <button type="button" onClick={() => updatePricingField(field.id, { perPerson: !field.perPerson })} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${field.perPerson ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-700 text-gray-500"}`}>/pp</button>
                                                              <button type="button" onClick={() => updatePricingField(field.id, { mandatory: !field.mandatory })} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${field.mandatory ? "bg-amber-500/20 text-amber-400" : "bg-gray-700 text-gray-500"}`}>fixed</button>
                                                              <button type="button" onClick={() => removePricingField(field.id)} className="text-gray-500 hover:text-red-400 transition text-xs"><FaTrash /></button>
                                                            </div>
                                                          ))}
                                                          <button type="button" onClick={() => addPricingField("base")} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition"><FaPlus className="text-[8px]" /> Add field</button>
                                                        </div>
                                                      )}
                                                      {/* addon-pricing */}
                                                      {fg.id === "addon-pricing" && (
                                                        <div className="space-y-1.5">
                                                          {bookingConfig.pricingFields.filter((f) => f.category === "addon").map((field) => (
                                                            <div key={field.id} className="flex items-center gap-2">
                                                              <input type="text" value={field.label} onChange={(e) => updatePricingField(field.id, { label: e.target.value })} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                              <input type="number" step="0.01" value={field.value} onChange={(e) => updatePricingField(field.id, { value: e.target.value })} className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                              <button type="button" onClick={() => updatePricingField(field.id, { perPerson: !field.perPerson })} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${field.perPerson ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-700 text-gray-500"}`}>/pp</button>
                                                              <button type="button" onClick={() => updatePricingField(field.id, { mandatory: !field.mandatory })} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${field.mandatory ? "bg-amber-500/20 text-amber-400" : "bg-gray-700 text-gray-500"}`}>fixed</button>
                                                              <button type="button" onClick={() => removePricingField(field.id)} className="text-gray-500 hover:text-red-400 transition text-xs"><FaTrash /></button>
                                                            </div>
                                                          ))}
                                                          <button type="button" onClick={() => addPricingField("addon")} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition"><FaPlus className="text-[8px]" /> Add field</button>
                                                        </div>
                                                      )}
                                                      {/* group-types */}
                                                      {fg.id === "group-types" && (
                                                        <div className="space-y-1.5">
                                                          {listParseItems(bookingConfig.groupTypes).map((item, i) => (
                                                            <div key={i} className="flex items-center gap-2">
                                                              <input type="text" value={item.value} onChange={(e) => setBookingConfig({ ...bookingConfig, groupTypes: listUpdateItem(bookingConfig.groupTypes, i, e.target.value, item.label) })} className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-emerald-500 outline-none" />
                                                              <input type="text" value={item.label} onChange={(e) => setBookingConfig({ ...bookingConfig, groupTypes: listUpdateItem(bookingConfig.groupTypes, i, item.value, e.target.value) })} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                              <button type="button" onClick={() => setBookingConfig({ ...bookingConfig, groupTypes: listRemoveItem(bookingConfig.groupTypes, i) })} className="text-gray-500 hover:text-red-400 transition text-xs"><FaTrash /></button>
                                                            </div>
                                                          ))}
                                                          <button type="button" onClick={() => setBookingConfig({ ...bookingConfig, groupTypes: listAddItem(bookingConfig.groupTypes, "new-type", "New Type") })} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition"><FaPlus className="text-[8px]" /> Add</button>
                                                        </div>
                                                      )}
                                                      {/* styles */}
                                                      {fg.id === "styles" && (
                                                        <div className="space-y-1.5">
                                                          {listParseItems(bookingConfig.styles).map((item, i) => (
                                                            <div key={i} className="flex items-center gap-2">
                                                              <input type="text" value={item.value} onChange={(e) => setBookingConfig({ ...bookingConfig, styles: listUpdateItem(bookingConfig.styles, i, e.target.value, item.label) })} className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-emerald-500 outline-none" />
                                                              <input type="text" value={item.label} onChange={(e) => setBookingConfig({ ...bookingConfig, styles: listUpdateItem(bookingConfig.styles, i, item.value, e.target.value) })} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                              <button type="button" onClick={() => setBookingConfig({ ...bookingConfig, styles: listRemoveItem(bookingConfig.styles, i) })} className="text-gray-500 hover:text-red-400 transition text-xs"><FaTrash /></button>
                                                            </div>
                                                          ))}
                                                          <button type="button" onClick={() => setBookingConfig({ ...bookingConfig, styles: listAddItem(bookingConfig.styles, "new-style", "New Style") })} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition"><FaPlus className="text-[8px]" /> Add</button>
                                                        </div>
                                                      )}
                                                      {/* drink-styles */}
                                                      {fg.id === "drink-styles" && (
                                                        <div className="space-y-1.5">
                                                          {listParseItems(bookingConfig.drinkStyles).map((item, i) => (
                                                            <div key={i} className="flex items-center gap-2">
                                                              <input type="text" value={item.value} onChange={(e) => setBookingConfig({ ...bookingConfig, drinkStyles: listUpdateItem(bookingConfig.drinkStyles, i, e.target.value, item.label) })} className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-emerald-500 outline-none" />
                                                              <input type="text" value={item.label} onChange={(e) => setBookingConfig({ ...bookingConfig, drinkStyles: listUpdateItem(bookingConfig.drinkStyles, i, item.value, e.target.value) })} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                              <button type="button" onClick={() => setBookingConfig({ ...bookingConfig, drinkStyles: listRemoveItem(bookingConfig.drinkStyles, i) })} className="text-gray-500 hover:text-red-400 transition text-xs"><FaTrash /></button>
                                                            </div>
                                                          ))}
                                                          <button type="button" onClick={() => setBookingConfig({ ...bookingConfig, drinkStyles: listAddItem(bookingConfig.drinkStyles, "new-drink", "New Drink Style") })} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition"><FaPlus className="text-[8px]" /> Add</button>
                                                        </div>
                                                      )}
                                                      {/* per-product-group-types */}
                                                      {fg.id === "per-product-group-types" && (
                                                        <div className="space-y-1.5">
                                                          {bookingConfig.productGroupTypes[product.slug] !== undefined && (
                                                            <button type="button" onClick={() => resetProductGroupTypes(product.slug)} className="text-[9px] text-amber-400 hover:text-amber-300 transition mb-1">Reset to defaults</button>
                                                          )}
                                                          {bookingConfig.productGroupTypes[product.slug] === undefined && (
                                                            <p className="text-[9px] text-gray-600 mb-1">Using global defaults. Edit below to customise for this event.</p>
                                                          )}
                                                          {listParseItems(getProductGroupTypes(product.slug)).map((item, i) => (
                                                            <div key={i} className="flex items-center gap-2">
                                                              <input type="text" value={item.value} onChange={(e) => setProductGroupTypes(product.slug, listUpdateItem(getProductGroupTypes(product.slug), i, e.target.value, item.label))} className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-emerald-500 outline-none" />
                                                              <input type="text" value={item.label} onChange={(e) => setProductGroupTypes(product.slug, listUpdateItem(getProductGroupTypes(product.slug), i, item.value, e.target.value))} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                              <button type="button" onClick={() => setProductGroupTypes(product.slug, listRemoveItem(getProductGroupTypes(product.slug), i))} className="text-gray-500 hover:text-red-400 transition text-xs"><FaTrash /></button>
                                                            </div>
                                                          ))}
                                                          <button type="button" onClick={() => setProductGroupTypes(product.slug, listAddItem(getProductGroupTypes(product.slug), "new-type", "New Type"))} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition"><FaPlus className="text-[8px]" /> Add</button>
                                                        </div>
                                                      )}
                                                      {/* misc-themes */}
                                                      {fg.id === "misc-themes" && (
                                                        <div className="space-y-1.5">
                                                          {listParseItems(bookingConfig.miscThemes).map((item, i) => (
                                                            <div key={i} className="flex items-center gap-2">
                                                              <input type="text" value={item.value} onChange={(e) => setBookingConfig({ ...bookingConfig, miscThemes: listUpdateItem(bookingConfig.miscThemes, i, e.target.value, item.label) })} className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-emerald-500 outline-none" />
                                                              <input type="text" value={item.label} onChange={(e) => setBookingConfig({ ...bookingConfig, miscThemes: listUpdateItem(bookingConfig.miscThemes, i, item.value, e.target.value) })} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                              <button type="button" onClick={() => setBookingConfig({ ...bookingConfig, miscThemes: listRemoveItem(bookingConfig.miscThemes, i) })} className="text-gray-500 hover:text-red-400 transition text-xs"><FaTrash /></button>
                                                            </div>
                                                          ))}
                                                          <button type="button" onClick={() => setBookingConfig({ ...bookingConfig, miscThemes: listAddItem(bookingConfig.miscThemes, "new-theme", "New Theme") })} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition"><FaPlus className="text-[8px]" /> Add</button>
                                                        </div>
                                                      )}
                                                      {/* travel-zones */}
                                                      {fg.id === "travel-zones" && (
                                                        <div className="space-y-1.5">
                                                          {bookingConfig.travelZones.map((zone) => (
                                                            <div key={zone.id} className="flex items-center gap-2">
                                                              <input type="text" value={zone.label} onChange={(e) => updateTravelZone(zone.id, { label: e.target.value })} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                              <div className="relative w-20"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">&pound;</span><input type="number" step="0.01" value={zone.pence} onChange={(e) => updateTravelZone(zone.id, { pence: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-5 pr-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" /></div>
                                                              <button type="button" onClick={() => updateTravelZone(zone.id, { canInstantBook: !zone.canInstantBook })} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${zone.canInstantBook ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>{zone.canInstantBook ? "instant" : "enquiry"}</button>
                                                              <button type="button" onClick={() => removeTravelZone(zone.id)} className="text-gray-500 hover:text-red-400 transition text-xs"><FaTrash /></button>
                                                            </div>
                                                          ))}
                                                          <button type="button" onClick={addTravelZone} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition"><FaPlus className="text-[8px]" /> Add zone</button>
                                                        </div>
                                                      )}
                                                      {/* task-section-types */}
                                                      {fg.id === "task-section-types" && (
                                                        <div className="space-y-1.5">
                                                          {bookingConfig.productTaskSectionTypes[product.slug] && (
                                                            <button type="button" onClick={() => resetTaskSectionTypesToDefault(product.slug)} className="text-[9px] text-amber-400 hover:text-amber-300 transition mb-1">Reset to defaults</button>
                                                          )}
                                                          {!bookingConfig.productTaskSectionTypes[product.slug] && (
                                                            <p className="text-[9px] text-gray-600 mb-1">Using global defaults. Edit below to customise for this event.</p>
                                                          )}
                                                          {getProductTaskSectionTypes(product.slug).map((sType) => (
                                                            <div key={sType.id} className="flex items-center gap-2">
                                                              <input type="text" value={sType.label} onChange={(e) => updateTaskSectionType(product.slug, sType.id, { label: e.target.value })} className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                              <input type="text" value={sType.description} onChange={(e) => updateTaskSectionType(product.slug, sType.id, { description: e.target.value })} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                              <div className="relative w-16"><span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">&pound;</span><input type="number" step="0.01" value={sType.pricePounds} onChange={(e) => updateTaskSectionType(product.slug, sType.id, { pricePounds: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-5 pr-1 py-1 text-xs text-white focus:border-emerald-500 outline-none" /></div>
                                                              <button type="button" onClick={() => updateTaskSectionType(product.slug, sType.id, { enabled: !sType.enabled })} className="text-base">{sType.enabled ? <FaToggleOn className="text-emerald-400" /> : <FaToggleOff className="text-gray-600" />}</button>
                                                              <button type="button" onClick={() => removeTaskSectionType(product.slug, sType.id)} className="text-gray-500 hover:text-red-400 transition text-xs"><FaTrash /></button>
                                                            </div>
                                                          ))}
                                                          <button type="button" onClick={() => addTaskSectionType(product.slug)} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition"><FaPlus className="text-[8px]" /> Add type</button>
                                                        </div>
                                                      )}
                                                      {/* duration-mode */}
                                                      {fg.id === "duration-mode" && (
                                                        <div className="grid grid-cols-2 gap-2">
                                                          {[{ value: "auto", label: "Auto", desc: "Linked to task section count" }, { value: "manual", label: "Manual", desc: "Customer picks from a list" }].map((mode) => (
                                                            <button key={mode.value} type="button" onClick={() => setBookingConfig({ ...bookingConfig, durationMode: mode.value as "auto" | "manual" })} className={`p-2 rounded-lg border text-center transition text-xs ${bookingConfig.durationMode === mode.value ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"}`}>
                                                              <span className="block font-semibold">{mode.label}</span><span className="block text-[9px] text-gray-500 mt-0.5">{mode.desc}</span>
                                                            </button>
                                                          ))}
                                                        </div>
                                                      )}
                                                      {/* duration-options */}
                                                      {fg.id === "duration-options" && (
                                                        <div className="space-y-1.5">
                                                          {bookingConfig.durations.map((dur, i) => (
                                                            <div key={i} className="flex items-center gap-2">
                                                              <input type="text" value={dur.value} onChange={(e) => updateDuration(i, { value: e.target.value })} className="w-12 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-emerald-500 outline-none" title="Value (hours)" />
                                                              <input type="text" value={dur.label} onChange={(e) => updateDuration(i, { label: e.target.value })} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" title="Display label" />
                                                              <input type="text" value={dur.gameTime} onChange={(e) => updateDuration(i, { gameTime: e.target.value })} className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" title="Game time" />
                                                              {bookingConfig.durationMode === "auto" && (<input type="number" min="0" value={dur.minSections} onChange={(e) => updateDuration(i, { minSections: parseInt(e.target.value) || 0 })} className="w-12 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" title="Min sections" />)}
                                                              <button type="button" onClick={() => removeDuration(i)} className="text-gray-500 hover:text-red-400 transition text-xs"><FaTrash /></button>
                                                            </div>
                                                          ))}
                                                          <button type="button" onClick={addDuration} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition"><FaPlus className="text-[8px]" /> Add duration</button>
                                                        </div>
                                                      )}
                                                      {/* time-blocking-mode */}
                                                      {fg.id === "time-blocking-mode" && (
                                                        <div className="grid grid-cols-3 gap-2">
                                                          {[{ value: "none", label: "None", desc: "Event time only" }, { value: "buffer", label: "Buffer", desc: "Block time either side" }, { value: "whole-day", label: "Whole Day", desc: "Block the entire day" }].map((mode) => (
                                                            <button key={mode.value} type="button" onClick={() => setBookingConfig({ ...bookingConfig, timeBlockingMode: mode.value })} className={`p-2 rounded-lg border text-center transition text-xs ${bookingConfig.timeBlockingMode === mode.value ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"}`}>
                                                              <span className="block font-semibold">{mode.label}</span><span className="block text-[9px] text-gray-500 mt-0.5">{mode.desc}</span>
                                                            </button>
                                                          ))}
                                                        </div>
                                                      )}
                                                      {/* addons-list */}
                                                      {fg.id === "addons-list" && (
                                                        <div className="space-y-2">
                                                          {bookingConfig.addOns.map((addon) => (
                                                            <div key={addon.id} className="bg-gray-900 border border-gray-700 rounded-lg p-2 space-y-1.5">
                                                              <div className="flex items-center gap-2">
                                                                <input type="text" value={addon.name} onChange={(e) => updateAddOn(addon.id, { name: e.target.value })} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" placeholder="Name" />
                                                                <input type="number" step="0.01" value={(addon.pricePP / 100).toFixed(2)} onChange={(e) => updateAddOn(addon.id, { pricePP: Math.round(parseFloat(e.target.value || "0") * 100) })} className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                                <button type="button" onClick={() => updateAddOn(addon.id, { enabled: !addon.enabled })} className="text-base">{addon.enabled ? <FaToggleOn className="text-emerald-400" /> : <FaToggleOff className="text-gray-600" />}</button>
                                                                <button type="button" onClick={() => removeAddOn(addon.id)} className="text-gray-500 hover:text-red-400 transition text-xs"><FaTrash /></button>
                                                              </div>
                                                              <input type="text" value={addon.description} onChange={(e) => updateAddOn(addon.id, { description: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" placeholder="Description" />
                                                            </div>
                                                          ))}
                                                          <button type="button" onClick={addNewAddOn} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition"><FaPlus className="text-[8px]" /> Add add-on</button>
                                                        </div>
                                                      )}
                                                      {/* message-text */}
                                                      {fg.id === "message-text" && (
                                                        <div>
                                                          <label className="text-gray-500 text-[10px] block mb-1">Placeholder Text</label>
                                                          <input type="text" value={bookingConfig.messagePlaceholder} onChange={(e) => setBookingConfig({ ...bookingConfig, messagePlaceholder: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none" />
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                          <button type="button" onClick={() => { const id = `field-${Date.now()}`; addFieldGroup(sec.id, id, "New Field"); }} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition mt-2">
                                            <FaPlus className="text-[8px]" /> Add field group
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <p className="text-gray-500 text-xs">No booking sections configured. Add some using the buttons above, or reset to defaults.</p>
                          </div>
                        )}

                        {/* Save/Cancel */}
                        <div className="flex items-center gap-3 mt-4">
                          <button onClick={saveBookingConfig} disabled={savingBookingConfig} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition" data-action="admin_booking_sections_save">
                            <FaSave className="text-[10px]" />
                            {savingBookingConfig ? "Saving..." : "Save Booking Config"}
                          </button>
                          <button onClick={() => { setShowBookingSections(false); setExpandedBookingSection(null); setNewBookingSectionForm(null); setDeleteBookingSectionConfirm(null); }} className="text-gray-400 hover:text-white text-xs transition" data-action="admin_booking_sections_cancel">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Packages Management */}
                  <div className="mb-6 pt-4 border-t border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <FaTags className="text-purple-400" />
                        Packages ({product.packages?.length || 0})
                      </h3>
                      <button
                        onClick={() => setShowPackages(showPackages === product.id ? null : product.id)}
                        className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-purple-400 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                        data-action={`admin_product_toggle_packages_${product.slug}`}
                      >
                        <FaTags className="text-[10px]" />
                        {showPackages === product.id ? "Hide Packages" : "Manage Packages"}
                      </button>
                    </div>

                    {showPackages === product.id && (
                      <div className="space-y-3">
                        {/* Add Package button */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingPackageId(null);
                              setPackageForm(emptyPackageForm);
                              setShowPackageForm(product.id);
                            }}
                            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
                            data-action={`admin_product_add_package_${product.slug}`}
                          >
                            <FaPlus className="text-[10px]" />
                            Add Package
                          </button>
                        </div>

                        {/* New Package Form (only for adding, not editing) */}
                        {showPackageForm === product.id && !editingPackageId && (
                          <div className="bg-gray-800 border border-emerald-500/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold">New Package</h4>
                              <button
                                onClick={cancelPackageForm}
                                className="text-gray-500 hover:text-white transition"
                                data-action="admin_package_form_cancel"
                              >
                                <FaTimes className="text-sm" />
                              </button>
                            </div>
                            {renderPackageFormFields(product.id)}
                          </div>
                        )}

                        {/* Package List */}
                        {product.packages && product.packages.length > 0 ? (
                          <div className="space-y-2">
                            {product.packages.map((pkg) => (
                              <div
                                key={pkg.id}
                                className={`bg-gray-800 border rounded-lg transition-all ${
                                  editingPackageId === pkg.id
                                    ? "border-emerald-500/50"
                                    : "border-gray-700 hover:border-gray-600"
                                }`}
                              >
                                {/* Package header - clickable to expand */}
                                <div
                                  className="flex items-center justify-between p-3 cursor-pointer"
                                  onClick={() => {
                                    if (editingPackageId === pkg.id) {
                                      cancelPackageForm();
                                    } else {
                                      startEditPackage(pkg, product.id);
                                    }
                                  }}
                                  data-action={`admin_package_toggle_${pkg.slug}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-gray-500 text-xs">
                                      {editingPackageId === pkg.id ? (
                                        <FaChevronDown />
                                      ) : (
                                        <FaChevronRight />
                                      )}
                                    </span>
                                    <div>
                                      <p className="text-sm font-medium">
                                        {pkg.name}
                                        <span
                                          className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                            pkg.isActive
                                              ? "bg-emerald-500/20 text-emerald-400"
                                              : "bg-red-500/20 text-red-400"
                                          }`}
                                        >
                                          {pkg.isActive ? "Active" : "Inactive"}
                                        </span>
                                        <span
                                          className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                            pkg.bookingType === "PUBLIC"
                                              ? "bg-emerald-500/20 text-emerald-400"
                                              : "bg-purple-500/20 text-purple-400"
                                          }`}
                                        >
                                          {pkg.bookingType}
                                        </span>
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {pkg.duration && <>{pkg.duration} &middot; </>}
                                        {pkg.pricePerPerson
                                          ? `${formatPrice(pkg.pricePerPerson)} pp`
                                          : pkg.flatPrice
                                          ? `${formatPrice(pkg.flatPrice)} flat`
                                          : "No price set"}
                                        {pkg.minPlayers || pkg.maxPlayers ? (
                                          <>
                                            {" "}
                                            &middot;{" "}
                                            {pkg.minPlayers && pkg.maxPlayers
                                              ? `${pkg.minPlayers}-${pkg.maxPlayers} players`
                                              : pkg.minPlayers
                                              ? `Min ${pkg.minPlayers} players`
                                              : `Max ${pkg.maxPlayers} players`}
                                          </>
                                        ) : null}
                                        {pkg._count?.bookings !== undefined && (
                                          <>
                                            {" "}
                                            &middot; {pkg._count.bookings} booking
                                            {pkg._count.bookings !== 1 ? "s" : ""}
                                          </>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletePackageConfirm(pkg.id);
                                      }}
                                      className="text-gray-500 hover:text-red-400 transition"
                                      data-action={`admin_package_delete_${pkg.slug}`}
                                    >
                                      <FaTrash className="text-xs" />
                                    </button>
                                  </div>
                                </div>

                                {/* Inline edit form - expanded */}
                                {editingPackageId === pkg.id && (
                                  <div className="px-3 pb-3 pt-1 border-t border-gray-700">
                                    {renderPackageFormFields(product.id)}
                                  </div>
                                )}

                                {/* Package Delete Confirmation */}
                                {deletePackageConfirm === pkg.id && (
                                  <div className="mx-3 mb-3 pt-3 border-t border-gray-700">
                                    <p className="text-xs text-red-400 mb-2">
                                      Delete &quot;{pkg.name}&quot; package?
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => deletePackage(pkg.id)}
                                        disabled={actionLoading === pkg.id}
                                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium transition"
                                        data-action="admin_package_delete_confirm"
                                      >
                                        {actionLoading === pkg.id
                                          ? "Deleting..."
                                          : "Delete"}
                                      </button>
                                      <button
                                        onClick={() => setDeletePackageConfirm(null)}
                                        className="text-gray-400 hover:text-white text-xs transition"
                                        data-action="admin_package_delete_cancel"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs">
                            No packages yet. Add one to get started.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <FaBox className="text-4xl text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500">No products found</p>
          <p className="text-gray-600 text-sm mt-1">
            Create your first product to get started.
          </p>
        </div>
      )}
    </div>
  );
}
