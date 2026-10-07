import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { track } from "../lib/analytics";
import { captions, SITE_URL } from "../lib/caption";
import { displayTitle } from "../lib/mapModel";
import { FORMATS, THEMES, renderShareCard, type CardFormat, type CardTheme } from "../lib/shareImage";
import { storage } from "../lib/storage";
import type { LifeMap } from "../lib/types";
import { BrandIcon, Button, Icon } from "./ui";

const PREFS_KEY = "mbd:cardPrefs";

/** Facebook / Instagram / Messenger in-app browsers: sharing and downloads are unreliable there. */
const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger/i.test(navigator.userAgent);
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const IS_PHONE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
/** Android intent that reopens this page in Chrome, out of the Facebook in-app browser. */
const CHROME_INTENT = `intent://${location.host}${location.pathname}#Intent;scheme=https;package=com.android.chrome;end`;

/** Starts the copy synchronously, so it still counts as part of the user's tap even if not awaited. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });

/**
 * Share = the image + a ready-made caption with the site link. One tap sends all three
 * to WhatsApp / Messenger / etc.; the caption is also copied, because Facebook ignores
 * pre-filled text and the user has to paste it. The map itself never leaves the device.
 */
export default function ShareSheet({ map, onClose }: { map: LifeMap; onClose: () => void }) {
  const { t, lang } = useI18n();
  const saved = storage.get<{ format?: CardFormat; theme?: CardTheme }>(PREFS_KEY) ?? {};
  const [format, setFormat] = useState<CardFormat>(saved.format && saved.format in FORMATS ? saved.format : "post");
  const [theme, setTheme] = useState<CardTheme>(saved.theme && saved.theme in THEMES ? saved.theme : "paper");
  const [image, setImage] = useState<{ key: string; blob: Blob; url: string } | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const options = useMemo(() => captions(map, lang), [map, lang]);
  const [captionIdx, setCaptionIdx] = useState(0);
  const [caption, setCaption] = useState(options[0]);
  const [copied, setCopied] = useState(false);
  const [inAppSrc, setInAppSrc] = useState<string | null>(null);
  // After a share or download, the "send the link" panel lights up and scrolls into view.
  const [nudge, setNudge] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const statusTimer = useRef<number>(0);
  const inviteRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, { blob: Blob; url: string }>());

  const title = displayTitle(map, lang);
  const key = `${format}:${theme}:${lang}`;
  const fileName = `${(map.name || "my").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-bangladesh-${format}.jpg`;

  useEffect(() => {
    storage.set(PREFS_KEY, { format, theme });
    const hit = cache.current.get(key);
    if (hit) {
      setImage({ key, ...hit });
      return;
    }
    let alive = true;
    renderShareCard(map, lang, format, theme)
      .then((blob) => {
        const entry = { blob, url: URL.createObjectURL(blob) };
        cache.current.set(key, entry);
        if (alive) setImage({ key, ...entry });
      })
      .catch((e) => console.error("share image failed", e));
    return () => {
      alive = false;
    };
  }, [key, map, lang, format, theme]);

  // Fresh caption when the language or chosen template changes.
  useEffect(() => {
    setCaption(options[captionIdx % options.length]);
  }, [options, captionIdx]);

  // In-app browsers can long-press-save a data: image but not a blob: one.
  useEffect(() => {
    if (IN_APP && image) void toDataUrl(image.blob).then(setInAppSrc);
  }, [image]);

  // Free object URLs when the sheet closes.
  useEffect(() => {
    const c = cache.current;
    return () => c.forEach((v) => URL.revokeObjectURL(v.url));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const ready = image?.key === key ? image : null;
  const file = useMemo(() => (ready ? new File([ready.blob], fileName, { type: "image/jpeg" }) : null), [ready, fileName]);
  const canShareFile = !!file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  const flashCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 6000);
  };
  const flashStatus = (msg: string) => {
    setStatus(msg);
    clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(null), 7000);
  };

  const afterAction = () => {
    setNudge(true);
    setTimeout(() => inviteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
  };

  // One tap: copy the caption (for Facebook) and open the phone's share menu with image + caption + link.
  // Both calls start synchronously inside the tap: iPhone Safari refuses share() after an await.
  const share = () => {
    if (!file) return;
    void copyText(caption).then((ok) => ok && flashCopied());
    navigator
      .share({ files: [file], text: caption })
      .then(() => {
        track("image_shared", { format, theme });
        afterAction();
      })
      .catch((e: Error) => {
        if (e?.name === "AbortError") return; // user closed the menu
        // The browser couldn't share: save the image instead. Caption + link are already copied.
        saveImage();
        flashStatus(t("share.fallbackSaved"));
        afterAction();
      });
  };

  const copyCaption = async () => {
    if (await copyText(caption)) flashCopied();
  };

  /* ----- Spreading the link itself ----- */
  const enc = encodeURIComponent;
  const inviteText = `${t("invite.text")} ${SITE_URL}`;
  const canShareLink = typeof navigator.share === "function";

  const copyLink = async () => {
    if (await copyText(SITE_URL)) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
      track("link_copy");
    }
  };
  const shareLink = async () => {
    try {
      await navigator.share({ title: t("app.fullName"), text: t("invite.text"), url: SITE_URL });
      track("link_share", { via: "native" });
    } catch {
      /* cancelled */
    }
  };
  // Facebook and WhatsApp are plain links (rendered as <a>), which no pop-up blocker or in-app browser stops.
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${enc(SITE_URL)}`;
  const whatsappHref = `https://wa.me/?text=${enc(inviteText)}`;

  const linkToMessenger = () => {
    track("link_share", { via: "messenger" });
    void copyLink(); // inside the tap, so it works even if Messenger can't be opened
    if (IS_PHONE) {
      location.href = `fb-messenger://share/?link=${enc(SITE_URL)}`;
      // If the Messenger app opened, this page is now hidden. Still visible = not installed.
      setTimeout(() => {
        if (document.visibilityState === "visible") flashStatus(t("invite.messengerFallback"));
      }, 1800);
    } else {
      window.open("https://www.messenger.com/", "_blank", "noopener");
      flashStatus(t("invite.messengerDesktop"));
    }
  };

  function saveImage() {
    if (!ready) return;
    const a = document.createElement("a");
    a.href = ready.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
    track("image_download", { format, theme });
  }

  const download = () => {
    if (!ready) return;
    // The image alone can't be tapped: put the caption + link on the clipboard and point to the link panel.
    void copyText(caption).then((ok) => ok && flashCopied());
    saveImage();
    afterAction();
  };

  const { w, h } = FORMATS[format];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-paper shadow-lift animate-sheet-up sm:rounded-[28px] sm:animate-fade-up"
      >
        <div className="flex shrink-0 items-center justify-between px-5 pt-4">
          <h2 id="share-title" className="font-display text-[22px] font-semibold tracking-tight">
            {t("share.title")}
          </h2>
          <button onClick={onClose} aria-label={t("sheet.close")} className="-mr-1 grid size-10 place-items-center rounded-full hover:bg-ink/5">
            <Icon name="close" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3">
          {/* Preview */}
          <div className="grid place-items-center rounded-3xl bg-paper-2 p-3">
            <div
              className="relative overflow-hidden rounded-xl shadow-lift"
              style={{ aspectRatio: `${w} / ${h}`, height: format === "story" ? "min(52dvh, 460px)" : "min(44dvh, 400px)", maxWidth: "100%" }}
            >
              {ready ? (
                <img src={(IN_APP && inAppSrc) || ready.url} alt={title} className="block h-full w-full animate-fade-up object-contain" />
              ) : (
                <div className="skeleton grid h-full w-full place-items-center px-4 text-center text-[13px] text-muted">{t("share.painting")}</div>
              )}
            </div>
          </div>

          {/* Format */}
          <p className="mt-5 text-[13px] font-semibold text-muted">{t("share.format")}</p>
          <div role="radiogroup" className="mt-2 grid grid-cols-2 gap-2">
            {(Object.keys(FORMATS) as CardFormat[]).map((f) => (
              <button
                key={f}
                role="radio"
                aria-checked={format === f}
                onClick={() => setFormat(f)}
                className={`flex items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.98] ${
                  format === f ? "bg-white ring-2 ring-green" : "bg-white/60 ring-1 ring-line"
                }`}
              >
                <span
                  className={`shrink-0 rounded-[5px] border-2 ${format === f ? "border-green" : "border-ink/30"}`}
                  style={{ width: f === "story" ? 14 : 18, height: f === "story" ? 24 : 22 }}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">{t(`share.format.${f}`)}</span>
                  <span className="block truncate text-[12px] text-muted">{t(`share.format.${f}.hint`)}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Theme */}
          <p className="mt-4 text-[13px] font-semibold text-muted">{t("share.theme")}</p>
          <div role="radiogroup" className="mt-2 flex gap-2">
            {(Object.keys(THEMES) as CardTheme[]).map((th) => (
              <button
                key={th}
                role="radio"
                aria-checked={theme === th}
                onClick={() => setTheme(th)}
                className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold transition active:scale-[0.97] ${
                  theme === th ? "bg-white ring-2 ring-green" : "bg-white/60 ring-1 ring-line"
                }`}
              >
                <span className="size-5 rounded-full ring-1 ring-ink/15" style={{ background: THEMES[th].swatch }} aria-hidden />
                {t(`share.theme.${th}`)}
              </button>
            ))}
          </div>

          {/* Caption: written from the user's answers, editable, always ends with the link */}
          <div className="mt-5 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-muted">{t("share.caption")}</p>
            <div className="flex gap-2">
            <button
              onClick={copyCaption}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-semibold text-ink-2 ring-1 ring-line active:scale-95"
            >
              <Icon name={copied ? "check" : "link"} size={14} />
              {t("share.copyCaption")}
            </button>
            <button
              onClick={() => setCaptionIdx((i) => i + 1)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-semibold text-green ring-1 ring-line active:scale-95"
            >
              <Icon name="reset" size={14} />
              {t("share.captionNext")}
            </button>
            </div>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={6}
            aria-label={t("share.caption")}
            className="mt-2 w-full resize-none rounded-2xl bg-white px-4 py-3 text-[15px] leading-relaxed ring-1 ring-line outline-none focus:ring-2 focus:ring-green"
          />
          <p className="mt-1.5 text-[12px] leading-snug text-muted">{t("share.captionHint")}</p>

          {IN_APP && (
            <div className="mt-3 rounded-2xl bg-red-soft p-3 text-[13px] leading-snug text-red">
              <p>{t("share.inApp")}</p>
              {IS_ANDROID && (
                <a href={CHROME_INTENT} className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-semibold text-ink ring-1 ring-line">
                  <Icon name="globe" size={16} />
                  {t("share.openChrome")}
                </a>
              )}
            </div>
          )}

          {/* Spread the link: an image can't be tapped, a link can. */}
          <div
            ref={inviteRef}
            className={`mt-5 rounded-3xl p-4 transition-all duration-500 ${nudge ? "bg-green-soft ring-2 ring-green animate-pop" : "bg-white ring-1 ring-line"}`}
          >
            <p className="text-[16px] font-semibold">{nudge ? t("invite.titleDone") : t("invite.title")}</p>
            <p className="mt-0.5 text-[13px] text-ink-2">{t("invite.body")}</p>

            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-paper p-1.5 pl-4 ring-1 ring-line">
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-green">{SITE_URL.replace(/^https?:\/\//, "")}</span>
              <button
                onClick={copyLink}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-4 text-[14px] font-semibold text-white active:scale-95 ${linkCopied ? "bg-green" : "bg-ink"}`}
              >
                <Icon name={linkCopied ? "check" : "link"} size={16} />
                {linkCopied ? t("invite.copied") : t("invite.copy")}
              </button>
            </div>

            <div className={`mt-2 grid gap-2 ${canShareLink ? "grid-cols-4" : "grid-cols-3"}`}>
              {canShareLink && (
                <button onClick={shareLink} className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white text-[12px] font-semibold ring-1 ring-line active:scale-[0.97]">
                  <Icon name="share" size={20} className="text-green" />
                  {t("invite.share")}
                </button>
              )}
              <a
                href={facebookHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("link_share", { via: "facebook" })}
                className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white text-[12px] font-semibold ring-1 ring-line active:scale-[0.97]"
              >
                <span style={{ color: "#1877F2" }}>
                  <BrandIcon brand="facebook" size={20} />
                </span>
                {t("share.facebook")}
              </a>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("link_share", { via: "whatsapp" })}
                className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white text-[12px] font-semibold ring-1 ring-line active:scale-[0.97]"
              >
                <span style={{ color: "#1FAF54" }}>
                  <BrandIcon brand="whatsapp" size={20} />
                </span>
                {t("share.whatsapp")}
              </a>
              <button onClick={linkToMessenger} className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white text-[12px] font-semibold ring-1 ring-line active:scale-[0.97]">
                <span style={{ color: "#0A7CFF" }}>
                  <BrandIcon brand="messenger" size={20} />
                </span>
                {t("invite.messenger")}
              </button>
            </div>
            <p className="mt-3 text-[12px] leading-snug text-ink-2">💡 {t("invite.tip")}</p>
          </div>

          <p className="mt-4 flex gap-2 text-[12px] leading-snug text-muted">
            <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
            {t("share.private")}
          </p>
        </div>

        {/* Actions */}
        <div className="shrink-0 border-t border-line/70 px-5 pt-3 pb-safe">
          <div className="flex gap-2">
            {canShareFile && (
              <Button size="lg" className="flex-1" onClick={share} disabled={!ready}>
                <Icon name="share" size={18} />
                {t("share.shareAll")}
              </Button>
            )}
            <Button
              size="lg"
              variant={canShareFile ? "secondary" : "primary"}
              className={canShareFile ? "px-5" : "flex-1"}
              onClick={download}
              disabled={!ready}
              aria-label={t("share.download")}
            >
              <Icon name={downloaded ? "check" : "download"} size={18} />
              {(!canShareFile || downloaded) && <span>{downloaded ? t("share.saved") : t("share.download")}</span>}
            </Button>
          </div>
          <p className={`mt-2 flex items-center justify-center gap-1.5 text-center text-[12px] ${status || copied ? "font-semibold text-green" : "text-muted"}`} role="status">
            {status ?? (copied ? t("share.copied") : canShareFile ? t("share.tip.mobile") : t("share.tip.desktop"))}
            {!status && !copied && canShareFile && (
              <span className="inline-flex shrink-0 gap-1" aria-hidden>
                <span style={{ color: "#0A7CFF" }}><BrandIcon brand="messenger" size={14} /></span>
                <span style={{ color: "#1FAF54" }}><BrandIcon brand="whatsapp" size={14} /></span>
                <span style={{ color: "#1877F2" }}><BrandIcon brand="facebook" size={14} /></span>
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
