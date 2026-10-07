import { useMemo, useState } from "react";
import type { Category, CategoryId } from "../data/categories";
import { DISTRICTS, DIVISIONS, type Division, type District } from "../data/districts";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "./ui";

const DIVISION_ORDER: Division[] = ["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"];

/** Old and common spellings people still type. */
const ALIASES: Record<string, string[]> = {
  barishal: ["barisal"],
  bogura: ["bogra"],
  chattogram: ["chittagong", "ctg"],
  cumilla: ["comilla"],
  jashore: ["jessore"],
  "chapai-nawabganj": ["nawabganj", "chapainawabganj"],
  netrokona: ["netrakona"],
  moulvibazar: ["maulvibazar", "sreemangal"],
  jhalokathi: ["jhalokati"],
  brahmanbaria: ["brahamanbaria", "b baria"],
  "coxs-bazar": ["cox bazar", "coxsbazar", "teknaf"],
  dhaka: ["dacca"],
};

const norm = (s: string) => s.toLowerCase().replace(/[’'`.\s-]/g, "");

function matches(d: District, q: string): boolean {
  if (!q) return true;
  const n = norm(q);
  return (
    norm(d.nameEn).includes(n) ||
    d.nameBn.includes(q.trim()) ||
    norm(d.division).includes(n) ||
    DIVISIONS[d.division].bn.includes(q.trim()) ||
    (ALIASES[d.id] ?? []).some((a) => norm(a).includes(n))
  );
}

interface Props {
  /** Categories already attached to each district (for badges / colour). */
  chosen: Map<string, Category[]>;
  onPick: (districtId: string) => void;
  /** Guided mode: a district is "on" when it has this category. */
  activeCategory?: CategoryId;
  autoFocus?: boolean;
  className?: string;
}

/** A list alternative to the map: search plus every district grouped by division. */
export function DistrictPicker({ chosen, onPick, activeCategory, autoFocus, className = "" }: Props) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const name = (d: District) => (lang === "bn" ? d.nameBn : d.nameEn);
  const choose = (id: string) => {
    onPick(id);
    if (q) setQ("");
  };

  const groups = useMemo(() => {
    return DIVISION_ORDER.map((div) => ({
      div,
      list: DISTRICTS.filter((d) => d.division === div && matches(d, q)).sort((a, b) =>
        lang === "bn" ? a.nameBn.localeCompare(b.nameBn, "bn") : a.nameEn.localeCompare(b.nameEn),
      ),
    })).filter((g) => g.list.length);
  }, [q, lang]);

  const total = groups.reduce((n, g) => n + g.list.length, 0);
  const onlyOne = total === 1 ? groups[0].list[0] : null;

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="shrink-0 px-4 pt-1 pb-3">
        <label className="flex h-12 items-center gap-2 rounded-2xl bg-white px-4 shadow-soft ring-1 ring-line focus-within:ring-2 focus-within:ring-green">
          <Icon name="search" size={19} className="shrink-0 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onlyOne && choose(onlyOne.id)}
            placeholder={t("editor.searchBar")}
            aria-label={t("editor.searchBar")}
            autoFocus={autoFocus}
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted/80"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label={t("sheet.close")} className="-mr-2 grid size-9 place-items-center rounded-full text-muted hover:bg-ink/5">
              <Icon name="close" size={17} />
            </button>
          )}
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {total === 0 && <p className="py-10 text-center text-muted">{t("editor.search.none")}</p>}
        {groups.map(({ div, list }) => (
          <section key={div} className="mb-5">
            <h3 className="sticky top-0 z-10 -mx-4 mb-2 bg-paper/95 px-4 py-1.5 text-[12px] font-semibold tracking-wide text-muted backdrop-blur">
              {t("sheet.division", { x: lang === "bn" ? DIVISIONS[div].bn : div })}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {list.map((d) => {
                const cats = chosen.get(d.id) ?? [];
                const on = activeCategory ? cats.some((c) => c.id === activeCategory) : cats.length > 0;
                const accent = activeCategory ? cats.find((c) => c.id === activeCategory) : cats[0];
                return (
                  <button
                    key={d.id}
                    onClick={() => choose(d.id)}
                    aria-pressed={on}
                    className={`relative flex min-h-[56px] items-center gap-2 rounded-2xl px-3 py-2 text-left transition active:scale-[0.97] ${
                      on ? "ring-2" : "bg-white ring-1 ring-line hover:ring-ink/25"
                    }`}
                    style={on && accent ? { background: accent.tint, ["--tw-ring-color" as string]: accent.color } : undefined}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] leading-tight font-semibold">{name(d)}</span>
                      <span className="block truncate text-[12px] text-muted">{lang === "bn" ? d.nameEn : d.nameBn}</span>
                    </span>
                    {on && activeCategory ? (
                      <span className="grid size-6 shrink-0 place-items-center rounded-full text-white animate-pop" style={{ background: accent?.color }}>
                        <Icon name="check" size={14} strokeWidth={3} />
                      </span>
                    ) : cats.length > 0 ? (
                      <span className="flex shrink-0 -space-x-1 text-[14px]" aria-hidden>
                        {cats.slice(0, 3).map((c) => (
                          <span key={c.id}>{c.emoji}</span>
                        ))}
                      </span>
                    ) : (
                      <Icon name="plus" size={18} className="shrink-0 text-muted/70" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
