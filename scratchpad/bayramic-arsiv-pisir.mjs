/**
 * Bayramiç 2026 arşiv kaydını MTG'den pişirir.
 *
 * Neden ayrı betik: normal `arsiv-pisir.mjs` FIRMS'ten okur, ama bu yangını
 * FIRMS HİÇ GÖRMEDİ (4 kaynak × sıkı kutu × 1-3 gün → 0 tespit). Kayıt
 * tamamen jeostasyoner MTG tespitlerinden kuruluyor — arşivdeki tek
 * "kutupsal uydunun kaçırdığı" yangın.
 */
import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

const PROJE = "C:/Users/milya/Desktop/00-Projeler/algow-yangin";
const env = readFileSync(`${PROJE}/.env.local`, "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "").trim();
const auth =
  "Basic " + Buffer.from(`${get("LSASAF_USER")}:${get("LSASAF_PASS")}`).toString("base64");

const BASE = "https://datalsasaf.lsasvcs.ipma.pt/PRODUCTS/MTG/MTFRPPixel/NATIVE";
const p2 = (n) => String(n).padStart(2, "0");
const KUTU = { w: 26.30, e: 27.00, s: 39.55, n: 40.00 };

function url(d) {
  const y = d.getUTCFullYear(), mo = p2(d.getUTCMonth() + 1), da = p2(d.getUTCDate());
  const hh = p2(d.getUTCHours()), mi = p2(Math.floor(d.getUTCMinutes() / 10) * 10);
  return `${BASE}/${y}/${mo}/${da}/LSA-509_MTG_MTFRPPIXEL-ListProduct_MTG-FD_${y}${mo}${da}${hh}${mi}.csv.gz`;
}

/** ACQTIME: YYYYMMDDhhmmss (UTC) */
function acq(s) {
  const m = String(s).trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

const pts = [];
let dilim = 0, hata = 0;

for (let t = Date.UTC(2026, 7, 2, 12, 0); t <= Date.UTC(2026, 7, 2, 17, 0); t += 600_000) {
  const d = new Date(t);
  let res;
  try { res = await fetch(url(d), { headers: { Authorization: auth } }); }
  catch { hata++; continue; }
  if (!res.ok) { hata++; continue; }
  dilim++;
  const txt = gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
  const satir = txt.split("\n").filter((s) => s.trim());
  const bas = satir[0].split(/[;,]/).map((s) => s.trim().toUpperCase());
  const iLon = bas.indexOf("LONGITUDE"), iLat = bas.indexOf("LATITUDE");
  const iFrp = bas.indexOf("FRP"), iAcq = bas.indexOf("ACQTIME");
  for (const s of satir.slice(1)) {
    const c = s.split(/[;,]/);
    const lon = +c[iLon], lat = +c[iLat], frp = +c[iFrp];
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (lon < KUTU.w || lon > KUTU.e || lat < KUTU.s || lat > KUTU.n) continue;
    const dt = (iAcq >= 0 ? acq(c[iAcq]) : null) ?? t;
    // [lon, lat, frp, dt, satIdx, gece] — hepsi MTG (0), hepsi gündüz (0)
    pts.push([+lon.toFixed(4), +lat.toFixed(4), +frp.toFixed(1), dt, 0, 0]);
  }
}

pts.sort((a, b) => a[3] - b[3]);
const ilk = pts[0][3], son = pts[pts.length - 1][3];
const maxFrp = Math.max(...pts.map((p) => p[2]));
const center = [
  +(pts.reduce((s, p) => s + p[0], 0) / pts.length).toFixed(4),
  +(pts.reduce((s, p) => s + p[1], 0) / pts.length).toFixed(4),
];

const ozet =
  "2 Ağustos 2026'da Bayramiç'te çıkan yangını kutup yörüngeli uydular (VIIRS/MODIS) hiç görmedi — yangın onların geçişleri arasında doğdu ve aynı aralıkta söndürüldü. Jeostasyoner Meteosat (MTG) ise saat 16:08'de, ilk haber bültenlerinden 91 dakika önce gördü. Arşivdeki bu tek kayıt tümüyle MTG tespitlerinden kuruldu.";
const ozetEn =
  "The fire that broke out at Bayramiç on 2 August 2026 was never seen by the polar-orbiting satellites (VIIRS/MODIS): it started and was contained between their passes. The geostationary Meteosat (MTG) saw it at 16:08 local time, 91 minutes before the first news report. This is the only archive record built entirely from MTG detections.";

const kayit = {
  slug: "bayramic-2026",
  ad: "Bayramiç yangını",
  il: "Çanakkale",
  ozet,
  center,
  ilk,
  son,
  sats: ["MTG"],
  pts,
};
writeFileSync(`${PROJE}/public/arsiv/bayramic-2026.json`, JSON.stringify(kayit));

const idxYol = `${PROJE}/public/arsiv/index.json`;
const idx = JSON.parse(readFileSync(idxYol, "utf8")).filter((k) => k.slug !== "bayramic-2026");
idx.push({
  slug: "bayramic-2026",
  ad: "Bayramiç yangını",
  adEn: "Bayramiç fire",
  il: "Çanakkale",
  ozet,
  ozetEn,
  ilk,
  son,
  tespit: pts.length,
  maxFrp: Math.round(maxFrp),
});
idx.sort((a, b) => b.ilk - a.ilk);
writeFileSync(idxYol, JSON.stringify(idx, null, 1));

const tr = (ms) => new Date(ms + 3 * 3600_000).toISOString().slice(11, 16);
console.log(`dilim ${dilim} okundu (${hata} hata)`);
console.log(`tespit ${pts.length} · ilk ${tr(ilk)} TR · son ${tr(son)} TR · max FRP ${Math.round(maxFrp)} MW`);
console.log(`merkez ${center}`);
console.log(`indeks ${idx.length} kayıt`);
