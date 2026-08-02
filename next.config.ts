import type { NextConfig } from "next";

/**
 * Güvenlik başlıkları. Kamu yararına bir yangın haritası için en somut risk
 * çerçeveleme (clickjacking): sahte bir sayfa gerçek haritayı gömüp yanında
 * uydurma tahliye bilgisi verebilir. frame-ancestors + X-Frame-Options bunu
 * kapatır. CSP'de blob: worker MapLibre için, inline style Tailwind/MapLibre
 * için gerekli.
 */
const cspParts = (frameAncestors: string) => [
  "default-src 'self'",
  "img-src 'self' data: blob: https://*.cartocdn.com https://tiles.maps.eox.at https://s3.amazonaws.com https://gibs.earthdata.nasa.gov https://maps.effis.emergency.copernicus.eu",
  "connect-src 'self' https://*.cartocdn.com https://tiles.maps.eox.at https://s3.amazonaws.com https://gibs.earthdata.nasa.gov https://maps.effis.emergency.copernicus.eu",
  "worker-src 'self' blob:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "manifest-src 'self'",
  `frame-ancestors ${frameAncestors}`,
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
];

const CSP = cspParts("'none'").join("; ");

/**
 * Gömme görünümü bilerek çerçevelenebilir: haber siteleri haritayı kendi
 * sayfalarına alabilsin diye. Sadece /embed — geri kalan her şeyde
 * frame-ancestors 'none' ve X-Frame-Options: DENY duruyor.
 *
 * X-Frame-Options "herkese izin ver" diyemez, yalnız yasaklayabilir; bu yüzden
 * /embed'de o başlık hiç gönderilmiyor ve iş CSP'ye bırakılıyor.
 */
const CSP_EMBED = cspParts("*").join("; ");

const ORTAK = [
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
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/embed",
        headers: [
          { key: "Content-Security-Policy", value: CSP_EMBED },
          ...ORTAK,
        ],
      },
      {
        // /embed dışındaki her yol — kurallar çakışmasın diye ayrık tutuldu
        source: "/((?!embed$).*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          ...ORTAK,
        ],
      },
    ];
  },
};

export default nextConfig;
