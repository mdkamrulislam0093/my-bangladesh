import { CATEGORIES, CATEGORY_BY_ID, type Category, type CategoryId } from "../data/categories";
import { DISTRICT_BY_ID, type Division } from "../data/districts";
import { translate, type Lang } from "../i18n/strings";
import { randomId } from "./id";
import type { LifeEvent, LifeMap } from "./types";

export function emptyMap(lang: Lang): LifeMap {
  const now = new Date().toISOString();
  return {
    schema: 1,
    id: randomId(12),
    name: "",
    title: "",
    language: lang,
    events: [],
    places: [],
    createdAt: now,
    updatedAt: now,
  };
}

/* ---------- Titles ---------- */

export function displayTitle(map: Pick<LifeMap, "name" | "title">, lang: Lang): string {
  if (map.title.trim()) return map.title.trim();
  const name = map.name.trim();
  if (name) return translate(lang, "title.possessive", { name });
  return translate(lang, "title.default");
}

export function titleSuggestions(name: string, lang: Lang): string[] {
  const n = name.trim();
  const out = [
    n ? translate(lang, "title.possessive", { name: n }) : translate(lang, "title.default"),
    ...(n ? [translate(lang, "title.s1", { name: n })] : []),
    translate(lang, "title.s2"),
    translate(lang, "title.s3"),
    translate(lang, "title.s4"),
    translate(lang, "title.s5"),
  ];
  return [...new Set(out)];
}

/* ---------- Events ---------- */

export function eventsForDistrict(map: LifeMap, districtId: string): LifeEvent[] {
  return map.events
    .filter((e) => e.districtId === districtId)
    .sort((a, b) => CATEGORY_BY_ID[a.category].priority - CATEGORY_BY_ID[b.category].priority);
}

/** Categories per district, primary (highest-priority) first. */
export function districtCategories(map: Pick<LifeMap, "events">): Map<string, Category[]> {
  const out = new Map<string, Category[]>();
  for (const e of map.events) {
    const list = out.get(e.districtId) ?? [];
    if (!list.some((c) => c.id === e.category)) list.push(CATEGORY_BY_ID[e.category]);
    out.set(e.districtId, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.priority - b.priority);
  return out;
}

/**
 * Timeline order. The manual `order` field is the source of truth; years only
 * influence order when they change (see `reorderAfterYearChange`).
 */
export function timeline(map: Pick<LifeMap, "events">): LifeEvent[] {
  return [...map.events].sort((a, b) => a.order - b.order);
}

/**
 * Re-sort so dated events are chronological, while undated events keep their
 * position relative to the event before them. Lets people mix "2016" with
 * "sometime after that" without being forced to fill every year.
 */
export function reorderAfterYearChange(events: LifeEvent[]): LifeEvent[] {
  const ordered = [...events].sort((a, b) => a.order - b.order);
  let lastYear = -Infinity;
  const keyed = ordered.map((e, i) => {
    if (e.year != null) lastYear = e.year;
    return { e, key: e.year ?? lastYear, i };
  });
  keyed.sort((a, b) => a.key - b.key || a.i - b.i);
  return keyed.map(({ e }, i) => ({ ...e, order: i }));
}

/** Initial order for a new event: births first, then by category priority, then appended. */
export function nextOrder(events: LifeEvent[], category: CategoryId): number {
  if (category === "born") return Math.min(0, ...events.map((e) => e.order)) - 1;
  return Math.max(-1, ...events.map((e) => e.order)) + 1;
}

/* ---------- Journey ---------- */

/**
 * The life journey: distinct places in timeline order, collapsing repeats next to each other.
 * Trips ("visited") are left out so the line shows where life moved, not every holiday.
 */
export function journeyStops(map: Pick<LifeMap, "events">): string[] {
  const stops: string[] = [];
  for (const e of timeline(map)) {
    if (e.category === "visited") continue;
    if (stops[stops.length - 1] !== e.districtId) stops.push(e.districtId);
  }
  return stops;
}

/** Smooth curved SVG path through district centres (viewBox units). */
export function journeyPath(stops: string[]): string {
  const pts = stops.map((id) => DISTRICT_BY_ID[id]).filter(Boolean).map((d) => [d.cx, d.cy] as const);
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const dx = x1 - x0;
    const dy = y1 - y0;
    // Bow each leg gently to one side so the line reads as a journey, not a GPS track.
    const bow = 0.18;
    const cx = mx - dy * bow;
    const cy = my + dx * bow;
    d += ` Q${cx.toFixed(1)},${cy.toFixed(1)} ${x1},${y1}`;
  }
  return d;
}

/* ---------- Stats ---------- */

export interface MapStats {
  districts: number;
  divisions: number;
  chapters: number;
  byCategory: { category: Category; districts: number }[];
}

export function computeStats(map: Pick<LifeMap, "events">): MapStats {
  const districts = new Set(map.events.map((e) => e.districtId));
  const divisions = new Set<Division>([...districts].map((id) => DISTRICT_BY_ID[id]?.division).filter(Boolean));
  const byCategory = CATEGORIES.map((category) => ({
    category,
    districts: new Set(map.events.filter((e) => e.category === category.id).map((e) => e.districtId)).size,
  })).filter((x) => x.districts > 0);
  return { districts: districts.size, divisions: divisions.size, chapters: byCategory.length, byCategory };
}

/** One highlight per category for the share card: "🎓 Studied: Khulna". */
export function highlights(map: Pick<LifeMap, "events">, lang: Lang, max = 4) {
  const tl = timeline(map);
  const seen = new Set<CategoryId>();
  const out: { category: Category; places: string[] }[] = [];
  const byCat = new Map<CategoryId, string[]>();
  for (const e of tl) {
    const name = lang === "bn" ? DISTRICT_BY_ID[e.districtId]?.nameBn : DISTRICT_BY_ID[e.districtId]?.nameEn;
    if (!name) continue;
    const list = byCat.get(e.category) ?? [];
    if (!list.includes(name)) list.push(name);
    byCat.set(e.category, list);
  }
  // The chapters that tell a life story first; "visited" last.
  const STORY: CategoryId[] = ["born", "studied", "worked", "favorite", "love", "lived", "family", "memory", "visited"];
  const order = [...CATEGORIES].sort((a, b) => STORY.indexOf(a.id) - STORY.indexOf(b.id));
  for (const c of order) {
    if (out.length >= max) break;
    const places = byCat.get(c.id);
    if (places && !seen.has(c.id)) {
      seen.add(c.id);
      out.push({ category: c, places });
    }
  }
  return out;
}

/** Limit untrusted/legacy input to a well-formed LifeMap. Used on load and before publish. */
export function sanitizeMap(input: unknown, lang: Lang): LifeMap {
  const base = emptyMap(lang);
  if (!input || typeof input !== "object") return base;
  const m = input as Partial<LifeMap>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const events: LifeEvent[] = Array.isArray(m.events)
    ? m.events
        .filter((e): e is LifeEvent => !!e && typeof e === "object" && !!DISTRICT_BY_ID[e.districtId] && !!CATEGORY_BY_ID[e.category])
        .slice(0, 300)
        .map((e, i) => ({
          id: str(e.id, 24) || randomId(8),
          districtId: e.districtId,
          category: e.category,
          year: Number.isInteger(e.year) && e.year! >= 1900 && e.year! <= 2100 ? e.year : undefined,
          note: str(e.note, 140) || undefined,
          order: Number.isFinite(e.order) ? e.order : i,
        }))
    : [];
  const seen = new Set<string>();
  const dedupedEvents = events.filter((e) => {
    const k = `${e.districtId}:${e.category}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const places = Array.isArray(m.places)
    ? m.places
        .filter((p) => p && DISTRICT_BY_ID[p.districtId] && typeof p.text === "string" && p.text.trim())
        .map((p) => ({ districtId: p.districtId, text: p.text.slice(0, 160) }))
    : [];
  return {
    ...base,
    id: str(m.id, 24) || base.id,
    name: str(m.name, 40),
    title: str(m.title, 60),
    language: m.language === "en" || m.language === "bn" ? m.language : lang,
    events: dedupedEvents,
    places,
    quote: str(m.quote, 160) || undefined,
    createdAt: str(m.createdAt, 40) || base.createdAt,
    updatedAt: str(m.updatedAt, 40) || base.updatedAt,
  };
}
