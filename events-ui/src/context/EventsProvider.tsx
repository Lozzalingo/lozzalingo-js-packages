"use client";

import React, { createContext, useContext } from "react";

export type EventsBrand = {
  /** Brand name, e.g. "BucketRace" */
  name: string;
  /** Hero heading on listing page */
  heroTitle?: string;
  /** Hero subtitle on listing page */
  heroSubtitle?: string;
  /** CTA heading on listing page */
  ctaHeading?: string;
  /** CTA body text */
  ctaBody?: string;
  /** CTA button label */
  ctaLabel?: string;
  /** CTA link href, e.g. "/book" */
  ctaHref?: string;
  /** Events listing path, e.g. "/events" */
  eventsPath?: string;
  /** Back link label, e.g. "All Scavenger Hunts" */
  backLabel?: string;
  /** Fallback email, e.g. "info@bucketrace.com" */
  fallbackEmail?: string;
  /** Terms page path, e.g. "/terms" */
  termsPath?: string;
  /** Marketing opt-in text */
  marketingOptInText?: string;
  /** Hardcoded public ticket price label, e.g. "GBP15 per ticket" */
  publicPriceLabel?: string;
  /** Private filter card description */
  privateFilterDesc?: string;
  /** Public filter card description */
  publicFilterDesc?: string;
  /** All filter card description */
  allFilterDesc?: string;
  /** Categories for admin editor */
  categories?: string[];
};

export type EventsConfig = {
  /** API base URL, e.g. "https://bucketrace.com" */
  apiBase: string;
  /** CDN base URL for images */
  cdnBase: string;
  /** Storage folder path, e.g. "bucketrace" */
  storageFolder: string;
  /** Admin secret for authenticated API calls */
  adminSecret?: string;
  /** Brand configuration */
  brand: EventsBrand;
};

const defaultBrand: EventsBrand = {
  name: "Events",
  heroTitle: "Events",
  heroSubtitle: "Browse our events and experiences.",
  ctaHeading: "Want something bespoke?",
  ctaBody: "We can create a custom event tailored to your group, theme, and budget.",
  ctaLabel: "Book a Private Event",
  ctaHref: "/book",
  eventsPath: "/events",
  backLabel: "All Events",
  termsPath: "/terms",
  marketingOptInText: "Would you like to hear about future events? By ticking the box, you are opting in to receive email marketing.",
  privateFilterDesc: "Book an exclusive event for your team. Choose your package and theme.",
  publicFilterDesc: "Join a scheduled event. Just buy tickets and turn up.",
  allFilterDesc: "Browse everything we offer.",
  categories: [
    "scavenger-hunt",
    "murder-mystery",
    "quiz-night",
    "public-event",
    "workshop",
    "corporate",
    "party",
    "other",
  ],
};

const EventsContext = createContext<EventsConfig | null>(null);

export function useEventsConfig(): EventsConfig {
  const ctx = useContext(EventsContext);
  if (!ctx) {
    throw new Error("[EventsUI] useEventsConfig must be used within an <EventsProvider>");
  }
  return ctx;
}

export function EventsProvider({
  apiBase,
  cdnBase,
  storageFolder,
  adminSecret,
  brand,
  children,
}: {
  apiBase: string;
  cdnBase: string;
  storageFolder: string;
  adminSecret?: string;
  brand?: Partial<EventsBrand>;
  children: React.ReactNode;
}) {
  const mergedBrand: EventsBrand = { ...defaultBrand, ...brand };
  const config: EventsConfig = { apiBase, cdnBase, storageFolder, adminSecret, brand: mergedBrand };

  return (
    <EventsContext.Provider value={config}>
      {children}
    </EventsContext.Provider>
  );
}
