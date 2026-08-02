import type { Metadata } from "next";
import ClientApp from "@/components/ClientApp";
import { provinceBySlug } from "@/lib/provinces";
import { getDict } from "@/i18n";

const LOCALE = "tr" as const;

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * Haber sitelerinin iframe ile alabileceği sade harita.
 *
 * Dizine girmemesi bilinçli: asıl sayfaların içeriğinin kopyası, arama
 * sonuçlarında onlarla yarışmamalı (robots.ts'te de Disallow var).
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: getDict(LOCALE).meta.embedTitle,
};

export default async function EmbedPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = sp.il;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  const p = slug ? provinceBySlug(slug) : undefined;

  return (
    <ClientApp
      locale={LOCALE}
      dict={getDict(LOCALE)}
      embed
      focus={p ? { ad: p.ad, lat: p.lat, lon: p.lon } : undefined}
    />
  );
}
