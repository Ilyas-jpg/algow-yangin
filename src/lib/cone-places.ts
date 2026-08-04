import { PLACES_TR } from "@/data/places-tr";
import { bearingDeg, havKm } from "./geo";
import { angDiff } from "./format";
import type { ConeGeom } from "./wind";

/**
 * Yangının YÖNELDİĞİ yerleşim.
 *
 * Soru şu: "bu yangın bana doğru mu geliyor?" Koni haritada zaten çiziliyor
 * ama haritaya bakmayan biri için soyut kalıyor; yer adı onu okunur kılıyor.
 *
 * ⚠️ **İlk tasarım ölçümle çürütüldü (2026-08-04):** "koninin İÇİNE düşen
 * yerleşimler" diye yazmıştım. Canlıda ölçünce koninin en geniş halkası
 * **0,9 km** çıktı — ilçe merkezleri onlarca km arayla olduğu için hiçbiri
 * asla içine düşmüyordu, özellik pratikte hiç çalışmayacaktı. Doğru ölçüt
 * içerik değil **yön**: koni nereyi işaret ediyor ve orası kaç km ötede.
 *
 * ⚠️ **DİL: durum farkındalığı, tahliye DEĞİL.** "Yangın oraya ulaşacak"
 * demiyoruz; "şu an yöneldiği yön orası" diyoruz. Çağıran taraf bu ayrımı
 * korumak zorunda.
 *
 * ⚠️ Liste ilçe düzeyinde (`places-tr`); köy ve mahalleler yok.
 */

/** Yönün "oraya doğru" sayılması için eksene azami sapma. */
const AZAMI_SAPMA = 45;

/**
 * Mesafe tavanı, yangının KENDİ hızına bağlı.
 *
 * ⚠️ Sabit 60 km denenmişti ve canlıda saçmaladı: koninin 6 saatlik en geniş
 * halkası 0,9 km iken panel "Bu yönde: Erbil ~57 km" yazdı. Çekince metni
 * güçlü olsa bile, günlerce sürecek bir mesafeyi "bu yönde" diye yazmak
 * iddiayı şişiriyor. Tavan artık dış halkanın **2 katı** — dış halka 6 saatlik
 * %90 erişim olduğuna göre kabaca yarım gün. Durgun rüzgârda koni küçük →
 * iddia da küçük kalıyor. Taban 10 km: minik konide bile bir şey söylenebilsin.
 */
const HALKA_KATI = 2;
const TABAN_KM = 10;

/** Koninin dış halkasının tepe noktasına en uzak mesafesi (km). */
function disHalkaKm(cone: ConeGeom, aLon: number, aLat: number): number {
  const dis = cone.rings[cone.rings.length - 1]?.ring;
  if (!dis?.length) {
    // Halka yoksa hızdan tahmin: 6 saatlik yol.
    return Math.max(1, cone.windKmh * 6);
  }
  let en = 0;
  for (const [lon, lat] of dis) {
    const k = havKm(aLon, aLat, lon, lat);
    if (k > en) en = k;
  }
  return en;
}

export interface ConeTarget {
  name: string;
  il: string;
  /** koninin tepesinden uzaklık, km */
  km: number;
  /** koni ekseniyle arasındaki açı farkı (derece) */
  offDeg: number;
}

/**
 * Koninin ekseni doğrultusunda kalan en yakın yerleşimler.
 * Boş dizi = o yönde kayıtlı bir merkez yok (kimse yok demek DEĞİL).
 */
export function targetsInDirection(cone: ConeGeom, limit = 2): ConeTarget[] {
  const [aLon, aLat] = cone.apex;

  // Yön bilgisi yoksa (disk) yönelim iddiası da olamaz.
  if (cone.isDisc) return [];

  // Koninin kendi yarım açısı dar olabilir; okunur bir yönelim için
  // en az AZAMI_SAPMA kadar açılıyoruz ama daha genişse onu kullanıyoruz.
  const sapmaEsigi = Math.max(AZAMI_SAPMA, cone.halfAngle);
  const azamiKm = Math.max(TABAN_KM, disHalkaKm(cone, aLon, aLat) * HALKA_KATI);

  const bulunan: ConeTarget[] = [];
  for (const p of PLACES_TR) {
    const lat = p[2] as number;
    const lon = p[3] as number;
    const km = havKm(aLon, aLat, lon, lat);
    if (km > azamiKm || km < 0.5) continue;

    const offDeg = angDiff(bearingDeg(aLon, aLat, lon, lat), cone.spreadDeg);
    if (offDeg > sapmaEsigi) continue;

    bulunan.push({ name: p[0] as string, il: p[1] as string, km, offDeg });
  }

  // En yakın önce; eşitlikte eksene daha yakın olan.
  bulunan.sort((a, b) => a.km - b.km || a.offDeg - b.offDeg);
  return bulunan.slice(0, limit);
}
