/**
 * 19 — RÜZGÂRA BAĞLI ŞEKLİN KAPSAMA SINAMASI (§6.4'ün kapısı)
 *
 * 18-sekil2.mjs şekli rüzgâra bağladı (baş/geri: zayıfta 1,2× → güçlüde 5,5×).
 * Ama yayındaki "%90'lık erişim" iddiası ESKİ şekille kalibre edildi. Şekli
 * değiştirip kalibrasyonu yenilememek, iddiayı sessizce yanlışlamak olur —
 * 08-kapsama.mjs'in bütün dersi buydu.
 *
 * Burada kapsama HÜCRE bazında ölçülüyor: "yangının ilerlediği TÜM yeni
 * hücreler çizilen şeklin içinde mi?" Bu, kullanıcının şekli okuduğu biçim
 * ("yangın bunu aşmaz") ve yeni şeklin türetildiği ölçütle aynı cetvel.
 *
 * ⚠️ Geometrik yaklaşım (08 ile aynı): hücre taşması EN YAKIN yanmış hücreden
 * ölçülür, çizilen şekil ise öncü kenara çapalanır. İkisi aynı büyüklüğün
 * (ayak izinin dışına taşma) iki ölçümü; tam aynı nokta değil.
 */
import { readFileSync } from "node:fs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

function interp(x, pts) {
  if (x <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

/* ── ÜRÜNDEKİ ham çapalar (k ile ölçeklenir; yayında k=1,5 gömülü) ── */
const ROS_ANCHORS = [[4, 0.26], [11, 0.44], [18, 0.47], [26, 0.83], [45, 1.3]];
const headSpreadKmh = (w, k = 1) => k * interp(w, ROS_ANCHORS);

/* ── ESKİ tek şekil (yayında) ── */
const SHAPE_ESKI = [[0, 1.0], [30, 0.97], [60, 0.8], [90, 0.69], [120, 0.55], [150, 0.43], [180, 0.42]];

/* ── YENİ rüzgâra bağlı şekil (18-sekil2 ölçümünden, monoton düzleştirilmiş) ──
   zayıf (≤8 km/sa): baş/geri ≈1,2× — ölçülen 1,19 (GA 0,93–1,88)
   güçlü (≥15):      baş/geri ≈4,9× — ölçülen 5,50 (GA 2,66–7,15) */
const SHAPE_ZAYIF = [[0, 1.0], [30, 0.95], [60, 0.92], [90, 0.88], [120, 0.84], [150, 0.82], [180, 0.8]];
const SHAPE_GUCLU = [[0, 1.0], [30, 0.94], [60, 0.88], [90, 0.82], [120, 0.24], [150, 0.17], [180, 0.16]];
const ZAYIF_KMH = 8;
const GUCLU_KMH = 15;

function reachRatioYeni(off, kmh) {
  const a = Math.min(180, Math.abs(off));
  const z = interp(a, SHAPE_ZAYIF);
  const g = interp(a, SHAPE_GUCLU);
  const t = Math.max(0, Math.min(1, (kmh - ZAYIF_KMH) / (GUCLU_KMH - ZAYIF_KMH)));
  return z + (g - z) * t;
}
const reachRatioEski = (off) => interp(Math.min(180, Math.abs(off)), SHAPE_ESKI);

const FUEL = {
  ORMAN: { sigma: 1500, beta: 0.03, waf: 0.15 },
  MAKI: { sigma: 1800, beta: 0.012, waf: 0.3 },
  OT: { sigma: 3500, beta: 0.0015, waf: 0.4 },
};
function rothermelDir(fuel, kmh, deg, slopePct, upslope) {
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

const cases = JSON.parse(readFileSync(here("cases-cephe.json"), "utf8"));
const wind = JSON.parse(readFileSync(here("wind-w.json"), "utf8"));
const elev = JSON.parse(readFileSync(here("elev-srtm.json"), "utf8"));
const wkey = (c) =>
  `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
const gap = (a, b) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

/** Vaka süresince saat saat integre edilmiş baş erişimi + tahmin yönü (ürün mantığı) */
function reachFor(c, k) {
  const w = wind[wkey(c)];
  const e = elev[ekey(c)];
  if (!w || !e) return null;
  const i0 = Math.round((c.t0 - w.t0) / 3600_000);
  const saat = Math.max(1, Math.round(c.hours));
  let km = 0;
  let x = 0;
  let y = 0;
  let n = 0;
  for (let i = 0; i < saat; i++) {
    const s = w.spd[i0 + i];
    const d = w.dir[i0 + i];
    if (typeof s !== "number" || typeof d !== "number") continue;
    km += headSpreadKmh(s, k);
    const to = (d + 180) % 360;
    x += s * Math.sin(toRad(to));
    y += s * Math.cos(toRad(to));
    n++;
  }
  if (!n) return null;
  const wDeg = (toDeg(Math.atan2(x, y)) + 360) % 360;
  const wKmh = Math.hypot(x, y) / n;
  return { km, kmh: wKmh, dir: rothermelDir(c.yakit, wKmh, wDeg, e.egim, e.yokus) };
}

const rows = [];
for (const c of cases) {
  if (!["ORMAN", "MAKI", "OT"].includes(c.yakit)) continue;
  if (!c.hucreler.length) continue;
  const r = reachFor(c, 1);
  if (!r) continue;
  rows.push({ c, yil: new Date(c.t0).getUTCFullYear() });
}
process.stdout.write(`${rows.length} vaka · ${rows.reduce((s, r) => s + r.c.hucreler.length, 0)} hücre\n`);

/**
 * Kapsama: k ölçekli şekil, vakanın TÜM yeni hücrelerini içeriyor mu?
 * (en zorlayıcı ölçüt — kullanıcının okuduğu "yangın bunu aşmaz")
 */
function kapsama(set, k, yeni) {
  let okVaka = 0;
  let nVaka = 0;
  let okHucre = 0;
  let nHucre = 0;
  for (const r of set) {
    const rr = reachFor(r.c, k);
    if (!rr) continue;
    let hepsi = true;
    for (const [brg, km] of r.c.hucreler) {
      const off = gap(rr.dir, brg);
      const sinir = rr.km * (yeni ? reachRatioYeni(off, rr.kmh) : reachRatioEski(off));
      if (km <= sinir) okHucre++;
      else hepsi = false;
      nHucre++;
    }
    if (hepsi) okVaka++;
    nVaka++;
  }
  return { vaka: okVaka / nVaka, hucre: okHucre / nHucre, nVaka, nHucre };
}

/** Şeklin ALANI (göreli) — aynı kapsamada küçük alan = keskin tahmin */
function alan(yeni, kmh, km = 1) {
  let a = 0;
  const N = 360;
  for (let i = 0; i < N; i++) {
    const off = Math.min(180, Math.abs(((i + 180) % 360) - 180));
    const r = km * (yeni ? reachRatioYeni(off, kmh) : reachRatioEski(off));
    a += 0.5 * r * r * ((2 * Math.PI) / N);
  }
  return a;
}

process.stdout.write(`\n${"═".repeat(74)}\nA) AYNI k=1,5 (yayındaki ayar) — eski şekil vs yeni şekil\n${"═".repeat(74)}\n`);
process.stdout.write("şekil        vaka kapsaması   hücre kapsaması\n");
for (const [ad, yeni] of [["ESKİ", false], ["YENİ", true]]) {
  const c = kapsama(rows, 1.5, yeni);
  process.stdout.write(
    `${ad.padEnd(12)}${("%" + (100 * c.vaka).toFixed(0)).padStart(10)}${("%" + (100 * c.hucre).toFixed(1)).padStart(18)}\n`
  );
}

process.stdout.write(`\n${"═".repeat(74)}\nB) SEZON-DIŞI KALİBRASYON (k, eğitim sezonlarında %90 hücre kapsaması)\n${"═".repeat(74)}\n`);
const K_GRID = [];
for (let k = 0.5; k <= 14; k += 0.25) K_GRID.push(+k.toFixed(2));
const yillar = [...new Set(rows.map((r) => r.yil))].sort();
for (const [ad, yeni] of [["ESKİ", false], ["YENİ", true]]) {
  const test = [];
  const ks = [];
  for (const y of yillar) {
    const te = rows.filter((r) => r.yil === y);
    const tr = rows.filter((r) => r.yil !== y);
    if (te.length < 8) continue;
    let bestK = 1;
    let bestD = Infinity;
    for (const k of K_GRID) {
      const d = Math.abs(kapsama(tr, k, yeni).hucre - 0.9);
      if (d < bestD) {
        bestD = d;
        bestK = k;
      }
    }
    ks.push(`${y}:${bestK}`);
    test.push(kapsama(te, bestK, yeni).hucre);
  }
  process.stdout.write(
    `${ad}: seçilen k → ${ks.join(" ")}\n     sezon-dışı hücre kapsaması ort. %${((100 * test.reduce((a, b) => a + b, 0)) / test.length).toFixed(0)} ` +
      `(sezonlar: ${test.map((t) => "%" + (100 * t).toFixed(0)).join(" ")})\n`
  );
}

process.stdout.write(`\n${"═".repeat(74)}\nC) %90 HÜCRE KAPSAMASI İÇİN GEREKEN k + ŞEKLİN ALANI\n${"═".repeat(74)}\n`);
for (const [ad, yeni] of [["ESKİ", false], ["YENİ", true]]) {
  let bestK = 1;
  let bestD = Infinity;
  for (const k of K_GRID) {
    const d = Math.abs(kapsama(rows, k, yeni).hucre - 0.9);
    if (d < bestD) {
      bestD = d;
      bestK = k;
    }
  }
  const c = kapsama(rows, bestK, yeni);
  // aynı kapsamada alan kıyası: k × şekil alanı (rüzgâr 5 / 12 / 20 km/sa'te)
  const alanlar = [5, 12, 20].map((w) => (bestK * headSpreadKmh(w, 1)) ** 2 * alan(yeni, w)).map((a) => a.toFixed(3));
  process.stdout.write(
    `${ad}: k=${bestK} → hücre %${(100 * c.hucre).toFixed(0)} · vaka %${(100 * c.vaka).toFixed(0)}\n` +
      `     çapalar: ${ROS_ANCHORS.map(([w, r]) => `${w}→${(r * bestK).toFixed(2)}`).join(" · ")}\n` +
      `     3 sa şekil alanı (rüzgâr 5/12/20 km/sa, km²): ${alanlar.join(" · ")}\n`
  );
}
