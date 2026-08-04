import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/fetch-retry";
import { inRegion } from "@/lib/bbox";
import { nearestPm25, type StationPm25 } from "@/lib/openaq";

/**
 * Duman tahmini — saatlik PM2.5.
 *
 * Yangının kendisinden etkilenen insan sayısı, dumanından etkilenenlerin
 * yanında küçük kalıyor: astım hastası, çocuk, yaşlı yangına 50 km uzakta
 * da etkileniyor. Platform şimdiye kadar yalnız ANLIK PM2.5 gösteriyordu;
 * "yarın sabah bizde olacak mı" sorusunun cevabı yoktu.
 *
 * ⚠️ Dağılımı biz modellemiyoruz — ECMWF/CAMS'in çalıştırdığı gerçek bir
 * dağılım modelinin çıktısını gösteriyoruz. Kendi sezgimizi model diye
 * sunmuyoruz; koni tahmininde öğrendiğimiz ders bu.
 */
const SAAT = 48;

export interface SmokePoint {
  /** epoch ms */
  t: number;
  /** µg/m³ */
  v: number;
  aqi: number | null;
}

export interface SmokeResponse {
  lat: number;
  lon: number;
  now: SmokePoint | null;
  peak: SmokePoint | null;
  series: SmokePoint[];
  /** CAMS çıktısının üretim anı bilinmiyor; veri tazeliği için istek anı */
  fetchedAt: number;
  /**
   * Yakındaki yer istasyonunun ÖLÇÜMÜ — varsa. Seriyi değiştirmez:
   * tahmin modelden, bu satır gözlemden gelir ve arayüz ikisini
   * birbirinden ayırarak yazar. null = menzilde taze istasyon yok.
   */
  station: StationPm25 | null;
}

interface AirResp {
  hourly?: {
    time?: number[];
    pm2_5?: (number | null)[];
    us_aqi?: (number | null)[];
  };
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  // 0,1°'ye yuvarla: anahtar sabit kalsın, cache tutsun, kota korunsun
  const lat = Math.round(parseFloat(sp.get("lat") ?? "") * 10) / 10;
  const lon = Math.round(parseFloat(sp.get("lon") ?? "") * 10) / 10;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "koordinat geçersiz" }, { status: 400 });
  }
  // Kapsam kontrolü: ücretsiz kota rastgele koordinatlarla tüketilmesin.
  // Sınır `lib/bbox`'tan — elle yazılan kopya, kutu batıya genişletilince
  // Yunanistan'daki yangınlarda duman tahminini 400'e düşürüyordu.
  if (!inRegion(lon, lat)) {
    return NextResponse.json({ error: "kapsam dışı" }, { status: 400 });
  }

  const url =
    "https://air-quality-api.open-meteo.com/v1/air-quality" +
    `?latitude=${lat.toFixed(1)}&longitude=${lon.toFixed(1)}` +
    "&hourly=pm2_5,us_aqi&forecast_days=3&timeformat=unixtime&timezone=UTC";

  const data = await fetchJson<AirResp>(url, 1800);
  const h = data?.hourly;
  if (!h?.time?.length || !h.pm2_5) {
    return NextResponse.json(
      { error: "duman tahminine ulaşılamadı" },
      { status: 503 }
    );
  }

  const now = Date.now();
  const series: SmokePoint[] = [];
  for (let i = 0; i < h.time.length; i++) {
    const t = h.time[i] * 1000;
    const v = h.pm2_5[i];
    // Geçmiş saatleri ve boş değerleri atla; seri "bundan sonrası"nı anlatır
    if (t < now - 3600_000 || v == null) continue;
    series.push({ t, v, aqi: h.us_aqi?.[i] ?? null });
    if (series.length >= SAAT) break;
  }

  const peak = series.reduce<SmokePoint | null>(
    (best, p) => (best === null || p.v > best.v ? p : best),
    null
  );

  // Ölçüm modelin YERİNE geçmiyor, yanına geliyor. Bulunamazsa null döner
  // ve arayüz "model" etiketiyle devam eder — sessizce boş kalmaz.
  const station = await nearestPm25(lon, lat, now);

  const body: SmokeResponse = {
    lat,
    lon,
    now: series[0] ?? null,
    peak,
    series,
    fetchedAt: now,
    station,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
