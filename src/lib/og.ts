import type { Metadata } from "next";
import { getDict } from "@/i18n";
import { OG_LOCALE, path, type Locale } from "./i18n";

/**
 * Paylaşım kartı çekirdeği.
 *
 * Kart görseli açılış perdesinin (Intro.tsx) tam yüklenmiş hâlidir: aynı zemin,
 * aynı söz, aynı wordmark. Amaç bilinçli — bağlantının önizlemesi, tıklayınca
 * gelen ilk ekranla birebir aynı şeyi gösterince marka mühürleniyor.
 * Üretici: `scratchpad/og-intro-uret.mjs` (yerleşim globals.css'teki
 * `.intro__*` oranlarından türetiliyor).
 *
 * ⚠️ Dosya konvansiyonu (`app/(tr)/opengraph-image.png`) BİLEREK kullanılmadı:
 * Next 16'da dosya tabanlı metadata `generateMetadata`'yı **eziyor**
 * (docs → generate-metadata: "File-based metadata has the higher priority").
 * Koysaydık olay paylaşım kartı (`?ev=` → api/og) ölürdü; o kart sunucuda
 * yeniden kümelenmiş gerçek veriyi taşıyor ve uydurulamaması bilerek kurulmuş.
 */
export const OG_INTRO = "/og/intro.png";

/** Alt metin = kartın üzerinde yazan sözün kendisi. Tek kaynak: sözlük. */
export const ogIntroImage = (locale: Locale) => [
  { url: OG_INTRO, width: 1200, height: 630, alt: getDict(locale).intro.alt },
];

/**
 * Sitenin varsayılan openGraph'ı.
 *
 * Düzen ile kök sayfa aynı nesneyi paylaşmak ZORUNDA: metadata sığ birleşiyor,
 * bir sayfa `openGraph` tanımladığı anda düzeninki bütünüyle düşüyor
 * (Next docs → Merging). `url` bilerek burada yok — düzene konsa alt sayfalar
 * (`/hakkinda`, `/istatistik`, `/arsiv`) onu miras alır ve kendi adresleri
 * yerine anasayfayı işaret ederdi.
 */
export function siteOpenGraph(locale: Locale): Metadata["openGraph"] {
  const t = getDict(locale);
  return {
    title: t.meta.homeOgTitle,
    description: t.meta.homeOgDescription,
    locale: OG_LOCALE[locale],
    type: "website",
    images: ogIntroImage(locale),
  };
}

/** Kökün openGraph'ı: varsayılan + kendi adresi. */
export function homeOpenGraph(locale: Locale): Metadata["openGraph"] {
  return { ...siteOpenGraph(locale), url: path("home", locale) };
}

/**
 * X/Twitter kartı. `summary_large_image` olmadan bağlantı küçük kare ikonla
 * çıkıyordu — kart görselinin tamamı kırpılıyor, söz okunmuyordu.
 */
export function siteTwitter(locale: Locale): Metadata["twitter"] {
  const t = getDict(locale);
  return {
    card: "summary_large_image",
    title: t.meta.homeOgTitle,
    description: t.meta.homeOgDescription,
    images: [OG_INTRO],
  };
}
