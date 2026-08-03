import { NextRequest, NextResponse } from "next/server";
import { fetchLatest } from "@/lib/meteosat";
import { fixedSourceAt } from "@/lib/fixed-sources";
import { nearestPlace } from "@/lib/places";
import { supabaseAdmin } from "@/lib/ml-db";

/**
 * Jeostasyoner ısı sinyallerini kalıcı hale getirir — ML eğitim seti.
 *
 * NEDEN: Platform şimdiye kadar her 10 dakikada bir MTG tespitlerini çöpe
 * atıyordu; `/api/meteosat` yalnız son dilimi döndürüyor. Bayramiç
 * yangınını 16:08'de görmüştük ve ertesi gün elimizde tek satır kanıt
 * yoktu, arşivden yeniden indirmek zorunda kaldık.
 *
 * ⚠️ HAVA/FWI/ARAZİ BİLEREK YAZILMIYOR. Tespit başına Open-Meteo sorgusu
 * günde ~11 bin isteğe çıkardı (şu anki tüm kullanımımız ~500) ve kotayı
 * patlatırdı. Gerek de yok: hava geçmişi Open-Meteo arşivinden yıllar
 * sonra bile aynı şekilde çekilebilir — YENİDEN ÜRETİLEBİLİR veri.
 * Uydu tespiti üretilemez; kaçırırsak sonsuza kadar gitmiştir. Bu yüzden
 * cron yalnız üretilemeyeni yazıyor, gerisi eğitim anında toplu doldurulur.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.ML_INGEST_SECRET;
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  if ("error" in db) return NextResponse.json(db, { status: 500 });

  const latest = await fetchLatest();
  if (!latest) {
    // Dilim yoksa bu bir hata değil: LSA SAF gecikmiş olabilir, sonraki
    // tur yakalar. 200 dönüyoruz ki cron gereksiz alarm üretmesin.
    return NextResponse.json({ ok: true, slot: null, rows: 0, note: "dilim yok" });
  }

  const rows = latest.fires.map((f) => {
    const yer = nearestPlace(f.lon, f.lat);
    const sabit = fixedSourceAt(f.lon, f.lat);
    return {
      source: latest.kaynak,
      // ACQTIME = gerçek tarama anı, dilim etiketi değil.
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
    };
  });

  if (!rows.length) {
    return NextResponse.json({ ok: true, slot: latest.slot, rows: 0 });
  }

  // Upsert: cron iki kez çalışsa ya da dilim tekrar gelse aynı tarama+piksel
  // ikinci satır açmasın (kısıt: source+scanned_at+lon+lat).
  const yaz = await db.upsert(
    "heat_signal?on_conflict=source,scanned_at,lon,lat",
    rows,
    "ignore-duplicates"
  );
  if ("error" in yaz) return NextResponse.json(yaz, { status: 502 });

  return NextResponse.json({
    ok: true,
    source: latest.kaynak,
    slot: latest.slot,
    scannedAt: rows[0]?.scanned_at ?? null,
    rows: rows.length,
    abroad: rows.filter((r) => r.abroad).length,
    fixedSource: rows.filter((r) => r.fixed_source_days !== null).length,
  });
}
