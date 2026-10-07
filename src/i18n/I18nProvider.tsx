import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { localizeDigits, translate, type Lang, type StringKey } from "./strings";
import { storage } from "../lib/storage";

const LANG_KEY = "mbd:lang";

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  num: (n: number | string) => string;
}

const Ctx = createContext<I18n | null>(null);

function initialLang(): Lang {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "en" || q === "bn") {
    storage.set(LANG_KEY, q);
    return q;
  }
  const saved = storage.get<Lang>(LANG_KEY);
  if (saved === "bn" || saved === "en") return saved;
  // Bangla is the default for everyone; most Bangladeshi phones report an English locale,
  // so browser language is not a useful signal here.
  return "bn";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.set(LANG_KEY, l);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      num: (n) => localizeDigits(n, lang),
    }),
    [lang, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside provider");
  return v;
}
