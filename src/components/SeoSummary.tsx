import { getDict } from "@/i18n";
import { fill, path, type Locale } from "@/lib/i18n";
import { fmtNum } from "@/lib/format";

/**
 * Kök sayfanın sunucuda render edilen özeti.
 *
 * Neden var: harita tamamen tarayıcı tarafı (WebGL, canvas, `Date.now`) ve
 * `next/dynamic` ssr:false ile yükleniyor — bu da kökün TAMAMINI client'a
 * düşürüyordu (`BAILOUT_TO_CLIENT_SIDE_RENDERING`). JS çalıştırmayan ziyaretçi
 * bomboş bir belge alıyordu: arama motoru için sayfanın konusu yok, sohbet
 * uygulaması önizlemesi boş, JS'i kapalı kullanıcı için acil numarası bile yok.
 *
 * Bu blok sunucudan geliyor ve **gizlenmiyor** (`display:none` arama motorunda
 * düşük ağırlık alır). Harita mount olunca üstünü kaplıyor, DOM'da kalmaya
 * devam ediyor; JS yoksa sayfanın kendisi bu özet oluyor.
 */

/** Landing ayrı bir mülkte (algow.net, PHP) — bu yüzden mutlak adres. */
const LANDING: Record<Locale, string> = {
  tr: "https://algow.net/yangin",
  en: "https://algow.net/en/wildfire-map",
};

export interface SeoSummaryProps {
  locale: Locale;
  /** En yeni tespitin zamanı; veri alınamadıysa null. */
  newest: number | null;
  /** Yurt içi aktif olay sayısı; hesaplanamadıysa null. */
  active: number | null;
  now: number;
}

export default function SeoSummary({
  locale,
  newest,
  active,
  now,
}: SeoSummaryProps) {
  const t = getDict(locale);

  const saat = newest === null ? null : (now - newest) / 3600_000;
  const tazelik =
    saat === null
      ? t.seo.lastSeenUnknown
      : saat < 1
        ? t.seo.lastSeenFresh
        : fill(t.seo.lastSeen, { n: fmtNum(saat, 0, locale) });

  return (
    <section className="seo-ozet" aria-label={t.seo.h1}>
      <div className="seo-ozet__ic">
        <h1>{t.seo.h1}</h1>
        <p>{t.seo.lead}</p>
        <p>
          {tazelik}
          {active !== null ? ` ${fill(t.seo.active, { n: active })}` : ""}
        </p>
        {/* Acil numaraları JS'siz de görünmek zorunda: bu sayfaya yangın
            sırasında, kötü bağlantıda giriliyor. */}
        <p className="seo-ozet__acil">{t.seo.emergency}</p>
        <p>
          <a href={LANDING[locale]}>{t.seo.landing}</a>
        </p>
        <p>
          <a href={path("about", locale)}>{t.common.about}</a>
          {" · "}
          <a href={path("stats", locale)}>{t.common.stats}</a>
          {" · "}
          <a href={path("archive", locale)}>{t.common.archive}</a>
        </p>
        <p className="seo-ozet__not">{t.seo.mapNote}</p>
      </div>
    </section>
  );
}
