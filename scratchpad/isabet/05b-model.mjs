/**
 * 05b — Yön modelleri, İKİ gerçek-yön ölçütüne karşı + kalibrasyon.
 *
 * Gerçek yön ölçütleri:
 *   MERKEZ — yeni yanan tüm piksellerin ağırlık merkezi (orijinal testin ölçütü)
 *   BAS    — a ayak izinden en uzağa ilerleyen 1/3 dilim (yangının başı)
 *
 * ROTH_KALIBRE: φs'nin ağırlığı k ile ölçeklenir; k YALNIZ eğitim yangınlarında
 * seçilir, skor AYRI test yangınlarında ölçülür (2 katlı, olay bazlı bölme).
 */
import { readFileSync } from "node:fs";
const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

const cases = JSON.parse(readFileSync(here("cases-wild.json"), "utf8"));
const wind = JSON.parse(readFileSync(here("wind-w.json"), "utf8"));
const elev = JSON.parse(readFileSync(here("elev-srtm.json"), "utf8"));
const wkey = (c) => `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;

const angDiff = (a, b) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};
function vecSum(parts) {
  let x = 0, y = 0;
  for (const [deg, mag] of parts) {
    if (deg === null || !Number.isFinite(deg) || !Number.isFinite(mag) || mag <= 0) continue;
    x += mag * Math.sin(toRad(deg));
    y += mag * Math.cos(toRad(deg));
  }
  return Math.hypot(x, y) < 1e-9 ? null : (toDeg(Math.atan2(x, y)) + 360) % 360;
}

const FUEL = {
  ORMAN: { sigma: 1500, beta: 0.030, waf: 0.15 },
  MAKI: { sigma: 1800, beta: 0.012, waf: 0.30 },
  OT: { sigma: 3500, beta: 0.0015, waf: 0.40 },
};
function phis(fuel, windKmh, slopePct) {
  const { sigma, beta, waf } = FUEL[process.env.FORCE_FUEL || fuel] ?? FUEL.MAKI;
  const betaOp = 3.348 * sigma ** -0.8189;
  const C = 7.47 * Math.exp(-0.133 * sigma ** 0.55);
  const B = 0.02526 * sigma ** 0.54;
  const E = 0.715 * Math.exp(-3.59e-4 * sigma);
  const U = Math.max(0, windKmh) * 54.6807 * waf;
  return {
    phiW: C * U ** B * (beta / betaOp) ** -E,
    phiS: 5.275 * beta ** -0.3 * (slopePct / 100) ** 2,
  };
}
function windAt(c, a, b) {
  const w = wind[wkey(c)];
  if (!w) return null;
  const i0 = Math.round((a - w.t0) / 3600_000), i1 = Math.round((b - w.t0) / 3600_000);
  let x = 0, y = 0, n = 0;
  for (let i = Math.max(0, i0); i <= Math.min(w.spd.length - 1, i1); i++) {
    const s = w.spd[i], d = w.dir[i];
    if (typeof s !== "number" || typeof d !== "number") continue;
    const to = (d + 180) % 360;
    x += s * Math.sin(toRad(to)); y += s * Math.cos(toRad(to)); n++;
  }
  return n ? { deg: (toDeg(Math.atan2(x, y)) + 360) % 360, kmh: Math.hypot(x, y) / n } : null;
}

/* ── vaka tablosu ── */
const rows = [];
for (const c of cases) {
  const e = elev[ekey(c)];
  const w = windAt(c, c.t0, c.t0);
  if (!e || !w) continue;
  const w3 = windAt(c, c.t0 - 3 * 3600_000, c.t0);
  const wAvg = windAt(c, c.t0, c.t1);
  const { phiW, phiS } = phis(c.yakit, w.kmh, e.egim);
  rows.push({ c, e, w, w3, wAvg, phiW, phiS });
}

function tahminler(r, k) {
  const { c, e, w, w3, wAvg, phiW, phiS } = r;
  const roth = vecSum([[w.deg, phiW], [e.yokus, phiS]]);
  const rothK = vecSum([[w.deg, phiW], [e.yokus, phiS * k]]);
  return {
    RUZGAR_ANLIK: w.deg,
    RUZGAR_3SA: w3?.deg ?? w.deg,
    EGIM: e.egim >= 1 ? e.yokus : null,
    ROTHERMEL: roth,
    ROTH_KALIBRE: rothK,
    SUREKLILIK: null, // ölçüte göre aşağıda doldurulur
    ORACLE_ORT: wAvg?.deg ?? null,
  };
}

const MODELS = ["RUZGAR_ANLIK", "RUZGAR_3SA", "EGIM", "ROTHERMEL", "ROTH_KALIBRE", "SUREKLILIK", "ORACLE_ORT"];

function errsFor(r, gtKey, k) {
  const gercek = gtKey === "BAS" ? r.c.basYon : r.c.yeniYon;
  if (gercek === null || gercek === undefined) return null;
  const t = tahminler(r, k);
  t.SUREKLILIK = gtKey === "BAS" ? r.c.prevBasYon : r.c.prevYon;
  const out = {};
  for (const m of MODELS) out[m] = t[m] === null || t[m] === undefined ? null : angDiff(t[m], gercek);
  return out;
}

const medyan = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const ozet = (a) => {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return null;
  const p = (t) => (100 * s.filter((x) => x <= t).length) / s.length;
  return { n: s.length, ort: s.reduce((x, y) => x + y, 0) / s.length, med: s[Math.floor(s.length / 2)], p45: p(45), p90: p(90), ust135: 100 - p(135) };
};
function bootCI(rws, pick, iter = 1500) {
  const byEv = new Map();
  for (const r of rws) { const v = pick(r); if (Number.isFinite(v)) (byEv.get(r.c.ev) ?? byEv.set(r.c.ev, []).get(r.c.ev)).push(v); }
  const evs = [...byEv.values()];
  if (evs.length < 5) return null;
  const meds = [];
  for (let i = 0; i < iter; i++) {
    const pool = [];
    for (let j = 0; j < evs.length; j++) pool.push(...evs[(Math.random() * evs.length) | 0]);
    pool.sort((a, b) => a - b);
    meds.push(pool[Math.floor(pool.length / 2)]);
  }
  meds.sort((a, b) => a - b);
  return [meds[(iter * 0.025) | 0], meds[(iter * 0.975) | 0]];
}

/* ── ROTH_KALIBRE: eğim ağırlığı k'yı olay-bazlı 2 katlı çapraz doğrulamayla seç ── */
const K_GRID = [0.5, 1, 2, 3, 5, 8, 12, 20, 35];
function kalibreEt(pool, gtKey) {
  const evs = [...new Set(pool.map((r) => r.c.ev))].sort((a, b) => a - b);
  const folds = [evs.filter((_, i) => i % 2 === 0), evs.filter((_, i) => i % 2 === 1)];
  const testErr = [];
  const secilen = [];
  for (let f = 0; f < 2; f++) {
    const trainSet = new Set(folds[1 - f]);
    const train = pool.filter((r) => trainSet.has(r.c.ev));
    const test = pool.filter((r) => !trainSet.has(r.c.ev));
    let bestK = 1, bestM = Infinity;
    for (const k of K_GRID) {
      const m = medyan(train.map((r) => errsFor(r, gtKey, k)?.ROTH_KALIBRE ?? NaN));
      if (m !== null && m < bestM) { bestM = m; bestK = k; }
    }
    secilen.push(bestK);
    for (const r of test) {
      const e = errsFor(r, gtKey, bestK);
      if (e) testErr.push({ r, v: e.ROTH_KALIBRE });
    }
  }
  return { testErr, secilen };
}

function rapor(baslik, sel, gtKey) {
  const pool = rows.filter(sel).filter((r) => (gtKey === "BAS" ? r.c.basYon : r.c.yeniYon) !== null);
  if (pool.length < 20) { process.stdout.write(`\n${baslik}: yetersiz (${pool.length})\n`); return; }
  const evs = new Set(pool.map((r) => r.c.ev)).size;
  const { testErr, secilen } = kalibreEt(pool, gtKey);
  const kMap = new Map(testErr.map((x) => [x.r, x.v]));

  process.stdout.write(`\n${"─".repeat(78)}\n${baslik} · gerçek yön ölçütü: ${gtKey} · ${pool.length} vaka / ${evs} yangın\n${"─".repeat(78)}\n`);
  process.stdout.write("model            n    ort°  medyan°   ≤45°   ≤90°  >135°   medyan %95 GA\n");
  const scored = [];
  for (const m of MODELS) {
    const vals = m === "ROTH_KALIBRE" ? pool.map((r) => kMap.get(r) ?? NaN) : pool.map((r) => errsFor(r, gtKey, 1)?.[m] ?? NaN);
    const s = ozet(vals);
    if (s) scored.push([m, s, (r) => (m === "ROTH_KALIBRE" ? kMap.get(r) : errsFor(r, gtKey, 1)?.[m])]);
  }
  scored.sort((a, b) => a[1].med - b[1].med);
  for (const [m, s, pick] of scored) {
    const ci = bootCI(pool, pick);
    process.stdout.write(
      `${(m === "ROTH_KALIBRE" ? `ROTH_KAL(k=${secilen.join("/")})` : m).padEnd(16)}${String(s.n).padStart(4)} ${s.ort.toFixed(1).padStart(6)} ${s.med.toFixed(1).padStart(7)} ` +
        `${("%" + s.p45.toFixed(0)).padStart(6)} ${("%" + s.p90.toFixed(0)).padStart(6)} ${("%" + s.ust135.toFixed(0)).padStart(6)}   ${ci ? `${ci[0].toFixed(0)}–${ci[1].toFixed(0)}°` : "—"}\n`
    );
  }
  process.stdout.write(`${"".padEnd(16)}     (rastgele: ort 90 · medyan 90 · ≤45° %25 · >135° %25)\n`);
}

const forest = (r) => r.c.yakit !== "OT";
for (const gt of ["MERKEZ", "BAS"]) {
  process.stdout.write(`\n\n${"█".repeat(78)}\n  GERÇEK YÖN ÖLÇÜTÜ: ${gt}\n${"█".repeat(78)}\n`);
  rapor("ORMAN + MAKİ", forest, gt);
  rapor("  └ eğim ≥ %15", (r) => forest(r) && r.e.egim >= 15, gt);
  rapor("  └ eğim < %15", (r) => forest(r) && r.e.egim < 15, gt);
  rapor("  └ rüzgâr ≥ 15 km/sa", (r) => forest(r) && r.w.kmh >= 15, gt);
  rapor("OTLAK/BOZKIR", (r) => !forest(r), gt);
}
