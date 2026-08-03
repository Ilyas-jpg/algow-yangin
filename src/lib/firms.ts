import type { FirePoint } from "./types";
import { REGION_BBOX } from "./bbox";

/** TR + Kıbrıs + Yunanistan + sınır bölgeleri — kutu `lib/bbox.ts`'te tanımlı */
export const TR_BBOX = REGION_BBOX;

export const FIRMS_SOURCES = [
  "VIIRS_SNPP_NRT",
  "VIIRS_NOAA20_NRT",
  "VIIRS_NOAA21_NRT",
  "MODIS_NRT",
] as const;

/**
 * @param date  YYYY-MM-DD — verilirse pencere O GÜNDEN başlar; verilmezse
 *              bugünden geriye. Geriye doldurulmuş arşiv sinyallerini
 *              etiketlemek için şart: canlı besleme yalnız son 5 günü
 *              veriyor, elimizdeki veri ise haftalarca geriye gidiyor.
 *              ⚠️ FIRMS NRT arşivi 1 Mayıs 2026'ya kadar geriye açık;
 *              öncesi için SP (standart işleme) ürünü gerekir.
 */
export function firmsAreaUrl(
  mapKey: string,
  source: string,
  dayRange: number,
  date?: string
): string {
  const base = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/${TR_BBOX}/${dayRange}`;
  return date ? `${base}/${date}` : base;
}

/**
 * FIRMS area CSV → FirePoint[].
 * VIIRS confidence: l/n/h; MODIS: 0-100 → l(<30)/n(<80)/h.
 * acq_time "HHMM" (başta sıfırlar düşmüş olabilir), acq_date UTC.
 */
export function parseFirmsCsv(csv: string): FirePoint[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);

  const iLat = idx("latitude");
  const iLon = idx("longitude");
  const iDate = idx("acq_date");
  const iTime = idx("acq_time");
  const iSat = idx("satellite");
  const iConf = idx("confidence");
  const iFrp = idx("frp");
  const iDn = idx("daynight");
  if (iLat < 0 || iLon < 0 || iDate < 0 || iTime < 0) return [];

  const out: FirePoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    if (c.length < header.length) continue;
    const lat = parseFloat(c[iLat]);
    const lon = parseFloat(c[iLon]);
    if (!isFinite(lat) || !isFinite(lon)) continue;

    const t = parseInt(c[iTime], 10);
    const hh = Math.floor(t / 100);
    const mm = t % 100;
    const dt = Date.parse(
      `${c[iDate]}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`
    );
    if (!isFinite(dt)) continue;

    const rawConf = (c[iConf] ?? "n").trim().toLowerCase();
    let conf: FirePoint["conf"];
    if (rawConf === "l" || rawConf === "n" || rawConf === "h") {
      conf = rawConf;
    } else {
      const n = parseInt(rawConf, 10);
      conf = !isFinite(n) ? "n" : n < 30 ? "l" : n < 80 ? "n" : "h";
    }

    const frp = parseFloat(c[iFrp]);
    const sat = (c[iSat] ?? "?").trim();
    const dnRaw = (c[iDn] ?? "D").trim().toUpperCase();

    out.push({
      id: `${sat}:${lat.toFixed(4)}:${lon.toFixed(4)}:${dt}`,
      lon,
      lat,
      frp: isFinite(frp) ? Math.max(0, frp) : 0,
      conf,
      sat,
      dt,
      dn: dnRaw === "N" ? "N" : "D",
    });
  }
  return out;
}
