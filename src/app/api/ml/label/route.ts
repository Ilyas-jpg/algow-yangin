import { NextRequest, NextResponse } from "next/server";
import { loadFires, loadFiresForDate } from "@/lib/fires-server";
import { havKm } from "@/lib/geo";
import { supabaseAdmin } from "@/lib/ml-db";

/**
 * Etiketleme — eğitim setinin doğruluk kaynağı.
 *
 * ⚠️ EN KRİTİK TASARIM KARARI: "kanıt yok" ETİKET DEĞİLDİR.
 *
 * Mert'in ilk önerisi "haber yoksa yanlış sinyal diye etiketle" idi. Bunu
 * ölçtük ve reddettik: Bayramiç'te 303 MW'lık gerçek orman yangınını VIIRS
 * HİÇ görmedi ve ilk haber olaydan 91 dakika sonra çıktı. O sinyal
 * "yangın değil" diye etiketlenseydi, model tam da yakalamak için var
 * olduğumuz yangın sınıfını görmezden gelmeyi öğrenirdi.
 *
 * Bu yüzden üç değerli etiket var ve `unknown` EĞİTİME GİRMEZ:
 *   fire      ← VIIRS/MODIS doğruladı (5 km, ±3 sa) — kesin pozitif
 *   fire      ← haber eşleşti — ikincil pozitif
 *   not_fire  ← bilinen sabit sanayi kaynağı — kesin negatif
 *   unknown   ← hiçbiri. Yangın da olabilir, olmayabilir; BİLMİYORUZ.
 *
 * Bu, klasik "positive-unlabeled" durumu. Bilmediğimize isim takmak
 * modeli değil, sadece raporladığımız doğruluğu iyileştirirdi.
 */

export const dynamic = "force-dynamic";

/**
 * Sinyal kaç saat sonra etiketlenir.
 *
 * FIRMS NRT gecikmesi ÖLÇÜLDÜ: 1-8 saat (bkz. tespit kabiliyeti notu).
 * 3 saatte etiketlemek, henüz yayınlanmamış bir VIIRS doğrulamasını
 * "yok" saymak olurdu — yani gerçek yangınları `unknown`'a düşürürdü.
 * 12 saat, ölçülen en kötü duruma 4 saat pay bırakıyor.
 */
const LABEL_AFTER_HOURS = 12;

/** Aynı yangın sayılma yarıçapı — MTG pikseli ~1,4 km, VIIRS 375 m. */
const CONFIRM_KM = 5;

/** Zaman penceresi: jeostasyoner sürekli görür, kutupsal geçişte görür. */
const CONFIRM_HOURS = 3;

/** Tek turda işlenecek sinyal sayısı — fonksiyon süresini sınırlar. */
const BATCH = 500;

/**
 * Yanma tesisine bu mesafeden yakın tespit, VIIRS doğrulasa bile `fire`
 * SAYILMAZ — `unknown` olur.
 *
 * Ölçüldü: OSM'den 7.771 yanma tesisi eklendikten sonra, tesise 1 km'den
 * yakın 71 tespitin 71'i `fire` etiketlenmişti (yalnız 2 `unknown`).
 * Sebep basit: VIIRS bacayı da görür. Yani "VIIRS doğruladı" o mesafede
 * yangın kanıtı değil, tesisin sıcak olduğunun kanıtı.
 *
 * `not_fire` de demiyoruz: rafineriden 800 m ötede gerçek bir yangın
 * çıkabilir ve orada GERÇEKTEN bilmiyoruz. Bilmediğimize isim takmak
 * modeli değil, yalnız raporladığımız doğruluğu iyileştirir.
 */
const INDUSTRIAL_AMBIGUOUS_KM = 1;

interface Signal {
  id: number;
  lon: number;
  lat: number;
  scanned_at: string;
  fixed_source_days: number | null;
  industrial_km: number | null;
}

export async function GET(req: NextRequest) {
  const secret = process.env.ML_INGEST_SECRET;
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  if ("error" in db) return NextResponse.json(db, { status: 500 });

  const esik = new Date(Date.now() - LABEL_AFTER_HOURS * 3600_000).toISOString();
  // `enriched_at` şartı ZORUNLU: sanayi yakınlığı bilinmeden etiketlemek,
  // baca tespitlerini `fire` yazmak demek (ölçüldü, aşağıya bkz.).
  // Zenginleştirme statik veriyle çalıştığı için gecikmesi yok.
  const bekleyen = await db.select<Signal>(
    `heat_signal?label=is.null&scanned_at=lt.${esik}&enriched_at=not.is.null` +
      `&select=id,lon,lat,scanned_at,fixed_source_days,industrial_km` +
      `&order=scanned_at.asc&limit=${BATCH}`
  );
  if ("error" in bekleyen) return NextResponse.json(bekleyen, { status: 502 });
  if (!bekleyen.rows.length) {
    return NextResponse.json({ ok: true, bekleyen: 0 });
  }

  // FIRMS penceresini BEKLEYEN SİNYALLERİN TARİHİNE göre çek.
  //
  // Canlı besleme yalnız son 5 günü veriyor; geriye doldurulmuş arşiv
  // haftalar öncesine gidiyor. Tarih verilmezse o sinyaller "VIIRS
  // görmedi" sanılıp toptan `unknown` olurdu — yani arşivin tamamı
  // etiketsiz kalırdı.
  //
  // Parti `scanned_at` sırasına göre geldiği için tek bir 5 günlük
  // pencere çoğu zaman yetiyor; yetmezse kalanlar sonraki turda.
  const ilkGun = bekleyen.rows[0].scanned_at.slice(0, 10);
  const pencereSon = Date.parse(`${ilkGun}T00:00:00Z`) + 5 * 86400_000;
  const parti = bekleyen.rows.filter(
    (s) => Date.parse(s.scanned_at) < pencereSon
  );

  let firms: Awaited<ReturnType<typeof loadFiresForDate>>;
  try {
    // Bugüne yakınsa canlı besleme (10 dk cache), değilse tarihli arşiv.
    const gunFarki = (Date.now() - Date.parse(ilkGun)) / 86400_000;
    firms =
      gunFarki < 5
        ? (await loadFires("5")).points
        : await loadFiresForDate(ilkGun);
  } catch {
    return NextResponse.json({ error: "FIRMS alınamadı" }, { status: 503 });
  }
  if (!firms.length) {
    // Yanlış etiket yazmaktansa etiketsiz bırak: sonraki tur tekrar dener.
    return NextResponse.json(
      { error: "FIRMS penceresi boş döndü", gun: ilkGun },
      { status: 503 }
    );
  }

  const guncelle: Record<string, unknown>[] = [];
  let fire = 0,
    notFire = 0,
    unknown = 0,
    belirsizSanayi = 0;

  for (const s of parti) {
    const t = Date.parse(s.scanned_at);
    let enYakinKm: number | null = null;
    let onayT: number | null = null;

    for (const f of firms) {
      if (Math.abs(f.dt - t) > CONFIRM_HOURS * 3600_000) continue;
      const km = havKm(s.lon, s.lat, f.lon, f.lat);
      if (km <= CONFIRM_KM && (enYakinKm === null || km < enYakinKm)) {
        enYakinKm = km;
        onayT = f.dt;
      }
    }

    // ⚠️ SIRA: sabit kaynak, VIIRS doğrulamasını EZER.
    //
    // İlk sürümde tersini yazmıştım ("tesis yanında gerçek yangın
    // çıkabilir") — yanlıştı. Sanayi bacasını kutupsal uydu da görür,
    // her gün. Bu yüzden "VIIRS gördü → yangın" kuralı bacaları `fire`
    // diye etiketler ve modele "baca yangındır" diye öğretir; yani
    // sınıflandırıcıyı tam da ayırt etmesi istenen şeyde kör eder.
    //
    // Sabit kaynak ölçütü zaten güçlü: aynı 0,05° hücrede ≥40 AYRI GÜN
    // sıcak görülmüş (Türkiye'nin ölçülmüş en uzun yangını 16,5 gün).
    // Orada VIIRS'in onaylaması beklenen şeydir, bilgi taşımaz.
    //
    // Bedeli kabul ediyoruz: tesise 4 km'den yakın gerçek bir yangın
    // `not_fire` etiketlenir. Bu az sayıda vaka, alternatifin (elli
    // tesisin sürekli `fire` sayılması) yanında küçük kalıyor.
    let label: string, source: string | null;
    if (s.fixed_source_days !== null && s.fixed_source_days >= 40) {
      label = "not_fire";
      source = "fixed_source";
      notFire++;
    } else if (
      s.industrial_km !== null &&
      s.industrial_km < INDUSTRIAL_AMBIGUOUS_KM
    ) {
      // Tesisin dibi: VIIRS doğrulaması burada yangın kanıtı değil.
      label = "unknown";
      source = null;
      belirsizSanayi++;
    } else if (enYakinKm !== null) {
      label = "fire";
      source = "viirs";
      fire++;
    } else {
      label = "unknown";
      source = null;
      unknown++;
    }

    guncelle.push({
      id: s.id,
      label,
      label_source: source,
      labeled_at: new Date().toISOString(),
      viirs_confirmed_at: onayT ? new Date(onayT).toISOString() : null,
      viirs_km: enYakinKm,
    });
  }

  // Upsert DEĞİL: PostgREST upsert'i INSERT yolu içerdiği için tablonun
  // NOT NULL kolonlarını istiyor ve 400 dönüyordu. Toplu UPDATE için
  // `apply_heat_labels` fonksiyonu var (migration 0002).
  const yaz = await db.rpc<number>("apply_heat_labels", { payload: guncelle });
  if ("error" in yaz) return NextResponse.json(yaz, { status: 502 });

  return NextResponse.json({
    ok: true,
    guncellenen: yaz.result,
    islenen: guncelle.length,
    fire,
    notFire,
    unknown,
    belirsizSanayi,
    firmsNokta: firms.length,
    esik,
  });
}
