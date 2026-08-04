/**
 * 01 — FIRMS arşivinden geniş örneklem topla.
 * 3 VIIRS platformu (375 m) × 5 günlük pencereler × ~2 ay.
 * MODIS bilerek DIŞARIDA: 1 km piksel, "yeni yanan alan" geometrisini bozar.
 */
import { readFileSync, writeFileSync } from "node:fs";

const OUT = new URL("./detections.json", import.meta.url).pathname.replace(/^\//, "");
const KEY = readFileSync(
  "C:/Users/milya/Desktop/00-Projeler/algow-yangin/.env.local",
  "utf8"
).match(/FIRMS_MAP_KEY=(\S+)/)[1];

const BBOX = "25.0,34.8,45.5,42.6";
const SRC = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"];

// 2 aylık NRT arşivi: 5 günlük pencereler (FIRMS bu bbox'ta dayRange<=5 kabul ediyor)
const START = new Date("2026-06-02T00:00:00Z");
const WINDOWS = [];
for (let i = 0; i < 12; i++) {
  const d = new Date(START.getTime() + i * 5 * 86400_000);
  WINDOWS.push(d.toISOString().slice(0, 10));
}

const jobs = [];
for (const s of SRC) for (const w of WINDOWS) jobs.push({ src: s, date: w });

async function fetchOne({ src, date }, tries = 3) {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/${src}/${BBOX}/5/${date}`;
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(90_000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const txt = await r.text();
      if (txt.startsWith("Invalid") || !txt.includes("latitude")) throw new Error(txt.slice(0, 60));
      return txt;
    } catch (e) {
      if (t === tries - 1) {
        process.stdout.write(`  ✗ ${src} ${date}: ${e.message}\n`);
        return null;
      }
      await new Promise((s) => setTimeout(s, 3000 * (t + 1)));
    }
  }
}

function parse(csv, src) {
  const lines = csv.trim().split("\n");
  const head = lines[0].split(",");
  const ix = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    const lat = +c[ix.latitude];
    const lon = +c[ix.longitude];
    const frp = +c[ix.frp];
    const conf = c[ix.confidence];
    const time = c[ix.acq_time].padStart(4, "0");
    const dt = Date.parse(`${c[ix.acq_date]}T${time.slice(0, 2)}:${time.slice(2)}:00Z`);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(dt)) continue;
    if (conf === "l") continue; // düşük güvenli tespitleri ele
    out.push({ lon: +lon.toFixed(5), lat: +lat.toFixed(5), frp, dt, sat: src.slice(6, 9) });
  }
  return out;
}

const CONC = 4;
const all = [];
let done = 0;
async function worker(queue) {
  while (queue.length) {
    const job = queue.shift();
    const csv = await fetchOne(job);
    if (csv) all.push(...parse(csv, job.src));
    done++;
    process.stdout.write(`\r  ${done}/${jobs.length} pencere · ${all.length} tespit   `);
  }
}

process.stdout.write(`FIRMS arşivi çekiliyor (${jobs.length} istek)...\n`);
const q = jobs.slice();
await Promise.all(Array.from({ length: CONC }, () => worker(q)));
process.stdout.write("\n");

// Aynı piksel birden fazla pencerede gelebilir → tekilleştir
const seen = new Set();
const uniq = [];
for (const p of all) {
  const k = `${p.lon},${p.lat},${p.dt}`;
  if (seen.has(k)) continue;
  seen.add(k);
  uniq.push(p);
}
uniq.sort((a, b) => a.dt - b.dt);

const days = new Set(uniq.map((p) => new Date(p.dt).toISOString().slice(0, 10)));
process.stdout.write(
  `Toplam ${all.length} → tekil ${uniq.length} tespit · ${days.size} farklı gün\n` +
    `Aralık: ${new Date(uniq[0].dt).toISOString().slice(0, 10)} → ${new Date(uniq[uniq.length - 1].dt).toISOString().slice(0, 10)}\n`
);
writeFileSync(OUT, JSON.stringify(uniq));
process.stdout.write(`Yazıldı: detections.json\n`);
