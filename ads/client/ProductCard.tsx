"use client";

import React from "react";
import type { Product } from "./types";

/**
 * Inline product ad card for cross-site embedding.
 * Horizontal layout with image, name, price, and "View" CTA.
 */
export default function ProductCard({ product }: { product: Product }) {
  return (
    <a
      href={product.product_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block my-8 no-underline"
      data-product-ad={product.id}
    >
      <div className="flex items-center gap-4 sm:gap-5 p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white hover:shadow-md hover:border-gray-300 transition-all duration-300">
        <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden">
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-1">
            {product.shop_name || "Recommended"}
          </p>
          <p className="font-semibold text-gray-900 text-sm sm:text-base line-clamp-1 group-hover:text-blue-600 transition-colors !mb-1">
            {product.name}
          </p>
          <p className="text-gray-500 text-xs sm:text-sm line-clamp-1 !mb-0">
            {product.description}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="font-bold text-gray-900 text-base sm:text-lg !mb-0">
            {product.price_display}
          </p>
          <p className="text-xs text-blue-600 group-hover:text-blue-700 transition-colors !mb-0 hidden sm:block">
            View &rarr;
          </p>
        </div>
      </div>
    </a>
  );
}
