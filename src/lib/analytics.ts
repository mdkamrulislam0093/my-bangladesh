/**
 * Privacy-friendly product analytics: anonymous event counts only.
 * No cookies, no user ids, no third parties. Respects Do Not Track.
 *
 * The site is fully static, so nothing is sent unless VITE_ANALYTICS_URL is set at build
 * time (any endpoint that accepts `POST {event, props}`, e.g. a Plausible/PostHog proxy).
 */
export type AnalyticsEvent =
  | "landing_view"
  | "create_click"
  | "map_created"
  | "map_completed"
  | "share_open"
  | "image_shared"
  | "image_download"
  | "link_copy"
  | "link_share"
  | "demo_view";

const ENDPOINT = import.meta.env.VITE_ANALYTICS_URL as string | undefined;

function dnt(): boolean {
  return navigator.doNotTrack === "1" || (window as { doNotTrack?: string }).doNotTrack === "1";
}

export function track(event: AnalyticsEvent, props?: Record<string, string>) {
  if (import.meta.env.DEV) console.debug("[analytics]", event, props ?? "");
  if (!ENDPOINT || dnt()) return;
  try {
    const body = JSON.stringify({ event, props });
    if (!navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) {
      void fetch(ENDPOINT, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    /* analytics must never break the app */
  }
}
