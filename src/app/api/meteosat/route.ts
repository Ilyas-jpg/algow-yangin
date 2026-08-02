import { NextResponse } from "next/server";
import { fetchLatest } from "@/lib/meteosat";

/**
 * Meteosat (MSG/SEVIRI) 15 dakikalık yangın tespitleri.
 * Ayrı uç: VIIRS ile karıştırılmamalı — çözünürlüğü çok daha kaba,
 * arayüzde de ayrı katman ve ayrı görsel dille sunuluyor.
 */
export async function GET() {
  if (!process.env.LSASAF_USER || !process.env.LSASAF_PASS) {
    return NextResponse.json(
      { error: "Meteosat erişimi yapılandırılmamış", features: [], meta: null },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=3600" } }
    );
  }

  let latest;
  try {
    latest = await fetchLatest();
  } catch {
    latest = null;
  }
  if (!latest) {
    return NextResponse.json(
      { error: "Meteosat verisi alınamadı", features: [], meta: null },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=300" } }
    );
  }

  const body = {
    type: "FeatureCollection" as const,
    features: latest.fires.map((f, i) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [f.lon, f.lat] },
      properties: {
        id: `m${i}`,
        frp: f.frp,
        conf: f.conf,
        pixelKm2: f.pixelKm2,
        dt: f.dt,
      },
    })),
    meta: {
      slot: latest.slot,
      count: latest.fires.length,
      kaynak: latest.kaynak,
      /** dilim aralığı (dk) — MTG 10, MSG 15 */
      araDk: latest.kaynak === "MTG" ? 10 : 15,
      source:
        latest.kaynak === "MTG"
          ? "EUMETSAT LSA SAF · MTG FCI FRP-PIXEL"
          : "EUMETSAT LSA SAF · MSG SEVIRI FRP-PIXEL",
    },
  };

  return NextResponse.json(body, {
    headers: {
      // Ürün 15 dakikada bir yenileniyor; ara sorgular önbellekten dönsün
      "Cache-Control": "public, s-maxage=420, stale-while-revalidate=900",
    },
  });
}
