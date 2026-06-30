"use client";

import { useT } from "@/lib/i18n/i18n-context";
import { PageHeader } from "./page-header";
import { BarChart3, FileText, type LucideIcon } from "lucide-react";

type Accent = "blue" | "green" | "purple" | "red" | "amber" | "violet" | "cyan" | "gray";

// Icons are resolved here (inside this client component) by name. A server
// component cannot pass an icon *function* across the RSC boundary
// ("Functions cannot be passed directly to Client Components"), so callers
// pass a string name instead.
const ICONS: Record<string, LucideIcon> = { BarChart3, FileText };

/**
 * A client-side wrapper around PageHeader that translates the subtitle via i18n key.
 * Use this in server components where useT() is not available.
 */
export function TranslatedPageHeader({
  iconName,
  title,
  subtitleKey,
  subtitleSuffix,
  accent,
  right,
}: {
  iconName: string;
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
  const Icon = ICONS[iconName] ?? BarChart3;
  return (
    <PageHeader icon={Icon} title={title} subtitle={subtitle} accent={accent} right={right} />
  );
}
