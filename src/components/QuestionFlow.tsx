import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_BY_ID, type CategoryId } from "../data/categories";
import { DISTRICT_BY_ID } from "../data/districts";
import { useI18n } from "../i18n/I18nProvider";
import { draftActions } from "../lib/draftStore";
import { districtCategories, timeline } from "../lib/mapModel";
import { storage } from "../lib/storage";
import type { LifeMap } from "../lib/types";
import { BangladeshMap } from "./BangladeshMap";
import { DistrictPicker } from "./DistrictPicker";
import { Button, Icon } from "./ui";

/** The questions, in story order. "single" allows one district. Add or reorder here. */
const QUESTIONS: { category: CategoryId; single?: boolean }[] = [
  { category: "born", single: true },
  { category: "studied" },
  { category: "worked" },
  { category: "love" },
  { category: "visited" },
];

/** Where most people have been: offered as one-tap answers after the user's own places. */
const POPULAR = ["dhaka", "chattogram", "sylhet", "coxs-bazar", "rajshahi", "khulna", "barishal", "rangpur", "mymensingh", "cumilla"];

const STEP_KEY = "mbd:question";

const tick = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* not supported */
  }
};

/**
 * The only way to build a map: one direct question at a time, answered with a
 * one-tap suggestion or by searching the district list.
 */
export function QuestionFlow({ map, onDone, onShare }: { map: LifeMap; onDone: () => void; onShare: () => void }) {
  const { t, lang, num } = useI18n();
  const [index, setIndexState] = useState(() => Math.min(QUESTIONS.length, Math.max(0, storage.get<number>(STEP_KEY) ?? 0)));
  const cardRef = useRef<HTMLDivElement>(null);
  const advanceTimer = useRef<number>(0);
  const chosen = useMemo(() => districtCategories(map), [map]);

  const setIndex = (i: number) => {
    clearTimeout(advanceTimer.current);
    setIndexState(i);
    storage.set(STEP_KEY, i);
    // Bring the new question into view if the list scrolled the page.
    const top = cardRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const name = (id: string) => (lang === "bn" ? DISTRICT_BY_ID[id].nameBn : DISTRICT_BY_ID[id].nameEn);

  // All answered: celebrate, and go straight to the image.
  if (index >= QUESTIONS.length) {
    return (
      <div ref={cardRef} className="rounded-[28px] bg-white p-6 text-center shadow-soft ring-1 ring-line animate-fade-up">
        <p className="text-4xl" aria-hidden>
          🎉
        </p>
        <h2 className="mt-3 font-display text-[24px] font-semibold tracking-tight">{t("flow.done.title")}</h2>
        <p className="mt-1 text-[14px] text-ink-2">{t("flow.done.body")}</p>
        <div className="mt-5 flex flex-col gap-2">
          {chosen.size > 0 && (
            <Button size="lg" onClick={onShare}>
              {t("home.share")}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setIndex(0)}>
            <Icon name="reset" size={17} />
            {t("flow.restart")}
          </Button>
        </div>
      </div>
    );
  }

  const { category, single } = QUESTIONS[index];
  const cat = CATEGORY_BY_ID[category];
  const picked = map.events.filter((e) => e.category === category).map((e) => e.districtId);
  const last = index === QUESTIONS.length - 1;

  // One-tap answers: the user's own places first (in story order), then popular districts.
  const own = [...new Set(timeline(map).map((e) => e.districtId))];
  const suggestions = [...new Set([...own, ...POPULAR])].filter((id) => !picked.includes(id)).slice(0, 6);

  const next = () => {
    setIndex(index + 1);
    if (last) onDone();
  };

  const pick = (id: string) => {
    tick();
    const adding = !picked.includes(id);
    if (single) for (const other of picked) if (other !== id) draftActions.toggleCategory(other, category);
    draftActions.toggleCategory(id, category);
    // A one-answer question moves on by itself, after a beat to show the tick.
    if (single && adding) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(next, 650);
    }
  };

  return (
    <div ref={cardRef} className="flex scroll-mt-3 flex-col overflow-hidden rounded-[28px] bg-white/60 shadow-soft ring-1 ring-line">
      {/* Progress: tap a dot to jump to that question */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <span className="text-[12px] font-semibold whitespace-nowrap text-muted">
          {t("quick.progress", { n: index + 1, total: QUESTIONS.length })}
          <span className="text-green">
            {" · "}
            {last ? t("quick.lastOne") : t("quick.left", { n: QUESTIONS.length - index - 1 })}
          </span>
        </span>
        <div className="flex items-center gap-1">
          {QUESTIONS.map((q, i) => {
            const answered = map.events.some((e) => e.category === q.category);
            return (
              <button
                key={q.category}
                onClick={() => setIndex(i)}
                aria-label={`${num(i + 1)}. ${CATEGORY_BY_ID[q.category].question[lang]}`}
                className="grid h-6 place-items-center"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? "w-5 bg-green" : answered ? "w-2.5 bg-green/50" : "w-2.5 bg-ink/15"
                  }`}
                />
              </button>
            );
          })}
          {/* Phones: a tiny live map so every answer visibly colours something in */}
          <BangladeshMap categories={chosen} lang={lang} badges={false} className="ml-2 h-[46px] w-[34px] shrink-0 md:hidden" ariaLabel={t("app.fullName")} />
        </div>
      </div>

      <div key={category} className="px-5 pt-3 animate-fade-up">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-[24px]" style={{ background: cat.tint }} aria-hidden>
            {cat.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="question" className="font-display text-[23px] leading-tight font-semibold tracking-tight text-balance">
              {cat.question[lang]}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">{single ? t("quick.single") : t("quick.multi")}</p>
          </div>
        </div>

        {picked.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label={t("quick.chosen")}>
            {picked.map((id) => (
              <button
                key={id}
                onClick={() => draftActions.toggleCategory(id, category)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full pr-2 pl-3.5 text-[14px] font-semibold text-white animate-pop"
                style={{ background: cat.color }}
              >
                <Icon name="check" size={15} strokeWidth={2.5} />
                {name(id)}
                <Icon name="close" size={15} />
              </button>
            ))}
          </div>
        )}

        {/* One-tap answers */}
        {suggestions.length > 0 && !(single && picked.length) && (
          <div className="mt-3">
            <p className="text-[12px] font-semibold text-muted">{t("quick.suggest")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((id) => {
                const mine = own.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => pick(id)}
                    className={`inline-flex h-9 items-center gap-1 rounded-full pr-3.5 pl-2.5 text-[14px] font-semibold transition active:scale-95 ${
                      mine ? "bg-white ring-2 ring-green/40" : "bg-white ring-1 ring-line hover:ring-ink/25"
                    }`}
                  >
                    <Icon name="plus" size={15} className="text-muted" />
                    {name(id)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Back / Next right under the question, so they're always in view */}
      <div className="mt-4 flex gap-2 px-5">
        {index > 0 && (
          <Button variant="secondary" size="md" className="px-4" onClick={() => setIndex(index - 1)} aria-label={t("quick.back")}>
            <Icon name="arrow-left" size={18} />
          </Button>
        )}
        <Button size="md" variant={picked.length ? "primary" : "secondary"} className="flex-1" onClick={next}>
          {last ? t("quick.done") : picked.length ? t("quick.next") : t("quick.skip")}
          <Icon name="arrow-right" size={18} />
        </Button>
      </div>

      <p className="mt-4 border-t border-line/70 px-5 pt-3 text-[12px] font-semibold text-muted">{t("quick.search")}</p>
      <DistrictPicker key={`p-${category}`} chosen={chosen} onPick={pick} activeCategory={category} className="mt-2 h-[42dvh] min-h-[300px] md:h-[360px]" />
    </div>
  );
}
