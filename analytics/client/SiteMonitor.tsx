"use client";

/**
 * Site Monitor client-side integration component.
 * Injects sm-error.js and sm-session.js snippets from the Site Monitor service.
 *
 * Usage in layout.tsx:
 *   import SiteMonitor from "@lozzalingo/analytics/client/SiteMonitor";
 *   <SiteMonitor />
 *
 * Reads NEXT_PUBLIC_SITE_MONITOR_URL and NEXT_PUBLIC_SITE_ID from env.
 * Does nothing if NEXT_PUBLIC_SITE_MONITOR_URL is not set.
 */

import Script from "next/script";

export default function SiteMonitor() {
  const smUrl = process.env.NEXT_PUBLIC_SITE_MONITOR_URL;
  const siteId = process.env.NEXT_PUBLIC_SITE_ID;

  if (!smUrl || !siteId) return null;

  return (
    <>
      <Script
        src={`${smUrl}/static/snippet/sm-error.js`}
        data-site={siteId}
        strategy="afterInteractive"
      />
      <Script
        src={`${smUrl}/static/snippet/sm-session.js`}
        data-site={siteId}
        strategy="afterInteractive"
      />
    </>
  );
}
