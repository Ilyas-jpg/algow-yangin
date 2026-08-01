import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";

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
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
