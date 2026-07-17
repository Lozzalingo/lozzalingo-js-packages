"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { FaChevronLeft, FaChevronRight, FaTimes } from "react-icons/fa";

export type EventGalleryProps = {
  images: string[];
  title: string;
};

export function EventGallery({ images, title }: EventGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!images || images.length === 0) return null;

  function openLightbox(index: number) {
    setLightboxIndex(index % images.length);
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    setLightboxIndex(null);
    document.body.style.overflow = "";
  }

  function prev() {
    if (lightboxIndex === null) return;
    setLightboxIndex(lightboxIndex === 0 ? images.length - 1 : lightboxIndex - 1);
  }

  function next() {
    if (lightboxIndex === null) return;
    setLightboxIndex(lightboxIndex === images.length - 1 ? 0 : lightboxIndex + 1);
  }

  const displayImages = [...images, ...images];

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-poppins text-2xl font-bold text-text-primary">Gallery</h2>
          <span className="text-sm text-text-secondary">
            {images.length} photo{images.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div
          className="relative group/gallery overflow-hidden rounded-xl"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-bg-primary to-transparent z-[5] pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-bg-primary to-transparent z-[5] pointer-events-none" />

          {images.length > 3 && (
            <>
              <button
                onClick={() => scrollRef.current?.scrollBy({ left: -320, behavior: "smooth" })}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full md:opacity-0 md:group-hover/gallery:opacity-100 transition-opacity"
                data-action="gallery_scroll_left"
              >
                <FaChevronLeft />
              </button>
              <button
                onClick={() => scrollRef.current?.scrollBy({ left: 320, behavior: "smooth" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full md:opacity-0 md:group-hover/gallery:opacity-100 transition-opacity"
                data-action="gallery_scroll_right"
              >
                <FaChevronRight />
              </button>
            </>
          )}

          <AutoScrollStrip scrollRef={scrollRef} isPaused={isPaused}>
            {displayImages.map((url, i) => (
              <button
                key={i}
                onClick={() => openLightbox(i)}
                className="relative flex-shrink-0 w-56 md:w-72 aspect-video rounded-lg overflow-hidden group cursor-pointer border border-border snap-start"
                data-action={`gallery_image_${i % images.length}`}
              >
                <Image
                  src={url}
                  alt={`${title} - image ${(i % images.length) + 1}`}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="288px"
                />
              </button>
            ))}
          </AutoScrollStrip>
        </div>
      </div>

      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={closeLightbox}>
          <button onClick={(e) => { e.stopPropagation(); closeLightbox(); }} className="absolute top-4 right-4 text-white/70 hover:text-white p-3 z-10" data-action="gallery_close">
            <FaTimes className="text-2xl" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-4 text-white/70 hover:text-white p-3 z-10" data-action="gallery_prev">
            <FaChevronLeft className="text-2xl" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-4 text-white/70 hover:text-white p-3 z-10" data-action="gallery_next">
            <FaChevronRight className="text-2xl" />
          </button>
          <div className="relative w-[90vw] h-[80vh] pointer-events-none">
            <Image src={images[lightboxIndex]} alt={`${title} - image ${lightboxIndex + 1}`} fill className="object-contain" sizes="90vw" priority />
          </div>
          <div className="absolute bottom-4 text-white/70 text-sm">
            {lightboxIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}

function AutoScrollStrip({ scrollRef, isPaused, children }: { scrollRef: React.RefObject<HTMLDivElement>; isPaused: boolean; children: React.ReactNode }) {
  const [isTouching, setIsTouching] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let rafId: number;
    const speed = 0.5;

    function tick() {
      if (!isPaused && !isTouching && el) {
        el.scrollLeft += speed;
        const halfWidth = el.scrollWidth / 2;
        if (el.scrollLeft >= halfWidth) {
          el.scrollLeft -= halfWidth;
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPaused, isTouching, scrollRef]);

  // Resume auto-scroll 3 seconds after touch ends
  useEffect(() => {
    if (!isTouching) return;
    // isTouching is set true on touchstart, cleared on touchend after a delay
  }, [isTouching]);

  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTouchStart() {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    setIsTouching(true);
  }

  function handleTouchEnd() {
    resumeTimer.current = setTimeout(() => setIsTouching(false), 3000);
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); };
  }, []);

  return (
    <div
      ref={scrollRef as React.RefObject<HTMLDivElement>}
      className="flex gap-3 overflow-x-auto md:overflow-x-hidden py-1 scroll-smooth snap-x snap-mandatory md:snap-none"
      style={{ WebkitOverflowScrolling: "touch" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
}
