"use client";

import { useState, useCallback } from "react";
import { useEventsConfig } from "../context/EventsProvider";

export type CheckoutPayload = {
  eventTitle: string;
  priceInPence: number;
  customerEmail: string;
  customerName: string;
  groupSize: number;
  eventDate: string;
  productSlug: string;
  packageSlug: string;
  [key: string]: unknown;
};

export function useCheckout() {
  const { apiBase } = useEventsConfig();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = useCallback(async (payload: CheckoutPayload): Promise<{ url?: string; error?: string }> => {
    setSubmitting(true);
    setError(null);

    try {
      console.log("[EventsUI] Submitting checkout:", payload.eventTitle);
      const res = await fetch(`${apiBase}/api/payments/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.url) {
        console.log("[EventsUI] Redirecting to Stripe checkout");
        return { url: data.url };
      }

      const errMsg = data.error || "Something went wrong. Please try again.";
      console.error("[EventsUI] Checkout failed:", errMsg);
      setError(errMsg);
      return { error: errMsg };
    } catch (err) {
      const errMsg = "Could not reach our server. Please check your connection.";
      console.error("[EventsUI] Network error:", err);
      setError(errMsg);
      return { error: errMsg };
    } finally {
      setSubmitting(false);
    }
  }, [apiBase]);

  return { checkout, submitting, error };
}
