import { NextRequest, NextResponse } from "next/server";
import { corineAt, type FuelClass } from "@/lib/corine";

/**
 * Toplu yakıt sınıflandırma — "anız mı orman mı" süzgeci için.
 *
 * /api/terrain'in hafif kardeşi: yükseklik sorgusu yok, yalnız CORINE.
 * Olayların yarısından çoğu güneydoğuda tarımsal anız yakma (6 sezonluk
 * ölçümde 3.196 vakanın 1.653'ü); kullanıcı bunları gizleyebilsin diye
 * her olayın örtüsünü bilmemiz gerekiyor.
 *
 * Kota disiplini: koordinat 0,05°'ye yuvarlanır (anahtar sabit), yanıt 30 gün
 * cache'lenir, istekler altışarlı dalgalar hâlinde gider. Eşzamanlı yüklenen
 * onlarca istek upstream'i 429'a düşürüyor — bu dersi rüzgâr gridinde
 * ödemiştik, tekrarlamıyoruz.
 */
const MAX_PTS = 60;
const DALGA = 6;

export interface FuelPoint {
  lon: number;
  lat: number;
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

  const points: FuelPoint[] = [];
  for (let i = 0; i < pts.length; i += DALGA) {
    const dilim = pts.slice(i, i + DALGA);
    const fuels = await Promise.all(dilim.map((p) => corineAt(p.lon, p.lat)));
    dilim.forEach((p, j) => points.push({ ...p, fuel: fuels[j] }));
  }

  return NextResponse.json(
    { points },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
