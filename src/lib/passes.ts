/**
 * Uydu geçiş pencereleri — veriden öğrenilir, sabit yazılmaz.
 *
 * Neden gerekli: platform yangını sürekli görmüyor. Ölçtük ([[tespit kabiliyeti]]):
 * en uzun kör aralıklar ~5 saat (04:00→09:00 ve 15:00→20:00 TR). Kullanıcı
 * "tespit yok" ile "yangın bitti"yi karıştırmasın diye, o an kör aralıkta olup
 * olmadığını ve bir sonraki geçişin ne zaman beklendiğini görmesi gerekiyor.
 *
 * Yöntem: son 48 saatteki tespitlerin UTC saatlerini histogramla; tespit görülen
 * saatler = geçiş pencereleri. Yörünge tablosu gömmüyoruz — kaynak kümesi
 * değişirse (yeni uydu, kayıp uydu) bu kendiliğinden uyum sağlar.
 */

import type { Locale } from "./i18n";

export interface PassInfo {
  /** en yeni tespitin üstünden geçen saat */
  sinceH: number | null;
  /** bir sonraki geçiş penceresine tahmini saat; bilinmiyorsa null */
  nextH: number | null;
  /** şu an bilinen bir geçiş penceresinin dışındayız */
  inGap: boolean;
  /** ölçülen pencere saatleri (UTC) — teşhis/başlık için */
  windows: number[];
}

const MIN_SAMPLES = 20;

export function nextPassEstimate(
  detectionTimes: number[],
  now: number,
  newest: number | null
): PassInfo {
  const sinceH = newest ? (now - newest) / 3600_000 : null;

  const recent = detectionTimes.filter((t) => now - t < 48 * 3600_000);
  if (recent.length < MIN_SAMPLES) {
    return { sinceH, nextH: null, inGap: false, windows: [] };
  }

  // Saat başına tespit sayısı (UTC)
  const bins = new Array(24).fill(0);
  for (const t of recent) bins[new Date(t).getUTCHours()]++;

  // Pencere eşiği: ortalamanın altında kalan saatler "kör" sayılır.
  // Mutlak sayı yerine orana bakmak, yoğun/sakin günlerde aynı davranır.
  const total = recent.length;
  const esik = Math.max(1, (total / 24) * 0.5);
  const windows: number[] = [];
  for (let h = 0; h < 24; h++) if (bins[h] >= esik) windows.push(h);
  if (!windows.length || windows.length === 24) {
    return { sinceH, nextH: null, inGap: false, windows };
  }

  const nowH = new Date(now).getUTCHours();
  const nowFrac = nowH + new Date(now).getUTCMinutes() / 60;
  const inGap = !windows.includes(nowH);

  // Bir sonraki pencereye kalan saat (gün dönüşünü sarmalayarak)
  let nextH: number | null = null;
  for (let d = 0; d < 24; d++) {
    const h = (Math.floor(nowFrac) + 1 + d) % 24;
    if (windows.includes(h)) {
      nextH = Math.max(0, Math.floor(nowFrac) + 1 + d - nowFrac);
      break;
    }
  }
  return { sinceH, nextH, inGap, windows };
}

const NEXT: Record<Locale, { soon: string; one: string; many: string }> = {
  tr: { soon: "birazdan", one: "≈1 sa sonra", many: "≈{n} sa sonra" },
  en: { soon: "shortly", one: "in ≈1 h", many: "in ≈{n} h" },
};

/** "≈2 sa sonra" / "in ≈2 h" gibi kısa ifade */
export function fmtNext(h: number | null, locale: Locale): string {
  if (h === null) return "—";
  const t = NEXT[locale];
  if (h < 0.5) return t.soon;
  if (h < 1.5) return t.one;
  return t.many.replace("{n}", String(Math.round(h)));
}
