import { NextResponse } from "next/server";
import type { WindGrid } from "@/lib/types";

/**
 * TR bölgesi 0.5° rüzgar gridi (Open-Meteo current, m/s).
 * ~700 nokta, 100'lük parçalarla; upstream 3 saat cache'lenir.
 */
const LON0 = 25.0;
const LAT0 = 35.0;
const D = 0.5;
const NX = 42; // 25.0 → 45.5
const NY = 16; // 35.0 → 42.5

export async function GET() {
  const coords: { lat: number; lon: number }[] = [];
  for (let r = 0; r < NY; r++) {
    for (let c = 0; c < NX; c++) {
      coords.push({ lat: LAT0 + r * D, lon: LON0 + c * D });
    }
  }

  const CHUNK = 100;
  const u = new Array<number>(coords.length).fill(0);
  const v = new Array<number>(coords.length).fill(0);
  let failedChunks = 0;

  const tasks: Promise<void>[] = [];
  for (let start = 0; start < coords.length; start += CHUNK) {
    const slice = coords.slice(start, start + CHUNK);
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${slice.map((c) => c.lat.toFixed(2)).join(",")}` +
      `&longitude=${slice.map((c) => c.lon.toFixed(2)).join(",")}` +
      "&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=UTC";
    const offset = start;
    tasks.push(
      (async () => {
        try {
          const res = await fetch(url, { next: { revalidate: 10800 } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const arr = Array.isArray(data) ? data : [data];
          arr.forEach((loc, i) => {
            const spd = loc?.current?.wind_speed_10m;
            const dir = loc?.current?.wind_direction_10m;
            if (typeof spd === "number" && typeof dir === "number") {
              const rad = (dir * Math.PI) / 180;
              // dir = rüzgarın GELDİĞİ yön → vektör ters yöne akar
              u[offset + i] = -spd * Math.sin(rad);
              v[offset + i] = -spd * Math.cos(rad);
            }
          });
        } catch {
          failedChunks++;
        }
      })()
    );
  }
  await Promise.all(tasks);

  if (failedChunks * CHUNK >= coords.length) {
    return NextResponse.json(
      { error: "Rüzgar verisine ulaşılamadı" },
      { status: 503 }
    );
  }

  const body: WindGrid = {
    lon0: LON0,
    lat0: LAT0,
    dLon: D,
    dLat: D,
    nx: NX,
    ny: NY,
    u: u.map((x) => Math.round(x * 100) / 100),
    v: v.map((x) => Math.round(x * 100) / 100),
    time: Date.now(),
    failedChunks,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
