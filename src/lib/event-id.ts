import { havKm } from "./geo";
import { inRegion } from "./bbox";

/**
 * Olay kimliği `lon:lat:saat` biçiminde ve İLK geçişe bağlı
 * (bkz. cluster.ts — son geçişe bağlıyken seçim her tazelemede elden
 * kayıyordu). Bunun paylaşım açısından bir yan etkisi var: zaman penceresi
 * kaydıkça en eski geçiş pencereden düşer, ilk geçiş değişir, kimlik de
 * değişir. Yani ham kimlik eşleşmesi paylaşılan bağlantıyı birkaç saatte
 * kullanılamaz hâle getirirdi.
 *
 * Çözüm kimliğin kendi içinde: koordinatı zaten taşıyor. Tam eşleşme yoksa
 * o koordinata en yakın olayı kabul ediyoruz — kullanıcı "şu yangını" demek
 * istemişti, kimliğin harfi harfine tutması gerekmiyor.
 */
export interface ParsedEventId {
  lon: number;
  lat: number;
  /** İlk geçişin saat cinsinden epoch'u */
  hour: number;
}

export function parseEventId(id: string): ParsedEventId | null {
  const parts = id.split(":");
  if (parts.length !== 3) return null;
  const lon = Number(parts[0]);
  const lat = Number(parts[1]);
  const hour = Number(parts[2]);
  if (!isFinite(lon) || !isFinite(lat) || !isFinite(hour)) return null;
  // Uydu bbox'ının dışı = bozuk/uydurma kimlik
  if (!inRegion(lon, lat)) return null;
  return { lon, lat, hour };
}

/** Aynı yangın sayılmak için kimlikteki koordinata azami uzaklık. */
export const MAX_MATCH_KM = 15;

/**
 * Paylaşılan kimliği eldeki olaylara bağla.
 * Önce birebir, sonra kimlikteki koordinata en yakın olay.
 */
export function resolveEvent<T extends { id: string; lon: number; lat: number }>(
  events: T[],
  id: string
): T | null {
  const exact = events.find((e) => e.id === id);
  if (exact) return exact;

  const p = parseEventId(id);
  if (!p) return null;

  let best: T | null = null;
  let bestKm = Infinity;
  for (const e of events) {
    const km = havKm(p.lon, p.lat, e.lon, e.lat);
    if (km < bestKm) {
      bestKm = km;
      best = e;
    }
  }
  return best && bestKm <= MAX_MATCH_KM ? best : null;
}
