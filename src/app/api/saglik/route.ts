import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/ml-db";
import { MAX_ILERLEME_KMH, NEW_KM } from "@/lib/progression";

/**
 * SAĞLIK UCU — platformun kendi çıktısını makullük açısından denetler.
 *
 * NEDEN VAR. Bu platformun bugüne kadarki iki ciddi arızası da **sessizdi**:
 *   · FIRMS'in boğulma yanıtı (HTTP 400) "veri yok" sanıldı → korpusta %9
 *     görünmez boşluk. Yalnız biri tek tek denediği için yakalandı.
 *   · Doğrulama, 8 km ötedeki AYRI bir yangını "baş" sayıyordu → karne
 *     kapsamayı %0 gösterdi. Günlerce yanlış sayı üretti; ne çöktü ne hata
 *     verdi (2026-08-05, `progression.maxKm` ile düzeltildi).
 *
 * Ortak desen: **çökmüyor, sessizce yanlış sayı üretiyor.** Durum kodu izleyen
 * bir uptime aracı bunu asla göremez. Bu uç, o sınıfı görünür kılmak için var.
 *
 * Ne denetler:
 *   ① TAZELİK — cron'lar hâlâ yazıyor mu (ölü cron = donmuş harita)
 *   ② MAKULLÜK — doğrulanmış ilerlemeler fizik sınırının içinde mi
 *   ③ ÜST KAYNAK — FIRMS gerçekten satır döndürüyor mu
 *
 * 200 = sağlıklı · 503 = en az bir denetim düştü (izleme aracı uyarsın).
 * Gövde sır taşımaz: sayı ve durum, bağlantı dizesi/anahtar yok.
 */
export const revalidate = 0;

interface Denetim {
  ad: string;
  ok: boolean;
  deger: string;
  not?: string;
}

/** Yangın sezonu dışında tespit gelmemesi normaldir — eşikler mevsime duyarlı. */
function sezonIci(): boolean {
  const ay = new Date().getUTCMonth() + 1; // 1-12
  return ay >= 5 && ay <= 10;
}

export async function GET() {
  const denetimler: Denetim[] = [];
  const db = supabaseAdmin();

  if ("error" in db) {
    denetimler.push({ ad: "veritabani", ok: false, deger: "bağlanılamadı" });
    return NextResponse.json({ ok: false, denetimler }, { status: 503 });
  }

  /* ── ① TAZELİK ── */
  const tazelik = async (tablo: string, alan: string, esikSaat: number) => {
    const r = await db.select<Record<string, string>>(
      `${tablo}?select=${alan}&order=${alan}.desc&limit=1`
    );
    if ("error" in r) return { ad: `${tablo}-tazelik`, ok: false, deger: "sorgu düştü" };
    if (!r.rows.length)
      return { ad: `${tablo}-tazelik`, ok: !sezonIci(), deger: "hiç satır yok" };
    const saat = (Date.now() - Date.parse(r.rows[0][alan])) / 3600_000;
    return {
      ad: `${tablo}-tazelik`,
      // Sezon dışında yazım durabilir; o zaman eşiği uygulamıyoruz.
      ok: !sezonIci() || saat <= esikSaat,
      deger: `${saat.toFixed(1)} sa önce`,
      not: `eşik ${esikSaat} sa`,
    };
  };
  denetimler.push(await tazelik("heat_signal", "scanned_at", 3));
  denetimler.push(await tazelik("cone_forecast", "issued_at", 6));

  /* ── ①b DOĞRULAMA KUYRUĞU — `/api/ml/verify` hâlâ koşuyor mu ──
   *
   * Zamanlama pg_cron'a taşındığında (migration 0005) verify, GitHub'ın
   * bildirim kanalından çıktı: pg_net ateşle-unut çalışır, HTTP durumunu
   * kimse görmez. Cone'un durması `cone_forecast` tazeliğinden anlaşılıyor,
   * verify'ınki anlaşılmıyordu — bu denetim o boşluğu kapatıyor.
   *
   * Neden TAZELİK değil KUYRUK: `verified_at`'in bayatlaması arıza kanıtı
   * değil, çünkü doğrulanacak bir şey olmayabilir (sakin dönem, sezon dışı)
   * ve verify o turda hiçbir satır yazmadan döner. Birikmiş BEKLEYEN satır
   * ise yalnız verify koşmuyorsa oluşur — yanlış alarm üretmeyen sinyal bu.
   *
   * Eşik 24 saat: verify 10 saatten eski konileri alır ve saatte bir koşar,
   * yani bir satır normalde ~11 saatte kapanır. 24 saat, 13'ten fazla
   * kaçırılmış tur demek — GitHub'ın en kötü teslim oranında bile olmaz.
   */
  {
    const esikSaat = 24;
    const kesim = new Date(Date.now() - esikSaat * 3600_000).toISOString();
    // verify yalnız `event_id` dolu satırlara bakıyor; kimliksizler hiç
    // kuyruğa girmez, onları saymak kalıcı yanlış alarm olurdu.
    const bekleyen = await db.select<{ id: number }>(
      "cone_forecast?select=id&verified_at=is.null&event_id=not.is.null" +
        `&issued_at=lt.${kesim}&limit=500`
    );
    denetimler.push(
      "error" in bekleyen
        ? { ad: "dogrulama-kuyrugu", ok: false, deger: "sorgu düştü" }
        : {
            ad: "dogrulama-kuyrugu",
            ok: bekleyen.rows.length === 0,
            deger: `${bekleyen.rows.length}${bekleyen.rows.length === 500 ? "+" : ""} bekleyen`,
            not: `${esikSaat} sa'ten eski`,
          }
    );
  }

  /* ── ② MAKULLÜK — doğrulanmış ilerlemeler fiziğe uyuyor mu ──
   * 2026-08-05 arızası tam buradan kaçmıştı: 0,7 saatte 7,92 km (11,3 km/sa)
   * yazılmıştı ve hiçbir şey itiraz etmemişti. */
  const dogrulanan = await db.select<{ observed_growth_km: number | null; hours_elapsed: number | null }>(
    "cone_forecast?select=observed_growth_km,hours_elapsed" +
      "&observed_growth_km=not.is.null&hours_elapsed=not.is.null&limit=1000"
  );
  if ("error" in dogrulanan) {
    denetimler.push({ ad: "ilerleme-makullugu", ok: false, deger: "sorgu düştü" });
  } else {
    const imkansiz = dogrulanan.rows.filter((r) => {
      const tavan = Math.max(NEW_KM, MAX_ILERLEME_KMH * Math.max(0, r.hours_elapsed!));
      return r.observed_growth_km! > tavan;
    });
    denetimler.push({
      ad: "ilerleme-makullugu",
      ok: imkansiz.length === 0,
      deger: `${imkansiz.length}/${dogrulanan.rows.length} imkânsız`,
      not: `tavan ${MAX_ILERLEME_KMH} km/sa`,
    });
  }

  /* ── ③ ÜST KAYNAK — FIRMS satır döndürüyor mu ──
   * "200 döndü" yetmez; boğulma yanıtı da 200/400 olabiliyor. SATIR sayılır. */
  const anahtar = (process.env.FIRMS_MAP_KEY ?? "").trim();
  if (!anahtar) {
    denetimler.push({ ad: "firms", ok: false, deger: "anahtar yok" });
  } else {
    try {
      /* 🐛 dayRange 1 → 2 (2026-08-07). FIRMS'te `1` "bugün UTC" demek ve
       * Türkiye üzerindeki VIIRS geçişleri UTC gününün ilerisinde olduğu için
       * gece yarısından sonra pencere GERÇEKTEN boş kalıyor. Ölçüldü 01:18
       * UTC'de, aynı kutu: dayRange 1 → **0 satır** · 2 → 368 · 3 → 622 ·
       * 5 → 1.223. Yani denetim her gece ~9 saat boyunca kördü ve bu yüzden
       * satır sayısını hiç şart koşamıyordu — oysa bu ucun var oluş sebebi
       * tam olarak "200 döndü yetmez, SATIR say" idi. */
      const r = await fetch(
        `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${anahtar}/VIIRS_NOAA20_NRT/25,35,45,43/2`,
        { signal: AbortSignal.timeout(20_000), cache: "no-store" }
      );
      const metin = r.ok ? await r.text() : "";
      const baslik = metin.split("\n", 1)[0] ?? "";
      // Başlık ADI VARSAYILMAZ, ölçüldü: `latitude,longitude,bright_ti4,...`
      // (`country_id` ülke-kodlu uçun formatı — ilk yazımda onu varsaymıştım
      //  ve denetim 170 satırlık sağlıklı yanıta yanlış alarm verdi.)
      const basliktaKonum = baslik.includes("latitude") && baslik.includes("longitude");
      const satir = metin.trim() ? metin.trim().split("\n").length - 1 : 0;
      denetimler.push({
        ad: "firms",
        // İki katmanlı: ① başlık gelmeli (boğulma yanıtı CSV başlığı taşımaz)
        // ② sezon İÇİNDE satır da gelmeli. İkinci şart olmadan "FIRMS ayakta
        // ama hiç veri vermiyor" durumu sessizce sağlıklı görünür.
        // Sezon dışında sıfır satır normaldir, orada yalnız başlık aranır.
        ok: r.ok && basliktaKonum && (!sezonIci() || satir > 0),
        deger: r.ok ? `${satir} satır` : `HTTP ${r.status}`,
        not: !basliktaKonum
          ? "CSV başlığı yok (boğulma yanıtı olabilir)"
          : sezonIci() && satir === 0
            ? "sezon içinde 2 günde sıfır tespit — üst kaynak şüpheli"
            : "2 günlük pencere",
      });
    } catch (e) {
      denetimler.push({ ad: "firms", ok: false, deger: String((e as Error).message).slice(0, 60) });
    }
  }

  const ok = denetimler.every((d) => d.ok);
  return NextResponse.json(
    { ok, sezonIci: sezonIci(), zaman: new Date().toISOString(), denetimler },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } }
  );
}
