import ArchiveViewer from "@/components/ArchiveViewer";
import { archiveText, isMtgOnly, type ArchiveIndexItem } from "@/lib/archive";
import { fmtNum } from "@/lib/format";
import { fill, type Locale } from "@/lib/i18n";
import { getDict } from "@/i18n";

/**
 * Tek arşiv kaydının sayfası — iki dil de bunu kullanır.
 *
 * Harita tarayıcıda çiziliyor; arama motorunun göreceği içerik burada
 * sunucudan geliyor.
 */
export default function ArchiveFireView({
  k,
  locale,
}: {
  k: ArchiveIndexItem;
  locale: Locale;
}) {
  const t = getDict(locale);
  const { ad, ozet } = archiveText(k, locale);
  const gun = fmtNum((k.son - k.ilk) / 86400_000, 1, locale);

  return (
    <>
      <section className="sr-only">
        <h1>{fill(t.archive.srH1, { ad })}</h1>
        <p>{ozet}</p>
        <p>
          {fill(isMtgOnly(k.sats) ? t.archive.srBodyMtg : t.archive.srBody, {
            il: k.il,
            n: k.tespit,
            days: gun,
            mw: k.maxFrp,
          })}
        </p>
      </section>
      <ArchiveViewer
        slug={k.slug}
        locale={locale}
        dict={t}
        ad={ad}
        ozet={ozet}
        il={k.il}
      />
    </>
  );
}
