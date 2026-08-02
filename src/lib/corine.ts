export type FuelClass =
  | "ORMAN"
  | "MAKI"
  | "OT"
  | "TARIM"
  | "YAPI"
  | "CIPLAK"
  | "SU";

/** CORINE CLC kodu → yakıt sınıfı */
export function fuelOf(code: number | null): FuelClass | null {
  if (code === null) return null;
  if ((code >= 311 && code <= 313) || code === 324) return "ORMAN";
  if (code === 322 || code === 323) return "MAKI";
  if (code === 321 || code === 231 || code === 333) return "OT";
  if (code >= 211 && code <= 244) return "TARIM";
  if (code >= 400) return "SU";
  if (code >= 331 && code <= 335) return "CIPLAK";
  if (code < 200) return "YAPI";
  return null;
}

/**
 * CORINE 2018 (EEA WMS, anahtarsız) tek piksel sorgusu.
 * Yakıt statiktir → upstream 30 gün cache'lenir; kota etkisi yok denecek kadar az.
 *
 * ⚠️ CORINE Türkiye'de ~41,4°D doğusunu kapsamıyor; orada null döner ve
 * arayüz "bilinmiyor" demek zorunda (uydurma sınıf üretmiyoruz).
 */
export async function corineAt(
  lon: number,
  lat: number
): Promise<FuelClass | null> {
  const d = 0.002;
  const url =
    "https://image.discomap.eea.europa.eu/arcgis/services/Corine/CLC2018_WM/MapServer/WMSServer" +
    "?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=12&QUERY_LAYERS=12" +
    `&STYLES=&SRS=EPSG:4326&BBOX=${lon - d},${lat - d},${lon + d},${lat + d}` +
    "&WIDTH=3&HEIGHT=3&X=1&Y=1&INFO_FORMAT=text/plain&FEATURE_COUNT=1";
  try {
    const res = await fetch(url, {
      next: { revalidate: 2592000 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const txt = await res.text();
    const m = [...txt.matchAll(/(\d{3})\s*;?\s*$/gm)];
    return m.length ? fuelOf(+m[m.length - 1][1]) : null;
  } catch {
    // Yakıt opsiyoneldir: düşerse arazi yine dönsün.
    return null;
  }
}
