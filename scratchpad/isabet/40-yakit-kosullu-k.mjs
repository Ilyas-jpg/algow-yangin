/**
 * 40 — YAKIT-KOŞULLU HALKA KALİBRASYONU (Fable önerisi #2'nin kalan yarısı)
 *
 * HİPOTEZ: `headSpreadKmh` çapaları şu an YALNIZ rüzgâra bağlı. Ot/maki/orman
 * yayılma hızları kat kat farklı (literatür: ot ateşi makinin 3-10 katı).
 * Yakıt-koşullu k, aynı %90 kapsamayı daha küçük alanla verebilir.
 *
 * PROTOKOL 29 ile BİREBİR aynı — geometri, ölçüt, ülke-dışı doğrulama:
 *   k yakıt başına TÜRKİYE DIŞINDA seçilir, TÜRKİYE'de sınanır.
 *   Ölçüm `headSpreadKmh`'in GERÇEK ÇAĞRI BİÇİMİYLE (saat saat) yapılır —
 *   §7.6 dersi: aynı formül farklı zaman ölçeğinde işaretini bile değiştirdi.
 *
 * 🔴 BEKLENTİ DÜŞÜK TUTULUYOR: §7.6'da üç kaldıraç denendi (rüzgâra bağlı k,
 * yeniden başlatma, büyüme modeliyle kısıtlama), her biri ~%3 verdi ve
 * TOPLANMADILAR — hepsi aynı fazlalığı kırpıyor, tavan ~%6. Bu dördüncü
 * kaldıraç da aynı fazlalığı kırpıyorsa kazanç yok demektir.
 *
 * Koşum: node scratchpad/isabet/40-yakit-kosullu-k.mjs
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
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

const ROS_ANCHORS = [[4, 0.26], [11, 0.44], [18, 0.47], [26, 0.83], [45, 1.3]];
const K_YAYIN = 1.5;
const SHAPE_ZAYIF = [[0, 1.0], [30, 0.95], [60, 0.92], [90, 0.88], [120, 0.84], [150, 0.82], [180, 0.8]];
const SHAPE_GUCLU = [[0, 1.0], [30, 0.94], [60, 0.88], [90, 0.82], [120, 0.24], [150, 0.17], [180, 0.16]];
function reachRatio(off, kmh) {
  const a = Math.min(180, Math.abs(off));
  const z = interp(a, SHAPE_ZAYIF);
  const g = interp(a, SHAPE_GUCLU);
  const t = Math.max(0, Math.min(1, (kmh - 8) / (15 - 8)));
  return z + (g - z) * t;
}
/* 🔑 src/lib/wind.ts `FUELS` + `fuelParams` ile BİREBİR — 29 ve bu betiğin ilk
 * sürümü OT'yi tablosuna almamıştı ve sessizce MAKİ'ye düşüyordu, yani üretimin
 * yapmadığı bir şeyi ölçüyordu. §7.6 dersi: ölçtüğün şey gönderdiğin olmalı. */
const FUEL = {
  ORMAN: { sigma: 1500, beta: 0.03, waf: 0.15 },
  MAKI: { sigma: 1800, beta: 0.012, waf: 0.3 },
  OT: { sigma: 3500, beta: 0.0015, waf: 0.4 },
};
const yakitParam = (f) => (f === "ORMAN" ? FUEL.ORMAN : f === "OT" || f === "TARIM" ? FUEL.OT : FUEL.MAKI);
function rothermelDir(fuel, kmh, deg, slopePct, upslope) {
  const { sigma, beta, waf } = yakitParam(fuel);
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

const clc = JSON.parse(readFileSync(here("clc-all.json"), "utf8"));
const wind = JSON.parse(readFileSync(here("akdeniz-ruzgar.json"), "utf8"));
const elev = JSON.parse(readFileSync(here("akdeniz-egim.json"), "utf8"));
const ckey = (c) => `${(Math.round(c.lat * 100) / 100).toFixed(2)},${(Math.round(c.lon * 100) / 100).toFixed(2)}`;
const wkey = (c) => `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
const gap = (a, b) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

const hepsi = [];
for (const f of readdirSync(here(".")).filter((f) => /^vaka-akdeniz-\d{4}\.json$/.test(f)).sort())
  hepsi.push(...JSON.parse(readFileSync(here(f), "utf8")));

/* ── ÖNCE: hangi yakıtlar ÖLÇÜLEBİLİR? ────────────────────────────────────
 * 26-akdeniz-cevre.mjs çevre verisini yalnız ORMAN+MAKİ havuzu için çekti.
 * Fable'ın hipotezi tam da OT hakkında — önce OT'nin sınanabilir olup
 * olmadığına bakılmalı, yoksa cevaplanamayan soruyu cevaplamış gibi yaparız. */
const sayim = {};
for (const c of hepsi) {
  if (ORTADOGU.has(c.bolge) || !c.hucreler.length) continue;
  const y = yakitOf(clc[ckey(c)]) ?? "YOK";
  sayim[y] ??= { toplam: 0, cevreli: 0 };
  sayim[y].toplam++;
  if (wind[wkey(c)] && elev[ekey(c)]) sayim[y].cevreli++;
}
console.log("YAKIT SINIFI · toplam vaka · çevre verisi OLAN (ölçülebilir)");
for (const [y, s] of Object.entries(sayim).sort((a, b) => b[1].toplam - a[1].toplam))
  console.log(`  ${y.padEnd(12)} ${String(s.toplam).padStart(6)}  ${String(s.cevreli).padStart(6)}`);

/* ── Ölçülebilir havuz ─────────────────────────────────────────────────── */
function reachSaatlik(c, kFn) {
  const w = wind[wkey(c)];
  const e = elev[ekey(c)];
  if (!w || !e) return null;
  const i0 = Math.round((c.t0 - w.t0) / 3600_000);
  const saat = Math.max(1, Math.round(c.hours));
  let km = 0, x = 0, y = 0, n = 0;
  for (let i = 0; i < saat; i++) {
    const s = w.spd[i0 + i], d = w.dir[i0 + i];
    if (typeof s !== "number" || typeof d !== "number") continue;
    km += kFn(s) * interp(s, ROS_ANCHORS); // ← üretimdeki birebir çağrı biçimi
    const to = (d + 180) % 360;
    x += s * Math.sin(toRad(to));
    y += s * Math.cos(toRad(to));
    n++;
  }
  if (!n) return null;
  const wDeg = (toDeg(Math.atan2(x, y)) + 360) % 360;
  const wKmh = Math.hypot(x, y) / n;
  return { km, kmh: wKmh, dir: rothermelDir(yakitOf(clc[ckey(c)]), wKmh, wDeg, e.egim, e.yokus) };
}
function sekilAlani(kmh) {
  let a = 0;
  for (let i = 0; i < 360; i++) {
    const off = Math.min(180, Math.abs(((i + 180) % 360) - 180));
    const r = reachRatio(off, kmh);
    a += 0.5 * r * r * ((2 * Math.PI) / 360);
  }
  return a;
}

/* OT çevre verisi 2026-08-06'da çekildi (26'ya YAKITLAR parametresi eklendi),
 * o yüzden Fable'ın ASIL iddiası (ot ateşi makiden 3-10× hızlı) artık sınanabilir. */
const YAKITLAR = ["ORMAN", "MAKI", "OT"];
const rows = [];
for (const c of hepsi) {
  if (ORTADOGU.has(c.bolge) || !c.hucreler.length) continue;
  const y = yakitOf(clc[ckey(c)]);
  if (!YAKITLAR.includes(y)) continue;
  if (!reachSaatlik(c, () => 1)) continue;
  rows.push({ c, yakit: y, tr: c.bolge === "Türkiye" });
}
const TR = rows.filter((r) => r.tr);
const DIS = rows.filter((r) => !r.tr);
console.log(
  `\nÖlçülebilir havuz: ${rows.length} vaka (Türkiye ${TR.length} · dış ${DIS.length})\n  ` +
    YAKITLAR.map((y) => `${y} ${rows.filter((r) => r.yakit === y).length}`).join(" · ")
);

function degerlendir(set, kFn) {
  let ok = 0, n = 0, alan = 0;
  for (const r of set) {
    const rr = reachSaatlik(r.c, kFn(r));
    if (!rr) continue;
    alan += rr.km * rr.km * sekilAlani(rr.kmh);
    for (const [brg, km] of r.c.hucreler) {
      if (km <= rr.km * reachRatio(gap(rr.dir, brg), rr.kmh)) ok++;
      n++;
    }
  }
  return { kaps: ok / n, alan, n };
}
const K_GRID = [];
for (let k = 0.5; k <= 20; k += 0.25) K_GRID.push(+k.toFixed(2));
function kIcin(set, hedef = 0.9) {
  let best = K_YAYIN, bestD = Infinity;
  for (const k of K_GRID) {
    const d = Math.abs(degerlendir(set, () => () => k).kaps - hedef);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

/* ── A) Yakıt başına gerekli k (örneklem içi, yalnız tanı) ──────────────── */
console.log(`\n${"═".repeat(70)}\nA) YAKIT BAŞINA %90 İÇİN GEREKEN k (örneklem içi — tanı amaçlı)\n${"═".repeat(70)}`);
for (const y of YAKITLAR) {
  const s = rows.filter((r) => r.yakit === y);
  const k = kIcin(s);
  const c = degerlendir(s, () => () => K_YAYIN);
  console.log(`  ${y.padEnd(6)} n=${String(s.length).padStart(5)}  %90 için k=${String(k).padStart(5)}  ·  yayın k=1.5'te kapsama %${(100 * c.kaps).toFixed(1)}`);
}

/* ── B) ÜLKE-DIŞI DOĞRULAMA — asıl sınav ───────────────────────────────── */
console.log(`\n${"═".repeat(70)}\nB) ÜLKE-DIŞI: k yakıt başına DIŞTA seçilir, TÜRKİYE'de sınanır\n${"═".repeat(70)}`);
const kDis = {};
for (const y of YAKITLAR) {
  const s = DIS.filter((r) => r.yakit === y);
  kDis[y] = s.length < 40 ? K_YAYIN : kIcin(s);
}
console.log(
  "  " +
    YAKITLAR.map(
      (y) =>
        `${y} k=${kDis[y]} (dış n=${DIS.filter((r) => r.yakit === y).length}, TR n=${TR.filter((r) => r.yakit === y).length})`
    ).join(" · ")
);

const taban = degerlendir(TR, () => () => K_YAYIN);
const yakitli = degerlendir(TR, (r) => () => kDis[r.yakit]);
console.log(
  `\nTÜRKİYE'DE (n=${TR.length} vaka / ${taban.n} hücre)\n` +
    `  sabit k=1,5 (yayın)      kapsama %${(100 * taban.kaps).toFixed(1)} · alan ${taban.alan.toFixed(0)}\n` +
    `  YAKIT-KOŞULLU k          kapsama %${(100 * yakitli.kaps).toFixed(1)} · alan ${yakitli.alan.toFixed(0)} ` +
    `(${(100 * (1 - yakitli.alan / taban.alan)) >= 0 ? "−" : "+"}%${Math.abs(100 * (1 - yakitli.alan / taban.alan)).toFixed(1)})`
);
console.log(
  yakitli.kaps >= taban.kaps - 0.01 && yakitli.alan < taban.alan * 0.97
    ? "  ✅ Kapsama korunuyor VE alan anlamlı düşüyor."
    : "  🔴 Kazanç yok ya da kapsama satın alınmış — üretime ÖNERİLMEZ."
);

/* ── C) Yakıt × rüzgâr birlikte (§7.6'nın kaldıracıyla toplanıyor mu) ──── */
console.log(`\n${"═".repeat(70)}\nC) YAKIT + RÜZGÂR birlikte — kaldıraçlar toplanıyor mu?\n${"═".repeat(70)}`);
const RUZ_KENAR = [0, 6, 10, 14, 18, 200];
const kovaOf = (kmh) => {
  for (let i = 0; i < RUZ_KENAR.length - 1; i++) if (kmh >= RUZ_KENAR[i] && kmh < RUZ_KENAR[i + 1]) return i;
  return RUZ_KENAR.length - 2;
};
for (const r of rows) r.kova = kovaOf(reachSaatlik(r.c, () => 1).kmh);
const kKovaDis = [];
for (let i = 0; i < RUZ_KENAR.length - 1; i++) {
  const s = DIS.filter((r) => r.kova === i);
  kKovaDis.push(s.length < 40 ? K_YAYIN : kIcin(s));
}
const kIkiliDis = {};
for (const y of YAKITLAR)
  for (let i = 0; i < RUZ_KENAR.length - 1; i++) {
    const s = DIS.filter((r) => r.yakit === y && r.kova === i);
    kIkiliDis[`${y}|${i}`] = s.length < 40 ? (kKovaDis[i] ?? K_YAYIN) : kIcin(s);
  }
const sadeceRuzgar = degerlendir(TR, (r) => () => kKovaDis[r.kova]);
const ikisi = degerlendir(TR, (r) => () => kIkiliDis[`${r.yakit}|${r.kova}`]);
const yuzde = (a) => `${(100 * (1 - a / taban.alan)) >= 0 ? "−" : "+"}%${Math.abs(100 * (1 - a / taban.alan)).toFixed(1)}`;
console.log(`  yalnız rüzgâra bağlı k   kapsama %${(100 * sadeceRuzgar.kaps).toFixed(1)} · alan ${yuzde(sadeceRuzgar.alan)}`);
console.log(`  yalnız yakıta bağlı k    kapsama %${(100 * yakitli.kaps).toFixed(1)} · alan ${yuzde(yakitli.alan)}`);
console.log(`  İKİSİ BİRDEN             kapsama %${(100 * ikisi.kaps).toFixed(1)} · alan ${yuzde(ikisi.alan)}`);
console.log("\n→ İkisi birden ≈ tek tek toplamı ise bağımsız bilgi taşıyorlar; değilse aynı fazlalığı kırpıyorlar (§7.6 tavanı).");
