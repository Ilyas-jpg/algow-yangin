import { NextResponse } from "next/server";
import { karneOf, sezonBasi, type KarneRow } from "@/lib/karne";
import { supabaseAdmin } from "@/lib/ml-db";

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
 */
export const revalidate = 900;

export async function GET() {
  const db = supabaseAdmin();
  if ("error" in db) return NextResponse.json({ hazir: false, sebep: "db-yok" });

  const bas = sezonBasi();
  const r = await db.select<KarneRow & { issued_at: string }>(
    "cone_forecast?select=error_deg,head_inside_shape,new_pixels,new_pixels_inside" +
      `&verified_at=not.is.null&issued_at=gte.${bas}&limit=20000`
  );
  if ("error" in r) return NextResponse.json({ hazir: false, sebep: "sorgu" });

  const karne = karneOf(r.rows);
  return NextResponse.json(
    { hazir: karne.olculen > 0, sezonBasi: bas, dogrulanan: r.rows.length, ...karne },
    { headers: { "cache-control": "public, s-maxage=900, stale-while-revalidate=3600" } }
  );
}
