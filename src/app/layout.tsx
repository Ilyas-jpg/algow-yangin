import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";
import { Analytics } from "@vercel/analytics/next";

// Zayıf bağlantıda her KB önemli: tek aile, yalnız kullanılan ağırlıklar.
// Veri okumalarının mono'su sistem yazı tipinden gelir (0 KB).
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Algow Yangın — Türkiye canlı yangın haritası ve yön tahmini",
  description:
    "NASA FIRMS uydu tespitleri ve Open-Meteo rüzgar verisiyle Türkiye'deki orman yangınlarını harita üzerinde izleyin; geçmiş ilerleyişi ve rüzgara göre tahmini yönelimi görün. Uydu ısı anomalisi tespit eder, her nokta yangın olmayabilir. Toplum ve doğa yararına, ücretsiz.",
  metadataBase: new URL("https://yangin.algow.net"),
  openGraph: {
    title: "Algow Yangın — Türkiye canlı yangın haritası",
    description:
      "Uydu tespitleri, rüzgar akışı ve yön tahmini tek haritada. NASA FIRMS + Open-Meteo açık verisiyle.",
    locale: "tr_TR",
    type: "website",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Algow Yangın", statusBarStyle: "black-translucent" },
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
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
