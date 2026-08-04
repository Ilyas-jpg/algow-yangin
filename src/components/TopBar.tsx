"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { FiresMeta, LayerToggles, WindowHours } from "@/lib/types";
import { fmtAgo, fmtClock } from "@/lib/format";
import { fmtNext, type PassInfo } from "@/lib/passes";
import { fill, path } from "@/lib/i18n";
import { useLocale, useT } from "./LocaleProvider";
import LangSwitch from "./LangSwitch";

// 5 gün, FIRMS'in bu bbox için verdiği en geniş aralık (daha fazlası 400)
const WINDOWS: { value: WindowHours; key: "h24" | "h48" | "h120" }[] = [
  { value: 24, key: "h24" },
  { value: 48, key: "h48" },
  { value: 120, key: "h120" },
];

// "Anız gizle" bilerek burada DEĞİL: o bir katman değil süzgeç ve yeri
// liste başlığı. Üst şeride 10. düğme olarak konduğunda bar taşıp sağdaki
// durum metniyle çakışıyordu (aynı sorun 9 toggle'da da yaşanmıştı).
const TOGGLE_KEYS = [
  "wind",
  "heat",
  "cones",
  "smoke",
  "msg",
  // Meteosat'ın hemen yanında: ikisi de "VIIRS dışı uydu tespiti", ama biri
  // hızlı-kaba (MSG 15dk) diğeri yavaş-keskin (S3 1km). Yan yana durunca
  // aradaki takas okunuyor.
  "s3",
  "news",
  "aircraft",
  "burnt",
  "danger",
  "satellite",
  "today",
  "terrain",
] as const satisfies readonly (keyof LayerToggles)[];

interface TopBarProps {
  windowHours: WindowHours;
  onWindow: (w: WindowHours) => void;
  layers: LayerToggles;
  onToggle: (k: keyof LayerToggles) => void;
  meta: FiresMeta | undefined;
  now: number;
  loading: boolean;
  geoActive: boolean;
  geoBusy: boolean;
  onGeoToggle: () => void;
  alertCount: number;
  onAlertsToggle: () => void;
  /** Sade görünüm: kenar panelleri kapalı (temiz harita / ekran görüntüsü) */
  cleanView: boolean;
  onCleanToggle: () => void;
  pass?: PassInfo;
}

export default function TopBar({
  windowHours,
  onWindow,
  layers,
  onToggle,
  meta,
  now,
  loading,
  geoActive,
  geoBusy,
  onGeoToggle,
  alertCount,
  onAlertsToggle,
  cleanView,
  onCleanToggle,
  pass,
}: TopBarProps) {
  const t = useT();
  const locale = useLocale();
  const newest = meta?.newest ?? null;
  const ageH = newest ? (now - newest) / 3600_000 : null;
  const dotClass =
    ageH === null
      ? "bg-ink-3"
      : ageH <= 3
        ? "bg-ok"
        : ageH <= 6
          ? "bg-warn"
          : "bg-ink-3";

  return (
    <header className="relative z-20 border-b border-line bg-obsidian-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 md:h-12 md:flex-nowrap md:py-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src="/brand/algow-wordmark.webp"
            alt="Algow"
            className="h-[17px] w-auto shrink-0"
          />
          <span className="h-4 w-px shrink-0 bg-line" aria-hidden />
          {/* Alt başlık kaldırıldı: katman sayısı artınca üst barı sıkıştırıp
              başlığı üç satıra kırıyordu. Bilgi zaten sayfa başlığında ve
              /hakkinda'da var. */}
          <span className="whitespace-nowrap text-[15px] font-medium tracking-tight">
            {t.common.brand}
          </span>
        </div>

        {/* Dar ekranda da geniş ekranda da KAYSIN: taşma yerine kaydırma.
            Sabit genişlikte tutulunca sağdaki durum metninin üstüne biniyordu. */}
        <div className="scroll-slim order-3 flex w-full min-w-0 items-center gap-2 overflow-x-auto md:order-none md:flex-1">
          <div className="flex shrink-0 overflow-hidden rounded border border-line">
            {WINDOWS.map((w) => (
              <button
                key={w.value}
                onClick={() => onWindow(w.value)}
                aria-pressed={windowHours === w.value}
                className={`tap-target px-2.5 py-1 font-mono text-[11px] transition-colors active:scale-[0.98] ${
                  windowHours === w.value
                    ? "bg-obsidian-3 text-ink"
                    : "text-ink-3 hover:text-ink-2"
                }`}
              >
                {t.top.windows[w.key]}
              </button>
            ))}
          </div>
          {TOGGLE_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => onToggle(k)}
              aria-pressed={layers[k]}
              title={t.top.toggles[k].title}
              className={`tap-target shrink-0 rounded border px-2.5 py-1 text-[11px] transition-colors active:scale-[0.98] ${
                layers[k]
                  ? "border-cobalt/60 bg-cobalt/10 text-ink"
                  : "border-line text-ink-3 hover:text-ink-2"
              }`}
            >
              {t.top.toggles[k].label}
            </button>
          ))}
          {meta?.demo && (
            <span className="shrink-0 rounded border border-warn/50 px-2 py-1 text-[10px] text-warn">
              {t.top.demoData}
            </span>
          )}
        </div>

        {/* Eylem düğmeleri kaydırılan katman şeridinin DIŞINDA: kaydırılabilir
            bölgede kalınca geniş ekranda bile ekran dışına çıkabiliyorlardı. */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            onClick={onGeoToggle}
            aria-pressed={geoActive}
            title={t.top.myLocationTitle}
            className={`flex shrink-0 items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] transition-colors active:scale-[0.98] ${
              geoActive
                ? "border-cobalt/60 bg-cobalt/10 text-ink"
                : "border-line text-ink-3 hover:text-ink-2"
            }`}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 12 12"
              aria-hidden
              className={geoBusy ? "animate-pulse" : ""}
            >
              <circle
                cx="6"
                cy="6"
                r="2.4"
                fill="currentColor"
              />
              <circle
                cx="6"
                cy="6"
                r="4.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.55"
              />
              <path
                d="M6 0v1.6M6 10.4V12M0 6h1.6M10.4 6H12"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
            {t.top.myLocation}
          </button>
          <button
            onClick={onAlertsToggle}
            title={t.top.alertsTitle}
            className={`tap-target flex shrink-0 items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] transition-colors active:scale-[0.98] ${
              alertCount > 0
                ? "border-cobalt/60 bg-cobalt/10 text-ink"
                : "border-line text-ink-3 hover:text-ink-2"
            }`}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
              <path
                d="M6 1.2a3 3 0 0 0-3 3v2L2 8.2h8L9 6.2v-2a3 3 0 0 0-3-3ZM4.9 9.4a1.15 1.15 0 0 0 2.2 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </svg>
            {t.top.alerts}
            {alertCount > 0 ? ` (${alertCount})` : ""}
          </button>
          {/* SADE GÖRÜNÜM — kenar panellerini kapatır (İlyas 2026-08-04:
              "kenardaki menüler kapalı şekilde ekran görüntüsü alınabilse").
              Yalnız masaüstünde: kapatılan paneller (sol liste + lejant) zaten
              `md:` altında görünüyor, mobilde bottom-sheet var.
              ⚠️ Etiket bilerek TEK KELİME: üst bar 10. ve 12. düğmede taşmıştı,
              "Söndürme uçağı" → "Uçak" dersi burada da geçerli. */}
          <button
            onClick={onCleanToggle}
            title={t.top.cleanTitle}
            aria-pressed={cleanView}
            className={`tap-target hidden shrink-0 items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] transition-colors active:scale-[0.98] md:flex ${
              cleanView
                ? "border-cobalt/60 bg-cobalt/10 text-ink"
                : "border-line text-ink-3 hover:text-ink-2"
            }`}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
              {/* Kapalıyken oklar içe (panelleri geri çağır), açıkken dışa */}
              <rect
                x="0.6"
                y="1.2"
                width="10.8"
                height="9.6"
                rx="1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.5"
              />
              {cleanView ? (
                <path
                  d="M3.2 6H5.6M4.4 4.8 3.2 6l1.2 1.2M8.8 6H6.4M7.6 4.8 8.8 6 7.6 7.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M2.8 3.2v5.6M9.2 3.2v5.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                />
              )}
            </svg>
            {t.top.clean}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div
            className="flex items-center gap-1.5 font-mono text-[11px] text-ink-2"
            title={
              newest
                ? fill(t.top.freshTitle, {
                    clock: fmtClock(newest, locale),
                    fetched: meta ? fmtClock(meta.fetchedAt, locale) : "-",
                  })
                : t.top.waitingTitle
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${dotClass} ${loading ? "animate-pulse" : ""}`}
            />
            <span className="hidden sm:inline">
              {newest
                ? fill(t.top.lastDetection, { ago: fmtAgo(newest, now, locale) })
                : t.top.waitingData}
              {/* Kör aralık uyarısı: "tespit yok" ile "yangın bitti" aynı şey
                  değil. Geçiş pencereleri verinin kendisinden ölçülüyor. */}
              {/* Yalnız geniş ekranda: dar ekranda başlığı sıkıştırıp
                  üç satıra kırıyordu. Bilgi panelde de veriliyor. */}
              {pass?.inGap && pass.nextH !== null && (
                <span className="hidden text-warn xl:inline">
                  {fill(t.top.blindGap, { next: fmtNext(pass.nextH, locale) })}
                </span>
              )}
            </span>
            <span className="sm:hidden">
              {newest ? fmtAgo(newest, now, locale) : "—"}
            </span>
          </div>
          <Link
            href={path("about", locale)}
            className="text-xs text-ink-3 transition-colors hover:text-ink"
          >
            {t.common.about}
          </Link>
          <LangSwitch
            locale={locale}
            label={t.common.otherLang}
            title={t.common.otherLangTitle}
          />
        </div>
      </div>
    </header>
  );
}
