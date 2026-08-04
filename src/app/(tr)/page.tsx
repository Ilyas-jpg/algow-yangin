import type { Metadata } from "next";
import ClientApp from "@/components/ClientApp";
import { lookupEvent, normalizeDays } from "@/lib/event-lookup";
import { EV_PARAM, WIN_PARAM } from "@/lib/share";
import { shareMetadata } from "@/lib/share-metadata";
import { alternates } from "@/lib/i18n";
import { homeOpenGraph } from "@/lib/og";
import { homeSummary } from "@/lib/home-summary";
import { webApplicationLd } from "@/lib/jsonld";
import SeoSummary from "@/components/SeoSummary";
import JsonLd from "@/components/JsonLd";
import { getDict } from "@/i18n";

const LOCALE = "tr" as const;

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * Paylaşılan bağlantı (?ev=) sohbet uygulamalarında anlamlı görünsün.
 * Olay sunucuda yeniden kümelenerek çözülür; başlık ve kart gerçek veriden
 * gelir, URL'den değil.
 */
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  // Paylaşılan olay yoksa kartı açılış perdesi taşır; `?ev=` varsa aşağıdaki
  // shareMetadata openGraph'ı bütünüyle değiştirip yangının kendi kartını basar.
  const base: Metadata = {
    alternates: alternates("/"),
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

export default async function Home() {
  const ozet = await homeSummary();
  return (
    <>
      <JsonLd data={webApplicationLd(LOCALE)} />
      {/* Sunucudan gelen içerik: harita mount olana dek görünür, sonra
          haritanın altında kalır. JS yoksa sayfanın kendisi bu. */}
      <SeoSummary locale={LOCALE} {...ozet} />
      <ClientApp locale={LOCALE} dict={getDict(LOCALE)} />
    </>
  );
}
