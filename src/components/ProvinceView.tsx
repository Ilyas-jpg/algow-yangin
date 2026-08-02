import Link from "next/link";
import ClientApp from "@/components/ClientApp";
import { PROVINCES, type Province } from "@/lib/provinces";
import { ilStat, ilStats, kiyas, fmtDate, type IlStat } from "@/lib/il-stats";
import { havKm } from "@/lib/geo";
import { dative, locative } from "@/lib/ek";
import { fill, provinceHref, path, type Locale } from "@/lib/i18n";
import { getDict } from "@/i18n";

/** Coğrafi olarak en yakın iller — 81'inin tamamını her sayfaya koymak
 *  sayfaları birbirinin kopyası yapıyordu (ölçüldü: %100 kelime ortaklığı). */
function komsular(p: Province, n = 7): Province[] {
  return PROVINCES.filter((x) => x.slug !== p.slug)
    .map((x) => ({ x, km: havKm(p.lon, p.lat, x.lon, x.lat) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
    .map((r) => r.x);
}

/**
 * Sezon özeti cümlesi — hem metadata hem sayfa metni bunu kullanır.
 *
 * Türkçede il adı bulunma hâline çekilir ("Muğla'da"); İngilizcede edat
 * şablonun içinde ("In Muğla") ve ad hiç değişmez.
 */
export function provinceSummary(
  ad: string,
  s: IlStat | null,
  yil: number,
  locale: Locale
): string {
  if (!s) return "";
  const t = getDict(locale);
  if (s.yanginTespit === 0) {
    return fill(t.province.liNone, { ad: locative(ad, locale) });
  }
  const k = kiyas(s.yanginTespit, s.gecmisOrtalama);
  const kiyasMetni =
    k.yuzde === null
      ? t.province.summaryNear
      : fill(t.province.summaryDiff, {
          n: k.yuzde,
          dir: k.yon === "above" ? t.province.above : t.province.below,
        });
  const enBuyuk = s.enYuksekFrp
    ? fill(t.province.summaryTop, {
        date: fmtDate(s.enYuksekFrp.tarih, locale),
        place: s.enYuksekFrp.yer,
        mw: s.enYuksekFrp.frp,
      })
    : "";
  return fill(t.province.summary, {
    ad: locative(ad, locale),
    yil,
    n: s.yanginTespit,
    kiyas: kiyasMetni,
    enBuyuk,
  });
}

/**
 * İl sayfasının gövdesi — iki dil de bunu kullanır.
 *
 * Harita tarayıcıda çiziliyor; arama motorunun ve ekran okuyucunun göreceği
 * içerik burada sunucudan geliyor. Sayılar panelde de aynen görünüyor —
 * gizlenen bir metin değil, aynı bilginin metin hâli.
 */
export default function ProvinceView({
  p,
  locale,
}: {
  p: Province;
  locale: Locale;
}) {
  const t = getDict(locale);
  const veri = ilStats();
  const s = ilStat(p.ad);
  const yil = veri?.guncelYil ?? new Date().getFullYear();
  const yakin = komsular(p);
  const k = s ? kiyas(s.yanginTespit, s.gecmisOrtalama) : null;
  const yon = k
    ? k.yon === "above"
      ? t.province.above
      : t.province.below
    : "";

  return (
    <>
      <section className="sr-only">
        <h1>{fill(t.province.h1, { ad: p.ad })}</h1>

        {s && (
          <>
            <h2>{fill(t.province.h2Season, { ad: p.ad, yil })}</h2>
            <p>{provinceSummary(p.ad, s, yil, locale)}</p>
            <ul>
              <li>{fill(t.province.liThisSeason, { n: s.yanginTespit })}</li>
              <li>
                {fill(t.province.liPastAvg, { n: s.gecmisOrtalama })}
                {k?.yuzde != null
                  ? fill(t.province.liPastDiff, { n: k.yuzde, dir: yon })
                  : ""}
              </li>
              {s.enYogunGun && (
                <li>
                  {fill(t.province.liBusiest, {
                    date: fmtDate(s.enYogunGun.tarih, locale),
                    n: s.enYogunGun.n,
                  })}
                </li>
              )}
              {s.enYuksekFrp && (
                <li>
                  {fill(t.province.liHighest, {
                    date: fmtDate(s.enYuksekFrp.tarih, locale),
                    place: s.enYuksekFrp.yer,
                    mw: s.enYuksekFrp.frp,
                  })}
                </li>
              )}
              {s.sabitTespit > 0 && (
                <li>{fill(t.province.liFixed, { n: s.sabitTespit })}</li>
              )}
            </ul>
            <h3>{fill(t.province.h3Years, { ad: p.ad })}</h3>
            <ul>
              {Object.entries(s.yillar).map(([y, n]) => (
                <li key={y}>{fill(t.province.liYear, { yil: y, n })}</li>
              ))}
            </ul>
          </>
        )}

        <h2>{t.province.h2Meaning}</h2>
        <p>{t.province.meaning}</p>

        <nav aria-label={t.province.navNearby}>
          <h2>{fill(t.province.h2Nearby, { ad: dative(p.ad, locale) })}</h2>
          <ul>
            {yakin.map((x) => (
              <li key={x.slug}>
                <Link href={provinceHref(x.slug, locale)}>
                  {fill(t.province.linkProvince, { ad: x.ad })}
                </Link>
              </li>
            ))}
            <li>
              <Link href={path("stats", locale)}>{t.province.linkStats}</Link>
            </li>
            <li>
              <Link href={path("archive", locale)}>
                {t.province.linkArchive}
              </Link>
            </li>
          </ul>
        </nav>
      </section>

      <ClientApp
        locale={locale}
        dict={t}
        focus={{
          ad: p.ad,
          lat: p.lat,
          lon: p.lon,
          ozet: s
            ? {
                yanginTespit: s.yanginTespit,
                gecmisOrtalama: s.gecmisOrtalama,
                sabitTespit: s.sabitTespit,
                enYuksek: s.enYuksekFrp,
                yil,
              }
            : null,
        }}
      />
    </>
  );
}
