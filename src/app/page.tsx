import type { Metadata } from "next";
import ClientApp from "@/components/ClientApp";
import { lookupEvent, normalizeDays } from "@/lib/event-lookup";
import { EV_PARAM, WIN_PARAM } from "@/lib/share";
import { shareMetadata } from "@/lib/share-metadata";

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
  const sp = await searchParams;
  const raw = sp[EV_PARAM];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) return {};
  const days = normalizeDays(sp[WIN_PARAM]);
  const ev = await lookupEvent(id, days);
  if (!ev) return {};
  return shareMetadata(ev, id, days);
}

export default function Home() {
  return <ClientApp />;
}
