import { NextRequest, NextResponse } from "next/server";
import { reachShape } from "@/lib/geo";
import { reachRatio } from "@/lib/wind";
import { angleGap, pointInRing, progression } from "@/lib/progression";
import { supabaseAdmin } from "@/lib/ml-db";

/**
 * Tahmin doğrulama — "çizdiğimiz koni tuttu mu?"
 *
 * `/api/ml/cone` tahmini yazar, burası sonucu yazar. İkisi ayrı çünkü sonuç
 * ancak yangın bir sonraki uydu geçişinde yeniden görüldüğünde belli olur:
 * VIIRS/MODIS aynı noktaya günde ~2-4 kez uğruyor, yani cevap ortalama
 * 6-12 saat sonra geliyor.
 *
 * ⚠️ DOĞRULAMA KENDİ ÖLÇÜTÜNÜ YUMUŞATMAZ. Koninin 6 saatlik halkası
 * çiziliyor ve gerçek öncü kenar o şeklin İÇİNDE mi diye bakılıyor; şekli
 * gözlemi kapsayacak kadar büyütmek raporu güzelleştirir, aracı değil.
 * Arşiv oynatmasında bu oran %4 çıktı (n=45) — yani halkalar bugünkü
 * kalibrasyonda gerçek ilerlemeyi neredeyse hiç kapsamıyor. Canlı sayı bunun
 * yanına konacak; ikisi ayrışırsa oynatmanın iyimserliği ölçülmüş olur.
 */

export const dynamic = "force-dynamic";

/**
 * Tahmin kaç saat sonra doğrulanır.
 *
 * Koninin en uzun halkası 6 saat; ama FIRMS NRT gecikmesi ölçüldü, 1-8 saat.
 * 6 saatte bakmak, henüz yayınlanmamış tespiti "yangın oraya gitmedi" saymak
 * olurdu — sistematik olarak kendimizi haklı çıkarırdı. 10 saat, ölçülen en
 * kötü gecikmeye 2 saat pay bırakıyor.
 */
const VERIFY_AFTER_HOURS = 10;
/** Koninin ufku: bundan sonraki tespitler başka bir tahminin işi. */
const HORIZON_HOURS = 6;
const BATCH = 200;

interface ConeRow {
  id: number;
  event_id: number | null;
  issued_at: string;
  apex_lon: number;
  apex_lat: number;
  spread_deg: number;
  ring_6h_km: number | null;
}

interface DetRow {
  event_id: number;
  dt: string;
  lon: number;
  lat: number;
}

export async function GET(req: NextRequest) {
  const secret = process.env.ML_INGEST_SECRET;
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  if ("error" in db) return NextResponse.json(db, { status: 500 });

  const kesim = new Date(Date.now() - VERIFY_AFTER_HOURS * 3600_000).toISOString();
  const bekleyen = await db.select<ConeRow>(
    "cone_forecast?select=id,event_id,issued_at,apex_lon,apex_lat,spread_deg,ring_6h_km" +
      `&verified_at=is.null&issued_at=lt.${kesim}&event_id=not.is.null` +
      `&order=issued_at.asc&limit=${BATCH}`
  );
  if ("error" in bekleyen) return NextResponse.json(bekleyen, { status: 502 });
  if (!bekleyen.rows.length) return NextResponse.json({ ok: true, verified: 0 });

  // Tespitler olay bazında bir kez çekilir: aynı olayın birçok tahmini olabilir.
  const olaylar = [...new Set(bekleyen.rows.map((c) => c.event_id))].join(",");
  const enErken = bekleyen.rows.reduce(
    (a, c) => (c.issued_at < a ? c.issued_at : a),
    bekleyen.rows[0].issued_at
  );
  const tespit = await db.select<DetRow>(
    `fire_detection?select=event_id,dt,lon,lat&event_id=in.(${olaylar})` +
      `&dt=gte.${new Date(Date.parse(enErken) - 24 * 3600_000).toISOString()}` +
      "&order=dt.asc&limit=50000"
  );
  if ("error" in tespit) return NextResponse.json(tespit, { status: 502 });

  const byEvent = new Map<number, DetRow[]>();
  for (const d of tespit.rows) {
    const arr = byEvent.get(d.event_id);
    if (arr) arr.push(d);
    else byEvent.set(d.event_id, [d]);
  }

  const sonuc: Record<string, unknown>[] = [];
  let veriYok = 0;

  for (const c of bekleyen.rows) {
    const hepsi = byEvent.get(c.event_id!) ?? [];
    const t0 = Date.parse(c.issued_at);
    // Tahmin ANINDA yanmış olan alan (ayak izi) ve sonrasında görülenler
    const once = hepsi.filter((d) => Date.parse(d.dt) <= t0);
    const sonra = hepsi.filter((d) => {
      const t = Date.parse(d.dt);
      return t > t0 && t <= t0 + HORIZON_HOURS * 3600_000;
    });

    if (!once.length || !sonra.length) {
      // Yangın söndü ya da uydu bir daha görmedi. Bu bir BAŞARISIZLIK DEĞİL
      // ve "hata 0" diye yazılamaz; doğrulanmamış bırakmak da kuyruğu
      // sonsuza kadar şişirir. `hours_elapsed`'i yazıp geçiyoruz: sonuç
      // "gözlem yok" olarak ayrışabilsin.
      sonuc.push({
        id: c.id,
        verified_at: new Date().toISOString(),
        hours_elapsed: (Date.now() - t0) / 3600_000,
        observed_bearing_deg: null,
        observed_growth_km: null,
        error_deg: null,
        head_inside_shape: null,
        new_pixels: 0,
        new_pixels_inside: 0,
      });
      veriYok++;
      continue;
    }

    const il = progression(once, sonra);
    const ring =
      c.ring_6h_km && c.ring_6h_km > 0
        ? reachShape(c.apex_lon, c.apex_lat, c.spread_deg, c.ring_6h_km, reachRatio)
        : null;

    sonuc.push({
      id: c.id,
      verified_at: new Date().toISOString(),
      hours_elapsed:
        (Math.max(...sonra.map((d) => Date.parse(d.dt))) - t0) / 3600_000,
      observed_bearing_deg: il.headBearingDeg,
      observed_growth_km: il.headGrowthKm,
      error_deg:
        il.headBearingDeg === null ? null : angleGap(c.spread_deg, il.headBearingDeg),
      head_inside_shape: ring && il.head ? pointInRing(il.head, ring) : null,
      new_pixels: il.newPixels,
      new_pixels_inside: ring
        ? il.newPts.filter((p) => pointInRing(p, ring)).length
        : null,
    });
  }

  const yaz = await db.rpc<number>("apply_cone_verification", { payload: sonuc });
  if ("error" in yaz) return NextResponse.json(yaz, { status: 502 });

  const olculen = sonuc.filter((s) => s.error_deg !== null);
  const ortHata = olculen.length
    ? olculen.reduce((a, s) => a + (s.error_deg as number), 0) / olculen.length
    : null;

  return NextResponse.json({
    ok: true,
    verified: yaz.result,
    measured: olculen.length,
    noObservation: veriYok,
    meanErrorDeg: ortHata === null ? null : Math.round(ortHata * 10) / 10,
  });
}
