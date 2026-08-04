/**
 * 13 — CEPHE TANIMI (spec §6.2)
 *
 * Spec: "Yönü kütle merkezinden değil, son geçiş tespitlerinin concave hull'u
 * (aktif cephe) ile bir önceki hull arasındaki yer değiştirmeden hesapla.
 * 232 örneklik ölçümü bu tanımla yeniden koş — 68° sırf tanım değişikliğiyle
 * düşebilir."
 *
 * 02-vakalar.mjs'in ölçütü ÇAPA OLARAK a geçişinin kütle merkezini kullanıyor:
 *   yeniYon = bearing(a.merkez → yeni piksellerin merkezi)
 * Bu, yangının BOYUNU yön ölçüsüne karıştırır: 30 km genişlikte bir yangında
 * karşı kanattaki yeni piksel, merkezden bakınca bambaşka bir yön verir.
 * Üretimdeki `src/lib/progression.ts` bunu zaten düzeltmiş: her yeni piksel
 * KENDİ en yakın yanmış pikselinden ölçülüyor (o düzeltme aynı veride 109°→78°
 * getirmişti). Burada iki soy hattını tek ölçümde yan yana koyuyoruz.
 *
 * concave hull yerine HÜCRE MASKESİ: yanmış ayak izi, 375 m'lik VIIRS
 * hücrelerinin birleşimidir — dış çeperi tanım gereği içbükeydir ve
 * uydurulacak bir alpha parametresi yoktur. Maske ayrıca tespit YOĞUNLUĞUNU
 * da nötrler (aynı hücrede 20 tespit bir kez sayılır); k-en-yakın-komşu
 * concave hull'un tek bir aykırı köşeye duyarlılığı da yok.
 *
 * ⚠️ ÖLÇÜT SEÇİMİ HATAYI KÜÇÜLTMEYE GÖRE YAPILMAZ. Bu, 08-kapsama.mjs'de
 * yaşanan "kendi kendini doğrulayan iddia" tuzağının aynısı olur. Doğru ölçüt
 * ÖNCEDEN gerekçelendirilir (boyuttan bağımsız olan), çıkan sayı ne ise odur.
 * Tanımlar arası fark, 68°'nin ne kadarının tanım gürültüsü olduğunu söyler.
 *
 * Koşum:  node --import ./test/register.mjs scratchpad/isabet/13-cephe.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
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
/** Dairesel ortalama — 359° ile 1° komşudur, aritmetik ortalama ters yön verir. */
function circMean(degs) {
  let x = 0;
  let y = 0;
  for (const d of degs) {
    x += Math.sin(toRad(d));
    y += Math.cos(toRad(d));
  }
  return Math.hypot(x, y) < 1e-9 ? null : (toDeg(Math.atan2(x, y)) + 360) % 360;
}

/* ══ 02-vakalar.mjs ile BİREBİR aynı kümeleme/geçiş mantığı ══
   (kopya bilinçli: 02 referans olarak donduruldu, oradaki eşikler
   değişirse bu ölçüm kıyaslanabilirliğini kaybeder) */
const EPS_KM = 3;
const PASS_GAP_MS = 90 * 60_000;
const MAX_ILER_KM = 15;
const YANMIS_KM = 0.6; // "zaten yanmış alanın içinde" eşiği

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

/* ══ hücre maskesi: 375 m VIIRS hücresi ══ */
const CELL_DEG = 0.375 / 111; // enlemde 375 m
function maskOf(pts) {
  const m = new Map();
  for (const p of pts) {
    const cy = Math.floor(p.lat / CELL_DEG);
    const cx = Math.floor(p.lon / (CELL_DEG / Math.cos(toRad(p.lat))));
    const k = `${cx}:${cy}`;
    if (!m.has(k)) {
      // hücre merkezi
      const lat = (cy + 0.5) * CELL_DEG;
      m.set(k, { lon: (cx + 0.5) * (CELL_DEG / Math.cos(toRad(lat))), lat });
    }
  }
  return [...m.values()];
}
function areaCentroid(cells) {
  let lon = 0;
  let lat = 0;
  for (const c of cells) {
    lon += c.lon;
    lat += c.lat;
  }
  return { lon: lon / cells.length, lat: lat / cells.length };
}

/* ══ ESKİ ölçüt (02-vakalar) — a'nın kütle merkezine çapalı ══ */
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
  let sLon = 0;
  let sLat = 0;
  for (const q of yeni) {
    sLon += q.lon;
    sLat += q.lat;
  }
  const cLon = sLon / yeni.length;
  const cLat = sLat / yeni.length;
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
  let hLon = 0;
  let hLat = 0;
  for (const { q } of top) {
    hLon += q.lon;
    hLat += q.lat;
  }
  hLon /= top.length;
  hLat /= top.length;
  const basKm = havKm(a.lon, a.lat, hLon, hLat);
  const zayif = km < 0.5 && basKm < 0.5;
  return {
    merkez: !zayif && km >= 0.5 ? bearingDeg(a.lon, a.lat, cLon, cLat) : null,
    bas: !zayif && basKm >= 0.5 ? bearingDeg(a.lon, a.lat, hLon, hLat) : null,
  };
}

/* ══ YENİ ölçütler — her yeni piksel KENDİ en yakın yanmış pikselinden ══ */
function cepheOlcut(a, b) {
  // Üretim kodu: newPts[i] = {growthKm, bearingDeg} (en yakın yanmış piksele göre)
  const pr = progression(a.pts, b.pts, YANMIS_KM);
  const yeni = pr.newPts.filter((q) => q.growthKm <= MAX_ILER_KM);
  if (yeni.length < 2) return { cephe: null, cepheBas: null, alan: null, alanCephe: null };
  const cephe = circMean(yeni.map((q) => q.bearingDeg));
  const sirali = [...yeni].sort((x, y) => y.growthKm - x.growthKm);
  const top = sirali.slice(0, Math.max(2, Math.ceil(sirali.length / 3)));
  const cepheBas = circMean(top.map((q) => q.bearingDeg));

  // hücre maskesi ("concave hull") sürümleri — tespit yoğunluğu nötr
  const ma = maskOf(a.pts);
  const mb = maskOf(b.pts);
  const ca = areaCentroid(ma);
  const cb = areaCentroid(mb);
  const alanKm = havKm(ca.lon, ca.lat, cb.lon, cb.lat);
  const prCell = progression(ma, mb, YANMIS_KM);
  const yeniCell = prCell.newPts.filter((q) => q.growthKm <= MAX_ILER_KM);
  return {
    cephe,
    cepheBas,
    alan: alanKm >= 0.5 ? bearingDeg(ca.lon, ca.lat, cb.lon, cb.lat) : null,
    alanCephe: yeniCell.length >= 2 ? circMean(yeniCell.map((q) => q.bearingDeg)) : null,
    // Şekil ölçümü için: her yeni HÜCRENİN kendi en yakın yanmış hücresinden
    // yönü ve taşma mesafesi. 07-sekil.mjs vaka başına TEK açı + TEK mesafe
    // kullanıyordu ve açı kütle merkezine çapalıydı; büyük yangında "geri"
    // dediği yön cephenin kanadı çıkıyordu. Hücre bazında bu karışma yok.
    hucreler: yeniCell.map((q) => [Math.round(q.bearingDeg), +q.growthKm.toFixed(2)]),
  };
}

/* ══ yurt dışı filtresi (02 ile aynı) ══ */
const placesSrc = readFileSync(here("../../src/data/places-tr.ts"), "utf8");
const PLACES = [...placesSrc.matchAll(/\["([^"]+)",\s*"([^"]+)",\s*([\d.]+),\s*([\d.]+)\]/g)].map((m) => ({
  name: m[1],
  il: m[2],
  lat: +m[3],
  lon: +m[4],
}));
const FOREIGN = new Set([
  "Suriye", "Irak", "İran", "Gürcistan", "Ermenistan", "Azerbaycan",
  "Yunanistan", "Bulgaristan", "Kıbrıs",
]);
function nearestPlace(lon, lat) {
  let best = PLACES[0];
  let bestKm = Infinity;
  for (const p of PLACES) {
    const d = havKm(lon, lat, p.lon, p.lat);
    if (d < bestKm) {
      bestKm = d;
      best = p;
    }
  }
  return { abroad: FOREIGN.has(best.il), label: best.name === best.il ? best.il : `${best.name}, ${best.il}` };
}

/* ══ koşum ══ */
const points = JSON.parse(readFileSync(here(process.env.DET || "detections-all.json"), "utf8"));
process.stdout.write(`${points.length} tespit kümeleniyor...\n`);
const groups = cluster(points);
process.stdout.write(`${groups.length} ham küme\n`);

const clc = JSON.parse(readFileSync(here("clc-all.json"), "utf8"));
const ckey = (lat, lon) =>
  `${(Math.round(lat * 100) / 100).toFixed(2)},${(Math.round(lon * 100) / 100).toFixed(2)}`;

const cases = [];
let evId = 0;
let ilerlemis = 0;
for (const g of groups) {
  if (g.length < 6) continue;
  const ps = passesOf(g);
  if (ps.length < 2) continue;
  if (Math.max(...ps.map((p) => p.frp)) < 30) continue;
  if (nearestPlace(ps[0].lon, ps[0].lat).abroad) continue;
  let lo0 = Infinity, la0 = Infinity, lo1 = -Infinity, la1 = -Infinity;
  for (const p of g) {
    if (p.lon < lo0) lo0 = p.lon;
    if (p.lon > lo1) lo1 = p.lon;
    if (p.lat < la0) la0 = p.lat;
    if (p.lat > la1) la1 = p.lat;
  }
  const spanKm = havKm(lo0, la0, lo1, la1);
  if (spanKm > 40) continue; // zincirlenme koruması (cases-wild ile aynı)

  const id = evId++;
  const yons = [];
  for (let i = 0; i + 1 < ps.length; i++) {
    const a = ps[i];
    const b = ps[i + 1];
    const hours = (b.t - a.t) / 3600_000;
    const eski = eskiOlcut(a, b);
    const yeni = cepheOlcut(a, b);
    yons.push({
      i,
      hours,
      ok: a.count >= 3 && b.count >= 3 && hours >= 0.5 && hours <= 14,
      ...eski,
      ...yeni,
    });
    if (++ilerlemis % 500 === 0) process.stdout.write(`\r  ${ilerlemis} geçiş çifti işlendi   `);
  }
  for (let i = 0; i < yons.length; i++) {
    const y = yons[i];
    if (!y.ok) continue;
    const a = ps[y.i];
    const prev = i > 0 ? yons[i - 1] : null;
    cases.push({
      ev: id,
      spanKm: +spanKm.toFixed(1),
      lon: +a.lon.toFixed(4),
      lat: +a.lat.toFixed(4),
      t0: a.t,
      t1: ps[y.i + 1].t,
      hours: +y.hours.toFixed(2),
      yakit: yakitOf(clc[ckey(a.lat, a.lon)]),
      // gerçek yön ölçütleri
      merkez: y.merkez,
      bas: y.bas,
      cephe: y.cephe,
      cepheBas: y.cepheBas,
      alan: y.alan,
      alanCephe: y.alanCephe,
      hucreler: y.hucreler ?? [],
      // persistence: aynı ölçütün önceki çiftteki değeri
      prev: prev
        ? { merkez: prev.merkez, bas: prev.bas, cephe: prev.cephe, cepheBas: prev.cepheBas, alan: prev.alan, alanCephe: prev.alanCephe }
        : null,
    });
  }
}
process.stdout.write(`\n${evId} olay · ${cases.length} vaka\n`);
writeFileSync(here("cases-cephe.json"), JSON.stringify(cases));

const OLCUTLER = ["merkez", "bas", "cephe", "cepheBas", "alan", "alanCephe"];
const wild = cases.filter((c) => ["ORMAN", "MAKI", "OT"].includes(c.yakit));
const forest = wild.filter((c) => c.yakit !== "OT");
process.stdout.write(`doğal yakıt ${wild.length} · orman+maki ${forest.length}\n`);
for (const o of OLCUTLER)
  process.stdout.write(`  ${o.padEnd(10)} dolu: ${String(forest.filter((c) => c[o] !== null).length).padStart(4)}\n`);
