import { DISTRICT_BY_ID } from "../data/districts";
import { localizeDigits, type Lang } from "../i18n/strings";
import type { CategoryId } from "../data/categories";
import { computeStats, timeline } from "./mapModel";
import type { LifeMap } from "./types";

/** The site link put into every shared caption. Override at build time with VITE_SITE_URL. */
export const SITE_URL: string = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? location.origin).replace(/\/$/, "");

export const HASHTAGS = "#আমারবাংলাদেশ #MyBangladeshMap";

/**
 * Bangla locative ("in Dhaka" → "ঢাকায়", "in Sylhet" → "সিলেটে", "in Nilphamari" → "নীলফামারীতে").
 * Rules cover all 64 district names.
 */
export function bnLocative(name: string): string {
  if (/[াআ]ঁ?$/.test(name)) return `${name}য়`; // নওগাঁ → নওগাঁয়
  if (/[িীুূেৈোৌ]$/.test(name)) return `${name}তে`;
  if (/[ওঅ]$/.test(name)) return `${name}য়ে`; // ঠাকুরগাঁও → ঠাকুরগাঁওয়ে
  return `${name}ে`;
}

const joinBn = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} ও ${names[names.length - 1]}`);
const joinEn = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** Places per category, in story order. */
function placesBy(map: LifeMap, lang: Lang) {
  const out = new Map<CategoryId, string[]>();
  for (const e of timeline(map)) {
    const d = DISTRICT_BY_ID[e.districtId];
    if (!d) continue;
    const list = out.get(e.category) ?? [];
    const n = lang === "bn" ? d.nameBn : d.nameEn;
    if (!list.includes(n)) list.push(n);
    out.set(e.category, list);
  }
  return out;
}

/** "Born in Satkhira, studied in Khulna, worked in Dhaka. Cox's Bazar is my favourite." */
export function storyLine(map: LifeMap, lang: Lang): string {
  const p = placesBy(map, lang);
  const parts: string[] = [];
  const add = (c: CategoryId, bn: (loc: string, plain: string) => string, en: (names: string) => string) => {
    const names = p.get(c)?.slice(0, 2);
    if (!names?.length) return;
    if (lang === "bn") {
      // Locative goes on the last name: "খুলনা ও ঢাকায়"
      const loc = joinBn([...names.slice(0, -1), bnLocative(names[names.length - 1])]);
      parts.push(bn(loc, joinBn(names)));
    } else parts.push(en(joinEn(names)));
  };
  add("born", (l) => `${l} জন্ম`, (n) => `Born in ${n}`);
  add("studied", (l) => `${l} পড়াশোনা`, (n) => `studied in ${n}`);
  add("worked", (l) => `${l} কাজ`, (n) => `worked in ${n}`);
  if (parts.length < 3) add("lived", (l) => `${l} থেকেছি`, (n) => `lived in ${n}`);
  if (parts.length < 3) add("family", (_l, n) => `পরিবার ${n}`, (n) => `family in ${n}`);
  const fav = p.get("favorite")?.[0];
  const love = p.get("love")?.[0];
  let line = parts.join(", ");
  if (line && lang === "en") line = line[0].toUpperCase() + line.slice(1);
  if (fav) line += lang === "bn" ? `${line ? "। " : ""}সবচেয়ে প্রিয় ${fav} ⭐` : `${line ? ". " : ""}${fav} is my favourite ⭐`;
  else if (love) line += lang === "bn" ? `${line ? "। " : ""}${bnLocative(love)} দেখা হয়েছিল বিশেষ কারও সাথে ❤️` : `${line ? ". " : ""}Met someone special in ${love} ❤️`;
  return line ? `${line}${/[।.⭐❤️]$/u.test(line) ? "" : lang === "bn" ? "।" : "."}` : "";
}

/**
 * Ready-to-post captions, written from the user's own answers. Each ends with the
 * site link and hashtags so every shared image leads friends back to the site.
 */
export function captions(map: LifeMap, lang: Lang, link: string = SITE_URL): string[] {
  const s = computeStats(map);
  const n = localizeDigits(s.districts, lang);
  const story = storyLine(map, lang);
  const born = placesBy(map, lang).get("born")?.[0];
  const tail = (cta: string) => `${cta}\n👉 ${link}\n\n${HASHTAGS}`;

  if (lang === "bn") {
    return [
      [`${n}টি জেলা, একটাই জীবন 🇧🇩`, story, "", tail("আপনার বাংলাদেশ কোনটা? নিজেরটা বানিয়ে কমেন্টে দিন 👇")].filter((l, i) => l || i === 2).join("\n"),
      [`৬৪টি জেলার মধ্যে ${n}টি জড়িয়ে আছে আমার জীবনে 🗺️`, story, "", tail("আপনার কয়টা? ২ মিনিটে নিজের ম্যাপ বানান")].filter((l, i) => l || i === 2).join("\n"),
      born
        ? [`বলুন তো, আমার জন্ম কোন জেলায়? 😄`, `উত্তর ছবিতেই আছে!`, "", tail("এবার আপনার পালা — নিজের বাংলাদেশ ম্যাপ বানান")].join("\n")
        : [`এই হলো আমার বাংলাদেশ 🇧🇩`, story, "", tail("যার সাথে এই জেলাগুলোতে ছিলেন, তাকে ট্যাগ করুন!")].filter((l, i) => l || i === 2).join("\n"),
    ];
  }
  return [
    [`${n} districts, one life 🇧🇩`, story, "", tail("What's your Bangladesh? Make yours and drop it in the comments 👇")].filter((l, i) => l || i === 2).join("\n"),
    [`${n} of Bangladesh's 64 districts are part of my story 🗺️`, story, "", tail("How many are in yours? Make your map in 2 minutes")].filter((l, i) => l || i === 2).join("\n"),
    born
      ? [`Guess which district I was born in? 😄`, `The answer's in the picture!`, "", tail("Your turn — make your own Bangladesh map")].join("\n")
      : [`This is my Bangladesh 🇧🇩`, story, "", tail("Tag someone who shared these districts with you!")].filter((l, i) => l || i === 2).join("\n"),
  ];
}

/** One-line summary for the shared link preview. */
export function previewSummary(map: LifeMap, lang: Lang): string {
  const story = storyLine(map, lang);
  const q = lang === "bn" ? "আপনার বাংলাদেশ কোনটা?" : "What's your Bangladesh?";
  return story ? `${story} ${q}` : q;
}
