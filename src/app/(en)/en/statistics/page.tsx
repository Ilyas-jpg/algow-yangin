import type { Metadata } from "next";
import StatsView from "@/components/StatsView";
import JsonLd from "@/components/JsonLd";
import { alternatesEn } from "@/lib/i18n";
import { datasetLd, statsYears } from "@/lib/jsonld";
import { getDict } from "@/i18n";

const LOCALE = "en" as const;
const t = getDict(LOCALE);

export const metadata: Metadata = {
  title: t.meta.statsTitle,
  description: t.meta.statsDescription,
  alternates: alternatesEn("/istatistik"),
};

export default function EnStatisticsPage() {
  return (
    <>
      <JsonLd data={datasetLd(LOCALE, statsYears())} />
      <StatsView locale={LOCALE} />
    </>
  );
}
