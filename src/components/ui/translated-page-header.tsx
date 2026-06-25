"use client";

import { useT } from "@/lib/i18n/i18n-context";
import { PageHeader } from "./page-header";
import type { LucideIcon } from "lucide-react";

type Accent = "blue" | "green" | "purple" | "red" | "amber" | "violet" | "cyan" | "gray";

/**
 * A client-side wrapper around PageHeader that translates the subtitle via i18n key.
 * Use this in server components where useT() is not available.
 */
export function TranslatedPageHeader({
  icon,
  title,
  subtitleKey,
  subtitleSuffix,
  accent,
  right,
}: {
  icon: LucideIcon;
  title: string;
  subtitleKey: string;
  subtitleSuffix?: string;
  accent?: Accent;
  right?: React.ReactNode;
}) {
  const t = useT();
  const subtitle = subtitleSuffix
    ? `${t(subtitleKey)} ${subtitleSuffix}`
    : t(subtitleKey);
  return (
    <PageHeader icon={icon} title={title} subtitle={subtitle} accent={accent} right={right} />
  );
}
