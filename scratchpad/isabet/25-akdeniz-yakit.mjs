/**
 * 25 — PAN-AKDENİZ KORPUSU: YAKIT SINIFI (CORINE 2018)
 *
 * Orman/maki ile tarımsal anız yakmayı ayırmak korpusun en kritik süzgeci:
 * P2'de ölçüldü, 3.196 Türkiye vakasının 1.653'ü TARIM'dı ve ayrılmadan
 * yapılan ölçümler zehirliydi. Aynı süzgeç pan-Akdeniz havuzuna da şart.
 *
 * Kaynak ve ayrıştırma 04b-yakit.mjs ile birebir aynı (EEA WMS
 * GetFeatureInfo, anahtarsız). Yeni olan: havuz 2.700 → ~9.000 hücre, o yüzden
 * ARTIMLI KAYIT (her 25 hücrede bir dosyaya yaz) ve yeniden başlatılabilirlik
 * — 21 dakikalık bir işin yarıda kesilip baştan başlaması kabul edilemez.
 *
 * ⚠️ CORINE Avrupa'yı kapsar. Türkiye'nin ~41,4°D doğusu, Kuzey Afrika şeridi
 * ve Kafkasya null döner. Bu bir hata değil kapsam sınırı; null kalan hücre
 * "yakıt bilinmiyor" olarak kalır ve eğitimde o vakalar ayrı ele alınır.
 *
 * Koşum (yeniden başlatılabilir, birkaç kez çağır):
 *   node scratchpad/isabet/25-akdeniz-yakit.mjs
 *   YALNIZ_YONLU=1 node ...   # yalnız yön içeren vakaların hücreleri (daha hızlı)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const WMS =
  "https://image.discomap.eea.europa.eu/arcgis/services/Corine/CLC2018_WM/MapServer/WMSServer";
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const ORTADOGU = new Set(["Irak", "Suriye", "İran"]);

async function clcAt(lon, lat, tries = 3) {
  const d = 0.002;
  const url =
    `${WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=12&QUERY_LAYERS=12` +
    `&STYLES=&SRS=EPSG:4326&BBOX=${lon - d},${lat - d},${lon + d},${lat + d}` +
    `&WIDTH=3&HEIGHT=3&X=1&Y=1&INFO_FORMAT=text/plain&FEATURE_COUNT=1`;
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(45_000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const txt = await r.text();
      const m = [...txt.matchAll(/(\d{3})\s*;?\s*$/gm)];
      return m.length ? +m[m.length - 1][1] : null;
    } catch {
      if (t === tries - 1) return undefined; // undefined = ÇEKİLEMEDİ (tekrar denenecek)
      await sleep(1200 * (t + 1));
    }
  }
}

/* ── ihtiyaç listesi ── */
const cases = [];
for (const f of readdirSync(here(".")).filter((f) => /^vaka-akdeniz-\d{4}\.json$/.test(f)))
  cases.push(...JSON.parse(readFileSync(here(f), "utf8")));

const key = (c) =>
  `${(Math.round(c.lat * 100) / 100).toFixed(2)},${(Math.round(c.lon * 100) / 100).toFixed(2)}`;

let havuz = cases.filter((c) => !ORTADOGU.has(c.bolge));
if (process.env.YALNIZ_YONLU) havuz = havuz.filter((c) => c.cephe !== null);

const hucreler = new Map();
for (const c of havuz) if (!hucreler.has(key(c))) hucreler.set(key(c), c);

const dosya = here("clc-all.json");
const clc = existsSync(dosya) ? JSON.parse(readFileSync(dosya, "utf8")) : {};
const eksik = [...hucreler.keys()].filter((k) => clc[k] === undefined);

process.stdout.write(
  `${hucreler.size} benzersiz 1 km hücre · ${clc ? Object.keys(clc).length : 0} zaten var · ` +
    `${eksik.length} çekilecek\n`
);
if (!eksik.length) {
  process.stdout.write("çekilecek hücre yok — tamam\n");
  process.exit(0);
}

const t0 = Date.now();
let done = 0;
let bos = 0;
const q = eksik.slice();
async function isci() {
  while (q.length) {
    const k = q.shift();
    const [lat, lon] = k.split(",").map(Number);
    const kod = await clcAt(lon, lat);
    if (kod === undefined) {
      // Çekilemedi: kaydetme, sonraki koşum yeniden dener.
      bos++;
    } else {
      clc[k] = kod; // null da geçerli cevap: "CORINE burada kapsamıyor"
    }
    if (++done % 25 === 0) {
      writeFileSync(dosya, JSON.stringify(clc));
      process.stdout.write(
        `\r  ${done}/${eksik.length} · ${((Date.now() - t0) / 1000).toFixed(0)} sn · çekilemeyen ${bos}   `
      );
    }
  }
}
await Promise.all(Array.from({ length: 6 }, isci));
writeFileSync(dosya, JSON.stringify(clc));
process.stdout.write(
  `\r  ${done} hücre işlendi · ${((Date.now() - t0) / 1000).toFixed(0)} sn · çekilemeyen ${bos}\n` +
    `  clc-all.json: ${Object.keys(clc).length} kayıt\n` +
    (bos ? `  ⚠️ ${bos} hücre çekilemedi — betiği tekrar koştur, kaldığı yerden devam eder\n` : "  ✅ hepsi çekildi\n")
);
