import { FIXED_SOURCES } from "@/data/fixed-sources";
import { havKm } from "./geo";

export interface FixedSourceHit {
  /** bu sezon kaç ayrı günde sıcak göründü */
  days: number;
  /** ≥70/94 gün — mevsim boyunca neredeyse kesintisiz */
  certain: boolean;
}

/**
 * Eşleşme yarıçapı. Kaynak listesi 0,05° (≈5 km) ızgarada tutuluyor ve
 * koordinat hücre merkezine yuvarlanmış; olayın merkezi hücrenin herhangi bir
 * köşesine düşebilir. 4 km bu payı karşılar, komşu hücreye taşmaz.
 */
const MATCH_KM = 4;

/**
 * Bu konumda sürekli bir ısı kaynağı var mı?
 *
 * Uydu alev değil ısı görüyor: rafineri, çelik fabrikası, santral ve gaz bacası
 * her gün sıcak. Bunlar "aktif yangın" sayısını şişiriyordu — sayıdan düşülüp
 * kullanıcıya neden haritada oldukları anlatılıyor (gizlenmiyorlar).
 */
export function fixedSourceAt(lon: number, lat: number): FixedSourceHit | null {
  let best: FixedSourceHit | null = null;
  let bestKm = Infinity;
  for (const [sLon, sLat, days, certain] of FIXED_SOURCES) {
    const km = havKm(lon, lat, sLon, sLat);
    if (km <= MATCH_KM && km < bestKm) {
      bestKm = km;
      best = { days, certain: certain === 1 };
    }
  }
  return best;
}
