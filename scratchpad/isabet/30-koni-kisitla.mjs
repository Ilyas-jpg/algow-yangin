/**
 * 30 — §7.6: "BÜYÜMEYECEK YANGINA KONİ ÇİZME" BİLANÇOSU
 *
 * Neden bu fikir bedavaya yakın: kapsama ölçütü (29-kapsama-akdeniz.mjs)
 * yalnız YENİ HÜCRESİ OLAN vakaları sayar. Büyümeyen bir yangının konisini
 * küçültmek kapsamadan HİÇBİR ŞEY götürmez — saf alan kazancıdır.
 * Bedel yalnız YANLIŞ NEGATİFLERDEN gelir: "büyümez" denip büyüyen yangın.
 *
 * Girdi: buyume-tahmin.csv (28-model.py) — CV tahmini katman-dışı, holdout
 *        tahmini modeli hiç görmemiş sette.
 *
 * 🔴 Rapor TÜRKİYE HOLDOUT üzerinden: ürün orada çalışıyor ve model orayı
 *    hiç görmedi.
 *
 * Koşum: node scratchpad/isabet/30-koni-kisitla.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { yakitOf } from "./04b-yakit-kod.mjs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const ORTADOGU = new Set(["Irak", "Suriye", "İran"]);

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
const K = 1.5; // yayındaki ayar — 29'da 10× veride doğrulandı
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
const wind = JSON.parse(readFileSync(here("akdeniz-ruzgar.json"), "utf8"));
const elev = JSON.parse(readFileSync(here("akdeniz-egim.json"), "utf8"));
const ckey = (c) => `${(Math.round(c.lat * 100) / 100).toFixed(2)},${(Math.round(c.lon * 100) / 100).toFixed(2)}`;
const wkey = (c) => `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
const gap = (a, b) => { const d = Math.abs(((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; };

/* büyüme tahminleri */
const tsat = readFileSync(here("buyume-tahmin.csv"), "utf8").trim().split("\n");
const tkol = tsat[0].split(",");
const P = new Map();
for (const s of tsat.slice(1)) {
  const v = s.split(",");
  const o = Object.fromEntries(tkol.map((k, i) => [k, v[i]]));
  P.set(`${o.ev}|${o.t0}`, { p: +o.p, holdout: +o.holdout, buyudu: +o.t_buyudu });
}

const hepsi = [];
for (const f of readdirSync(here(".")).filter((f) => /^vaka-akdeniz-\d{4}\.json$/.test(f)).sort())
  hepsi.push(...JSON.parse(readFileSync(here(f), "utf8")));

const sekilAlani = (kmh) => {
  let a = 0;
  for (let i = 0; i < 360; i++) {
    const r = reachRatio(Math.min(180, Math.abs(((i + 180) % 360) - 180)), kmh);
    a += 0.5 * r * r * ((2 * Math.PI) / 360);
  }
  return a;
};

const rows = [];
for (const c of hepsi) {
  if (ORTADOGU.has(c.bolge)) continue;
  const yk = yakitOf(clc[ckey(c)]);
  if (!["ORMAN", "MAKI"].includes(yk)) continue;
  const t = P.get(`${c.ev}|${c.t0}`);
  if (!t) continue;
  const w = wind[wkey(c)], e = elev[ekey(c)];
  if (!w || !e) continue;
  const i0 = Math.round((c.t0 - w.t0) / 3600_000);
  const saat = Math.max(1, Math.round(c.hours));
  let km = 0, x = 0, y = 0, n = 0;
  for (let i = 0; i < saat; i++) {
    const s = w.spd[i0 + i], d = w.dir[i0 + i];
    if (typeof s !== "number" || typeof d !== "number") continue;
    km += K * interp(s, ROS);
    const to = (d + 180) % 360;
    x += s * Math.sin(toRad(to)); y += s * Math.cos(toRad(to)); n++;
  }
  if (!n) continue;
  const kmh = Math.hypot(x, y) / n;
  rows.push({
    tr: t.holdout === 1, p: t.p, hucreler: c.hucreler, km, kmh,
    dir: rothDir(yk, kmh, (toDeg(Math.atan2(x, y)) + 360) % 360, e.egim, e.yokus),
    alan: km * km * sekilAlani(kmh),
  });
}
const TR = rows.filter((r) => r.tr);
process.stdout.write(
  `${rows.length} vaka eşleşti · Türkiye holdout ${TR.length}` +
    ` (büyüyen ${TR.filter((r) => r.hucreler.length).length} · büyümeyen ${TR.filter((r) => !r.hucreler.length).length})\n`
);

/**
 * Eşik altındaki (büyümesi olası görülmeyen) vakalarda koni KÜÇÜLTÜLÜR.
 * kucult=0 → hiç çizme. kucult=0,5 → yarıçapı yarıya indir.
 */
function bilanco(set, esik, kucult) {
  let okH = 0, nH = 0, alan = 0, kisilan = 0, yanlisNegatif = 0;
  for (const r of set) {
    const kis = r.p < esik ? kucult : 1;
    if (r.p < esik) kisilan++;
    alan += r.alan * kis * kis;
    if (r.hucreler.length && r.p < esik) yanlisNegatif++;
    for (const [brg, d] of r.hucreler) {
      if (d <= r.km * kis * reachRatio(gap(r.dir, brg), r.kmh)) okH++;
      nH++;
    }
  }
  return { kaps: okH / nH, alan, kisilan, yanlisNegatif };
}

const taban = bilanco(TR, -1, 1);
process.stdout.write(
  `\nTÜRKİYE HOLDOUT — yayındaki davranış (herkese koni)\n` +
    `  kapsama %${(100 * taban.kaps).toFixed(1)} · toplam alan ${taban.alan.toFixed(0)}\n` +
    `\n${"═".repeat(78)}\n` +
    `eşik   küçültme   kısılan vaka   yanlış negatif   kapsama   alan      alan farkı\n` +
    `${"═".repeat(78)}\n`
);
for (const kucult of [0, 0.5]) {
  for (const esik of [0.5, 0.6, 0.7, 0.75, 0.8, 0.85]) {
    const b = bilanco(TR, esik, kucult);
    process.stdout.write(
      `${esik.toFixed(2)}   ${(kucult === 0 ? "çizme" : "×" + kucult).padEnd(9)}  ` +
        `${String(b.kisilan).padStart(9)}   ${String(b.yanlisNegatif).padStart(12)}   ` +
        `%${(100 * b.kaps).toFixed(1).padStart(6)}   ${b.alan.toFixed(0).padStart(7)}   ` +
        `${(1 - b.alan / taban.alan >= 0 ? "−%" : "+%") + Math.abs(100 * (1 - b.alan / taban.alan)).toFixed(1)}` +
        `${b.kaps >= taban.kaps - 0.005 ? "  ✅" : "  🔴"}\n`
    );
  }
  process.stdout.write(`${"─".repeat(78)}\n`);
}
