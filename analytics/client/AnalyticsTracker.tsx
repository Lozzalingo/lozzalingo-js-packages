"use client";

/**
 * Centralised Analytics service tracking component.
 * Injects lza.js from the Analytics service for page view tracking.
 *
 * Usage in layout.tsx:
 *   import AnalyticsTracker from "@lozzalingo/analytics/client/AnalyticsTracker";
 *   <AnalyticsTracker />
 *
 * Reads NEXT_PUBLIC_ANALYTICS_URL and NEXT_PUBLIC_SITE_ID from env.
 * Does nothing if NEXT_PUBLIC_ANALYTICS_URL is not set.
 */

import Script from "next/script";

export default function AnalyticsTracker() {
  const url = process.env.NEXT_PUBLIC_ANALYTICS_URL;
  const siteId = process.env.NEXT_PUBLIC_SITE_ID;

  if (!url || !siteId) return null;

  return (
    <Script
      src={`${url}/static/lza.js`}
      data-site={siteId}
      strategy="afterInteractive"
    />
  );
}
