import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProvinceView, { provinceSummary } from "@/components/ProvinceView";
import { PROVINCES, provinceBySlug } from "@/lib/provinces";
import { ilStat, ilStats } from "@/lib/il-stats";
import { OG_LOCALE, alternatesEn, fill } from "@/lib/i18n";
import { getDict } from "@/i18n";

const LOCALE = "en" as const;

type Props = { params: Promise<{ il: string }> };

/**
 * İl slug'ları ÇEVRİLMEZ: `/en/fires/mugla`. Slug bir kimlik — çevrilseydi
 * aynı sayfanın iki adı olur, paylaşılan bağlantılar ayrışırdı.
 */
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
    alternates: alternatesEn(`/yangin/${p.slug}`),
    openGraph: {
      title,
      description,
      type: "website",
      locale: OG_LOCALE.en,
      url: `/en/fires/${p.slug}`,
    },
  };
}

export default async function EnProvincePage({ params }: Props) {
  const { il } = await params;
  const p = provinceBySlug(il);
  if (!p) notFound();

  return <ProvinceView p={p} locale={LOCALE} />;
}
