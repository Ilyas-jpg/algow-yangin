import type { Metadata } from "next";
import type { FireEvent } from "./types";
import { EV_PARAM, WIN_PARAM } from "./share";
import { fmtNum } from "./format";
import { compassTr } from "./geo";

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
  days: string
): Metadata {
  const saat = Math.max(0.5, (ev.lastSeen - ev.firstSeen) / 3600_000);
  const sure =
    saat < 24
      ? `${fmtNum(saat)} saattir izleniyor`
      : `${fmtNum(saat / 24, 1)} gündür izleniyor`;

  const durum =
    ev.status === "active"
      ? "aktif"
      : ev.status === "waning"
        ? "sönmekte"
        : "eski kayıt";

  const title = `${ev.place} — ${fmtNum(ev.frpLast)} MW yangın tespiti`;
  const parcalar = [
    `Uydu tespiti ${durum}`,
    `${ev.count} tespit`,
    sure,
    ev.drift
      ? `gözlenen ilerleme ${compassTr(ev.drift.bearingDeg)} yönüne ${fmtNum(ev.drift.km, 1)} km`
      : null,
    "Uydu ısı görür, her tespit yangın olmayabilir; resmi uyarı değildir.",
  ].filter(Boolean);
  const description = parcalar.join(" · ");

  const q = new URLSearchParams({ [EV_PARAM]: id });
  if (days !== "1") q.set(WIN_PARAM, days);
  const ogUrl = `/api/og?${q.toString()}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      locale: "tr_TR",
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
