import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  initAnalytics,
  shouldTrackPath,
  trackPageView,
} from "@/lib/analytics";

/**
 * Loads GA4 / Plausible once and sends page_view on each client route change.
 * Configure IDs in client/lib/seoConfig.ts → analytics.
 */
export default function Analytics() {
  const location = useLocation();
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    initAnalytics();
  }, []);

  useEffect(() => {
    const path = location.pathname + location.search;
    if (!shouldTrackPath(location.pathname)) return;
    trackPageView(path);
  }, [location.pathname, location.search]);

  return null;
}
