import { NextRequest, NextResponse } from "next/server";
import type { WindPoint } from "@/lib/types";

/**
 * Tek nokta yangın meteorolojisi: rüzgar + hamle + nem + sıcaklık + VPD.
 * Koordinat 0.1°'ye yuvarlanır (cache anahtarı daralır), upstream 30 dk cache.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = Math.round(parseFloat(sp.get("lat") ?? "") * 10) / 10;
  const lon = Math.round(parseFloat(sp.get("lon") ?? "") * 10) / 10;
  if (!isFinite(lat) || !isFinite(lon)) {
    return NextResponse.json({ error: "lat/lon gerekli" }, { status: 400 });
  }

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat.toFixed(1)}&longitude=${lon.toFixed(1)}` +
    "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m" +
    "&hourly=vapour_pressure_deficit&forecast_days=1" +
    "&wind_speed_unit=kmh&timezone=UTC";

  let data: {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      wind_speed_10m?: number;
      wind_direction_10m?: number;
      wind_gusts_10m?: number;
      time?: string;
    };
    hourly?: { time?: string[]; vapour_pressure_deficit?: number[] };
  };
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch {
    return NextResponse.json(
      { error: "Hava verisine ulaşılamadı" },
      { status: 503 }
    );
  }

  const cur = data.current ?? {};
  let vpd: number | null = null;
  const times = data.hourly?.time;
  const vpds = data.hourly?.vapour_pressure_deficit;
  if (times && vpds) {
    const hourIso = new Date().toISOString().slice(0, 13) + ":00";
    const i = times.indexOf(hourIso);
    const j = i >= 0 ? i : Math.min(new Date().getUTCHours(), vpds.length - 1);
    if (typeof vpds[j] === "number") vpd = Math.round(vpds[j] * 100) / 100;
  }

  const body: WindPoint = {
    tempC: cur.temperature_2m ?? null,
    rh: cur.relative_humidity_2m ?? null,
    windKmh: cur.wind_speed_10m ?? null,
    windDirDeg: cur.wind_direction_10m ?? null,
    gustKmh: cur.wind_gusts_10m ?? null,
    vpdKpa: vpd,
    time: Date.now(),
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
