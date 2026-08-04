/**
 * 09 — Türkiye il sınırlarını ürüne gömülecek hâle getir.
 *
 * Neden: altlık karolarındaki il sınırları eksik/kopuk (z6'da Sivas-Erzincan
 * arasında hiç yok). Yangın haritasında "hangi ilde yanıyor" birincil soru,
 * bu yüzden sınırları altlığa bırakmayıp kendi katmanımızı çiziyoruz.
 *
 * Kaynak: Natural Earth 10m admin_1 — KAMU MALI (public domain), atıf zorunlu
 * değil. AGPL projede lisans sürtüşmesi yaratmaz.
 *
 * Çıktı poligon değil ÇİZGİdir: yalnız sınırları çizeceğiz, dolgu yok.
 * Ayrıca Douglas–Peucker ile sadeleştirilir — hedef, z9'a kadar gözle fark
 * edilmeyecek ama dosyayı küçültecek bir tolerans.
 */
import { writeFileSync } from "node:fs";

const URL_10M =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";

process.stdout.write("Natural Earth indiriliyor (~40 MB)...\n");
const res = await fetch(URL_10M, { signal: AbortSignal.timeout(300_000) });
const gj = await res.json();
process.stdout.write(`${gj.features.length} idari birim\n`);

const tr = gj.features.filter(
  (f) => f.properties.adm0_a3 === "TUR" || f.properties.admin === "Turkey"
);
process.stdout.write(`Türkiye: ${tr.length} il\n`);
if (!tr.length) { process.stdout.write("İl bulunamadı, öznitelik adları: " + Object.keys(gj.features[0].properties).join(",") + "\n"); process.exit(1); }

/** Douglas–Peucker (derece uzayında; enlemde ~111 km/derece) */
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  let maxD = 0, idx = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
  return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
}

const TOL = 0.004; // ° ≈ 440 m — z9'a kadar gözle fark edilmez
const yuvarla = (p) => [+p[0].toFixed(4), +p[1].toFixed(4)];

let hamNokta = 0, sadeNokta = 0;
const features = tr.map((f) => {
  const halkalar = [];
  const ekle = (ring) => {
    hamNokta += ring.length;
    const s = dp(ring, TOL).map(yuvarla);
    sadeNokta += s.length;
    if (s.length >= 3) halkalar.push(s);
  };
  const g = f.geometry;
  if (g.type === "Polygon") g.coordinates.forEach(ekle);
  else if (g.type === "MultiPolygon") g.coordinates.forEach((poly) => poly.forEach(ekle));
  return {
    type: "Feature",
    properties: { il: f.properties.name },
    geometry: { type: "MultiLineString", coordinates: halkalar },
  };
});

const out = { type: "FeatureCollection", features };
const json = JSON.stringify(out);
writeFileSync("C:/Users/milya/Desktop/00-Projeler/algow-yangin/public/tr-iller.json", json);
process.stdout.write(
  `Nokta: ${hamNokta} → ${sadeNokta} (%${(100 * (1 - sadeNokta / hamNokta)).toFixed(0)} azaldı)\n` +
    `Dosya: ${(json.length / 1024).toFixed(0)} KB (gzip ~%30'u)\n` +
    `İller: ${features.map((f) => f.properties.il).slice(0, 6).join(", ")}...\n`
);
