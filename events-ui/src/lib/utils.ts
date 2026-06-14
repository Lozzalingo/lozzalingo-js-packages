/** Resolve an image filename to a full CDN URL */
export function getImageUrl(filename: string | null | undefined, cdnBase: string, storageFolder: string): string {
  if (!filename) return "";
  if (filename.startsWith("http")) return filename;
  return `${cdnBase}/${storageFolder}/events/${filename}`;
}

/** Format pence to a GBP price string, e.g. 1500 -> "GBP15.00" */
export function formatPrice(pence: number): string {
  return `\u00A3${(pence / 100).toFixed(2)}`;
}

/** Safely parse a JSON string, returning null on failure */
export function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Parse a JSON-encoded themes array */
export function parseThemes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Parse a JSON-encoded includes array */
export function parseIncludes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Get the lowest pricePerPerson from a list of packages */
export function getLowestPrice(packages: { pricePerPerson: number | null }[]): number | null {
  const prices = packages
    .filter((p) => p.pricePerPerson)
    .map((p) => p.pricePerPerson as number);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

/** Slugify a string for URL-safe usage */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Format a date string to "5 Jan 2026" format */
export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Format a date string to "Sat, 5 Jan 2026" format */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Format a time string to "14:30" format */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Get ordinal suffix for a day number (st, nd, rd, th) */
function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/** Format a date to "Saturday, 5th January 2026" */
export function formatDateWithOrdinal(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  const year = d.getFullYear();
  return `${weekday}, ${day}${getOrdinalSuffix(day)} ${month} ${year}`;
}

/** Convert pence to pounds string, e.g. 1500 -> "15.00" */
export function penceToPounds(pence: number | null): string {
  if (!pence) return "";
  return (pence / 100).toFixed(2);
}

/** Convert pounds to pence, e.g. 15 -> 1500 */
export function poundsToPence(pounds: number): number {
  return Math.round(pounds * 100);
}
