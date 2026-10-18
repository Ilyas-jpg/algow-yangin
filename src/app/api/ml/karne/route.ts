import { NextResponse } from "next/server";
import { karneOf, sezonBasi, type KarneRow } from "@/lib/karne";
import { supabaseAdmin } from "@/lib/ml-db";
import { ML_DURDURULDU, ML_DURMA_TARIHI } from "@/lib/ml-salter";

/**
 * CANLI KARNE — sezon boyunca çizdiğimiz konilerin tuttu/tutmadı özeti.
 *
 * Bu uç nokta AÇIK (gizli anahtar istemiyor): yayınladığımız doğruluk
 * iddiasının denetlenebilir hâli. Yalnız TOPLAMLAR dönüyor, satır dönmüyor —
 * `service_role` ile okunuyor ve ham tahmin kayıtları dışa açılmıyor.
 *
 * ⚠️ Sayılar `/hakkinda`'daki arşiv ölçümüyle AYNI CETVELDEN DEĞİL; hangi
 * cetvel olduğu `lib/karne.ts`'in başında yazılı ve arayüzde de yazıyor.
 *
 * DB yoksa (env kurulmamış) hata değil `{ hazir: false }` dönüyor: karne
 * satırı arayüzde sessizce görünmez olur, sayfa çalışmaya devam eder.
 *
 * 🐛 2026-10-18: karne 49.343 doğrulanmış tahminin yalnız 1.000'inden
 * hesaplanıyordu — `limit=20000` Supabase'in 1000 satırlık tavanına sessizce
 * takılıyordu (bkz. `lib/ml-db` SAYFA). Yayındaki kapsama %85'ti, tüm satırlarla
 * %37,5. Artık `selectAll` ile sezonun tamamı okunuyor (~50 sayfa).
 *
 * Saatlik tazeleme: boru hattı durduğundan beri veri donuk; açıldığında da
 * karne için saat yeterli. 15 dakikada bir ~50 sayfa okumak Hobby'nin hesap
 * geneli CPU bütçesinden boşuna yer.
 */
export const revalidate = 3600;

/** Sezon başına güvenlik tavanı — 2026 sezonu 49.343 satırda kaldı. */
const MAX_SATIR = 200_000;

export async function GET() {
  const db = supabaseAdmin();
  if ("error" in db) return NextResponse.json({ hazir: false, sebep: "db-yok" });

  const bas = sezonBasi();
  const r = await db.selectAll<KarneRow>(
    "cone_forecast?select=error_deg,head_inside_shape,new_pixels,new_pixels_inside" +
      `&verified_at=not.is.null&issued_at=gte.${bas}&order=id.asc`,
    MAX_SATIR
  );
  if ("error" in r) return NextResponse.json({ hazir: false, sebep: "sorgu" });

  const karne = karneOf(r.rows);
  return NextResponse.json(
    {
      hazir: karne.olculen > 0,
      sezonBasi: bas,
      dogrulanan: r.rows.length,
      // Kayıt durmuşsa karne o güne kadarki konileri anlatıyor; arayüz bunu
      // "canlı" diye sunmasın.
      donduruldu: ML_DURDURULDU ? ML_DURMA_TARIHI : null,
      ...karne,
    },
    { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}
