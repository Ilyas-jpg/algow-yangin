/**
 * 35 — %90 KAPSAMA İDDİASI, SERVİS ETTİĞİMİZ RÜZGÂRLA DA TUTUYOR MU?
 *
 * 29-kapsama-akdeniz.mjs iddiayı 10× veriyle doğruladı — ama ERA5 (25 km)
 * rüzgârıyla. Üretim ICON-EU (~7 km) kullanıyor ve 34-ruzgar-kiyas.mjs iki
 * kaynağın **medyan 17°, %90 dilimde 117°** ayrıştığını ölçtü.
 *
 * Soru: kapsama, kalibre edildiği rüzgârdan BAŞKA bir rüzgârla beslenince
 * ayakta kalıyor mu? Kalmıyorsa yayındaki %90 canlı sistemi tarif etmiyor
 * demektir ve bu, bugün düzelttiğimiz karne hatasından daha önemlidir.
 *
 * Ölçüt 29 ile BİREBİR aynı — yalnız rüzgâr kaynağı değişiyor.
 * Küme: 2024-2025 (geçmiş tahmin arşivinin kapsadığı yıllar).
 *
 * Koşum: node scratchpad/isabet/35-kapsama-icon.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { yakitOf } from "./04b-yakit-kod.mjs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const SAAT = 3600_000;
const ORTADOGU = new Set(["Irak", "Suriye", "İran"]);
const YILLAR = [2024, 2025];

function interp(x, pts) {
  if (x <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}
const ROS = [[4, 0.26], [11, 0.44], [18, 0.47], [26, 0.83], [45, 1.3]];
const K = 1.5;
const SZ = [[0, 1], [30, 0.95], [60, 0.92], [90, 0.88], [120, 0.84], [150, 0.82], [180, 0.8]];
const SG = [[0, 1], [30, 0.94], [60, 0.88], [90, 0.82], [120, 0.24], [150, 0.17], [180, 0.16]];
const reachRatio = (off, kmh) => {
  const a = Math.min(180, Math.abs(off));
  const t = Math.max(0, Math.min(1, (kmh - 8) / 7));
  return interp(a, SZ) + (interp(a, SG) - interp(a, SZ)) * t;
};
const FUEL = { ORMAN: { sigma: 1500, beta: 0.03, waf: 0.15 }, MAKI: { sigma: 1800, beta: 0.012, waf: 0.3 } };
function rothDir(fuel, kmh, deg, slope, up) {
  const { sigma, beta, waf } = FUEL[fuel] ?? FUEL.MAKI;
  const betaOp = 3.348 * sigma ** -0.8189, C = 7.47 * Math.exp(-0.133 * sigma ** 0.55);
  const B = 0.02526 * sigma ** 0.54, E = 0.715 * Math.exp(-3.59e-4 * sigma);
  const pW = C * (Math.max(0, kmh) * 54.6807 * waf) ** B * (beta / betaOp) ** -E;
  const pS = 5.275 * beta ** -0.3 * (slope / 100) ** 2;
  const x = pW * Math.sin(toRad(deg)) + pS * Math.sin(toRad(up));
  const y = pW * Math.cos(toRad(deg)) + pS * Math.cos(toRad(up));
  return Math.hypot(x, y) < 1e-9 ? deg : (toDeg(Math.atan2(x, y)) + 360) % 360;
}

const clc = JSON.parse(readFileSync(here("clc-all.json"), "utf8"));
const era5 = JSON.parse(readFileSync(here("akdeniz-ruzgar.json"), "utf8"));
const icon = JSON.parse(readFileSync(here("ruzgar-icon_eu.json"), "utf8"));
const egimler = JSON.parse(readFileSync(here("akdeniz-egim.json"), "utf8"));
const ckey = (c) => `${(Math.round(c.lat * 100) / 100).toFixed(2)},${(Math.round(c.lon * 100) / 100).toFixed(2)}`;
const wkey = (c) => `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
const ikey = (c) => {
  const r = (v) => (Math.round(v / 0.0625) * 0.0625).toFixed(4);
  return `${r(c.lat)},${r(c.lon)}|${new Date(c.t0).toISOString().slice(0, 10)}`;
};
const gap = (a, b) => { const d = Math.abs(((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; };

const hepsi = [];
for (const f of readdirSync(here(".")).filter((f) => /^vaka-akdeniz-\d{4}\.json$/.test(f)).sort())
  hepsi.push(...JSON.parse(readFileSync(here(f), "utf8")));

/** Ürün geometrisi — kaynak dışında 29 ile birebir aynı. */
function tahmin(c, kaynak) {
  const e = egimler[ekey(c)];
  if (!e) return null;
  const w = kaynak === "era5" ? era5[wkey(c)] : icon[ikey(c)];
  if (!w) return null;
  const i0 = Math.round((c.t0 - w.t0) / SAAT);
  const saat = Math.max(1, Math.round(c.hours));
  let km = 0, x = 0, y = 0, n = 0;
  for (let i = 0; i < saat; i++) {
    const s = w.spd[i0 + i], d = w.dir[i0 + i];
    if (typeof s !== "number" || typeof d !== "number") continue;
    km += K * interp(s, ROS);
    const to = (d + 180) % 360;
    x += s * Math.sin(toRad(to)); y += s * Math.cos(toRad(to)); n++;
  }
  if (!n) return null;
  const kmh = Math.hypot(x, y) / n;
  return { km, kmh, dir: rothDir(yakitOf(clc[ckey(c)]), kmh, (toDeg(Math.atan2(x, y)) + 360) % 360, e.egim, e.yokus) };
}

const havuz = hepsi.filter(
  (c) =>
    !ORTADOGU.has(c.bolge) &&
    ["ORMAN", "MAKI"].includes(yakitOf(clc[ckey(c)])) &&
    c.hucreler.length &&
    YILLAR.includes(new Date(c.t0).getUTCFullYear()) &&
    tahmin(c, "era5") && tahmin(c, "icon")
);
process.stdout.write(
  `${havuz.length} vaka · ${havuz.reduce((s, c) => s + c.hucreler.length, 0)} hücre ` +
    `(${YILLAR.join("-")}, iki kaynakta da dolu)\n` +
    `  Türkiye ${havuz.filter((c) => c.bolge === "Türkiye").length} · ` +
    `dış ${havuz.filter((c) => c.bolge !== "Türkiye").length}\n${"═".repeat(74)}\n`
);

function kapsama(set, kaynak) {
  let okH = 0, nH = 0, okV = 0, alan = 0;
  for (const c of set) {
    const r = tahmin(c, kaynak);
    let hepsiIc = true;
    for (const [brg, d] of c.hucreler) {
      if (d <= r.km * reachRatio(gap(r.dir, brg), r.kmh)) okH++;
      else hepsiIc = false;
      nH++;
    }
    if (hepsiIc) okV++;
    let a = 0;
    for (let i = 0; i < 360; i++) {
      const rr = r.km * reachRatio(Math.min(180, Math.abs(((i + 180) % 360) - 180)), r.kmh);
      a += 0.5 * rr * rr * ((2 * Math.PI) / 360);
    }
    alan += a;
  }
  return { hucre: okH / nH, vaka: okV / set.length, alan };
}

process.stdout.write("küme            kaynak       hücre kapsaması   vaka   toplam alan\n");
for (const [ad, set] of [
  ["TÜMÜ", havuz],
  ["Türkiye", havuz.filter((c) => c.bolge === "Türkiye")],
  ["dış", havuz.filter((c) => c.bolge !== "Türkiye")],
]) {
  if (!set.length) continue;
  const e = kapsama(set, "era5"), i = kapsama(set, "icon");
  process.stdout.write(
    `${ad.padEnd(15)} ERA5 25 km      %${(100 * e.hucre).toFixed(1)}       %${(100 * e.vaka).toFixed(0).padStart(3)}   ${e.alan.toFixed(0).padStart(7)}\n` +
      `${"".padEnd(15)} ICON-EU 7 km    %${(100 * i.hucre).toFixed(1)}       %${(100 * i.vaka).toFixed(0).padStart(3)}   ${i.alan.toFixed(0).padStart(7)}   ` +
      `(alan ${i.alan > e.alan ? "+" : ""}%${(100 * (i.alan / e.alan - 1)).toFixed(1)})\n` +
      `${"".padEnd(15)} → kapsama farkı ${(100 * (i.hucre - e.hucre)).toFixed(1)} puan ` +
      `${Math.abs(i.hucre - e.hucre) < 0.02 ? "✅ iddia ayakta" : "🔴 İDDİA KAYNAĞA BAĞLI"}\n\n`
  );
}
