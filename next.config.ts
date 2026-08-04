import type { NextConfig } from "next";

/**
 * Güvenlik başlıkları. Kamu yararına bir yangın haritası için en somut risk
 * çerçeveleme (clickjacking): sahte bir sayfa gerçek haritayı gömüp yanında
 * uydurma tahliye bilgisi verebilir. frame-ancestors + X-Frame-Options bunu
 * kapatır. CSP'de blob: worker MapLibre için, inline style Tailwind/MapLibre
 * için gerekli.
 */
/**
 * ⚠️ `script-src 'unsafe-inline'` BİLEREK duruyor — nonce'a geçilmedi.
 *
 * Next 16 nonce'ı yalnız **dinamik render**'da uygulayabiliyor
 * (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`:
 * *"When you use nonces in your CSP, all pages must be dynamically rendered…
 * Static optimization and ISR are disabled… Pages cannot be cached by CDNs"*).
 * Bu projede 81 il sayfası + arşiv SSG ve platformun bütün iddiası zayıf
 * bağlantıda hız (ilk boyama 296 ms, ikinci ziyaret 0 KB). Nonce uğruna
 * statik üretimi kapatmak, sahadaki ekibin sayfayı geç açması demek —
 * XSS yüzeyi burada kullanıcı girdisi almayan bir haritada zaten dar.
 *
 * Alternatif (denenmedi): `experimental.sri` ile hash tabanlı CSP statik
 * üretimi koruyor ama Next'in kendi dokümanında "experimental".
 *
 * Şimdilik yapılan: ihlaller artık raporlanıyor (`report-uri`), yani yeni
 * katman eklerken kırılma erken görülüyor.
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
  // Göreli yol bilerek: `Report-To` mutlak URL istiyor ve lokal/önizleme
  // dağıtımlarında yanlış hedefe yazardı. `report-uri` eski ama Chrome ve
  // Firefox'ta çalışıyor, bize lazım olan da tam bu.
  "report-uri /api/csp-report",
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
  // Sunucu yazılımını duyurmanın kimseye faydası yok, saldırgana var.
  poweredByHeader: false,
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
        // İngilizce gömme görünümü de çerçevelenebilir olmalı
        source: "/en/embed",
        headers: [
          { key: "Content-Security-Policy", value: CSP_EMBED },
          ...ORTAK,
        ],
      },
      {
        // Gömme görünümleri dışındaki her yol — kurallar çakışmasın diye ayrık
        source: "/((?!embed$|en/embed$).*)",
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
