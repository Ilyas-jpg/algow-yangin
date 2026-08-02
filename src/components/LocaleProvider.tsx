"use client";

import { createContext, useContext } from "react";
import type { Dict } from "@/i18n/tr";
import type { Locale } from "@/lib/i18n";

/**
 * Açık dilin sözlüğünü istemci ağacına taşır.
 *
 * Sözlük sunucu bileşeninden prop olarak geliyor (düz veri, fonksiyon yok) —
 * bu yüzden tarayıcıya yalnız tek dilin metni iniyor. Prop olarak elden ele
 * geçirmek yerine bağlam kullanılıyor: harita uygulamasında metin gereken
 * bileşenler beş kat derinde.
 */
type Ctx = { locale: Locale; t: Dict };

const LocaleCtx = createContext<Ctx | null>(null);

export function LocaleProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dict;
  children: React.ReactNode;
}) {
  return (
    <LocaleCtx.Provider value={{ locale, t: dict }}>
      {children}
    </LocaleCtx.Provider>
  );
}

function useCtx(): Ctx {
  const v = useContext(LocaleCtx);
  if (!v) throw new Error("LocaleProvider eksik");
  return v;
}

/** Açık dilin sözlüğü. */
export const useT = (): Dict => useCtx().t;

/** Açık dil kodu — sayı/tarih biçimlendirme ve bağlantı üretimi için. */
export const useLocale = (): Locale => useCtx().locale;
