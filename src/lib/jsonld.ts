import { getDict } from "@/i18n";
import { HTML_LANG, path, type Locale } from "./i18n";
import { ilStats } from "./il-stats";

/**
 * Yapılandırılmış veri.
 *
 * Amaç arama motoruna sayfanın NE olduğunu söylemek: kök bir uygulama,
 * `/istatistik` bir veri kümesi, arşiv kayıtları belgelenmiş birer olay.
 * Değerler sayfadaki metinlerle aynı sözlükten geliyor — yapılandırılmış
 * verinin görünen içerikten farklı şey söylemesi hem yanlış hem cezalı.
 */

const SITE = "https://yangin.algow.net";
const LISANS = "https://www.gnu.org/licenses/agpl-3.0.html";

const mutlak = (p: string) => (p === "/" ? `${SITE}/` : `${SITE}${p}`);

const ALGOW = {
  "@type": "Organization",
  name: "Algow",
  url: "https://algow.net",
} as const;

/** Verinin asıl kaynağı — atıf hem doğru hem NASA'nın şartı. */
const FIRMS = {
  "@type": "Dataset",
  name: "NASA FIRMS — VIIRS / MODIS active fire data",
  url: "https://firms.modaps.eosdis.nasa.gov/",
  creator: { "@type": "Organization", name: "NASA FIRMS" },
} as const;

export function webApplicationLd(locale: Locale) {
  const t = getDict(locale);
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `Algow ${t.common.brand}`,
    url: mutlak(path("home", locale)),
    description: t.meta.homeDescription,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    inLanguage: HTML_LANG[locale],
    isAccessibleForFree: true,
    // Ücretsiz olduğunu fiyat alanıyla söylemek şart: "0" yazmayan
    // uygulamalar arama sonucunda ücretli varsayılıyor.
    offers: { "@type": "Offer", price: 0, priceCurrency: "TRY" },
    license: LISANS,
    publisher: ALGOW,
    isBasedOn: FIRMS,
  };
}

/**
 * Veri kümesinin kapsadığı sezonlar.
 *
 * Sayfadaki tabloyla aynı kaynaktan okunuyor — `temporalCoverage`'ı elle
 * yazmak, sezon eklendiğinde yapılandırılmış verinin sessizce eskimesi olurdu.
 */
export function statsYears(): number[] {
  const yillar = ilStats()?.ulke?.yillar;
  if (!yillar) return [];
  return Object.keys(yillar)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

export function datasetLd(locale: Locale, yillar: number[]) {
  const t = getDict(locale);
  const ilk = yillar.length ? Math.min(...yillar) : undefined;
  const son = yillar.length ? Math.max(...yillar) : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: t.meta.statsTitle,
    description: t.meta.statsDescription,
    url: mutlak(path("stats", locale)),
    inLanguage: HTML_LANG[locale],
    license: LISANS,
    creator: ALGOW,
    isBasedOn: FIRMS,
    ...(ilk && son ? { temporalCoverage: `${ilk}/${son}` } : {}),
    spatialCoverage: { "@type": "Place", name: "Türkiye" },
  };
}

export interface ArchiveLdInput {
  title: string;
  description: string;
  url: string;
  il: string;
  /** Kaydın merkezi — arşiv indeksinde yoksa `geo` hiç yazılmaz. */
  center?: [number, number];
  /** epoch ms */
  ilk: number;
  son: number;
}

export function archiveFireLd(locale: Locale, k: ArchiveLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: k.title,
    description: k.description,
    url: mutlak(k.url),
    inLanguage: HTML_LANG[locale],
    publisher: ALGOW,
    license: LISANS,
    isBasedOn: FIRMS,
    datePublished: new Date(k.ilk).toISOString(),
    dateModified: new Date(k.son).toISOString(),
    about: {
      "@type": "Place",
      name: k.il,
      // Koordinat uydurulmuyor: indekste merkez yoksa alan hiç yazılmıyor.
      ...(k.center
        ? {
            geo: {
              "@type": "GeoCoordinates",
              longitude: k.center[0],
              latitude: k.center[1],
            },
          }
        : {}),
    },
  };
}
