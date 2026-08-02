import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProvinceView, { provinceSummary } from "@/components/ProvinceView";
import { PROVINCES, provinceBySlug } from "@/lib/provinces";
import { ilStat, ilStats } from "@/lib/il-stats";
import { OG_LOCALE, alternates, fill } from "@/lib/i18n";
import { getDict } from "@/i18n";

const LOCALE = "tr" as const;

type Props = { params: Promise<{ il: string }> };

/** 81 il önceden bilinir; bilinmeyen slug 404. */
export function generateStaticParams() {
  return PROVINCES.map((p) => ({ il: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { il } = await params;
  const p = provinceBySlug(il);
  if (!p) return {};
  const t = getDict(LOCALE);
  const veri = ilStats();
  const s = ilStat(p.ad);

  const title = fill(t.meta.provinceTitle, { ad: p.ad });
  // Açıklama da ile özgü: 81 sayfa aynı meta description ile çıkmasın.
  const description = s
    ? fill(t.meta.provinceDescription, {
        ozet: provinceSummary(
          p.ad,
          s,
          veri?.guncelYil ?? new Date().getFullYear(),
          LOCALE
        ),
      })
    : fill(t.meta.provinceFallback, { ad: p.ad });

  return {
    title,
    description,
    alternates: alternates(`/yangin/${p.slug}`),
    openGraph: {
      title,
      description,
      type: "website",
      locale: OG_LOCALE.tr,
      url: `/yangin/${p.slug}`,
    },
  };
}

export default async function ProvincePage({ params }: Props) {
  const { il } = await params;
  const p = provinceBySlug(il);
  if (!p) notFound();

  return <ProvinceView p={p} locale={LOCALE} />;
}
