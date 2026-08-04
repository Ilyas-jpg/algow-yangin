import { NextRequest, NextResponse } from "next/server";
import { FiresUnavailableError, loadFires } from "@/lib/fires-server";
import type { FiresResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const daysParam = request.nextUrl.searchParams.get("days") ?? "1";

  let loaded;
  try {
    loaded = await loadFires(daysParam);
  } catch (e) {
    if (e instanceof FiresUnavailableError) {
      return NextResponse.json(
        { error: "FIRMS kaynaklarına ulaşılamadı" },
        { status: 503 }
      );
    }
    throw e;
  }

  const features: FiresResponse["features"] = loaded.points.map((p, i) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      // Zayıf bağlantı için yük kısma: 4 ondalık ≈ 11 m, uydu pikseli 375 m —
      // hassasiyet kaybı yok, karakter tasarrufu ciddi.
      coordinates: [
        Math.round(p.lon * 1e4) / 1e4,
        Math.round(p.lat * 1e4) / 1e4,
      ],
    },
    properties: {
      // İstemciye kısa sıra numarası gider; uzun dedupe anahtarı sunucuda kalır
      id: String(i),
      frp: Math.round(p.frp * 10) / 10,
      conf: p.conf,
      sat: p.sat,
      dt: p.dt,
      dn: p.dn,
      // Opsiyoneller yalnız değer taşıdıklarında yazılıyor: noktaların
      // büyük çoğunluğu doymamış ve MODIS tipi 0, `"x":0` / `"ty":0`
      // yazmak 7.700 noktada bedava olmayan bir yük olurdu.
      ...(p.scan !== undefined ? { sc: Math.round(p.scan * 100) / 100 } : {}),
      ...(p.track !== undefined ? { tk: Math.round(p.track * 100) / 100 } : {}),
      ...(p.saturated ? { x: 1 as const } : {}),
      ...(p.type !== undefined && p.type !== 0 ? { ty: p.type } : {}),
    },
  }));

  const body: FiresResponse = {
    type: "FeatureCollection",
    features,
    meta: loaded.meta,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=240, stale-while-revalidate=600",
    },
  });
}
