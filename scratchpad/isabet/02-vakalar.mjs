/**
 * 02 — Tespitleri olaylara/geçişlere ayır, doğrulanabilir ilerleme vakaları üret.
 *
 * Vaka = ardışık iki uydu geçişi (a→b) olan bir yangın.
 *   gerçek yön  = b'de olup a'nın 0,6 km yakınında karşılığı olmayan piksellerin
 *                 (yani YENİ YANAN ALANIN) a merkezine göre yönü
 *   persistence = bir önceki geçiş çiftinde (a-1→a) gözlenen yön (varsa)
 * Kurallar orijinal tahmin-isabet.mjs ile birebir aynı tutuldu ki sonuçlar
 * karşılaştırılabilir olsun.
 */
import { readFileSync, writeFileSync } from "node:fs";

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
  const p1 = toRad(lat1), p2 = toRad(lat2), dl = toRad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// ── yurt dışı filtresi: ürünün kendi places-tr tablosu
const placesSrc = readFileSync(
  "C:/Users/milya/Desktop/00-Projeler/algow-yangin/src/data/places-tr.ts",
  "utf8"
);
const PLACES = [...placesSrc.matchAll(/\["([^"]+)",\s*"([^"]+)",\s*([\d.]+),\s*([\d.]+)\]/g)].map(
  (m) => ({ name: m[1], il: m[2], lat: +m[3], lon: +m[4] })
);
const FOREIGN = new Set(["Suriye", "Irak", "İran", "Gürcistan", "Ermenistan", "Azerbaycan", "Yunanistan", "Bulgaristan", "Kıbrıs"]);
function nearestPlace(lon, lat) {
  let best = PLACES[0], bestKm = Infinity;
  for (const p of PLACES) {
    const d = havKm(lon, lat, p.lon, p.lat);
    if (d < bestKm) { bestKm = d; best = p; }
  }
  return { label: best.name === best.il ? best.il : `${best.name}, ${best.il}`, abroad: FOREIGN.has(best.il), km: bestKm };
}

const EPS_KM = 3;
const PASS_GAP_MS = 90 * 60_000;

function cluster(points) {
  const cellDeg = EPS_KM / 111;
  const lonCell = cellDeg / Math.cos(toRad(42.6)); // sabit bölen (ürün fix'i)
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
            if (havKm(p.lon, p.lat, q.lon, q.lat) <= EPS_KM) { comp[j] = id; stack.push(j); }
          }
        }
    }
  }
  const groups = new Map();
  points.forEach((p, i) => {
    const a = groups.get(comp[i]);
    if (a) a.push(p); else groups.set(comp[i], [p]);
  });
  return [...groups.values()];
}

function passesOf(pts) {
  pts.sort((a, b) => a.dt - b.dt);
  const passes = [];
  let g = [];
  const flush = () => {
    if (!g.length) return;
    let sLon = 0, sLat = 0, sFrp = 0;
    for (const x of g) { sLon += x.lon; sLat += x.lat; sFrp += x.frp; }
    passes.push({
      t: g[Math.floor(g.length / 2)].dt,
      lon: sLon / g.length, lat: sLat / g.length,
      frp: sFrp, count: g.length, pts: g.slice(),
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

/**
 * b'de yeni yanan alanın yönü — İKİ ölçüt:
 *  yon  = tüm yeni piksellerin ağırlık merkezi (orijinal test ölçütü)
 *  bas  = a'nın ayak izinden EN UZAĞA ilerleyen üçte birlik dilim ("yangının başı")
 *         — baş söndükten sonra arkada/yanda yanmaya devam eden piksellerin
 *           ağırlık merkezi kaydırmasına karşı dayanıklı
 */
/**
 * ZİNCİRLEME KORUMASI (2026-08-02).
 * DBSCAN 3 km bağlantısı, güneydoğudaki yoğun tarla ateşlerini yüzlerce km'lik
 * TEK "olay"a bağlıyordu; ölçülen "ilerleme" medyanı 17 km, maksimumu 373 km
 * çıkıyordu — fiziksel olarak imkânsız, çünkü ölçülen şey aslında 50 km ötede
 * ayrı bir yangındı. Bir yangın cephesi iki geçiş arasında (≤14 sa) kendi
 * kenarından en fazla ~MAX_ILER km ilerleyebilir; bunun ötesindeki piksel
 * "bu yangının ilerlemesi" değil, ayrı bir tutuşmadır.
 */
const MAX_ILER_KM = 15; // ≈1,1 km/sa sürekli cephe hızı — Akdeniz için zaten uç

function yeniAlanYonu(a, b) {
  const yeni = b.pts.filter((q) => {
    let dmin = Infinity;
    for (const p of a.pts) {
      const d = havKm(p.lon, p.lat, q.lon, q.lat);
      if (d < dmin) dmin = d;
      if (dmin < 0.6) return false; // zaten yanmış alanın içinde
    }
    return dmin <= MAX_ILER_KM;
  });
  // Hiç yeni alan yoksa yangın ayak izinin dışına taşmamış: ilerleme 0.
  // Bu vakaları ELEMEK hız kalibrasyonunu yukarı yanlı yapar — koni her aktif
  // yangına çiziliyor, ilerlemeyenlere de.
  if (yeni.length < 2) {
    return { yon: null, km: 0, n: yeni.length, basYon: null, basKm: 0, ilerMax: 0, iler90: 0, iler50: 0 };
  }
  let sLon = 0, sLat = 0;
  for (const q of yeni) { sLon += q.lon; sLat += q.lat; }
  const cLon = sLon / yeni.length, cLat = sLat / yeni.length;
  const km = havKm(a.lon, a.lat, cLon, cLat);

  // "baş": a ayak izine olan en kısa mesafeye göre sırala, en uzak 1/3'ü al
  const withD = yeni.map((q) => {
    let dmin = Infinity;
    for (const p of a.pts) {
      const d = havKm(p.lon, p.lat, q.lon, q.lat);
      if (d < dmin) dmin = d;
    }
    return { q, d: dmin };
  }).sort((x, y) => y.d - x.d);
  const top = withD.slice(0, Math.max(2, Math.ceil(withD.length / 3)));
  let hLon = 0, hLat = 0;
  for (const { q } of top) { hLon += q.lon; hLat += q.lat; }
  hLon /= top.length; hLat /= top.length;
  const basKm = havKm(a.lon, a.lat, hLon, hLat);

  const zayif = km < 0.5 && basKm < 0.5; // yön güvenilmez ama ilerleme yine ölçülür
  // İLERLEME = yangının o anki ayak izinin DIŞINA taşınan mesafe.
  // Koni halkalarının yarıçapı tam olarak bu büyüklüktür (tepe = öncü kenar),
  // merkeze olan uzaklık değil — merkez ölçüsü yangının kendi boyunu da içerir.
  const ds = withD.map((x) => x.d).sort((p, q) => q - p);
  const pct = (p) => ds[Math.min(ds.length - 1, Math.floor(ds.length * p))];
  return {
    yon: !zayif && km >= 0.5 ? bearingDeg(a.lon, a.lat, cLon, cLat) : null,
    km,
    n: yeni.length,
    basYon: !zayif && basKm >= 0.5 ? bearingDeg(a.lon, a.lat, hLon, hLat) : null,
    basKm: +basKm.toFixed(2),
    ilerMax: +ds[0].toFixed(2),   // en uzağa taşan piksel
    iler90: +pct(0.1).toFixed(2), // %90'lık ilerleme (uç gürültüsüne dayanıklı)
    iler50: +pct(0.5).toFixed(2),
  };
}

const points = JSON.parse(readFileSync(here(process.env.DET || "detections.json"), "utf8"));
process.stdout.write(`${points.length} tespit kümeleniyor...\n`);
const groups = cluster(points);
process.stdout.write(`${groups.length} ham küme\n`);

const cases = [];
let evId = 0;
let statAbroad = 0, statSmall = 0;

for (const g of groups) {
  if (g.length < 6) { statSmall++; continue; }
  const ps = passesOf(g);
  if (ps.length < 2) { statSmall++; continue; }
  const maxFrp = Math.max(...ps.map((p) => p.frp));
  if (maxFrp < 30) { statSmall++; continue; } // tarımsal anız/tek seferlik ateşleri ele
  const place = nearestPlace(ps[0].lon, ps[0].lat);
  if (place.abroad) { statAbroad++; continue; }

  // Olayın coğrafi yayılımı — zincirlenmiş kümeleri ayıklamak için.
  // Gerçek tek bir orman yangınının aktif cephesi nadiren 40 km'yi aşar.
  let lo0 = Infinity, la0 = Infinity, lo1 = -Infinity, la1 = -Infinity;
  for (const p of g) {
    if (p.lon < lo0) lo0 = p.lon; if (p.lon > lo1) lo1 = p.lon;
    if (p.lat < la0) la0 = p.lat; if (p.lat > la1) la1 = p.lat;
  }
  const spanKm = havKm(lo0, la0, lo1, la1);

  const id = evId++;
  // her ardışık çift için gerçek yönü hesapla (persistence için de lazım)
  const yons = [];
  for (let i = 0; i + 1 < ps.length; i++) {
    const a = ps[i], b = ps[i + 1];
    const hours = (b.t - a.t) / 3600_000;
    const centKm = havKm(a.lon, a.lat, b.lon, b.lat);
    const yeni = yeniAlanYonu(a, b);
    yons.push({
      i, hours,
      ok: a.count >= 3 && b.count >= 3 && hours >= 0.5 && hours <= 14,
      centYon: centKm >= 1.2 ? bearingDeg(a.lon, a.lat, b.lon, b.lat) : null,
      centKm,
      yeniYon: yeni?.yon ?? null,
      yeniKm: yeni?.km ?? null,
      yeniN: yeni?.n ?? null,
      basYon: yeni?.basYon ?? null,
      basKm: yeni?.basKm ?? null,
      ilerMax: yeni?.ilerMax ?? null,
      iler90: yeni?.iler90 ?? null,
      iler50: yeni?.iler50 ?? null,
    });
  }

  for (let i = 0; i < yons.length; i++) {
    const y = yons[i];
    if (!y.ok) continue;
    // Yön testi için yön gerekli; HIZ testi için ilerleme=0 vakaları da lazım.
    // İkisini birden tutup aşağıda ayırıyoruz (yonVar bayrağı).
    const yonVar = y.yeniYon !== null || y.centYon !== null || y.basYon !== null;
    const a = ps[y.i], b = ps[y.i + 1];
    const prev = i > 0 ? yons[i - 1] : null;
    cases.push({
      ev: id,
      yonVar,
      spanKm: +spanKm.toFixed(1),
      yer: place.label,
      lon: +a.lon.toFixed(4), lat: +a.lat.toFixed(4),
      t0: a.t, t1: b.t, hours: +y.hours.toFixed(2),
      frpA: +a.frp.toFixed(1), frpB: +b.frp.toFixed(1),
      nA: a.count, nB: b.count,
      centYon: y.centYon, centKm: +y.centKm.toFixed(2),
      yeniYon: y.yeniYon, yeniKm: y.yeniKm, yeniN: y.yeniN,
      basYon: y.basYon, basKm: y.basKm,
      ilerMax: y.ilerMax, iler90: y.iler90, iler50: y.iler50,
      // önceki gözlenen yön (persistence modeli için) — yalnız GEÇMİŞ bilgi
      prevYon: prev ? (prev.yeniYon ?? prev.centYon) : null,
      prevBasYon: prev ? (prev.basYon ?? prev.centYon) : null,
      prevHours: prev ? +prev.hours.toFixed(2) : null,
      // yangının o ana kadarki toplam ayak izi merkezinden a'ya bakan yön
      // (yangın "ilerleme ekseni" — yine yalnız geçmiş bilgi)
      eksenYon: (() => {
        let sLon = 0, sLat = 0, n = 0;
        for (let k = 0; k <= y.i; k++) for (const p of ps[k].pts) { sLon += p.lon; sLat += p.lat; n++; }
        const cx = sLon / n, cy = sLat / n;
        return havKm(cx, cy, a.lon, a.lat) >= 0.4 ? bearingDeg(cx, cy, a.lon, a.lat) : null;
      })(),
    });
  }
}

process.stdout.write(
  `${evId} gerçek yangın olayı (${statAbroad} yurt dışı, ${statSmall} küçük/tek-geçiş elendi)\n` +
    `${cases.length} doğrulanabilir ilerleme vakası\n` +
    `  yeni-alan yönü olan: ${cases.filter((c) => c.yeniYon !== null).length}\n` +
    `  persistence bilgisi olan: ${cases.filter((c) => c.prevYon !== null).length}\n`
);
writeFileSync(here(process.env.OUT || "cases.json"), JSON.stringify(cases));
