// ─── Shared Booking Form Types ──────────────────────────────────────────────

export type SectionFieldGroup = {
  id: string;
  label: string;
  enabled: boolean;
};

export type BookingFormSection = {
  id: string;
  title: string;
  icon: string;
  enabled: boolean;
  order: number;
  description?: string;
  fields?: Record<string, unknown>;
  fieldGroups?: SectionFieldGroup[];
};

export type BookingAddOn = {
  id: string;
  name: string;
  icon: string;
  description: string;
  pricePP: number; // pence (used when pricingType is "per-person")
  priceFlat?: number; // pence (used when pricingType is "flat")
  pricingType?: "per-person" | "flat"; // default: "per-person"
  enabled: boolean;
};

/** Per-product pricing overrides. Any field not set falls back to the global BookingConfig value. */
export type ProductPricing = {
  pricePerPerson?: number;
  minPlayers?: number;
  minReserve?: number;
};

export type TaskSectionTypeConfig = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  pricePounds: string; // surcharge in pounds (e.g. "30.00")
};

export type BookingConfig = {
  pricePerPerson: number;
  minPlayers: number;
  minReserve: number;
  miscBespokePrice: number;
  bespokeSectonPrice: number;
  medalsPricePP: number;
  photoPrintsPricePP: number;
  travelCharges: Record<string, { label: string; pence: number; canInstantBook: boolean }>;
  durations: { value: string; label: string; gameTime: string; total: string; minSections: number }[];
  durationMode?: "auto" | "manual";
  durationDescription?: string;
  durationBreakdown?: { label: string; description: string; durationMinutes: number }[];
  groupTypes: { value: string; label: string }[];
  styles: { value: string; label: string }[];
  drinkStyles: { value: string; label: string }[];
  firstPlacePrizes: { value: string; label: string }[];
  miscThemes: { value: string; label: string }[];
  whatsIncluded: string[];
  bookingSections: BookingFormSection[];
  addOns: BookingAddOn[];
  taskSectionTypes: TaskSectionTypeConfig[];
  productTaskSectionTypes?: Record<string, TaskSectionTypeConfig[]>;
  productGroupTypes?: Record<string, { value: string; label: string }[]>;
  /** Per-product pricing overrides keyed by product slug */
  productPricing?: Record<string, ProductPricing>;
  /** Admin-set event format: "in-person" or "virtual". Determines what the customer sees. */
  eventFormat?: EventFormat;
  /** For virtual events, which platform (set by admin) */
  virtualPlatform?: VirtualPlatform;
  virtualPlatforms?: { value: VirtualPlatform; label: string }[];
  messagePlaceholder?: string;
  /** Dynamic pricing fields for admin configuration */
  pricingFields?: { id: string; label: string; value: string; category: "base" | "addon"; perPerson: boolean; mandatory?: boolean; pricingType?: "fixed" | "per-person" }[];
};

export type EventFormat = "in-person" | "virtual";
export type VirtualPlatform = "zoom" | "microsoft-teams";

export type TaskSectionType = "location" | "miscellaneous" | "bespoke";

export type TaskSection = {
  type: TaskSectionType;
  locationSlug?: string;
  miscTheme?: string;
  bespokeTheme?: string;
  useCustomStart?: boolean;
  customStartAddress?: string;
  useCustomEnd?: boolean;
  customEndAddress?: string;
  venueNotes?: string;
  /** Virtual event fields */
  virtualPlatform?: VirtualPlatform;
  /** In-person custom address (non-location events) */
  venueAddress?: string;
};

export type NormalizedProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  coverImage?: string | null;
  category?: string;
  duration?: string | null;
  maxGroupSize?: number;
  isActive: boolean;
  packages?: { id: string; bookingType: string }[];
};

export type NormalizedLocation = {
  id: string;
  slug: string;
  name: string;
  region?: string;
  country?: string;
  routeType?: string;
  startPoint?: string;
  startPointUrl?: string;
  endPoint?: string;
  endPointUrl?: string;
  travelZone?: string;
};

// ─── API Interface ──────────────────────────────────────────────────────────

export type BookingPayload = {
  eventTitle: string;
  imageUrl?: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  companyName?: string;
  groupSize: number;
  eventDate?: string;
  priceInPence: number;
  message?: string;
  productSlug?: string;
  groupType: string;
  style: string;
  drinkStyle: string;
  firstPlacePrize: string;
  taskSections: string;
  duration: string;
  eventTime?: string;
  slotStartTime?: string;
  slotEndTime?: string;
  wantsMedals: boolean;
  wantsPhotoPrints: boolean;
  timeBlocking?: string;
  bufferHours?: string;
  travelChargePence: number;
  locationSlug?: string;
  status?: string;
  eventFormat?: string;
  virtualPlatform?: string;
  venueAddress?: string;
};

export type CalEvent = {
  id: string;
  title: string;
  subtitle?: string;
  startTime: string;
  endTime: string;
  type: string;
};

export type BookingFormApi = {
  /** Fetch booking config overrides. Returns null if not available. */
  fetchConfig?: () => Promise<Partial<BookingConfig> | null>;

  /** Fetch available products. Should return only bookable products. */
  fetchProducts: () => Promise<NormalizedProduct[]>;

  /** Fetch available locations. */
  fetchLocations: () => Promise<NormalizedLocation[]>;

  /** Fetch existing bookings for calendar display. */
  fetchCalendarBookings?: () => Promise<CalEvent[]>;

  /** Fetch blocked calendar events (e.g. iCal synced personal events). */
  fetchBlockedEvents?: () => Promise<CalEvent[]>;

  /** Submit a booking enquiry (non-instant-book path). */
  submitEnquiry: (payload: BookingPayload) => Promise<{ success: boolean; message?: string }>;

  /** Submit for checkout (instant-book path). Returns redirect URL on success. */
  submitCheckout: (payload: BookingPayload) => Promise<{ url?: string; error?: string }>;
};

// ─── Component Props ────────────────────────────────────────────────────────

export type BookingFormProps = {
  /** API adapter for all data fetching and submission */
  api: BookingFormApi;

  /** Default booking config (pricing, sections, add-ons, etc.) */
  defaultConfig: BookingConfig;

  /** Resolve a cover image filename to a full URL */
  getImageUrl?: (filename?: string | null) => string;

  /** Where to redirect when user selects "Public Event" mode. Set to null to hide the toggle. */
  publicEventPath?: string | null;

  /** Fallback contact email shown at bottom of form */
  contactEmail?: string;

  /** API base URL for the SharedCalendar component */
  calendarApiBaseUrl?: string;

  /** Pre-select a product by slug */
  preselectedProductSlug?: string;

  /** Pre-populate the first task section with a location by slug */
  preselectedLocationSlug?: string;

  /** Show the Private/Public mode toggle (default true) */
  showModeToggle?: boolean;

  /** Show the event selector dropdown (default true). When false, uses preselectedProductSlug. */
  showEventSelector?: boolean;
};
