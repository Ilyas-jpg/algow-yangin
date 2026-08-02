/**
 * Geçmiş arşivi pişirici — FIRMS SP (Standard Processing) → statik JSON.
 *
 * NRT beslemesi yalnız son ~2 ayı tutar; SP arşivi 2012'ye kadar açıktır.
 * Türkiye'nin büyük yangınlarının halka açık, Türkçe bir oynatması hiçbir
 * yerde yok — kamu hafızası açısından da, "yangın nasıl ilerler" sorusunu
 * canlı harita beklemeden anlatmak açısından da değerli.
 *
 * Çalışma anında FIRMS'e hiç dokunulmaz: çıktı public/arsiv/*.json olarak
 * depoya girer, sunucuda sıfır kota, sıfır gecikme.
 *
 * Çalıştırma (proje kökünden):
 *   node scratchpad/arsiv-pisir.mjs
 *
 * Not: .env.local içindeki FIRMS_MAP_KEY okunur.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const KOK = process.cwd();
const CIKTI = join(KOK, "public", "arsiv");

const env = readFileSync(join(KOK, ".env.local"), "utf8");
const KEY = (env.match(/^FIRMS_MAP_KEY=(.*)$/m)?.[1] ?? "").trim();
if (!KEY) throw new Error(".env.local içinde FIRMS_MAP_KEY yok");

/** SP arşivinde 2021 için mevcut kaynaklar (MODIS 2000+, SNPP 2012+, NOAA20 2018+) */
const KAYNAKLAR = ["VIIRS_SNPP_SP", "VIIRS_NOAA20_SP", "MODIS_SP"];
/**
 * FIRMS area API tek istekte en fazla 5 gün veriyor — 10 denendi, HTTP 400
 * "Expects [1..5]" döndü. Bu sınır SP arşivinde de aynı (NRT'de zaten
 * biliniyordu, bbox'a bağlı sanılıyordu; değil, global sınır).
 */
const GUN = 5;

/**
 * Arşivlenecek yangınlar. Tarih ve kutu bilinçli olarak geniş tutuldu;
 * gerçekte veri var mı betiğin çıktısı söyler — uydurma kayıt basmıyoruz.
 */
const YANGINLAR = [
  {
    slug: "manavgat-2021",
    ad: "Manavgat yangını",
    il: "Antalya",
    bbox: "31.0,36.3,32.4,37.3",
    baslangic: "2021-07-28",
    gun: 17,
    ozet:
      "28 Temmuz 2021'de Manavgat'ta başlayan ve günlerce süren yangın, Türkiye'nin ölçülmüş en büyük orman yangınlarından biri oldu.",
  },
  {
    slug: "marmaris-2021",
    ad: "Marmaris yangını",
    il: "Muğla",
    bbox: "27.9,36.6,28.9,37.3",
    baslangic: "2021-07-29",
    gun: 14,
    ozet:
      "Marmaris ve çevresinde Temmuz sonunda başlayan yangın, kıyı yerleşimlerinin tahliyesine yol açtı.",
  },
  {
    slug: "milas-2021",
    ad: "Milas yangını",
    il: "Muğla",
    bbox: "27.4,36.9,28.3,37.6",
    baslangic: "2021-08-01",
    gun: 12,
    ozet:
      "Milas'taki yangın, Kemerköy Termik Santrali'nin çevresine ulaşarak ülke gündemine oturdu.",
  },
];

function gunEkle(tarih, n) {
  const d = new Date(tarih + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function csvAyristir(csv, satAd) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const h = lines[0].split(",").map((x) => x.trim());
  const i = (n) => h.indexOf(n);
  const iLat = i("latitude"), iLon = i("longitude"), iDate = i("acq_date");
  const iTime = i("acq_time"), iFrp = i("frp"), iDn = i("daynight");
  if (iLat < 0 || iLon < 0) return [];
  const out = [];
  for (let k = 1; k < lines.length; k++) {
    const c = lines[k].split(",");
    if (c.length < h.length) continue;
    const lat = +c[iLat], lon = +c[iLon];
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const t = parseInt(c[iTime], 10);
    const dt = Date.parse(
      `${c[iDate]}T${String(Math.floor(t / 100)).padStart(2, "0")}:${String(t % 100).padStart(2, "0")}:00Z`
    );
    if (!isFinite(dt)) continue;
    const frp = parseFloat(c[iFrp]);
    out.push({
      lon: Math.round(lon * 1e4) / 1e4,
      lat: Math.round(lat * 1e4) / 1e4,
      frp: isFinite(frp) ? Math.round(Math.max(0, frp) * 10) / 10 : 0,
      dt,
      sat: satAd,
      dn: (c[iDn] ?? "D").trim().toUpperCase() === "N" ? "N" : "D",
    });
  }
  return out;
}

mkdirSync(CIKTI, { recursive: true });
const indeks = [];

for (const y of YANGINLAR) {
  const hepsi = [];
  const kaynakDurum = [];
  for (const src of KAYNAKLAR) {
    let alt = 0;
    for (let off = 0; off < y.gun; off += GUN) {
      const tarih = gunEkle(y.baslangic, off);
      const aralik = Math.min(GUN, y.gun - off);
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/${src}/${y.bbox}/${aralik}/${tarih}`;
      try {
        const r = await fetch(url);
        const txt = await r.text();
        if (!r.ok || !txt.startsWith("latitude")) {
          console.log(`   ! ${src} ${tarih}: ${r.status} ${txt.slice(0, 60)}`);
          continue;
        }
        const p = csvAyristir(txt, src.includes("NOAA20") ? "1" : src.includes("SNPP") ? "N" : "M");
        hepsi.push(...p);
        alt += p.length;
      } catch (e) {
        console.log(`   ! ${src} ${tarih}: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    kaynakDurum.push(`${src}=${alt}`);
  }

  // Tekrar temizliği (aynı piksel iki chunk'ta gelebilir)
  const gorulen = new Set();
  const pts = [];
  for (const p of hepsi.sort((a, b) => a.dt - b.dt)) {
    const k = `${p.sat}:${p.lat}:${p.lon}:${p.dt}`;
    if (gorulen.has(k)) continue;
    gorulen.add(k);
    pts.push(p);
  }

  if (pts.length === 0) {
    console.log(`✗ ${y.slug}: veri yok — atlanıyor (${kaynakDurum.join(" ")})`);
    continue;
  }

  // Ağırlık merkezi ve zaman aralığı veriden gelsin, elle yazılmasın
  const lon = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const ilk = pts[0].dt;
  const son = pts[pts.length - 1].dt;

  // Sütunlu biçim: GeoJSON'a göre ~3 kat küçük
  const SAT = ["N", "1", "M"];
  const govde = {
    slug: y.slug,
    ad: y.ad,
    il: y.il,
    ozet: y.ozet,
    center: [Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4],
    ilk,
    son,
    sats: SAT,
    // [lon, lat, frp, dt, satIdx, gece]
    pts: pts.map((p) => [p.lon, p.lat, p.frp, p.dt, SAT.indexOf(p.sat), p.dn === "N" ? 1 : 0]),
  };

  const yol = join(CIKTI, `${y.slug}.json`);
  writeFileSync(yol, JSON.stringify(govde));
  const kb = Math.round(JSON.stringify(govde).length / 1024);
  console.log(
    `✓ ${y.slug}: ${pts.length} tespit · ${kb} KB · ${new Date(ilk).toISOString().slice(0, 10)} → ${new Date(son).toISOString().slice(0, 10)} · ${kaynakDurum.join(" ")}`
  );
  indeks.push({
    slug: y.slug,
    ad: y.ad,
    il: y.il,
    ozet: y.ozet,
    ilk,
    son,
    tespit: pts.length,
    maxFrp: Math.round(Math.max(...pts.map((p) => p.frp))),
  });
}

writeFileSync(join(CIKTI, "index.json"), JSON.stringify(indeks, null, 1));
console.log(`\nindex.json yazıldı — ${indeks.length} yangın`);
