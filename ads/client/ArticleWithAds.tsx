"use client";

import React from "react";
import { useEcosystemProducts } from "./useEcosystemProducts";
import type { UseEcosystemProductsOptions } from "./useEcosystemProducts";
import type { ShopConfig } from "./types";
import ProductCard from "./ProductCard";

export type ArticleWithAdsProps = {
  /** Pre-split content chunks (from splitContentForAds) */
  contentChunks: string[];

  /** Whether product ads are enabled for this article (default: true) */
  adsEnabled?: boolean;

  /** Only show products from these shops (per-article control) */
  adsShops?: string[];

  /** URL of the central ecosystem shops API */
  ecosystemApiUrl?: string;

  /** Fallback shop list if ecosystem API is unavailable */
  fallbackShops?: ShopConfig[];

  /** Hide the self-promo/inline ad slot entirely */
  hideInlineAd?: boolean;

  /** Custom self-promo content rendered at the self-promo marker position */
  selfPromoContent?: React.ReactNode;

  /** The marker string for self-promo slots (default: "__SELF_PROMO_AD__") */
  selfPromoMarker?: string;
};

/**
 * Renders article HTML content with inline product ads and optional self-promo.
 *
 * Fetches products from the ecosystem once, then distributes them
 * across ad slots between content chunks.
 *
 * Mirrors the Python framework's product_ads.html template behaviour.
 */
export default function ArticleWithAds({
  contentChunks,
  adsEnabled = true,
  adsShops,
  ecosystemApiUrl,
  fallbackShops,
  hideInlineAd = false,
  selfPromoContent,
  selfPromoMarker = "__SELF_PROMO_AD__",
}: ArticleWithAdsProps) {
  const productOptions: UseEcosystemProductsOptions = {
    ecosystemApiUrl,
    fallbackShops,
    shopFilter: adsShops,
    enabled: adsEnabled,
  };

  const products = useEcosystemProducts(productOptions);

  let productIndex = 0;

  return (
    <>
      {contentChunks.map((chunk, i) => {
        // Self-promo marker slot
        if (chunk === selfPromoMarker || chunk === "__AI_BLOG_BUILDER_AD__") {
          if (hideInlineAd) return null;

          // Render custom self-promo content if provided
          if (selfPromoContent) {
            return (
              <div key={`promo-${i}`} className="my-8">
                {selfPromoContent}
              </div>
            );
          }

          // Default self-promo (Blog Builder AI)
          return (
            <div key={`promo-${i}`} className="my-8">
              <style dangerouslySetInnerHTML={{ __html: `@keyframes nudge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(6px); } }` }} />
              <div className="p-4 sm:p-6 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50">
                <div className="flex items-center gap-3 sm:gap-5">
                  <div className="hidden sm:block flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden">
                    <img src="/logo.png" alt="Blog Builder AI" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="sm:hidden flex-shrink-0 w-6 h-6 rounded overflow-hidden">
                        <img src="/logo.png" alt="Blog Builder AI" className="w-full h-full object-contain" />
                      </div>
                      <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide !mb-0">Blog Builder AI</p>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm sm:text-base !mb-1">Create articles like this in minutes</p>
                    <p className="text-gray-500 text-xs sm:text-sm !mb-0 hidden sm:block">Turn YouTube videos, web pages, or research into polished blog posts with AI</p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3">
                    <span className="text-indigo-400 text-xl sm:text-2xl" style={{ animation: "nudge 1.5s ease-in-out infinite" }}>&rarr;</span>
                    <a
                      href="https://blogbuilderai.com/pricing"
                      className="bg-indigo-600 text-white px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold hover:bg-indigo-700 transition-colors no-underline whitespace-nowrap shadow-[0_0_15px_rgba(79,70,229,0.4)] hover:shadow-[0_0_25px_rgba(79,70,229,0.6)]"
                      data-action="news_inline_cta_try_now"
                    >
                      Try Now
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // Regular content chunk - render it, then optionally show a product ad after
        const showProductAd =
          adsEnabled &&
          products.length > 0 &&
          i < contentChunks.length - 1 &&
          contentChunks[i + 1] !== selfPromoMarker &&
          contentChunks[i + 1] !== "__AI_BLOG_BUILDER_AD__";

        const currentProductIndex = productIndex;
        if (showProductAd) productIndex++;

        return (
          <div key={`chunk-${i}`}>
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: chunk }}
            />
            {showProductAd && (
              <ProductCard product={products[currentProductIndex % products.length]} />
            )}
          </div>
        );
      })}
    </>
  );
}
