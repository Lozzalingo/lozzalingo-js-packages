"use client";

import { useEffect, useState } from "react";
import type { Product, ShopConfig } from "./types";

const DEFAULT_ECOSYSTEM_API = "https://laurence.computer/api/ecosystem/shops";

const DEFAULT_FALLBACK_SHOPS: ShopConfig[] = [
  { url: "https://crowdsauced.laurence.computer/api/products/embed", name: "Crowd Sauced", origin: "https://crowdsauced.laurence.computer" },
  { url: "https://www.mariopintomma.com/api/products/embed", name: "Mario Pinto", origin: "https://www.mariopintomma.com" },
  { url: "https://fatbigquiz.com/api/products/embed", name: "Fat Big Quiz", origin: "https://fatbigquiz.com" },
];

/**
 * Resolve the list of shops to fetch products from.
 * Tries the central ecosystem API first, falls back to hardcoded list.
 */
async function resolveShops(
  ecosystemApiUrl: string,
  fallbackShops: ShopConfig[]
): Promise<ShopConfig[]> {
  try {
    const res = await fetch(ecosystemApiUrl, {
      next: { revalidate: 300 },
    } as RequestInit);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.shops) && data.shops.length > 0) {
      console.log("[Ads] Loaded", data.shops.length, "shops from ecosystem API");
      return data.shops.map((s: ShopConfig) => ({
        name: s.name,
        url: s.url,
        origin: s.origin,
        max_products: s.max_products,
      }));
    }
    throw new Error("Empty or invalid response");
  } catch (err) {
    console.warn("[Ads] Ecosystem API unavailable, using fallback shops:", (err as Error).message);
    return fallbackShops;
  }
}

/**
 * Fix relative image URLs by prefixing with shop origin.
 */
function fixImageUrl(imageUrl: string, shopOrigin: string): string {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http")) return imageUrl;
  return `${shopOrigin}/${imageUrl.replace(/^\//, "")}`;
}

export type UseEcosystemProductsOptions = {
  /** URL of the central ecosystem shops API */
  ecosystemApiUrl?: string;
  /** Fallback shop list if ecosystem API is unavailable */
  fallbackShops?: ShopConfig[];
  /** Only fetch from these shop names (per-article filter) */
  shopFilter?: string[];
  /** Whether ads are enabled (skips fetching if false) */
  enabled?: boolean;
};

/**
 * Hook that fetches products from all ecosystem shops for ad embedding.
 * Returns a shuffled array of products from across the network.
 */
export function useEcosystemProducts(
  options?: UseEcosystemProductsOptions
): Product[] {
  const {
    ecosystemApiUrl = DEFAULT_ECOSYSTEM_API,
    fallbackShops = DEFAULT_FALLBACK_SHOPS,
    shopFilter,
    enabled = true,
  } = options || {};

  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!enabled) return;

    async function fetchProducts() {
      try {
        let shops = await resolveShops(ecosystemApiUrl, fallbackShops);

        // Apply per-article shop filter
        if (shopFilter && shopFilter.length > 0) {
          const filterLower = shopFilter.map((s) => s.toLowerCase());
          shops = shops.filter((s) => filterLower.includes(s.name.toLowerCase()));
        }

        if (shops.length === 0) {
          console.log("[Ads] No shops available after filtering");
          return;
        }

        // Fetch from all shops in parallel
        const allProducts: Product[] = [];
        const results = await Promise.allSettled(
          shops.map(async (shop) => {
            const limit = shop.max_products || 6;
            const res = await fetch(`${shop.url}?limit=${limit}`);
            if (!res.ok) return [];
            const data = await res.json();
            if (data.success && data.products?.length > 0) {
              return data.products.map((p: Product) => ({
                ...p,
                image_url: fixImageUrl(p.image_url, shop.origin),
              }));
            }
            return [];
          })
        );

        for (const result of results) {
          if (result.status === "fulfilled" && Array.isArray(result.value) && result.value.length > 0) {
            allProducts.push(...result.value);
          }
        }

        if (allProducts.length > 0) {
          console.log("[Ads] Loaded", allProducts.length, "products from", shops.length, "shops");
          setProducts(allProducts);
        }
      } catch (err) {
        console.error("[Ads] Error fetching ecosystem products:", err);
      }
    }

    fetchProducts();
  }, [enabled, ecosystemApiUrl, shopFilter?.join(",")]);

  return products;
}
