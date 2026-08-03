import { NextResponse } from "next/server";
import { loadFires } from "@/lib/fires-server";
import { classifyAircraft, fireCenters, type AdsbRaw } from "@/lib/aircraft";
import { fetchJson } from "@/lib/fetch-retry";

/**
 * Yangın söndürme hava araçları — api.airplanes.live (ücretsiz, anahtarsız).
 *
 * Tüm bölgeyi taramıyoruz: önce aktif yangın merkezleri bulunuyor, sorgu
 * yalnız onların çevresine atılıyor. Yangın yoksa tek bir upstream isteği
 * bile gitmiyor — kışın bu uç bedava.
 *
 * Cache 30 sn: 60 saniyede uçaklar ekranda donuk duruyor ve harita canlı
 * görünmüyordu. Daha sık sormak gönüllü besleme ağına gereksiz yük olur.
 */

/** API'nin nokta sorgusu; yarıçap deniz mili (tavan 250) */
const YARICAP_NM = 60;

export async function GET() {
  let centers: ReturnType<typeof fireCenters> = [];
  try {
    const { points } = await loadFires("1");
    centers = fireCenters(points);
  } catch {
    // Yangın verisi yoksa nereye bakacağımızı bilmiyoruz. Boş liste
    // "uçak yok" demek DEĞİL; arayüz bu ayrımı sebebiyle birlikte yazıyor.
    return NextResponse.json(
      { aircraft: [], centers: 0, fetchedAt: Date.now(), reason: "fires" },
      { headers: { "Cache-Control": "public, s-maxage=30" } }
    );
  }

  if (centers.length === 0) {
    return NextResponse.json(
      { aircraft: [], centers: 0, fetchedAt: Date.now(), reason: "no-fires" },
      { headers: { "Cache-Control": "public, s-maxage=30" } }
    );
  }

  const raw: AdsbRaw[] = [];
  let failed = 0;
  for (const c of centers) {
    // Koordinat 0,1°'ye yuvarlanıyor: yangın merkezi her tazelemede birkaç
    // yüz metre oynuyor ve yuvarlanmazsa upstream URL'i sürekli değişip
    // cache'i işe yaramaz hâle getiriyordu.
    const lat = c.lat.toFixed(1);
    const lon = c.lon.toFixed(1);
    const data = await fetchJson<{ ac?: AdsbRaw[] }>(
      `https://api.airplanes.live/v2/point/${lat}/${lon}/${YARICAP_NM}`,
      30
    );
    if (data?.ac) raw.push(...data.ac);
    else failed++;
    // Gönüllü işletilen ücretsiz servis — istekleri sıraya diziyoruz.
    await new Promise((r) => setTimeout(r, 250));
  }

  const aircraft = classifyAircraft(raw, centers);

  return NextResponse.json(
    {
      aircraft,
      centers: centers.length,
      scanned: raw.length,
      failed,
      fetchedAt: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=90",
      },
    }
  );
}
