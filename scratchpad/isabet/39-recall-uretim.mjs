/**
 * 39 — TESPİT TAMLIĞI, ÜRETİMİN KAYNAK KÜMESİYLE (kesin ölçüm).
 *
 * 36 recall'ü korpustan ölçtü ama korpus yalnız VIIRS SNPP + NOAA-20 içeriyor.
 * Üretim (`lib/firms.ts`) DÖRT kaynak kullanıyor: + NOAA-21 + MODIS.
 * 38 eksik ikisini indirdi. Bu betik farkı da raporluyor ki "korpus kaynaklı
 * eksiklik" ile "gerçek kaçırma" karışmasın.
 *
 * Referans: EFFIS `modis.ba.poly.2025` — MODIS görüntüsünden YANIK İZİ
 * haritalama. Bizimki AKTİF YANGIN tespiti. Yanık izi, alev anında kimse
 * görmese bile kalır → döngüsel doğrulama değil.
 *
 * 🔴 SINIRLAR (sonuç bunlarla okunur):
 *  ① Pencere 2025-05-01 → 2025-10-02 (korpusun kapsadığı aralık). Dışındaki
 *    EFFIS kayıtları değerlendirilemez, eleniyor — "kaçırdık" saymak yanlış olur.
 *  ② EFFIS'in kendi asgari haritalama birimi var; bu ölçüm "≥30 ha yangınlarda
 *    recall" sorusunu cevaplar, küçükleri DEĞİL.
 *  ③ EFFIS poligonu tek yangının parçası olabilir; birim "EFFIS kaydı", "yangın" değil.
 *
 * Koşum: node --import ./test/register.mjs scratchpad/isabet/39-recall-uretim.mjs
 */
import { readFileSync } from "node:fs";

const DIZIN = "scratchpad/isabet";
const KUTU = { lon0: 25, lat0: 34.8, lon1: 45.5, lat1: 42.6 };
const PAY_KM = 1.0;
const GUN = 86_400_000;

const effis = JSON.parse(readFileSync(`${DIZIN}/effis-2025.json`, "utf8"));
const icinde = (p) =>
  p.lon >= KUTU.lon0 && p.lon <= KUTU.lon1 && p.lat >= KUTU.lat0 && p.lat <= KUTU.lat1;

const korpus = JSON.parse(readFileSync(`${DIZIN}/akdeniz-2025.json`, "utf8")).filter(icinde);
const ek = JSON.parse(readFileSync(`${DIZIN}/ek-kaynak-2025.json`, "utf8")).filter(icinde);

const korpusIlk = Math.min(...korpus.map((p) => p.dt));
const korpusSon = Math.max(...korpus.map((p) => p.dt));
// Ek kaynaklar aynı pencereye kırpılıyor: daha geniş veri recall'ü haksız şişirir.
const ekKirpik = ek.filter((p) => p.dt >= korpusIlk && p.dt <= korpusSon);

console.log(
  `Pencere ${new Date(korpusIlk).toISOString().slice(0, 10)} → ${new Date(korpusSon).toISOString().slice(0, 10)}\n` +
    `  korpus (SNPP+NOAA20): ${korpus.length}\n` +
    `  ek     (NOAA21+MODIS): ${ekKirpik.length}\n` +
    `  ÜRETİM TOPLAMI: ${korpus.length + ekKirpik.length}`
);

function indeks(noktalar) {
  const KOVA = 0.5;
  const m = new Map();
  for (const p of noktalar) {
    const k = Math.floor(p.lon / KOVA);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(p);
  }
  return { KOVA, m };
}
const iki = indeks(korpus);
const dort = indeks([...korpus, ...ekKirpik]);

function bul(ix, e, t0, t1) {
  const payLat = PAY_KM / 111;
  const payLon = PAY_KM / (111 * Math.cos(((e.lat0 + e.lat1) / 2) * (Math.PI / 180)));
  let n = 0;
  for (let k = Math.floor((e.lon0 - payLon) / ix.KOVA); k <= Math.floor((e.lon1 + payLon) / ix.KOVA); k++) {
    for (const p of ix.m.get(k) ?? []) {
      if (t0 !== null && (p.dt < t0 || p.dt > t1)) continue;
      if (p.lon < e.lon0 - payLon || p.lon > e.lon1 + payLon) continue;
      if (p.lat < e.lat0 - payLat || p.lat > e.lat1 + payLat) continue;
      n++;
    }
  }
  return n;
}

const uygun = effis.filter((e) => {
  if (e.ulke !== "TR") return false;
  if (e.lon0 < KUTU.lon0 || e.lon1 > KUTU.lon1 || e.lat0 < KUTU.lat0 || e.lat1 > KUTU.lat1) return false;
  const t = Date.parse(e.basla.replace(" ", "T") + "Z");
  return t >= korpusIlk && t <= korpusSon;
});
const pencere = (e) => [
  Date.parse(e.basla.replace(" ", "T") + "Z") - GUN,
  Date.parse((e.bitir || e.basla).replace(" ", "T") + "Z") + GUN,
];

const BANTLAR = [
  ["≥1000 ha", 1000, Infinity],
  ["500-1000 ha", 500, 1000],
  ["100-500 ha", 100, 500],
  ["30-100 ha", 30, 100],
  ["10-30 ha", 10, 30],
  ["<10 ha", 0, 10],
];

console.log(`\nDeğerlendirilebilir EFFIS kaydı: ${uygun.length}\n`);
console.log("| boyut | kayıt | 2 kaynak | **4 kaynak (üretim)** | konum-tavanı |");
console.log("|---|---|---|---|---|");
for (const [ad, alt, ust] of BANTLAR) {
  const g = uygun.filter((e) => e.ha >= alt && e.ha < ust);
  if (!g.length) continue;
  const r2 = g.filter((e) => bul(iki, e, ...pencere(e)) > 0).length;
  const r4 = g.filter((e) => bul(dort, e, ...pencere(e)) > 0).length;
  const tav = g.filter((e) => bul(dort, e, null, null) > 0).length;
  const y = (n) => `%${((n / g.length) * 100).toFixed(1)}`;
  console.log(`| ${ad} | ${g.length} | ${y(r2)} | **${y(r4)}** | ${y(tav)} |`);
}

const b30 = uygun.filter((e) => e.ha >= 30);
const r2 = b30.filter((e) => bul(iki, e, ...pencere(e)) > 0).length;
const r4 = b30.filter((e) => bul(dort, e, ...pencere(e)) > 0).length;
const tav = b30.filter((e) => bul(dort, e, null, null) > 0).length;
console.log(
  `\n🎯 ≥30 ha (n=${b30.length}): 2 kaynak %${((r2 / b30.length) * 100).toFixed(1)} → ` +
    `**ÜRETİM %${((r4 / b30.length) * 100).toFixed(1)}** (konum-tavanı %${((tav / b30.length) * 100).toFixed(1)})`
);

const kacan = b30.filter((e) => bul(dort, e, ...pencere(e)) === 0);
const hicYok = kacan.filter((e) => bul(dort, e, null, null) === 0);
console.log(
  `\n≥30 ha kaçırılan: ${kacan.length} — bunlardan ${hicYok.length}'inde konumda ` +
    `SEZON BOYUNCA hiç tespit yok (gerçek kör nokta), ${kacan.length - hicYok.length}'i tarih hizasızlığı.`
);
/* ── ASİMETRİK PENCERE DUYARLILIĞI ───────────────────────────────────────
 * EFFIS `FIREDATE` yanık izi haritalamasından türüyor ve iz ancak yangın
 * yandıktan SONRA görüntüde belirir → referansın tarihi sistematik olarak GEÇ.
 * Ölçülen örnek: 825 ha İzmir, EFFIS 2025-08-17, bizim tespitler 08-12/08-13
 * (4 gün ÖNCE). Yani ±1 gün simetrik pencere fiziksel olarak yanlış kurulmuş;
 * doğru biçim yangının ÖNCESİNE pay vermek.
 */
console.log("\n| önce (gün) | sonra (gün) | ≥30 ha recall |");
console.log("|---|---|---|");
for (const [o, s] of [[1, 1], [3, 1], [5, 1], [7, 1], [10, 1], [14, 1], [21, 1]]) {
  const n = b30.filter((e) => {
    const t0 = Date.parse(e.basla.replace(" ", "T") + "Z") - o * GUN;
    const t1 = Date.parse((e.bitir || e.basla).replace(" ", "T") + "Z") + s * GUN;
    return bul(dort, e, t0, t1) > 0;
  }).length;
  console.log(`| ${o} | ${s} | %${((n / b30.length) * 100).toFixed(1)} |`);
}

console.log("\n🔴 Üretim kaynaklarıyla da kaçırılan en büyük 10:");
for (const e of kacan.sort((a, b) => b.ha - a.ha).slice(0, 10)) {
  console.log(
    `   ${String(Math.round(e.ha)).padStart(5)} ha  ${e.basla.slice(0, 10)}  ` +
      `${((e.lon0 + e.lon1) / 2).toFixed(2)},${((e.lat0 + e.lat1) / 2).toFixed(2)}  ${(e.il || "").slice(0, 34)}`
  );
}
