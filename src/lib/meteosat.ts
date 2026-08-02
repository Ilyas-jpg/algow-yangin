import * as hdf5 from "jsfive";
import { gunzipSync } from "node:zlib";

/**
 * EUMETSAT LSA SAF — Meteosat (MSG/SEVIRI) FRP-PIXEL ürünü.
 *
 * Neden var: kutup yörüngeli uydular (VIIRS/MODIS) Türkiye'yi günde birkaç
 * kez görüyor ve aralarda 5 saate varan kör pencereler kalıyor. Meteosat
 * sabit durduğu için **15 dakikada bir** tarıyor ve ürün ~17 dakika sonra
 * yayınlanıyor.
 *
 * Bedeli çözünürlük: Türkiye enleminde piksel 15-25 km²'ye kadar çıkıyor
 * (VIIRS 0,14 km²). Yani bu veri VIIRS'in yerini almaz — küçük yangınları
 * kaçırır — ama kör aralıkta "orada bir şey var" demeyi sağlar.
 */

export interface MsgFire {
  lon: number;
  lat: number;
  frp: number;
  /** güven yüzdesi */
  conf: number;
  /** pikselin yer üzerindeki alanı, km² — belirsizliğin ölçüsü */
  pixelKm2: number;
  dt: number;
}

/** Hangi uydu kuşağından geldi — arayüzde ayrı etiketleniyor */
export type MeteosatKaynak = "MTG" | "MSG";

const BASE = "https://datalsasaf.lsasvcs.ipma.pt/PRODUCTS/MSG/FRP-PIXEL/HDF5";
const MTG_BASE =
  "https://datalsasaf.lsasvcs.ipma.pt/PRODUCTS/MTG/MTFRPPixel/NATIVE";

/** Türkiye ve yakın çevresi (FIRMS ile aynı kutu) */
const TR = { west: 25.0, south: 34.8, east: 45.5, north: 42.6 };

function authHeader(): string | null {
  const u = process.env.LSASAF_USER;
  const p = process.env.LSASAF_PASS;
  if (!u || !p) return null;
  return "Basic " + Buffer.from(`${u}:${p}`).toString("base64");
}

/** Verilen zaman dilimi için dosya adı (dilimler 15 dakikada bir) */
export function slotUrl(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(Math.floor(d.getUTCMinutes() / 15) * 15).padStart(2, "0");
  return `${BASE}/${y}/${mo}/${da}/HDF5_LSASAF_MSG_FRP-PIXEL-ListProduct_MSG-Disk_${y}${mo}${da}${hh}${mi}`;
}

interface Ds {
  value: ArrayLike<number>;
}

function readScaled(f: { get: (k: string) => Ds | null }, name: string, scale: number): number[] {
  const d = f.get(name);
  if (!d) return [];
  const v = d.value;
  const out = new Array<number>(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / scale;
  return out;
}

/**
 * Tek zaman dilimini indirip Türkiye kutusundaki yangınları döndürür.
 * Dosya bulunamazsa (henüz yayınlanmadıysa) null döner — çağıran bir
 * önceki dilimi denemeli.
 */
export async function fetchSlot(d: Date): Promise<MsgFire[] | null> {
  const auth = authHeader();
  if (!auth) return null;

  const res = await fetch(slotUrl(d), {
    headers: { Authorization: auth },
    next: { revalidate: 600 },
  });
  if (!res.ok) return null;

  const ab = await res.arrayBuffer();
  let file: { get: (k: string) => Ds | null; attrs?: Record<string, unknown> };
  try {
    file = new hdf5.File(ab, "frp.h5") as unknown as typeof file;
  } catch {
    return null;
  }

  // Ölçek katsayıları dosyanın kendi özniteliklerinden doğrulandı:
  // LAT/LON 100, FRP 10, CONFIDENCE 100, PIXEL_SIZE 100
  const lats = readScaled(file, "LATITUDE", 100);
  const lons = readScaled(file, "LONGITUDE", 100);
  const frps = readScaled(file, "FRP", 10);
  const confs = readScaled(file, "FIRE_CONFIDENCE", 100);
  const sizes = readScaled(file, "PIXEL_SIZE", 100);
  if (!lats.length || lats.length !== lons.length) return null;

  // Görüntü alım zamanı dosya özniteliğinde: YYYYMMDDhhmmss
  let dt = d.getTime();
  const acq = file.attrs?.IMAGE_ACQUISITION_TIME;
  if (typeof acq === "string" && acq.length >= 12) {
    const iso =
      `${acq.slice(0, 4)}-${acq.slice(4, 6)}-${acq.slice(6, 8)}` +
      `T${acq.slice(8, 10)}:${acq.slice(10, 12)}:00Z`;
    const parsed = Date.parse(iso);
    if (Number.isFinite(parsed)) dt = parsed;
  }

  const out: MsgFire[] = [];
  for (let i = 0; i < lats.length; i++) {
    const lat = lats[i];
    const lon = lons[i];
    // MISSING_VALUE 19000 → ölçekli 190; kutu dışını da burada eliyoruz
    if (lat > 100 || lon > 100) continue;
    if (lat < TR.south || lat > TR.north || lon < TR.west || lon > TR.east) continue;
    out.push({
      lon: Math.round(lon * 1e4) / 1e4,
      lat: Math.round(lat * 1e4) / 1e4,
      frp: Math.round((frps[i] ?? 0) * 10) / 10,
      conf: Math.round(confs[i] ?? 0),
      pixelKm2: Math.round((sizes[i] ?? 0) * 10) / 10,
      dt,
    });
  }
  return out;
}

/* ── MTG (Meteosat Üçüncü Nesil) ─────────────────────────────────────────
 *
 * ÖLÇÜLDÜ (2026-08-02, tek dilim, canlı veri):
 *   Türkiye kutusunda piksel alanı → ortanca 2,05 km² (1,89–2,13)
 *   MSG'nin aynı bölgedeki pikseli  → 14–25 km²
 * Yani konum belirsizliği yaklaşık 8-10 kat küçülüyor. Üstelik dilim 10
 * dakikada bir (MSG 15) ve ürün düz CSV.gz — MSG'nin HDF5'i için jsfive'a
 * muhtaçtık, burada gerek yok.
 *
 * "NATIVE" klasör adı yanıltıcı: içerik EUMETSAT ikili formatı değil,
 * gzip'li CSV.
 */

/** MTG dilimleri 10 dakikada bir */
export function mtgSlotUrl(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(Math.floor(d.getUTCMinutes() / 10) * 10).padStart(2, "0");
  return `${MTG_BASE}/${y}/${mo}/${da}/LSA-509_MTG_MTFRPPIXEL-ListProduct_MTG-FD_${y}${mo}${da}${hh}${mi}.csv.gz`;
}

export async function fetchMtgSlot(d: Date): Promise<MsgFire[] | null> {
  const auth = authHeader();
  if (!auth) return null;

  let csv: string;
  try {
    const res = await fetch(mtgSlotUrl(d), {
      headers: { Authorization: auth },
      next: { revalidate: 420 },
    });
    if (!res.ok) return null;
    csv = gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
  } catch {
    return null;
  }

  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const h = lines[0].split(",");
  const iLon = h.indexOf("LONGITUDE");
  const iLat = h.indexOf("LATITUDE");
  const iFrp = h.indexOf("FRP");
  const iConf = h.indexOf("FIRE_CONFIDENCE");
  const iPx = h.indexOf("PIXEL_SIZE");
  const iAcq = h.indexOf("ACQTIME");
  if (iLon < 0 || iLat < 0) return null;

  const out: MsgFire[] = [];
  let dt = d.getTime();
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    const lon = +c[iLon];
    const lat = +c[iLat];
    if (!isFinite(lon) || !isFinite(lat)) continue;
    if (lat < TR.south || lat > TR.north || lon < TR.west || lon > TR.east) continue;

    // ACQTIME: YYYYMMDDhhmmss
    const a = c[iAcq];
    if (a && a.length >= 12) {
      const p = Date.parse(
        `${a.slice(0, 4)}-${a.slice(4, 6)}-${a.slice(6, 8)}T${a.slice(8, 10)}:${a.slice(10, 12)}:00Z`
      );
      if (Number.isFinite(p)) dt = p;
    }
    out.push({
      lon: Math.round(lon * 1e4) / 1e4,
      lat: Math.round(lat * 1e4) / 1e4,
      frp: Math.round((+c[iFrp] || 0) * 10) / 10,
      // MTG güveni 0-1 aralığında; MSG yüzde veriyor, arayüz için eşitliyoruz
      conf: Math.round((+c[iConf] || 0) * 100),
      pixelKm2: Math.round((+c[iPx] || 0) * 10) / 10,
      dt,
    });
  }
  return out;
}

/**
 * Son yayınlanmış dilimi bulur.
 *
 * Önce MTG denenir (piksel ~2 km², 10 dk), bulunamazsa MSG'ye düşülür
 * (~20 km², 15 dk). MTG demonstration ürünü olduğu için yedek şart.
 */
export async function fetchLatest(maxBack = 6): Promise<{
  fires: MsgFire[];
  slot: number;
  kaynak: MeteosatKaynak;
} | null> {
  const now = Date.now();
  for (let i = 1; i <= maxBack; i++) {
    const d = new Date(now - i * 10 * 60_000);
    const fires = await fetchMtgSlot(d);
    if (fires) return { fires, slot: fires[0]?.dt ?? d.getTime(), kaynak: "MTG" };
  }
  for (let i = 1; i <= maxBack; i++) {
    const d = new Date(now - i * 15 * 60_000);
    const fires = await fetchSlot(d);
    if (fires) return { fires, slot: fires[0]?.dt ?? d.getTime(), kaynak: "MSG" };
  }
  return null;
}
