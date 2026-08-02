/**
 * Türkçe ek çekimi — özel adlara kesme işaretiyle.
 *
 * 81 il sayfası şablonla üretiliyor; ek sabit yazılınca "Muğla'de",
 * "Zonguldak'da", "Muğla'e" gibi hatalar 81 sayfada birden görünüyor.
 *
 * Kurallar:
 * • Kalınlık-incelik: son ünlü a/ı/o/u → kalın, e/i/ö/ü → ince
 * • Sertleşme: sözcük sert ünsüzle bitiyorsa (f s t k ç ş h p) d → t
 * • Yönelme ekinde ünlüyle biten sözcüğe kaynaştırma y'si girer
 */

import type { Locale } from "./i18n";

const KALIN = new Set("aıouâû");
const INCE = new Set("eiöüî");
const SERT = new Set("fstkçşhp");
const UNLU = new Set("aeıioöuüâîû");

/** Son ünlüye göre kalın mı? Ünlü yoksa kalın kabul edilir. */
function kalinMi(ad: string): boolean {
  const s = ad.toLowerCase();
  for (let i = s.length - 1; i >= 0; i--) {
    if (KALIN.has(s[i])) return true;
    if (INCE.has(s[i])) return false;
  }
  return true;
}

function sertBitis(ad: string): boolean {
  return SERT.has(ad[ad.length - 1]?.toLowerCase() ?? "");
}

function unluBitis(ad: string): boolean {
  return UNLU.has(ad[ad.length - 1]?.toLowerCase() ?? "");
}

/** Bulunma hâli: Muğla'da · İzmir'de · Zonguldak'ta · Bilecik'te */
export function bulunma(ad: string): string {
  const d = sertBitis(ad) ? "t" : "d";
  return `${ad}'${d}${kalinMi(ad) ? "a" : "e"}`;
}

/** Yönelme hâli: Muğla'ya · İzmir'e · Zonguldak'a · Rize'ye */
export function yonelme(ad: string): string {
  const y = unluBitis(ad) ? "y" : "";
  return `${ad}'${y}${kalinMi(ad) ? "a" : "e"}`;
}

/**
 * Dile göre hâl eki.
 *
 * İngilizcede ad çekilmez — ilgi edatı ("in Muğla", "near Muğla") cümle
 * şablonunun kendi içinde durur. Bu yüzden İngilizce tarafta ad olduğu gibi
 * geçer; Türkçe ek mantığı İngilizce sayfaya hiç bulaşmaz.
 */
export const locative = (ad: string, locale: Locale): string =>
  locale === "tr" ? bulunma(ad) : ad;

export const dative = (ad: string, locale: Locale): string =>
  locale === "tr" ? yonelme(ad) : ad;
