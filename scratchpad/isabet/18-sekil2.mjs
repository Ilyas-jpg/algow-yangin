/**
 * 18 — ERİŞİM ŞEKLİ, HÜCRE BAZINDA (spec §6.4'ün doğru ölçümü)
 *
 * 07-sekil.mjs (üretimdeki SHAPE_ANCHORS'ın kaynağı) vaka başına TEK açı ve
 * TEK mesafe kullanıyordu; açı yangının kütle merkezine çapalıydı. 30 km'lik
 * bir yangında merkeze göre "geri" yön, cephenin kanadı olabiliyor — 17-lb.mjs
 * güçlü rüzgârda baş/geri oranını 0,98× ölçtü, yani asimetri tamamen kayboldu.
 * Bu, fiziğin değil ölçütün sonucu olabilir.
 *
 * Burada her YENİ HÜCRE ayrı bir gözlem:
 *   açı     = hücrenin KENDİ en yakın yanmış hücresinden yönü
 *   mesafe  = o hücreye taşma (cephenin o noktadaki ilerlemesi)
 * Böylece yangının boyu ölçüme karışmıyor.
 *
 * Hücreler aynı yangında bağımlı olduğu için tüm güven aralıkları OLAY BAZLI
 * bootstrap. Ayrıca iki ağırlıklandırma yan yana:
 *   HÜCRE havuzu — "çizdiğim şekil ilerleyen hücreleri kapsıyor mu" sorusunun
 *                  doğru ölçütü, ama mega yangınlar baskın
 *   VAKA ortancası — her yangın eşit ağırlıklı, tipik yangını anlatır
 */
import { readFileSync } from "node:fs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

const cases = JSON.parse(readFileSync(here("cases-cephe.json"), "utf8"));
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
const med = (a) => pct(a, 0.5);

/* ── hücre havuzu ── */
const cells = [];
let vaka = 0;
for (const c of cases) {
  if (!["ORMAN", "MAKI", "OT"].includes(c.yakit)) continue;
  if (!c.hucreler.length) continue;
  const w = windAt(c);
  const e = elev[ekey(c)];
  if (!w || !e) continue;
  const tahmin = rothermel(c.yakit, w.kmh, w.to, e.egim, e.yokus);
  const norm = 3 / c.hours; // 3 saate normalize
  vaka++;
  for (const [brg, km] of c.hucreler)
    cells.push({ ev: c.ev, vaka, yakit: c.yakit, kmh: w.kmh, sapma: gap(tahmin, brg), iler: km * norm });
}
process.stdout.write(
  `${cells.length} yeni hücre · ${vaka} vaka · ${new Set(cells.map((c) => c.ev)).size} yangın\n`
);

const ACI6 = [[0, 30], [30, 60], [60, 90], [90, 120], [120, 150], [150, 180]];
const KOVA = [
  ["< 8 km/sa", (r) => r.kmh < 8],
  ["8–15", (r) => r.kmh >= 8 && r.kmh < 15],
  ["≥ 15", (r) => r.kmh >= 15],
];

/** Baş/geri oranı (0–60° / 120–180°, %90'lık) — olay-bazlı bootstrap GA. */
function oranCI(pool, iter = 2000) {
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
    const b = s.filter((r) => r.sapma < 60).map((r) => r.iler);
    const g = s.filter((r) => r.sapma >= 120).map((r) => r.iler);
    if (b.length < 10 || g.length < 10) continue;
    const gv = pct(g, 0.9);
    if (gv > 0.01) out.push(pct(b, 0.9) / gv);
  }
  if (out.length < 100) return null;
  out.sort((a, b) => a - b);
  return [out[(out.length * 0.025) | 0], out[(out.length * 0.975) | 0]];
}

function profil(baslik, pool) {
  process.stdout.write(`\n${"═".repeat(74)}\n${baslik} · ${pool.length} hücre / ${new Set(pool.map((r) => r.ev)).size} yangın\n${"═".repeat(74)}\n`);
  if (pool.length < 60) {
    process.stdout.write("yetersiz\n");
    return null;
  }
  process.stdout.write("sapma        n    ortanca   %90    hücre payı   şekil(r/rbaş)\n");
  const p90 = [];
  for (const [a, b] of ACI6) {
    const R = pool.filter((r) => r.sapma >= a && r.sapma < b + (b === 180 ? 1 : 0));
    if (R.length < 8) {
      process.stdout.write(`${(a + "–" + b + "°").padEnd(12)}${String(R.length).padStart(3)}   (az)\n`);
      p90.push([(a + b) / 2, null, R.length]);
      continue;
    }
    const il = R.map((r) => r.iler);
    p90.push([(a + b) / 2, pct(il, 0.9), R.length]);
  }
  const bas = p90[0][1];
  for (const [ang, v, n] of p90) {
    if (v === null) continue;
    const oran = v / bas;
    process.stdout.write(
      `${String(ang - 15) + "–" + String(ang + 15) + "°"}`.padEnd(12) +
        `${String(n).padStart(4)}   ${med(pool.filter((r) => Math.abs(r.sapma - ang) < 15).map((r) => r.iler)).toFixed(2).padStart(6)}  ` +
        `${v.toFixed(2).padStart(5)}   ${("%" + ((100 * n) / pool.length).toFixed(0)).padStart(6)}      ` +
        `${oran.toFixed(2)}  ${"█".repeat(Math.max(0, Math.round(oran * 26)))}\n`
    );
  }
  const b = pool.filter((r) => r.sapma < 60).map((r) => r.iler);
  const g = pool.filter((r) => r.sapma >= 120).map((r) => r.iler);
  const ci = oranCI(pool);
  const oran = pct(g, 0.9) > 0.01 ? pct(b, 0.9) / pct(g, 0.9) : null;
  process.stdout.write(
    `  baş(0–60°) %90 ${pct(b, 0.9).toFixed(2)} km · geri(120–180°) %90 ${pct(g, 0.9).toFixed(2)} km · ` +
      `oran ${oran ? oran.toFixed(2) + "×" : "—"}  %95 GA ${ci ? `${ci[0].toFixed(2)}–${ci[1].toFixed(2)}×` : "—"}` +
      `${ci && ci[0] > 1 ? "  ✅ asimetri KANITLI" : "  ❌ GA 1,0'ı içeriyor"}\n`
  );
  return { p90, oran, ci };
}

const wild = cells.filter((r) => r.yakit !== "OT");
const tumu = profil("ORMAN + MAKİ — hücre havuzu", wild);
process.stdout.write("\nRÜZGÂR KOVALARI (Anderson: oran rüzgârla ARTMALI)\n");
const trend = [];
for (const [ad, sel] of KOVA) {
  const r = profil(`ORMAN + MAKİ · rüzgâr ${ad}`, wild.filter(sel));
  if (r) trend.push([ad, r.oran, r.ci]);
}
process.stdout.write(
  `\n${"─".repeat(74)}\nTREND: ${trend.map(([a, o]) => `${a}=${o ? o.toFixed(2) : "—"}×`).join("  →  ")}\n` +
    `  ${trend.every((t, i) => i === 0 || (t[1] ?? 0) >= (trend[i - 1][1] ?? 0)) ? "ARTAN (Anderson yönünde)" : "MONOTON DEĞİL — Anderson eğrisi bu veride yok"}\n`
);

/* ── vaka bazlı ağırlık: her yangın eşit ── */
process.stdout.write(`\n${"═".repeat(74)}\nVAKA BAZLI (her vaka kendi %90'ını verir, sonra vakaların ortancası)\n${"═".repeat(74)}\n`);
const byVaka = new Map();
for (const r of wild) {
  if (!byVaka.has(r.vaka)) byVaka.set(r.vaka, []);
  byVaka.get(r.vaka).push(r);
}
const oranlar = [];
for (const [, R] of byVaka) {
  const b = R.filter((r) => r.sapma < 60).map((r) => r.iler);
  const g = R.filter((r) => r.sapma >= 120).map((r) => r.iler);
  if (b.length < 3 || g.length < 3) continue;
  const gv = pct(g, 0.9);
  if (gv > 0.01) oranlar.push(pct(b, 0.9) / gv);
}
process.stdout.write(
  `  ${oranlar.length} vakada hem baş hem geri hücresi var · baş/geri ortancası ${med(oranlar).toFixed(2)}× · ` +
    `%25–75 ${pct(oranlar, 0.25).toFixed(2)}–${pct(oranlar, 0.75).toFixed(2)}×\n` +
    `  oran > 1 olan vaka payı: %${((100 * oranlar.filter((o) => o > 1).length) / oranlar.length).toFixed(0)}\n`
);

/* ── üretimdeki çapalarla kıyas ── */
const SHAPE_ANCHORS = [[0, 1.0], [30, 0.97], [60, 0.8], [90, 0.69], [120, 0.55], [150, 0.43], [180, 0.42]];
process.stdout.write(`\n${"─".repeat(74)}\nÜRETİMDEKİ SHAPE_ANCHORS vs hücre bazlı ölçüm:\n`);
if (tumu)
  for (const [ang, v] of tumu.p90) {
    if (v === null) continue;
    const uretim = SHAPE_ANCHORS.reduce((best, [a, r]) => (Math.abs(a - ang) < Math.abs(best[0] - ang) ? [a, r] : best), SHAPE_ANCHORS[0]);
    process.stdout.write(
      `  ${String(ang).padStart(3)}°  ölçüm ${(v / tumu.p90[0][1]).toFixed(2)}   üretim ${uretim[1].toFixed(2)}   ` +
        `${Math.abs(v / tumu.p90[0][1] - uretim[1]) > 0.15 ? "← ayrışıyor" : ""}\n`
    );
  }
