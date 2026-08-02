"use client";

import type { ProvinceOzet } from "./App";
import { fmtNum, fmtShortDate } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { useLocale, useT } from "./LocaleProvider";
import Rich from "./Rich";

/**
 * İl sayfasının sezon özeti.
 *
 * Aynı sayılar sayfanın sunucudan gelen metninde de var — burası onun görünür
 * hâli, gizlenmiş bir SEO metni değil.
 *
 * ⚠️ Gösterilen sayı `yanginTespit`: sabit ısı kaynakları (rafineri, çelik,
 * santral) düşülmüş. Ham sayı yazılsaydı Zonguldak "879 tespit" görünürdü,
 * oysa 872'si tek bir tesis — gerçek yangın tespiti 7.
 */
export default function ProvinceSummary({
  ad,
  ozet,
}: {
  ad: string;
  ozet: ProvinceOzet;
}) {
  const t = useT();
  const locale = useLocale();
  const { yanginTespit, gecmisOrtalama, sabitTespit, enYuksek, yil } = ozet;

  // Küçük sayılarda yüzde anlamsız (1→2 "%100 artış" değildir)
  const kiyasVar = gecmisOrtalama >= 10 && yanginTespit >= 10;
  const fark = kiyasVar
    ? Math.round(((yanginTespit - gecmisOrtalama) / gecmisOrtalama) * 100)
    : null;
  const belirgin = fark !== null && Math.abs(fark) >= 15;

  return (
    <section className="shrink-0 border-b border-line px-3 py-2.5">
      <h2 className="text-[13px] font-medium">
        {fill(t.province.season, { ad, yil })}
      </h2>

      {yanginTespit === 0 ? (
        <p className="mt-1 text-[11px] leading-relaxed text-ink-2">
          {t.province.none}
        </p>
      ) : (
        <>
          <p className="mt-1 font-mono text-[11px] text-ink-2">
            <span className="text-danger">{fmtNum(yanginTespit, 0, locale)}</span>
            {fill(t.province.detections, {
              avg: fmtNum(gecmisOrtalama, 0, locale),
            })}
            {belirgin && (
              <span className={fark > 0 ? " text-warn" : " text-ok"}>
                {fill(t.province.diff, {
                  n: Math.abs(fark),
                  dir: fark > 0 ? t.province.above : t.province.below,
                })}
              </span>
            )}
          </p>
          {enYuksek && (
            <p className="mt-1 text-[11px] leading-relaxed text-ink-2">
              <Rich
                segs={t.province.highest}
                vars={{
                  date: fmtShortDate(enYuksek.tarih, locale),
                  place: enYuksek.yer,
                  mw: fmtNum(enYuksek.frp, 0, locale),
                }}
              />
            </p>
          )}
        </>
      )}

      {sabitTespit > 0 && (
        <p className="mt-1.5 text-[10px] leading-relaxed text-ink-3">
          {fill(t.province.fixedNote, { n: fmtNum(sabitTespit, 0, locale) })}
        </p>
      )}
      <p className="mt-1 text-[10px] leading-relaxed text-ink-3">
        {t.province.countNote}
      </p>
    </section>
  );
}
