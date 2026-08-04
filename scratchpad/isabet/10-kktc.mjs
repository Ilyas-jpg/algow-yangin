/**
 * 10 — KKTC kara sınırını il sınırları katmanına ekle.
 *
 * Natural Earth (kamu malı) "Northern Cyprus"u ayrı bir harita birimi olarak
 * tutuyor. Poligonun TAMAMINI çizersek sahil çizgisini ikinci kez çizmiş
 * oluruz; bize yalnız Kıbrıs ile paylaşılan KARA sınırı lazım.
 *
 * Yöntem: KKTC halkasının, Kıbrıs halkasına çok yakın (≈100 m) düşen
 * köşelerini işaretle, bunların ardışık dizilerini çizgi olarak al. Kalanı
 * (sahil) atılır.
 */
import { readFileSync, writeFileSync } from "node:fs";

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_units.geojson";
const CIKTI = "C:/Users/milya/Desktop/00-Projeler/algow-yangin/public/tr-iller.json";

process.stdout.write("Natural Earth harita birimleri indiriliyor...\n");
const j = await (await fetch(NE, { signal: AbortSignal.timeout(300_000) })).json();
const al = (ad) => j.features.find((f) => (f.properties.ADMIN ?? f.properties.admin) === ad);
const kktc = al("Northern Cyprus");
const kibris = al("Cyprus No Mans Area"); // BM ara bölgesi: KKTC ile Kıbrıs arasında duruyor
if (!kktc || !kibris) { process.stdout.write("Birim bulunamadı\n"); process.exit(1); }

const halkalar = (g) => (g.type === "Polygon" ? g.coordinates : g.coordinates.flat());
const kibrisNoktalari = halkalar(kibris.geometry).flat();

// Kaba ızgara ile hızlı yakınlık araması (~100 m ≈ 0,001°)
const TOL = 0.0012;
const hucre = 0.01;
const ızgara = new Map();
for (const [x, y] of kibrisNoktalari) {
  const k = `${Math.floor(x / hucre)}:${Math.floor(y / hucre)}`;
  (ızgara.get(k) ?? ızgara.set(k, []).get(k)).push([x, y]);
}
const yakinMi = ([x, y]) => {
  const cx = Math.floor(x / hucre), cy = Math.floor(y / hucre);
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      for (const [px, py] of ızgara.get(`${cx + dx}:${cy + dy}`) ?? []) {
        if (Math.abs(px - x) <= TOL && Math.abs(py - y) <= TOL) return true;
      }
    }
  return false;
};

const cizgiler = [];
let toplamKose = 0, ortakKose = 0;
for (const ring of halkalar(kktc.geometry)) {
  let birikim = [];
  for (const nokta of ring) {
    toplamKose++;
    if (yakinMi(nokta)) {
      ortakKose++;
      birikim.push([+nokta[0].toFixed(4), +nokta[1].toFixed(4)]);
    } else {
      if (birikim.length >= 2) cizgiler.push(birikim);
      birikim = [];
    }
  }
  if (birikim.length >= 2) cizgiler.push(birikim);
}
process.stdout.write(
  `KKTC köşeleri: ${toplamKose} · Kıbrıs'la ortak (kara sınırı): ${ortakKose}\n` +
    `Çıkarılan sınır parçası: ${cizgiler.length}\n`
);
if (!cizgiler.length) { process.stdout.write("⚠️ Ortak sınır bulunamadı, tolerans yetersiz olabilir\n"); process.exit(1); }

const mevcut = JSON.parse(readFileSync(CIKTI, "utf8"));
// Zaten eklenmişse tekrar ekleme (script yeniden çalıştırılabilir olsun)
mevcut.features = mevcut.features.filter((f) => f.properties?.tur !== "kktc");
mevcut.features.push({
  type: "Feature",
  properties: { tur: "kktc" },
  geometry: { type: "MultiLineString", coordinates: cizgiler },
});
const s = JSON.stringify(mevcut);
writeFileSync(CIKTI, s);
process.stdout.write(`tr-iller.json güncellendi: ${(s.length / 1024).toFixed(0)} KB\n`);
