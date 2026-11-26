import { seoConfig } from "@/lib/seoConfig";

type GtagFn = (...args: unknown[]) => void;

interface PlausibleFn {
  (event: string, options?: { u?: string; props?: Record<string, string> }): void;
  q?: unknown[][];
}

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
    plausible?: PlausibleFn;
  }
}

const { analytics } = seoConfig;

function ga4Enabled(): boolean {
  return Boolean(analytics.ga4MeasurementId.trim());
}

function plausibleEnabled(): boolean {
  return Boolean(analytics.plausibleDomain.trim());
}

export function analyticsEnabled(): boolean {
  return ga4Enabled() || plausibleEnabled();
}

export function shouldTrackPath(pathname: string): boolean {
  if (!analyticsEnabled()) return false;
  if (analytics.excludeAdmin && pathname.startsWith("/admin")) return false;
  if (
    analytics.respectDoNotTrack &&
    typeof navigator !== "undefined" &&
    (navigator.doNotTrack === "1" ||
      // Legacy IE / Safari
      (navigator as Navigator & { msDoNotTrack?: string }).msDoNotTrack === "1")
  ) {
    return false;
  }
  return true;
}

function loadGa4(measurementId: string): void {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

function loadPlausible(domain: string, scriptUrl: string): void {
  window.plausible =
    window.plausible ??
    function (...args: unknown[]) {
      (window.plausible!.q = window.plausible!.q ?? []).push(args);
    };

  const script = document.createElement("script");
  script.defer = true;
  script.dataset.domain = domain;
  script.src = scriptUrl;
  document.head.appendChild(script);
}

let initialized = false;

export function initAnalytics(): void {
  if (initialized || typeof window === "undefined" || !analyticsEnabled()) return;
  initialized = true;

  const ga4Id = analytics.ga4MeasurementId.trim();
  if (ga4Id) loadGa4(ga4Id);

  const plausibleDomain = analytics.plausibleDomain.trim();
  if (plausibleDomain) {
    loadPlausible(plausibleDomain, analytics.plausibleScriptUrl);
  }
}

export function trackPageView(path: string): void {
  if (typeof window === "undefined" || !analyticsEnabled()) return;

  const pagePath = path.startsWith("/") ? path : `/${path}`;
  const pageLocation = `${window.location.origin}${pagePath}`;

  if (ga4Enabled() && window.gtag) {
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: pageLocation,
      page_title: document.title,
    });
  }

  if (plausibleEnabled() && window.plausible) {
    window.plausible("pageview", { u: pageLocation });
  }
}
