import { NextResponse } from "next/server";
import { fetchLatest } from "@/lib/sentinel3";

/**
 * Sentinel-3 SLSTR FRP (NRT) — ayrı uç, ayrı katman.
 *
 * VIIRS ile aynı sayaca KARIŞMAZ: piksel 1 km (VIIRS 375 m) ve gecikme
 * ~110 dk. Arayüzde kendi etiketiyle sunulacak; iki farklı çözünürlüğü
 * tek sayıda toplamak Meteosat'ta da yapılmadı, burada da yapılmıyor.
 *
 * Anahtar yoksa 200 + boş dizi: harita açılmaya devam etsin, katman
 * sessizce yokmuş gibi davranmasın diye `error` alanı dolu döner.
 */
export async function GET() {
  if (!process.env.EUMETSAT_KEY || !process.env.EUMETSAT_SECRET) {
    return NextResponse.json(
      { error: "Sentinel-3 erişimi yapılandırılmamış", features: [], meta: null },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=3600" } }
    );
  }

  let sonuc;
  try {
    sonuc = await fetchLatest(12);
  } catch {
    sonuc = null;
  }
  if (!sonuc) {
    return NextResponse.json(
      { error: "Sentinel-3 verisi alınamadı", features: [], meta: null },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=300" } }
    );
  }

  return NextResponse.json(
    {
      type: "FeatureCollection" as const,
      features: sonuc.fires.map((f, i) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [
            Math.round(f.lon * 1e4) / 1e4,
            Math.round(f.lat * 1e4) / 1e4,
          ],
        },
        properties: {
          id: `s${i}`,
          frp: Math.round(f.frp * 10) / 10,
          // FIRMS'te olmayan alan: ölçümün kendi hata payı
          frpErr: Math.round(f.frpErr * 10) / 10,
          conf: Math.round(f.conf),
          sat: f.sat,
          dn: f.dn,
          dt: f.dt,
          // FIRMS scan/track karşılığı — piksel ayak izi elipsi bunu kullanır
          sc: Math.round(f.actrack * 100) / 100,
          tk: Math.round(f.altrack * 100) / 100,
        },
      })),
      meta: {
        count: sonuc.fires.length,
        granul: sonuc.granul,
        newest: sonuc.newest,
        /** ölçülen üretim gecikmesi (dk) — arayüzde dürüstçe yazılacak */
        gecikmeDk: 110,
        /**
         * İndirilemeyen granüllerin sebepleri. Yalnız HTTP durumu taşır,
         * kimlik bilgisi taşımaz. Katmanın sessizce boş kalması ile
         * "gerçekten tespit yok" ayrımı dışarıdan görülebilsin diye var
         * (FIRMS route'undaki meta.errors ile aynı gerekçe).
         */
        errors: sonuc.errors,
        source: "EUMETSAT Data Store · Sentinel-3 SLSTR L2 FRP (NRT)",
      },
    },
    {
      // Granüller ~3 saatte bir düşüyor; ara sorgular önbellekten dönsün
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    }
  );
}
