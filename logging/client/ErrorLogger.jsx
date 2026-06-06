"use client";

import { useEffect, useRef } from "react";

/**
 * Client-side error logger.
 * Catches uncaught JS errors and unhandled promise rejections,
 * batches them, and POSTs to /api/logs/client.
 *
 * Usage: <ErrorLogger project="fat-big-quiz" />
 *
 * Drop into root layout.tsx for each site.
 */
export default function ErrorLogger({ project }) {
  const seen = useRef(new Set());
  const queue = useRef([]);
  const timer = useRef(null);

  useEffect(() => {
    function flush() {
      if (queue.current.length === 0) return;
      const batch = queue.current.splice(0);
      for (const entry of batch) {
        fetch("/api/logs/client", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        }).catch(() => {});
      }
    }

    function enqueue(entry) {
      // Deduplicate by message within this session
      const key = entry.message + (entry.line || "");
      if (seen.current.has(key)) return;
      seen.current.add(key);

      queue.current.push(entry);

      // Batch: flush after 2 seconds of quiet
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 2000);
    }

    function onError(msg, source, line, column, error) {
      enqueue({
        message: String(msg),
        stack: error?.stack || null,
        source: source || null,
        line: line || null,
        column: column || null,
        url: window.location.href,
        userAgent: navigator.userAgent,
        project,
      });
    }

    function onUnhandledRejection(event) {
      const reason = event.reason;
      enqueue({
        message: "Unhandled rejection: " + (reason?.message || String(reason)),
        stack: reason?.stack || null,
        source: null,
        line: null,
        column: null,
        url: window.location.href,
        userAgent: navigator.userAgent,
        project,
      });
    }

    window.onerror = onError;
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.onerror = null;
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      clearTimeout(timer.current);
      flush();
    };
  }, [project]);

  return null;
}
