/**
 * 04 — CORINE Land Cover 2018 (EEA WMS) ile yakıt sınıfı.
 * Vaka merkezinde + 4 komşuda örneklenip çoğunluk oyu alınır (yangın 3 km'lik
 * bir küme; tek piksel yanıltabilir).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

const WMS = "https://image.discomap.eea.europa.eu/arcgis/services/Corine/CLC2018_WM/MapServer/WMSServer";

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
      const m = txt.match(/CODE_18;[\s\S]*?;(\d{3});?\s*$/m) || txt.match(/;(\d{3});\s*$/m);
      if (m) return +m[1];
      const m2 = [...txt.matchAll(/(\d{3})\s*;?\s*$/gm)];
      if (m2.length) return +m2[m2.length - 1][1];
      return null;
    } catch {
      if (t === tries - 1) return null;
      await sleep(1200 * (t + 1));
    }
  }
}

/** CLC kodu → yakıt sınıfı + Rothermel parametreleri */
export function yakitOf(code) {
  if (code === null || code === undefined) return null;
  const c = +code;
  if (c >= 311 && c <= 313) return "ORMAN";
  if (c === 324) return "ORMAN";          // geçiş ormanı/çalılık
  if (c === 323 || c === 322) return "MAKI"; // sert yapraklı bitki örtüsü / funda
  if (c === 321) return "OT";               // doğal çayır
  if (c === 231 || (c >= 211 && c <= 244)) return "TARIM";
  if (c >= 331 && c <= 335) return "CIPLAK";
  if (c >= 400) return "SU";
  if (c < 200) return "YAPI";
  return "DIGER";
}

const cases = JSON.parse(readFileSync(here("cases.json"), "utf8"));
const key = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
const locs = [...new Map(cases.map((c) => [key(c), c])).values()];

let clc = existsSync(here("clc.json")) ? JSON.parse(readFileSync(here("clc.json"), "utf8")) : {};
const need = locs.filter((c) => !clc[key(c)]);
process.stdout.write(`${locs.length} konum · ${need.length} çekilecek\n`);

const OFF = [[0, 0], [0.012, 0], [-0.012, 0], [0, 0.015], [0, -0.015]];
let done = 0;
const CONC = 4;
const queue = need.slice();
async function worker() {
  while (queue.length) {
    const c = queue.shift();
    const codes = [];
    for (const [dlat, dlon] of OFF) codes.push(await clcAt(c.lon + dlon, c.lat + dlat));
    const cls = codes.map(yakitOf).filter(Boolean);
    const tally = {};
    for (const k of cls) tally[k] = (tally[k] ?? 0) + 1;
    const dom = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    clc[key(c)] = { codes, sinif: dom ? dom[0] : null, oran: dom ? dom[1] / cls.length : 0 };
    done++;
    if (done % 10 === 0) {
      writeFileSync(here("clc.json"), JSON.stringify(clc));
      process.stdout.write(`\r  ${done}/${need.length}   `);
    }
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
writeFileSync(here("clc.json"), JSON.stringify(clc));
process.stdout.write(`\n`);

const tally = {};
for (const c of cases) {
  const s = clc[key(c)]?.sinif ?? "BILINMIYOR";
  tally[s] = (tally[s] ?? 0) + 1;
}
process.stdout.write("Vakaların yakıt dağılımı:\n");
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1]))
  process.stdout.write(`  ${k.padEnd(12)} ${v}\n`);
