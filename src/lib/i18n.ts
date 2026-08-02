/**
 * İki dilli yönlendirme ve sözlük çekirdeği — sıfır bağımlılık.
 *
 * Kütüphane (next-intl vb.) bilerek kullanılmadı: bu proje ağır bir harita
 * uygulaması ve kırsalda zayıf bağlantıyla açılıyor; sözlük sunucudan prop
 * olarak geçtiği için tarayıcıya YALNIZCA açık olan dilin metinleri iniyor.
 *
 * Yol şeması: Türkçe kökte kalır (`/`, `/hakkinda`, `/yangin/mugla`),
 * İngilizce `/en` altına açılır. Mevcut Türkçe adresler paylaşılmış,
 * dizinlenmiş ve basılı raporda geçiyor — hiçbiri değişmiyor.
 *
 * İl ve arşiv slug'ları ÇEVRİLMEZ (`/en/fires/mugla`): slug bir kimliktir,
 * çevrilirse aynı sayfanın iki ayrı adı olur ve paylaşılan bağlantı bozulur.
 */
export const LOCALES = ["tr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "tr";

export const HTML_LANG: Record<Locale, string> = { tr: "tr", en: "en" };
export const OG_LOCALE: Record<Locale, string> = { tr: "tr_TR", en: "en_US" };

/** Sabit sayfaların dile göre yolu. Tek kaynak — gezinme, hreflang ve
 *  dil düğmesi hepsi buradan okur. */
export const ROUTES = {
  home: { tr: "/", en: "/en" },
  about: { tr: "/hakkinda", en: "/en/about" },
  stats: { tr: "/istatistik", en: "/en/statistics" },
  archive: { tr: "/arsiv", en: "/en/archive" },
  embed: { tr: "/embed", en: "/en/embed" },
} as const;

export type RouteKey = keyof typeof ROUTES;

export const path = (key: RouteKey, locale: Locale): string =>
  ROUTES[key][locale];

/** `/yangin/mugla` · `/en/fires/mugla` */
export const provinceHref = (slug: string, locale: Locale): string =>
  locale === "en" ? `/en/fires/${slug}` : `/yangin/${slug}`;

/** `/arsiv/manavgat-2021` · `/en/archive/manavgat-2021` */
export const archiveHref = (slug: string, locale: Locale): string =>
  locale === "en" ? `/en/archive/${slug}` : `/arsiv/${slug}`;

/** Arşiv verisi tek kopya; İngilizce sayfa da aynı JSON'u okur. */
export const archiveDataHref = (slug: string): string => `/arsiv/${slug}.json`;

const DIR_SEGMENT: Record<string, string> = {
  hakkinda: "about",
  istatistik: "statistics",
  arsiv: "archive",
  yangin: "fires",
  embed: "embed",
};

const EN_TO_TR: Record<string, string> = Object.fromEntries(
  Object.entries(DIR_SEGMENT).map(([tr, en]) => [en, tr])
);

/**
 * Açık olan yolun öbür dildeki karşılığı. Dil düğmesi ve hreflang
 * bunu kullanır; sorgu dizesi (paylaşılan `?ev=`) çağıran tarafta eklenir.
 */
export function switchPath(pathname: string, to: Locale): string {
  const parts = pathname.split("/").filter(Boolean);
  const isEn = parts[0] === "en";
  const bare = isEn ? parts.slice(1) : parts;

  if (to === "en") {
    const mapped = bare.map((s, i) => (i === 0 ? (DIR_SEGMENT[s] ?? s) : s));
    return "/" + ["en", ...mapped].join("/");
  }
  const mapped = bare.map((s, i) => (i === 0 ? (EN_TO_TR[s] ?? s) : s));
  return mapped.length ? "/" + mapped.join("/") : "/";
}

/** Metadata `alternates` için iki dilin de mutlak yolu + x-default (TR). */
export function alternates(trPath: string): {
  canonical: string;
  languages: Record<string, string>;
} {
  const en = switchPath(trPath, "en");
  return {
    canonical: trPath,
    languages: { tr: trPath, en, "x-default": trPath },
  };
}

/** Aynı çift, kanoniği İngilizce sayfa için. */
export function alternatesEn(trPath: string): {
  canonical: string;
  languages: Record<string, string>;
} {
  const en = switchPath(trPath, "en");
  return {
    canonical: en,
    languages: { tr: trPath, en, "x-default": trPath },
  };
}

/**
 * Vurgulu cümle parçası: `[metin]` düz, `[metin, "b"]` kalın,
 * `[metin, "m"]` kalın-monospace (sayı/ölçü).
 *
 * Neden dizi: sözlük düz veri olmak zorunda (sunucu→istemci prop) ama
 * cümlelerin ortasındaki vurgular kaybolmamalı. Ayrıca bu biçim JSX'in
 * satır sonundaki boşluğu yeme sorununu kökten çözer — boşluklar metnin
 * kendi içinde durur, `{" "}` gerekmez.
 */
export type Seg = [string] | [string, "b" | "m" | "d"];

/**
 * `{ad}` biçimli yer tutucuları doldurur.
 *
 * Sözlük düz veri olmak zorunda: sunucudan istemciye prop olarak geçiyor ve
 * fonksiyonlar sunucu-istemci sınırından geçemez. Bu yüzden şablon + doldurucu.
 */
export function fill(
  tpl: string,
  vars: Record<string, string | number>
): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k) =>
    k in vars ? String(vars[k]) : m
  );
}
