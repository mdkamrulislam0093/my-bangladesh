import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BangladeshMap } from "../components/BangladeshMap";
import { JourneyEditor } from "../components/JourneyEditor";
import { QuestionFlow } from "../components/QuestionFlow";
import { Button, Icon, LangSwitch, Logo } from "../components/ui";
import { BRAND } from "../data/brand";
import { CATEGORIES } from "../data/categories";
import { useI18n } from "../i18n/I18nProvider";
import { track } from "../lib/analytics";
import { draftActions, useDraft } from "../lib/draftStore";
import { districtCategories, journeyStops } from "../lib/mapModel";
import { storage } from "../lib/storage";
import { useOverlayHistory } from "../lib/useOverlayHistory";

// Canvas drawing only loads when someone actually opens the share sheet.
const ShareSheet = lazy(() => import("../components/ShareSheet"));

/** One page: answer questions → the map colours in → add your story → share the image. */
export default function Home() {
  const { t, lang } = useI18n();
  const map = useDraft(lang);
  const cats = useMemo(() => districtCategories(map), [map]);
  const stops = useMemo(() => journeyStops(map), [map]);
  const placeCount = cats.size;
  const storyRef = useRef<HTMLElement>(null);
  const [sharing, setSharing] = useState(false);

  useOverlayHistory(sharing, () => setSharing(false));

  useEffect(() => {
    track("landing_view");
  }, []);
  useEffect(() => {
    draftActions.setLanguage(lang);
  }, [lang]);
  // Warm the share chunk once there's something to share.
  useEffect(() => {
    if (!placeCount) return;
    const id = setTimeout(() => void import("../components/ShareSheet"), 2000);
    return () => clearTimeout(id);
  }, [placeCount]);

  const openShare = () => {
    track("share_open");
    setSharing(true);
  };

  const chosenCategories = CATEGORIES.filter((c) => map.events.some((e) => e.category === c.id));

  return (
    <div className="min-h-dvh pb-28">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-3 md:px-6">
        <Logo />
        <LangSwitch className="origin-right scale-90" />
      </header>

      {/* Intro */}
      <section className="mx-auto max-w-6xl px-4 pt-5 md:px-6 md:pt-8">
        <h1 className="font-display text-[clamp(2.1rem,9vw,3.4rem)] leading-[1.05] font-semibold tracking-[-0.02em] animate-fade-up">
          {t("landing.title")} <span className="inline-block">🇧🇩</span>
        </h1>
        <p className="mt-2 max-w-xl text-[16px] text-ink-2 animate-fade-up [animation-delay:60ms] md:text-[18px]">{t("landing.subtitle")}</p>
        <p className="mt-1 text-[14px] text-muted animate-fade-up [animation-delay:100ms]">{t("home.hint")}</p>
      </section>

      <main className="mx-auto mt-5 grid max-w-6xl gap-8 px-4 md:grid-cols-[1.1fr_1fr] md:px-6">
        {/* Questions first on phones; on desktop they sit right of the map */}
        <div className="md:order-2">
          <QuestionFlow
            key={map.id}
            map={map}
            onDone={() => setTimeout(() => storyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150)}
            onShare={openShare}
          />

          <section ref={storyRef} className="mt-10 scroll-mt-4" aria-labelledby="story-title">
            <h2 id="story-title" className="font-display text-[26px] font-semibold tracking-tight">
              {t("home.story")}
            </h2>
            {placeCount === 0 ? (
              <p className="mt-2 rounded-2xl border border-dashed border-ink/20 p-5 text-center text-[14px] text-muted">{t("home.story.empty")}</p>
            ) : (
              <div className="mt-4">
                <JourneyEditor map={map} />
                <Button size="lg" className="mt-6 w-full" onClick={openShare}>
                  {t("home.share")}
                </Button>
                <div className="mt-4 text-center">
                  <button
                    onClick={() => {
                      if (!confirm(t("result.startOver.confirm"))) return;
                      storage.remove("mbd:question");
                      draftActions.reset(lang);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="text-[13px] font-medium text-muted underline decoration-line underline-offset-4 hover:text-ink"
                  >
                    {t("result.startOver")}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* The map: colours in live as questions are answered */}
        <section className="md:order-1 md:sticky md:top-3 md:self-start">
          <div className="relative overflow-hidden rounded-[28px] bg-white/50 p-3 ring-1 ring-line">
            <BangladeshMap
              categories={cats}
              lang={lang}
              journey={stops}
              showJourney={stops.length > 1}
              labels
              className="mx-auto aspect-[600/822] w-full max-w-[460px] md:max-h-[calc(100dvh-9rem)] md:w-auto"
              ariaLabel={t("app.fullName")}
            />
            {placeCount === 0 && (
              <p className="pointer-events-none absolute inset-x-4 top-4 rounded-2xl bg-white/90 p-3 text-center text-[14px] font-medium shadow-soft ring-1 ring-line backdrop-blur">
                {t("home.mapEmpty")}
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-14 max-w-6xl border-t border-line px-4 py-6 text-[12px] text-muted md:px-6">
        <p className="flex gap-2">
          <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
          {t("landing.privacy.body")}
        </p>
        <p className="mt-2">{t("landing.dataCredit")}</p>
        <p className="mt-4 text-[13px]">
          Powered by{" "}
          {BRAND.url ? (
            <a href={BRAND.url} target="_blank" rel="noopener" className="font-semibold text-ink underline decoration-line underline-offset-4 hover:text-green">
              {BRAND.name}
            </a>
          ) : (
            <span className="font-semibold text-ink">{BRAND.name}</span>
          )}
        </p>
      </footer>

      {/* Always-visible bar: progress + share */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-paper/95 px-4 pt-3 pb-safe backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{placeCount === 1 ? t("editor.place") : t("editor.places", { n: placeCount })}</p>
            <p className="flex h-5 items-center gap-0.5 truncate text-[13px] text-muted">
              {chosenCategories.length
                ? chosenCategories.map((c) => (
                    <span key={c.id} title={c.label[lang]} className="animate-pop">
                      {c.emoji}
                    </span>
                  ))
                : t("home.shareHint")}
            </p>
          </div>
          <Button size="lg" disabled={placeCount === 0} onClick={openShare} className="shrink-0">
            <Icon name="share" size={18} />
            {t("home.shareShort")}
          </Button>
        </div>
      </div>

      {sharing && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30">
              <span className="size-8 animate-spin rounded-full border-3 border-white/40 border-t-white" />
            </div>
          }
        >
          <ShareSheet map={map} onClose={() => setSharing(false)} />
        </Suspense>
      )}
    </div>
  );
}
