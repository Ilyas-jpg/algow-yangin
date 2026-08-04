/**
 * 03d — Eğim + yokuş-yukarı yönü, SRTM 30 m (opentopodata).
 * Tüm konumlar tek kaynaktan; Open-Meteo Copernicus ile doğrulandı (±2 m).
 * 5 noktalı kalıp, ~1 km taban (yangının 1–14 saatte kat ettiği ölçek).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const S = 0.009; // ° ≈ 1000 m

async function post(locs) {
  for (let t = 0; t < 6; t++) {
    try {
      const r = await fetch("https://api.opentopodata.org/v1/srtm30m", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locations: locs.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join("|") }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      if (!j.results) throw new Error(JSON.stringify(j).slice(0, 120));
      return j.results.map((x) => x.elevation);
    } catch (e) {
      if (t === 5) throw e;
      await sleep(4000 * (t + 1));
    }
  }
}

const cases = JSON.parse(readFileSync(here("cases-wild.json"), "utf8"));
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
let elev = existsSync(here("elev-srtm.json")) ? JSON.parse(readFileSync(here("elev-srtm.json"), "utf8")) : {};
const need = [...new Map(cases.filter((c) => !elev[ekey(c)]).map((c) => [ekey(c), c])).values()];
process.stdout.write(`${need.length} konum çekilecek (SRTM 30 m)\n`);

for (let i = 0; i < need.length; i += 20) {
  const b = need.slice(i, i + 20);
  const pts = b.flatMap((c) => {
    const dl = S / Math.cos(toRad(c.lat));
    return [[c.lat, c.lon], [c.lat + S, c.lon], [c.lat - S, c.lon], [c.lat, c.lon + dl], [c.lat, c.lon - dl]];
  });
  const z = await post(pts);
  b.forEach((c, k) => {
    const q = z.slice(k * 5, k * 5 + 5);
    if (q.some((v) => v === null || v === undefined)) { elev[ekey(c)] = null; return; }
    const dd = S * 111_320 * 2;
    const gy = (q[1] - q[2]) / dd, gx = (q[3] - q[4]) / dd;
    const mag = Math.hypot(gx, gy);
    elev[ekey(c)] = {
      z: q[0],
      egim: +(mag * 100).toFixed(2),                                  // %
      aci: +toDeg(Math.atan(mag)).toFixed(2),                          // derece
      yokus: +(((toDeg(Math.atan2(gx, gy)) + 360) % 360)).toFixed(1),  // yokuş-yukarı bearing
    };
  });
  writeFileSync(here("elev-srtm.json"), JSON.stringify(elev));
  process.stdout.write(`\r  ${Math.min(i + 20, need.length)}/${need.length}   `);
  await sleep(1300);
}
process.stdout.write("\n");

const ok = cases.filter((c) => elev[ekey(c)]);
process.stdout.write(`eğim eşleşen vaka: ${ok.length}/${cases.length}\n`);
for (const [ad, f] of [["ORMAN+MAKİ", (c) => c.yakit !== "OT"], ["OT", (c) => c.yakit === "OT"]]) {
  const eg = ok.filter(f).map((c) => elev[ekey(c)].egim).sort((a, b) => a - b);
  if (!eg.length) continue;
  process.stdout.write(
    `${ad}: n=${eg.length} eğim medyan %${eg[Math.floor(eg.length / 2)]} · ` +
      `%75 ${eg[Math.floor(eg.length * 0.75)]} · %90 ${eg[Math.floor(eg.length * 0.9)]} · max ${eg.at(-1)}\n`
  );
}
