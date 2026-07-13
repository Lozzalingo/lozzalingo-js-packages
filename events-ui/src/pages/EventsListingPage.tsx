"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FaMapMarkerAlt,
  FaUsers,
  FaClock,
  FaLock,
  FaGlobe,
  FaTicketAlt,
  FaArrowRight,
  FaBuilding,
  FaLaptop,
  FaTree,
  FaHome,
  FaExchangeAlt,
} from "react-icons/fa";
import { useEventsConfig } from "../context/EventsProvider";
import type { CategoryFilter } from "../context/EventsProvider";
import { useProducts } from "../hooks/useProducts";
import type { Product } from "../hooks/useProducts";
import { getImageUrl, getLowestPrice, parseThemes } from "../lib/utils";

const FORMAT_OPTIONS: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: "in-person", label: "In-Person", icon: <FaBuilding /> },
  { value: "virtual", label: "Virtual", icon: <FaLaptop /> },
  { value: "outdoors", label: "Outdoors", icon: <FaTree /> },
  { value: "indoors", label: "Indoors", icon: <FaHome /> },
  { value: "hybrid", label: "Hybrid", icon: <FaExchangeAlt /> },
];

/** Check whether a product matches a format filter.
 *  Products with format "customer-choice" match both "in-person" and "virtual". */
function matchesFormat(product: Product, fmt: string): boolean {
  if (!product.format) return false;
  if (product.format === fmt) return true;
  if (product.format === "customer-choice" && (fmt === "in-person" || fmt === "virtual")) return true;
  return false;
}

/** Check whether a product matches a category filter */
function matchesFilter(product: Product, cf: CategoryFilter): boolean {
  const cats = Array.isArray(cf.categories) ? cf.categories : [cf.categories];
  return cats.includes(product.category || "");
}

/** Reusable product card for category-filter mode */
function ProductCard({
  product,
  eventsPath,
  resolveImage,
}: {
  product: Product;
  eventsPath: string;
  resolveImage: (filename?: string | null) => string;
}) {
  const lowestPrice = getLowestPrice(product.packages);
  const themes = parseThemes(product.themes);
  const isPublic = product.category === "public-event";
  const ticketPrice = isPublic
    ? getLowestPrice(product.packages.filter((p) => p.bookingType === "PUBLIC"))
    : null;

  return (
    <Link
      href={`${eventsPath}/${product.slug}`}
      className="group flex flex-col bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all hover:-translate-y-1 border border-gray-200"
      data-action={`event_card_${product.slug}`}
    >
      <div className="relative h-52 shrink-0 overflow-hidden bg-gray-100">
        {product.coverImage ? (
          <img
            src={resolveImage(product.coverImage)}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <FaMapMarkerAlt className="text-5xl text-gray-300" />
          </div>
        )}
        {isPublic && ticketPrice && (
          <span className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            &pound;{(ticketPrice / 100).toFixed(0)}
          </span>
        )}
        {isPublic && product.ticketLimit && (
          <span className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            {product.ticketLimit} tickets
          </span>
        )}
        {!isPublic && product.format && (
          <span className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full capitalize">
            {product.format === "customer-choice" ? "In-Person / Virtual" : product.format}
          </span>
        )}
      </div>
      <div className="p-5 flex-1">
        <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        {product.shortDesc && (
          <p className="text-gray-500 text-sm mb-3 line-clamp-2">{product.shortDesc}</p>
        )}
        {themes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {themes.slice(0, 4).map((theme) => (
              <span key={theme} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {theme}
              </span>
            ))}
            {themes.length > 4 && (
              <span className="text-xs text-gray-400">+{themes.length - 4} more</span>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-sm text-gray-500">
          {product.duration && (
            <span className="flex items-center gap-1">
              <FaClock className="text-primary/60" /> {product.duration}
            </span>
          )}
          {product.maxGroupSize && (
            <span className="flex items-center gap-1">
              <FaUsers className="text-primary/60" /> Up to {product.maxGroupSize.toLocaleString()}
            </span>
          )}
          {lowestPrice && (
            <span className="font-semibold text-primary ml-auto">
              From &pound;{(lowestPrice / 100).toFixed(0)}pp
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function EventsListingPage() {
  const { cdnBase, storageFolder, brand } = useEventsConfig();
  const { products, loading } = useProducts();
  const [filter, setFilter] = useState<string>("all");
  const [accessFilter, setAccessFilter] = useState<string | null>(null); // "private" | "public" | null
  const [formatFilter, setFormatFilter] = useState<string | null>(null);

  const hasCategoryFilters = brand.categoryFilters && brand.categoryFilters.length > 0;

  // Private vs public split
  const privateProducts = products.filter((p) => p.category !== "public-event");
  const publicProducts = products.filter((p) => p.category === "public-event");
  const hasPublicProducts = publicProducts.length > 0;
  const hasPrivateProducts = privateProducts.length > 0;
  const hasBothAccessTypes = hasPublicProducts && hasPrivateProducts;
  const eventsPath = brand.eventsPath || "/events";

  // Apply access filter to get the base pool of products
  const accessFiltered = useMemo(() => {
    if (!accessFilter) return products;
    if (accessFilter === "private") return privateProducts;
    if (accessFilter === "public") return publicProducts;
    return products;
  }, [accessFilter, products, privateProducts, publicProducts]);

  // Category-mode: compute counts from access-filtered products
  const categoryFilterCounts = useMemo(() => {
    if (!hasCategoryFilters) return {};
    const counts: Record<string, number> = {};
    for (const cf of brand.categoryFilters!) {
      counts[cf.key] = accessFiltered.filter((p) => matchesFilter(p, cf)).length;
    }
    return counts;
  }, [accessFiltered, brand.categoryFilters, hasCategoryFilters]);

  // Compute displayed products based on all three filter dimensions
  const displayed = useMemo(() => {
    let result: Product[];
    if (filter === "all") {
      result = accessFiltered;
    } else if (hasCategoryFilters) {
      const cf = brand.categoryFilters!.find((f) => f.key === filter);
      result = cf ? accessFiltered.filter((p) => matchesFilter(p, cf)) : accessFiltered;
    } else if (filter === "private") {
      result = privateProducts;
    } else if (filter === "public") {
      result = publicProducts;
    } else {
      result = accessFiltered;
    }
    // Apply format filter if active
    if (formatFilter) {
      result = result.filter((p) => matchesFormat(p, formatFilter));
    }
    return result;
  }, [filter, accessFilter, formatFilter, accessFiltered, products, privateProducts, publicProducts, hasCategoryFilters, brand.categoryFilters]);

  // Count products per format (from category + access filtered results, before format filter)
  const formatCounts = useMemo(() => {
    let base: Product[];
    if (filter === "all") {
      base = accessFiltered;
    } else if (hasCategoryFilters) {
      const cf = brand.categoryFilters!.find((f) => f.key === filter);
      base = cf ? accessFiltered.filter((p) => matchesFilter(p, cf)) : accessFiltered;
    } else if (filter === "private") {
      base = privateProducts;
    } else if (filter === "public") {
      base = publicProducts;
    } else {
      base = accessFiltered;
    }
    const counts: Record<string, number> = {};
    for (const fmt of FORMAT_OPTIONS) {
      counts[fmt.value] = base.filter((p) => matchesFormat(p, fmt.value)).length;
    }
    return counts;
  }, [filter, accessFiltered, products, privateProducts, publicProducts, hasCategoryFilters, brand.categoryFilters]);

  const hasAnyFormats = Object.values(formatCounts).some((c) => c > 0);

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
        {hasCategoryFilters ? (
          /* ── Custom category filters ── */
          <div className={`grid gap-4 ${
            (brand.categoryFilters!.length + 1) <= 3
              ? "md:grid-cols-3"
              : (brand.categoryFilters!.length + 1) <= 4
              ? "md:grid-cols-4"
              : "md:grid-cols-3 lg:grid-cols-5"
          }`}>
            {/* "All" card is always first */}
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

            {/* Category filter cards */}
            {brand.categoryFilters!.map((cf) => {
              const isActive = filter === cf.key;
              const activeColour = cf.colour || "bg-primary";
              const count = categoryFilterCounts[cf.key] || 0;

              return (
                <button
                  key={cf.key}
                  onClick={() => setFilter(isActive ? "all" : cf.key)}
                  className={`text-left p-5 rounded-xl shadow-md transition-all ${
                    isActive
                      ? `${activeColour} text-white scale-[1.02] shadow-lg`
                      : "bg-white text-gray-900 hover:shadow-lg hover:-translate-y-0.5 border border-gray-200"
                  }`}
                  data-action={`events_filter_${cf.key}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? "bg-white/20" : `${activeColour} bg-opacity-10`}`}>
                      {cf.icon ? (
                        <span className={`text-lg ${isActive ? "text-white" : "text-gray-700"}`}>{cf.icon}</span>
                      ) : (
                        <FaMapMarkerAlt className={`text-lg ${isActive ? "text-white" : "text-gray-700"}`} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-poppins font-bold text-lg">{cf.label}</h3>
                      <span className={`text-xs ${isActive ? "text-white/70" : "text-gray-500"}`}>
                        {count} event{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  {cf.description && (
                    <p className={`text-sm ${isActive ? "text-white/80" : "text-gray-500"}`}>
                      {cf.description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          /* ── Legacy Private / Public filters ── */
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
                  ? "bg-primary text-white scale-[1.02] shadow-lg"
                  : "bg-white text-gray-900 hover:shadow-lg hover:-translate-y-0.5 border border-gray-200"
              }`}
              data-action="events_filter_private"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${filter === "private" ? "bg-white/20" : "bg-primary bg-opacity-10"}`}>
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
        )}
      </div>

      {/* Private/Public + Format Filter Pills */}
      {(hasBothAccessTypes || hasAnyFormats) && (
        <div className="max-w-screen-xl mx-auto px-4 mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          {/* Private/Public toggle - only show when both types exist */}
          {hasBothAccessTypes && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 mr-1">Type:</span>
              <button
                onClick={() => setAccessFilter(accessFilter === "private" ? null : "private")}
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-all ${
                  accessFilter === "private"
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                }`}
                data-action="events_access_private"
              >
                <FaLock className="text-xs" />
                Private
                <span className={`text-xs ${accessFilter === "private" ? "text-white/70" : "text-gray-400"}`}>({privateProducts.length})</span>
              </button>
              <button
                onClick={() => setAccessFilter(accessFilter === "public" ? null : "public")}
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-all ${
                  accessFilter === "public"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                }`}
                data-action="events_access_public"
              >
                <FaGlobe className="text-xs" />
                Public
                <span className={`text-xs ${accessFilter === "public" ? "text-white/70" : "text-gray-400"}`}>({publicProducts.length})</span>
              </button>
              {accessFilter && (
                <button
                  onClick={() => setAccessFilter(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                  data-action="events_access_clear"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Format pills */}
          {hasAnyFormats && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 mr-1">Format:</span>
              {FORMAT_OPTIONS.map((fmt) => {
                const count = formatCounts[fmt.value];
                if (count === 0) return null;
                const isActive = formatFilter === fmt.value;
                return (
                  <button
                    key={fmt.value}
                    onClick={() => setFormatFilter(isActive ? null : fmt.value)}
                    className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-all ${
                      isActive
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                    }`}
                    data-action={`events_format_${fmt.value}`}
                  >
                    <span className="text-xs">{fmt.icon}</span>
                    {fmt.label}
                    <span className={`text-xs ${isActive ? "text-white/70" : "text-gray-400"}`}>({count})</span>
                  </button>
                );
              })}
              {formatFilter && (
                <button
                  onClick={() => setFormatFilter(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                  data-action="events_format_clear"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      )}


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
              onClick={() => { setFilter("all"); setAccessFilter(null); setFormatFilter(null); }}
              className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-lg hover:bg-primary-dark transition"
              data-action="events_empty_show_all"
            >
              Show All Events
            </button>
          </div>
        ) : hasCategoryFilters ? (
          /* ── Category filter mode: single flat grid ── */
          <>
            {/* Section headings when viewing "all" - group by category filter */}
            {filter === "all" ? (
              <>
                {brand.categoryFilters!.map((cf) => {
                  let sectionProducts = accessFiltered.filter((p) => matchesFilter(p, cf));
                  if (formatFilter) sectionProducts = sectionProducts.filter((p) => matchesFormat(p, formatFilter));
                  if (sectionProducts.length === 0) return null;
                  return (
                    <div key={cf.key} className="mb-12">
                      <h2 className="font-poppins text-2xl font-bold text-text-primary mb-6 flex items-center gap-2">
                        {cf.icon && <span className="text-lg">{cf.icon}</span>}
                        {cf.label}
                      </h2>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sectionProducts.map((product) => (
                          <ProductCard key={product.id} product={product} eventsPath={eventsPath} resolveImage={resolveImage} />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {/* Uncategorised products (not matching any filter) */}
                {(() => {
                  const categorised = new Set(
                    brand.categoryFilters!.flatMap((cf) =>
                      accessFiltered.filter((p) => matchesFilter(p, cf)).map((p) => p.id)
                    )
                  );
                  let uncategorised = accessFiltered.filter((p) => !categorised.has(p.id));
                  if (formatFilter) uncategorised = uncategorised.filter((p) => matchesFormat(p, formatFilter));
                  if (uncategorised.length === 0) return null;
                  return (
                    <div className="mb-12">
                      <h2 className="font-poppins text-2xl font-bold text-text-primary mb-6">
                        Other Events
                      </h2>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {uncategorised.map((product) => (
                          <ProductCard key={product.id} product={product} eventsPath={eventsPath} resolveImage={resolveImage} />
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              /* Filtered view: single grid */
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayed.map((product) => (
                  <ProductCard key={product.id} product={product} eventsPath={eventsPath} resolveImage={resolveImage} />
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── Legacy Private / Public mode ── */
          <>
            {/* Private Products Section */}
            {(filter === "all" || filter === "private") && privateProducts.length > 0 && (
              <div className="mb-12">
                {filter === "all" && (
                  <h2 className="font-poppins text-2xl font-bold text-text-primary mb-6 flex items-center gap-2">
                    <FaLock className="text-primary text-lg" /> Private Events
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
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                              <FaMapMarkerAlt className="text-5xl text-primary/40" />
                            </div>
                          )}
                          <span className="absolute top-3 right-3 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <FaLock className="text-[10px]" /> Private
                          </span>
                        </div>
                        <div className="p-5 flex-1">
                          <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-primary transition-colors">
                            {product.name}
                          </h3>
                          {product.shortDesc && (
                            <p className="text-gray-500 text-sm mb-3 line-clamp-2">{product.shortDesc}</p>
                          )}
                          {themes.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {themes.slice(0, 4).map((theme) => (
                                <span key={theme} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{theme}</span>
                              ))}
                              {themes.length > 4 && (
                                <span className="text-xs text-gray-400">+{themes.length - 4} more</span>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                            {product.duration && (
                              <span className="flex items-center gap-1"><FaClock className="text-primary/70" /> {product.duration}</span>
                            )}
                            {product.maxGroupSize && (
                              <span className="flex items-center gap-1"><FaUsers className="text-primary/70" /> Up to {product.maxGroupSize.toLocaleString()}</span>
                            )}
                            {lowestPrice && (
                              <span className="font-semibold text-primary ml-auto">From &pound;{(lowestPrice / 100).toFixed(0)}pp</span>
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
