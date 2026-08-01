import { destPoint, sectorRing } from "./geo";
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
export function headSpreadKmh(windKmh: number): number {
  // Süreklilik önemli: eşikte sıçrama olursa aynı yangın iki tazeleme
  // arasında gözle görülür şekilde büyüyüp küçülür.
  if (windKmh < 10) return 0.7 + (windKmh / 10) * 0.3; // 0.7 → 1
  if (windKmh < 30) return 1 + ((windKmh - 10) / 20) * 2; // 1 → 3
  if (windKmh < 50) return 3 + ((windKmh - 30) / 20) * 3; // 3 → 6
  return Math.min(10, 6 + ((windKmh - 50) / 30) * 4); // 6 → 10
}

/** Koni yarım açısı: rüzgar güçlendikçe daralır. */
export function coneHalfAngle(windKmh: number): number {
  const t = Math.min(1, windKmh / 50);
  return 30 - t * 15;
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
const FUEL = { sigma: 1800, beta: 0.012, waf: 0.3 };

export function rothermelSpread(
  windKmh: number,
  windToDeg: number,
  slopePct: number,
  upslopeDeg: number
): { spreadDeg: number; slopeShare: number } {
  const { sigma, beta, waf } = FUEL;
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
}

export const CONE_HOURS = [1, 3, 6] as const;

/**
 * Olay için tahmini yön konisi — tepe: son geçişin öncü kenarı.
 * `terrain` verilirse yön, rüzgâr + eğim bileşkesinden hesaplanır.
 */
export function buildCone(
  ev: FireEvent,
  grid: WindGrid,
  terrain?: { slopePct: number; upslopeDeg: number } | null
): ConeGeom | null {
  const uv = sampleUV(grid, ev.lon, ev.lat);
  if (!uv) return null;
  const { kmh, fromDeg } = uvToSpeedDir(uv.u, uv.v);
  if (kmh < 2) return null; // durgun — yön anlamsız
  const windOnlyDeg = (fromDeg + 180) % 360;
  const comb =
    terrain && terrain.slopePct >= 1
      ? rothermelSpread(kmh, windOnlyDeg, terrain.slopePct, terrain.upslopeDeg)
      : { spreadDeg: windOnlyDeg, slopeShare: 0 };
  const spreadDeg = comb.spreadDeg;
  const apexPt = leadingEdge(ev, spreadDeg);
  const ros = headSpreadKmh(kmh);
  const half = coneHalfAngle(kmh);

  const rings = CONE_HOURS.map((h) => ({
    hours: h,
    ring: sectorRing(apexPt.lon, apexPt.lat, spreadDeg, half, ros * h),
  }));

  const maxH = CONE_HOURS[CONE_HOURS.length - 1];
  const tip = destPoint(apexPt.lon, apexPt.lat, spreadDeg, ros * maxH);
  return {
    eventId: ev.id,
    apex: [apexPt.lon, apexPt.lat],
    spreadDeg,
    windKmh: Math.round(kmh),
    rings,
    centerline: [[apexPt.lon, apexPt.lat], tip],
    windOnlyDeg,
    slopeShare: comb.slopeShare,
  };
}
