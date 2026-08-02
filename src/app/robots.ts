import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Gömme görünümü ve uç noktalar dizinde ayrı sayfa olarak görünmesin;
      // asıl sayfaların kopyası sayılırlar.
      disallow: ["/api/", "/embed"],
    },
    sitemap: "https://yangin.algow.net/sitemap.xml",
  };
}
