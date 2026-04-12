"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n/i18n-context";
import { cn } from "@/lib/utils";

/**
 * Compact language toggle shown in the header.
 * Clicking cycles between English and Korean and persists the choice.
 */
export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-gray-700/60 bg-gray-800/60 p-0.5"
      role="group"
      aria-label="Language"
    >
      <Languages className="ml-1.5 h-3.5 w-3.5 text-gray-500" />
      {(["en", "ko"] as const).map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
            lang === code
              ? "bg-blue-600/25 text-blue-200"
              : "text-gray-500 hover:text-gray-200",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
