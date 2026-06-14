"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/theme-context";
import { useT } from "@/lib/i18n/i18n-context";
import { cn } from "@/lib/utils";

/**
 * Compact light/dark theme toggle shown in the header.
 * Persists the choice and flips the gray ramp app-wide.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const t = useT();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={t("theme.toggle")}
      title={isDark ? t("theme.light") : t("theme.dark")}
      className="rounded-lg border border-gray-700/60 bg-gray-800/60 p-2 text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
