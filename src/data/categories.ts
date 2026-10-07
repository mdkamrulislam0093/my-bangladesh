import type { Lang } from "../i18n/strings";

export type CategoryId =
  | "born"
  | "lived"
  | "studied"
  | "worked"
  | "love"
  | "family"
  | "memory"
  | "visited"
  | "favorite";

export interface Category {
  id: CategoryId;
  emoji: string;
  /** Fill colour on the map. Chosen to stay distinguishable on the sand base. */
  color: string;
  /** Soft background for chips and badges. */
  tint: string;
  /** Lower number wins when a district has several categories and needs one fill. */
  priority: number;
  label: Record<Lang, string>;
  /** Short verb used in timelines and share cards: "Born — Satkhira". */
  verb: Record<Lang, string>;
  description: Record<Lang, string>;
  /** Label used in the "in numbers" summary, e.g. "3 lived". */
  statLabel: Record<Lang, string>;
  /** Question asked in the guided setup: "Where were you born?" */
  question: Record<Lang, string>;
}

/**
 * The single source of truth for life categories. Add a category by appending
 * here and extending CategoryId; every screen renders from this list.
 */
export const CATEGORIES: Category[] = [
  {
    id: "born",
    emoji: "🟢",
    color: "#13774b",
    tint: "#e2f1e8",
    priority: 0,
    label: { en: "Born here", bn: "এখানে জন্ম" },
    verb: { en: "Born", bn: "জন্ম" },
    description: { en: "Where it all began", bn: "যেখান থেকে শুরু" },
    statLabel: { en: "born", bn: "জন্মস্থান" },
    question: { en: "Where were you born?", bn: "আপনার জন্ম কোথায়?" },
  },
  {
    id: "lived",
    emoji: "🏠",
    color: "#2f5c9a",
    tint: "#e4ebf5",
    priority: 1,
    label: { en: "Lived here", bn: "এখানে থেকেছি" },
    verb: { en: "Lived", bn: "থেকেছি" },
    description: { en: "A place you called home", bn: "যাকে ঘর বলেছেন" },
    statLabel: { en: "lived", bn: "যেখানে থেকেছি" },
    question: { en: "Where else have you lived?", bn: "আর কোথায় কোথায় থেকেছেন?" },
  },
  {
    id: "studied",
    emoji: "🎓",
    color: "#6e4fc0",
    tint: "#ece7f8",
    priority: 3,
    label: { en: "Studied here", bn: "এখানে পড়েছি" },
    verb: { en: "Studied", bn: "পড়াশোনা" },
    description: { en: "School, college or university", bn: "স্কুল, কলেজ বা বিশ্ববিদ্যালয়" },
    statLabel: { en: "studied", bn: "পড়াশোনা" },
    question: { en: "Where did you study?", bn: "কোথায় পড়াশোনা করেছেন?" },
  },
  {
    id: "worked",
    emoji: "💼",
    color: "#4a5565",
    tint: "#e9ebee",
    priority: 4,
    label: { en: "Worked here", bn: "এখানে কাজ করেছি" },
    verb: { en: "Worked", bn: "কাজ" },
    description: { en: "Jobs, business, first salary", bn: "চাকরি, ব্যবসা, প্রথম বেতন" },
    statLabel: { en: "worked", bn: "কর্মস্থল" },
    question: { en: "Where have you worked?", bn: "কোথায় কাজ করেছেন?" },
  },
  {
    id: "love",
    emoji: "❤️",
    color: "#d23f57",
    tint: "#fbe6ea",
    priority: 5,
    label: { en: "Met someone here", bn: "এখানে কারও সাথে দেখা" },
    verb: { en: "Met someone", bn: "দেখা হয়েছিল" },
    description: { en: "Love, friendship, a special person", bn: "ভালোবাসা, বন্ধুত্ব, বিশেষ কেউ" },
    statLabel: { en: "special meetings", bn: "বিশেষ দেখা" },
    question: { en: "Where did you meet someone special?", bn: "বিশেষ কারও সাথে কোথায় দেখা হয়েছিল?" },
  },
  {
    id: "family",
    emoji: "👨‍👩‍👧",
    color: "#de6b2f",
    tint: "#fcebe0",
    priority: 2,
    label: { en: "Family lives here", bn: "পরিবার থাকে এখানে" },
    verb: { en: "Family", bn: "পরিবার" },
    description: { en: "Parents, grandparents, relatives", bn: "বাবা-মা, দাদা-দাদি, আত্মীয়" },
    statLabel: { en: "family", bn: "পরিবার" },
    question: { en: "Where does your family live?", bn: "আপনার পরিবার কোথায় থাকে?" },
  },
  {
    id: "memory",
    emoji: "📸",
    color: "#0f8e99",
    tint: "#def2f3",
    priority: 6,
    label: { en: "Important memory", bn: "বিশেষ স্মৃতি" },
    verb: { en: "Memory", bn: "স্মৃতি" },
    description: { en: "A moment you'll never forget", bn: "যে মুহূর্ত ভোলা যায় না" },
    statLabel: { en: "memories", bn: "স্মৃতি" },
    question: { en: "Where did an unforgettable moment happen?", bn: "কোথায় এমন কিছু ঘটেছিল যা ভোলা যায় না?" },
  },
  {
    id: "visited",
    emoji: "✈️",
    color: "#5d9be0",
    tint: "#e5f0fb",
    priority: 8,
    label: { en: "Visited here", bn: "ঘুরতে গিয়েছি" },
    verb: { en: "Visited", bn: "ভ্রমণ" },
    description: { en: "Trips, tours, weekends away", bn: "ভ্রমণ, ট্যুর, ছুটির দিন" },
    statLabel: { en: "visited", bn: "ঘুরেছি" },
    question: { en: "Where have you travelled?", bn: "কোথায় কোথায় ঘুরতে গিয়েছেন?" },
  },
  {
    id: "favorite",
    emoji: "⭐",
    color: "#e0a019",
    tint: "#fcf2d9",
    priority: 7,
    label: { en: "Favorite place", bn: "প্রিয় জায়গা" },
    verb: { en: "Favorite", bn: "প্রিয়" },
    description: { en: "Where your heart wants to be", bn: "মন যেখানে থাকতে চায়" },
    statLabel: { en: "favorites", bn: "প্রিয়" },
    question: { en: "What is your favourite place?", bn: "আপনার সবচেয়ে প্রিয় জায়গা কোনটা?" },
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  Category
>;

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export function isCategoryId(v: unknown): v is CategoryId {
  return typeof v === "string" && v in CATEGORY_BY_ID;
}
