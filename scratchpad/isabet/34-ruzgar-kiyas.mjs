/**
 * 34 — RÜZGÂR KAYNAĞI KIYASI: kalibre ettiğimiz rüzgâr, servis ettiğimiz rüzgâr mı?
 *
 * 🔴 BULGU (2026-08-05): üretim `/api/wind/*` rotaları Open-Meteo'ya `models=`
 * vermiyor → `best_match` → Türkiye'de **ICON-EU ~7 km**. Ama korpus ve TÜM
 * kalibrasyon (k=1,5 · şekil çapaları · yarım açı · %90 kapsama iddiası)
 * arşiv API'sinden **ERA5 ~25 km** ile ölçüldü.
 *
 * Yani kalibre ettiğimizden 3,5 kat ince bir rüzgâr alanıyla servis veriyoruz.
 * Bu oturumda dört kez yakalanan hatanın aynısı: GÖNDERDİĞİNDEN BAŞKA BİR
 * ALETLE ÖLÇMEK.
 *
 * İKİ DENEY:
 *   A) ICON-EU (üretimin gerçekte kullandığı) ↔ ERA5 (kalibre ettiğimiz)
 *      → yayındaki rakamlar canlı sistemi tarif ediyor mu?
 *      Geçmiş tahmin arşivi 2024'e kadar geriye gidiyor → 943 vaka.
 *   B) CERRA 5 km ↔ ERA5 25 km (2018-2020, 433 vaka)
 *      → "daha ince rüzgâr yön hatasını düşürür mü?" WindNinja kararının
 *      bağımsız sınaması.
 *
 * Koşum:
 *   node scratchpad/isabet/34-ruzgar-kiyas.mjs          # ikisi de
 *   MODEL=icon_eu node ...   /   MODEL=cerra node ...   # tek tek
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { yakitOf } from "./04b-yakit-kod.mjs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const SAAT = 3600_000;
const ORTADOGU = new Set(["Irak", "Suriye", "İran"]);
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

/* model → { uç, yıllar, ızgara adımı (konum tekilleştirme için) } */
const MODELLER = {
  icon_eu: {
    uc: "https://historical-forecast-api.open-meteo.com/v1/forecast",
    yillar: [2024, 2025],
    adim: 0.0625, // ~7 km
    ad: "ICON-EU 7 km (ÜRETİMİN KULLANDIĞI)",
  },
  cerra: {
    uc: "https://archive-api.open-meteo.com/v1/archive",
    yillar: [2018, 2019, 2020],
    adim: 0.05, // ~5 km
    ad: "CERRA 5 km",
  },
};

const clc = JSON.parse(readFileSync(here("clc-all.json"), "utf8"));
const era5 = JSON.parse(readFileSync(here("akdeniz-ruzgar.json"), "utf8"));
const ckey = (c) => `${(Math.round(c.lat * 100) / 100).toFixed(2)},${(Math.round(c.lon * 100) / 100).toFixed(2)}`;
const wkey = (c) => `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
const fark = (a, b) => { const d = Math.abs(((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; };
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.floor(s.length / 2)].toFixed(1) : null; };
const p45 = (a) => (a.length ? +((100 * a.filter((x) => x <= 45).length) / a.length).toFixed(1) : null);

const hepsi = [];
for (const f of readdirSync(here(".")).filter((f) => /^vaka-akdeniz-\d{4}\.json$/.test(f)).sort())
  hepsi.push(...JSON.parse(readFileSync(here(f), "utf8")));

async function cek(url, dene = 4) {
  for (let t = 0; t < dene; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (r.status === 429) { await sleep(65_000); throw new Error("429"); }
      if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
      return await r.json();
    } catch (e) {
      if (t === dene - 1) return { hata: String(e.message || e) };
      await sleep(10_000 * (t + 1));
    }
  }
}

async function calis(model) {
  const M = MODELLER[model];
  const dosya = here(`ruzgar-${model}.json`);
  const onbellek = existsSync(dosya) ? JSON.parse(readFileSync(dosya, "utf8")) : {};

  const havuz = hepsi.filter(
    (c) =>
      !ORTADOGU.has(c.bolge) &&
      ["ORMAN", "MAKI"].includes(yakitOf(clc[ckey(c)])) &&
      c.cephe !== null &&
      M.yillar.includes(new Date(c.t0).getUTCFullYear())
  );
  /* konum modelin ızgarasına yuvarlanır — aynı hücreye düşen vakalar tek çekim */
  const yuvarla = (v) => (Math.round(v / M.adim) * M.adim).toFixed(4);
  const key = (c) => `${yuvarla(c.lat)},${yuvarla(c.lon)}|${new Date(c.t0).toISOString().slice(0, 10)}`;

  const gerekli = [...new Set(havuz.map(key))];
  const eksik = gerekli.filter((k) => !onbellek[k]);
  process.stdout.write(
    `\n${"═".repeat(74)}\n${M.ad}\n${"═".repeat(74)}\n` +
      `${havuz.length} vaka · ${gerekli.length} benzersiz (konum×gün) · ${eksik.length} çekilecek\n`
  );

  /* güne göre grupla — tek istekte çok konum ancak aynı tarih aralığıyla olur */
  const gunler = {};
  for (const k of eksik) {
    const [loc, gun] = k.split("|");
    (gunler[gun] ??= []).push(loc);
  }
  const basarisiz = [];
  let istek = 0;
  const t0 = Date.now();
  for (const [gun, konumlar] of Object.entries(gunler)) {
    const son = new Date(Date.parse(gun) + 864e5).toISOString().slice(0, 10);
    for (let i = 0; i < konumlar.length; i += 25) {
      const parti = konumlar.slice(i, i + 25);
      const d = await cek(
        `${M.uc}?latitude=${parti.map((k) => k.split(",")[0]).join(",")}` +
          `&longitude=${parti.map((k) => k.split(",")[1]).join(",")}` +
          `&start_date=${gun}&end_date=${son}` +
          `&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=UTC&models=${model}`
      );
      istek++;
      if (d?.hata) basarisiz.push({ gun, parti, sebep: d.hata });
      else {
        const dizi = Array.isArray(d) ? d : [d];
        if (dizi.length !== parti.length) basarisiz.push({ gun, parti, sebep: `konum ${dizi.length}≠${parti.length}` });
        else
          dizi.forEach((loc, k) => {
            onbellek[`${parti[k]}|${gun}`] = {
              t0: Date.parse(loc.hourly.time[0] + "Z"),
              spd: loc.hourly.wind_speed_10m,
              dir: loc.hourly.wind_direction_10m,
            };
          });
      }
      if (istek % 5 === 0) writeFileSync(dosya, JSON.stringify(onbellek));
      process.stdout.write(`\r  ${istek} istek · ${Object.keys(onbellek).length} kayıt · başarısız ${basarisiz.length}   `);
      await sleep(2500);
    }
  }
  writeFileSync(dosya, JSON.stringify(onbellek));
  process.stdout.write(`\n  ${Object.keys(onbellek).length} kayıt · ${((Date.now() - t0) / 60000).toFixed(1)} dk\n`);
  if (basarisiz.length) {
    writeFileSync(here(`ruzgar-${model}.EKSIK.json`), JSON.stringify(basarisiz, null, 1));
    process.stdout.write(`  ⚠️ ${basarisiz.length} parti çekilemedi → ruzgar-${model}.EKSIK.json\n`);
  }

  /* ── KIYAS: aynı vakalar, iki rüzgâr kaynağı ── */
  const yeniYon = (c) => {
    const w = onbellek[key(c)];
    if (!w) return null;
    const i = Math.round((c.t0 - w.t0) / SAAT);
    if (i < 0 || i >= w.spd.length) return null;
    const s = w.spd[i], d = w.dir[i];
    return typeof s === "number" && typeof d === "number" ? { deg: (d + 180) % 360, kmh: s } : null;
  };
  const eskiYon = (c) => {
    const w = era5[wkey(c)];
    if (!w) return null;
    const i = Math.round((c.t0 - w.t0) / SAAT);
    if (i < 0 || i >= w.spd.length) return null;
    const s = w.spd[i], d = w.dir[i];
    return typeof s === "number" && typeof d === "number" ? { deg: (d + 180) % 360, kmh: s } : null;
  };

  const ciftli = havuz.map((c) => ({ c, yeni: yeniYon(c), eski: eskiYon(c) })).filter((r) => r.yeni && r.eski);
  const hYeni = ciftli.map((r) => fark(r.yeni.deg, r.c.cephe));
  const hEski = ciftli.map((r) => fark(r.eski.deg, r.c.cephe));
  const yonFarki = ciftli.map((r) => fark(r.yeni.deg, r.eski.deg));
  const hizFarki = ciftli.map((r) => r.yeni.kmh - r.eski.kmh);

  process.stdout.write(
    `\n  KIYAS (n=${ciftli.length}, ikisi de dolu olan vakalar)\n` +
      `    ERA5 25 km   medyan hata ${med(hEski)}° · ≤45° %${p45(hEski)}\n` +
      `    ${M.ad.split(" (")[0].padEnd(12)} medyan hata ${med(hYeni)}° · ≤45° %${p45(hYeni)}\n` +
      `    → fark ${(med(hEski) - med(hYeni)).toFixed(1)}° ${med(hYeni) < med(hEski) ? "(yeni kaynak İYİ)" : "(yeni kaynak kötü)"}\n` +
      `\n  İKİ KAYNAK BİRBİRİNDEN NE KADAR FARKLI?\n` +
      `    yön farkı  medyan ${med(yonFarki)}° · %90 ${med(yonFarki.slice().sort((a, b) => a - b).slice(Math.floor(yonFarki.length * 0.9)))}°\n` +
      `    hız farkı  medyan ${med(hizFarki.map(Math.abs))} km/sa\n` +
      (med(yonFarki) < 10
        ? `    → Kaynaklar pratikte AYNI şeyi söylüyor; kalibrasyon uyumsuzluğu zararsız.\n`
        : `    → 🔴 Kaynaklar CİDDİ ayrışıyor — kalibrasyon farklı bir rüzgârla yapılmış.\n`)
  );
  return basarisiz.length;
}

let hata = 0;
for (const m of process.env.MODEL ? [process.env.MODEL] : ["icon_eu", "cerra"]) hata += await calis(m);
if (hata) { process.stdout.write("\n🔴 Eksik parti var — betiği tekrar koştur.\n"); process.exit(1); }
