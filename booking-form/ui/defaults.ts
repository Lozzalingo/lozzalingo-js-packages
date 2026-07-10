import type { BookingConfig } from "./types";

export const DEFAULT_BOOKING_CONFIG: BookingConfig = {
  pricePerPerson: 3000,
  minPlayers: 6,
  minReserve: 18000,
  miscBespokePrice: 5000,
  bespokeSectonPrice: 3000,
  medalsPricePP: 500,
  photoPrintsPricePP: 500,
  travelCharges: {
    london: { label: "London", pence: 0, canInstantBook: true },
    close: { label: "Close to London", pence: 12000, canInstantBook: true },
    medium: { label: "Medium distance", pence: 16000, canInstantBook: true },
    far: { label: "Far UK", pence: 20000, canInstantBook: true },
    international: { label: "Outside UK", pence: 0, canInstantBook: false },
  },
  durations: [
    { value: "2", label: "2 hours", gameTime: "1 hour", total: "2 hours", minSections: 0 },
    { value: "2.5", label: "2.5 hours", gameTime: "1.5 hours", total: "2.5 hours", minSections: 2 },
    { value: "3", label: "3 hours", gameTime: "2 hours", total: "3 hours", minSections: 3 },
  ],
  durationDescription: "Choose how long you'd like your event to be.",
  durationBreakdown: [
    { label: "Introduction", description: "Rules explained, players divided into teams, and FAQs answered", durationMinutes: 30 },
    { label: "Game Time", description: "The main event - explore, compete, and complete challenges", durationMinutes: 0 },
    { label: "Wrap-up", description: "Highlights showcase, final scores, and trophy presentation", durationMinutes: 30 },
  ],
  groupTypes: [
    { value: "corporate", label: "Corporate" },
    { value: "hen", label: "Hen" },
    { value: "birthday", label: "Birthday" },
    { value: "sten", label: "Sten" },
    { value: "stag", label: "Stag" },
    { value: "other", label: "Other" },
  ],
  styles: [
    { value: "professional", label: "Professional" },
    { value: "cheeky", label: "Cheeky" },
  ],
  drinkStyles: [
    { value: "sober", label: "Sober" },
    { value: "boozy", label: "Boozy" },
  ],
  firstPlacePrizes: [
    { value: "prosecco", label: "Prosecco" },
    { value: "no-secco", label: "No-secco" },
    { value: "bring-our-own", label: "We'll bring our own" },
  ],
  miscThemes: [
    { value: "no-theme", label: "No Theme" },
    { value: "halloween", label: "Halloween" },
    { value: "christmas", label: "Christmas" },
    { value: "easter", label: "Easter" },
    { value: "summer", label: "Summer" },
    { value: "winter", label: "Winter" },
    { value: "guy-fawkes", label: "Guy Fawkes" },
    { value: "valentines", label: "Valentines" },
    { value: "bespoke", label: "Bespoke Theme (+\u00A350)" },
  ],
  whatsIncluded: [
    "Professional host",
    "Physical handouts for your team",
    "Trophies for 1st, 2nd, and 3rd place",
    "A prize for first place",
    "Digital copy of team photos and videos",
  ],
  bookingSections: [
    { id: "your-details", title: "Your Details", icon: "FaUser", enabled: true, order: 1, fieldGroups: [
      { id: "first-name", label: "First Name", enabled: true },
      { id: "last-name", label: "Last Name", enabled: true },
      { id: "email", label: "Email", enabled: true },
      { id: "phone", label: "Phone", enabled: true },
      { id: "company", label: "Company Name", enabled: true },
    ]},
    { id: "choose-event", title: "Choose Your Event", icon: "FaUsers", enabled: true, order: 2, fields: { showEventSelector: true }, fieldGroups: [
      { id: "group-size", label: "Group Size", enabled: true },
      { id: "event-selector", label: "Event Selector", enabled: true },
      { id: "event-format", label: "Event Format", enabled: true },
      { id: "whats-included", label: "What's Included", enabled: true },
      { id: "first-place-prizes", label: "First Place Prizes", enabled: true },
      { id: "base-pricing", label: "Base Pricing", enabled: true },
      { id: "addon-pricing", label: "Add-on Pricing", enabled: true },
    ]},
    { id: "group-type", title: "Group Type", icon: "FaTheaterMasks", enabled: true, order: 3, fieldGroups: [
      { id: "group-types", label: "Group Types", enabled: true },
      { id: "styles", label: "Styles", enabled: true },
      { id: "drink-styles", label: "Drink Styles", enabled: true },
      { id: "per-product-group-types", label: "Per-event Group Types", enabled: true },
    ]},
    { id: "task-sections", title: "Task Sections", icon: "FaPuzzlePiece", enabled: true, order: 4, fieldGroups: [
      { id: "misc-themes", label: "Miscellaneous Themes", enabled: true },
      { id: "travel-zones", label: "Travel Zones", enabled: true },
      { id: "task-section-types", label: "Task Section Types", enabled: true },
    ]},
    { id: "duration", title: "Duration", icon: "FaClock", enabled: true, order: 5, fieldGroups: [
      { id: "duration-mode", label: "Duration Mode", enabled: true },
      { id: "duration-options", label: "Duration Options", enabled: true },
      { id: "duration-description", label: "Description Text", enabled: true },
      { id: "duration-breakdown", label: "Duration Breakdown", enabled: true },
    ]},
    { id: "time-blocking", title: "Time Blocking", icon: "FaLock", enabled: false, order: 6, fieldGroups: [
      { id: "time-blocking-mode", label: "Time Blocking Mode", enabled: true },
    ]},
    { id: "add-ons", title: "Add-ons", icon: "FaPlus", enabled: true, order: 7, fieldGroups: [
      { id: "addons-list", label: "Add-ons List", enabled: true },
    ]},
    { id: "date-time", title: "Choose Date & Time", icon: "FaCalendarAlt", enabled: true, order: 8, fieldGroups: [
      { id: "calendar", label: "Calendar", enabled: true },
    ]},
    { id: "message", title: "Tell Us About Your Event", icon: "", enabled: true, order: 9, fieldGroups: [
      { id: "message-text", label: "Message Text", enabled: true },
    ]},
  ],
  addOns: [
    { id: "medals", name: "Participation Medals", icon: "FaMedal", description: "A medal for every player to take home", pricePP: 500, enabled: true },
    { id: "photo-prints", name: "Printable Experience Photos", icon: "FaCamera", description: "Printed experience photos, similar to theme park on-ride photos", pricePP: 500, enabled: true },
  ],
  taskSectionTypes: [
    { id: "location", label: "Location", description: "Area-based tasks", enabled: true, pricePounds: "0" },
    { id: "miscellaneous", label: "Miscellaneous", description: "Themed tasks", enabled: true, pricePounds: "0" },
    { id: "bespoke", label: "Personalised", description: "Custom tasks tailored to you", enabled: true, pricePounds: "30.00" },
  ],
  eventFormat: "in-person" as const,
  showPublicMeetingSpace: true,
  virtualPlatforms: [
    { value: "zoom", label: "Zoom" },
    { value: "microsoft-teams", label: "Microsoft Teams" },
  ],
};
