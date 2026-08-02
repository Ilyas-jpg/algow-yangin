import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { lookupEvent, normalizeDays } from "@/lib/event-lookup";
import { EV_PARAM, WIN_PARAM } from "@/lib/share";
import { fmtNum } from "@/lib/format";
import { compassTr } from "@/lib/geo";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

  const durum =
    ev?.status === "active"
      ? { t: "AKTİF", c: DANGER }
      : ev?.status === "waning"
        ? { t: "SÖNÜYOR", c: "#d9a441" }
        : { t: "ESKİ", c: INK_3 };

  const saat = ev ? Math.max(0.5, (ev.lastSeen - ev.firstSeen) / 3600_000) : 0;
  const sure = ev
    ? saat < 24
      ? `${fmtNum(saat)} saattir izleniyor`
      : `${fmtNum(saat / 24, 1)} gündür izleniyor`
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
            Yangın
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
        {ev ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", fontSize: 76, lineHeight: 1.05 }}>
              {ev.place}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
              <div style={{ display: "flex", fontSize: 60, color: DANGER }}>
                {fmtNum(ev.frpLast)} MW
              </div>
              <div style={{ display: "flex", fontSize: 30, color: INK_2 }}>
                {`${ev.count} uydu tespiti · ${sure}`}
              </div>
            </div>
            {ev.drift && (
              <div style={{ display: "flex", fontSize: 30, color: INK_2 }}>
                {`Gözlenen ilerleme: ${compassTr(ev.drift.bearingDeg)} yönüne ${fmtNum(ev.drift.km, 1)} km`}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", fontSize: 68, lineHeight: 1.1 }}>
              Türkiye canlı yangın haritası
            </div>
            <div style={{ display: "flex", fontSize: 32, color: INK_2 }}>
              Uydu tespitleri, rüzgâr akışı ve yön tahmini tek haritada
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
            NASA FIRMS · resmi uyarı değildir · 112 / 177
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
