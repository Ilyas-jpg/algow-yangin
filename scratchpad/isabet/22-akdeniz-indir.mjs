/**
 * 22 — PAN-AKDENİZ KORPUSU: İNDİRME (spec §7.2)
 *
 * Ölçülen maliyet (21-akdeniz-boyut.mjs): 4 kutu × 8 sezon ≈ 1.984 istek,
 * ~25 dk, ~0,9M tespit, ~0,1 GB ham CSV. Tahminim 3-6M idi; ölçüm düşürdü.
 *
 * ⚠️ YIL BAŞINA AYRI DOSYA ve YENİDEN BAŞLATILABİLİR. Sebep: (a) 1M nesneyi
 * tek dizide tutmak Node'da 1-2 GB, (b) 25 dakikalık tek bir koşum yarıda
 * kesilirse baştan indirmek FIRMS'e saygısızlık. Dosyası olan yıl atlanıyor.
 *
 * ⚠️ 2026 KORPUSA GİRMİYOR: SP arşivi güncel sezonu kapsamıyor (ölçüldü,
 * 2026'nın her ayında 0 tespit), NRT ise yalnız son ~2 ayı tutuyor. Yarım bir
 * sezonu tam sezonlarla aynı korpusa koymak, sezon-bazlı bölmeyi bozar.
 * Türkiye'nin 2026 verisi mevcut korpusta (detections-all.json) zaten var.
 *
 * Koşum (yılı yılına — Bash aracının 10 dk sınırı yüzünden):
 *   YIL=2018 node scratchpad/isabet/22-akdeniz-indir.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
// Kutular yan etkisiz modülden: boyut ölçüm scriptinden import etmek onun
// 124 isteklik ölçümünü her yıl yeniden koşturuyordu.
import { KUTULAR } from "./21-kutular.mjs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const KEY = readFileSync("C:/Users/milya/Desktop/00-Projeler/algow-yangin/.env.local", "utf8")
  .match(/FIRMS_MAP_KEY=(\S+)/)[1];

const KAYNAK = ["VIIRS_SNPP_SP", "VIIRS_NOAA20_SP"];
const GUN = 5;
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

const YIL = Number(process.env.YIL ?? 0);
if (!YIL || YIL < 2018 || YIL > 2025) {
  throw new Error("YIL=2018..2025 ver (2026 korpusa girmiyor — dosya başındaki nota bak)");
}
const cikti = here(`akdeniz-${YIL}.json`);
if (existsSync(cikti) && !process.env.ZORLA) {
  process.stdout.write(`akdeniz-${YIL}.json zaten var — atlanıyor (ZORLA=1 ile ez)\n`);
  process.exit(0);
}

function isler(yil) {
  const out = [];
  for (const [ad, bbox] of Object.entries(KUTULAR)) {
    let d = new Date(Date.UTC(yil, 4, 1));
    const son = Date.UTC(yil, 8, 30);
    while (d.getTime() < son) {
      for (const src of KAYNAK) out.push({ ad, src, bbox, tarih: d.toISOString().slice(0, 10) });
      d = new Date(d.getTime() + GUN * 86400_000);
    }
  }
  return out;
}

async function cek(j, tries = 3) {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/${j.src}/${j.bbox}/${GUN}/${j.tarih}`;
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      const txt = await r.text();
      if (!r.ok || !txt.includes("latitude")) throw new Error(`HTTP ${r.status}`);
      return txt;
    } catch (e) {
      if (t === tries - 1) {
        process.stdout.write(`\n  ! ${j.ad} ${j.src} ${j.tarih}: ${e.message}\n`);
        return null;
      }
      await sleep(3000 * (t + 1));
    }
  }
}

/**
 * Ayrıştırma, 01b-arsiv.mjs ile AYNI: düşük güvenli tespit atılıyor, koordinat
 * 5 ondalık, uydu etiketi korunuyor. Mevcut korpusla (detections-all.json)
 * aynı şekilde olmalı, yoksa iki set birleştirilemez.
 */
function ayristir(csv, sat) {
  const lines = csv.trim().split("\n");
  const ix = Object.fromEntries(lines[0].split(",").map((h, i) => [h.trim(), i]));
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    if (c[ix.confidence] === "l") continue;
    const lat = +c[ix.latitude];
    const lon = +c[ix.longitude];
    const time = String(c[ix.acq_time]).padStart(4, "0");
    const dt = Date.parse(`${c[ix.acq_date]}T${time.slice(0, 2)}:${time.slice(2)}:00Z`);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(dt)) continue;
    out.push({ lon: +lon.toFixed(5), lat: +lat.toFixed(5), frp: +c[ix.frp], dt, sat });
  }
  return out;
}

/**
 * 🔴 EŞZAMANLILIK 4 → 2 ve İKİ TURLU DENEME.
 *
 * İlk koşumda 4 işçiyle 2019'un 240 isteğinin 22'si HTTP 400 döndü (%9).
 * ÖLÇÜLDÜ: aynı URL'ler tek tek denenince 200 ve binlerce satır veriyor —
 * yani 400 kalıcı bir hata değil, FIRMS'in boğulma yanıtı. Bunu kabul etmek
 * korpusa %9'luk SESSİZ boşluk koymak olurdu ve o boşluk sonraki her ölçüme
 * sızardı. Artık: 2 işçi + istek arası pas + başarısızları ikinci turda tek
 * işçiyle yeniden dene + kalan varsa yüksek sesle raporla ve ayrı dosyaya yaz.
 */
const isDizi = isler(YIL);
process.stdout.write(
  `${YIL}: ${isDizi.length} istek (${Object.keys(KUTULAR).length} kutu × ${KAYNAK.length} kaynak)\n`
);
const t0 = Date.now();
const hepsi = [];
let bitti = 0;
const basarisiz = [];

async function tur(liste, isciSayisi, pasMs) {
  const q = liste.slice();
  const kalan = [];
  async function isci() {
    while (q.length) {
      const j = q.shift();
      const csv = await cek(j);
      if (csv) hepsi.push(...ayristir(csv, j.src.includes("NOAA20") ? "1" : "N"));
      else kalan.push(j);
      bitti++;
      if (bitti % 20 === 0) process.stdout.write(`\r  ${bitti} istek · ${hepsi.length} tespit   `);
      if (pasMs) await sleep(pasMs);
    }
  }
  await Promise.all(Array.from({ length: isciSayisi }, isci));
  return kalan;
}

let kalan = await tur(isDizi, 2, 150);
if (kalan.length) {
  process.stdout.write(`\n  ${kalan.length} istek düştü → 20 sn bekleyip tek işçiyle yeniden deneniyor\n`);
  await sleep(20_000);
  kalan = await tur(kalan, 1, 600);
}
if (kalan.length) {
  process.stdout.write(`\n  ${kalan.length} istek İKİNCİ turda da düştü → 60 sn bekleyip son deneme\n`);
  await sleep(60_000);
  kalan = await tur(kalan, 1, 1200);
}
basarisiz.push(...kalan);

// Kutular kenarlarda bilerek örtüşüyor → tekilleştirme şart
const gorulen = new Set();
const tekil = [];
for (const p of hepsi) {
  const k = `${p.lon},${p.lat},${p.dt}`;
  if (gorulen.has(k)) continue;
  gorulen.add(k);
  tekil.push(p);
}
tekil.sort((a, b) => a.dt - b.dt);
writeFileSync(cikti, JSON.stringify(tekil));
process.stdout.write(
  `\r${YIL}: ${tekil.length} tekil tespit (${hepsi.length - tekil.length} örtüşme atıldı) · ` +
    `${((JSON.stringify(tekil).length) / 1e6).toFixed(1)} MB · ${((Date.now() - t0) / 1000).toFixed(0)} sn\n`
);

/* 🔴 Kalan başarısızlık SESSİZ KALMAZ: ayrı dosyaya yazılır ve çıkış kodu 1
   olur. Eksik chunk'lı bir yılı "tamam" saymak, korpusa görünmez boşluk
   koymanın en kolay yolu. */
if (basarisiz.length) {
  const eksikDosya = here(`akdeniz-${YIL}.EKSIK.json`);
  writeFileSync(eksikDosya, JSON.stringify(basarisiz, null, 1));
  process.stdout.write(
    `\n🔴 ${YIL}: ${basarisiz.length} istek üç turda da alınamadı — ${eksikDosya.split("/").pop()} yazıldı.\n` +
      `   Bu yıl EKSİK. Tekrar denemek için: ZORLA=1 YIL=${YIL} node scratchpad/isabet/22-akdeniz-indir.mjs\n`
  );
  process.exitCode = 1;
} else {
  process.stdout.write(`   ✅ ${YIL} tam — düşen istek yok.\n`);
}
