"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FaClock,
  FaUsers,
  FaMapMarkerAlt,
  FaLock,
  FaGlobe,
  FaTicketAlt,
  FaMinus,
  FaPlus,
  FaEnvelope,
} from "react-icons/fa";
import { useEventsConfig } from "../context/EventsProvider";
import { useProduct } from "../hooks/useProducts";
import { useCheckout } from "../hooks/useCheckout";
import { EventGallery } from "../components/EventGallery";
import { EventSections } from "../components/EventSections";
import type { Venue } from "../components/EventSections";
import { getImageUrl, formatPrice, formatShortDate, formatTime, formatDateWithOrdinal, parseJson, parseThemes } from "../lib/utils";

// Try importing toast, fall back to alert if not available
let toast: { error: (msg: string) => void } | null = null;
try {
  toast = require("react-hot-toast").default;
} catch {
  toast = { error: (msg: string) => alert(msg) };
}

export type EventDetailPageProps = {
  /** Optional slug override (otherwise reads from URL params) */
  slug?: string;
  /** Optional custom booking form component for private events */
  renderPrivateBookingForm?: (props: { productSlug: string }) => React.ReactNode;
  /** URL param name for the slug, defaults to "eventSlug" */
  slugParam?: string;
};

export function EventDetailPage({ slug: slugProp, renderPrivateBookingForm, slugParam = "eventSlug" }: EventDetailPageProps) {
  const params = useParams();
  const slug = slugProp || (params[slugParam] as string);
  const { cdnBase, storageFolder, brand } = useEventsConfig();
  const { product, loading, notFound } = useProduct(slug);
  const { checkout, submitting } = useCheckout();

  const eventsPath = brand.eventsPath || "/events";
  const termsPath = brand.termsPath || "/terms";
  const backLabel = brand.backLabel || "All Events";

  // Booking mode toggle
  const [bookingMode, setBookingMode] = useState<"public" | "private">("public");
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null);
  const [ticketCount, setTicketCount] = useState(1);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [selectedPublicPackageSlug, setSelectedPublicPackageSlug] = useState<string | null>(null);

  const resolveImage = (filename?: string | null) => getImageUrl(filename, cdnBase, storageFolder);

  // Computed values
  const isPublicEvent = product?.category === "public-event";
  const themes = useMemo(() => parseThemes(product?.themes || null), [product?.themes]);
  const venue = useMemo(() => parseJson<Venue>(product?.venue || null), [product?.venue]);

  const privatePackages = useMemo(
    () => product?.packages.filter((p) => p.bookingType === "PRIVATE") || [],
    [product?.packages]
  );
  const publicPackages = useMemo(
    () => product?.packages.filter((p) => p.bookingType === "PUBLIC") || [],
    [product?.packages]
  );
  const publicPackage = useMemo(
    () => publicPackages.find((p) => p.pricePerPerson) || publicPackages[0] || null,
    [publicPackages]
  );
  const selectedPublicPackage = useMemo(
    () => publicPackages.find((p) => p.slug === selectedPublicPackageSlug) || null,
    [publicPackages, selectedPublicPackageSlug]
  );

  const calendarDates = useMemo(() => product?.calendarEvents || [], [product]);
  const selectedDate = useMemo(() => calendarDates.find((d) => d.id === selectedDateId) || null, [calendarDates, selectedDateId]);

  const galleryImages = useMemo(
    () => (product?.images || []).map((img) => resolveImage(img.url)),
    [product?.images, cdnBase, storageFolder]
  );

  const lowestPrice = useMemo(() => {
    const prices = (product?.packages || []).filter((p) => p.pricePerPerson).map((p) => p.pricePerPerson as number);
    return prices.length > 0 ? Math.min(...prices) : null;
  }, [product?.packages]);

  const hasPrivate = privatePackages.length > 0;
  const hasPublic = !!publicPackage;
  const bookingTypeLabel = hasPrivate && hasPublic ? "Private & Public" : hasPrivate ? "Private" : "Public";

  const ticketPrice = selectedPublicPackage?.pricePerPerson || publicPackage?.pricePerPerson || 0;
  const totalPrice = ticketPrice * ticketCount;

  useEffect(() => { setBookingMode(hasPublic ? "public" : "private"); }, [hasPublic]);

  useEffect(() => {
    if (publicPackages.length > 0 && !selectedPublicPackageSlug) {
      const withPrice = publicPackages.find((p) => p.pricePerPerson);
      setSelectedPublicPackageSlug((withPrice || publicPackages[0]).slug);
    }
  }, [publicPackages, selectedPublicPackageSlug]);

  const handleBuyTickets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !selectedDate) return;

    const checkoutPkg = selectedPublicPackage || publicPackage;
    if (!checkoutPkg) return;

    if (!email.trim()) { toast?.error("Please enter your email address."); return; }
    if (!firstName.trim() || !lastName.trim()) { toast?.error("Please enter your full name."); return; }
    if (!agreeTerms) { toast?.error("Please agree to the terms and conditions."); return; }

    const result = await checkout({
      eventTitle: `${product.name} - ${formatShortDate(selectedDate.startTime)}`,
      priceInPence: totalPrice,
      customerEmail: email.trim(),
      customerName: `${firstName.trim()} ${lastName.trim()}`,
      groupSize: ticketCount,
      eventDate: selectedDate.startTime,
      productSlug: product.slug,
      packageSlug: checkoutPkg.slug,
    });

    if (result.url) {
      window.location.href = result.url;
    } else if (result.error) {
      toast?.error(result.error);
    }
  };

  // --- Render states ---

  if (loading) {
    return (
      <main className="bg-white min-h-screen">
        <div className="h-80 bg-gray-200 animate-pulse" />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
        </div>
      </main>
    );
  }

  if (notFound || !product) {
    return (
      <main className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Event Not Found</h1>
          <p className="text-gray-500 mb-6">The event you are looking for does not exist or has been removed.</p>
          <Link href={eventsPath} className="text-primary font-semibold hover:underline" data-action="not_found_back_events">
            &larr; {backLabel}
          </Link>
        </div>
      </main>
    );
  }

  const imageSrc = resolveImage(product.coverImage);
  const hasStructuredSections = product.sections && product.sections.length > 0;
  const hasGallerySection = hasStructuredSections && product.sections.some((s) => s.type === "gallery");
  const hasThemesSection = hasStructuredSections && product.sections.some((s) => s.type === "themes");
  const hasVenueSection = hasStructuredSections && product.sections.some((s) => s.type === "venue");
  const showLegacyGallery = !hasGallerySection && galleryImages.length > 0;

  return (
    <main className="bg-white min-h-screen pb-16">
      {/* Hero */}
      <div className="relative w-full h-64 md:h-[350px]">
        {imageSrc ? (
          <img src={imageSrc} alt={product.name} className="w-full h-full object-cover brightness-75" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${isPublicEvent ? "bg-gradient-to-br from-emerald-400 to-emerald-600" : "bg-gradient-to-br from-primary to-primary-dark"}`}>
            {isPublicEvent ? <FaTicketAlt className="text-8xl text-white/30" /> : <FaMapMarkerAlt className="text-8xl text-white/30" />}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/70" />
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 text-white">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl md:text-4xl font-bold mb-2">{product.name}</h1>
            <div className="flex flex-wrap gap-3 text-white/80 items-center text-sm">
              <span className="flex items-center gap-1.5 bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">{bookingTypeLabel}</span>
              {product.duration && <span className="flex items-center gap-2"><FaClock /> {product.duration}</span>}
              {product.maxGroupSize && <span className="flex items-center gap-2"><FaUsers /> 4-{product.maxGroupSize.toLocaleString()}+ people</span>}
              {lowestPrice && <span className="font-bold text-white text-lg">From &pound;{(lowestPrice / 100).toFixed(0)} per person</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Main Content Card */}
        <div className="bg-white shadow-xl rounded-xl overflow-hidden -mt-12 relative z-10 border border-border">
          <div className="p-5 md:p-6">
            {showLegacyGallery && (
              <div className="mb-5 pb-5 border-b border-border">
                <EventGallery images={galleryImages} title={product.name} />
              </div>
            )}

            {(product.shortDesc || product.description) && (
              <div className="prose prose-sm max-w-none prose-headings:text-text-primary prose-p:text-text-secondary mb-4" dangerouslySetInnerHTML={{ __html: product.shortDesc || product.description }} />
            )}

            {!hasThemesSection && themes.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {themes.map((theme) => (
                  <span key={theme} className="inline-flex items-center bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-medium">{theme}</span>
                ))}
              </div>
            )}

            {!hasVenueSection && venue && (
              <div className={`rounded-lg p-3 border mb-4 flex items-center gap-3 ${isPublicEvent ? "bg-red-500/10 border-red-500/20" : "bg-gray-50 border-border"}`}>
                <FaMapMarkerAlt className={`flex-shrink-0 ${isPublicEvent ? "text-red-400" : "text-primary"}`} />
                <div className="text-sm">
                  <span className={`font-bold ${isPublicEvent ? "text-red-700" : "text-text-primary"}`}>{venue.name}</span>
                  <span className={isPublicEvent ? "text-red-600" : "text-text-secondary"}> - {venue.address}</span>
                  {venue.nearestStation && <span className={isPublicEvent ? "text-red-600" : "text-text-secondary"}> (Nearest: {venue.nearestStation})</span>}
                </div>
              </div>
            )}

            {hasStructuredSections && (
              <EventSections
                sections={product.sections}
                galleryImages={galleryImages}
                themes={themes}
                venue={venue}
                productName={product.name}
                isPublicEvent={!!isPublicEvent}
              />
            )}
          </div>
        </div>

        {/* Booking Section */}
        {(hasPublic || hasPrivate) && (
          <div className="mt-5 bg-white shadow-xl rounded-xl border border-border p-5 md:p-6">
            {hasPublic && hasPrivate && (
              <div className="flex rounded-lg border border-border overflow-hidden mb-6">
                <button type="button" onClick={() => setBookingMode("public")} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-bold text-sm transition ${bookingMode === "public" ? "bg-emerald-500 text-white" : "bg-gray-50 text-text-secondary hover:bg-gray-100"}`} data-action="toggle_public_booking">
                  <FaTicketAlt /> Buy Public Tickets
                </button>
                <button type="button" onClick={() => setBookingMode("private")} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-bold text-sm transition ${bookingMode === "private" ? "bg-primary text-white" : "bg-gray-50 text-text-secondary hover:bg-gray-100"}`} data-action="toggle_private_booking">
                  <FaLock /> Book Private Event
                </button>
              </div>
            )}

            {/* PUBLIC TICKETS */}
            {hasPublic && (bookingMode === "public" || !hasPrivate) && (
              <>
                <h2 className="text-2xl font-bold text-text-primary mb-1 flex items-center gap-2">
                  <FaTicketAlt className="text-emerald-500" /> Buy Tickets
                </h2>
                <p className="text-text-secondary text-sm mb-6">
                  {ticketPrice > 0 ? `\u00A3${(ticketPrice / 100).toFixed(0)} per person. Secure your spot now.` : "Secure your spot now."}
                </p>

                <div className="space-y-5">
                  {/* Date selection */}
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">Choose a date</label>
                    {calendarDates.length === 0 ? (
                      <div className="bg-gray-50 rounded-lg border border-border p-4 text-center">
                        <p className="text-text-secondary text-sm">No dates currently available for this event. Check back soon.</p>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {calendarDates.map((d) => (
                          <button key={d.id} type="button" onClick={() => { setSelectedDateId(d.id); setTicketCount(1); }}
                            className={`text-left px-4 py-3 rounded-lg border transition-all ${selectedDateId === d.id ? "border-emerald-500 ring-2 ring-emerald-500 bg-emerald-50" : "border-border hover:border-emerald-300 bg-white"}`}
                            data-action={`event_select_date_${d.id}`}>
                            <p className="font-bold text-sm text-text-primary">{formatDateWithOrdinal(d.startTime)}</p>
                            <p className="text-xs text-text-secondary mt-0.5">{formatTime(d.startTime)} - {formatTime(d.endTime)}{d.locationName && ` - ${d.locationName}`}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ticket type selection */}
                  {selectedDate && publicPackages.length > 1 && (
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-2">Ticket type</label>
                      <div className="space-y-2">
                        {publicPackages.map((pkg) => (
                          <div key={pkg.id} className={`rounded-lg border p-4 transition-all cursor-pointer ${selectedPublicPackageSlug === pkg.slug ? "border-emerald-500 ring-2 ring-emerald-500 bg-emerald-50" : "border-border hover:border-emerald-300"}`}
                            onClick={() => { setSelectedPublicPackageSlug(pkg.slug); setTicketCount(1); }} role="button" tabIndex={0}
                            data-action={`event_select_pkg_${pkg.slug}`}>
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-bold text-text-primary">{pkg.name}</p>
                                {pkg.description && <p className="text-xs text-text-secondary mt-0.5">{pkg.description}</p>}
                              </div>
                              <p className="font-bold text-text-primary flex-shrink-0 ml-4">{pkg.pricePerPerson ? formatPrice(pkg.pricePerPerson) : "Free"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ticket quantity */}
                  {selectedDate && (selectedPublicPackage || publicPackages.length === 1) && (
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-2">Number of tickets</label>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setTicketCount((c) => Math.max(1, c - 1))} disabled={ticketCount <= 1}
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-text-secondary hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed" data-action="event_tickets_decrease">
                          <FaMinus className="text-xs" />
                        </button>
                        <span className="text-lg font-bold text-text-primary min-w-[24px] text-center">{ticketCount}</span>
                        <button type="button" onClick={() => setTicketCount((c) => c + 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-text-secondary hover:bg-gray-50 transition" data-action="event_tickets_increase">
                          <FaPlus className="text-xs" />
                        </button>
                        {ticketCount > 0 && ticketPrice > 0 && (
                          <p className="text-sm font-bold text-text-primary ml-auto">{formatPrice(totalPrice)}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Checkout form */}
                  {selectedDate && (selectedPublicPackage || publicPackages.length === 1) && ticketCount > 0 && (
                    <form onSubmit={handleBuyTickets} className="space-y-4 border-t border-border pt-5">
                      <div className="p-4 bg-gray-50 rounded-lg border border-border">
                        <div className="flex justify-between text-sm text-text-secondary mb-1">
                          <span>{product.name}</span>
                          <span>{formatPrice(ticketPrice)} / person</span>
                        </div>
                        <div className="flex justify-between text-sm text-text-secondary mb-1">
                          <span>{formatShortDate(selectedDate.startTime)}, {formatTime(selectedDate.startTime)}</span>
                          <span>&times; {ticketCount}</span>
                        </div>
                        {selectedDate.locationName && (
                          <p className="text-xs text-text-secondary flex items-center gap-1 mb-1"><FaMapMarkerAlt className="text-[10px]" /> {selectedDate.locationName}</p>
                        )}
                        <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold text-text-primary text-lg">
                          <span>Total</span>
                          <span>{formatPrice(totalPrice)}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">Email *</label>
                        <div className="relative">
                          <FaEnvelope className="absolute left-3 top-3 text-text-secondary text-sm" />
                          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm" placeholder="jane@example.com" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-text-primary mb-1">First Name *</label>
                          <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg border border-border focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm" placeholder="Jane" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-primary mb-1">Last Name *</label>
                          <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg border border-border focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm" placeholder="Smith" />
                        </div>
                      </div>

                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-1 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
                        <span className="text-xs text-text-secondary">{brand.marketingOptInText}</span>
                      </label>

                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-1 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" required />
                        <span className="text-xs text-text-secondary">
                          By buying this ticket, you agree to our{" "}
                          <Link href={termsPath} className="text-primary hover:underline" target="_blank" data-action="event_terms_link">terms and conditions</Link>.
                        </span>
                      </label>

                      <button type="submit" disabled={submitting || !agreeTerms}
                        className="w-full bg-cta text-white font-bold py-3.5 rounded-lg hover:bg-cta-dark transition disabled:opacity-50 disabled:cursor-not-allowed text-base flex items-center justify-center gap-2"
                        data-action="event_buy_tickets_submit">
                        <FaLock className="text-sm" />
                        {submitting ? "Redirecting to payment..." : `Book tickets - ${formatPrice(totalPrice)}`}
                      </button>

                      <p className="text-center text-text-secondary text-xs flex items-center justify-center gap-1">
                        <FaLock className="text-[10px]" /> Secure payment powered by Stripe
                      </p>
                    </form>
                  )}
                </div>
              </>
            )}

            {/* PRIVATE BOOKING */}
            {hasPrivate && (bookingMode === "private" || !hasPublic) && (
              renderPrivateBookingForm
                ? renderPrivateBookingForm({ productSlug: product.slug })
                : <p className="text-text-secondary text-sm">Please contact us to book a private event.</p>
            )}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href={eventsPath} className="text-primary font-semibold hover:text-primary-dark transition" data-action="back_to_events">
            &larr; {backLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
