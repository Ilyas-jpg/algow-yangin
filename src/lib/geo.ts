const R = 6371; // km

export const toRad = (d: number) => (d * Math.PI) / 180;
export const toDeg = (r: number) => (r * 180) / Math.PI;

export function havKm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** a→b yönü, derece (0=K, 90=D) */
export function bearingDeg(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** başlangıçtan bearing yönünde km ilerideki nokta */
export function destPoint(
  lon: number,
  lat: number,
  bearing: number,
  km: number
): [number, number] {
  const δ = km / R;
  const θ = toRad(bearing);
  const φ1 = toRad(lat);
  const λ1 = toRad(lon);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );
  return [toDeg(λ2), toDeg(φ2)];
}

/**
 * Tepe noktasından bearing±half açısında, radius km'lik sektör poligonu.
 * İlk/son nokta tepe — kapalı ring döner.
 */
export function sectorRing(
  lon: number,
  lat: number,
  bearing: number,
  halfAngle: number,
  km: number,
  steps = 18
): [number, number][] {
  const ring: [number, number][] = [[lon, lat]];
  for (let i = 0; i <= steps; i++) {
    const b = bearing - halfAngle + (2 * halfAngle * i) / steps;
    ring.push(destPoint(lon, lat, b, km));
  }
  ring.push([lon, lat]);
  return ring;
}

const COMPASS_TR = [
  "K", "KKD", "KD", "DKD", "D", "DGD", "GD", "GGD",
  "G", "GGB", "GB", "BGB", "B", "BKB", "KB", "KKB",
];

/** dereceyi 16'lı Türkçe pusula yönüne çevir */
export function compassTr(deg: number): string {
  return COMPASS_TR[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}
