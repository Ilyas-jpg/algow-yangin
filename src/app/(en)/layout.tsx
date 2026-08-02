import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import ServiceWorker from "@/components/ServiceWorker";
import { Analytics } from "@vercel/analytics/next";
import { getDict } from "@/i18n";
import { HTML_LANG, OG_LOCALE } from "@/lib/i18n";

/** İngilizce kök düzeni — `<html lang="en">` için ayrı kök (bkz. (tr)/layout). */
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-inter",
});

const t = getDict("en");

export const metadata: Metadata = {
  title: t.meta.homeTitle,
  description: t.meta.homeDescription,
  metadataBase: new URL("https://yangin.algow.net"),
  openGraph: {
    title: t.meta.homeOgTitle,
    description: t.meta.homeOgDescription,
    locale: OG_LOCALE.en,
    type: "website",
  },
  manifest: "/manifest.en.webmanifest",
  appleWebApp: {
    capable: true,
    title: t.meta.appTitle,
    statusBarStyle: "black-translucent",
  },
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
};

export default function EnRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={HTML_LANG.en}>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <ServiceWorker />
        <Analytics />
      </body>
    </html>
  );
}
