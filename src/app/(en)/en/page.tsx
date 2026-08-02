import type { Metadata } from "next";
import ClientApp from "@/components/ClientApp";
import { lookupEvent, normalizeDays } from "@/lib/event-lookup";
import { EV_PARAM, WIN_PARAM } from "@/lib/share";
import { shareMetadata } from "@/lib/share-metadata";
import { alternatesEn } from "@/lib/i18n";
import { getDict } from "@/i18n";

const LOCALE = "en" as const;

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** Türkçe kökle aynı davranış — paylaşım kartı da İngilizce üretilir. */
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const base: Metadata = { alternates: alternatesEn("/") };
  const sp = await searchParams;
  const raw = sp[EV_PARAM];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) return base;
  const days = normalizeDays(sp[WIN_PARAM]);
  const ev = await lookupEvent(id, days);
  if (!ev) return base;
  return { ...base, ...shareMetadata(ev, id, days, LOCALE, getDict(LOCALE)) };
}

export default function EnHome() {
  return <ClientApp locale={LOCALE} dict={getDict(LOCALE)} />;
}
