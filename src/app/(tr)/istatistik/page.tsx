import type { Metadata } from "next";
import StatsView from "@/components/StatsView";
import JsonLd from "@/components/JsonLd";
import { alternates } from "@/lib/i18n";
import { datasetLd, statsYears } from "@/lib/jsonld";
import { getDict } from "@/i18n";

const LOCALE = "tr" as const;
const t = getDict(LOCALE);

export const metadata: Metadata = {
  title: t.meta.statsTitle,
  description: t.meta.statsDescription,
  alternates: alternates("/istatistik"),
};

export default function IstatistikPage() {
  return (
    <>
      {/* Bu sayfa bir veri kümesi — arama motoruna öyle tanıtılıyor,
          kaynağı da (NASA FIRMS) yapılandırılmış veride atfediliyor. */}
      <JsonLd data={datasetLd(LOCALE, statsYears())} />
      <StatsView locale={LOCALE} />
    </>
  );
}
