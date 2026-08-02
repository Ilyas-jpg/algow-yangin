"use client";

import dynamic from "next/dynamic";
import type { Dict } from "@/i18n/tr";
import type { Locale } from "@/lib/i18n";
import type { AppProps } from "./App";
import { LocaleProvider } from "./LocaleProvider";
import MapLoading from "./MapLoading";

/**
 * Harita uygulaması tamamen tarayıcı-tarafı (Date.now, canvas, WebGL) —
 * SSR kapalı; kabuk yüklenene dek sade bir yer tutucu gösterilir.
 */
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => <MapLoading className="fixed inset-0" />,
});

/**
 * İl sayfası haritayı o ile odaklamak için `focus` geçirir.
 *
 * Sözlük sunucudan prop olarak iniyor: böylece tarayıcıya yalnız açık olan
 * dilin metinleri gidiyor, iki dil birden paketlenmiyor.
 */
export default function ClientApp({
  locale,
  dict,
  ...props
}: AppProps & { locale: Locale; dict: Dict }) {
  return (
    <LocaleProvider locale={locale} dict={dict}>
      <App {...props} />
    </LocaleProvider>
  );
}
