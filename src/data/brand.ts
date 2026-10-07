/** Who made this. Shown in the page footer and on every share image. */
export const BRAND = {
  name: "Devstall",
  /** Optional website, e.g. "https://devstall.com". Set VITE_BRAND_URL at build time or edit here. */
  url: (import.meta.env.VITE_BRAND_URL as string | undefined) ?? "",
};
