import { useSyncExternalStore } from "react";
import type { CategoryId } from "../data/categories";
import type { Lang } from "../i18n/strings";
import { track } from "./analytics";
import { randomId } from "./id";
import { emptyMap, nextOrder, reorderAfterYearChange, sanitizeMap } from "./mapModel";
import { storage } from "./storage";
import type { LifeMap } from "./types";

/**
 * The anonymous draft lives entirely in localStorage, so a refresh (or a
 * Facebook in-app browser reload) never loses progress. Writes are synchronous
 * because the payload is tiny.
 */
const DRAFT_KEY = "mbd:draft:v1";

let state: LifeMap | null = null;
const listeners = new Set<() => void>();

function load(lang: Lang): LifeMap {
  if (!state) {
    const saved = storage.get<unknown>(DRAFT_KEY);
    state = saved ? sanitizeMap(saved, lang) : emptyMap(lang);
  }
  return state;
}

function commit(next: LifeMap) {
  state = { ...next, updatedAt: new Date().toISOString() };
  storage.set(DRAFT_KEY, state);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function hasDraft(): boolean {
  const saved = storage.get<LifeMap>(DRAFT_KEY);
  return !!saved && Array.isArray(saved.events) && saved.events.length > 0;
}

export function useDraft(lang: Lang): LifeMap {
  return useSyncExternalStore(
    subscribe,
    () => load(lang),
    () => load(lang),
  );
}

function current(): LifeMap {
  return load("bn");
}

export const draftActions = {
  toggleCategory(districtId: string, category: CategoryId) {
    const m = current();
    const exists = m.events.find((e) => e.districtId === districtId && e.category === category);
    if (exists) {
      commit({ ...m, events: m.events.filter((e) => e !== exists) });
      return;
    }
    if (m.events.length === 0) track("map_created");
    commit({
      ...m,
      events: [...m.events, { id: randomId(8), districtId, category, order: nextOrder(m.events, category) }],
    });
  },

  setYear(eventId: string, year: number | undefined) {
    const m = current();
    const events = m.events.map((e) => (e.id === eventId ? { ...e, year } : e));
    commit({ ...m, events: reorderAfterYearChange(events) });
  },

  setNote(eventId: string, note: string) {
    const m = current();
    commit({ ...m, events: m.events.map((e) => (e.id === eventId ? { ...e, note: note.slice(0, 140) || undefined } : e)) });
  },

  setPlaceNote(districtId: string, text: string) {
    const m = current();
    const others = m.places.filter((p) => p.districtId !== districtId);
    commit({ ...m, places: text.trim() ? [...others, { districtId, text: text.slice(0, 160) }] : others });
  },

  removeDistrict(districtId: string) {
    const m = current();
    commit({
      ...m,
      events: m.events.filter((e) => e.districtId !== districtId),
      places: m.places.filter((p) => p.districtId !== districtId),
    });
  },

  /** Swap an event with its neighbour in the timeline. */
  move(eventId: string, dir: -1 | 1) {
    const m = current();
    const ordered = [...m.events].sort((a, b) => a.order - b.order);
    const i = ordered.findIndex((e) => e.id === eventId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    commit({ ...m, events: ordered.map((e, k) => ({ ...e, order: k })) });
  },

  setQuote(quote: string) {
    commit({ ...current(), quote: quote.slice(0, 160) || undefined });
  },

  setName(name: string) {
    commit({ ...current(), name: name.slice(0, 40) });
  },

  setTitle(title: string) {
    commit({ ...current(), title: title.slice(0, 60) });
  },

  setLanguage(language: Lang) {
    if (current().language !== language) commit({ ...current(), language });
  },

  reset(lang: Lang) {
    commit(emptyMap(lang));
  },
};
