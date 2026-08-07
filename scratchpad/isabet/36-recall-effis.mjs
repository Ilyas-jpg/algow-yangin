/**
 * 36 — TESPİT TAMLIĞI (RECALL): EFFIS yanan alan kayıtlarını bizim pipeline'la eşleştir.
 *
 * SORU: "10 yangından kaçını görüyoruz?" Bugüne kadar elimizde yalnız TEK bir
 * kanıtlanmış kaçırma vardı (Dikili/Çandarlı, [[not_algow_yangin_tespit_kabiliyeti]]).
 * Sistematik oran hiç ölçülmedi.
 *
 * BAĞIMSIZ REFERANS: EFFIS `modis.ba.poly.YYYY` — MODIS görüntüsünden YANIK İZİ
 * haritalama (yangın sonrası yansıma değişimi). Bizim korpus ise VIIRS AKTİF
 * YANGIN tespiti (termal anomali). İki farklı ölçüm: yanık izi, alev anında
 * kimse görmese bile kalır. Tam bağımsız değil (ikisi de uydu) ama
 * "kendi ölçütümüzle kendimizi doğrulama" döngüsünü kırıyor.
 *
 * 🔴 ÜÇ SINIR — sonuç bunlarla okunmalı:
 *  ① Korpus penceresi 1 May–2 Eki. Dışındaki EFFIS kaydı DEĞERLENDİRİLEMEZ;
 *    "kaçırdık" saymak yanlış olurdu → eleniyor.
 *  ② Korpus yalnız VIIRS SNPP + NOAA-20 (SP). Üretim ayrıca NOAA-21 ve MODIS
 *    kullanıyor → ölçülen recall üretimin ALT SINIRI.
 *  ③ EFFIS'in kendi asgari haritalama birimi var (~30 ha); bu çalışma
 *    "≥30 ha yangınlarda recall" sorusunu cevaplar, küçük yangınları değil.
 *
 * Koşum: node --import ./test/register.mjs scratchpad/isabet/36-recall-effis.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const YIL = 2025;
/** Korpusun Türkiye kutusu (22-akdeniz-indir.mjs ile aynı) */
const KUTU = { lon0: 25, lat0: 34.8, lon1: 45.5, lat1: 42.6 };
/** EFFIS poligonuna eklenen pay: VIIRS piksel 375 m + geolokasyon hatası. */
const PAY_KM = 1.0;
/** Yangın başlangıcından önce/sonra kabul edilen pencere. */
const ONCE_GUN = 1;
const SONRA_GUN = 1;

const DIZIN = "scratchpad/isabet";
const EFFIS_ONBELLEK = `${DIZIN}/effis-${YIL}.json`;

/* ── EFFIS çekimi (önbellekli — WFS ağır, tekrar çekme) ──────────────────── */

/** Boylam şeritlerine böl: tek istekte 20°'lik kutu 3+ MB ediyor. */
const SERITLER = [
  [25, 30], [30, 35], [35, 40], [40, 45.5],
];

function bboxAyristir(metin) {
  // Her featureMember'ın kendi <gml:Box> kutusu var — poligonu ayrıştırmaya gerek yok.
  const kayitlar = [];
  const parcalar = metin.split("<gml:featureMember>").slice(1);
  for (const p of parcalar) {
    const al = (ad) => {
      const m = p.match(new RegExp(`<ms:${ad}>([^<]*)</ms:${ad}>`));
      return m ? m[1].trim() : null;
    };
    const kutu = p.match(/<gml:Box[^>]*>\s*<gml:coordinates>([^<]+)<\/gml:coordinates>/);
    if (!kutu) continue;
    const [a, b] = kutu[1].trim().split(/\s+/);
    const [lon0, lat0] = a.split(",").map(Number);
    const [lon1, lat1] = b.split(",").map(Number);
    kayitlar.push({
      id: al("id"),
      ulke: al("COUNTRY"),
      il: al("PROVINCE"),
      ha: Number(al("AREA_HA")),
      basla: al("FIREDATE"),
      bitir: al("FINALDATE"),
      lon0, lat0, lon1, lat1,
    });
  }
  return kayitlar;
}

async function effisCek() {
  if (existsSync(EFFIS_ONBELLEK)) {
    const k = JSON.parse(readFileSync(EFFIS_ONBELLEK, "utf8"));
    console.log(`EFFIS önbellekten: ${k.length} kayıt`);
    return k;
  }
  const hepsi = new Map();
  for (const [a, b] of SERITLER) {
    const url =
      `https://maps.effis.emergency.copernicus.eu/effis?SERVICE=WFS&VERSION=1.0.0` +
      `&REQUEST=GetFeature&TYPENAME=modis.ba.poly.${YIL}` +
      `&BBOX=${a},${KUTU.lat0},${b},${KUTU.lat1}&MAXFEATURES=5000`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`EFFIS ${a}-${b} HTTP ${r.status}`);
    const t = await r.text();
    const k = bboxAyristir(t);
    // 🔑 MAXFEATURES'a dayandıysak veri KESİLMİŞTİR — sessizce eksik ölçme.
    if (k.length >= 5000) throw new Error(`şerit ${a}-${b} MAXFEATURES'a dayandı (${k.length})`);
    for (const x of k) hepsi.set(x.id, x);
    console.log(`  şerit ${a}-${b}: ${k.length} kayıt (${Math.round(t.length / 1024)} KB)`);
  }
  const dizi = [...hepsi.values()];
  writeFileSync(EFFIS_ONBELLEK, JSON.stringify(dizi));
  console.log(`EFFIS indirildi: ${dizi.length} benzersiz kayıt → ${EFFIS_ONBELLEK}`);
  return dizi;
}

/* ── Ana ─────────────────────────────────────────────────────────────────── */

const effis = await effisCek();

const tespit = JSON.parse(readFileSync(`${DIZIN}/akdeniz-${YIL}.json`, "utf8")).filter(
  (p) => p.lon >= KUTU.lon0 && p.lon <= KUTU.lon1 && p.lat >= KUTU.lat0 && p.lat <= KUTU.lat1
);
const korpusIlk = Math.min(...tespit.map((p) => p.dt));
const korpusSon = Math.max(...tespit.map((p) => p.dt));
console.log(
  `\nKorpus: ${tespit.length} tespit, ` +
    `${new Date(korpusIlk).toISOString().slice(0, 10)} → ${new Date(korpusSon).toISOString().slice(0, 10)}`
);

/* Zaman sıralı + boylam kovalı indeks: 230 × 91.702 kaba tarama yavaş. */
tespit.sort((a, b) => a.dt - b.dt);
const KOVA = 0.5;
const kovalar = new Map();
for (const p of tespit) {
  const k = Math.floor(p.lon / KOVA);
  if (!kovalar.has(k)) kovalar.set(k, []);
  kovalar.get(k).push(p);
}

const GUN = 86_400_000;
function eslesme(e) {
  const payLat = PAY_KM / 111;
  const payLon = PAY_KM / (111 * Math.cos(((e.lat0 + e.lat1) / 2) * (Math.PI / 180)));
  const t0 = Date.parse(e.basla.replace(" ", "T") + "Z") - ONCE_GUN * GUN;
  const t1 = Date.parse((e.bitir || e.basla).replace(" ", "T") + "Z") + SONRA_GUN * GUN;
  let n = 0;
  for (let k = Math.floor((e.lon0 - payLon) / KOVA); k <= Math.floor((e.lon1 + payLon) / KOVA); k++) {
    for (const p of kovalar.get(k) ?? []) {
      if (p.dt < t0 || p.dt > t1) continue;
      if (p.lon < e.lon0 - payLon || p.lon > e.lon1 + payLon) continue;
      if (p.lat < e.lat0 - payLat || p.lat > e.lat1 + payLat) continue;
      n++;
    }
  }
  return n;
}

/* Süzgeç: TR + korpus kutusunda + korpus penceresinde */
const disari = { ulke: 0, kutu: 0, pencere: 0 };
const uygun = [];
for (const e of effis) {
  if (e.ulke !== "TR") { disari.ulke++; continue; }
  if (e.lon0 < KUTU.lon0 || e.lon1 > KUTU.lon1 || e.lat0 < KUTU.lat0 || e.lat1 > KUTU.lat1) {
    disari.kutu++; continue;
  }
  const t = Date.parse(e.basla.replace(" ", "T") + "Z");
  if (!(t >= korpusIlk && t <= korpusSon)) { disari.pencere++; continue; }
  uygun.push(e);
}
console.log(
  `\nEFFIS ${YIL}: ${effis.length} kayıt → elenen: ülke ${disari.ulke} · kutu ${disari.kutu} · ` +
    `pencere ${disari.pencere} → değerlendirilebilir ${uygun.length}`
);

const BANTLAR = [
  ["≥1000 ha", 1000, Infinity],
  ["500-1000", 500, 1000],
  ["100-500", 100, 500],
  ["30-100", 30, 100],
  ["10-30", 10, 30],
  ["<10 ha", 0, 10],
];

console.log("\n| boyut | yangın | görülen | recall | ortanca tespit |");
console.log("|---|---|---|---|---|");
const kacan = [];
for (const [ad, alt, ust] of BANTLAR) {
  const grup = uygun.filter((e) => e.ha >= alt && e.ha < ust);
  if (!grup.length) continue;
  const sayilar = grup.map((e) => ({ e, n: eslesme(e) }));
  const gorulen = sayilar.filter((x) => x.n > 0);
  const ns = gorulen.map((x) => x.n).sort((a, b) => a - b);
  console.log(
    `| ${ad} | ${grup.length} | ${gorulen.length} | **%${((gorulen.length / grup.length) * 100).toFixed(1)}** | ` +
      `${ns.length ? ns[Math.floor(ns.length / 2)] : "—"} |`
  );
  for (const x of sayilar) if (x.n === 0 && x.e.ha >= 30) kacan.push(x.e);
}

const b30 = uygun.filter((e) => e.ha >= 30);
const g30 = b30.filter((e) => eslesme(e) > 0).length;
console.log(
  `\n🎯 ≥30 ha TOPLAM: ${b30.length} yangın, ${g30} görüldü → **recall %${((g30 / b30.length) * 100).toFixed(1)}**`
);

if (kacan.length) {
  console.log(`\n🔴 ≥30 ha KAÇIRILANLAR (${kacan.length}) — en büyük 12:`);
  for (const e of kacan.sort((a, b) => b.ha - a.ha).slice(0, 12)) {
    console.log(
      `   ${String(Math.round(e.ha)).padStart(5)} ha  ${e.basla.slice(0, 10)}  ` +
        `${e.lon0.toFixed(2)},${e.lat0.toFixed(2)}  ${(e.il || "").slice(0, 40)}`
    );
  }
}
