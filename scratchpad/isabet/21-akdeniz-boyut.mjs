/**
 * 21 — PAN-AKDENİZ KORPUSU: BOYUT ÖLÇÜMÜ (spec §7.2'nin ön adımı)
 *
 * Spec: *"232 ilerleme ML için çok küçük. FIRMS global: Akdeniz havzasının
 * tamamını indir (TR, GR, ES, PT, IT, güney FR, HR — 2018-2026 VIIRS standart
 * arşiv). Pan-Akdeniz'de eğit, Türkiye'yi holdout bırak."*
 *
 * Tam indirme kabaca 2.200 istek ve yüz megabaytlarca JSON. Körlemesine
 * başlamak yerine ÖNCE bir yıl + iki kutu ölçülüyor: tespit sayısı, bayt,
 * istek başına süre. Sonra tam işin maliyeti aritmetikle çıkıyor.
 *
 * Bu projede aynı disiplin daha önce de işe yaradı: Yunanistan kapsamı
 * eklenirken "payload 2 MB olur" korkusu ölçümle düştü (brotli %92), ve
 * Open-Meteo ızgarası ölçülmeden seyreltilmedi.
 *
 * Koşum: node scratchpad/isabet/21-akdeniz-boyut.mjs
 */
import { readFileSync } from "node:fs";
import { KUTULAR } from "./21-kutular.mjs";

const KEY = readFileSync("C:/Users/milya/Desktop/00-Projeler/algow-yangin/.env.local", "utf8")
  .match(/FIRMS_MAP_KEY=(\S+)/)[1];

/**
 * Havza, dört kutuya bölündü. Tek dev kutu (-10..46) yarısı deniz ve Sahra
 * olurdu; FIRMS ücretsiz kotasını boş alana harcamamak için ülke gruplarına
 * ayrıldı. Kenarlarda bilinçli örtüşme var — tespitler (lon,lat,dt) ile
 * tekilleştiriliyor, çift sayma olmuyor.
 */
// KUTULAR artık yan etkisiz 21-kutular.mjs dosyasında (import yan etkisi dersi).

/** VIIRS 375 m, standart işleme. NOAA-21 yok: 2023'te başladı, eski sezonları yapay düşük gösterirdi. */
const KAYNAK = ["VIIRS_SNPP_SP", "VIIRS_NOAA20_SP"];
/** FIRMS area API tek istekte en fazla 5 gün (global sınır, ölçüldü). */
const GUN = 5;

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

function sezonIsleri(yil, bbox) {
  const isler = [];
  let d = new Date(Date.UTC(yil, 4, 1)); // 1 Mayıs
  const son = Date.UTC(yil, 8, 30); // 30 Eylül
  while (d.getTime() < son) {
    for (const src of KAYNAK) isler.push({ src, bbox, tarih: d.toISOString().slice(0, 10) });
    d = new Date(d.getTime() + GUN * 86400_000);
  }
  return isler;
}

async function cek({ src, bbox, tarih }, tries = 3) {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/${src}/${bbox}/${GUN}/${tarih}`;
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      const txt = await r.text();
      if (!r.ok || !txt.includes("latitude")) throw new Error(`HTTP ${r.status} ${txt.slice(0, 50)}`);
      return txt;
    } catch (e) {
      if (t === tries - 1) return { hata: e.message };
      await sleep(3000 * (t + 1));
    }
  }
}

/** Satır sayısı ve baytı ölçmek için tam ayrıştırma gerekmiyor. */
function say(csv) {
  let n = 0;
  for (let i = 0; i < csv.length; i++) if (csv.charCodeAt(i) === 10) n++;
  return Math.max(0, n - 1); // başlık satırı
}

const YIL = Number(process.env.YIL ?? 2023);
const HEDEF = (process.env.KUTU ?? "balkan,iberya").split(",");

process.stdout.write(
  `PAN-AKDENİZ BOYUT ÖLÇÜMÜ · yıl ${YIL} · kutular: ${HEDEF.join(", ")}\n` +
    `pencere 1 May – 30 Eyl · kaynak ${KAYNAK.join(" + ")}\n\n`
);

const ozet = [];
for (const ad of HEDEF) {
  const bbox = KUTULAR[ad];
  if (!bbox) {
    process.stdout.write(`! bilinmeyen kutu: ${ad}\n`);
    continue;
  }
  const isler = sezonIsleri(YIL, bbox);
  const t0 = Date.now();
  let tespit = 0;
  let bayt = 0;
  let hata = 0;
  let bitti = 0;
  const q = isler.slice();
  async function isci() {
    while (q.length) {
      const j = q.shift();
      const r = await cek(j);
      if (typeof r === "string") {
        tespit += say(r);
        bayt += r.length;
      } else hata++;
      bitti++;
      if (bitti % 10 === 0)
        process.stdout.write(`\r  ${ad}: ${bitti}/${isler.length} istek · ${tespit} tespit   `);
    }
  }
  await Promise.all(Array.from({ length: 4 }, isci));
  const sn = (Date.now() - t0) / 1000;
  process.stdout.write(
    `\r  ${ad}: ${isler.length} istek · ${tespit} tespit · CSV ${(bayt / 1e6).toFixed(1)} MB · ` +
      `${sn.toFixed(0)} sn · ${hata} hata\n`
  );
  ozet.push({ ad, istek: isler.length, tespit, mb: bayt / 1e6, sn, hata });
}

/* ── Tam işin maliyeti: ölçülenden aritmetikle ── */
const YILLAR = 2026 - 2018 + 1; // 2018–2026
const tumKutu = Object.keys(KUTULAR).length;
const olculenIstek = ozet.reduce((s, o) => s + o.istek, 0);
const olculenTespit = ozet.reduce((s, o) => s + o.tespit, 0);
const olculenSn = ozet.reduce((s, o) => s + o.sn, 0);
const kutuBasi = ozet.length ? olculenTespit / ozet.length : 0;

process.stdout.write(
  `\n${"═".repeat(70)}\nTAM İŞİN TAHMİNİ (2018–2026, ${tumKutu} kutu)\n${"═".repeat(70)}\n` +
    `  istek      : ${(olculenIstek / ozet.length) * tumKutu * YILLAR} ` +
    `(ölçülen ${olculenIstek} istek ${olculenSn.toFixed(0)} sn sürdü)\n` +
    `  süre       : ~${(((olculenSn / ozet.length) * tumKutu * YILLAR) / 60).toFixed(0)} dk\n` +
    `  tespit     : ~${((kutuBasi * tumKutu * YILLAR) / 1e6).toFixed(1)} milyon\n` +
    `  ham CSV    : ~${((ozet.reduce((s, o) => s + o.mb, 0) / ozet.length) * tumKutu * YILLAR / 1000).toFixed(1)} GB\n` +
    `\n⚠️ Bellek: ${((kutuBasi * tumKutu * YILLAR) / 1e6).toFixed(1)}M nesneyi tek dizide tutmak Node'da\n` +
    `   1-2 GB eder. Tam indirme YIL BAŞINA AYRI DOSYAYA yazılmalı, vaka\n` +
    `   üretimi de yıl yıl yapılmalı (vakalar küçük, sonunda birleştirilir).\n`
);
