import { NextRequest, NextResponse } from "next/server";

/**
 * Koni halkaları için saatlik TAHMİN rüzgârı.
 *
 * Koni bugüne kadar "mevcut rüzgâr 6 saat boyunca sabit kalır" varsayıyordu.
 * Retrospektif doğrulamada bu varsayımın bedeli ölçüldü: aralığın gerçek
 * ortalama rüzgârı bilinseydi ortanca hata 68°'den 64°'ye inecekti. Tahmin
 * rüzgârı bu farkın büyük kısmını bedavaya kazandırır.
 *
 * Kota disiplini: koordinat 0,1°'ye yuvarlanır, en fazla 19 nokta tek istekte
 * toplanır, upstream 30 dk cache'lenir.
 */

const MAX_PTS = 19;
const HOURS = 7; // şimdi + 6 saat

export interface WindForecastPoint {
  lon: number;
  lat: number;
  /** [0] = şu an, [i] = i saat sonrası */
  kmh: number[];
  /** rüzgârın GELDİĞİ yön, derece */
  fromDeg: number[];
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("pts") ?? "";
  const pts: { lon: number; lat: number }[] = [];
  for (const part of raw.split("|")) {
    const [lonS, latS] = part.split(",");
    const lon = Math.round(parseFloat(lonS) * 10) / 10;
    const lat = Math.round(parseFloat(latS) * 10) / 10;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (lat < 34.5 || lat > 42.7 || lon < 24.9 || lon > 45.6) continue;
    if (pts.some((p) => p.lon === lon && p.lat === lat)) continue;
    pts.push({ lon, lat });
    if (pts.length >= MAX_PTS) break;
  }
  if (!pts.length) return NextResponse.json({ points: [] });

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${pts.map((p) => p.lat.toFixed(1)).join(",")}` +
    `&longitude=${pts.map((p) => p.lon.toFixed(1)).join(",")}` +
    "&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh" +
    "&forecast_days=2&timezone=UTC";

  interface Loc {
    hourly?: { time?: string[]; wind_speed_10m?: (number | null)[]; wind_direction_10m?: (number | null)[] };
  }

  let arr: Loc[];
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    arr = Array.isArray(j) ? j : [j];
  } catch (err) {
    // Ayrıntı sunucuda kalır; koni tahmin rüzgârı olmadan da çizilebiliyor.
    console.error("wind/forecast: alınamadı", err);
    return NextResponse.json({ points: [], error: "tahmin alınamadı" }, { status: 503 });
  }

  const nowIso = new Date().toISOString().slice(0, 13) + ":00";
  const points: WindForecastPoint[] = [];
  arr.forEach((loc, i) => {
    const h = loc.hourly;
    if (!h?.time || !h.wind_speed_10m || !h.wind_direction_10m) return;
    let i0 = h.time.indexOf(nowIso);
    if (i0 < 0) i0 = 0;
    const kmh: number[] = [];
    const fromDeg: number[] = [];
    for (let k = 0; k < HOURS; k++) {
      const s = h.wind_speed_10m[i0 + k];
      const d = h.wind_direction_10m[i0 + k];
      if (typeof s !== "number" || typeof d !== "number") break;
      kmh.push(Math.round(s * 10) / 10);
      fromDeg.push(Math.round(d));
    }
    if (kmh.length >= 2) points.push({ lon: pts[i].lon, lat: pts[i].lat, kmh, fromDeg });
  });

  return NextResponse.json(
    { points },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } }
  );
}
