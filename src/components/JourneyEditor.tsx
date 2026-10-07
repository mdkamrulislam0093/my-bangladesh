import { useEffect, useState } from "react";
import { CATEGORY_BY_ID } from "../data/categories";
import { DISTRICT_BY_ID } from "../data/districts";
import { useI18n } from "../i18n/I18nProvider";
import { draftActions } from "../lib/draftStore";
import { computeStats, displayTitle, timeline, titleSuggestions } from "../lib/mapModel";
import type { LifeEvent, LifeMap } from "../lib/types";
import { Icon } from "./ui";

const BN_TO_LATIN: Record<string, string> = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };

/** "Your story": name, map title, the timeline with optional years, and the numbers. */
export function JourneyEditor({ map }: { map: LifeMap }) {
  const { t, lang, num } = useI18n();
  const events = timeline(map);
  const currentTitle = displayTitle(map, lang);
  const autoTitle = displayTitle({ name: map.name, title: "" }, lang);
  const stats = computeStats(map);

  return (
    <div className="space-y-8">
      {/* Name first, with a live preview of the image title. The title itself is tucked away. */}
      <div>
        <label htmlFor="story-name" className="text-[17px] font-semibold">
          {t("story.nameQ")} <span className="text-[13px] font-normal text-muted">· {t("sheet.optional")}</span>
        </label>
        <input
          id="story-name"
          value={map.name}
          onChange={(e) => draftActions.setName(e.target.value)}
          placeholder={t("journey.namePh")}
          autoComplete="given-name"
          enterKeyHint="done"
          maxLength={40}
          className="mt-2 h-13 w-full rounded-2xl bg-white px-4 text-[17px] font-medium shadow-soft ring-1 ring-line outline-none placeholder:font-normal placeholder:text-muted/70 focus:ring-2 focus:ring-green"
        />
        <p className="mt-2 text-[13px] text-ink-2">{t("story.nameHint", { title: `${currentTitle} 🇧🇩` })}</p>

        <details className="group mt-2">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-green">
            {t("story.changeTitle")}
            <Icon name="down" size={15} className="transition group-open:rotate-180" />
          </summary>
          <input
            aria-label={t("journey.mapTitle")}
            value={map.title}
            onChange={(e) => draftActions.setTitle(e.target.value)}
            placeholder={currentTitle}
            maxLength={60}
            className="mt-3 h-12 w-full rounded-2xl bg-white px-4 text-[16px] font-semibold shadow-soft ring-1 ring-line outline-none placeholder:text-ink focus:ring-2 focus:ring-green"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {titleSuggestions(map.name, lang).map((s) => (
              <button
                key={s}
                onClick={() => draftActions.setTitle(s === autoTitle ? "" : s)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition active:scale-95 ${
                  currentTitle === s ? "bg-ink text-white" : "bg-white text-ink-2 ring-1 ring-line hover:ring-ink/20"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </details>
      </div>

      <label className="block">
        <span className="text-[13px] font-semibold text-muted">
          {t("story.quote")} <span className="font-normal">· {t("sheet.optional")}</span>
        </span>
        <textarea
          value={map.quote ?? ""}
          onChange={(e) => draftActions.setQuote(e.target.value)}
          placeholder={t("sheet.memoryPh")}
          rows={2}
          maxLength={160}
          className="mt-1.5 w-full resize-none rounded-2xl bg-white px-4 py-3 text-[16px] shadow-soft ring-1 ring-line outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-green"
        />
      </label>

      <div>
        <h3 className="text-[17px] font-semibold">{t("journey.title")}</h3>
        <p className="mt-0.5 text-[14px] text-muted">{t("journey.body")}</p>
        <ol className="mt-3 space-y-2">
          {events.map((e, i) => (
            <EventRow key={e.id} event={e} first={i === 0} last={i === events.length - 1} />
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-3 divide-x divide-line rounded-3xl bg-white py-4 shadow-soft ring-1 ring-line">
        {[
          [stats.districts, t("card.districts")],
          [stats.divisions, t("card.divisions")],
          [stats.chapters, t("card.chapters")],
        ].map(([n, label]) => (
          <div key={String(label)} className="px-3 text-center">
            <p className="font-display text-[30px] leading-none font-semibold text-green tabular-nums">{num(n as number)}</p>
            <p className="mt-1.5 text-[12px] leading-tight text-ink-2">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventRow({ event, first, last }: { event: LifeEvent; first: boolean; last: boolean }) {
  const { t, lang } = useI18n();
  const c = CATEGORY_BY_ID[event.category];
  const d = DISTRICT_BY_ID[event.districtId];
  const [year, setYear] = useState(event.year ? String(event.year) : "");
  useEffect(() => {
    setYear(event.year ? String(event.year) : "");
  }, [event.year]);
  const max = new Date().getFullYear() + 1;

  const onYear = (raw: string) => setYear(raw.replace(/[০-৯]/g, (x) => BN_TO_LATIN[x]).replace(/\D/g, "").slice(0, 4));
  // Commit on blur so the list doesn't re-sort under the user's finger mid-typing.
  const commit = () => {
    if (year === "") return draftActions.setYear(event.id, undefined);
    const n = Number(year);
    if (year.length === 4 && n >= 1920 && n <= max) draftActions.setYear(event.id, n);
    else setYear(event.year ? String(event.year) : "");
  };

  return (
    <li className="flex items-center gap-2 rounded-2xl bg-white p-2 pl-3 shadow-soft ring-1 ring-line animate-fade-up">
      <span className="grid size-9 shrink-0 place-items-center rounded-full text-[17px]" style={{ background: c.tint }} aria-hidden>
        {c.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{lang === "bn" ? d.nameBn : d.nameEn}</p>
        <p className="truncate text-[13px]" style={{ color: c.color }}>
          {c.label[lang]}
        </p>
      </div>
      <input
        inputMode="numeric"
        aria-label={`${t("sheet.year")} — ${c.label[lang]}, ${lang === "bn" ? d.nameBn : d.nameEn}`}
        placeholder={t("journey.addYear")}
        value={year}
        onChange={(e) => onYear(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="h-10 w-[4.75rem] shrink-0 rounded-xl bg-paper text-center text-[15px] tabular-nums outline-none ring-1 ring-line placeholder:text-[13px] placeholder:text-muted/70 focus:ring-2 focus:ring-green"
      />
      <div className="flex shrink-0 flex-col">
        <button
          aria-label={t("journey.up")}
          disabled={first}
          onClick={() => draftActions.move(event.id, -1)}
          className="grid h-[22px] w-10 place-items-center rounded-md text-ink-2 hover:bg-ink/5 active:bg-ink/10 disabled:opacity-25"
        >
          <Icon name="up" size={16} />
        </button>
        <button
          aria-label={t("journey.down")}
          disabled={last}
          onClick={() => draftActions.move(event.id, 1)}
          className="grid h-[22px] w-10 place-items-center rounded-md text-ink-2 hover:bg-ink/5 active:bg-ink/10 disabled:opacity-25"
        >
          <Icon name="down" size={16} />
        </button>
      </div>
    </li>
  );
}
