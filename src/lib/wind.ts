import { destPoint, reachShape } from "./geo";
import type { FireEvent, WindGrid } from "./types";
import { leadingEdge } from "./cluster";

/** Grid'den çift-doğrusal interpolasyonla u/v (m/s). Grid dışı → null. */
export function sampleUV(
  g: WindGrid,
  lon: number,
  lat: number
): { u: number; v: number } | null {
  const fx = (lon - g.lon0) / g.dLon;
  const fy = (lat - g.lat0) / g.dLat;
  if (fx < 0 || fy < 0 || fx > g.nx - 1 || fy > g.ny - 1) return null;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(g.nx - 1, x0 + 1);
  const y1 = Math.min(g.ny - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (x: number, y: number) => y * g.nx + x;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  // Dört köşeden biri bile eksikse interpolasyon yapma: eksik veriyi
  // 0 sayıp "durgun" göstermek koniyi olduğundan kısa çizer.
  const corners = [at(x0, y0), at(x1, y0), at(x0, y1), at(x1, y1)];
  for (const i of corners) {
    if (g.u[i] === null || g.v[i] === null) return null;
  }
  const uAt = (i: number) => g.u[i] as number;
  const vAt = (i: number) => g.v[i] as number;

  const u = lerp(
    lerp(uAt(corners[0]), uAt(corners[1]), tx),
    lerp(uAt(corners[2]), uAt(corners[3]), tx),
    ty
  );
  const v = lerp(
    lerp(vAt(corners[0]), vAt(corners[1]), tx),
    lerp(vAt(corners[2]), vAt(corners[3]), tx),
    ty
  );
  return { u, v };
}

/** u/v (m/s) → { hız km/h, rüzgarın GELDİĞİ yön derece } */
export function uvToSpeedDir(u: number, v: number): { kmh: number; fromDeg: number } {
  const ms = Math.hypot(u, v);
  // vektör "gittiği" yönü gösterir; meteorolojik yön = geldiği yön
  const toDeg = (Math.atan2(u, v) * 180) / Math.PI;
  const fromDeg = (toDeg + 180 + 360) % 360;
  return { kmh: ms * 3.6, fromDeg };
}

/**
 * Kaba yayılma hızı (km/h) — Akdeniz makisi için yönelim göstergesi.
 * Bilimsel model DEĞİLDİR; UI'da daima disclaimer ile.
 */
/** Ölçülmüş çapa noktaları arasında doğrusal ara değer. */
function interp(x: number, pts: readonly (readonly [number, number])[]): number {
  if (x <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

/**
 * Yangının kendi kenarından ilerleme hızı (km/sa) — %90'lık dilim.
 *
 * ÖLÇÜLDÜ (2026-08-02): 6 sezonluk FIRMS arşivinden 291 doğal-yakıt ilerlemesi,
 * "yangının o anki ayak izinin dışına taşınan mesafe" olarak. Buradaki değerler
 * gözlenen ilerlemelerin %90'lık dilimi — yani 10 yangından 9'u bu halkanın
 * içinde kaldı. Ortanca çok daha küçük (~0,10–0,22 km/sa); %90 bilinçli seçim,
 * güvenlik aracında ortanca kullanmak yangınların yarısını eksik uyarır.
 *
 * ⚠️ Önceki değerler (0,7–10 km/sa) hiçbir ölçüme dayanmıyordu ve gerçeğin
 * 8–12 katıydı: 3 saatlik halka 7,6 km çiziliyordu, ölçülen %90'lık dilim
 * 2,5 km. Koni o yüzden bilerek küçüldü.
 *
 * ⚠️ Veri ~12 saatlik uydu geçiş aralıklarından geliyor; 1–3 saatlik ani
 * atakları çözemez. Kısa süreli sıçramalar bu değerlerin üstüne çıkabilir.
 */
const ROS_ANCHORS = [
  [4, 0.26],  // ölçüldü (n=107)
  [11, 0.44], // ölçüldü (n=139)
  [18, 0.47], // ölçüldü (n=27)
  [26, 0.83], // ölçüldü (n=15)
  [45, 1.3],  // veri yok — trendden uzatıldı
] as const;

export function headSpreadKmh(windKmh: number): number {
  return interp(windKmh, ROS_ANCHORS);
}

/**
 * Koni yarım açısı — gözlenen yönlerin %80'ini kapsayan açı.
 *
 * ÖLÇÜLDÜ: rüzgâr zayıfken yön neredeyse belirsiz (±130°, yani yarım daireye
 * yakın), güçlendikçe daralıyor. Önceki 15–30° değerleri uydurmaydı ve
 * gözlenen sapmaların yalnız %30'unu kapsıyordu — kullanıcıya hak etmediğimiz
 * bir kesinlik gösteriyorduk.
 */
const ANGLE_ANCHORS = [
  [4, 130],  // ölçüldü (n=92)
  [11, 110], // ölçüldü (n=125)
  [18, 78],  // ölçüldü (n=22)
  [30, 70],  // az veri — trendden uzatıldı
] as const;

export function coneHalfAngle(windKmh: number): number {
  return interp(windKmh, ANGLE_ANCHORS);
}

/**
 * Yarım açı bu eşiği aşarsa yön bilgisi zayıf demektir — panelde belirtilir.
 * (Geometri artık her durumda ölçülmüş erişim şeklini kullanıyor.)
 */
export const DISC_THRESHOLD_DEG = 100;

/**
 * ERİŞİM ŞEKLİ — ölçüldü (2026-08-02, 256 doğal-yakıt ilerlemesi).
 *
 * "Tahmin edilen yönden θ° sapan yönlerde yangın ne kadar ilerledi?" sorusunun
 * cevabı. Baş yönündeki erişime göre normalize edilmiş %90'lık dilim:
 *
 *   0–30° → 1,00 · 30–60° → 0,93 · 60–90° → 0,68
 *   90–120° → 0,70 · 120–150° → 0,41 · 150–180° → 0,42
 *
 * Yani yangın başa doğru geriye göre **2,4 kat** uzağa gidiyor. Bu yüzden
 * simetrik daire yön bilgisini çöpe atar, keskin kama ise olmayan bir kesinlik
 * ima eder; doğru gösterim ikisinin arası olan bu damla şeklidir.
 *
 * Aşağıdaki değerler ölçülen kovaların hafifçe düzleştirilmiş hâli (60–120°
 * arasındaki iniş-çıkış örneklem gürültüsü; monoton hâle getirildi).
 */
const SHAPE_ANCHORS = [
  [0, 1.0],
  [30, 0.97],
  [60, 0.8],
  [90, 0.69],
  [120, 0.55],
  [150, 0.43],
  [180, 0.42],
] as const;

/** Baş yönüne göre θ° sapmadaki göreli erişim (0–1) */
export function reachRatio(offsetDeg: number): number {
  const a = Math.min(180, Math.abs(offsetDeg));
  return interp(a, SHAPE_ANCHORS);
}

/**
 * Rüzgâr ve eğimin bileşik yayılma yönü — Rothermel (1972) rüzgâr/eğim
 * katsayılarının vektör toplamı (Finney 1998'deki standart birleştirme).
 *
 * Yakıt sabit alınır: Akdeniz makisi (σ=1800 ft⁻¹, β=0,012, alev-ortası rüzgâr
 * katsayısı 0,30). Retrospektif doğrulamada sonuç yakıt varsayımına dayanıklı
 * çıktı: gerçek CORINE sınıfı yerine sabit maki kullanıldığında dik arazideki
 * ortalama hata 76,6° yerine 76,8° (rüzgâr-tek: 78,0°).
 *
 * φs ∝ tan²(eğim) olduğu için düz arazide eğim terimi kendiliğinden sıfıra
 * yaklaşır — ayrıca eşik koymaya gerek yok.
 */
const FUELS = {
  ORMAN: { sigma: 1500, beta: 0.03, waf: 0.15 },
  MAKI: { sigma: 1800, beta: 0.012, waf: 0.3 },
  OT: { sigma: 3500, beta: 0.0015, waf: 0.4 },
} as const;
export type FuelKind = keyof typeof FUELS;

/** CORINE sınıfı → Rothermel yakıt modeli; bilinmiyorsa maki (Akdeniz varsayılanı) */
export function fuelParams(fuel?: string | null) {
  if (fuel === "ORMAN") return FUELS.ORMAN;
  if (fuel === "OT" || fuel === "TARIM") return FUELS.OT;
  return FUELS.MAKI;
}

export function rothermelSpread(
  windKmh: number,
  windToDeg: number,
  slopePct: number,
  upslopeDeg: number,
  fuel?: string | null
): { spreadDeg: number; slopeShare: number } {
  const { sigma, beta, waf } = fuelParams(fuel);
  const betaOp = 3.348 * Math.pow(sigma, -0.8189);
  const C = 7.47 * Math.exp(-0.133 * Math.pow(sigma, 0.55));
  const B = 0.02526 * Math.pow(sigma, 0.54);
  const E = 0.715 * Math.exp(-3.59e-4 * sigma);
  const uFtMin = Math.max(0, windKmh) * 54.6807 * waf; // km/sa → ft/dk
  const phiW = C * Math.pow(uFtMin, B) * Math.pow(beta / betaOp, -E);
  const phiS = 5.275 * Math.pow(beta, -0.3) * Math.pow(slopePct / 100, 2);

  const rad = Math.PI / 180;
  const x = phiW * Math.sin(windToDeg * rad) + phiS * Math.sin(upslopeDeg * rad);
  const y = phiW * Math.cos(windToDeg * rad) + phiS * Math.cos(upslopeDeg * rad);
  if (Math.hypot(x, y) < 1e-9) {
    return { spreadDeg: windToDeg, slopeShare: 0 };
  }
  return {
    spreadDeg: ((Math.atan2(x, y) / rad) + 360) % 360,
    slopeShare: phiS / (phiW + phiS),
  };
}

export interface ConeGeom {
  eventId: string;
  apex: [number, number];
  spreadDeg: number;
  windKmh: number;
  rings: { hours: number; ring: [number, number][] }[];
  centerline: [number, number][];
  /** Rüzgâr tek başına olsaydı çizilecek yön — panelde farkı anlatmak için */
  windOnlyDeg: number;
  /** Bileşik yönde eğimin payı (0–1); 0 = arazi verisi yok veya düz */
  slopeShare: number;
  /** Ölçülmüş yarım açı (gözlenen yönlerin %80'ini kapsar) */
  halfAngle: number;
  /** Açı çok genişse yön bilgisi yok demektir — kama yerine daire çizilir */
  isDisc: boolean;
  /** Tahmin rüzgârına göre 6 saatte yönün ne kadar döndüğü (derece) */
  driftDeg: number;
}

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
/** iki yön arasındaki en kısa açı farkı */
function angleGap(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

export const CONE_HOURS = [1, 3, 6] as const;

/**
 * Olay için tahmini yön konisi — tepe: son geçişin öncü kenarı.
 * `terrain` verilirse yön, rüzgâr + eğim bileşkesinden hesaplanır.
 */
export function buildCone(
  ev: FireEvent,
  grid: WindGrid,
  terrain?: { slopePct: number; upslopeDeg: number; fuel?: string | null } | null,
  forecast?: { kmh: number[]; fromDeg: number[] } | null
): ConeGeom | null {
  const uv = sampleUV(grid, ev.lon, ev.lat);
  if (!uv) return null;
  const { kmh, fromDeg } = uvToSpeedDir(uv.u, uv.v);
  if (kmh < 2) return null; // durgun — yön anlamsız

  // Saatlik rüzgâr serisi: tahmin varsa onu kullan, yoksa mevcut rüzgârı sabit
  // kabul et (eski davranış). Seri her zaman "gittiği yön" cinsindendir.
  const maxH = CONE_HOURS[CONE_HOURS.length - 1];
  const series: { kmh: number; toDeg: number }[] = [];
  for (let h = 0; h < maxH; h++) {
    const fk = forecast?.kmh[h];
    const fd = forecast?.fromDeg[h];
    series.push(
      typeof fk === "number" && typeof fd === "number"
        ? { kmh: fk, toDeg: (fd + 180) % 360 }
        : { kmh, toDeg: (fromDeg + 180) % 360 }
    );
  }

  /** 0..h saatleri arasının vektör-ortalama rüzgârı */
  const avgTo = (h: number) => {
    let x = 0, y = 0, s = 0;
    const n = Math.max(1, h);
    for (let i = 0; i < n; i++) {
      const w = series[i];
      x += w.kmh * Math.sin(toRad(w.toDeg));
      y += w.kmh * Math.cos(toRad(w.toDeg));
      s += w.kmh;
    }
    return { deg: (toDeg(Math.atan2(x, y)) + 360) % 360, kmh: s / n };
  };

  const w1 = avgTo(1);
  const windOnlyDeg = w1.deg;
  const dirFor = (avg: { deg: number; kmh: number }) =>
    terrain && terrain.slopePct >= 1
      ? rothermelSpread(avg.kmh, avg.deg, terrain.slopePct, terrain.upslopeDeg, terrain.fuel)
      : { spreadDeg: avg.deg, slopeShare: 0 };

  const first = dirFor(w1);
  // Tepe, en yakın saatin yönüne göre sabitlenir; halkalar kendi yönlerini alır.
  const apexPt = leadingEdge(ev, first.spreadDeg);
  const half = coneHalfAngle(w1.kmh);
  const isDisc = half >= DISC_THRESHOLD_DEG;

  const rings = CONE_HOURS.map((h) => {
    // Yarıçap saat saat integre edilir: her saat kendi rüzgâr hızıyla ilerler.
    let km = 0;
    for (let i = 0; i < h; i++) km += headSpreadKmh(series[i].kmh);
    const avg = avgTo(h);
    const d = dirFor(avg);
    // Kapalı erişim zarfı: her yöne bir miktar, başa doğru 2,4 kat.
    return { hours: h, ring: reachShape(apexPt.lon, apexPt.lat, d.spreadDeg, km, reachRatio) };
  });

  let tipKm = 0;
  for (let i = 0; i < maxH; i++) tipKm += headSpreadKmh(series[i].kmh);
  const last = dirFor(avgTo(maxH));
  // Yön oku: şeklin baş ucuna kadar. Şekil artık her zaman yönlü olduğu için
  // daire modunda da çizilir — insanlar nereye eğildiğini görebilmeli.
  const tip = destPoint(apexPt.lon, apexPt.lat, last.spreadDeg, tipKm);
  return {
    eventId: ev.id,
    apex: [apexPt.lon, apexPt.lat],
    spreadDeg: first.spreadDeg,
    windKmh: Math.round(w1.kmh),
    rings,
    centerline: [[apexPt.lon, apexPt.lat], tip],
    windOnlyDeg,
    slopeShare: first.slopeShare,
    halfAngle: half,
    isDisc,
    /** tahmin rüzgârı kullanıldıysa 6 saatlik yön kayması, derece */
    driftDeg: forecast ? angleGap(first.spreadDeg, last.spreadDeg) : 0,
  };
}
