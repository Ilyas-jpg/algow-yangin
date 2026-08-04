import { bearingDeg, havKm, toRad } from "./geo";

/**
 * İki uydu geçişi arasında yangının GERÇEKTE nereye ilerlediği.
 *
 * Bu modül yön tahmininin ETİKETİNİ üretir: koni "şuraya gidecek" diyor,
 * burası "şuraya gitti" diyor. İkisinin farkı isabet ölçümüdür ve veriden
 * öğrenen bir yön modelinin hedef değişkeni budur.
 *
 * ⚠️ YÖN, AYAK İZİNE GÖRE ÖLÇÜLÜR — tek bir tepe noktasından değil.
 * İlk ölçümde her yeni pikselin yönü koninin tepe noktasından (apex)
 * alınmıştı. Manavgat 30 km genişken "en uzak yeni piksel" hep karşı
 * kanattaki cephe çıktı ve ortalama hata 109°'ye fırladı — rastgeleden
 * (90°) kötü. Ölçtüğümüz şey yön hatası değil, yangının BÜYÜKLÜĞÜYDÜ.
 * Her yeni pikseli en yakın yanmış piksele bağlayınca aynı veride hata
 * 78°'ye indi. Bu tanım olay boyutundan bağımsızdır.
 */

export interface Pt {
  lon: number;
  lat: number;
}

export interface NewPixel extends Pt {
  /** en yakın yanmış pikselden uzaklık — cephenin o noktadaki taşması */
  growthKm: number;
  /** o yakın pikselden bu piksele yön (0=K) */
  bearingDeg: number;
}

export interface Progression {
  /** önceki ayak izinin dışında kalan piksel sayısı */
  newPixels: number;
  newPts: NewPixel[];
  /** en uzağa taşan yeni piksel — yangının başı */
  head: NewPixel | null;
  headBearingDeg: number | null;
  headGrowthKm: number | null;
  /** yeni piksellerin dairesel ortalama yönü — tek piksel gürültüsüne dayanıklı */
  frontBearingDeg: number | null;
  /** geçiş centroid'inin kaydığı yön (uygulamanın "sürüklenme" rozeti) */
  centroidBearingDeg: number | null;
  centroidKm: number;
}

/**
 * "Yeni" sayılma eşiği, km. VIIRS pikseli 375 m; dört piksel ötesi artık
 * ölçüm gürültüsü değil, gerçek cephe. Daha küçük eşik aynı pikselin
 * geçişler arası konum oynamasını "ilerleme" diye sayar.
 */
export const NEW_KM = 1.5;

/** İki geçiş arasındaki ilerleme. `prev` boşsa ilerleme tanımsızdır. */
export function progression(prev: Pt[], next: Pt[], newKm = NEW_KM): Progression {
  const bos: Progression = {
    newPixels: 0,
    newPts: [],
    head: null,
    headBearingDeg: null,
    headGrowthKm: null,
    frontBearingDeg: null,
    centroidBearingDeg: null,
    centroidKm: 0,
  };
  if (!prev.length || !next.length) return bos;

  const newPts: NewPixel[] = [];
  for (const q of next) {
    let yakinKm = Infinity;
    let yakin: Pt | null = null;
    for (const r of prev) {
      const d = havKm(q.lon, q.lat, r.lon, r.lat);
      if (d < yakinKm) {
        yakinKm = d;
        yakin = r;
      }
    }
    if (!yakin || yakinKm < newKm) continue;
    newPts.push({
      lon: q.lon,
      lat: q.lat,
      growthKm: yakinKm,
      bearingDeg: bearingDeg(yakin.lon, yakin.lat, q.lon, q.lat),
    });
  }

  let head: NewPixel | null = null;
  for (const q of newPts) if (!head || q.growthKm > head.growthKm) head = q;

  // Dairesel ortalama: yönler 359° ve 1° komşudur, aritmetik ortalama
  // ikisini 180°'ye koyup tam ters yönü söyler.
  let x = 0;
  let y = 0;
  for (const q of newPts) {
    x += Math.sin(toRad(q.bearingDeg));
    y += Math.cos(toRad(q.bearingDeg));
  }
  const frontBearingDeg = newPts.length
    ? ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360
    : null;

  const c0 = centroid(prev);
  const c1 = centroid(next);
  const centroidKm = havKm(c0.lon, c0.lat, c1.lon, c1.lat);

  return {
    newPixels: newPts.length,
    newPts,
    head,
    headBearingDeg: head?.bearingDeg ?? null,
    headGrowthKm: head?.growthKm ?? null,
    frontBearingDeg,
    // Centroid gürültüsü VIIRS piksel ölçeğinin altında kalırsa yön iddiası
    // uydurmadır (cluster.ts MIN_DRIFT_KM ile aynı eşik).
    centroidBearingDeg:
      centroidKm >= 1.2 ? bearingDeg(c0.lon, c0.lat, c1.lon, c1.lat) : null,
    centroidKm,
  };
}

function centroid(pts: Pt[]): Pt {
  let lon = 0;
  let lat = 0;
  for (const p of pts) {
    lon += p.lon;
    lat += p.lat;
  }
  return { lon: lon / pts.length, lat: lat / pts.length };
}

/** İki yön arasındaki en kısa açı farkı (0–180) */
export function angleGap(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Nokta poligonun içinde mi (ışın atma).
 *
 * Düzlem yaklaşımı: koni şekli en fazla birkaç on km, o ölçekte enlem-boylam
 * düzlemi ile küre arasındaki fark kenar testini değiştirmiyor.
 */
export function pointInRing(pt: Pt, ring: [number, number][]): boolean {
  let ic = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    // Kesişim sayılır, TERSLENİR. `ic = true` yazmak (ilk hâli) dışbükey
    // şeklin solundaki noktayı "içeride" sayıyordu: iki kesişim de doğruyu
    // set ediyor, çift sayı bir daha kapatmıyordu. Kapsama ölçümünü
    // olduğundan iyi gösteriyordu.
    if (
      yi > pt.lat !== yj > pt.lat &&
      pt.lon < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi
    )
      ic = !ic;
  }
  return ic;
}
