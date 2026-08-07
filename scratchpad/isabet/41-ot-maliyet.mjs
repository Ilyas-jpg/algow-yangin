/**
 * 41 — OT havuzunun çevre verisi ne kadara mal olur? (indirmeden ÖNCE ölç)
 *
 * 40 gösterdi ki ORMAN/MAKİ ayrımı hiçbir şey kazandırmıyor (ikisi de k=1,5).
 * Ama Fable'ın iddiası OT hakkındaydı ve OT'nin 701 vakasının 0'ında çevre
 * verisi var — asıl soru sınanmadı.
 *
 * Bu projede kural: 2.200 isteklik işe körlemesine girme, önce ölç
 * (21-akdeniz-boyut.mjs, 26-akdeniz-cevre.mjs — üçüncü kez kazandırdı).
 * Rüzgâr anahtarı (lat.1,lon.1|yıl) ve eğim anahtarı (lat.3,lon.3) paylaşımlı;
 * OT vakalarının bir kısmı MEVCUT kayıtlara düşüyor olabilir.
 */
import { readFileSync, readdirSync } from "node:fs";
import { yakitOf } from "./04b-yakit-kod.mjs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const ORTADOGU = new Set(["Irak", "Suriye", "İran"]);

const clc = JSON.parse(readFileSync(here("clc-all.json"), "utf8"));
const wind = JSON.parse(readFileSync(here("akdeniz-ruzgar.json"), "utf8"));
const elev = JSON.parse(readFileSync(here("akdeniz-egim.json"), "utf8"));
const ckey = (c) => `${(Math.round(c.lat * 100) / 100).toFixed(2)},${(Math.round(c.lon * 100) / 100).toFixed(2)}`;
const wkey = (c) => `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;

const hepsi = [];
for (const f of readdirSync(here(".")).filter((f) => /^vaka-akdeniz-\d{4}\.json$/.test(f)).sort())
  hepsi.push(...JSON.parse(readFileSync(here(f), "utf8")));

const ot = hepsi.filter(
  (c) => !ORTADOGU.has(c.bolge) && c.hucreler.length && yakitOf(clc[ckey(c)]) === "OT"
);
const wEksik = new Set(), eEksik = new Set();
let tr = 0;
for (const c of ot) {
  if (c.bolge === "Türkiye") tr++;
  if (!wind[wkey(c)]) wEksik.add(wkey(c));
  if (!elev[ekey(c)]) eEksik.add(ekey(c));
}
console.log(`OT vakası: ${ot.length} (Türkiye ${tr} · dış ${ot.length - tr})`);
console.log(`  eksik RÜZGÂR anahtarı (konum×yıl): ${wEksik.size}`);
console.log(`  eksik EĞİM anahtarı (konum):       ${eEksik.size}`);

/* 26'nın ölçtüğü hız: istek başına ~9 sn sunucuda, 12 konum/10 sn.
 * Rüzgâr istekleri tarih aralığına göre gruplanıyor (yarım-ay yuvarlama). */
const yariAy = new Set();
for (const c of ot) {
  if (wind[wkey(c)]) continue;
  const d = new Date(c.t0);
  yariAy.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate() < 16 ? 0 : 1}`);
}
console.log(`\nTahmini maliyet:`);
console.log(`  rüzgâr: ~${yariAy.size} tarih grubu → yaklaşık ${Math.ceil(wEksik.size / 12)} istek (12 konum/istek)`);
console.log(`  eğim  : ~${Math.ceil(eEksik.size / 100)} istek (SRTM toplu)`);
console.log(`  kaba süre: ~${Math.ceil((Math.ceil(wEksik.size / 12) * 10 + Math.ceil(eEksik.size / 100) * 3) / 60)} dk`);

/* Türkiye'de kaç OT vakası SINANABİLİR olur — ülke-dışı protokol için
 * hem dışta hem Türkiye'de yeterli n lazım. */
console.log(
  `\nProtokol için: dışta ${ot.length - tr} vaka (k seçimi) · Türkiye'de ${tr} vaka (sınama).` +
    `\n  ⚠️ 40'ta MAKİ n=599 ile anlamlı sonuç alındı; ${tr} < 40 ise Türkiye sınaması yapılamaz.`
);
