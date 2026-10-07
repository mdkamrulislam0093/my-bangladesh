import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { StringKey } from "../i18n/strings";
import { track } from "../lib/analytics";
import { captions, previewSummary, SITE_URL } from "../lib/caption";
import { displayTitle } from "../lib/mapModel";
import { FORMATS, THEMES, renderOgCard, renderShareCard, type CardFormat, type CardTheme } from "../lib/shareImage";
import { createShareLink } from "../lib/shareLink";
import { storage } from "../lib/storage";
import type { LifeMap } from "../lib/types";
import { BrandIcon, Button, Icon } from "./ui";

const PREFS_KEY = "mbd:cardPrefs";

const UA = navigator.userAgent;
/** Facebook / Instagram / Messenger in-app browsers: sharing and downloads are unreliable there. */
const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger/i.test(UA);
const IS_ANDROID = /Android/i.test(UA);
const IS_PHONE = /Android|iPhone|iPad|iPod/i.test(UA);
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

/** Clipboards only accept PNG images (used only when no share link could be made). */
async function toPng(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("png failed"))), "image/png"));
}
const canCopyImages = typeof window.ClipboardItem === "function" && !!navigator.clipboard?.write;

type Target = "facebook" | "messenger" | "whatsapp";
type LinkState = { status: "making" } | { status: "ready"; url: string } | { status: "failed" };

/**
 * Sharing = the generated map + the person's info.
 * A link is made for each map (…/s/{id}); Facebook, Messenger and WhatsApp show the map as its preview,
 * so every button shares the map itself — nothing needs downloading. On phones, the main button also
 * sends the image file straight through the phone's share menu.
 */
export default function ShareSheet({ map, onClose }: { map: LifeMap; onClose: () => void }) {
  const { t, lang } = useI18n();
  const saved = storage.get<{ format?: CardFormat; theme?: CardTheme }>(PREFS_KEY) ?? {};
  const [format, setFormat] = useState<CardFormat>(saved.format && saved.format in FORMATS ? saved.format : "post");
  const [theme, setTheme] = useState<CardTheme>(saved.theme && saved.theme in THEMES ? saved.theme : "paper");
  const [image, setImage] = useState<{ key: string; blob: Blob; url: string } | null>(null);
  const [link, setLink] = useState<LinkState>({ status: "making" });
  const [captionIdx, setCaptionIdx] = useState(0);
  const [inAppSrc, setInAppSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [captionCopied, setCaptionCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const statusTimer = useRef<number>(0);
  const linkBoxRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, { blob: Blob; url: string }>());
  const links = useRef(new Map<string, string>());
  const pngRef = useRef<Blob | null>(null);

  const title = displayTitle(map, lang);
  const key = `${format}:${theme}:${lang}`;
  const fileName = `${(map.name || "my").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-bangladesh-${format}.jpg`;
  const mapUrl = link.status === "ready" ? link.url : SITE_URL;

  const options = useMemo(() => captions(map, lang, mapUrl), [map, lang, mapUrl]);
  const [caption, setCaption] = useState(options[0]);
  useEffect(() => {
    setCaption(options[captionIdx % options.length]);
  }, [options, captionIdx]);

  // Draw the shareable image (cached per format/style/language).
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

  // Make the map's own link (one per style + language), shortly after the style settles.
  useEffect(() => {
    const linkKey = `${theme}:${lang}`;
    const known = links.current.get(linkKey);
    if (known) {
      setLink({ status: "ready", url: known });
      return;
    }
    setLink({ status: "making" });
    let alive = true;
    const id = window.setTimeout(async () => {
      try {
        const og = await renderOgCard(map, lang, theme);
        const url = await createShareLink(og, displayTitle(map, lang), previewSummary(map, lang), lang);
        links.current.set(linkKey, url);
        if (alive) setLink({ status: "ready", url });
      } catch (e) {
        console.warn("Share link unavailable, falling back to image sharing", e);
        if (alive) setLink({ status: "failed" });
      }
    }, 500);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [map, lang, theme]);

  // In-app browsers can long-press-save a data: image but not a blob: one.
  useEffect(() => {
    if (IN_APP && image) void toDataUrl(image.blob).then(setInAppSrc);
  }, [image]);

  // Only needed as a fallback when no link could be made.
  useEffect(() => {
    pngRef.current = null;
    if (link.status === "failed" && image && canCopyImages) void toPng(image.blob).then((p) => (pngRef.current = p));
  }, [link.status, image]);

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

  const say = (msg: string, ms = 9000) => {
    setStatus(msg);
    clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(null), ms);
  };
  const afterShare = () => {
    setShared(true);
    setTimeout(() => linkBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
  };

  function saveImage() {
    if (!ready) return;
    const a = document.createElement("a");
    a.href = ready.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    track("image_download", { format, theme });
  }

  /* ----- Phones: image + caption through the phone's own share menu ----- */
  // Copy + share start synchronously inside the tap: iPhone Safari refuses share() after an await.
  const shareMap = () => {
    if (!file) return;
    void copyText(caption);
    navigator
      .share({ files: [file], text: caption })
      .then(() => {
        track("image_shared", { via: "native", format, theme });
        say(t("share.copied"));
        afterShare();
      })
      .catch((e: Error) => {
        if (e?.name === "AbortError") return;
        saveImage();
        say(t("share.fallbackSaved"));
        afterShare();
      });
  };

  /* ----- Facebook / Messenger / WhatsApp: share the map's link (preview = the map) ----- */
  const enc = encodeURIComponent;
  const hrefFor = (target: Target): string | undefined => {
    if (link.status !== "ready") return undefined;
    if (target === "facebook") return `https://www.facebook.com/sharer/sharer.php?u=${enc(link.url)}`;
    if (target === "whatsapp") return `https://wa.me/?text=${enc(caption)}`;
    return IS_PHONE ? `fb-messenger://share/?link=${enc(link.url)}` : "https://www.messenger.com/";
  };

  const onTarget = (target: Target, e: React.MouseEvent) => {
    track("image_shared", { via: target, format, theme });
    if (link.status === "ready") {
      // Facebook ignores pre-filled text and Messenger web can't be pre-filled: copy what they need.
      if (target === "messenger") {
        void copyText(link.url);
        say(t(IS_PHONE ? "share.msg.messengerApp" : "share.msg.messengerWeb"));
        if (IS_PHONE)
          setTimeout(() => {
            if (document.visibilityState === "visible") say(t("invite.messengerFallback"));
          }, 1800);
      } else if (target === "facebook") {
        void copyText(caption);
        say(t("share.msg.facebook"));
      } else say(t("share.msg.whatsapp"));
      afterShare();
      return;
    }
    // No link (no server): copy the map image itself so it can be pasted, without forcing a download.
    if (link.status === "failed") {
      if (canCopyImages && pngRef.current) {
        navigator.clipboard
          .write([new ClipboardItem({ "image/png": pngRef.current })])
          .then(() => say(t(`share.paste.${target}` as StringKey)))
          .catch(() => say(t("share.useDownload")));
        window.open(target === "facebook" ? "https://www.facebook.com/" : target === "messenger" ? "https://www.messenger.com/" : "https://web.whatsapp.com/", "_blank", "noopener");
      } else say(t("share.useDownload"));
      e.preventDefault();
      afterShare();
      return;
    }
    e.preventDefault(); // still making the link
  };

  const download = () => {
    void copyText(caption).then((ok) => ok && setCaptionCopied(true));
    saveImage();
    say(t("share.downloaded"));
    afterShare();
  };

  const copyCaption = async () => {
    if (await copyText(caption)) {
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2500);
    }
  };
  const copyLink = async () => {
    if (await copyText(mapUrl)) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
      track("link_copy");
    }
  };

  const { w, h } = FORMATS[format];
  const making = link.status === "making";

  const targetButton = (target: Target, label: StringKey, color: string) => (
    <a
      key={target}
      href={hrefFor(target) ?? "#"}
      target={target === "messenger" && IS_PHONE ? undefined : "_blank"}
      rel="noopener noreferrer"
      aria-disabled={making}
      onClick={(e) => onTarget(target, e)}
      className={`relative flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white text-[12px] font-semibold ring-1 ring-line transition hover:ring-ink/25 active:scale-[0.97] ${
        making ? "pointer-events-none opacity-60" : ""
      }`}
    >
      <span style={{ color }}>
        <BrandIcon brand={target} size={22} />
      </span>
      {t(label)}
    </a>
  );

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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-4">
          {/* The map that will be shared */}
          <div className="grid place-items-center rounded-3xl bg-paper-2 p-3">
            <div
              className="relative overflow-hidden rounded-xl shadow-lift"
              style={{ aspectRatio: `${w} / ${h}`, height: format === "story" ? "min(44dvh, 420px)" : "min(36dvh, 360px)", maxWidth: "100%" }}
            >
              {ready ? (
                <img src={(IN_APP && inAppSrc) || ready.url} alt={title} className="block h-full w-full animate-fade-up object-contain" />
              ) : (
                <div className="skeleton grid h-full w-full place-items-center px-4 text-center text-[13px] text-muted">{t("share.painting")}</div>
              )}
            </div>
          </div>

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

          {/* Format + style */}
          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("share.format")}>
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
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label={t("share.theme")}>
            {(Object.keys(THEMES) as CardTheme[]).map((th) => (
              <button
                key={th}
                role="radio"
                aria-checked={theme === th}
                onClick={() => setTheme(th)}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold transition active:scale-[0.97] ${
                  theme === th ? "bg-white ring-2 ring-green" : "bg-white/60 ring-1 ring-line"
                }`}
              >
                <span className="size-5 rounded-full ring-1 ring-ink/15" style={{ background: THEMES[th].swatch }} aria-hidden />
                {t(`share.theme.${th}`)}
              </button>
            ))}
          </div>

          {/* Caption */}
          <div className="mt-5 flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-muted">{t("share.caption")}</p>
            <div className="flex gap-2">
              <button
                onClick={copyCaption}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-semibold text-ink-2 ring-1 ring-line active:scale-95"
              >
                <Icon name={captionCopied ? "check" : "link"} size={14} />
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
            rows={5}
            aria-label={t("share.caption")}
            className="mt-2 w-full resize-none rounded-2xl bg-white px-4 py-3 text-[15px] leading-relaxed ring-1 ring-line outline-none focus:ring-2 focus:ring-green"
          />

          {/* This map's own link */}
          <div
            ref={linkBoxRef}
            className={`mt-4 rounded-2xl p-3 transition-all duration-500 ${shared ? "bg-green-soft ring-2 ring-green" : "bg-white ring-1 ring-line"}`}
          >
            <p className="text-[13px] font-semibold">{shared ? t("link.titleShared") : t("link.titleMap")}</p>
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-paper p-1 pl-3 ring-1 ring-line">
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-green">
                {making ? t("link.making") : mapUrl.replace(/^https?:\/\//, "")}
              </span>
              <button
                onClick={copyLink}
                disabled={making}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold text-white active:scale-95 disabled:opacity-50 ${linkCopied ? "bg-green" : "bg-ink"}`}
              >
                <Icon name={linkCopied ? "check" : "link"} size={15} />
                {linkCopied ? t("invite.copied") : t("invite.copy")}
              </button>
            </div>
            <p className="mt-2 text-[12px] leading-snug text-ink-2">💡 {link.status === "ready" ? t("link.tipMap") : t("invite.tip")}</p>
          </div>

          <p className="mt-4 flex gap-2 text-[12px] leading-snug text-muted">
            <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
            {t("share.privateLink")}
          </p>
        </div>

        {/* Share */}
        <div className="shrink-0 border-t border-line/70 px-5 pt-3 pb-safe">
          {canShareFile && (
            <Button size="lg" className="mb-2 w-full" onClick={shareMap} disabled={!ready}>
              <Icon name="share" size={18} />
              {t("share.shareMap")}
            </Button>
          )}
          <p className="flex items-center gap-2 text-[12px] font-semibold text-muted">
            {canShareFile ? t("share.orApp") : t("share.where")}
            {making && <span className="size-3 animate-spin rounded-full border-2 border-green/25 border-t-green" aria-label={t("link.making")} />}
          </p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {targetButton("facebook", "share.facebook", "#1877F2")}
            {targetButton("messenger", "invite.messenger", "#0A7CFF")}
            {targetButton("whatsapp", "share.whatsapp", "#1FAF54")}
            <button
              onClick={download}
              disabled={!ready}
              aria-label={t("share.download")}
              className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white text-[12px] font-semibold text-ink-2 ring-1 ring-line transition active:scale-[0.97] disabled:opacity-50"
            >
              <Icon name="download" size={20} />
              {t("share.downloadShort")}
            </button>
          </div>
          <p className={`mt-2 min-h-5 text-center text-[12px] leading-snug ${status ? "font-semibold text-green" : "text-muted"}`} role="status">
            {status ?? (link.status === "ready" ? t("share.tip.link") : making ? t("link.making") : t("share.tip.desktopPaste"))}
          </p>
        </div>
      </div>
    </div>
  );
}
