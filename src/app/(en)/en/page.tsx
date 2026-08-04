import type { Metadata } from "next";
import ClientApp from "@/components/ClientApp";
import { lookupEvent, normalizeDays } from "@/lib/event-lookup";
import { EV_PARAM, WIN_PARAM } from "@/lib/share";
import { shareMetadata } from "@/lib/share-metadata";
import { alternatesEn } from "@/lib/i18n";
import { homeOpenGraph } from "@/lib/og";
import { homeSummary } from "@/lib/home-summary";
import { webApplicationLd } from "@/lib/jsonld";
import SeoSummary from "@/components/SeoSummary";
import JsonLd from "@/components/JsonLd";
import { getDict } from "@/i18n";

const LOCALE = "en" as const;

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** Türkçe kökle aynı davranış — paylaşım kartı da İngilizce üretilir. */
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const base: Metadata = {
    alternates: alternatesEn("/"),
    openGraph: homeOpenGraph(LOCALE),
  };
  const sp = await searchParams;
  const raw = sp[EV_PARAM];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) return base;
  const days = normalizeDays(sp[WIN_PARAM]);
  const ev = await lookupEvent(id, days);
  if (!ev) return base;
  return { ...base, ...shareMetadata(ev, id, days, LOCALE, getDict(LOCALE)) };
}

export default async function EnHome() {
  const ozet = await homeSummary();
  return (
    <>
      <JsonLd data={webApplicationLd(LOCALE)} />
      <SeoSummary locale={LOCALE} {...ozet} />
      <ClientApp locale={LOCALE} dict={getDict(LOCALE)} />
    </>
  );
}
