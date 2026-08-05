import { NextRequest, NextResponse } from "next/server";
import { havKm, reachShape } from "@/lib/geo";
import { reachRatio } from "@/lib/wind";
import { angleGap, makulIlerlemeKm, pointInRing, progression } from "@/lib/progression";
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
  /** Tahmin anındaki rüzgâr — erişim şekli buna bağlı, doğrulama da öyle olmalı. */
  wind_kmh: number | null;
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
    "cone_forecast?select=id,event_id,issued_at,apex_lon,apex_lat,spread_deg,ring_6h_km,wind_kmh" +
      `&verified_at=is.null&issued_at=lt.${kesim}&event_id=not.is.null` +
      `&order=issued_at.asc&limit=${BATCH}`
  );
  if ("error" in bekleyen) return NextResponse.json(bekleyen, { status: 502 });
  if (!bekleyen.rows.length) return NextResponse.json({ ok: true, verified: 0 });

  /*
   * 🔴 TESPİTLER `event_id` İLE EŞLEŞTİRİLEMEZ — ÖLÇÜLDÜ (2026-08-04).
   *
   * Olay kimliği FIRMS penceresine bağlı: ID ilk geçişten türüyor, pencere
   * kayınca ilk geçiş düşüyor ve aynı yangın YENİ bir `event_key` alıyor.
   * Paylaşım linklerinde bu `lib/event-id.resolveEvent` ile çözülmüştü ama ML
   * boru hattı tam eşleşme kullanmaya devam etmiş. Sonuç sessiz ve toptan:
   * 3 Ağustos 20:06'da yazılan 14 tahminin hepsinde "sonraki geçişte tespit
   * yok" çıktı, oysa aynı yangınların tespitleri 4 Ağustos 13:40'a kadar
   * tabloda vardı — BAŞKA event_id altında. Doğrulanan 44 tahminin 44'ü
   * "gözlem yok" oldu, yani karne hiçbir zaman sayı üretemezdi.
   * Kanıt: `fire_event`'te aynı 0,05° hücrede 2 ayrı kimlik, anahtarları
   * yalnız saat ekinde farklı (`21.21:42.53:496067` / `21.21:42.54:496066`).
   *
   * Çözüm: eşleştirme UZAYSAL. Tahminin tepe noktasının çevresindeki tüm
   * tespitler çekiliyor, kimlik hiç kullanılmıyor.
   * ⚠️ Bedeli açık: 15 km içindeki AYRI bir yangının pikselleri de bu
   * yangının ayak izine karışabilir. Aynı takas arşiv ölçümünde de yapıldı
   * (MAX_ILER_KM = 15) ve orada zincirlenmeyi ayıklayan şey bu yarıçaptı;
   * kimlikle eşleştirmenin bedeli ise ölçümün TAMAMEN durması.
   */
  const YARICAP_KM = 15;
  const enErken = bekleyen.rows.reduce(
    (a, c) => (c.issued_at < a ? c.issued_at : a),
    bekleyen.rows[0].issued_at
  );
  // Bekleyen tahminlerin tamamını kapsayan kutu (+ yarıçap payı)
  const pad = YARICAP_KM / 111;
  const lo = bekleyen.rows.reduce(
    (a, c) => ({
      lon: Math.min(a.lon, c.apex_lon - pad / Math.cos((c.apex_lat * Math.PI) / 180)),
      lat: Math.min(a.lat, c.apex_lat - pad),
    }),
    { lon: 180, lat: 90 }
  );
  const hi = bekleyen.rows.reduce(
    (a, c) => ({
      lon: Math.max(a.lon, c.apex_lon + pad / Math.cos((c.apex_lat * Math.PI) / 180)),
      lat: Math.max(a.lat, c.apex_lat + pad),
    }),
    { lon: -180, lat: -90 }
  );
  const tespit = await db.select<DetRow>(
    "fire_detection?select=event_id,dt,lon,lat" +
      `&lon=gte.${lo.lon.toFixed(4)}&lon=lte.${hi.lon.toFixed(4)}` +
      `&lat=gte.${lo.lat.toFixed(4)}&lat=lte.${hi.lat.toFixed(4)}` +
      `&dt=gte.${new Date(Date.parse(enErken) - 24 * 3600_000).toISOString()}` +
      "&order=dt.asc&limit=50000"
  );
  if ("error" in tespit) return NextResponse.json(tespit, { status: 502 });

  const sonuc: Record<string, unknown>[] = [];
  let veriYok = 0;

  for (const c of bekleyen.rows) {
    // Kimlik yerine yarıçap: tepe noktasının YARICAP_KM çevresindeki tespitler
    const hepsi = tespit.rows.filter(
      (d) => havKm(c.apex_lon, c.apex_lat, d.lon, d.lat) <= YARICAP_KM
    );
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
        // 🔑 NULL, 0 DEĞİL. "Uydu bir daha görmedi" ile "gördü ama yangın
        // ilerlemedi" farklı iki sonuç ve ikisi de yön hatası üretmiyor;
        // ikisine de 0 yazmak karnede birbirine karışır. null = bilinmiyor.
        new_pixels: null,
        new_pixels_inside: null,
      });
      veriYok++;
      continue;
    }

    /* 🐛 DÜZELTME 2026-08-05 — "8 km'de 0,7 saat" hatası.
     * Doğrulama tespitleri kimlikle değil YARIÇAPLA topluyor (kümeleme yok),
     * bu yüzden aynı yarıçapa düşen AYRI bir yangın bu yangının "başı"
     * sayılabiliyordu. Canlı karnede tam bu oldu: tek bir olayın 7 tahmininde
     * de gözlenen ilerleme birebir 7,92 km / 322° yazıldı — oysa geçen süre
     * 0,7 ile 5,6 saat arasında değişiyordu. 0,7 saatte 7,92 km = 11,3 km/sa,
     * korpustaki 2.383 vakanın hiçbirinde görülmeyen bir hız (max 7,44).
     * Sonuç: kapsama 0/7 çıktı ve yön hatası şişti.
     * Çözüm: geçen süreye göre makul ilerleme tavanı (bkz. MAX_ILERLEME_KMH). */
    const gecenSaat =
      (Math.max(...sonra.map((d) => Date.parse(d.dt))) - t0) / 3600_000;
    const il = progression(once, sonra, undefined, makulIlerlemeKm(gecenSaat));
    // Şekil, tahmin ANINDA kaydedilen rüzgâr hızıyla yeniden kuruluyor:
    // erişim zarfı 2026-08-04'ten beri rüzgâra bağlı (zayıfta daire, güçlüde
    // damla). Sabit şekille puanlamak, çizilmemiş bir şekli doğrulamak olurdu.
    // Eski satırlarda `wind_kmh` null olabilir → reachRatio zayıf profile düşer.
    const ring =
      c.ring_6h_km && c.ring_6h_km > 0
        ? reachShape(c.apex_lon, c.apex_lat, c.spread_deg, c.ring_6h_km, (off) =>
            reachRatio(off, c.wind_kmh ?? undefined)
          )
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
