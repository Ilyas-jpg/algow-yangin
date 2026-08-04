/**
 * 04b — CORINE 2018 yakıt sınıfı, tüm vakalar için (1 km'ye yuvarlanmış tek nokta).
 * Amaç: orman/maki yangınlarını tarımsal anız yakmadan ayırmak.
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
      const m = [...txt.matchAll(/(\d{3})\s*;?\s*$/gm)];
      return m.length ? +m[m.length - 1][1] : null;
    } catch {
      if (t === tries - 1) return null;
      await sleep(1000 * (t + 1));
    }
  }
}

export function yakitOf(code) {
  if (code == null) return null;
  const c = +code;
  if ((c >= 311 && c <= 313) || c === 324) return "ORMAN";
  if (c === 323 || c === 322) return "MAKI";
  if (c === 321 || c === 231 || c === 333) return "OT";
  if (c >= 211 && c <= 244) return "TARIM";
  if (c >= 331 && c <= 335) return "CIPLAK";
  if (c >= 400) return "SU";
  if (c < 200) return "YAPI";
  return "DIGER";
}

const cases = JSON.parse(readFileSync(here("cases-all.json"), "utf8"));
const key = (c) => `${(Math.round(c.lat * 100) / 100).toFixed(2)},${(Math.round(c.lon * 100) / 100).toFixed(2)}`;
const locs = [...new Map(cases.map((c) => [key(c), c])).values()];

let clc = existsSync(here("clc-all.json")) ? JSON.parse(readFileSync(here("clc-all.json"), "utf8")) : {};
const need = locs.filter((c) => clc[key(c)] === undefined);
process.stdout.write(`${locs.length} benzersiz 1 km hücre · ${need.length} çekilecek\n`);

let done = 0;
const q = need.slice();
async function worker() {
  while (q.length) {
    const c = q.shift();
    clc[key(c)] = await clcAt(+key(c).split(",")[1], +key(c).split(",")[0]);
    if (++done % 25 === 0) {
      writeFileSync(here("clc-all.json"), JSON.stringify(clc));
      process.stdout.write(`\r  ${done}/${need.length}   `);
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
writeFileSync(here("clc-all.json"), JSON.stringify(clc));
process.stdout.write("\n");

const tally = {};
for (const c of cases) {
  const s = yakitOf(clc[key(c)]) ?? "BILINMIYOR";
  tally[s] = (tally[s] ?? 0) + 1;
}
process.stdout.write("Vakaların yakıt dağılımı:\n");
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1]))
  process.stdout.write(`  ${k.padEnd(12)} ${String(v).padStart(5)}\n`);
const wild = cases.filter((c) => ["ORMAN", "MAKI", "OT"].includes(yakitOf(clc[key(c)])));
process.stdout.write(`\nDOĞAL YAKIT (orman+maki+ot) vakası: ${wild.length} · farklı olay: ${new Set(wild.map((c) => c.ev)).size}\n`);
