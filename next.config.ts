import type { NextConfig } from "next";

/**
 * Güvenlik başlıkları. Kamu yararına bir yangın haritası için en somut risk
 * çerçeveleme (clickjacking): sahte bir sayfa gerçek haritayı gömüp yanında
 * uydurma tahliye bilgisi verebilir. frame-ancestors + X-Frame-Options bunu
 * kapatır. CSP'de blob: worker MapLibre için, inline style Tailwind/MapLibre
 * için gerekli.
 */
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://*.cartocdn.com https://server.arcgisonline.com https://maps.effis.emergency.copernicus.eu",
  "connect-src 'self' https://*.cartocdn.com https://server.arcgisonline.com https://maps.effis.emergency.copernicus.eu",
  "worker-src 'self' blob:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), camera=(), microphone=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
