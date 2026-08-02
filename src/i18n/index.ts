import type { Locale } from "@/lib/i18n";
import { tr } from "./tr";
import { en } from "./en";

export type { Dict } from "./tr";

/**
 * Sunucu tarafı sözlük seçici.
 *
 * ⚠️ İstemci bileşenleri bunu İTHAL ETMEZ — ederse iki dilin metni de
 * pakete girer. İstemci tarafı sözlüğü `LocaleProvider` üzerinden alır;
 * sözlük sunucudan prop olarak iner, yani tarayıcıya yalnız açık olan
 * dilin metinleri gider.
 */
const DICTS = { tr, en } as const;

export const getDict = (locale: Locale) => DICTS[locale];
