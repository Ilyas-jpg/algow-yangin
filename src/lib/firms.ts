import type { FirePoint } from "./types";
import { REGION_BBOX } from "./bbox";

/** TR + Kıbrıs + Yunanistan + sınır bölgeleri — kutu `lib/bbox.ts`'te tanımlı */
export const TR_BBOX = REGION_BBOX;

/**
 * VIIRS I-4 kanalının doyma sıcaklığı (K).
 *
 * Bu eşiğin üstünde sensör "daha sıcağını ayırt edemiyorum" diyor; ölçülen FRP
 * gerçeğin ALT sınırı oluyor. Yani doyma, yangının küçüklüğünü değil
 * büyüklüğünü gösteren bir işaret.
 */
export const VIIRS_TI4_DOYMA = 367;

/**
 * MODIS `type` alanı — kendi sınıflandırması.
 * Sabit-kaynak listemize (elle pişirilmiş 50 tesis) bedava çapraz doğrulama.
 */
export const MODIS_TYPE = {
  BITKI: 0,
  VOLKAN: 1,
  STATIK_KARA: 2,
  DENIZ: 3,
} as const;

/**
 * Zayıf tespit: haritada soluk çizilir, aktif sayacından düşülür.
 *
 * 🌙 GECE İSTİSNASI — kural bilerek `dn === "D"` şartlı. VIIRS'te gündüz
 * yanlış pozitiflerin başlıca sebebi güneş yansımasıdır (sera örtüsü, metal
 * çatı, su yüzeyi, açık kum); gece o mekanizma yok, `l` tespiti bile gerçek
 * bir ısıya işaret ediyor. Geceyi de düşürmek büyüyen bir yangını tam da
 * kimsenin bakmadığı saatte gizlemek olurdu.
 */
export const dusukGuven = (p: { conf: string; dn: string }): boolean =>
  p.conf === "l" && p.dn === "D";

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
  // Piksel ayak izi: VIIRS nadirde 375 m ama tarama kenarında ~800 m'ye
  // büyüyor. Noktayı sabit boyda çizmek "konum sapması normaldir" cümlesini
  // görselleştirmemek demek.
  const iScan = idx("scan");
  const iTrack = idx("track");
  // Sensör doyması: VIIRS I-4 kanalı ≈367 K'de doyuyor. Doyduysa ölçülen FRP
  // gerçeğin ALT sınırı — "çok şiddetli" demenin veriye dayalı yolu.
  // Bilerek YALNIZ VIIRS: MODIS'in karşılığı `brightness` (T21) ve ~500 K'de
  // doyuyor; ikisini aynı eşikle karıştırmak MODIS'i sürekli doymuş gösterirdi.
  const iTi4 = idx("bright_ti4");
  // ⚠️ ÖLÇÜLDÜ (2026-08-04): `type` sütunu **NRT ürününde YOK**. Dört kaynağın
  // da canlı başlığı çekildi; MODIS_NRT şöyle geliyor:
  //   latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,
  //   instrument,confidence,version,bright_t31,frp,daynight
  // Alan yalnız standart/arşiv (SP) ürününde var. Parse burada duruyor çünkü
  // arşiv pişiricisi de aynı fonksiyonu çağırıyor — ama CANLI haritada sabit
  // kaynak çapraz doğrulaması bu alandan kurulamaz.
  const iType = idx("type");
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

    const sayi = (i: number): number | undefined => {
      if (i < 0) return undefined;
      const v = parseFloat(c[i]);
      return isFinite(v) ? v : undefined;
    };

    const ti4 = sayi(iTi4);
    const tip = iType < 0 ? undefined : parseInt(c[iType], 10);

    out.push({
      id: `${sat}:${lat.toFixed(4)}:${lon.toFixed(4)}:${dt}`,
      lon,
      lat,
      frp: isFinite(frp) ? Math.max(0, frp) : 0,
      conf,
      sat,
      dt,
      dn: dnRaw === "N" ? "N" : "D",
      scan: sayi(iScan),
      track: sayi(iTrack),
      saturated: ti4 !== undefined && ti4 >= VIIRS_TI4_DOYMA,
      type: Number.isFinite(tip) ? tip : undefined,
    });
  }
  return out;
}
