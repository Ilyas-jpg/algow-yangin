/**
 * 23 — PAN-AKDENİZ VAKA ÜRETİMİ (spec §7.2/§7.3)
 *
 * Girdi: akdeniz-YYYY.json (22-akdeniz-indir.mjs) · Çıktı: vaka-akdeniz-YYYY.json
 *
 * Kümeleme, geçiş ayırma ve altı gerçek-yön ölçütü 13-cephe.mjs ile BİREBİR
 * aynı. 13 referans olarak donduruldu (`merkez` ölçütü paylaşılan 921/921
 * vakada birebir yeniden üretilerek doğrulandı); buradaki kopya bilinçli —
 * 13'ü değiştirmek o doğrulamayı geçersiz kılardı.
 *
 * YENİ olan tek şey BÖLGE etiketi: spec §7.2 "pan-Akdeniz'de eğit, Türkiye'yi
 * holdout bırak" diyor, bunun için her vakanın hangi ülkede olduğu gerekiyor.
 * `places-tr` TR + komşuları + Yunanistan/Balkanlar'ı kapsıyor ama İber ve
 * İtalya'yı kapsamıyor; o yüzden batı için indirme kutusuna düşülüyor.
 *
 * Koşum (yılı yılına):
 *   YIL=2018 node --import ./test/register.mjs scratchpad/isabet/23-akdeniz-vaka.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { progression } from "../../src/lib/progression.ts";
import { yakitOf } from "./04b-yakit-kod.mjs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const R = 6371;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

function havKm(lon1, lat1, lon2, lat2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function bearingDeg(lon1, lat1, lon2, lat2) {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dl = toRad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
function circMean(degs) {
  let x = 0;
  let y = 0;
  for (const d of degs) {
    x += Math.sin(toRad(d));
    y += Math.cos(toRad(d));
  }
  return Math.hypot(x, y) < 1e-9 ? null : (toDeg(Math.atan2(x, y)) + 360) % 360;
}

/* ══ 13-cephe.mjs ile birebir aynı eşikler ══ */
const EPS_KM = 3;
const PASS_GAP_MS = 90 * 60_000;
const MAX_ILER_KM = 15;
const YANMIS_KM = 0.6;
const CELL_DEG = 0.375 / 111;

function cluster(points) {
  const cellDeg = EPS_KM / 111;
  const lonCell = cellDeg / Math.cos(toRad(42.6));
  const cellOf = (lon, lat) => ({ cx: Math.floor(lon / lonCell), cy: Math.floor(lat / cellDeg) });
  const cells = new Map();
  points.forEach((p, i) => {
    const { cx, cy } = cellOf(p.lon, p.lat);
    const k = `${cx}:${cy}`;
    let b = cells.get(k);
    if (!b) cells.set(k, (b = []));
    b.push(i);
  });
  const comp = new Int32Array(points.length).fill(-1);
  let n = 0;
  for (let i = 0; i < points.length; i++) {
    if (comp[i] !== -1) continue;
    const id = n++;
    comp[i] = id;
    const stack = [i];
    while (stack.length) {
      const p = points[stack.pop()];
      const { cx, cy } = cellOf(p.lon, p.lat);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          const b = cells.get(`${cx + dx}:${cy + dy}`);
          if (!b) continue;
          for (const j of b) {
            if (comp[j] !== -1) continue;
            const q = points[j];
            if (havKm(p.lon, p.lat, q.lon, q.lat) <= EPS_KM) {
              comp[j] = id;
              stack.push(j);
            }
          }
        }
    }
  }
  const groups = new Map();
  points.forEach((p, i) => {
    const a = groups.get(comp[i]);
    if (a) a.push(p);
    else groups.set(comp[i], [p]);
  });
  return [...groups.values()];
}

function passesOf(pts) {
  pts.sort((a, b) => a.dt - b.dt);
  const passes = [];
  let g = [];
  const flush = () => {
    if (!g.length) return;
    let sLon = 0;
    let sLat = 0;
    let sFrp = 0;
    for (const x of g) {
      sLon += x.lon;
      sLat += x.lat;
      sFrp += x.frp;
    }
    passes.push({
      t: g[Math.floor(g.length / 2)].dt,
      lon: sLon / g.length,
      lat: sLat / g.length,
      frp: sFrp,
      count: g.length,
      pts: g.slice(),
    });
    g = [];
  };
  for (const p of pts) {
    if (g.length && p.dt - g[g.length - 1].dt > PASS_GAP_MS) flush();
    g.push(p);
  }
  flush();
  return passes;
}

function maskOf(pts) {
  const m = new Map();
  for (const p of pts) {
    const cy = Math.floor(p.lat / CELL_DEG);
    const cx = Math.floor(p.lon / (CELL_DEG / Math.cos(toRad(p.lat))));
    const k = `${cx}:${cy}`;
    if (!m.has(k)) {
      const lat = (cy + 0.5) * CELL_DEG;
      m.set(k, { lon: (cx + 0.5) * (CELL_DEG / Math.cos(toRad(lat))), lat });
    }
  }
  return [...m.values()];
}
const areaCentroid = (cells) => ({
  lon: cells.reduce((s, c) => s + c.lon, 0) / cells.length,
  lat: cells.reduce((s, c) => s + c.lat, 0) / cells.length,
});

function eskiOlcut(a, b) {
  const yeni = b.pts.filter((q) => {
    let dmin = Infinity;
    for (const p of a.pts) {
      const d = havKm(p.lon, p.lat, q.lon, q.lat);
      if (d < dmin) dmin = d;
      if (dmin < YANMIS_KM) return false;
    }
    return dmin <= MAX_ILER_KM;
  });
  if (yeni.length < 2) return { merkez: null, bas: null };
  const cLon = yeni.reduce((s, q) => s + q.lon, 0) / yeni.length;
  const cLat = yeni.reduce((s, q) => s + q.lat, 0) / yeni.length;
  const km = havKm(a.lon, a.lat, cLon, cLat);
  const withD = yeni
    .map((q) => {
      let dmin = Infinity;
      for (const p of a.pts) {
        const d = havKm(p.lon, p.lat, q.lon, q.lat);
        if (d < dmin) dmin = d;
      }
      return { q, d: dmin };
    })
    .sort((x, y) => y.d - x.d);
  const top = withD.slice(0, Math.max(2, Math.ceil(withD.length / 3)));
  const hLon = top.reduce((s, { q }) => s + q.lon, 0) / top.length;
  const hLat = top.reduce((s, { q }) => s + q.lat, 0) / top.length;
  const basKm = havKm(a.lon, a.lat, hLon, hLat);
  const zayif = km < 0.5 && basKm < 0.5;
  return {
    merkez: !zayif && km >= 0.5 ? bearingDeg(a.lon, a.lat, cLon, cLat) : null,
    bas: !zayif && basKm >= 0.5 ? bearingDeg(a.lon, a.lat, hLon, hLat) : null,
  };
}

function cepheOlcut(a, b) {
  const pr = progression(a.pts, b.pts, YANMIS_KM);
  const yeni = pr.newPts.filter((q) => q.growthKm <= MAX_ILER_KM);
  if (yeni.length < 2)
    return { cephe: null, cepheBas: null, alan: null, alanCephe: null, hucreler: [] };
  const cephe = circMean(yeni.map((q) => q.bearingDeg));
  const sirali = [...yeni].sort((x, y) => y.growthKm - x.growthKm);
  const top = sirali.slice(0, Math.max(2, Math.ceil(sirali.length / 3)));
  const ma = maskOf(a.pts);
  const mb = maskOf(b.pts);
  const ca = areaCentroid(ma);
  const cb = areaCentroid(mb);
  const alanKm = havKm(ca.lon, ca.lat, cb.lon, cb.lat);
  const prCell = progression(ma, mb, YANMIS_KM);
  const yeniCell = prCell.newPts.filter((q) => q.growthKm <= MAX_ILER_KM);
  return {
    cephe,
    cepheBas: circMean(top.map((q) => q.bearingDeg)),
    alan: alanKm >= 0.5 ? bearingDeg(ca.lon, ca.lat, cb.lon, cb.lat) : null,
    alanCephe: yeniCell.length >= 2 ? circMean(yeniCell.map((q) => q.bearingDeg)) : null,
    hucreler: yeniCell.map((q) => [Math.round(q.bearingDeg), +q.growthKm.toFixed(2)]),
  };
}

/* ══ BÖLGE etiketi — spec §7.2'nin ülke-holdout protokolü için ══ */
const placesSrc = readFileSync(here("../../src/data/places-tr.ts"), "utf8");
const PLACES = [...placesSrc.matchAll(/\["([^"]+)",\s*"([^"]+)",\s*([\d.]+),\s*([\d.]+)\]/g)].map((m) => ({
  il: m[2],
  lat: +m[3],
  lon: +m[4],
}));
const KOMSU = new Set([
  "Suriye", "Irak", "İran", "Gürcistan", "Ermenistan", "Azerbaycan",
  "Yunanistan", "Bulgaristan", "Kıbrıs", "Arnavutluk", "K. Makedonya",
  "Kosova", "Karadağ", "Sırbistan",
]);

/**
 * Yakın yer tablosu TR + komşuları + Yunanistan/Balkanlar'ı biliyor. 150 km
 * içinde eşleşme varsa ülke oradan; yoksa (İber, İtalya, güney Fransa) kaba
 * boylam eşiğiyle bölge veriliyor. Amaç ülke istatistiği değil, HOLDOUT:
 * "Türkiye mi, değil mi" ayrımının doğru olması yeterli.
 */
function bolgeOf(lon, lat) {
  let best = null;
  let bestKm = Infinity;
  for (const p of PLACES) {
    const d = havKm(lon, lat, p.lon, p.lat);
    if (d < bestKm) {
      bestKm = d;
      best = p;
    }
  }
  if (best && bestKm <= 150) return KOMSU.has(best.il) ? best.il : "Türkiye";
  if (lon < 3.4) return "İber";
  if (lon < 19) return "İtalya/Fransa";
  return "Balkan/Ege";
}

/* ══ koşum ══ */
const YIL = Number(process.env.YIL ?? 0);
if (!YIL) throw new Error("YIL=2018..2025 ver");
const girdi = here(`akdeniz-${YIL}.json`);
const cikti = here(`vaka-akdeniz-${YIL}.json`);
if (!existsSync(girdi)) throw new Error(`${girdi} yok — önce 22-akdeniz-indir.mjs`);
if (existsSync(cikti) && !process.env.ZORLA) {
  process.stdout.write(`vaka-akdeniz-${YIL}.json zaten var — atlanıyor (ZORLA=1 ile ez)\n`);
  process.exit(0);
}

const points = JSON.parse(readFileSync(girdi, "utf8"));
process.stdout.write(`${YIL}: ${points.length} tespit kümeleniyor...\n`);
const t0 = Date.now();
const groups = cluster(points);
process.stdout.write(`  ${groups.length} ham küme\n`);

const clc = JSON.parse(readFileSync(here("clc-all.json"), "utf8"));
const ckey = (lat, lon) =>
  `${(Math.round(lat * 100) / 100).toFixed(2)},${(Math.round(lon * 100) / 100).toFixed(2)}`;

const cases = [];
let evId = 0;
let cift = 0;
for (const g of groups) {
  if (g.length < 6) continue;
  const ps = passesOf(g);
  if (ps.length < 2) continue;
  if (Math.max(...ps.map((p) => p.frp)) < 30) continue;
  let lo0 = Infinity, la0 = Infinity, lo1 = -Infinity, la1 = -Infinity;
  for (const p of g) {
    if (p.lon < lo0) lo0 = p.lon;
    if (p.lon > lo1) lo1 = p.lon;
    if (p.lat < la0) la0 = p.lat;
    if (p.lat > la1) la1 = p.lat;
  }
  const spanKm = havKm(lo0, la0, lo1, la1);
  if (spanKm > 40) continue;

  const id = `${YIL}-${evId++}`;
  const bolge = bolgeOf(ps[0].lon, ps[0].lat);
  const yons = [];
  for (let i = 0; i + 1 < ps.length; i++) {
    const a = ps[i];
    const b = ps[i + 1];
    const hours = (b.t - a.t) / 3600_000;
    yons.push({
      i,
      hours,
      ok: a.count >= 3 && b.count >= 3 && hours >= 0.5 && hours <= 14,
      ...eskiOlcut(a, b),
      ...cepheOlcut(a, b),
    });
    if (++cift % 2000 === 0) process.stdout.write(`\r  ${cift} geçiş çifti   `);
  }
  for (let i = 0; i < yons.length; i++) {
    const y = yons[i];
    if (!y.ok) continue;
    const a = ps[y.i];
    const prev = i > 0 ? yons[i - 1] : null;
    cases.push({
      ev: id,
      bolge,
      spanKm: +spanKm.toFixed(1),
      lon: +a.lon.toFixed(4),
      lat: +a.lat.toFixed(4),
      t0: a.t,
      t1: ps[y.i + 1].t,
      hours: +y.hours.toFixed(2),
      // CORINE yalnız Türkiye korpusu için çekilmişti; batıda çoğu null olacak.
      // Yakıt ayrı bir adımda (24) doldurulacak.
      yakit: yakitOf(clc[ckey(a.lat, a.lon)]),
      merkez: y.merkez,
      bas: y.bas,
      cephe: y.cephe,
      cepheBas: y.cepheBas,
      alan: y.alan,
      alanCephe: y.alanCephe,
      hucreler: y.hucreler,
      prev: prev
        ? {
            merkez: prev.merkez, bas: prev.bas, cephe: prev.cephe,
            cepheBas: prev.cepheBas, alan: prev.alan, alanCephe: prev.alanCephe,
          }
        : null,
    });
  }
}
writeFileSync(cikti, JSON.stringify(cases));

const bolgeSay = {};
for (const c of cases) bolgeSay[c.bolge] = (bolgeSay[c.bolge] ?? 0) + 1;
const yonlu = cases.filter((c) => c.cephe !== null).length;
process.stdout.write(
  `\r${YIL}: ${evId} olay · ${cases.length} vaka (${yonlu} yön içeren) · ` +
    `${((Date.now() - t0) / 1000).toFixed(0)} sn\n  bölge: ${Object.entries(bolgeSay)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join(" · ")}\n`
);
