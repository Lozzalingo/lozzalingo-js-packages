"use client";

import { useState, useEffect } from "react";
import { useEventsConfig } from "../context/EventsProvider";

export type ProductPackage = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  pricePerPerson: number | null;
  flatPrice: number | null;
  minReserve: number | null;
  additionalPlayerPrice: number | null;
  includes: string | null;
  bookingType: string;
  displayOrder: number;
};

export type ProductImage = {
  id: number;
  url: string;
  alt: string | null;
  sortOrder: number;
};

export type ProductSectionData = {
  id: number;
  title: string;
  type: "text" | "list" | "steps" | "bullets" | "cards" | "checklist" | "gallery" | "themes" | "venue" | "video" | "faq";
  content: string | null;
  listItems: string | null;
  displayOrder: number;
  isCollapsible: boolean;
};

export type CalendarEventData = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  locationName: string | null;
  maxCapacity: number | null;
  currentBookings: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDesc: string | null;
  coverImage: string | null;
  category: string | null;
  tags: string | null;
  format: string | null;
  themes: string | null;
  maxGroupSize: number | null;
  duration: string | null;
  ticketLimit: number | null;
  venue: string | null;
  isActive: boolean;
  packages: ProductPackage[];
  images: ProductImage[];
  sections: ProductSectionData[];
  calendarEvents?: CalendarEventData[];
};

/** Fetch all active products */
export function useProducts() {
  const { apiBase } = useEventsConfig();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    console.log("[EventsUI] Fetching products");
    fetch(`${apiBase}/api/products`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Product[]) => {
        console.log(`[EventsUI] Loaded ${data.length} products`);
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[EventsUI] Error fetching products:", err);
        setError(err);
        setProducts([]);
        setLoading(false);
      });
  }, [apiBase]);

  return { products, loading, error };
}

/** Fetch a single product by slug */
export function useProduct(slug: string) {
  const { apiBase } = useEventsConfig();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!slug) return;
    console.log(`[EventsUI] Fetching product: ${slug}`);
    fetch(`${apiBase}/api/products/slug/${slug}`)
      .then((r) => {
        if (!r.ok) {
          console.log(`[EventsUI] Product not found: ${slug}`);
          setNotFound(true);
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then((data: Product | null) => {
        if (data) {
          console.log(`[EventsUI] Loaded: ${data.name}`);
          setProduct(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(`[EventsUI] Error fetching product:`, err);
        setError(err);
        setNotFound(true);
        setLoading(false);
      });
  }, [slug, apiBase]);

  /** Refresh the product data */
  const refresh = () => {
    if (!slug) return;
    fetch(`${apiBase}/api/products/slug/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setProduct(data); })
      .catch((err) => console.error("[EventsUI] Refresh error:", err));
  };

  return { product, loading, notFound, error, refresh };
}
