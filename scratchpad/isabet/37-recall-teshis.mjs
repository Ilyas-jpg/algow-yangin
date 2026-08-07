/**
 * 37 — 36'nın SONUCUNU SINA. "825 ha yangın kaçırıldı" inandırıcı değil.
 *
 * İki hipotez:
 *  H1 — gerçekten kaçırdık (uydu geçişi denk gelmedi / bulut / kısa ömür)
 *  H2 — ÖLÇÜM HATASI: EFFIS `FIREDATE` gerçek yangın tarihiyle hizalı değil,
 *       pencere yanlış yere düşüyor.
 *
 * Ayırt etme yolu: kaçırılan her yangının KONUMUNDA, tüm sezon boyunca
 * tespit var mı diye bak. Varsa ama tarihi pencerenin dışındaysa → H2.
 */
import { readFileSync } from "node:fs";

const DIZIN = "scratchpad/isabet";
const KUTU = { lon0: 25, lat0: 34.8, lon1: 45.5, lat1: 42.6 };
const PAY_KM = 1.0;
const GUN = 86_400_000;

const effis = JSON.parse(readFileSync(`${DIZIN}/effis-2025.json`, "utf8"));
const tespit = JSON.parse(readFileSync(`${DIZIN}/akdeniz-2025.json`, "utf8")).filter(
  (p) => p.lon >= KUTU.lon0 && p.lon <= KUTU.lon1 && p.lat >= KUTU.lat0 && p.lat <= KUTU.lat1
);
const korpusIlk = Math.min(...tespit.map((p) => p.dt));
const korpusSon = Math.max(...tespit.map((p) => p.dt));

const KOVA = 0.5;
const kovalar = new Map();
for (const p of tespit) {
  const k = Math.floor(p.lon / KOVA);
  if (!kovalar.has(k)) kovalar.set(k, []);
  kovalar.get(k).push(p);
}

/** Konumda, İSTEĞE BAĞLI zaman penceresiyle tespit ara. */
function bul(e, t0, t1) {
  const payLat = PAY_KM / 111;
  const payLon = PAY_KM / (111 * Math.cos(((e.lat0 + e.lat1) / 2) * (Math.PI / 180)));
  const c = [];
  for (let k = Math.floor((e.lon0 - payLon) / KOVA); k <= Math.floor((e.lon1 + payLon) / KOVA); k++) {
    for (const p of kovalar.get(k) ?? []) {
      if (t0 !== null && (p.dt < t0 || p.dt > t1)) continue;
      if (p.lon < e.lon0 - payLon || p.lon > e.lon1 + payLon) continue;
      if (p.lat < e.lat0 - payLat || p.lat > e.lat1 + payLat) continue;
      c.push(p);
    }
  }
  return c;
}

const uygun = effis.filter((e) => {
  if (e.ulke !== "TR") return false;
  if (e.lon0 < KUTU.lon0 || e.lon1 > KUTU.lon1 || e.lat0 < KUTU.lat0 || e.lat1 > KUTU.lat1) return false;
  const t = Date.parse(e.basla.replace(" ", "T") + "Z");
  return t >= korpusIlk && t <= korpusSon;
});
const b30 = uygun.filter((e) => e.ha >= 30);

const pencere = (e) => [
  Date.parse(e.basla.replace(" ", "T") + "Z") - GUN,
  Date.parse((e.bitir || e.basla).replace(" ", "T") + "Z") + GUN,
];

/* ── ① Kaçırılanların konumunda SEZON BOYUNCA tespit var mı? ─────────────── */
const kacan = b30.filter((e) => bul(e, ...pencere(e)).length === 0);
let konumdaVar = 0;
const kaymalar = [];
for (const e of kacan) {
  const hepsi = bul(e, null, null);
  if (!hepsi.length) continue;
  konumdaVar++;
  const t = Date.parse(e.basla.replace(" ", "T") + "Z");
  // Yangına en yakın tespitin gün cinsinden kayması
  const enYakin = hepsi.reduce((a, p) => (Math.abs(p.dt - t) < Math.abs(a.dt - t) ? p : a));
  kaymalar.push({ e, gun: Math.round((enYakin.dt - t) / GUN), n: hepsi.length });
}
console.log(`≥30 ha kaçırılan: ${kacan.length}`);
console.log(`  bunlardan KONUMUNDA sezon içinde tespit OLAN: ${konumdaVar} (%${((konumdaVar / kacan.length) * 100).toFixed(0)})`);

const g = kaymalar.map((x) => x.gun).sort((a, b) => a - b);
if (g.length) {
  console.log(
    `  en yakın tespitin kayması (gün): min ${g[0]} · %25 ${g[Math.floor(g.length * 0.25)]} · ` +
      `ortanca ${g[Math.floor(g.length / 2)]} · %75 ${g[Math.floor(g.length * 0.75)]} · max ${g[g.length - 1]}`
  );
  const yakin = g.filter((x) => Math.abs(x) <= 10).length;
  console.log(`  |kayma| ≤ 10 gün olan: ${yakin}/${g.length}`);
}

console.log("\n🔎 En büyük 8 'kaçırılan' — konumundaki tespitlerin tarihi:");
for (const x of kaymalar.sort((a, b) => b.e.ha - a.e.ha).slice(0, 8)) {
  const hepsi = bul(x.e, null, null).sort((a, b) => a.dt - b.dt);
  const ilk = new Date(hepsi[0].dt).toISOString().slice(0, 10);
  const son = new Date(hepsi[hepsi.length - 1].dt).toISOString().slice(0, 10);
  console.log(
    `  ${String(Math.round(x.e.ha)).padStart(5)} ha  EFFIS=${x.e.basla.slice(0, 10)}  ` +
      `tespitler ${ilk}→${son} (${hepsi.length} adet, en yakın ${x.gun > 0 ? "+" : ""}${x.gun} gün)  ${(x.e.il || "").slice(0, 28)}`
  );
}

/* ── ② Pencere duyarlılığı: eşiği gevşetince recall nereye gidiyor? ──────── */
console.log("\n| pencere (gün ±) | ≥30 ha recall |");
console.log("|---|---|");
for (const d of [1, 2, 3, 5, 7, 10, 14, 21, 30]) {
  const gor = b30.filter((e) => {
    const t0 = Date.parse(e.basla.replace(" ", "T") + "Z") - d * GUN;
    const t1 = Date.parse((e.bitir || e.basla).replace(" ", "T") + "Z") + d * GUN;
    return bul(e, t0, t1).length > 0;
  }).length;
  console.log(`| ±${d} | %${((gor / b30.length) * 100).toFixed(1)} |`);
}

/* ── ③ Konum bazlı tavan: zaman hiç şart koşulmazsa ──────────────────────── */
const konumTavan = b30.filter((e) => bul(e, null, null).length > 0).length;
console.log(
  `\nZAMAN ŞARTI YOK (yalnız konum): ${konumTavan}/${b30.length} = %${((konumTavan / b30.length) * 100).toFixed(1)}`
);
console.log("→ Bu bir TAVAN: aradaki fark zaman hizalamasından, tespit yokluğundan değil.");
