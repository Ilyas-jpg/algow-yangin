/* Satori kendi <img>'ini rasterize ediyor; next/image burada çalışmaz —
   uyarı bu dosyada yanlış pozitif (aynı gerekçe Intro.tsx'te de yazılı). */
/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { lookupEvent, normalizeDays } from "@/lib/event-lookup";
import { EV_PARAM, WIN_PARAM } from "@/lib/share";
import { LANG_PARAM } from "@/lib/share-metadata";
import { fmtNum } from "@/lib/format";
import { compass } from "@/lib/geo";
import { fill, type Locale } from "@/lib/i18n";
import { contextMap } from "@/lib/og-map";
import { getDict } from "@/i18n";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Bağlam haritasının kart içindeki ölçüsü. */
const HARITA_G = 470;
const HARITA_Y = 300;

const kis = (n: number, alt: number, ust: number) =>
  Math.max(alt, Math.min(ust, n));

const INK = "#e8e8ea";
const INK_2 = "#a8a8b3";
const INK_3 = "#7e7e88";
const OBSIDIAN = "#0a0a0b";
const LINE = "#26262c";
const DANGER = "#e8563f";
const COBALT = "#3b6ef5";

/**
 * Paylaşım kartı.
 *
 * Sayılar URL'den değil, sunucuda yeniden kümelenen gerçek FIRMS verisinden
 * gelir — uydurma kart üretilemesin diye (bkz. lib/event-lookup).
 */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const sp = request.nextUrl.searchParams;
  const id = sp.get(EV_PARAM);
  const days = normalizeDays(sp.get(WIN_PARAM) ?? undefined);
  const ev = id ? await lookupEvent(id, days) : null;

  // Kart dili paylaşan sayfadan gelir; bilinmeyen değer Türkçeye düşer.
  const locale: Locale = sp.get(LANG_PARAM) === "en" ? "en" : "tr";
  const t = getDict(locale);

  const durum =
    ev?.status === "active"
      ? { t: t.og.status.active, c: DANGER }
      : ev?.status === "waning"
        ? { t: t.og.status.waning, c: "#d9a441" }
        : { t: t.og.status.old, c: INK_3 };

  // Karo çekilmiyor; harita eldeki tespit ve geçiş verisinden çiziliyor.
  const harita = ev ? contextMap(ev, HARITA_G, HARITA_Y) : null;

  const saat = ev ? Math.max(0.5, (ev.lastSeen - ev.firstSeen) / 3600_000) : 0;
  const sure = ev
    ? saat < 24
      ? fill(t.shareMeta.spanHours, { n: fmtNum(saat, 0, locale) })
      : fill(t.shareMeta.spanDays, { n: fmtNum(saat / 24, 1, locale) })
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: OBSIDIAN,
          padding: "64px 72px",
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        {/* Üst şerit: marka + durum.
            Wordmark gerçek asset — metinle "Algow" yazmak yasak
            (bkz. vault: feedback_algow_wordmark_zorunlu). */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img
            src={`${origin}/brand/algow-wordmark.png`}
            width={124}
            height={42}
            alt="Algow"
          />
          <div
            style={{
              display: "flex",
              width: 2,
              height: 26,
              background: LINE,
            }}
          />
          <div style={{ display: "flex", fontSize: 26, color: INK_2 }}>
            {t.common.brand}
          </div>
          {ev && (
            <div
              style={{
                display: "flex",
                marginLeft: "auto",
                border: `2px solid ${durum.c}`,
                color: durum.c,
                borderRadius: 6,
                padding: "6px 16px",
                fontSize: 22,
                letterSpacing: 2,
              }}
            >
              {durum.t}
            </div>
          )}
        </div>

        {/* Gövde */}
        {ev && harita ? (
          <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
            {/* Bağlam haritası: solda şekil, sağda sayı.
                Etiketler SVG'ye gömülmüyor — data-URI rasterize edilirken
                font olmadığı için metin boş çıkardı. */}
            <div
              style={{
                display: "flex",
                position: "relative",
                width: HARITA_G,
                height: HARITA_Y,
                borderRadius: 10,
                overflow: "hidden",
                border: `2px solid ${LINE}`,
              }}
            >
              <img src={harita.src} width={HARITA_G} height={HARITA_Y} alt="" />
              {harita.labels.map((l, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    position: "absolute",
                    left: kis(l.x + 9, 4, HARITA_G - 100),
                    top: kis(l.y - 11, 2, HARITA_Y - 40),
                    fontSize: 19,
                    color: INK_2,
                  }}
                >
                  {l.text}
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  left: harita.scale.x,
                  top: harita.scale.y - 24,
                  fontSize: 17,
                  color: INK_3,
                }}
              >
                {harita.scaleText}
              </div>
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  right: 16,
                  top: 32,
                  fontSize: 17,
                  color: INK_3,
                }}
              >
                {t.og.north}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                flex: 1,
              }}
            >
              <div style={{ display: "flex", fontSize: 48, lineHeight: 1.08 }}>
                {ev.place}
              </div>
              <div style={{ display: "flex", fontSize: 54, color: DANGER }}>
                {fmtNum(ev.frpLast, 0, locale)} MW
              </div>
              <div style={{ display: "flex", fontSize: 26, color: INK_2 }}>
                {fill(t.og.detections, { n: ev.count, span: sure })}
              </div>
              {ev.drift && (
                <div style={{ display: "flex", fontSize: 26, color: INK_2 }}>
                  {fill(t.og.drift, {
                    dir: compass(ev.drift.bearingDeg, locale),
                    km: fmtNum(ev.drift.km, 1, locale),
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", fontSize: 68, lineHeight: 1.1 }}>
              {t.og.fallbackTitle}
            </div>
            <div style={{ display: "flex", fontSize: 32, color: INK_2 }}>
              {t.og.fallbackSub}
            </div>
          </div>
        )}

        {/* Alt şerit */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderTop: `2px solid ${LINE}`,
            paddingTop: 24,
            fontSize: 24,
            color: INK_3,
          }}
        >
          <div style={{ display: "flex", color: COBALT }}>yangin.algow.net</div>
          <div style={{ display: "flex", marginLeft: "auto" }}>
            {t.og.footer}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
