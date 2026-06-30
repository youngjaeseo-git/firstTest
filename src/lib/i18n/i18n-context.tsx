"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { translate, type Language } from "./translations";

const STORAGE_KEY = "dcim.lang";
const DEFAULT_LANGUAGE: Language = "en";

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(DEFAULT_LANGUAGE);

  // Hydrate from localStorage on mount (client-only to avoid SSR mismatch)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "ko") {
        setLangState(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key: string) => translate(lang, key),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): (key: string) => string {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback: default English when used outside provider (e.g. in tests)
    return (key: string) => translate(DEFAULT_LANGUAGE, key);
  }
  return ctx.t;
}

export function useLanguage(): {
  lang: Language;
  setLang: (lang: Language) => void;
} {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return { lang: DEFAULT_LANGUAGE, setLang: () => {} };
  }
  return { lang: ctx.lang, setLang: ctx.setLang };
}
