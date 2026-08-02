import type { MetadataRoute } from "next";
import { PROVINCES } from "@/lib/provinces";
import { archiveIndex } from "@/lib/archive-server";
import { LOCALES, archiveHref, path, provinceHref } from "@/lib/i18n";

const BASE = "https://yangin.algow.net";

/**
 * İki dilli site haritası.
 *
 * Her sayfa iki dilde de listeleniyor ve `alternates.languages` ile
 * birbirine bağlanıyor — arama motoru hangi sürümü kime göstereceğini
 * kendi seçsin. x-default Türkçe: site Türkiye için.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Ana sayfa "/" — çift eğik çizgi olmasın
  const url = (p: string) => BASE + (p === "/" ? "" : p);

  const iki = (
    trPath: string,
    enPath: string,
    changeFrequency: "hourly" | "daily" | "monthly",
    priority: number
  ): MetadataRoute.Sitemap =>
    LOCALES.map((l) => ({
      url: url(l === "tr" ? trPath : enPath),
      lastModified: now,
      changeFrequency,
      priority,
      alternates: {
        languages: {
          tr: url(trPath),
          en: url(enPath),
          "x-default": url(trPath),
        },
      },
    }));

  return [
    ...iki(path("home", "tr"), path("home", "en"), "hourly", 1),
    ...iki(path("stats", "tr"), path("stats", "en"), "daily", 0.8),
    ...iki(path("archive", "tr"), path("archive", "en"), "monthly", 0.6),
    ...iki(path("about", "tr"), path("about", "en"), "monthly", 0.5),
    ...archiveIndex().flatMap((k) =>
      iki(archiveHref(k.slug, "tr"), archiveHref(k.slug, "en"), "monthly", 0.5)
    ),
    ...PROVINCES.flatMap((p) =>
      // İçerik yangın verisiyle birlikte gün içinde değişiyor
      iki(provinceHref(p.slug, "tr"), provinceHref(p.slug, "en"), "daily", 0.8)
    ),
  ];
}
