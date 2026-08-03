import { NextRequest, NextResponse } from "next/server";
import { fetchMtgSlot } from "@/lib/meteosat";
import { fixedSourceAt } from "@/lib/fixed-sources";
import { nearestPlace } from "@/lib/places";
import { supabaseAdmin } from "@/lib/ml-db";

/**
 * Arşivden geriye doldurma.
 *
 * NEDEN: Modeli eğitmek için haftalarca veri birikmesini beklemek gerekmez
 * — LSA SAF MTG arşivi 1 Ocak 2025'e kadar geriye işlenmiş durumda. Aynı
 * 10 dakikalık dilimler orada duruyor.
 *
 * Bu, "ezber yapmasın" isteğinin de doğrudan karşılığı: bir modelin
 * genelleyip genellemediğini ancak FARKLI zamanlardaki, farklı yangınlarda
 * sınayarak anlarsın. Tek haftalık veriyle eğitilen model o haftanın
 * yangınlarını ezberler; bir sezonluk veriyle eğitilen model mevsim,
 * bölge ve yakıt çeşitliliği görür.
 *
 * Tek istekte sınırlı sayıda dilim işlenir (fonksiyon süresi), çağıran
 * imleci ilerletir. `?from=2026-08-02T12:00:00Z&slots=18`
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Tek turda en fazla kaç 10-dakikalık dilim. */
const MAX_SLOTS = 24;

export async function GET(req: NextRequest) {
  const secret = process.env.ML_INGEST_SECRET;
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  if ("error" in db) return NextResponse.json(db, { status: 500 });

  const from = Date.parse(req.nextUrl.searchParams.get("from") ?? "");
  if (!Number.isFinite(from)) {
    return NextResponse.json({ error: "from (ISO tarih) gerekli" }, { status: 400 });
  }
  const slots = Math.min(
    MAX_SLOTS,
    Math.max(1, Number(req.nextUrl.searchParams.get("slots") ?? MAX_SLOTS))
  );

  // Dilimler 10 dakikaya hizalı; hizasız bir `from` sessizce kaymasın.
  const bas = Math.floor(from / 600_000) * 600_000;

  const rows: Record<string, unknown>[] = [];
  let okunan = 0;
  let bos = 0;

  for (let i = 0; i < slots; i++) {
    const d = new Date(bas + i * 600_000);
    if (d.getTime() > Date.now()) break;
    const fires = await fetchMtgSlot(d);
    if (!fires) {
      bos++;
      continue;
    }
    okunan++;
    for (const f of fires) {
      const yer = nearestPlace(f.lon, f.lat);
      const sabit = fixedSourceAt(f.lon, f.lat);
      rows.push({
        source: "MTG",
        scanned_at: new Date(f.dt).toISOString(),
        lon: f.lon,
        lat: f.lat,
        frp: f.frp,
        pixel_km2: f.pixelKm2,
        confidence: f.conf,
        place: yer.name,
        il: yer.il,
        abroad: yer.abroad,
        fixed_source_days: sabit?.days ?? null,
      });
    }
  }

  if (rows.length) {
    const yaz = await db.upsert(
      "heat_signal?on_conflict=source,scanned_at,lon,lat",
      rows,
      "ignore-duplicates"
    );
    if ("error" in yaz) return NextResponse.json(yaz, { status: 502 });
  }

  const sonraki = new Date(bas + slots * 600_000).toISOString();
  return NextResponse.json({
    ok: true,
    from: new Date(bas).toISOString(),
    okunanDilim: okunan,
    bosDilim: bos,
    rows: rows.length,
    // Çağıran imleci buradan ilerletir.
    next: sonraki,
  });
}
