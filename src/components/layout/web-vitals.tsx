"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Free RUM: Next.js emits Core Web Vitals (LCP, CLS, INP, FCP, TTFB, FID)
 * for every real page load. We log them to the browser console in dev so
 * regressions are visible during a session, and forward them to
 * `/api/web-vitals` in production if an endpoint is deployed (silently
 * dropped otherwise via keepalive + a body ignored by the 404 handler).
 *
 * Swap the transport for whatever sink you want later (Supabase table,
 * Vercel Analytics, Grafana) — the emit path is the stable part.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[web-vitals] ${metric.name}=${metric.value.toFixed(1)} (${metric.rating})`
      );
      return;
    }
    try {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        path: window.location.pathname,
      });
      const url = "/api/web-vitals";
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, body);
      } else {
        void fetch(url, {
          body,
          method: "POST",
          keepalive: true,
          headers: { "content-type": "application/json" },
        });
      }
    } catch {
      /* best-effort; never block the page on telemetry */
    }
  });
  return null;
}
