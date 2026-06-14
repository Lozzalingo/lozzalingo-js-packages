"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FaMapMarkerAlt,
  FaUsers,
  FaClock,
  FaLock,
  FaGlobe,
  FaTicketAlt,
  FaArrowRight,
} from "react-icons/fa";
import { useEventsConfig } from "../context/EventsProvider";
import { useProducts } from "../hooks/useProducts";
import { getImageUrl, getLowestPrice, parseThemes } from "../lib/utils";

export function EventsListingPage() {
  const { cdnBase, storageFolder, brand } = useEventsConfig();
  const { products, loading } = useProducts();
  const [filter, setFilter] = useState<"all" | "private" | "public">("all");

  const privateProducts = products.filter((p) => p.category !== "public-event");
  const publicProducts = products.filter((p) => p.category === "public-event");
  const eventsPath = brand.eventsPath || "/events";

  const displayed =
    filter === "private"
      ? privateProducts
      : filter === "public"
      ? publicProducts
      : products;

  const resolveImage = (filename?: string | null) => getImageUrl(filename, cdnBase, storageFolder);

  return (
    <main className="bg-white min-h-screen">
      {/* Hero */}
      <div className="shimmer-bg py-16">
        <div className="max-w-screen-xl mx-auto px-4 text-center text-white">
          <h1 className="font-poppins text-4xl md:text-5xl font-bold mb-4">
            {brand.heroTitle}
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            {brand.heroSubtitle}
          </p>
        </div>
      </div>

      {/* Filter Cards */}
      <div className="max-w-screen-xl mx-auto px-4 -mt-8 relative z-10">
        <div className="grid md:grid-cols-3 gap-4">
          <button
            onClick={() => setFilter("all")}
            className={`text-left p-5 rounded-xl shadow-md transition-all ${
              filter === "all"
                ? "bg-primary text-white scale-[1.02] shadow-lg"
                : "bg-white text-gray-900 hover:shadow-lg hover:-translate-y-0.5 border border-gray-200"
            }`}
            data-action="events_filter_all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${filter === "all" ? "bg-white/20" : "bg-primary bg-opacity-10"}`}>
                <FaMapMarkerAlt className={`text-lg ${filter === "all" ? "text-white" : "text-gray-700"}`} />
              </div>
              <div>
                <h3 className="font-poppins font-bold text-lg">All Events</h3>
                <span className={`text-xs ${filter === "all" ? "text-white/70" : "text-gray-500"}`}>
                  {products.length} total
                </span>
              </div>
            </div>
            <p className={`text-sm ${filter === "all" ? "text-white/80" : "text-gray-500"}`}>
              {brand.allFilterDesc}
            </p>
          </button>

          <button
            onClick={() => setFilter(filter === "private" ? "all" : "private")}
            className={`text-left p-5 rounded-xl shadow-md transition-all ${
              filter === "private"
                ? "bg-orange-500 text-white scale-[1.02] shadow-lg"
                : "bg-white text-gray-900 hover:shadow-lg hover:-translate-y-0.5 border border-gray-200"
            }`}
            data-action="events_filter_private"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${filter === "private" ? "bg-white/20" : "bg-orange-500 bg-opacity-10"}`}>
                <FaLock className={`text-lg ${filter === "private" ? "text-white" : "text-gray-700"}`} />
              </div>
              <div>
                <h3 className="font-poppins font-bold text-lg">Private Events</h3>
                <span className={`text-xs ${filter === "private" ? "text-white/70" : "text-gray-500"}`}>
                  {privateProducts.length} product{privateProducts.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <p className={`text-sm ${filter === "private" ? "text-white/80" : "text-gray-500"}`}>
              {brand.privateFilterDesc}
            </p>
          </button>

          <button
            onClick={() => setFilter(filter === "public" ? "all" : "public")}
            className={`text-left p-5 rounded-xl shadow-md transition-all ${
              filter === "public"
                ? "bg-emerald-500 text-white scale-[1.02] shadow-lg"
                : "bg-white text-gray-900 hover:shadow-lg hover:-translate-y-0.5 border border-gray-200"
            }`}
            data-action="events_filter_public"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${filter === "public" ? "bg-white/20" : "bg-emerald-500 bg-opacity-10"}`}>
                <FaGlobe className={`text-lg ${filter === "public" ? "text-white" : "text-gray-700"}`} />
              </div>
              <div>
                <h3 className="font-poppins font-bold text-lg">Public Events</h3>
                <span className={`text-xs ${filter === "public" ? "text-white/70" : "text-gray-500"}`}>
                  {publicProducts.length} event{publicProducts.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <p className={`text-sm ${filter === "public" ? "text-white/80" : "text-gray-500"}`}>
              {brand.publicFilterDesc}
            </p>
          </button>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-screen-xl mx-auto px-4 py-10">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-72 animate-pulse" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-4">No events found.</p>
            <button
              onClick={() => setFilter("all")}
              className="inline-flex items-center gap-2 bg-orange-500 text-white font-bold px-6 py-3 rounded-lg hover:bg-orange-600 transition"
              data-action="events_empty_show_all"
            >
              Show All Events
            </button>
          </div>
        ) : (
          <>
            {/* Private Products Section */}
            {(filter === "all" || filter === "private") && privateProducts.length > 0 && (
              <div className="mb-12">
                {filter === "all" && (
                  <h2 className="font-poppins text-2xl font-bold text-text-primary mb-6 flex items-center gap-2">
                    <FaLock className="text-orange-500 text-lg" /> Private Events
                  </h2>
                )}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {privateProducts.map((product) => {
                    const lowestPrice = getLowestPrice(product.packages);
                    const themes = parseThemes(product.themes);

                    return (
                      <Link
                        key={product.id}
                        href={`${eventsPath}/${product.slug}`}
                        className="group flex flex-col bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all hover:-translate-y-1 border border-gray-200"
                        data-action={`event_card_${product.slug}`}
                      >
                        <div className="relative h-52 shrink-0 overflow-hidden bg-gray-100">
                          {product.coverImage ? (
                            <img src={resolveImage(product.coverImage)} alt={product.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
                              <FaMapMarkerAlt className="text-5xl text-orange-300" />
                            </div>
                          )}
                          <span className="absolute top-3 right-3 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <FaLock className="text-[10px]" /> Private
                          </span>
                        </div>
                        <div className="p-5 flex-1">
                          <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-orange-500 transition-colors">
                            {product.name}
                          </h3>
                          {product.shortDesc && (
                            <p className="text-gray-500 text-sm mb-3 line-clamp-2">{product.shortDesc}</p>
                          )}
                          {themes.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {themes.slice(0, 4).map((theme) => (
                                <span key={theme} className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">{theme}</span>
                              ))}
                              {themes.length > 4 && (
                                <span className="text-xs text-gray-400">+{themes.length - 4} more</span>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                            {product.duration && (
                              <span className="flex items-center gap-1"><FaClock className="text-orange-400" /> {product.duration}</span>
                            )}
                            {product.maxGroupSize && (
                              <span className="flex items-center gap-1"><FaUsers className="text-orange-400" /> Up to {product.maxGroupSize.toLocaleString()}</span>
                            )}
                            {lowestPrice && (
                              <span className="font-semibold text-orange-500 ml-auto">From &pound;{(lowestPrice / 100).toFixed(0)}pp</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Public Events Section */}
            {(filter === "all" || filter === "public") && publicProducts.length > 0 && (
              <div>
                {filter === "all" && (
                  <h2 className="font-poppins text-2xl font-bold text-text-primary mb-6 flex items-center gap-2">
                    <FaGlobe className="text-emerald-500 text-lg" /> Public Events
                    {brand.publicPriceLabel && (
                      <span className="text-sm font-normal text-gray-500 ml-2">{brand.publicPriceLabel}</span>
                    )}
                  </h2>
                )}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {publicProducts.map((product) => {
                    const ticketPrice = getLowestPrice(product.packages.filter((p) => p.bookingType === "PUBLIC"));
                    return (
                      <Link
                        key={product.id}
                        href={`${eventsPath}/${product.slug}`}
                        className="group flex flex-col bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all hover:-translate-y-1 border border-gray-200"
                        data-action={`event_card_${product.slug}`}
                      >
                        <div className="relative h-44 shrink-0 overflow-hidden bg-gray-100">
                          {product.coverImage ? (
                            <img src={resolveImage(product.coverImage)} alt={product.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100">
                              <FaTicketAlt className="text-4xl text-emerald-300" />
                            </div>
                          )}
                          {ticketPrice && (
                            <span className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                              &pound;{(ticketPrice / 100).toFixed(0)}
                            </span>
                          )}
                          {product.ticketLimit && (
                            <span className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                              {product.ticketLimit} tickets
                            </span>
                          )}
                        </div>
                        <div className="p-4 flex-1">
                          <h3 className="font-bold text-gray-900 mb-1 group-hover:text-emerald-600 transition-colors">{product.name}</h3>
                          {product.shortDesc && (
                            <p className="text-gray-500 text-xs mb-3 line-clamp-2">{product.shortDesc}</p>
                          )}
                          {product.duration && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mb-3"><FaClock /> {product.duration}</p>
                          )}
                          <span className="inline-flex items-center gap-1.5 bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-lg w-full justify-center group-hover:bg-emerald-600 transition">
                            <FaTicketAlt className="text-xs" /> Buy Tickets
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* CTA Section */}
      {brand.ctaHref && (
        <div className="shimmer-bg py-12">
          <div className="max-w-screen-xl mx-auto px-4 text-center text-white">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">{brand.ctaHeading}</h2>
            <p className="text-white/70 mb-6 max-w-md mx-auto">{brand.ctaBody}</p>
            <Link
              href={brand.ctaHref}
              className="inline-flex items-center gap-2 bg-cta text-white font-bold px-8 py-3 rounded-xl hover:bg-cta-dark hover:scale-105 transition shadow-lg"
              data-action="events_cta_book_private"
            >
              {brand.ctaLabel} <FaArrowRight />
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
