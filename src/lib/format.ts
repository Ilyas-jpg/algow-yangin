import type { Locale } from "./i18n";

/**
 * Saatler HER İKİ DİLDE de Türkiye saatidir (UTC+3) ve 24 saatlik biçimde
 * yazılır. Veri Türkiye'ye ait; okuyan kişinin kendi saat dilimine çevirmek
 * "yangın 03:00'te başladı" cümlesini sahadaki gerçekten koparırdı.
 * İngilizce sayfada bu açıkça yazıyor.
 */
const TZ = "Europe/Istanbul";

const clockFmt: Record<Locale, Intl.DateTimeFormat> = {
  tr: new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }),
  en: new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }),
};

const dayTimeFmt: Record<Locale, Intl.DateTimeFormat> = {
  tr: new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }),
  en: new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }),
};

export const fmtClock = (ms: number, locale: Locale) =>
  clockFmt[locale].format(ms);

export const fmtDayTime = (ms: number, locale: Locale) =>
  dayTimeFmt[locale].format(ms);

const SHORT_MONTHS: Record<Locale, string[]> = {
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** "2026-07-29" → "29 Tem" · "29 Jul" (istemci tarafında da kullanılabilir) */
export function fmtShortDate(iso: string, locale: Locale): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${SHORT_MONTHS[locale][d.getUTCMonth()]}`;
}

const AGO: Record<Locale, { m: string; h: string; d: string }> = {
  tr: { m: "{n} dk önce", h: "{n} sa önce", d: "{n} g önce" },
  en: { m: "{n} min ago", h: "{n} h ago", d: "{n} d ago" },
};

export function fmtAgo(ms: number, now: number, locale: Locale): string {
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  const tpl = AGO[locale];
  if (m < 60) return tpl.m.replace("{n}", String(m));
  const h = m / 60;
  if (h < 24) {
    const v = h < 10 ? fmtNum(h, 1, locale) : String(Math.round(h));
    return tpl.h.replace("{n}", v);
  }
  return tpl.d.replace("{n}", String(Math.round(h / 24)));
}

const NUM_LOCALE: Record<Locale, string> = { tr: "tr-TR", en: "en-GB" };

/**
 * Dil ZORUNLU: tr-TR "1.234,5" yazar, en-GB "1,234.5". Varsayılan bırakmak
 * İngilizce sayfaya sessizce Türk biçimi sızdırırdı — derleyici zorlasın.
 */
export const fmtNum = (n: number, digits: number, locale: Locale) =>
  n.toLocaleString(NUM_LOCALE[locale], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/** iki yön arasındaki mutlak açı farkı (0-180) */
export function angDiff(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}
