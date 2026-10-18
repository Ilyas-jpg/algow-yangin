import { NextResponse } from "next/server";

/**
 * ML boru hattı şalteri — zamanlanmış beş ucun (ingest · enrich · label · verify · cone) tek kapısı.
 *
 * NEDEN KAPALI (2026-09-20): Vercel Hobby'de Fluid Active CPU sınırı ayda 4 saat ve HESAP
 * GENELİDİR. Ölçüm (21 Ağu – 20 Eyl): 3 sa 57 dk / 4 sa dolu; bunun 3 sa 34 dk'sı (%90,3) bu
 * proje — günde istikrarlı 5-6 dk, 8-9 Eylül'de 20 dk. Sınır aşılırsa hesaptaki BÜTÜN
 * projelerin işlevleri durur. İlyas: "durdur".
 *
 * NEDEN BURADA: işleri tetikleyen pg_cron bu projenin Supabase'inde ve o hesabın geçerli bir
 * PAT'i elde yok; zamanlayıcıya dokunulamıyor. pg_cron çağırmaya devam eder, uçlar sırrı
 * doğrulayıp hemen döner — çağrı başına CPU ihmal edilebilir.
 *
 * BEDELİ: kapalıyken uydu dilimleri ve koni günlüğü BİRİKMEZ; kaçan dilimler geri gelmez.
 * Harita, canlı yangınlar ve ekrandaki yön tahmini bu uçlara bağlı DEĞİLDİR, çalışmaya devam eder.
 *
 * GERİ AÇMAK: aşağıdaki değeri `false` yap, push et. Saatlik sağlık denetimi (`ml-cron.yml`)
 * şalter inikken de açık ve yalnız FIRMS'i denetliyor (2026-10-18); şalter kalkınca tazelik,
 * kuyruk ve makullük denetimleri kendiliğinden geri gelir.
 * Kalıcı çözüm için önce CPU'yu düşür (cone sıklığı, verify'ın okuması) ya da pg_cron takvimini
 * seyrelt — yoksa sınır yeniden dolar.
 * ⚠️ verify'ın tespit okuması 2026-10-18'e kadar Supabase'in 1000 satırlık tavanına sessizce
 * takılıyordu (bkz. lib/ml-db SAYFA); düzeltildi ama gerçek okuma artık tavanın gizlediği
 * boyda. Açmadan önce turun CPU payını ölç. O tavan yüzünden 49.343 doğrulamanın 44.132'si
 * "tespit yok" yazıldı — eski kayıtlar yeniden doğrulanmadıkça karne o sayıyı şişik gösterir.
 */
export const ML_DURDURULDU = true;

/** Şalterin indiği gün — karne ve sağlık ucu "ne zamandan beri" diye bunu yazar. */
export const ML_DURMA_TARIHI = "2026-09-20";

export function mlDurduYaniti(): NextResponse {
  return NextResponse.json(
    { ok: true, durduruldu: true, not: "ML boru hattı 2026-09-20'de durduruldu (Vercel Hobby CPU sınırı)." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
