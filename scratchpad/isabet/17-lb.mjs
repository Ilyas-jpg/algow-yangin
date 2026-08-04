/**
 * 17 — BAŞ/GERİ ORANI RÜZGÂRIN FONKSİYONU MU? (spec §6.4)
 *
 * Üretimdeki `SHAPE_ANCHORS` tek bir şekil taşıyor: baş/geri 2,4×, rüzgâr ne
 * olursa olsun. Literatürde (Anderson 1983 tipi L/B eğrisi) elipsin uzunluk/
 * genişlik oranı efektif rüzgâr hızının artan fonksiyonudur: rüzgârsızken
 * yangın daireye yakın (L/B≈1), rüzgâr arttıkça uzayıp incelir.
 *
 * Burada 07-sekil.mjs'in ölçümünü RÜZGÂR KOVALARINA ayırıyoruz. Kova başına
 * örneklem inceldiği için ① 6 açı kovası yerine 3 (baş/kanat/geri) ② her oran
 * için olay-bazlı bootstrap GA ③ trendin monoton olup olmadığına bakılıyor.
 *
 * Not: ölçülen sapma TAHMİN EDİLEN yönden sapmadır — yani çizilen şeklin
 * ihtiyacı olan büyüklük tam olarak bu (gerçek baştan sapma değil).
 */
import { readFileSync } from "node:fs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

const cases = JSON.parse(readFileSync(here("cases-wild.json"), "utf8"));
const wind = JSON.parse(readFileSync(here("wind-w.json"), "utf8"));
const elev = JSON.parse(readFileSync(here("elev-srtm.json"), "utf8"));
const wkey = (c) =>
  `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;

const FUEL = {
  ORMAN: { sigma: 1500, beta: 0.03, waf: 0.15 },
  MAKI: { sigma: 1800, beta: 0.012, waf: 0.3 },
  OT: { sigma: 3500, beta: 0.0015, waf: 0.4 },
};
function rothermel(fuel, kmh, deg, slopePct, upslope) {
  const { sigma, beta, waf } = FUEL[fuel] ?? FUEL.MAKI;
  const betaOp = 3.348 * sigma ** -0.8189;
  const C = 7.47 * Math.exp(-0.133 * sigma ** 0.55);
  const B = 0.02526 * sigma ** 0.54;
  const E = 0.715 * Math.exp(-3.59e-4 * sigma);
  const phiW = C * (Math.max(0, kmh) * 54.6807 * waf) ** B * (beta / betaOp) ** -E;
  const phiS = 5.275 * beta ** -0.3 * (slopePct / 100) ** 2;
  const x = phiW * Math.sin(toRad(deg)) + phiS * Math.sin(toRad(upslope));
  const y = phiW * Math.cos(toRad(deg)) + phiS * Math.cos(toRad(upslope));
  return Math.hypot(x, y) < 1e-9 ? deg : (toDeg(Math.atan2(x, y)) + 360) % 360;
}
function windAt(c) {
  const w = wind[wkey(c)];
  if (!w) return null;
  const i = Math.round((c.t0 - w.t0) / 3600_000);
  const s = w.spd[i];
  const d = w.dir[i];
  return typeof s === "number" && typeof d === "number" ? { kmh: s, to: (d + 180) % 360 } : null;
}
const gap = (a, b) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};
const pct = (a, p) => {
  const s = a.slice().sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null;
};

const rows = [];
for (const c of cases) {
  if (c.basYon == null || c.iler90 == null) continue;
  const w = windAt(c);
  const e = elev[ekey(c)];
  if (!w || !e) continue;
  rows.push({
    ev: c.ev,
    yakit: c.yakit,
    sapma: gap(rothermel(c.yakit, w.kmh, w.to, e.egim, e.yokus), c.basYon),
    iler: c.iler90 * (3 / c.hours), // 3 saate normalize (sabit hız varsayımı, 07 ile aynı)
    kmh: w.kmh,
  });
}
process.stdout.write(`${rows.length} vaka (${new Set(rows.map((r) => r.ev)).size} yangın)\n`);

/** Baş/geri oranının olay-bazlı bootstrap GA'sı. */
function ratioCI(pool, iter = 2000) {
  const byEv = new Map();
  for (const r of pool) {
    if (!byEv.has(r.ev)) byEv.set(r.ev, []);
    byEv.get(r.ev).push(r);
  }
  const evs = [...byEv.values()];
  if (evs.length < 5) return null;
  const out = [];
  for (let i = 0; i < iter; i++) {
    const s = [];
    for (let j = 0; j < evs.length; j++) s.push(...evs[(Math.random() * evs.length) | 0]);
    const bas = s.filter((r) => r.sapma < 60).map((r) => r.iler);
    const geri = s.filter((r) => r.sapma >= 120).map((r) => r.iler);
    if (bas.length < 5 || geri.length < 5) continue;
    const g = pct(geri, 0.9);
    if (g > 0.01) out.push(pct(bas, 0.9) / g);
  }
  if (out.length < 100) return null;
  out.sort((a, b) => a - b);
  return [out[(out.length * 0.025) | 0], out[(out.length * 0.975) | 0]];
}

const KOVA = [
  ["< 8 km/sa", (r) => r.kmh < 8],
  ["8–15", (r) => r.kmh >= 8 && r.kmh < 15],
  ["≥ 15", (r) => r.kmh >= 15],
];
const ACI = [
  ["baş 0–60°", (r) => r.sapma < 60],
  ["kanat 60–120°", (r) => r.sapma >= 60 && r.sapma < 120],
  ["geri 120–180°", (r) => r.sapma >= 120],
];

function tablo(baslik, sel) {
  const R = rows.filter(sel);
  process.stdout.write(`\n${"═".repeat(72)}\n${baslik} · ${R.length} vaka\n${"═".repeat(72)}\n`);
  process.stdout.write("rüzgâr        n   baş(%90)  kanat  geri   baş/geri   %95 GA\n");
  const trend = [];
  for (const [ad, ks] of KOVA) {
    const pool = R.filter(ks);
    if (pool.length < 25) {
      process.stdout.write(`${ad.padEnd(12)}${String(pool.length).padStart(4)}  (yetersiz)\n`);
      continue;
    }
    const vals = ACI.map(([, as_]) => {
      const v = pool.filter(as_).map((r) => r.iler);
      return v.length >= 5 ? pct(v, 0.9) : null;
    });
    const oran = vals[0] !== null && vals[2] !== null && vals[2] > 0.01 ? vals[0] / vals[2] : null;
    const ci = ratioCI(pool);
    trend.push([ad, oran]);
    process.stdout.write(
      `${ad.padEnd(12)}${String(pool.length).padStart(4)}  ` +
        vals.map((v) => (v === null ? "  —  " : v.toFixed(2).padStart(6))).join(" ") +
        `   ${oran === null ? "—" : oran.toFixed(2) + "×"}`.padEnd(12) +
        `${ci ? `${ci[0].toFixed(1)}–${ci[1].toFixed(1)}×` : "—"}\n`
    );
  }
  // monoton mu? Anderson eğrisi rüzgârla ARTAN oran bekliyor.
  const ok = trend.filter(([, o]) => o !== null).map(([, o]) => o);
  if (ok.length >= 2)
    process.stdout.write(
      `  trend: ${ok.map((o) => o.toFixed(2)).join(" → ")}  ` +
        `${ok.every((v, i) => i === 0 || v >= ok[i - 1]) ? "ARTAN (Anderson yönünde)" : "MONOTON DEĞİL"}\n`
    );
  return trend;
}

tablo("TÜM DOĞAL YAKIT", () => true);
tablo("ORMAN + MAKİ", (r) => r.yakit !== "OT");

/* ── üretimdeki tek-şekil ile kıyas: havuzun tamamı ── */
const bas = rows.filter((r) => r.sapma < 60).map((r) => r.iler);
const geri = rows.filter((r) => r.sapma >= 120).map((r) => r.iler);
const ciAll = ratioCI(rows);
process.stdout.write(
  `\n${"─".repeat(72)}\nHAVUZUN TAMAMI: baş %90 ${pct(bas, 0.9).toFixed(2)} km · geri %90 ${pct(geri, 0.9).toFixed(2)} km · ` +
    `oran ${(pct(bas, 0.9) / pct(geri, 0.9)).toFixed(2)}×  GA ${ciAll ? `${ciAll[0].toFixed(1)}–${ciAll[1].toFixed(1)}×` : "—"}\n` +
    `üretimdeki SHAPE_ANCHORS bu havuzdan türetildi (2,4× — 6 açı kovasıyla, 0–30° / 150–180° uçlarından)\n`
);

/* ── Anderson 1983 L/B eğrisi ne diyor (kıyas için) ── */
process.stdout.write("\nAnderson 1983 L/B (orta-alev rüzgârı, WAF 0,15 varsayımıyla):\n");
for (const kmh of [4, 8, 12, 18, 26]) {
  const mph = kmh * 0.6214 * 0.15; // orta-alev rüzgârına indirgeme
  const lb = 0.936 * Math.exp(0.2566 * mph) + 0.461 * Math.exp(-0.1548 * mph) - 0.397;
  // elips odağından baş/geri oranı: (1+e)/(1-e), e = sqrt(1-1/LB²)
  const e = Math.sqrt(Math.max(0, 1 - 1 / lb ** 2));
  process.stdout.write(
    `  ${String(kmh).padStart(2)} km/sa → L/B ${lb.toFixed(2)} · odaktan baş/geri ${((1 + e) / (1 - e)).toFixed(2)}×\n`
  );
}
