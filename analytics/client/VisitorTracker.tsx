'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { collectAnalyticsData, getPageLoadTime } from './analytics';

export type VisitorTrackerProps = {
  apiBaseUrl: string;
  prefix?: string;           // session storage key prefix (default: "lzl")
  excludePaths?: string[];   // paths to skip (default: ["/admin"])
  enableEcommerce?: boolean; // enable e-commerce tracking exports
};

export default function VisitorTracker({
  apiBaseUrl,
  prefix = 'lzl',
  excludePaths = ['/admin'],
  enableEcommerce = false,
}: VisitorTrackerProps) {
  const hasTracked = useRef(false);
  const pageStartTime = useRef(Date.now());
  const pathname = usePathname();
  const currentVisitorId = useRef<string | null>(null);

  // Track page view
  useEffect(() => {
    // Skip excluded paths
    if (excludePaths.some(p => pathname?.includes(p))) {
      return;
    }

    // Reset for new page
    hasTracked.current = false;
    pageStartTime.current = Date.now();

    const trackPageView = async () => {
      if (hasTracked.current) return;
      hasTracked.current = true;

      try {
        // Wait a moment for page to fully load
        await new Promise(resolve => setTimeout(resolve, 100));

        const analyticsData = await collectAnalyticsData({ prefix });

        const response = await fetch(`${apiBaseUrl}/api/visitors/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(analyticsData),
        });

        if (!response.ok) {
          console.error('[Analytics] Track response error:', response.status);
          return;
        }

        const result = await response.json();
        if (result.visitorId) {
          currentVisitorId.current = result.visitorId;
        }
      } catch (err) {
        console.error('[Analytics] Error tracking visitor:', err);
      }
    };

    trackPageView();
  }, [pathname, apiBaseUrl, prefix, excludePaths]);

  // Track time on page when user leaves
  useEffect(() => {
    const shouldSkip = excludePaths.some(p => pathname?.includes(p));

    const handleBeforeUnload = () => {
      if (currentVisitorId.current && !shouldSkip) {
        const timeOnPage = Math.round((Date.now() - pageStartTime.current) / 1000);
        const pageLoadTime = getPageLoadTime();

        const data = JSON.stringify({
          visitorId: currentVisitorId.current,
          timeOnPage,
          pageLoadTime,
          eventType: 'page_exit',
        });

        navigator.sendBeacon(
          `${apiBaseUrl}/api/visitors/update`,
          new Blob([data], { type: 'application/json' })
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBeforeUnload();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pathname, apiBaseUrl, excludePaths]);

  // Auto-track button clicks with data-track-button attribute
  useEffect(() => {
    const shouldSkip = excludePaths.some(p => pathname?.includes(p));
    if (shouldSkip) return;

    const handleButtonClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-track-button]') as HTMLElement;

      if (button) {
        const buttonName = button.getAttribute('data-track-button') ||
                           button.textContent?.trim() ||
                           'Unknown Button';

        fetch(`${apiBaseUrl}/api/visitors/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'button_click',
            path: pathname,
            eventData: { buttonName },
          }),
        }).catch(err => console.error('[Analytics] Error tracking button click:', err));
      }
    };

    document.addEventListener('click', handleButtonClick);
    return () => document.removeEventListener('click', handleButtonClick);
  }, [pathname, apiBaseUrl, excludePaths]);

  return null;
}

// E-commerce tracking functions (exported for use in other components)
export function createEcommerceTracker(apiBaseUrl: string) {
  return {
    async trackProductView(productId: string, productSlug: string) {
      try {
        await fetch(`${apiBaseUrl}/api/visitors/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'product_view',
            productViewed: productId,
            path: `/product/${productSlug}`,
          }),
        });
      } catch (err) {
        console.error('[Analytics] Error tracking product view:', err);
      }
    },

    async trackAddToCart(productId: string, quantity: number = 1) {
      try {
        await fetch(`${apiBaseUrl}/api/visitors/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'add_to_cart',
            productViewed: productId,
            eventData: { quantity },
            addedToCart: true,
          }),
        });
      } catch (err) {
        console.error('[Analytics] Error tracking add to cart:', err);
      }
    },

    async trackCheckoutStart(cartValue: number) {
      try {
        await fetch(`${apiBaseUrl}/api/visitors/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'checkout_start',
            checkoutStarted: true,
            orderValue: cartValue,
          }),
        });
      } catch (err) {
        console.error('[Analytics] Error tracking checkout start:', err);
      }
    },

    async trackPurchase(orderId: string, orderValue: number) {
      try {
        await fetch(`${apiBaseUrl}/api/visitors/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'purchase',
            purchaseComplete: true,
            orderValue,
            eventData: { orderId },
          }),
        });
      } catch (err) {
        console.error('[Analytics] Error tracking purchase:', err);
      }
    },

    async trackButtonClick(buttonId: string, buttonText: string) {
      try {
        await fetch(`${apiBaseUrl}/api/visitors/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'button_click',
            eventData: { buttonId, buttonText },
          }),
        });
      } catch (err) {
        console.error('[Analytics] Error tracking button click:', err);
      }
    },
  };
}
