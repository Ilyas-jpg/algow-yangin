import type { Metadata } from "next";
import type { FireEvent } from "./types";
import { EV_PARAM, WIN_PARAM } from "./share";
import { fmtNum } from "./format";
import { compass } from "./geo";
import { OG_LOCALE, fill, type Locale } from "./i18n";
import type { Dict } from "@/i18n/tr";

/** Kart görselinin dili — /api/og bu parametreyi okur. */
export const LANG_PARAM = "lang";

/**
 * Paylaşılan bir yangının sohbet/sosyal kartı.
 *
 * Başlık ve açıklama gerçek veriden üretilir; kart görseli de aynı olayı
 * sunucuda yeniden çözer (bkz. api/og). Böylece paylaşılan bağlantı ne
 * anlamsız bir "canlı harita" başlığı gösterir ne de uydurulabilir.
 */
export function shareMetadata(
  ev: FireEvent,
  id: string,
  days: string,
  locale: Locale,
  t: Dict
): Metadata {
  const saat = Math.max(0.5, (ev.lastSeen - ev.firstSeen) / 3600_000);
  const sure =
    saat < 24
      ? fill(t.shareMeta.spanHours, { n: fmtNum(saat, 0, locale) })
      : fill(t.shareMeta.spanDays, { n: fmtNum(saat / 24, 1, locale) });

  const durum = t.shareMeta.status[ev.status];

  const title = fill(t.shareMeta.title, {
    place: ev.place,
    mw: fmtNum(ev.frpLast, 0, locale),
  });
  const parcalar = [
    fill(t.shareMeta.lead, { status: durum }),
    fill(t.shareMeta.count, { n: ev.count }),
    sure,
    ev.drift
      ? fill(t.shareMeta.drift, {
          dir: compass(ev.drift.bearingDeg, locale),
          km: fmtNum(ev.drift.km, 1, locale),
        })
      : null,
    t.shareMeta.tail,
  ].filter(Boolean);
  const description = parcalar.join(" · ");

  const q = new URLSearchParams({ [EV_PARAM]: id });
  if (days !== "1") q.set(WIN_PARAM, days);
  if (locale !== "tr") q.set(LANG_PARAM, locale);
  const ogUrl = `/api/og?${q.toString()}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      locale: OG_LOCALE[locale],
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}
