/**
 * En yakın yanma kaynaklı sanayi tesisi.
 *
 * ⚠️ Bu SERT ETİKET DEĞİL, MODELE ÖZELLİK.
 *
 * "Yakınında fabrika var" bir tespiti yangın olmaktan çıkarmaz —
 * rafineriden 2 km ötede gerçek orman yangını çıkabilir ve öyle
 * etiketlemek, ilk-alarm katmanının gerçek yangını susturması demek olur.
 * Modele uzaklığı ve türü veriyoruz, kararı o veriyor: örneğin "flare'e
 * 300 m + FRP hep aynı" ile "çam ormanında 300 MW" arasındaki farkı
 * ağaçlar kendisi öğrensin.
 *
 * Sert NEGATİF etiket yalnız ölçülmüş kanıttan gelir: aynı 0,05° hücrede
 * ≥40 ayrı gün sıcak (`lib/fixed-sources.ts`).
 */
import { SANAYI_TR, type SanayiTur } from "@/data/industrial-tr";
import { havKm } from "./geo";

export interface IndustrialHit {
  km: number;
  kind: SanayiTur;
}

/**
 * Boylama göre kova indeksi.
 *
 * 7.771 tesis × binlerce sinyal = milyonlarca mesafe hesabı. Tesisler
 * boylama göre sıralı geldiği için 1°'lik kovalara bölüp yalnız komşu
 * kovalara bakıyoruz; en kötü durumda tarama alanı ~%2'ye iniyor.
 */
const KOVA = new Map<number, [number, number, SanayiTur][]>();
for (const t of SANAYI_TR) {
  const k = Math.floor(t[0]);
  const arr = KOVA.get(k);
  if (arr) arr.push(t);
  else KOVA.set(k, [t]);
}

/** Bu yarıçapın ötesi model için bilgi taşımıyor; null dönüyoruz. */
const MAX_KM = 50;

export function nearestIndustrial(lon: number, lat: number): IndustrialHit | null {
  // 1° boylam ~85 km (39°N); MAX_KM=50 için komşu kova yeter.
  const k0 = Math.floor(lon);
  let best: IndustrialHit | null = null;

  for (let k = k0 - 1; k <= k0 + 1; k++) {
    const arr = KOVA.get(k);
    if (!arr) continue;
    for (const [tLon, tLat, kind] of arr) {
      // Ucuz ön eleme: enlem farkı tek başına eşiği aşıyorsa mesafeye bakma.
      if (Math.abs(tLat - lat) > MAX_KM / 111) continue;
      const km = havKm(lon, lat, tLon, tLat);
      if (km <= MAX_KM && (best === null || km < best.km)) {
        best = { km, kind };
      }
    }
  }
  return best;
}
