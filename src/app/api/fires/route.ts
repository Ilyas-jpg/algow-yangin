import { NextRequest, NextResponse } from "next/server";
import { FIRMS_SOURCES, firmsAreaUrl, parseFirmsCsv } from "@/lib/firms";
import { genFixtureCsv } from "@/data/fixture";
import type { FirePoint, FiresResponse } from "@/lib/types";

const WINDOW_TO_DAYRANGE: Record<string, { hours: number; dayRange: number }> = {
  "1": { hours: 24, dayRange: 2 },
  "2": { hours: 48, dayRange: 3 },
  "7": { hours: 168, dayRange: 8 },
};

export async function GET(request: NextRequest) {
  const daysParam = request.nextUrl.searchParams.get("days") ?? "1";
  const win = WINDOW_TO_DAYRANGE[daysParam] ?? WINDOW_TO_DAYRANGE["1"];
  const now = Date.now();
  const mapKey = process.env.FIRMS_MAP_KEY;

  let points: FirePoint[] = [];
  let sourcesOk = 0;
  const errors: string[] = [];
  const demo = !mapKey;

  if (!mapKey) {
    points = parseFirmsCsv(genFixtureCsv(now));
    sourcesOk = 1;
  } else {
    const results = await Promise.allSettled(
      FIRMS_SOURCES.map(async (source) => {
        const res = await fetch(firmsAreaUrl(mapKey, source, win.dayRange), {
          next: { revalidate: 600 },
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`${source}: HTTP ${res.status} ${text.slice(0, 80)}`);
        // FIRMS hata durumunda da 200 + düz metin dönebiliyor
        if (!text.startsWith("latitude"))
          throw new Error(`${source}: beklenmeyen yanıt: ${text.slice(0, 80)}`);
        return parseFirmsCsv(text);
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        sourcesOk++;
        points.push(...r.value);
      } else {
        errors.push(String(r.reason?.message ?? r.reason).slice(0, 140));
      }
    }
    if (sourcesOk === 0) {
      console.error("FIRMS tüm kaynaklar fail:", errors);
      return NextResponse.json(
        { error: "FIRMS kaynaklarına ulaşılamadı", errors },
        { status: 503 }
      );
    }
  }

  // Pencere filtresi + tekrar temizliği
  const cutoff = now - win.hours * 3600_000;
  const seen = new Set<string>();
  const features: FiresResponse["features"] = [];
  let newest: number | null = null;

  for (const p of points) {
    if (p.dt < cutoff || p.dt > now + 30 * 60_000) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    if (newest === null || p.dt > newest) newest = p.dt;
    // Zayıf bağlantı için yük kısma: 4 ondalık ≈ 11 m, uydu pikseli 375 m —
    // hassasiyet kaybı yok, karakter tasarrufu ciddi.
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          Math.round(p.lon * 1e4) / 1e4,
          Math.round(p.lat * 1e4) / 1e4,
        ],
      },
      properties: {
        // İstemciye kısa sıra numarası gider; uzun dedupe anahtarı sunucuda kalır
        id: String(features.length),
        frp: Math.round(p.frp * 10) / 10,
        conf: p.conf,
        sat: p.sat,
        dt: p.dt,
        dn: p.dn,
      },
    });
  }

  const body: FiresResponse = {
    type: "FeatureCollection",
    features,
    meta: {
      demo,
      fetchedAt: now,
      newest,
      windowHours: win.hours,
      sourcesOk,
      sourcesTotal: demo ? 1 : FIRMS_SOURCES.length,
    },
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=240, stale-while-revalidate=600",
    },
  });
}
