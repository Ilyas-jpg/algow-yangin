/**
 * 03c — Kalan eğim konumları, ucuzlatılmış 5 noktalı kalıp (yalnız 1 km ölçeği).
 * Orman/maki vakaları önce; Open-Meteo saatlik kotasına karşı sabırlı geri çekilme.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const S = 0.009;

async function getJson(url) {
  for (let t = 0; t < 10; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (r.status === 429 || r.status >= 500) throw new Error("HTTP " + r.status);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (t === 9) throw e;
      const w = e.message.includes("429") ? 45_000 : 8_000;
      process.stdout.write(`\n  ${e.message} → ${w / 1000}s bekle (deneme ${t + 1})\n`);
      await sleep(w);
    }
  }
}

const cases = JSON.parse(readFileSync(here("cases-wild.json"), "utf8"));
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
let elev = existsSync(here("elev-w.json")) ? JSON.parse(readFileSync(here("elev-w.json"), "utf8")) : {};

// orman/maki önce
const ordered = [...cases].sort((a, b) => (a.yakit === "OT" ? 1 : 0) - (b.yakit === "OT" ? 1 : 0));
const need = [...new Map(ordered.filter((c) => !elev[ekey(c)]).map((c) => [ekey(c), c])).values()];
process.stdout.write(`${need.length} eksik konum (5 noktalı kalıp)\n`);

for (let i = 0; i < need.length; i += 19) {
  const b = need.slice(i, i + 19);
  const all = b.flatMap((c) => {
    const dl = S / Math.cos(toRad(c.lat));
    return [[c.lat, c.lon], [c.lat + S, c.lon], [c.lat - S, c.lon], [c.lat, c.lon + dl], [c.lat, c.lon - dl]];
  });
  const d = await getJson(
    `https://api.open-meteo.com/v1/elevation?latitude=${all.map((p) => p[0].toFixed(5)).join(",")}` +
      `&longitude=${all.map((p) => p[1].toFixed(5)).join(",")}`
  );
  b.forEach((c, k) => {
    const q = d.elevation.slice(k * 5, k * 5 + 5);
    const dd = S * 111_320 * 2;
    const gy = (q[1] - q[2]) / dd, gx = (q[3] - q[4]) / dd;
    const mag = Math.hypot(gx, gy);
    elev[ekey(c)] = {
      z: q[0],
      reg: {
        egim: +(mag * 100).toFixed(2),
        aci: +toDeg(Math.atan(mag)).toFixed(2),
        yokus: +(((toDeg(Math.atan2(gx, gy)) + 360) % 360)).toFixed(1),
      },
      loc: null,
    };
  });
  writeFileSync(here("elev-w.json"), JSON.stringify(elev));
  process.stdout.write(`\r  ${Math.min(i + 19, need.length)}/${need.length}   `);
  await sleep(7000);
}
process.stdout.write("\nTamam.\n");
const wild = cases.filter((c) => elev[ekey(c)]);
process.stdout.write(`eğim eşleşen vaka: ${wild.length}/${cases.length}\n`);
const eg = wild.filter((c) => c.yakit !== "OT").map((c) => elev[ekey(c)].reg.egim).sort((a, b) => a - b);
process.stdout.write(
  `ORMAN+MAKİ eğimi: medyan %${eg[Math.floor(eg.length / 2)]} · %75 ${eg[Math.floor(eg.length * 0.75)]} · max ${eg.at(-1)}\n`
);
