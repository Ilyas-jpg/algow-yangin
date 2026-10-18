"use client";

import dynamic from "next/dynamic";
import { preloadModule } from "react-dom";
import type { Dict } from "@/i18n/tr";
import type { Locale } from "@/lib/i18n";
import { maplibreWorkerUrl } from "@/lib/maplibre-worker";
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
  // Harita worker'ını uygulama ve harita parçalarıyla PARALEL indir (bkz.
  // lib/maplibre-worker). Yalnız tarayıcıda: sunucu paketinde varlık adresi
  // anlamsız. React aynı adresi tek kez ekler.
  if (typeof window !== "undefined") {
    preloadModule(maplibreWorkerUrl(), { as: "worker" });
  }
  return (
    <LocaleProvider locale={locale} dict={dict}>
      <App {...props} />
    </LocaleProvider>
  );
}
