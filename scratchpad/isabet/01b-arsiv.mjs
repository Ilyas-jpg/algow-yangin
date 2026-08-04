/**
 * 01b — FIRMS SP (standart işleme) arşivinden 5 yangın sezonu.
 * VIIRS_SNPP_SP 2012'ye, VIIRS_NOAA20_SP 2018'e kadar açık.
 * 375 m piksel korunuyor (MODIS yok).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const KEY = readFileSync("C:/Users/milya/Desktop/00-Projeler/algow-yangin/.env.local", "utf8")
  .match(/FIRMS_MAP_KEY=(\S+)/)[1];

const BBOX = "25.0,34.8,45.5,42.6";
const YEARS = [2021, 2022, 2023, 2024, 2025];
const SRC = ["VIIRS_SNPP_SP", "VIIRS_NOAA20_SP"];

const jobs = [];
for (const y of YEARS) {
  let d = new Date(Date.UTC(y, 4, 25)); // 25 Mayıs
  const end = Date.UTC(y, 8, 25); // 25 Eylül
  while (d.getTime() < end) {
    for (const s of SRC) jobs.push({ src: s, date: d.toISOString().slice(0, 10) });
    d = new Date(d.getTime() + 5 * 86400_000);
  }
}

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
async function fetchOne({ src, date }, tries = 3) {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/${src}/${BBOX}/5/${date}`;
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const txt = await r.text();
      if (!txt.includes("latitude")) throw new Error(txt.slice(0, 60));
      return txt;
    } catch (e) {
      if (t === tries - 1) { process.stdout.write(`\n  ✗ ${src} ${date}: ${e.message}\n`); return null; }
      await sleep(4000 * (t + 1));
    }
  }
}

function parse(csv, src) {
  const lines = csv.trim().split("\n");
  const ix = Object.fromEntries(lines[0].split(",").map((h, i) => [h.trim(), i]));
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    const lat = +c[ix.latitude], lon = +c[ix.longitude], frp = +c[ix.frp];
    if (c[ix.confidence] === "l") continue;
    const time = String(c[ix.acq_time]).padStart(4, "0");
    const dt = Date.parse(`${c[ix.acq_date]}T${time.slice(0, 2)}:${time.slice(2)}:00Z`);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(dt)) continue;
    out.push({ lon: +lon.toFixed(5), lat: +lat.toFixed(5), frp, dt, sat: src.includes("NOAA20") ? "N20" : "SNP" });
  }
  return out;
}

const all = [];
let done = 0;
const q = jobs.slice();
async function worker() {
  while (q.length) {
    const j = q.shift();
    const csv = await fetchOne(j);
    if (csv) all.push(...parse(csv, j.src));
    done++;
    if (done % 5 === 0) process.stdout.write(`\r  ${done}/${jobs.length} · ${all.length} tespit   `);
  }
}
process.stdout.write(`${jobs.length} arşiv isteği (${YEARS.join(", ")} sezonları)...\n`);
await Promise.all(Array.from({ length: 4 }, worker));
process.stdout.write("\n");

const seen = new Set();
const uniq = [];
for (const p of all) {
  const k = `${p.lon},${p.lat},${p.dt}`;
  if (seen.has(k)) continue;
  seen.add(k);
  uniq.push(p);
}
// 2026 NRT verisiyle birleştir
if (existsSync(here("detections.json"))) {
  for (const p of JSON.parse(readFileSync(here("detections.json"), "utf8"))) {
    const k = `${p.lon},${p.lat},${p.dt}`;
    if (!seen.has(k)) { seen.add(k); uniq.push(p); }
  }
}
uniq.sort((a, b) => a.dt - b.dt);
const byYear = {};
for (const p of uniq) { const y = new Date(p.dt).getUTCFullYear(); byYear[y] = (byYear[y] ?? 0) + 1; }
process.stdout.write(`Tekil ${uniq.length} tespit · yıllara göre: ${JSON.stringify(byYear)}\n`);
writeFileSync(here("detections-all.json"), JSON.stringify(uniq));
