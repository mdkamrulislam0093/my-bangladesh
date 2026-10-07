/**
 * Privacy-friendly usage counts, sent to our own public/stats.php (private dashboard there).
 * Anonymous event names only: no cookies, no user ids, no third parties.
 * Override the endpoint with VITE_ANALYTICS_URL; set it to "off" to disable.
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

const CONFIGURED = import.meta.env.VITE_ANALYTICS_URL as string | undefined;
// Local dev has no PHP, so don't send anything there.
const ENDPOINT = CONFIGURED === "off" ? undefined : (CONFIGURED ?? (import.meta.env.DEV ? undefined : "/stats.php"));

export function track(event: AnalyticsEvent, props?: Record<string, string>) {
  if (import.meta.env.DEV) console.debug("[analytics]", event, props ?? "");
  if (!ENDPOINT) return;
  try {
    const body = JSON.stringify({ event, props });
    if (!navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) {
      void fetch(ENDPOINT, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    /* analytics must never break the app */
  }
}
