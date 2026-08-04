/**
 * 06 — Koninin ÖLÇÜLMEMİŞ yarısı: yarıçap (yayılma hızı) ve yarım açı.
 *
 * Ürünün mevcut değerleri uydurma:
 *   headSpreadKmh: <10 km/sa → 0,7 · 10-30 → 1-3 · 30-50 → 3-6 · >50 → 6-10
 *   coneHalfAngle: 30° − (rüzgâr/50)·15°
 * Hiçbiri veriye dayanmıyor. Burada gerçek veriyle ölçülüp değiştiriliyor.
 *
 * İLERLEME = yangının o anki ayak izinin dışına taşınan mesafe (km) — koni
 * halkasının yarıçapının tam karşılığı. İlerlemeyen vakalar (0) DAHİL.
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

function windAt(c) {
  const w = wind[wkey(c)];
  if (!w) return null;
  const i0 = Math.round((c.t0 - w.t0) / 3600_000);
  const i1 = Math.round((c.t1 - w.t0) / 3600_000);
  let x = 0, y = 0, n = 0, sp = 0;
  for (let i = Math.max(0, i0); i <= Math.min(w.spd.length - 1, i1); i++) {
    const s = w.spd[i], d = w.dir[i];
    if (typeof s !== "number" || typeof d !== "number") continue;
    const to = (d + 180) % 360;
    x += s * Math.sin(toRad(to)); y += s * Math.cos(toRad(to)); sp += s; n++;
  }
  if (!n) return null;
  return { deg: (toDeg(Math.atan2(x, y)) + 360) % 360, kmh: sp / n };
}

const rows = [];
for (const c of cases) {
  const w = windAt(c);
  const e = elev[ekey(c)];
  if (!w || !e || c.iler90 === null || c.iler90 === undefined) continue;
  rows.push({ c, w, e, iler: c.iler90, ilerMax: c.ilerMax, h: c.hours });
}
process.stdout.write(`${rows.length}/${cases.length} vaka analiz edilebiliyor (rüzgâr+eğim eşleşti)\n\n`);

const pct = (arr, p) => {
  const s = arr.slice().sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null;
};

/* ═══ 1. İlerleme zamanla doğrusal mı? ═══ */
process.stdout.write("═".repeat(74) + "\n1) İLERLEME ZAMANLA NASIL BÜYÜYOR?  (ürün doğrusal varsayıyor: hız × saat)\n" + "═".repeat(74) + "\n");
process.stdout.write("saat aralığı      n   ortanca km   %80 km   %90 km   ortanca km/sa\n");
const HBINS = [[0.5, 2], [2, 4], [4, 7], [7, 10], [10, 14]];
const noktalar = [];
for (const [a, b] of HBINS) {
  const R = rows.filter((r) => r.h >= a && r.h < b);
  if (R.length < 15) continue;
  const il = R.map((r) => r.iler);
  const hOrt = R.reduce((s, r) => s + r.h, 0) / R.length;
  const med = pct(il, 0.5);
  noktalar.push([hOrt, med, pct(il, 0.8), pct(il, 0.9)]);
  process.stdout.write(
    `${(a + "–" + b + " sa").padEnd(14)}${String(R.length).padStart(4)}   ` +
      `${med.toFixed(2).padStart(9)}  ${pct(il, 0.8).toFixed(2).padStart(7)}  ${pct(il, 0.9).toFixed(2).padStart(7)}   ` +
      `${(med / hOrt).toFixed(2).padStart(12)}\n`
  );
}
// log-log eğim: 1 ise doğrusal, <1 ise sönümlenen büyüme
if (noktalar.length >= 3) {
  const xs = noktalar.map((p) => Math.log(p[0])), ys = noktalar.map((p) => Math.log(Math.max(0.01, p[1])));
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  process.stdout.write(`\n→ log-log eğim = ${(num / den).toFixed(2)}  (1,0 = doğrusal · <1 = zamanla yavaşlıyor)\n`);
  process.stdout.write(`  Ortanca hız ${(noktalar[0][1] / noktalar[0][0]).toFixed(2)} km/sa'ten ` +
    `${(noktalar.at(-1)[1] / noktalar.at(-1)[0]).toFixed(2)} km/sa'e düşüyor.\n`);
}

/* ═══ 2. Mevcut heuristik ne diyor, gerçek ne? ═══ */
function headSpreadKmh(windKmh) {
  if (windKmh < 10) return 0.7 + (windKmh / 10) * 0.3;
  if (windKmh < 30) return 1 + ((windKmh - 10) / 20) * 2;
  if (windKmh < 50) return 3 + ((windKmh - 30) / 20) * 3;
  return Math.min(10, 6 + ((windKmh - 50) / 30) * 4);
}
process.stdout.write("\n" + "═".repeat(74) + "\n2) RÜZGÂRA GÖRE GERÇEK İLERLEME  (3 saatlik pencereye normalize: km/3sa)\n" + "═".repeat(74) + "\n");
process.stdout.write("rüzgâr        n   ortanca  %80   %90   |  ÜRÜNÜN 3sa HALKASI   fark\n");
const WBINS = [[0, 8], [8, 15], [15, 22], [22, 30], [30, 100]];
for (const [a, b] of WBINS) {
  const R = rows.filter((r) => r.w.kmh >= a && r.w.kmh < b);
  if (R.length < 15) continue;
  // her vakayı 3 saate ölçekle: gözlenen ilerleme × (3/saat)^eğim yerine
  // doğrudan 2–4 saatlik vakalar + tümünün saatlik oranı ile karşılaştır
  const per3 = R.map((r) => r.iler * (3 / r.h));
  const wOrt = R.reduce((s, r) => s + r.w.kmh, 0) / R.length;
  const urun = headSpreadKmh(wOrt) * 3;
  const med = pct(per3, 0.5);
  process.stdout.write(
    `${(a + "–" + b + " km/sa").padEnd(13)}${String(R.length).padStart(3)}  ${med.toFixed(2).padStart(7)}  ` +
      `${pct(per3, 0.8).toFixed(2).padStart(4)}  ${pct(per3, 0.9).toFixed(2).padStart(4)}  |  ` +
      `${urun.toFixed(1).padStart(10)} km    ${(urun / Math.max(0.01, med)).toFixed(1)}×\n`
  );
}

/* ═══ 3. Yakıt ve eğime göre ═══ */
process.stdout.write("\n" + "═".repeat(74) + "\n3) YAKIT VE EĞİME GÖRE İLERLEME (km/3sa)\n" + "═".repeat(74) + "\n");
for (const [ad, sel] of [
  ["ORMAN", (r) => r.c.yakit === "ORMAN"],
  ["MAKİ", (r) => r.c.yakit === "MAKI"],
  ["OT/BOZKIR", (r) => r.c.yakit === "OT"],
  ["eğim < %10", (r) => r.e.egim < 10],
  ["eğim %10–20", (r) => r.e.egim >= 10 && r.e.egim < 20],
  ["eğim ≥ %20", (r) => r.e.egim >= 20],
]) {
  const R = rows.filter(sel);
  if (R.length < 12) { process.stdout.write(`${ad.padEnd(14)} yetersiz (${R.length})\n`); continue; }
  const per3 = R.map((r) => r.iler * (3 / r.h));
  process.stdout.write(
    `${ad.padEnd(14)}${String(R.length).padStart(4)}  ortanca ${pct(per3, 0.5).toFixed(2)}  ` +
      `%80 ${pct(per3, 0.8).toFixed(2)}  %90 ${pct(per3, 0.9).toFixed(2)}  max ${Math.max(...per3).toFixed(1)}\n`
  );
}

/* ═══ 4. Koni yarım açısı ═══ */
const angDiff = (a, b) => { const d = Math.abs(((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; };
process.stdout.write("\n" + "═".repeat(74) + "\n4) KONİ YARIM AÇISI — gözlenen yön sapması ne kadar geniş?\n" + "═".repeat(74) + "\n");
process.stdout.write("rüzgâr         n   %50 içinde  %80 içinde  %90 içinde  |  ÜRÜNÜN AÇISI\n");
function coneHalfAngle(w) { return 30 - Math.min(1, w / 50) * 15; }
for (const [a, b] of WBINS) {
  const R = rows.filter((r) => r.w.kmh >= a && r.w.kmh < b && r.c.basYon !== null);
  if (R.length < 15) continue;
  const errs = R.map((r) => angDiff(r.w.deg, r.c.basYon));
  const wOrt = R.reduce((s, r) => s + r.w.kmh, 0) / R.length;
  process.stdout.write(
    `${(a + "–" + b + " km/sa").padEnd(14)}${String(R.length).padStart(3)}  ` +
      `${(pct(errs, 0.5).toFixed(0) + "°").padStart(9)}  ${(pct(errs, 0.8).toFixed(0) + "°").padStart(10)}  ` +
      `${(pct(errs, 0.9).toFixed(0) + "°").padStart(10)}  |  ${coneHalfAngle(wOrt).toFixed(0)}°\n`
  );
}
process.stdout.write(
  `\n→ Ürün 15–30° yarım açı çiziyor. Gözlenen sapmanın yalnız ` +
    `%${(100 * rows.filter((r) => r.c.basYon !== null && angDiff(r.w.deg, r.c.basYon) <= 30).length / rows.filter((r) => r.c.basYon !== null).length).toFixed(0)}'ü 30° içinde.\n`
);
