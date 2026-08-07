import { toRad } from "./geo";

/** VIIRS piksel kenarı, km (375 m nominal çözünürlük) */
const CELL_KM = 0.375;
/** Bir hücrenin alanı, hektar (0,375² km² = 0,1406 km² = 14,06 ha) */
const CELL_HA = CELL_KM * CELL_KM * 100;

export interface Footprint {
  /** benzersiz VIIRS hücresi sayısı */
  cells: number;
  /** hektar */
  ha: number;
}

/**
 * Uydunun "sıcak gördüğü" alan.
 *
 * ⚠️ Bu RESMÎ YANAN ALAN DEĞİLDİR ve öyle sunulmamalıdır:
 * - Alevi sönüp közlenmeye dönen bölümler ısı imzasını kaybeder → EKSİK ölçer.
 * - Tespit edilen piksel bütünüyle yanmış olmayabilir → FAZLA ölçer.
 * - Bulut altında ya da kanopi altında kalan bölümler hiç görünmez.
 *
 * Yetkili kaynak EFFIS'in yanan alan perimetreleridir ama CANLI PANELİ
 * BESLEYEMEZ — ölçüldü (2026-08-06, WFS `GetFeature`):
 *   · `effis.nrt.ba.poly` (güncel sezon): poligon döndürüyor ama **hiç
 *     öznitelik taşımıyor** — ne alan, ne tarih, ne ülke. "Kaç hektar yandı"
 *     sorusuna cevabı yok. (Eski yorum bunu *"Türkiye için boş dönüyor"* diye
 *     kaydetmişti; boş değil, şeması farklı.)
 *   · `modis.ba.poly.2016…2025`: tam şemalı (`AREA_HA`, `FIREDATE`, `COUNTRY`,
 *     `PROVINCE`) — 2025'te 771 Türkiye kaydı, 230'u ≥30 ha. Ama **geriye
 *     dönük**: `LASTUPDATE` yangından haftalar sonra.
 * Yani EFFIS doğrulama/karne için birebir doğru kaynak, canlı panel için
 * kullanılamaz; kullanıcıya ölçebildiğimizi adını doğru koyarak veriyoruz.
 *
 * MODIS tespitleri bilerek DIŞARIDA: pikseli ~1 km, 375 m ızgarasına
 * yerleştirmek alanı sistematik olarak şişirirdi.
 */
export function heatFootprint(
  points: { lon: number; lat: number; sat: string }[]
): Footprint | null {
  const cells = new Set<string>();
  for (const p of points) {
    // FIRMS uydu alanı: VIIRS "N" (SNPP), "1" (NOAA-20), "2" (NOAA-21);
    // MODIS "Aqua"/"Terra". Yalnız VIIRS sayılır.
    if (p.sat === "Aqua" || p.sat === "Terra") continue;
    const y = Math.floor((p.lat * 111) / CELL_KM);
    const x = Math.floor(
      (p.lon * 111 * Math.cos(toRad(p.lat))) / CELL_KM
    );
    cells.add(`${x}:${y}`);
  }
  if (cells.size === 0) return null;
  return {
    cells: cells.size,
    ha: Math.round(cells.size * CELL_HA),
  };
}
