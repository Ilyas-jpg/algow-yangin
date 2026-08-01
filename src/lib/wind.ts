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
  const u = lerp(
    lerp(g.u[at(x0, y0)], g.u[at(x1, y0)], tx),
    lerp(g.u[at(x0, y1)], g.u[at(x1, y1)], tx),
    ty
  );
  const v = lerp(
    lerp(g.v[at(x0, y0)], g.v[at(x1, y0)], tx),
    lerp(g.v[at(x0, y1)], g.v[at(x1, y1)], tx),
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
  if (windKmh < 10) return 0.7;
  if (windKmh < 30) return 1 + ((windKmh - 10) / 20) * 2; // 1 → 3
  if (windKmh < 50) return 3 + ((windKmh - 30) / 20) * 3; // 3 → 6
  return Math.min(10, 6 + ((windKmh - 50) / 30) * 4); // 6 → 10
}

/** Koni yarım açısı: rüzgar güçlendikçe daralır. */
export function coneHalfAngle(windKmh: number): number {
  const t = Math.min(1, windKmh / 50);
  return 30 - t * 15;
}

export interface ConeGeom {
  eventId: string;
  apex: [number, number];
  spreadDeg: number;
  windKmh: number;
  rings: { hours: number; ring: [number, number][] }[];
  centerline: [number, number][];
}

export const CONE_HOURS = [1, 3, 6] as const;

/** Olay için tahmini yön konisi — tepe: son geçişin öncü kenarı. */
export function buildCone(
  ev: FireEvent,
  grid: WindGrid
): ConeGeom | null {
  const uv = sampleUV(grid, ev.lon, ev.lat);
  if (!uv) return null;
  const { kmh, fromDeg } = uvToSpeedDir(uv.u, uv.v);
  if (kmh < 2) return null; // durgun — yön anlamsız
  const spreadDeg = (fromDeg + 180) % 360;
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
  };
}
