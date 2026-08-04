import { NextRequest, NextResponse } from "next/server";
import { loadFires } from "@/lib/fires-server";
import { clusterEvents, statusOf } from "@/lib/cluster";
import { buildCone } from "@/lib/wind";
import { progression } from "@/lib/progression";
import { havKm } from "@/lib/geo";
import { inRegion } from "@/lib/bbox";
import { supabaseAdmin } from "@/lib/ml-db";
import type { FireEvent, WindGrid, WindPoint } from "@/lib/types";
import type { NewsSignal } from "@/lib/news";
import type { TerrainPoint } from "@/app/api/terrain/route";
import type { WindForecastPoint } from "@/app/api/wind/forecast/route";

/**
 * Tahmin günlüğü — çizdiğimiz her koniyi kalıcı hale getirir.
 *
 * ⚠️ NEDEN: Bugüne kadar tek bir canlı tahmin kaydedilmedi. Elimizdeki
 * bütün isabet rakamları (ort. 78° yön hatası) arşivi GERİYE OYNATMAKTAN
 * geliyor ve oynatma iyimser: ERA5 o saatin gerçekleşmiş rüzgârını bilir,
 * canlı koni tahmin rüzgârıyla çizilir. "Sahada tuttu mu" sorusunun cevabı
 * ancak tahmin anında yazılırsa mümkün — sonradan üretilemez.
 *
 * Aynı turda olay ve geçişler de yazılıyor: eğitim seti bu şekilde her
 * sezon kendiliğinden büyür, bir daha 6 sezonluk arşivi elle indirmek
 * gerekmez (o indirme saklanmadığı için ROS kalibrasyonu bugün
 * tekrarlanamıyor).
 *
 * Koni tarifi App.tsx ile BİREBİR aynı olmalı: aynı aday süzgeci, aynı
 * ızgara, aynı yuvarlama anahtarları. Ayrışırsa günlük, kullanıcının
 * gördüğünden başka bir şeyin isabetini ölçer.
 */

export const dynamic = "force-dynamic";

/** App.tsx ile aynı: en fazla 14 aktif olaya koni çizilir. */
const MAX_EVENTS = 14;
/** Open-Meteo kotası: toplu uçlar tek istekte en fazla 19 nokta alıyor. */
const MAX_PTS = 19;
/** cluster.ts ile aynı geçiş penceresi */
const PASS_GAP = 90 * 60_000;

/**
 * Geçiş satırının isteğe bağlı kolonları — hepsi her satırda bulunmalı.
 * (Gerekçe: aşağıdaki toplu yazımda anahtar kümesi tekdüze olmak zorunda.)
 */
const BOS_GECIS: Record<string, null> = Object.fromEntries(
  [
    "wind_kmh", "wind_from_deg", "gust_kmh", "temp_c", "humidity", "vpd_kpa",
    "pressure_hpa", "precip_mm", "ffmc", "dmc", "dc", "isi", "bui", "fwi",
    "weather_source", "next_pass_at", "span_hours", "head_bearing_deg",
    "head_growth_km", "front_bearing_deg", "new_pixels", "centroid_bearing_deg",
    "centroid_km", "labeled_at",
  ].map((k) => [k, null])
);

/**
 * Güneydoğu Anadolu — eğitim setine ALINMAZ.
 *
 * Ölçüldü (bkz. 0003 migration yorumu): 260 olayın 90'ı tarım ateşiydi ve bu
 * bölgede ardışık tarla yakmaları birbirine 3 km'den yakın düşüp tek "yangın"
 * gibi kümeleniyor. O ilerleme yangının yayılması değil, çiftçinin sıradaki
 * tarlası — yön modeline öğretilecek şey değil.
 */
const GUNEYDOGU = new Set([
  "Adıyaman", "Batman", "Diyarbakır", "Gaziantep", "Kilis",
  "Mardin", "Siirt", "Şanlıurfa", "Şırnak",
]);

/**
 * Eğitim setine ALINMAYAN ülkeler — yalnız Ortadoğu.
 *
 * Buradaki "aktif yangın" kütlesi ağırlıkla petrol flare'i ve tarla yakması;
 * haritada kalıyor (kamu bilgisi) ama yön modelinin öğreneceği şey değil.
 * Avrupa komşuları (Yunanistan, Bulgaristan, Arnavutluk, K. Makedonya,
 * Kosova, Sırbistan, Karadağ, Kıbrıs) ve Kafkasya (Gürcistan, Ermenistan,
 * Azerbaycan) İÇERİDE: oralarda anız yakma yaygın değil.
 */
const HARIC_ULKE = new Set(["Irak", "Suriye", "İran"]);

function egitimeUygun(e: FireEvent): boolean {
  return !GUNEYDOGU.has(e.il) && !HARIC_ULKE.has(e.il);
}

/**
 * `/api/wind/point` ve `/api/terrain` kapsama kutusu — ikisi de aynı sınırı uygular.
 *
 * 🔴 Elle yazılan kopyaydı ve bayatlamıştı (`lon >= 24.9`). Uydu kutusu
 * Yunanistan'ı kapsamak için batıya genişletildiğinde güncellenmedi; sonuç
 * olarak Yunanistan yangınları — yukarıdaki yorumun açıkça "içeride" dediği
 * ülke — eğitim setine hiç yazılmadı. Artık `lib/bbox` tek kaynak.
 */
const kapsamda = (e: { lon: number; lat: number }) => inRegion(e.lon, e.lat);

const key2 = (lon: number, lat: number) =>
  `${(Math.round(lon * 20) / 20).toFixed(2)},${(Math.round(lat * 20) / 20).toFixed(2)}`;
const key1 = (lon: number, lat: number) =>
  `${(Math.round(lon * 10) / 10).toFixed(1)},${(Math.round(lat * 10) / 10).toFixed(1)}`;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.ML_INGEST_SECRET;
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  if ("error" in db) return NextResponse.json(db, { status: 500 });

  const { points, meta } = await loadFires("1");
  // Demo veriyle tahmin günlüğü tutmak veri setini zehirler.
  if (meta.demo) {
    return NextResponse.json({ ok: true, skipped: "demo veri", cones: 0 });
  }

  const origin = req.nextUrl.origin;
  const { events, pointEvent } = clusterEvents(points);
  const now = Date.now();
  const uygun = events
    .map((e) => ({ ...e, status: statusOf(e.lastSeen, now) }) as FireEvent)
    .filter((e) => e.status === "active" && !e.fixedSource && egitimeUygun(e));

  // ── Haber doğrulaması ──
  // Kayda yalnız habere düşmüş yangınlar giriyor: uydunun "sıcak" dediği her
  // nokta bitki örtüsü yangını değil ve model çöp sinyalle eğitilmemeli.
  //
  // ⚠️ BEDELİ ÖLÇÜLMÜŞ: ilk haber olaydan ~91 dakika sonra çıkıyor (Bayramiç).
  // Yani bir yangının İLK 1,5 saatlik konileri kaydedilmez. Erken-alarm
  // çalışması için kayıp, temiz eğitim seti için kazanç — ikincisi tercih
  // edildi. Yunanistan'da haber kaynağımız yok (RSS sorguları TR yer
  // adlarına dayalı), oradaki yangınlar haber şartı ARANMADAN geçer.
  const haber = await getJson<{ signals: NewsSignal[] }>(`${origin}/api/news`);
  const sinyaller = haber?.signals ?? [];
  const haberliMi = (e: FireEvent) =>
    // Yurt dışında haber kaynağımız yok (RSS sorguları TR yer adlarına dayalı),
    // orada haber şartı aramak Avrupa'yı tümden dışarıda bırakırdı.
    e.abroad ||
    sinyaller.some((s) => havKm(e.lon, e.lat, s.lon, s.lat) <= s.radiusKm);

  const aktif = uygun
    .filter(haberliMi)
    .sort((a, b) => b.frpLast - a.frpLast)
    .slice(0, MAX_EVENTS);

  if (!aktif.length) {
    return NextResponse.json({
      ok: true,
      events: 0,
      cones: 0,
      note: uygun.length
        ? `${uygun.length} uygun yangın var ama hiçbiri habere düşmemiş`
        : "eğitime uygun aktif yangın yok",
      newsSignals: sinyaller.length,
    });
  }

  const tPts = [...new Set(aktif.map((e) => key2(e.lon, e.lat)))].sort().slice(0, MAX_PTS);
  // Nokta meteorolojisi yalnız kapsanan kutu için istenir: dışarısı 400 dönüyor
  // (uç, rastgele koordinatla Open-Meteo kotasının tüketilmesini engelliyor) ve
  // boşuna istek atmak limite yaklaştırır. Yunanistan/Balkan yangınları koni
  // alır ama hava özelliği alamaz — bilinen ve kabul edilmiş boşluk.
  const fPts = [...new Set(aktif.filter(kapsamda).map((e) => key1(e.lon, e.lat)))]
    .sort()
    .slice(0, MAX_PTS);

  const [grid, terrain, forecast] = await Promise.all([
    getJson<WindGrid>(`${origin}/api/wind/grid`),
    getJson<{ points: TerrainPoint[] }>(`${origin}/api/terrain?pts=${tPts.join("|")}`),
    getJson<{ points: WindForecastPoint[] }>(
      `${origin}/api/wind/forecast?pts=${fPts.join("|")}`
    ),
  ]);
  if (!grid) {
    return NextResponse.json({ error: "rüzgâr ızgarası alınamadı" }, { status: 503 });
  }

  const terr = new Map(
    (terrain?.points ?? []).map((p) => [`${p.lon.toFixed(2)},${p.lat.toFixed(2)}`, p])
  );
  const fc = new Map(
    (forecast?.points ?? []).map((p) => [`${p.lon.toFixed(1)},${p.lat.toFixed(1)}`, p])
  );

  // Nokta meteorolojisi (sıcaklık/nem/basınç/FWI) — koninin girdisi değil ama
  // modelin özelliği. Olay başına bir istek; 0,1°'ye yuvarlandığı için
  // komşu yangınlar aynı cache'i paylaşır.
  //
  // ⚠️ SIRAYLA, PARALEL DEĞİL. İlk sürüm 14 isteği `Promise.all` ile aynı anda
  // attı: her biri upstream'de 3 çağrı (hava + hava kalitesi + yükselti) demek,
  // yani tek seferde ~42 istek. Open-Meteo dakikalık limiti kesti ve 14 noktanın
  // HEPSİ 503 döndü — koniler yazıldı ama basınç/sıcaklık/nem/FWI kolonları
  // baştan sona null kaldı. Aynı URL saniyeler sonra tek başına 200 veriyor.
  // Cron her turda sessizce özelliksiz satır üretecekti.
  const hava = new Map<string, WindPoint>();
  for (const k of fPts) {
    const [lon, lat] = k.split(",");
    const url = `${origin}/api/wind/point?lon=${lon}&lat=${lat}`;
    // Sıraya alınca ilk beş nokta geçti, kalanı yine 503 aldı: ızgara tek
    // başına 1000 lokasyon harcadığı için saatlik kota gün sonunda dar.
    // Tek deneme yetmiyor; bir kez daha bekleyip deniyoruz. Yine olmazsa
    // özellik null kalır — cron 10 dakikada bir koştuğu için sonraki tur
    // aynı olayı yakalar. Uydurma değer yazmaktansa boş bırakmak doğru.
    let w = await getJson<WindPoint>(url);
    if (!w) {
      await new Promise((r) => setTimeout(r, 2500));
      w = await getJson<WindPoint>(url);
    }
    if (w) hava.set(k, w);
    else console.warn("nokta havası alınamadı (kota?)", k);
    await new Promise((r) => setTimeout(r, 400));
  }

  const issuedAt = new Date().toISOString();
  const koniler: Record<string, unknown>[] = [];
  let olayYazildi = 0;
  let gecisYazildi = 0;
  let yazmaHatasi = 0;

  for (const ev of aktif) {
    const kT = key2(ev.lon, ev.lat);
    const kF = key1(ev.lon, ev.lat);
    const t = terr.get(kT) ?? null;
    const w = hava.get(kF);

    // ── Olay + geçişler (etiketli) ──
    const olay = {
      event_key: ev.id,
      origin: "live",
      place: ev.place,
      il: ev.il,
      abroad: ev.abroad,
      lon: ev.lon,
      lat: ev.lat,
      first_seen: new Date(ev.firstSeen).toISOString(),
      last_seen: new Date(ev.lastSeen).toISOString(),
      detections: ev.count,
      frp_max: ev.frpMax,
      elev_m: w?.terrain?.elevM ?? null,
      slope_pct: t?.slopePct ?? w?.terrain?.slopePct ?? null,
      upslope_deg: t?.upslopeDeg ?? w?.terrain?.upslopeDeg ?? null,
      fuel: t?.fuel ?? null,
      fixed_source_days: ev.fixedSource?.days ?? null,
      updated_at: issuedAt,
    };

    const yazilan = await db.upsert<{ id: number }>(
      "fire_event?on_conflict=event_key",
      [olay],
      "merge-duplicates",
      "representation"
    );
    if ("error" in yazilan) {
      console.error("fire_event yazılamadı", ev.id, yazilan);
      yazmaHatasi++;
      continue;
    }
    const eventId = yazilan.rows[0]?.id;
    olayYazildi++;

    // Olayın noktaları: kümelemenin kendi nokta→olay eşlemesinden. Mesafeyle
    // yeniden eşlemek, komşu iki yangının pikselini karıştırma riski demek.
    const evPoints = points.filter((p) => pointEvent[p.id] === ev.id);
    const passPts = ev.passes.map((p) =>
      evPoints
        .filter((q) => Math.abs(q.dt - p.t) <= PASS_GAP)
        .map((q) => ({ lon: q.lon, lat: q.lat }))
    );

    const gecisler = ev.passes.map((p, i) => {
      // ⚠️ Tüm satırlar AYNI anahtar kümesiyle gitmeli: PostgREST toplu
      // insert'te ilk nesnenin anahtarlarına göre kolon listesi çıkarıyor ve
      // farklı anahtarlı ikinci nesneye "All object keys must match" diye 400
      // dönüyor. Hava yalnız son geçişe, etiket yalnız ardılı olan geçişe
      // yazıldığı için satırlar doğal olarak heterojen — boşları null'la.
      const satir: Record<string, unknown> = {
        ...BOS_GECIS,
        event_id: eventId,
        pass_no: i,
        t: new Date(p.t).toISOString(),
        t0: new Date(p.t0).toISOString(),
        lon: p.lon,
        lat: p.lat,
        frp: p.frp,
        pixel_count: p.count,
      };
      // Hava yalnız SON geçişe yazılır: /api/wind/point şu anki havayı
      // veriyor, geçmiş geçişlere iliştirmek zaman kaydırmalı bir özellik
      // olur ve model saatler önceki yangını bugünün rüzgârıyla öğrenir.
      if (i === ev.passes.length - 1 && w) {
        Object.assign(satir, {
          wind_kmh: w.windKmh,
          wind_from_deg: w.windDirDeg,
          gust_kmh: w.gustKmh,
          temp_c: w.tempC,
          humidity: w.rh,
          vpd_kpa: w.vpdKpa,
          pressure_hpa: w.pressureHpa,
          ffmc: w.fwi?.ffmc ?? null,
          dmc: w.fwi?.dmc ?? null,
          dc: w.fwi?.dc ?? null,
          isi: w.fwi?.isi ?? null,
          bui: w.fwi?.bui ?? null,
          fwi: w.fwi?.fwi ?? null,
          weather_source: "live",
        });
      }
      const sonraki = ev.passes[i + 1];
      if (sonraki) {
        const saat = (sonraki.t - p.t) / 3600_000;
        const il = progression(passPts[i], passPts[i + 1]);
        if (saat <= 18 && il.newPixels > 0) {
          Object.assign(satir, {
            next_pass_at: new Date(sonraki.t).toISOString(),
            span_hours: Math.round(saat * 100) / 100,
            head_bearing_deg: il.headBearingDeg,
            head_growth_km: il.headGrowthKm,
            front_bearing_deg: il.frontBearingDeg,
            new_pixels: il.newPixels,
            centroid_bearing_deg: il.centroidBearingDeg,
            centroid_km: il.centroidKm,
            labeled_at: issuedAt,
          });
        }
      }
      return satir;
    });

    const gecisYaz = await db.upsert(
      "fire_pass?on_conflict=event_id,pass_no",
      gecisler,
      "merge-duplicates"
    );
    if (!("error" in gecisYaz)) gecisYazildi += gecisler.length;

    // Ham piksel — etiket tanımı değişirse geometri yeniden türetilebilsin
    const ham = ev.passes.flatMap((p, i) =>
      evPoints
        .filter((q) => Math.abs(q.dt - p.t) <= PASS_GAP)
        .map((q) => ({
          event_id: eventId,
          pass_no: i,
          dt: new Date(q.dt).toISOString(),
          lon: q.lon,
          lat: q.lat,
          frp: q.frp,
          sat: q.sat,
          dn: q.dn,
        }))
    );
    if (ham.length) {
      await db.upsert(
        "fire_detection?on_conflict=event_id,dt,lon,lat",
        ham,
        "ignore-duplicates"
      );
    }

    // ── Tahmin ──
    const cone = buildCone(ev, grid, t, fc.get(kF) ?? null);
    if (!cone) continue; // durgun rüzgâr / ızgara dışı: koni çizilmiyor

    const halka = (h: number) => {
      const r = cone.rings.find((x) => x.hours === h);
      if (!r) return null;
      // Halkanın baş yarıçapı: merkez hattının ucuna olan mesafe yerine
      // şeklin baş yönündeki ilk noktası (reachShape offset=0 ile başlar).
      const [lon0, lat0] = cone.apex;
      const [lon1, lat1] = r.ring[0];
      return Math.round(havKm(lon0, lat0, lon1, lat1) * 100) / 100;
    };

    koniler.push({
      event_key: ev.id,
      event_id: eventId,
      issued_at: issuedAt,
      apex_lon: cone.apex[0],
      apex_lat: cone.apex[1],
      spread_deg: cone.spreadDeg,
      wind_only_deg: cone.windOnlyDeg,
      wind_kmh: cone.windKmh,
      half_angle_deg: cone.halfAngle,
      slope_share: cone.slopeShare,
      is_disc: cone.isDisc,
      ring_1h_km: halka(1),
      ring_3h_km: halka(3),
      ring_6h_km: halka(6),
      temp_c: w?.tempC ?? null,
      humidity: w?.rh ?? null,
      vpd_kpa: w?.vpdKpa ?? null,
      pressure_hpa: w?.pressureHpa ?? null,
      gust_kmh: w?.gustKmh ?? null,
      fwi: w?.fwi?.fwi ?? null,
      slope_pct: t?.slopePct ?? null,
      upslope_deg: t?.upslopeDeg ?? null,
      fuel: t?.fuel ?? null,
    });
  }

  if (koniler.length) {
    const yaz = await db.upsert(
      "cone_forecast?on_conflict=event_key,issued_at",
      koniler,
      "ignore-duplicates"
    );
    if ("error" in yaz) return NextResponse.json(yaz, { status: 502 });
  }

  // Aktif yangın vardı ama hiçbiri yazılamadıysa bu "bugün yangın yok" ile
  // aynı görünmemeli: cron 200 alırsa sessizce kör kalırız. Tablolar henüz
  // kurulmamışken tam olarak bu oluyordu.
  if (olayYazildi === 0 && yazmaHatasi > 0) {
    return NextResponse.json(
      { error: "hiçbir olay yazılamadı", events: aktif.length, failed: yazmaHatasi },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    issuedAt,
    eligible: uygun.length,
    newsConfirmed: aktif.length,
    eventsWritten: olayYazildi,
    passes: gecisYazildi,
    cones: koniler.length,
  });
}

