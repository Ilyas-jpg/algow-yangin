/**
 * 33 — MTG 10 DAKİKA: ilerleme ölçümü için fizibilite
 *
 * FİKİR: korpusun temel sorunu 12 saatlik VIIRS penceresi — az kıpırdayan
 * yangında yön ölçümü rastgeleye yakın (0-3 hücrede 91,9°). MTG 10 dakikada
 * bir bakıyor. Pencereyi kısaltmak sorunu çözer mi?
 *
 * 🔴 ÖNCE FİZİK KONTROLÜ. Bir ilerlemenin ÖLÇÜLEBİLMESİ için yangının o
 * pencerede piksel boyundan FAZLA yol alması gerekir. Aksi halde iki kare
 * arasındaki fark ölçüm gürültüsüdür, yayılım değil.
 *
 *   MTG pikseli  ~1,7 km² → kenar ~1,3 km   (canlı veriden: pixelKm2 1,7)
 *   VIIRS pikseli 0,14 km² → kenar 375 m
 *
 * Yani MTG zamanda 72× sık ama uzayda 3,5× kaba. Bu takas ilerleme ölçümü
 * için işe yarıyor mu — korpusun GERÇEK hız dağılımıyla hesapla.
 *
 * Koşum: node scratchpad/isabet/33-mtg-fizibilite.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { yakitOf } from "./04b-yakit-kod.mjs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const ORTADOGU = new Set(["Irak", "Suriye", "İran"]);

/** Hareketin "görüldü" sayılması için gereken yol — piksel kenarının katı.
 *  1 katta iki komşu piksel ayırt edilemez; 2 kat pratik alt sınır. */
const MTG_PIKSEL_KM = 1.3;
const VIIRS_PIKSEL_KM = 0.375;
const KAT = 2;

const clc = JSON.parse(readFileSync(here("clc-all.json"), "utf8"));
const ckey = (c) => `${(Math.round(c.lat * 100) / 100).toFixed(2)},${(Math.round(c.lon * 100) / 100).toFixed(2)}`;

const hepsi = [];
for (const f of readdirSync(here(".")).filter((f) => /^vaka-akdeniz-\d{4}\.json$/.test(f)).sort())
  hepsi.push(...JSON.parse(readFileSync(here(f), "utf8")));

/* Her vakanın gözlenen yayılma hızı (en uzak yeni hücre / süre) */
const hiz = [];
for (const c of hepsi) {
  if (ORTADOGU.has(c.bolge)) continue;
  if (!["ORMAN", "MAKI"].includes(yakitOf(clc[ckey(c)]))) continue;
  if (!c.hucreler.length) continue;
  hiz.push(Math.max(...c.hucreler.map(([, km]) => km)) / c.hours);
}
hiz.sort((a, b) => a - b);
const q = (p) => hiz[Math.min(hiz.length - 1, Math.floor(hiz.length * p))];
process.stdout.write(
  `${hiz.length} vaka · gözlenen yayılma hızı\n` +
    `  medyan ${q(0.5).toFixed(2)} · %75 ${q(0.75).toFixed(2)} · %90 ${q(0.9).toFixed(2)} · ` +
    `%95 ${q(0.95).toFixed(2)} · %99 ${q(0.99).toFixed(2)} km/sa\n${"═".repeat(72)}\n`
);

/** Verilen pencerede, vakaların yüzde kaçı piksel boyundan fazla yol alır? */
function cozunur(pikselKm, saat) {
  const gereken = KAT * pikselKm;
  const n = hiz.filter((h) => h * saat >= gereken).length;
  return { yuzde: (100 * n) / hiz.length, gereken };
}

process.stdout.write("MTG (piksel ~1,3 km · hareket için ≥2,6 km gerekli)\n");
process.stdout.write("pencere      ölçülebilir vaka   yorum\n");
for (const [ad, saat] of [
  ["10 dakika", 1 / 6],
  ["30 dakika", 0.5],
  ["1 saat", 1],
  ["2 saat", 2],
  ["4 saat", 4],
  ["6 saat", 6],
  ["12 saat", 12],
]) {
  const r = cozunur(MTG_PIKSEL_KM, saat);
  process.stdout.write(
    `${ad.padEnd(12)} %${r.yuzde.toFixed(1).padStart(5)}            ` +
      `${r.yuzde < 5 ? "🔴 kullanılamaz" : r.yuzde < 25 ? "⚠️ yalnız en hızlı yangınlar" : "✅ anlamlı kütle"}\n`
  );
}

process.stdout.write("\nVIIRS (piksel 375 m · hareket için ≥0,75 km gerekli) — KIYAS\n");
for (const [ad, saat] of [["6 saat", 6], ["12 saat", 12]]) {
  const r = cozunur(VIIRS_PIKSEL_KM, saat);
  process.stdout.write(`${ad.padEnd(12)} %${r.yuzde.toFixed(1).padStart(5)}\n`);
}

/* ── Asıl soru: MTG hangi pencerede VIIRS'in 12 saatine yetişir? ── */
const viirs12 = cozunur(VIIRS_PIKSEL_KM, 12).yuzde;
let esitSaat = null;
for (let s = 0.1; s <= 48; s += 0.1) {
  if (cozunur(MTG_PIKSEL_KM, s).yuzde >= viirs12) { esitSaat = s; break; }
}
process.stdout.write(
  `\n${"═".repeat(72)}\nHÜKÜM\n` +
    `  VIIRS 12 saatte vakaların %${viirs12.toFixed(1)}'inde hareketi çözüyor.\n` +
    `  MTG aynı orana ancak **${esitSaat ? esitSaat.toFixed(1) + " saatlik" : "48+ saatlik"}** pencerede ulaşıyor.\n` +
    (esitSaat && esitSaat > 12
      ? `  🔴 MTG, ilerleme ÖLÇÜMÜ için VIIRS'ten DAHA KÖTÜ: zamanda 72× sık ama\n` +
        `     uzayda 3,5× kaba ve bu işte belirleyici olan UZAY.\n`
      : `  ✅ MTG daha kısa pencerede aynı çözünürlüğü veriyor.\n`) +
    `\n  MTG'nin gerçek değeri başka yerde ve zaten kullanılıyor:\n` +
    `  TESPİT GECİKMESİ (kör aralık 5 sa → ~35 dk) ve FRP/şiddet seyri.\n` +
    `  Konum/yön ölçümü için VIIRS'in 375 m'si vazgeçilmez.\n`
);
