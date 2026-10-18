import { NextResponse } from "next/server";
import { loadFires } from "@/lib/fires-server";
import { classifyAircraft, fireCenters, type AdsbRaw } from "@/lib/aircraft";

/**
 * Yangın söndürme hava araçları — api.adsb.lol (açık veri, ODbL, anahtarsız).
 * Kaynak neden değişti: `lib/aircraft.ts` başı (airplanes.live 403).
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

/**
 * adsb.lol genel User-Agent'ı reddediyor: Node'un varsayılanıyla her istek
 * 403 "User-Agent too generic; include valid contact info" (ölçüldü
 * 2026-10-18; curl'ün UA'sı geçiyor, o yüzden elle denemede görünmüyor).
 * Kim olduğumuzu ve nereden ulaşılacağını söyleyen UA şart.
 */
const ISTEK = {
  headers: {
    "User-Agent":
      "algow-yangin/1.0 (+https://yangin.algow.net; https://github.com/Ilyas-jpg/algow-yangin)",
  },
};

/**
 * Sorgulanan yangın merkezi tavanı ve istek aralığı. adsb.lol'ün oran sınırı
 * IP başına ve "yüke göre dinamik"; ölçüldü (2026-10-18): 250 ms arayla
 * üçüncü istekten sonrası 429. Vercel'in çıkış IP'leri başka projelerle
 * paylaşıldığı için pay daha da dar olabilir. Bu yüzden en güçlü üç yangın,
 * istekler arası 1,1 sn ve tek deneme: 429 gelince kalan merkezler hiç
 * sorulmaz — yinelemek yalnız cezayı uzatır. Hava müdahalesi en büyük
 * yangınlarda olduğu için en güçlü üçü asıl işi görüyor.
 */
const MAX_MERKEZ = 3;
const ARA_MS = 1100;

export async function GET() {
  let centers: ReturnType<typeof fireCenters> = [];
  try {
    const { points } = await loadFires("1");
    centers = fireCenters(points, MAX_MERKEZ);
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
  for (const [i, c] of centers.entries()) {
    // Gönüllü işletilen ücretsiz servis — istekler sıraya diziliyor.
    if (i > 0) await new Promise((r) => setTimeout(r, ARA_MS));
    // Koordinat 0,1°'ye yuvarlanıyor: yangın merkezi her tazelemede birkaç
    // yüz metre oynuyor ve yuvarlanmazsa upstream URL'i sürekli değişip
    // cache'i işe yaramaz hâle getiriyordu.
    const lat = c.lat.toFixed(1);
    const lon = c.lon.toFixed(1);
    let res: Response | null = null;
    try {
      res = await fetch(`https://api.adsb.lol/v2/point/${lat}/${lon}/${YARICAP_NM}`, {
        ...ISTEK,
        next: { revalidate: 30 },
      });
    } catch {
      res = null;
    }
    if (res?.status === 429) {
      failed += centers.length - i;
      break;
    }
    const data = res?.ok
      ? ((await res.json().catch(() => null)) as { ac?: AdsbRaw[] } | null)
      : null;
    // Boş `ac` dizisi "bu yarıçapta uçak yok" demek, düşüş değil; yalnız
    // dizinin kendisi yoksa (hata, 403, bozuk gövde) sorgu düşmüş sayılır.
    if (Array.isArray(data?.ac)) raw.push(...data.ac);
    else failed++;
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
