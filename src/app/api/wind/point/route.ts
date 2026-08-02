import { NextRequest, NextResponse } from "next/server";
import type { WindPoint } from "@/lib/types";
import { runFwiSeries, fwiClass, type FwiDay } from "@/lib/fwi";
import { fetchJson } from "@/lib/fetch-retry";

/**
 * Tek nokta yangın meteorolojisi: rüzgar + hamle + nem + sıcaklık + VPD,
 * ayrıca yakıt kuruluğunu özetleyen FWI ve duman göstergesi PM2.5.
 * Koordinat 0.1°'ye yuvarlanır (cache anahtarı daralır).
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = Math.round(parseFloat(sp.get("lat") ?? "") * 10) / 10;
  const lon = Math.round(parseFloat(sp.get("lon") ?? "") * 10) / 10;
  // Kapsam dışı istekler reddedilir: aksi hâlde rastgele koordinatlarla
  // Open-Meteo ücretsiz kotası tüketilip herkes için hava paneli düşürülebilir.
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < 34.5 ||
    lat > 42.7 ||
    lon < 24.9 ||
    lon > 45.6
  ) {
    return NextResponse.json({ error: "lat/lon kapsam dışı" }, { status: 400 });
  }

  const ll = `latitude=${lat.toFixed(1)}&longitude=${lon.toFixed(1)}`;

  // FWI için 21 günlük geçmiş gerekiyor: derin katman kuruluğu (DC) günler
  // boyunca birikir, tek günün verisiyle hesaplanamaz.
  const weatherUrl =
    "https://api.open-meteo.com/v1/forecast?" +
    ll +
    "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m" +
    "&hourly=vapour_pressure_deficit" +
    "&daily=temperature_2m_max,relative_humidity_2m_min,wind_speed_10m_max,precipitation_sum" +
    "&past_days=21&forecast_days=1&wind_speed_unit=kmh&timezone=UTC";

  const airUrl =
    "https://air-quality-api.open-meteo.com/v1/air-quality?" +
    ll +
    "&current=pm2_5,pm10,us_aqi&forecast_days=1&timezone=UTC";

  // Eğim için merkez + 4 komşu (~1 km) yüksekliği. Copernicus DEM tabanlı.
  const DKM = 1.0;
  const dLat = DKM / 111;
  const dLon = DKM / (111 * Math.cos((lat * Math.PI) / 180));
  const eLats = [lat, lat + dLat, lat - dLat, lat, lat];
  const eLons = [lon, lon, lon, lon + dLon, lon - dLon];
  const elevUrl =
    "https://api.open-meteo.com/v1/elevation" +
    `?latitude=${eLats.map((x) => x.toFixed(4)).join(",")}` +
    `&longitude=${eLons.map((x) => x.toFixed(4)).join(",")}`;

  interface WeatherResp {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      wind_speed_10m?: number;
      wind_direction_10m?: number;
      wind_gusts_10m?: number;
    };
    hourly?: { time?: string[]; vapour_pressure_deficit?: number[] };
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      relative_humidity_2m_min?: number[];
      wind_speed_10m_max?: number[];
      precipitation_sum?: number[];
    };
  }
  interface AirResp {
    current?: { pm2_5?: number; pm10?: number; us_aqi?: number };
  }

  const data = await fetchJson<WeatherResp>(weatherUrl, 1800);
  if (!data) {
    return NextResponse.json(
      { error: "Hava verisine ulaşılamadı" },
      { status: 503 }
    );
  }

  // Hava kalitesi ve arazi opsiyonel — düşerse yangın meteorolojisi yine dönsün
  const air = (await fetchJson<AirResp>(airUrl, 1800)) ?? {};

  // Arazi: yükseklik ızgarasından eğim ve yokuş yukarı yön. Arazi değişmez → uzun cache.
  let terrain: WindPoint["terrain"] = null;
  {
    const ej = await fetchJson<{ elevation?: number[] }>(elevUrl, 2592000);
    if (ej) {
      const e = ej.elevation;
      if (e && e.length === 5 && e.every((x) => typeof x === "number")) {
        const [c, north, south, east, west] = e;
        const dzdy = (north - south) / (2 * DKM * 1000);
        const dzdx = (east - west) / (2 * DKM * 1000);
        const slopePct = Math.sqrt(dzdx * dzdx + dzdy * dzdy) * 100;
        // Yokuş yukarı: yükselme gradyanının yönü
        const upslopeDeg =
          slopePct < 1
            ? 0
            : (((Math.atan2(dzdx, dzdy) * 180) / Math.PI) + 360) % 360;
        terrain = {
          elevM: Math.round(c),
          slopePct: Math.round(slopePct * 10) / 10,
          upslopeDeg: Math.round(upslopeDeg),
        };
      }
    }
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

  // ── FWI serisi
  let fwi: WindPoint["fwi"] = null;
  const d = data.daily;
  if (d?.time && d.temperature_2m_max && d.relative_humidity_2m_min && d.wind_speed_10m_max && d.precipitation_sum) {
    const days: FwiDay[] = [];
    for (let i = 0; i < d.time.length; i++) {
      const t = d.temperature_2m_max[i];
      const rh = d.relative_humidity_2m_min[i];
      const w = d.wind_speed_10m_max[i];
      const rain = d.precipitation_sum[i];
      if (
        typeof t !== "number" || typeof rh !== "number" ||
        typeof w !== "number" || typeof rain !== "number"
      ) continue;
      days.push({
        t,
        rh: Math.max(1, Math.min(100, rh)),
        wind: w,
        rain,
        month: new Date(d.time[i]).getUTCMonth(),
      });
    }
    const codes = runFwiSeries(days);
    if (codes) {
      const cls = fwiClass(codes.fwi);
      fwi = { ...codes, label: cls.label, level: cls.level, days: days.length };
    }
  }

  const body: WindPoint = {
    tempC: cur.temperature_2m ?? null,
    rh: cur.relative_humidity_2m ?? null,
    windKmh: cur.wind_speed_10m ?? null,
    windDirDeg: cur.wind_direction_10m ?? null,
    gustKmh: cur.wind_gusts_10m ?? null,
    vpdKpa: vpd,
    pm25: air.current?.pm2_5 ?? null,
    pm10: air.current?.pm10 ?? null,
    aqi: air.current?.us_aqi ?? null,
    terrain,
    fwi,
    time: Date.now(),
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
