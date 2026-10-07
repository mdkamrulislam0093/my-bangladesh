import type { Lang } from "../i18n/strings";

/** Endpoint that stores a shared map and returns its link (public/share.php on the same host). */
const API = (import.meta.env.VITE_SHARE_API as string | undefined) ?? "/share.php";

/**
 * Uploads the 1200×630 preview image + title/summary and returns a short link (…/s/{id}).
 * When that link is shared, Facebook / Messenger / WhatsApp show the map as the preview.
 * Throws when there's no server (local dev, static hosting) so callers can fall back.
 */
export async function createShareLink(image: Blob, title: string, desc: string, lang: Lang): Promise<string> {
  const fd = new FormData();
  fd.append("image", image, "map.jpg");
  fd.append("title", title);
  fd.append("desc", desc);
  fd.append("lang", lang);
  const res = await fetch(API, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`share link failed: ${res.status}`);
  const data = (await res.json()) as { url?: unknown };
  if (typeof data.url !== "string" || !/^https?:\/\/[^/]+\/s\/[a-z0-9]+$/.test(data.url)) throw new Error("bad share link response");
  return data.url;
}
