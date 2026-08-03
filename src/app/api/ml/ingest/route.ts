import { NextRequest, NextResponse } from "next/server";
import { fetchLatest } from "@/lib/meteosat";
import { fixedSourceAt } from "@/lib/fixed-sources";
import { nearestPlace } from "@/lib/places";

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
 *
 * Kimlik doğrulama: `ML_INGEST_SECRET`. Uç açık olsaydı herkes bizim
 * adımıza LSA SAF'a yük bindirebilirdi.
 */

export const dynamic = "force-dynamic";

/**
 * Ortam değişkeni temizliği.
 *
 * Panele elle girilen değerlere görünmez karakter bulaşıyor: BOM (U+FEFF),
 * CRLF, kopyalarken kaçan tırnak. Bu projede zaten yaşandı — Windows'ta
 * `vercel env add` pipe'ı FIRMS anahtarına `\r` ekleyip üretimde 4/4
 * "Invalid MAP_KEY" verdirmişti; kardeş projede Turnstile anahtarına BOM
 * bulaşmıştı. Bu tür bozulma sessizdir ve "fetch failed: unknown scheme"
 * gibi hiçbir şey anlatmayan hatalarla çıkar.
 */
function cleanEnv(v: string | undefined): string {
  return (v ?? "").replace(/^﻿/, "").replace(/^["']|["']$/g, "").trim();
}

const SUPABASE_URL_RE = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i;

/**
 * Proje URL'ini service_role anahtarından türetir.
 *
 * Supabase JWT'sinin gövdesinde proje referansı (`ref`) zaten var; URL onun
 * bir fonksiyonu. Ayrı bir `SUPABASE_URL` değişkeni tutmak, birbiriyle
 * tutarsız olabilecek İKİNCİ bir yapılandırma noktası demek — nitekim
 * panele elle girilirken bozuldu (41 karakter, olması gereken 40) ve
 * "fetch failed: unknown scheme" diye hiçbir şey anlatmayan bir çökmeye
 * yol açtı. Anahtar doğruysa URL de doğrudur.
 */
function urlFromKey(key: string): string | null {
  try {
    const payload = key.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const ref = (JSON.parse(json) as { ref?: string }).ref;
    if (!ref || !/^[a-z0-9-]+$/i.test(ref)) return null;
    return `https://${ref}.supabase.co`;
  } catch {
    return null;
  }
}

interface Row {
  source: string;
  scanned_at: string;
  lon: number;
  lat: number;
  frp: number;
  pixel_km2: number;
  confidence: number;
  place: string;
  il: string;
  abroad: boolean;
  fixed_source_days: number | null;
}

export async function GET(req: NextRequest) {
  const secret = process.env.ML_INGEST_SECRET;
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key) {
    return NextResponse.json({ error: "supabase yapılandırılmadı" }, { status: 500 });
  }

  // Elle girilen URL yalnız BİÇİMİ doğruysa kullanılır; değilse anahtardan
  // türetilene düşülür. Böylece bozuk bir panel değeri sistemi durduramaz.
  const envUrl = cleanEnv(process.env.SUPABASE_URL).replace(/\/+$/, "");
  const url = SUPABASE_URL_RE.test(envUrl) ? envUrl : urlFromKey(key);
  if (!url) {
    return NextResponse.json(
      { error: "supabase URL çözülemedi", envUzunluk: envUrl.length },
      { status: 500 }
    );
  }

  const latest = await fetchLatest();
  if (!latest) {
    // Dilim yoksa bu bir hata değil: LSA SAF gecikmiş olabilir, sonraki
    // tur yakalar. 200 dönüyoruz ki cron gereksiz alarm üretmesin.
    return NextResponse.json({ ok: true, slot: null, rows: 0, note: "dilim yok" });
  }

  const rows: Row[] = latest.fires.map((f) => {
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
  const res = await fetch(`${url}/rest/v1/heat_signal?on_conflict=source,scanned_at,lon,lat`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    // Gövdeyi istemciye yansıtmıyoruz: anahtar/şema ayrıntısı sızabilir.
    console.error("heat_signal upsert", res.status, await res.text());
    return NextResponse.json({ error: "yazılamadı", status: res.status }, { status: 502 });
  }

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
