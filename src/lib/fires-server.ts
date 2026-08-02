import { FIRMS_SOURCES, firmsAreaUrl, parseFirmsCsv } from "@/lib/firms";
import { genFixtureCsv } from "@/data/fixture";
import type { FirePoint, FiresMeta } from "@/lib/types";

/**
 * FIRMS'in gerçek sınırı: bu bbox için dayRange en fazla 5.
 * 6, 7, 8 ve 10 denendi — hepsi HTTP 400 döndü (2026-08-01). Belge 1-10
 * diyor ama pratik sınır alan büyüklüğüne bağlı. Bu yüzden en geniş
 * pencere 5 gün; arayüzde de "5g" yazıyor, kullanıcıya vermediğimiz
 * bir aralık vaat edilmiyor.
 */
export const WINDOW_TO_DAYRANGE: Record<
  string,
  { hours: number; dayRange: number }
> = {
  "1": { hours: 24, dayRange: 2 },
  "2": { hours: 48, dayRange: 3 },
  "5": { hours: 120, dayRange: 5 },
};

export class FiresUnavailableError extends Error {}

export interface LoadedFires {
  points: FirePoint[];
  meta: FiresMeta;
}

/**
 * FIRMS tespitlerini çeker, pencereye göre süzer ve tekrarları temizler.
 *
 * Route dışında da kullanılıyor: paylaşım linkinin metadata'sı ve OG kartı
 * aynı olayı sunucuda yeniden kümeleyebilsin diye. Böylece paylaşılan karttaki
 * sayılar URL'den değil daima gerçek veriden gelir — uydurma bir kart
 * üretilemez (kamu güvenliği haritasında dezenformasyon vektörü olurdu).
 */
export async function loadFires(daysParam: string): Promise<LoadedFires> {
  // hasOwn şart: "constructor"/"__proto__" gibi anahtarlar truthy döner ve
  // ?? fallback'ini atlayıp win.hours'u undefined bırakırdı.
  const win = Object.hasOwn(WINDOW_TO_DAYRANGE, daysParam)
    ? WINDOW_TO_DAYRANGE[daysParam]
    : WINDOW_TO_DAYRANGE["1"];
  const now = Date.now();
  const mapKey = process.env.FIRMS_MAP_KEY;

  let raw: FirePoint[] = [];
  let sourcesOk = 0;
  const errors: string[] = [];
  const demo = !mapKey;

  if (!mapKey) {
    raw = parseFirmsCsv(genFixtureCsv(now));
    sourcesOk = 1;
  } else {
    const results = await Promise.allSettled(
      FIRMS_SOURCES.map(async (source) => {
        const res = await fetch(firmsAreaUrl(mapKey, source, win.dayRange), {
          next: { revalidate: 600 },
        });
        const text = await res.text();
        if (!res.ok)
          throw new Error(`${source}: HTTP ${res.status} ${text.slice(0, 80)}`);
        // FIRMS hata durumunda da 200 + düz metin dönebiliyor
        if (!text.startsWith("latitude"))
          throw new Error(`${source}: beklenmeyen yanıt: ${text.slice(0, 80)}`);
        return parseFirmsCsv(text);
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        sourcesOk++;
        raw.push(...r.value);
      } else {
        errors.push(String(r.reason?.message ?? r.reason).slice(0, 140));
      }
    }
    if (sourcesOk === 0) {
      // Detay yalnız sunucu logunda: upstream gövdesi istek yolunu
      // (dolayısıyla MAP_KEY'i) yansıtabilir, istemciye verilmez.
      console.error("FIRMS tüm kaynaklar fail:", errors);
      throw new FiresUnavailableError("FIRMS kaynaklarına ulaşılamadı");
    }
  }

  const cutoff = now - win.hours * 3600_000;
  const seen = new Set<string>();
  const points: FirePoint[] = [];
  let newest: number | null = null;

  for (const p of raw) {
    if (p.dt < cutoff || p.dt > now + 30 * 60_000) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    if (newest === null || p.dt > newest) newest = p.dt;
    points.push(p);
  }

  return {
    points,
    meta: {
      demo,
      fetchedAt: now,
      newest,
      windowHours: win.hours,
      sourcesOk,
      sourcesTotal: demo ? 1 : FIRMS_SOURCES.length,
    },
  };
}
