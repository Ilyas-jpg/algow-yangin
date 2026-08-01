"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { FiresMeta, LayerToggles, WindowHours } from "@/lib/types";
import { fmtAgo, fmtClock } from "@/lib/format";

const WINDOWS: { value: WindowHours; label: string }[] = [
  { value: 24, label: "24s" },
  { value: 48, label: "48s" },
  { value: 168, label: "7g" },
];

const TOGGLES: { key: keyof LayerToggles; label: string }[] = [
  { key: "wind", label: "Rüzgar" },
  { key: "heat", label: "Isı" },
  { key: "cones", label: "Tahmin" },
  { key: "satellite", label: "Uydu" },
];

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
}: TopBarProps) {
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
          <span className="text-[15px] font-medium tracking-tight">Yangın</span>
          <span className="hidden text-xs text-ink-3 lg:inline">
            Türkiye yangın izleme ve yön tahmini
          </span>
        </div>

        <div className="order-3 flex w-full items-center gap-2 overflow-x-auto md:order-none md:w-auto md:overflow-visible">
          <div className="flex shrink-0 overflow-hidden rounded border border-line">
            {WINDOWS.map((w) => (
              <button
                key={w.value}
                onClick={() => onWindow(w.value)}
                className={`px-2.5 py-1 font-mono text-[11px] transition-colors active:scale-[0.98] ${
                  windowHours === w.value
                    ? "bg-obsidian-3 text-ink"
                    : "text-ink-3 hover:text-ink-2"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          {TOGGLES.map((t) => (
            <button
              key={t.key}
              onClick={() => onToggle(t.key)}
              className={`shrink-0 rounded border px-2.5 py-1 text-[11px] transition-colors active:scale-[0.98] ${
                layers[t.key]
                  ? "border-cobalt/60 bg-cobalt/10 text-ink"
                  : "border-line text-ink-3 hover:text-ink-2"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={onGeoToggle}
            aria-pressed={geoActive}
            title="Kendi konumunu haritada göster (konum cihazından çıkmaz)"
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
            Konumum
          </button>
          {meta?.demo && (
            <span className="shrink-0 rounded border border-warn/50 px-2 py-1 text-[10px] text-warn">
              Demo veri
            </span>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div
            className="flex items-center gap-1.5 font-mono text-[11px] text-ink-2"
            title={
              newest
                ? `En yeni uydu tespiti ${fmtClock(newest)} · veri ${meta ? fmtClock(meta.fetchedAt) : "-"} itibarıyla`
                : "Veri bekleniyor"
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${dotClass} ${loading ? "animate-pulse" : ""}`}
            />
            <span className="hidden sm:inline">
              {newest ? `son tespit ${fmtAgo(newest, now)}` : "veri bekleniyor"}
            </span>
            <span className="sm:hidden">
              {newest ? fmtAgo(newest, now) : "—"}
            </span>
          </div>
          <Link
            href="/hakkinda"
            className="text-xs text-ink-3 transition-colors hover:text-ink"
          >
            Hakkında
          </Link>
        </div>
      </div>
    </header>
  );
}
