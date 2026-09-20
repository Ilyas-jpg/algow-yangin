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
 * GERİ AÇMAK: aşağıdaki değeri `false` yap, push et; ardından sağlık denetimini aç:
 *   gh workflow enable ml-cron.yml -R Ilyas-jpg/algow-yangin
 * Kalıcı çözüm için önce CPU'yu düşür (cone sıklığı, verify'ın saatlik 50 bin satırlık okuması)
 * ya da pg_cron takvimini seyrelt — yoksa sınır yeniden dolar.
 */
export const ML_DURDURULDU = true;

export function mlDurduYaniti(): NextResponse {
  return NextResponse.json(
    { ok: true, durduruldu: true, not: "ML boru hattı 2026-09-20'de durduruldu (Vercel Hobby CPU sınırı)." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
