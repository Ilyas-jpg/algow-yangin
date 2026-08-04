/**
 * 07 — Yangının GERÇEK ERİŞİM ŞEKLİ.
 *
 * Soru: tahmin edilen yönden θ° sapan yönlerde yangın ne kadar ilerliyor?
 * Cevap, koninin çizilmesi gereken kapalı şekli verir: baş yönünde uzun,
 * geriye doğru kısa. Simetrik daire yön bilgisini çöpe atıyor; keskin kama
 * ise sahip olmadığımız kesinliği ima ediyor. Ölçülen zarf ikisinin arası.
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

const FUEL = { ORMAN: { sigma: 1500, beta: 0.03, waf: 0.15 }, MAKI: { sigma: 1800, beta: 0.012, waf: 0.3 }, OT: { sigma: 3500, beta: 0.0015, waf: 0.4 } };
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
  const s = w.spd[i], d = w.dir[i];
  return typeof s === "number" && typeof d === "number" ? { kmh: s, to: (d + 180) % 360 } : null;
}
const gap = (a, b) => { const d = Math.abs(((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; };
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };

const rows = [];
for (const c of cases) {
  if (c.basYon === null || c.basYon === undefined || c.iler90 === null) continue;
  const w = windAt(c), e = elev[ekey(c)];
  if (!w || !e) continue;
  const tahmin = rothermel(c.yakit, w.kmh, w.to, e.egim, e.yokus);
  rows.push({
    sapma: gap(tahmin, c.basYon),
    iler: c.iler90 * (3 / c.hours), // 3 saate normalize
    kmh: w.kmh,
  });
}
process.stdout.write(`${rows.length} vaka\n\n`);
process.stdout.write("TAHMİN YÖNÜNDEN SAPMA → 3 SAATLİK ERİŞİM (km)\n" + "─".repeat(62) + "\n");
process.stdout.write("sapma açısı    n    ortanca   %80    %90   | payı\n");
const BINS = [[0, 30], [30, 60], [60, 90], [90, 120], [120, 150], [150, 180]];
const profil = [];
for (const [a, b] of BINS) {
  const R = rows.filter((r) => r.sapma >= a && r.sapma < b + (b === 180 ? 1 : 0));
  if (!R.length) continue;
  const il = R.map((r) => r.iler);
  const p90 = pct(il, 0.9);
  profil.push([(a + b) / 2, p90]);
  process.stdout.write(
    `${(a + "–" + b + "°").padEnd(13)}${String(R.length).padStart(3)}   ${pct(il, 0.5).toFixed(2).padStart(6)}  ` +
      `${pct(il, 0.8).toFixed(2).padStart(5)}  ${p90.toFixed(2).padStart(5)}   | %${((100 * R.length) / rows.length).toFixed(0)}\n`
  );
}
const enUzun = Math.max(...profil.map((p) => p[1]));
process.stdout.write("\nBaşa göre normalize edilmiş ŞEKİL (r(θ) / r(0)):\n");
for (const [ang, r] of profil) {
  const oran = r / enUzun;
  process.stdout.write(`  ${String(Math.round(ang)).padStart(3)}° → ${oran.toFixed(2)}  ${"█".repeat(Math.round(oran * 34))}\n`);
}
process.stdout.write(
  `\nBaş/geri oranı: ${(profil[0][1] / profil[profil.length - 1][1]).toFixed(1)}×\n`
);
