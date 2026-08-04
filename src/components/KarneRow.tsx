"use client";

import useSWR from "swr";
import type { Karne } from "@/lib/karne";
import { fmtNum } from "@/lib/format";
import { getDict } from "@/i18n";
import type { Locale } from "@/lib/i18n";
import Rich from "./Rich";

/**
 * CANLI KARNE SATIRI — bu sezon çizdiğimiz konilerin tuttu/tutmadı özeti.
 *
 * Neden istemci tarafında: `/istatistik` statik üretiliyor (SSG) ve bu proje
 * onu bilinçli koruyor — sayfanın tamamı 81 il sayfasıyla aynı hattan geliyor
 * ve iddiası zayıf bağlantıda hız. Karne satırını sunucuda okumak sayfayı
 * dinamikleştirirdi. Bedeli: satır arama motoru HTML'inde görünmez.
 *
 * Veri yoksa (henüz doğrulanmış tahmin birikmemiş, ya da DB kurulmamış)
 * BOŞ DÖNER — "0°" ya da "%0" yazmaz. Sıfır, kusursuz tahmin gibi okunur.
 */
const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function KarneRow({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const { data } = useSWR<Karne & { hazir: boolean; dogrulanan: number }>(
    "/api/ml/karne",
    fetcher,
    { revalidateOnFocus: false }
  );

  if (!data?.hazir || data.ortancaHataDeg === null) return null;

  const kutu = (etiket: string, deger: string, alt: string) => (
    <div className="rounded-md border border-line bg-obsidian-2/40 px-4 py-3">
      <p className="font-mono text-[10px] text-ink-3">{etiket}</p>
      <p className="mt-0.5 font-mono text-[22px]">{deger}</p>
      <p className="text-[11px] text-ink-3">{alt}</p>
    </div>
  );

  return (
    <section className="mt-10">
      <h2 className="text-[18px] font-medium">{t.stats.h2Karne}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
        <Rich segs={t.stats.karneIntro} />
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {kutu(
          t.stats.karneMedian,
          `${fmtNum(data.ortancaHataDeg, 0, locale)}°`,
          t.stats.karneMedianNote
        )}
        {kutu(
          t.stats.karneHit,
          data.isabet45 === null ? "—" : `%${fmtNum(data.isabet45, 0, locale)}`,
          t.stats.karneHitNote
        )}
        {kutu(
          t.stats.karneCover,
          data.kapsama === null ? "—" : `%${fmtNum(data.kapsama, 0, locale)}`,
          t.stats.karneCoverNote
        )}
      </div>

      <p className="mt-3 font-mono text-[11px] text-ink-3">
        {t.stats.karneCount
          .replace("{n}", fmtNum(data.olculen, 0, locale))
          .replace("{yok}", fmtNum(data.gozlemYok, 0, locale))
          .replace("{ilerlemedi}", fmtNum(data.ilerlemedi, 0, locale))
          .replace("{ters}", data.tersOran === null ? "—" : fmtNum(data.tersOran, 0, locale))}
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
        <Rich segs={t.stats.karneRuler} />
      </p>
    </section>
  );
}
