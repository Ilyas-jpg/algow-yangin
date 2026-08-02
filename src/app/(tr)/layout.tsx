import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import ServiceWorker from "@/components/ServiceWorker";
import { Analytics } from "@vercel/analytics/next";
import { getDict } from "@/i18n";
import { HTML_LANG, OG_LOCALE } from "@/lib/i18n";

/**
 * Türkçe kök düzeni.
 *
 * İki ayrı kök düzen var ((tr) ve (en)) çünkü `<html lang>` sunucudan doğru
 * gelmek zorunda: ekran okuyucu telaffuzu ve arama motoru dil sinyali buna
 * bakıyor. Route grubu adresi değiştirmez — Türkçe yollar kökte kalır.
 */
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-inter",
});

const t = getDict("tr");

export const metadata: Metadata = {
  title: t.meta.homeTitle,
  description: t.meta.homeDescription,
  metadataBase: new URL("https://yangin.algow.net"),
  openGraph: {
    title: t.meta.homeOgTitle,
    description: t.meta.homeOgDescription,
    locale: OG_LOCALE.tr,
    type: "website",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: t.meta.appTitle,
    statusBarStyle: "black-translucent",
  },
  /**
   * Google arama sonucunda ikon çıkması için iki şart var ve ikisi de eksikti:
   * ① `/favicon.ico` erişilebilir olmalı (404 veriyordu — artık app/favicon.ico)
   * ② ikon 48px'in katı olmalı; 32/48 sınırdaydı, 96/192 eklendi.
   * Google faviconu uzun süre önbellekliyor, düzelme bir sonraki taramada görünür.
   */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/brand/favicon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/brand/favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/brand/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  // maximumScale KOYMA: az gören kullanıcı küçük metinleri büyütebilmeli
  // (WCAG 1.4.4). Harita kendi jestlerini zaten yönetiyor.
};

export default function TrRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={HTML_LANG.tr}>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <ServiceWorker />
        {/* Trafik ölçümü. Script ve beacon aynı origin (/_vercel/insights/*),
            bu yüzden mevcut sıkı CSP'yi gevşetmeye gerek yok. Çerez kullanmaz,
            kişisel veri toplamaz. */}
        <Analytics />
      </body>
    </html>
  );
}
