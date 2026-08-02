import { NextRequest, NextResponse } from "next/server";
import { corineAt, type FuelClass } from "@/lib/corine";

/**
 * Toplu arazi eğimi — tahmin konisi için.
 *
 * Koni yalnız rüzgârı yansıttığında dik yamaçlarda sistematik olarak yanılıyor
 * (6 sezonluk retrospektif doğrulama, bkz. /hakkinda). Eğimi hesaba katmak için
 * her aktif olayın merkezinde eğim + yokuş-yukarı yönü gerekiyor.
 *
 * Kota disiplini: koordinatlar 0,05°'ye yuvarlanır (anahtar sabit kalır, aynı
 * yangın her tazelemede yeniden sorgulanmaz) ve arazi değişmediği için upstream
 * yanıt 30 gün cache'lenir. Tek istekte en fazla 19 nokta = 95 koordinat.
 */

const MAX_PTS = 19;
const DKM = 1.0; // eğim tabanı ~1 km (yangının 1–6 saatte kat ettiği ölçek)

export type { FuelClass };

export interface TerrainPoint {
  lon: number;
  lat: number;
  slopePct: number;
  upslopeDeg: number;
  /** CORINE 2018 yakıt sınıfı; kapsam dışında (≈41,4°D doğusu) null */
  fuel: FuelClass | null;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("pts") ?? "";
  const pts: { lon: number; lat: number }[] = [];
  for (const part of raw.split("|")) {
    const [lonS, latS] = part.split(",");
    const lon = Math.round(parseFloat(lonS) * 20) / 20;
    const lat = Math.round(parseFloat(latS) * 20) / 20;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    // Kapsam dışı koordinatlarla ücretsiz kota tüketilmesin
    if (lat < 34.5 || lat > 42.7 || lon < 24.9 || lon > 45.6) continue;
    if (pts.some((p) => p.lon === lon && p.lat === lat)) continue;
    pts.push({ lon, lat });
    if (pts.length >= MAX_PTS) break;
  }
  if (!pts.length) return NextResponse.json({ points: [] });

  const lats: number[] = [];
  const lons: number[] = [];
  for (const p of pts) {
    const dLat = DKM / 111;
    const dLon = DKM / (111 * Math.cos((p.lat * Math.PI) / 180));
    lats.push(p.lat, p.lat + dLat, p.lat - dLat, p.lat, p.lat);
    lons.push(p.lon, p.lon, p.lon, p.lon + dLon, p.lon - dLon);
  }

  const url =
    "https://api.open-meteo.com/v1/elevation" +
    `?latitude=${lats.map((x) => x.toFixed(4)).join(",")}` +
    `&longitude=${lons.map((x) => x.toFixed(4)).join(",")}`;

  let elevation: number[] | undefined;
  try {
    // Arazi statiktir → 30 gün. Kota etkisi günde birkaç istek mertebesinde.
    const res = await fetch(url, { next: { revalidate: 2592000 } });
    if (!res.ok) throw new Error(String(res.status));
    elevation = ((await res.json()) as { elevation?: number[] }).elevation;
  } catch (err) {
    // Ayrıntı sunucu logunda kalır; istemciye upstream gövdesi yansıtılmaz.
    console.error("terrain: yükseklik alınamadı", err);
    return NextResponse.json({ points: [], error: "arazi alınamadı" }, { status: 503 });
  }

  if (!elevation || elevation.length !== pts.length * 5) {
    return NextResponse.json({ points: [], error: "arazi eksik" }, { status: 503 });
  }

  // Yakıt sınıfları paralel çekilir (nokta başına 1 istek, hepsi 30 gün cache'li)
  const fuels = await Promise.all(pts.map((p) => corineAt(p.lon, p.lat)));

  const points: TerrainPoint[] = [];
  pts.forEach((p, i) => {
    const e = elevation!.slice(i * 5, i * 5 + 5);
    if (!e.every((x) => typeof x === "number")) return;
    const [, north, south, east, west] = e;
    const dzdy = (north - south) / (2 * DKM * 1000);
    const dzdx = (east - west) / (2 * DKM * 1000);
    const slopePct = Math.hypot(dzdx, dzdy) * 100;
    points.push({
      lon: p.lon,
      lat: p.lat,
      slopePct: Math.round(slopePct * 10) / 10,
      upslopeDeg:
        slopePct < 1 ? 0 : Math.round((((Math.atan2(dzdx, dzdy) * 180) / Math.PI) + 360) % 360),
      fuel: fuels[i],
    });
  });

  return NextResponse.json(
    { points },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
