/**
 * 38 — Korpusta OLMAYAN iki üretim kaynağını indir: NOAA-21 + MODIS.
 *
 * NEDEN: 36'nın recall'ü (%72,9) korpustan ölçüldü ve korpus yalnız
 * VIIRS SNPP + NOAA-20 içeriyor (22-akdeniz-indir.mjs: "NOAA-21 yok, 2023'te
 * başladı, eski sezonları yapay düşük gösterirdi" — pan-Akdeniz korpusu için
 * DOĞRU bir karardı, ama recall ölçümü için ürünü olduğundan kötü gösterir).
 * Üretim dört kaynak kullanıyor (`lib/firms.ts`): SNPP + NOAA20 + NOAA21 + MODIS.
 *
 * 🔑 Ölçülecek şey GÖNDERİLEN şey olmalı. Bu betik farkı kapatıyor.
 *
 * Pencere korpusla BİREBİR aynı tutuldu (2025-05-01 → 2025-10-02) ki
 * karşılaştırma elmayla elma olsun.
 *
 * ⚠️ FIRMS BOĞULMA DERSİ (P3, %9 sessiz boşluk): 400 "veri yok" demek değil.
 * Sıralı istek + 3 turlu yeniden deneme + kalan varsa ÇIKIŞ KODU 1.
 *
 * Koşum: node --import ./test/register.mjs scratchpad/isabet/38-eksik-kaynaklar.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const KUTU = "25,34.8,45.5,42.6";
const BASLA = "2025-05-01";
const BITIR = "2025-10-02";
const GUN_ADIM = 5; // FIRMS bu kutuda dayRange>5'e 400 dönüyor (ölçülmüş sınır)
const KAYNAKLAR = ["VIIRS_NOAA21_NRT", "MODIS_SP"];
const CIKTI = "scratchpad/isabet/ek-kaynak-2025.json";

if (existsSync(CIKTI)) {
  console.log(`${CIKTI} zaten var — yeniden indirilmiyor.`);
  process.exit(0);
}

const env = readFileSync(".env.local", "utf8");
const ANAHTAR = env.match(/FIRMS_MAP_KEY\s*=\s*["']?([A-Za-z0-9]+)/)?.[1];
if (!ANAHTAR) throw new Error("FIRMS_MAP_KEY okunamadı");

const GUN = 86_400_000;
const bloklar = [];
for (let t = Date.parse(BASLA); t <= Date.parse(BITIR); t += GUN_ADIM * GUN) {
  bloklar.push(new Date(t).toISOString().slice(0, 10));
}
console.log(`${KAYNAKLAR.length} kaynak × ${bloklar.length} blok = ${KAYNAKLAR.length * bloklar.length} istek\n`);

const uyu = (ms) => new Promise((r) => setTimeout(r, ms));

/** CSV'yi BAŞLIK ADIYLA ayrıştır — kolon sırası kaynaklar arasında farklı. */
function ayristir(csv, kaynak) {
  const satirlar = csv.trim().split("\n");
  if (satirlar.length < 2) return [];
  const bas = satirlar[0].split(",").map((s) => s.trim());
  const i = (ad) => bas.indexOf(ad);
  const iLat = i("latitude"), iLon = i("longitude");
  const iTar = i("acq_date"), iSaa = i("acq_time"), iFrp = i("frp");
  if (iLat < 0 || iLon < 0 || iTar < 0) {
    throw new Error(`beklenmeyen başlık (${kaynak}): ${satirlar[0].slice(0, 120)}`);
  }
  const out = [];
  for (let n = 1; n < satirlar.length; n++) {
    const a = satirlar[n].split(",");
    if (a.length < bas.length) continue;
    const saat = String(a[iSaa] ?? "0").padStart(4, "0");
    out.push({
      lat: Number(a[iLat]),
      lon: Number(a[iLon]),
      dt: Date.parse(`${a[iTar]}T${saat.slice(0, 2)}:${saat.slice(2)}:00Z`),
      frp: Number(a[iFrp] ?? 0),
      sat: kaynak === "MODIS_SP" ? "M" : "2",
    });
  }
  return out;
}

async function cek(kaynak, tarih) {
  const url =
    `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${ANAHTAR}/${kaynak}/${KUTU}/${GUN_ADIM}/${tarih}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const t = await r.text();
  // 🔑 Boğulma yanıtı CSV başlığı TAŞIMAZ. "0 satır" ile "başlık yok" farklı.
  if (!t.includes("latitude")) throw new Error(`CSV başlığı yok (boğulma?): ${t.slice(0, 80)}`);
  return ayristir(t, kaynak);
}

const hepsi = [];
const kalan = [];
for (const kaynak of KAYNAKLAR) {
  let n = 0;
  for (const tarih of bloklar) {
    let ok = false;
    for (let tur = 0; tur < 3 && !ok; tur++) {
      try {
        const k = await cek(kaynak, tarih);
        hepsi.push(...k);
        n += k.length;
        ok = true;
      } catch (e) {
        if (tur === 2) kalan.push({ kaynak, tarih, hata: String(e.message) });
        else await uyu(tur === 0 ? 20_000 : 60_000);
      }
    }
    await uyu(700);
  }
  console.log(`${kaynak}: ${n} tespit`);
}

if (kalan.length) {
  console.error(`\n🔴 ${kalan.length} blok çekilemedi — iş BİTMİŞ SAYILMAZ:`);
  for (const x of kalan) console.error(`   ${x.kaynak} ${x.tarih}: ${x.hata}`);
  writeFileSync(`${CIKTI}.EKSIK.json`, JSON.stringify(kalan, null, 2));
  process.exit(1);
}

writeFileSync(CIKTI, JSON.stringify(hepsi));
const sat = {};
for (const p of hepsi) sat[p.sat] = (sat[p.sat] || 0) + 1;
console.log(`\n✅ ${hepsi.length} tespit → ${CIKTI}`);
console.log(`uydu dağılımı: ${JSON.stringify(sat)}`);
