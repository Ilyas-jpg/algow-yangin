/**
 * 03 — Vakaların çevre verisi.
 *   A) Saatlik rüzgâr/sıcaklık/nem serisi (Open-Meteo, 2 Haz–1 Ağu tamamı)
 *   B) Eğim + yokuş-yukarı yönü (Copernicus DEM, Open-Meteo Elevation)
 *      iki ölçekte: ~1 km (bölgesel) ve ~300 m (yerel) — duyarlılık için
 * Sonuçlar önbelleğe yazılır; yeniden çalıştırma ucuz.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

async function getJson(url, tries = 4) {
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (r.status === 429 || r.status >= 500) throw new Error("HTTP " + r.status);
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 120));
      return await r.json();
    } catch (e) {
      if (t === tries - 1) throw e;
      await sleep(20000 * (t + 1));
    }
  }
}

const cases = JSON.parse(readFileSync(here("cases.json"), "utf8"));

/* ─────────── A) rüzgâr ─────────── */
const wkey = (c) => `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}`;
const wlocs = [...new Set(cases.map(wkey))];
process.stdout.write(`${wlocs.length} benzersiz rüzgâr konumu\n`);

let wind = existsSync(here("wind.json")) ? JSON.parse(readFileSync(here("wind.json"), "utf8")) : {};
const wneed = wlocs.filter((k) => !wind[k]);
for (let i = 0; i < wneed.length; i += 15) {
  const b = wneed.slice(i, i + 15);
  const lats = b.map((k) => k.split(",")[0]).join(",");
  const lons = b.map((k) => k.split(",")[1]).join(",");
  const d = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
      `&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m` +
      `&wind_speed_unit=kmh&start_date=2026-06-02&end_date=2026-08-01&timezone=UTC`
  );
  const arr = Array.isArray(d) ? d : [d];
  arr.forEach((loc, k) => {
    wind[b[k]] = {
      t0: Date.parse(loc.hourly.time[0] + "Z"),
      spd: loc.hourly.wind_speed_10m,
      dir: loc.hourly.wind_direction_10m,
      tmp: loc.hourly.temperature_2m,
      rh: loc.hourly.relative_humidity_2m,
    };
  });
  process.stdout.write(`\r  rüzgâr ${Math.min(i + 15, wneed.length)}/${wneed.length}   `);
  writeFileSync(here("wind.json"), JSON.stringify(wind));
  await sleep(1200);
}
process.stdout.write(`\n`);

/* ─────────── B) eğim ─────────── */
// ölçek başına 4 komşu; merkez de alınır (yükseklik bağlamı için)
const SCALES = { reg: 0.009, loc: 0.0027 }; // ° enlem ≈ 1000 m / 300 m
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
const elocs = [...new Map(cases.map((c) => [ekey(c), c])).values()];
process.stdout.write(`${elocs.length} benzersiz eğim konumu\n`);

let elev = existsSync(here("elev.json")) ? JSON.parse(readFileSync(here("elev.json"), "utf8")) : {};
const eneed = elocs.filter((c) => !elev[ekey(c)]);

function stencil(c) {
  const pts = [[c.lat, c.lon]];
  for (const s of [SCALES.reg, SCALES.loc]) {
    const dLon = s / Math.cos(toRad(c.lat));
    pts.push([c.lat + s, c.lon], [c.lat - s, c.lon], [c.lat, c.lon + dLon], [c.lat, c.lon - dLon]);
  }
  return pts; // 9 nokta
}

for (let i = 0; i < eneed.length; i += 11) {
  const b = eneed.slice(i, i + 11); // 11×9 = 99 ≤ 100
  const all = b.flatMap(stencil);
  const d = await getJson(
    `https://api.open-meteo.com/v1/elevation?latitude=${all.map((p) => p[0].toFixed(5)).join(",")}` +
      `&longitude=${all.map((p) => p[1].toFixed(5)).join(",")}`
  );
  const z = d.elevation;
  b.forEach((c, k) => {
    const q = z.slice(k * 9, k * 9 + 9);
    const out = { z: q[0] };
    [["reg", 1, SCALES.reg], ["loc", 5, SCALES.loc]].forEach(([tag, off, s]) => {
      const [zN, zS, zE, zW] = [q[off], q[off + 1], q[off + 2], q[off + 3]];
      const dy = s * 111_320 * 2; // m, K-G arası toplam mesafe
      const dx = s * 111_320 * 2; // boylam adımı zaten cos ile ölçeklendi
      const gy = (zN - zS) / dy; // kuzeye doğru artış
      const gx = (zE - zW) / dx; // doğuya doğru artış
      const mag = Math.hypot(gx, gy);
      out[tag] = {
        egim: +(mag * 100).toFixed(2),           // %
        aci: +toDeg(Math.atan(mag)).toFixed(2),  // derece
        yokus: +(((toDeg(Math.atan2(gx, gy)) + 360) % 360)).toFixed(1), // yokuş-yukarı yönü
      };
    });
    elev[ekey(c)] = out;
  });
  process.stdout.write(`\r  eğim ${Math.min(i + 11, eneed.length)}/${eneed.length}   `);
  writeFileSync(here("elev.json"), JSON.stringify(elev));
  await sleep(6000);
}
process.stdout.write(`\nTamam.\n`);

const eg = Object.values(elev).map((e) => e.reg.egim).sort((a, b) => a - b);
process.stdout.write(
  `Eğim dağılımı (1 km ölçek): medyan %${eg[Math.floor(eg.length / 2)]} · ` +
    `%90'lık ${eg[Math.floor(eg.length * 0.9)]} · max ${eg.at(-1)}\n`
);
