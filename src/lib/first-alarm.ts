/**
 * İlk alarm — jeostasyoner tespitin kutupsal doğrulaması gelmeden önce.
 *
 * NEDEN VAR (ölçüldü, 2 Ağustos 2026 Bayramiç/Çanakkale):
 *
 *   15:50 TR  MTG temiz
 *   16:00 TR  MTG ilk tespit — 2 piksel, 40 MW
 *   16:30 TR  MTG tepe — 8 piksel, 302 MW
 *   17:39 TR  İLK HABER
 *   18:50 TR  MTG son tespit
 *   —         VIIRS/MODIS: hiçbir zaman görmedi
 *
 * Yani platform bu yangını **haberden 99 dakika önce** görmüştü ve
 * kullanıcıya söylemedi. Sebep: Meteosat tespitleri yalnız harita üstünde
 * geçici turuncu halka olarak çiziliyordu — olay listesine girmiyor,
 * sayaca katılmıyor, uyarı üretmiyordu. Üstelik `/api/meteosat` yalnız EN
 * SON dilimi döndürdüğü için, yangın söndükten sonraki dilimde halkalar da
 * silindi; geriye hiçbir iz kalmadı.
 *
 * Bu modül o tespiti bir alarma çeviriyor: MTG'nin gördüğü ama FIRMS'in
 * (henüz) doğrulamadığı ısı kaynakları.
 *
 * ⚠️ Sınırlar — bu bir yangın İDDİASI değil, "burada ısı var" ölçümüdür:
 * - MTG pikseli Türkiye'de ~1,7-2 km²; konum kabadır,
 * - doğrulanmamıştır, aktif yangın sayacına katılmaz,
 * - koni çizilmez (tek dilimden yön çıkarılamaz),
 * - sanayi bacaları ve anız da ısı verir; sabit kaynak eşleştirmesi
 *   çağıranın sorumluluğunda.
 */
import { havKm } from "./geo";
import { nearestPlace } from "./places";
import { fixedSourceAt } from "./fixed-sources";

export interface HeatPixel {
  lon: number;
  lat: number;
  frp: number;
  dt: number;
}

export interface FirstAlarm {
  id: string;
  lon: number;
  lat: number;
  /** kümedeki en yüksek piksel FRP'si (toplam değil — piksel örtüşmesi şişirir) */
  frp: number;
  /** kaç jeostasyoner piksel */
  pixels: number;
  /** en yeni piksel zamanı */
  dt: number;
  label: string;
  abroad: boolean;
}

/**
 * Kutupsal tespitin "aynı yangın" sayılacağı yarıçap.
 *
 * MTG pikseli ~1,4 km eninde ve geolokasyonu kaba; VIIRS 375 m. 5 km,
 * "aynı yangını iki kaynak da görüyor" demek için makul bir pay — daha dar
 * tutmak doğrulanmış yangınları sahte alarm diye göstermeye başlıyor.
 */
const DOGRULAMA_KM = 5;

/** Bitişik MTG piksellerini tek olaya bağlayan mesafe. */
const KUME_KM = 4;

export function firstAlarms(
  heat: HeatPixel[],
  firms: { lon: number; lat: number }[],
  opts?: { dogrulamaKm?: number; kumeKm?: number }
): FirstAlarm[] {
  const dKm = opts?.dogrulamaKm ?? DOGRULAMA_KM;
  const kKm = opts?.kumeKm ?? KUME_KM;

  // ① FIRMS'in doğruladıklarını düş — onlar zaten olay listesinde.
  // ② Sabit sanayi kaynaklarını düş. Bunlar HER dilimde sıcak; elenmezse
  //    alarm kalıcı olarak yanar ve kullanıcı ilk günden sonra bakmayı
  //    bırakır — aktif yangın sayacını %40 şişiren hatanın alarm hâli.
  const yeni = heat.filter(
    (h) =>
      !firms.some((f) => havKm(h.lon, h.lat, f.lon, f.lat) <= dKm) &&
      fixedSourceAt(h.lon, h.lat) === null
  );
  if (!yeni.length) return [];

  // ② Bitişik pikselleri birleştir. Bayramiç'te tek yangın 8 piksel
  //    üretmişti; sekiz ayrı alarm vermek gürültü olurdu.
  const kalan = [...yeni];
  const kumeler: HeatPixel[][] = [];
  while (kalan.length) {
    const kume = [kalan.pop()!];
    for (let i = 0; i < kume.length; i++) {
      for (let j = kalan.length - 1; j >= 0; j--) {
        if (havKm(kume[i].lon, kume[i].lat, kalan[j].lon, kalan[j].lat) <= kKm) {
          kume.push(kalan[j]);
          kalan.splice(j, 1);
        }
      }
    }
    kumeler.push(kume);
  }

  return kumeler
    .map((k) => {
      const lon = k.reduce((s, p) => s + p.lon, 0) / k.length;
      const lat = k.reduce((s, p) => s + p.lat, 0) / k.length;
      const yer = nearestPlace(lon, lat);
      return {
        // Konum tabanlı kimlik: dilim değişince alarm elden kaymasın.
        id: `fa:${lon.toFixed(2)}:${lat.toFixed(2)}`,
        lon,
        lat,
        frp: Math.max(...k.map((p) => p.frp)),
        pixels: k.length,
        dt: Math.max(...k.map((p) => p.dt)),
        label: yer.label,
        abroad: yer.abroad,
      };
    })
    .sort((a, b) => Number(a.abroad) - Number(b.abroad) || b.frp - a.frp);
}
