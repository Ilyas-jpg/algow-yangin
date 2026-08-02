import type { Metadata } from "next";
import ClientApp from "@/components/ClientApp";
import { lookupEvent, normalizeDays } from "@/lib/event-lookup";
import { EV_PARAM, WIN_PARAM } from "@/lib/share";
import { shareMetadata } from "@/lib/share-metadata";
import { alternates } from "@/lib/i18n";
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
  const base: Metadata = { alternates: alternates("/") };
  const sp = await searchParams;
  const raw = sp[EV_PARAM];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) return base;
  const days = normalizeDays(sp[WIN_PARAM]);
  const ev = await lookupEvent(id, days);
  if (!ev) return base;
  return { ...base, ...shareMetadata(ev, id, days, LOCALE, getDict(LOCALE)) };
}

export default function Home() {
  return <ClientApp locale={LOCALE} dict={getDict(LOCALE)} />;
}
