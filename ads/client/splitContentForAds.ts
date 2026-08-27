/**
 * Split HTML content into chunks for ad insertion.
 *
 * Mirrors the Python framework's ad placement logic:
 * - Primary: insert ad slots before the Nth H2 headings (default: 3rd, 5th, 7th)
 * - Self-promo: insert a self-promo marker before a specific H2 (default: 2nd)
 * - Fallback: if fewer H2s than needed, split every N words instead
 */

export type SplitOptions = {
  /** Which H2 numbers to place product ads before (default: {3, 5, 7}) */
  adBeforeH2?: Set<number>;
  /** Which H2 number to place the self-promo ad before (default: 2, null to disable) */
  selfPromoBeforeH2?: number | null;
  /** Marker string for the self-promo slot (default: "__SELF_PROMO_AD__") */
  selfPromoMarker?: string;
  /** Fallback: insert ad every N words if not enough H2s (default: 300) */
  fallbackWordInterval?: number;
};

const DEFAULT_OPTIONS: Required<SplitOptions> = {
  adBeforeH2: new Set([3, 5, 7]),
  selfPromoBeforeH2: 2,
  selfPromoMarker: "__SELF_PROMO_AD__",
  fallbackWordInterval: 300,
};

/**
 * Count approximate words in an HTML string (strips tags first).
 */
function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ");
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Split content by word count at paragraph boundaries.
 * Avoids splitting mid-tag by only breaking at </p> boundaries.
 */
function splitByWords(html: string, interval: number, selfPromoMarker: string): string[] {
  const chunks: string[] = [];
  // Split at paragraph boundaries
  const paragraphs = html.split(/(?=<p[\s>])/i);
  let buffer = "";
  let wordCount = 0;
  let insertedPromo = false;

  for (const para of paragraphs) {
    buffer += para;
    wordCount += countWords(para);

    if (wordCount >= interval) {
      chunks.push(buffer);
      // Insert self-promo after first chunk if not yet done
      if (!insertedPromo) {
        chunks.push(selfPromoMarker);
        insertedPromo = true;
      }
      buffer = "";
      wordCount = 0;
    }
  }

  if (buffer.trim()) {
    chunks.push(buffer);
  }

  return chunks;
}

export function splitContentForAds(
  htmlContent: string,
  options?: SplitOptions
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Normalise: convert H1s to H2s
  let content = htmlContent.replace(/<h1([^>]*)>(.*?)<\/h1>/gi, "<h2$1>$2</h2>");

  // Ensure content starts with an H2
  if (!content.trimStart().startsWith("<h2")) {
    content = "<h2>Overview</h2>" + content;
  }

  // Split at H2 boundaries
  const h2Parts = content.split(/(?=<h2[\s>])/i);

  // Count H2s to decide strategy
  const h2Count = h2Parts.filter((p) => /^<h2[\s>]/i.test(p)).length;
  const maxAdH2 = Math.max(...Array.from(opts.adBeforeH2));

  // Fallback: if fewer H2s than the highest ad position, split by word count
  if (h2Count < maxAdH2) {
    console.log("[Ads] Fewer than", maxAdH2, "H2s, using word-interval fallback");
    return splitByWords(content, opts.fallbackWordInterval, opts.selfPromoMarker);
  }

  // Primary: split at H2 boundaries with ad markers
  const chunks: string[] = [];
  let buffer = "";
  let currentH2 = 0;

  for (const part of h2Parts) {
    const isH2 = /^<h2[\s>]/i.test(part);
    if (isH2) {
      currentH2++;

      // Self-promo slot
      if (opts.selfPromoBeforeH2 !== null && currentH2 === opts.selfPromoBeforeH2 && buffer.trim()) {
        chunks.push(buffer);
        chunks.push(opts.selfPromoMarker);
        buffer = "";
      }
      // Product ad slot
      else if (opts.adBeforeH2.has(currentH2) && buffer.trim()) {
        chunks.push(buffer);
        buffer = "";
      }
    }
    buffer += part;
  }

  if (buffer.trim()) chunks.push(buffer);
  if (chunks.length === 0) chunks.push(content);

  return chunks;
}
