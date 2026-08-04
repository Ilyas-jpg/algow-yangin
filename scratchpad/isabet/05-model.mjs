/**
 * 05 — Yön modellerinin retrospektif karşılaştırması.
 *
 * Karşılaştırılan modeller (ORACLE işaretliler hariç hepsi tahmin anında
 * gerçekten bilinebilir bilgiyi kullanır):
 *   1 RUZGAR_ANLIK   — canlı üründeki model: rüzgâr yönü + 180°
 *   2 RUZGAR_3SA     — önceki 3 saatin vektör ortalaması
 *   3 EGIM           — saf yokuş-yukarı yönü
 *   4 ROTHERMEL      — φw·rüzgâr + φs·yokuş vektör toplamı (yakıta göre)
 *   5 SUREKLILIK     — yangının bir önceki geçişte gözlenen yönü
 *   6 EKSEN          — yangının kendi uzama ekseni (ayak izi merkezi → baş)
 *   7 SUREK+ROTH     — 5 ile 4'ün vektör harmanı
 *   8 ORACLE_ORT     — a→b aralığının GERÇEK ortalama rüzgârı (teşhis amaçlı)
 *
 * Ölçüt: gerçek yön ile tahmin arasındaki açı farkı.
 * Rastgele beklenti: ort 90°, medyan 90°, ≤45° %25, >135° %25.
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

const angDiff = (a, b) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};
/** derece cinsinden yönlerin/vektörlerin toplamı → bearing */
function vecSum(parts) {
  let x = 0, y = 0;
  for (const [deg, mag] of parts) {
    if (deg === null || !Number.isFinite(deg) || !Number.isFinite(mag) || mag <= 0) continue;
    x += mag * Math.sin(toRad(deg));
    y += mag * Math.cos(toRad(deg));
  }
  if (Math.hypot(x, y) < 1e-9) return null;
  return { deg: (toDeg(Math.atan2(x, y)) + 360) % 360, mag: Math.hypot(x, y) };
}

/* ── Rothermel yakıt parametreleri ──
   σ: yüzey/hacim oranı (ft⁻¹), β: paketleme oranı, waf: 10 m → alev-ortası rüzgâr katsayısı */
const FUEL = {
  ORMAN: { sigma: 1500, beta: 0.030, waf: 0.15 },
  MAKI: { sigma: 1800, beta: 0.012, waf: 0.30 },
  OT: { sigma: 3500, beta: 0.0015, waf: 0.40 },
};
function rothermelPhi(fuel, windKmh, slopePct) {
  const f = FUEL[fuel] ?? FUEL.MAKI;
  const { sigma, beta, waf } = f;
  const betaOp = 3.348 * sigma ** -0.8189;
  const C = 7.47 * Math.exp(-0.133 * sigma ** 0.55);
  const B = 0.02526 * sigma ** 0.54;
  const E = 0.715 * Math.exp(-3.59e-4 * sigma);
  const Uftmin = Math.max(0, windKmh) * 54.6807 * waf; // km/sa → ft/dk, alev ortası
  const phiW = C * Uftmin ** B * (beta / betaOp) ** -E;
  const phiS = 5.275 * beta ** -0.3 * Math.tan(Math.atan(slopePct / 100)) ** 2;
  return { phiW, phiS };
}

/** t anındaki (veya [t0,t1] aralığının) rüzgârı — vektör ortalaması */
function windAt(c, fromMs, toMs) {
  const w = wind[wkey(c)];
  if (!w) return null;
  const i0 = Math.round((fromMs - w.t0) / 3600_000);
  const i1 = Math.round((toMs - w.t0) / 3600_000);
  let x = 0, y = 0, n = 0, tmp = 0, rh = 0;
  for (let i = Math.max(0, i0); i <= Math.min(w.spd.length - 1, i1); i++) {
    const s = w.spd[i], d = w.dir[i];
    if (typeof s !== "number" || typeof d !== "number") continue;
    // rüzgârın GİTTİĞİ yön = geldiği + 180
    const to = (d + 180) % 360;
    x += s * Math.sin(toRad(to));
    y += s * Math.cos(toRad(to));
    tmp += w.tmp[i] ?? 0;
    rh += w.rh[i] ?? 0;
    n++;
  }
  if (!n) return null;
  const mag = Math.hypot(x, y) / n;
  return {
    deg: (toDeg(Math.atan2(x, y)) + 360) % 360,
    kmh: mag,
    tmp: tmp / n,
    rh: rh / n,
    n,
  };
}

const MODELS = [
  "RUZGAR_ANLIK", "RUZGAR_3SA", "EGIM", "ROTHERMEL",
  "SUREKLILIK", "EKSEN", "SUREK+ROTH", "ORACLE_ORT",
];

function predict(c) {
  const e = elev[ekey(c)];
  const wInst = windAt(c, c.t0, c.t0);
  const w3 = windAt(c, c.t0 - 3 * 3600_000, c.t0);
  const wAvg = windAt(c, c.t0, c.t1);
  if (!wInst || !e) return null;
  const { phiW, phiS } = rothermelPhi(c.yakit, wInst.kmh, e.egim);
  const roth = vecSum([[wInst.deg, phiW], [e.yokus, phiS]]);
  const surek = c.prevYon;
  const out = {
    RUZGAR_ANLIK: wInst.deg,
    RUZGAR_3SA: w3?.deg ?? wInst.deg,
    EGIM: e.egim >= 1 ? e.yokus : null,
    ROTHERMEL: roth?.deg ?? null,
    SUREKLILIK: surek,
    EKSEN: c.eksenYon,
    "SUREK+ROTH":
      surek === null
        ? roth?.deg ?? null
        : vecSum([[surek, 1], [roth?.deg ?? null, 1]])?.deg ?? null,
    ORACLE_ORT: wAvg?.deg ?? null,
  };
  return { out, wInst, e, phiW, phiS };
}

/* ── değerlendirme ── */
function ozet(vals) {
  const s = vals.filter((v) => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!s.length) return null;
  const pct = (t) => (100 * s.filter((x) => x <= t).length) / s.length;
  return {
    n: s.length,
    ort: s.reduce((a, b) => a + b, 0) / s.length,
    med: s[Math.floor(s.length / 2)],
    p45: pct(45),
    p90: pct(90),
    p135ust: 100 - pct(135),
  };
}

/** olay-bazlı bootstrap (aynı yangının vakaları bağımsız değil) */
function bootstrapMedian(rows, key, iter = 2000) {
  const byEv = new Map();
  for (const r of rows) {
    if (r.err[key] === null || !Number.isFinite(r.err[key])) continue;
    (byEv.get(r.c.ev) ?? byEv.set(r.c.ev, []).get(r.c.ev)).push(r.err[key]);
  }
  const evs = [...byEv.values()];
  if (evs.length < 5) return null;
  const meds = [];
  for (let i = 0; i < iter; i++) {
    const pool = [];
    for (let k = 0; k < evs.length; k++) pool.push(...evs[(Math.random() * evs.length) | 0]);
    pool.sort((a, b) => a - b);
    meds.push(pool[Math.floor(pool.length / 2)]);
  }
  meds.sort((a, b) => a - b);
  return [meds[Math.floor(iter * 0.025)], meds[Math.floor(iter * 0.975)]];
}

const rows = [];
for (const c of cases) {
  const p = predict(c);
  if (!p) continue;
  const gercek = c.yeniYon ?? c.centYon;
  if (gercek === null) continue;
  const err = {};
  for (const m of MODELS) err[m] = p.out[m] === null ? null : angDiff(p.out[m], gercek);
  rows.push({ c, gercek, err, w: p.wInst, e: p.e, phiW: p.phiW, phiS: p.phiS });
}

function rapor(baslik, sel) {
  const R = rows.filter(sel);
  if (R.length < 8) { process.stdout.write(`\n${baslik}: örnek yetersiz (${R.length})\n`); return; }
  const evs = new Set(R.map((r) => r.c.ev)).size;
  process.stdout.write(`\n${"═".repeat(76)}\n${baslik}  —  ${R.length} vaka / ${evs} yangın\n${"═".repeat(76)}\n`);
  process.stdout.write("model            n    ort°   medyan°   ≤45°   ≤90°   >135°   medyan %95 GA\n");
  const scored = MODELS.map((m) => [m, ozet(R.map((r) => r.err[m]))]).filter(([, s]) => s);
  scored.sort((a, b) => a[1].med - b[1].med);
  for (const [m, s] of scored) {
    const ci = bootstrapMedian(R, m);
    process.stdout.write(
      `${m.padEnd(14)}${String(s.n).padStart(4)}  ${s.ort.toFixed(1).padStart(6)}  ${s.med.toFixed(1).padStart(7)}  ` +
        `${("%" + s.p45.toFixed(0)).padStart(6)} ${("%" + s.p90.toFixed(0)).padStart(6)} ${("%" + s.p135ust.toFixed(0)).padStart(6)}   ` +
        `${ci ? `${ci[0].toFixed(0)}–${ci[1].toFixed(0)}°` : "—"}\n`
    );
  }
  process.stdout.write(`${"".padEnd(14)}      (rastgele: ort 90 · medyan 90 · ≤45° %25 · >135° %25)\n`);
}

const isForest = (r) => r.c.yakit !== "OT";
rapor("ORMAN + MAKİ (fiziksel modelin hedef kitlesi)", isForest);
rapor("  └ dik arazi (eğim ≥ %15)", (r) => isForest(r) && r.e.egim >= 15);
rapor("  └ yumuşak arazi (eğim < %15)", (r) => isForest(r) && r.e.egim < 15);
rapor("  └ rüzgâr ≥ 15 km/sa", (r) => isForest(r) && r.w.kmh >= 15);
rapor("  └ rüzgâr < 15 km/sa", (r) => isForest(r) && r.w.kmh < 15);
rapor("  └ hızlı ilerleyen (yeni alan ≥ 2 km)", (r) => isForest(r) && (r.c.yeniKm ?? 0) >= 2);
rapor("DOĞAL OTLAK / BOZKIR (OT)", (r) => !isForest(r));

/* ── eğim ile rüzgâr ne sıklıkla çatışıyor? ── */
const F = rows.filter(isForest);
const cat = F.filter((r) => angDiff(r.w.deg, r.e.yokus) > 60 && r.e.egim >= 15);
process.stdout.write(
  `\nEğim–rüzgâr çatışması (eğim ≥%15 ve aralarında >60°): ${cat.length}/${F.length} vaka\n` +
    `  bu vakalarda  rüzgâr medyan hata: ${ozet(cat.map((r) => r.err.RUZGAR_ANLIK))?.med.toFixed(1)}°` +
    ` · eğim: ${ozet(cat.map((r) => r.err.EGIM))?.med.toFixed(1)}°` +
    ` · rothermel: ${ozet(cat.map((r) => r.err.ROTHERMEL))?.med.toFixed(1)}°\n`
);
const phi = F.map((r) => r.phiS / (r.phiW + r.phiS)).sort((a, b) => a - b);
process.stdout.write(
  `Rothermel'de eğimin ağırlığı φs/(φw+φs): medyan ${(phi[Math.floor(phi.length / 2)] * 100).toFixed(0)}%` +
    ` · %90'lık ${(phi[Math.floor(phi.length * 0.9)] * 100).toFixed(0)}%\n`
);
