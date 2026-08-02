import type { MetadataRoute } from "next";
import { PROVINCES } from "@/lib/provinces";

const BASE = "https://yangin.algow.net";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: BASE,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${BASE}/hakkinda`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...PROVINCES.map((p) => ({
      url: `${BASE}/yangin/${p.slug}`,
      lastModified: now,
      // İçerik yangın verisiyle birlikte gün içinde değişiyor
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
