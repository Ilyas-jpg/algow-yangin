/**
 * 08 — YAYINLADIĞIMIZ İDDİANIN SEZON-DIŞI SINAMASI.
 *
 * Sitede yazıyor: "Halkalar %90'lık erişim: ölçtüğümüz yangınların onda dokuzu
 * bu sınır içinde kaldı." Ama eşik, ölçtüğüm AYNI veriyle kalibre edildi —
 * bu haliyle iddia kendi kendini doğruluyor.
 *
 * Burada her sezon sırayla dışarıda bırakılır (leave-one-season-out):
 * kalibrasyon diğer sezonlarla yapılır, KAPSAMA dışarıda bırakılan sezonda
 * ölçülür. Ayrıca kullanıcının şekli nasıl okuduğu esas alınır:
 *   "yangının EN UZAĞA ilerleyen pikseli çizdiğimiz şeklin içinde mi?"
 * — merkez değil, uç. Çizilen şey damla olduğu için yarıçap yöne bağlı:
 *   r(θ) = R_bas × reachRatio(θ)
 */
import { readFileSync } from "node:fs";
const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/* ── ÜRÜNDE ÇALIŞAN FONKSİYONLARIN BİREBİR KOPYASI (src/lib/wind.ts) ── */
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
const ROS_ANCHORS = [[4, 0.26], [11, 0.44], [18, 0.47], [26, 0.83], [45, 1.3]];
const SHAPE_ANCHORS = [[0, 1.0], [30, 0.97], [60, 0.8], [90, 0.69], [120, 0.55], [150, 0.43], [180, 0.42]];
const headSpreadKmh = (w, k = 1) => k * interp(w, ROS_ANCHORS);
const reachRatio = (off) => interp(Math.min(180, Math.abs(off)), SHAPE_ANCHORS);

const FUEL = { ORMAN: { sigma: 1500, beta: 0.03, waf: 0.15 }, MAKI: { sigma: 1800, beta: 0.012, waf: 0.3 }, OT: { sigma: 3500, beta: 0.0015, waf: 0.4 } };
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

/* ── veri ── */
const cases = JSON.parse(readFileSync(here("cases-wild.json"), "utf8"));
const wind = JSON.parse(readFileSync(here("wind-w.json"), "utf8"));
const elev = JSON.parse(readFileSync(here("elev-srtm.json"), "utf8"));
const wkey = (c) => `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
const gap = (a, b) => { const d = Math.abs(((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; };

/** Vakanın süresi boyunca saat saat integre edilmiş baş erişimi (ürünle aynı mantık) */
function reachFor(c, k) {
  const w = wind[wkey(c)];
  const e = elev[ekey(c)];
  if (!w || !e) return null;
  const i0 = Math.round((c.t0 - w.t0) / 3600_000);
  const saat = Math.max(1, Math.round(c.hours));
  let km = 0, x = 0, y = 0, n = 0;
  for (let i = 0; i < saat; i++) {
    const s = w.spd[i0 + i], d = w.dir[i0 + i];
    if (typeof s !== "number" || typeof d !== "number") continue;
    km += headSpreadKmh(s, k);
    const to = (d + 180) % 360;
    x += s * Math.sin(toRad(to)); y += s * Math.cos(toRad(to)); n++;
  }
  if (!n) return null;
  const wDeg = (toDeg(Math.atan2(x, y)) + 360) % 360;
  const wKmh = Math.hypot(x, y) / n;
  const dir = rothermelDir(c.yakit, wKmh, wDeg, e.egim, e.yokus);
  return { km, dir };
}

const rows = [];
for (const c of cases) {
  if (c.ilerMax === null || c.ilerMax === undefined) continue;
  const r = reachFor(c, 1);
  if (!r) continue;
  // Gözlenen ucun yönü yoksa (ilerleme yok) yön sapması 0 kabul edilir:
  // ilerleme 0 zaten her şeklin içindedir.
  const off = c.basYon === null || c.basYon === undefined ? 0 : gap(r.dir, c.basYon);
  rows.push({ c, yil: new Date(c.t0).getUTCFullYear(), off, gozlenen: c.ilerMax, ortanca: c.iler50 ?? 0 });
}
process.stdout.write(`${rows.length} vaka sınanabiliyor\n`);

/** k ile ölçeklenmiş şeklin, gözlenen ucu kapsama oranı */
function kapsama(set, k, alan = "gozlenen") {
  let ok = 0, n = 0;
  for (const r of set) {
    const rr = reachFor(r.c, k);
    if (!rr) continue;
    const sinir = rr.km * reachRatio(r.off);
    if (r[alan] <= sinir) ok++;
    n++;
  }
  return n ? { oran: ok / n, n } : null;
}

const yillar = [...new Set(rows.map((r) => r.yil))].sort();
process.stdout.write(`sezonlar: ${yillar.join(", ")}\n\n`);

process.stdout.write("═".repeat(72) + "\n");
process.stdout.write("A) ŞU AN YAYINDA OLAN AYARLA (k=1) KAPSAMA\n");
process.stdout.write("   iddia: \"onda dokuzu bu sınır içinde kaldı\" → %90 beklenir\n");
process.stdout.write("═".repeat(72) + "\n");
process.stdout.write("sezon    n    EN UZAK piksel içeride   ortanca piksel içeride\n");
for (const y of yillar) {
  const s = rows.filter((r) => r.yil === y);
  if (s.length < 10) continue;
  const a = kapsama(s, 1, "gozlenen");
  const b = kapsama(s, 1, "ortanca");
  process.stdout.write(
    `${String(y).padEnd(8)}${String(a.n).padStart(3)}   ${("%" + (100 * a.oran).toFixed(0)).padStart(18)}   ${("%" + (100 * b.oran).toFixed(0)).padStart(20)}\n`
  );
}
const tumA = kapsama(rows, 1, "gozlenen"), tumB = kapsama(rows, 1, "ortanca");
process.stdout.write(
  `${"TÜMÜ".padEnd(8)}${String(tumA.n).padStart(3)}   ${("%" + (100 * tumA.oran).toFixed(0)).padStart(18)}   ${("%" + (100 * tumB.oran).toFixed(0)).padStart(20)}\n`
);

process.stdout.write("\n" + "═".repeat(72) + "\n");
process.stdout.write("B) SEZON-DIŞI SINAMA (leave-one-season-out)\n");
process.stdout.write("   k, diğer sezonlarda %90 kapsama verecek şekilde seçilir;\n");
process.stdout.write("   sonra DIŞARIDA BIRAKILAN sezonda ölçülür.\n");
process.stdout.write("═".repeat(72) + "\n");
process.stdout.write("dışarıda   eğitimde seçilen k   test sezonunda kapsama\n");
const K_GRID = [];
for (let k = 0.5; k <= 12; k += 0.25) K_GRID.push(+k.toFixed(2));
const testOranlar = [];
for (const y of yillar) {
  const test = rows.filter((r) => r.yil === y);
  const train = rows.filter((r) => r.yil !== y);
  if (test.length < 10) continue;
  let bestK = 1, bestD = Infinity;
  for (const k of K_GRID) {
    const c = kapsama(train, k, "gozlenen");
    const d = Math.abs(c.oran - 0.9);
    if (d < bestD) { bestD = d; bestK = k; }
  }
  const t = kapsama(test, bestK, "gozlenen");
  testOranlar.push(t.oran);
  process.stdout.write(
    `${String(y).padEnd(11)}${String(bestK).padStart(10)}          ${("%" + (100 * t.oran).toFixed(0)).padStart(8)}  (n=${t.n})\n`
  );
}
const ort = testOranlar.reduce((a, b) => a + b, 0) / testOranlar.length;
process.stdout.write(`\n→ sezon-dışı ortalama kapsama: %${(100 * ort).toFixed(0)}\n`);

process.stdout.write("\n" + "═".repeat(72) + "\n");
process.stdout.write("C) TÜM VERİYLE %90 İÇİN GEREKEN ÖLÇEK\n");
process.stdout.write("═".repeat(72) + "\n");
for (const hedef of [0.8, 0.9, 0.95]) {
  let bestK = 1, bestD = Infinity;
  for (const k of K_GRID) {
    const c = kapsama(rows, k, "gozlenen");
    const d = Math.abs(c.oran - hedef);
    if (d < bestD) { bestD = d; bestK = k; }
  }
  const c = kapsama(rows, bestK, "gozlenen");
  const anchors = ROS_ANCHORS.map(([w, r]) => `${w}→${(r * bestK).toFixed(2)}`).join(" · ");
  process.stdout.write(
    `hedef %${(100 * hedef).toFixed(0)}: k=${bestK} (gerçekleşen %${(100 * c.oran).toFixed(0)})\n  yeni çapa: ${anchors}\n`
  );
}
