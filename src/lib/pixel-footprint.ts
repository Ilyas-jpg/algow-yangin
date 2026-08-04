import type { FeatureCollection, Polygon } from "geojson";

/**
 * Uydu pikselinin gerçek yer ayak izi.
 *
 * Tespit haritada tek bir nokta olarak çiziliyor ama ölçüm bir noktadan
 * gelmiyor: VIIRS pikseli nadirde 375 m, tarama kenarında ~800 m. Yani
 * "yangın tam burada" değil, "yangın bu hücrenin içinde bir yerde".
 * Hakkında sayfasındaki *konum sapması normaldir* cümlesinin görsel karşılığı
 * bu elips.
 *
 * Eksenler FIRMS'in kendi alanlarından: `scan` tarama yönündeki (yaklaşık
 * doğu-batı), `track` iz yönündeki (yaklaşık kuzey-güney) piksel ölçüsü.
 * Kutupsal yörüngede iz kuzey-güneye yakın olduğu için bu yaklaşım tutuyor;
 * gerçek yörünge açısı FIRMS CSV'sinde verilmiyor, uydurmuyoruz.
 */

/**
 * Bu zumun altında elips çizilmiyor.
 *
 * Spec 9 diyordu; ÖLÇÜLDÜ (2026-08-04, lat 41, 375 m'lik nadir pikseli):
 *   z9 → 3,3 px · z10 → 6,5 px · z11 → **13 px** · z12 → 26 px
 * 3 piksellik bir halka ~5 piksellik tespit noktasının etrafında okunmuyor,
 * yalnız bulanıklık bırakıyor. Bu projede aynı hata koni için bir kez yapıldı
 * (İlyas: *"koni falan kalmadı"* — ülke görünümünde halkalar 4 px'ti) ve kural
 * oradan çıktı: okunmayan şekli çizme. 11'de elips gerçekten görülüyor.
 */
export const PIXEL_MINZOOM = 11;

/** Elipsi kaç köşeyle çiziyoruz. 20 yeterince yuvarlak, yeterince ucuz. */
const KOSE = 20;

const KM_PER_DEG_LAT = 110.57;
const KM_PER_DEG_LON = 111.32;

export interface FootprintInput {
  geometry: { coordinates: [number, number] | number[] };
  properties: { sc?: number; tk?: number; [k: string]: unknown };
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Tek pikselin elips halkası (kapalı poligon). */
export function footprintRing(
  lon: number,
  lat: number,
  scanKm: number,
  trackKm: number
): [number, number][] {
  const kmLon = KM_PER_DEG_LON * Math.cos((lat * Math.PI) / 180);
  // Bozuk/çok kuzey enlemde sıfıra bölmeyi engelle.
  const aDeg = kmLon > 0.001 ? scanKm / 2 / kmLon : 0;
  const bDeg = trackKm / 2 / KM_PER_DEG_LAT;

  const halka: [number, number][] = [];
  for (let i = 0; i < KOSE; i++) {
    const a = (i / KOSE) * Math.PI * 2;
    halka.push([
      Math.round((lon + aDeg * Math.cos(a)) * 1e5) / 1e5,
      Math.round((lat + bDeg * Math.sin(a)) * 1e5) / 1e5,
    ]);
  }
  halka.push(halka[0]);
  return halka;
}

/**
 * Ekrandaki tespitlerin ayak izleri.
 *
 * Sınır süzgeci bilerek burada: 5 günlük pencerede ~9.700 nokta var ve
 * hepsine 20 köşeli poligon üretmek yakın zumda gereksiz — kullanıcı zaten
 * tek bir yangına bakıyor.
 */
export function footprintFC(
  noktalar: FootprintInput[],
  b: Bounds
): FeatureCollection<Polygon> {
  const features: FeatureCollection<Polygon>["features"] = [];
  for (const n of noktalar) {
    const [lon, lat] = n.geometry.coordinates as [number, number];
    if (lon < b.west || lon > b.east || lat < b.south || lat > b.north) continue;
    const sc = n.properties.sc;
    const tk = n.properties.tk;
    // Ölçü yoksa uydurma: kaynak (ör. Meteosat ya da eski arşiv) scan/track
    // vermiyorsa o nokta ayak izi olmadan, sade nokta olarak kalır.
    if (typeof sc !== "number" || typeof tk !== "number") continue;
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [footprintRing(lon, lat, sc, tk)] },
      properties: {},
    });
  }
  return { type: "FeatureCollection", features };
}
