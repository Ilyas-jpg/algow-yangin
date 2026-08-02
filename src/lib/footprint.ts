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
 * Yetkili kaynak EFFIS'in Sentinel-2 tabanlı yanan alan perimetreleridir;
 * ancak EFFIS poligonları ancak belli bir büyüklüğün üstünde ve gecikmeli
 * üretiliyor (2026-08-02'de Türkiye için sorgulandığında boş döndü), o yüzden
 * kullanıcıya en azından ölçebildiğimiz büyüklüğü adını doğru koyarak veriyoruz.
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
