import type { Metadata } from "next";
import StatsView from "@/components/StatsView";
import { alternates } from "@/lib/i18n";
import { getDict } from "@/i18n";

const LOCALE = "tr" as const;
const t = getDict(LOCALE);

export const metadata: Metadata = {
  title: t.meta.statsTitle,
  description: t.meta.statsDescription,
  alternates: alternates("/istatistik"),
};

export default function IstatistikPage() {
  return <StatsView locale={LOCALE} />;
}
