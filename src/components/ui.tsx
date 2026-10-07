import type { ButtonHTMLAttributes, ReactNode, SVGProps } from "react";
import { useI18n } from "../i18n/I18nProvider";

/* ---------- Icons (inline, 1.75 stroke, no icon library) ---------- */

type IconName =
  | "arrow-right"
  | "arrow-left"
  | "close"
  | "plus"
  | "minus"
  | "reset"
  | "search"
  | "share"
  | "download"
  | "link"
  | "check"
  | "up"
  | "down"
  | "sparkle"
  | "lock"
  | "globe"
  | "eye-off"
  | "edit"
  | "route"
  | "trash";

const PATHS: Record<IconName, ReactNode> = {
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  reset: <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  share: <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  sparkle: <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
    </>
  ),
  "eye-off": <path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3.2 3.6M6.5 7.6C4.3 9.1 3 12 3 12s4 6 9 6c1.5 0 2.9-.5 4.1-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  edit: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" />,
  route: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />,
};

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

export function BrandIcon({ brand, size = 20 }: { brand: "facebook" | "messenger" | "whatsapp"; size?: number }) {
  if (brand === "facebook")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"
        />
      </svg>
    );
  if (brand === "messenger")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2C6.4 2 2 6.1 2 11.7c0 2.9 1.2 5.5 3.1 7.2.2.1.3.4.3.6l.1 1.8c0 .6.6.9 1.1.7l2-.9c.2-.1.4-.1.6 0 .9.2 1.8.4 2.8.4 5.6 0 10-4.1 10-9.7S17.6 2 12 2zm6 7.5l-2.9 4.6c-.5.7-1.5.9-2.1.4l-2.3-1.7a.6.6 0 0 0-.7 0l-3.1 2.4c-.4.3-1-.2-.7-.6L9 10c.5-.7 1.5-.9 2.1-.4l2.3 1.7c.2.2.5.2.7 0l3.1-2.4c.4-.3 1 .2.7.6z"
        />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zM12 0a12 12 0 0 0-10.3 18L0 24l6.2-1.6A12 12 0 1 0 12 0z"
      />
    </svg>
  );
}

/* ---------- Buttons ---------- */

type Variant = "primary" | "secondary" | "ghost" | "dark";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-green text-white shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_8px_20px_-8px_rgb(11_93_59/0.6)] hover:bg-green-2 active:scale-[0.98]",
  dark: "bg-ink text-white hover:bg-black active:scale-[0.98]",
  secondary: "bg-white text-ink ring-1 ring-line hover:ring-ink/20 shadow-soft active:scale-[0.98]",
  ghost: "text-ink-2 hover:bg-ink/5 active:bg-ink/10",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";

const SIZES = {
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-7 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <button className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`} {...rest} />;
}

export function IconButton({
  label,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`grid size-11 place-items-center rounded-full bg-white text-ink shadow-soft ring-1 ring-line transition hover:ring-ink/20 active:scale-95 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Brand ---------- */

export function Logo({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <a href="/" className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`} aria-label={t("app.name")}>
      <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="18" fill="#0B5D3B" />
        <circle cx="29" cy="32" r="12.5" fill="#E4573D" />
        <path d="M41 18c4 3 7 8 7 14s-3 11-7 14" stroke="#FAF6EF" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
      <span className="text-[15px]">{t("app.name")}</span>
    </a>
  );
}

export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const opt = (l: "bn" | "en", label: string) => (
    <button
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      className={`h-8 rounded-full px-3 text-[13px] font-semibold transition ${
        lang === l ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label={t("lang.switch")} className={`inline-flex rounded-full bg-white p-1 ring-1 ring-line ${className}`}>
      {opt("bn", "বাংলা")}
      {opt("en", "English")}
    </div>
  );
}
