/**
 * 03b — Doğal yakıt vakaları için çevre verisi.
 *   A) ERA5 saatlik rüzgâr/sıcaklık/nem (archive-api, tüm yıllar için tutarlı kaynak)
 *   B) Copernicus DEM eğimi, 1 km ve 300 m ölçeklerde
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

async function getJson(url, tries = 5) {
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (r.status === 429 || r.status >= 500) throw new Error("HTTP " + r.status);
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 150));
      return await r.json();
    } catch (e) {
      if (t === tries - 1) throw e;
      await sleep(20_000 * (t + 1));
    }
  }
}

const cases = JSON.parse(readFileSync(here("cases-wild.json"), "utf8"));
const yearOf = (c) => new Date(c.t0).getUTCFullYear();

/* ── A) ERA5 rüzgâr ── */
const wkey = (c) =>
  `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${yearOf(c)}`;
const wlocs = [...new Set(cases.map(wkey))];
let wind = existsSync(here("wind-w.json")) ? JSON.parse(readFileSync(here("wind-w.json"), "utf8")) : {};
const wneed = wlocs.filter((k) => !wind[k]);
process.stdout.write(`${wlocs.length} rüzgâr (konum×yıl) · ${wneed.length} çekilecek\n`);

// aynı yılı paylaşanları grupla (tek istekte çok konum)
const byYear = {};
for (const k of wneed) {
  const [loc, y] = k.split("|");
  (byYear[y] ??= []).push(loc);
}
for (const [y, locs] of Object.entries(byYear)) {
  for (let i = 0; i < locs.length; i += 12) {
    const b = locs.slice(i, i + 12);
    const d = await getJson(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${b.map((k) => k.split(",")[0]).join(",")}` +
        `&longitude=${b.map((k) => k.split(",")[1]).join(",")}` +
        `&start_date=${y}-05-20&end_date=${[`${y}-09-30`, new Date(Date.now()-864e5).toISOString().slice(0,10)].sort()[0]}` +
        `&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m` +
        `&wind_speed_unit=kmh&timezone=UTC`
    );
    const arr = Array.isArray(d) ? d : [d];
    arr.forEach((loc, k) => {
      wind[`${b[k]}|${y}`] = {
        t0: Date.parse(loc.hourly.time[0] + "Z"),
        spd: loc.hourly.wind_speed_10m,
        dir: loc.hourly.wind_direction_10m,
        tmp: loc.hourly.temperature_2m,
        rh: loc.hourly.relative_humidity_2m,
      };
    });
    writeFileSync(here("wind-w.json"), JSON.stringify(wind));
    process.stdout.write(`\r  rüzgâr ${y}: ${Math.min(i + 12, locs.length)}/${locs.length}   `);
    await sleep(4000);
  }
}
process.stdout.write("\n");

/* ── B) eğim ── */
const SC = { reg: 0.009, loc: 0.0027 };
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
const elocs = [...new Map(cases.map((c) => [ekey(c), c])).values()];
let elev = existsSync(here("elev-w.json")) ? JSON.parse(readFileSync(here("elev-w.json"), "utf8")) : {};
const eneed = elocs.filter((c) => !elev[ekey(c)]);
process.stdout.write(`${elocs.length} eğim konumu · ${eneed.length} çekilecek\n`);

const stencil = (c) => {
  const p = [[c.lat, c.lon]];
  for (const s of [SC.reg, SC.loc]) {
    const dl = s / Math.cos(toRad(c.lat));
    p.push([c.lat + s, c.lon], [c.lat - s, c.lon], [c.lat, c.lon + dl], [c.lat, c.lon - dl]);
  }
  return p;
};

for (let i = 0; i < eneed.length; i += 11) {
  const b = eneed.slice(i, i + 11);
  const all = b.flatMap(stencil);
  const d = await getJson(
    `https://api.open-meteo.com/v1/elevation?latitude=${all.map((p) => p[0].toFixed(5)).join(",")}` +
      `&longitude=${all.map((p) => p[1].toFixed(5)).join(",")}`
  );
  const z = d.elevation;
  b.forEach((c, k) => {
    const q = z.slice(k * 9, k * 9 + 9);
    const out = { z: q[0] };
    for (const [tag, off, s] of [["reg", 1, SC.reg], ["loc", 5, SC.loc]]) {
      const [zN, zS, zE, zW] = [q[off], q[off + 1], q[off + 2], q[off + 3]];
      const dd = s * 111_320 * 2;
      const gy = (zN - zS) / dd, gx = (zE - zW) / dd;
      const mag = Math.hypot(gx, gy);
      out[tag] = {
        egim: +(mag * 100).toFixed(2),
        aci: +toDeg(Math.atan(mag)).toFixed(2),
        yokus: +(((toDeg(Math.atan2(gx, gy)) + 360) % 360)).toFixed(1),
      };
    }
    elev[ekey(c)] = out;
  });
  writeFileSync(here("elev-w.json"), JSON.stringify(elev));
  process.stdout.write(`\r  eğim ${Math.min(i + 11, eneed.length)}/${eneed.length}   `);
  await sleep(5000);
}
process.stdout.write("\nTamam.\n");
const eg = Object.values(elev).map((e) => e.reg.egim).sort((a, b) => a - b);
process.stdout.write(
  `Eğim (1 km): medyan %${eg[Math.floor(eg.length / 2)]} · %75 ${eg[Math.floor(eg.length * 0.75)]} · max ${eg.at(-1)}\n`
);
