"use client";

import { fmtDayTime } from "@/lib/format";

interface TimelineBarProps {
  /**
   * Gösterilen aralık, saat. Canlı haritada 24/48/120; arşiv oynatmasında
   * yangının kendi süresi (haftalar olabilir) — bu yüzden birleşim tip değil.
   */
  windowHours: number;
  now: number;
  effT: number;
  live: boolean;
  playing: boolean;
  ticks: number[];
  onScrub: (t: number) => void;
  onLive: () => void;
  onPlayToggle: () => void;
  className?: string;
}

export default function TimelineBar({
  windowHours,
  now,
  effT,
  live,
  playing,
  ticks,
  onScrub,
  onLive,
  onPlayToggle,
  className = "",
}: TimelineBarProps) {
  const min = now - windowHours * 3600_000;
  const span = now - min;

  return (
    <div
      className={`flex items-center gap-3 rounded-md border border-line bg-obsidian-1/95 px-3 py-2 ${className}`}
    >
      <button
        onClick={onPlayToggle}
        aria-label={playing ? "Durdur" : "Zaman akışını oynat"}
        className="grid h-6 w-6 shrink-0 place-items-center rounded border border-line text-ink-2 transition-colors hover:text-ink active:scale-[0.96]"
      >
        {playing ? (
          <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden>
            <rect x="0.5" width="3" height="10" fill="currentColor" />
            <rect x="5.5" width="3" height="10" fill="currentColor" />
          </svg>
        ) : (
          <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden>
            <path d="M0.5 0 L8.5 5 L0.5 10 Z" fill="currentColor" />
          </svg>
        )}
      </button>

      <span className="w-[86px] shrink-0 font-mono text-[10px] text-ink-2">
        {fmtDayTime(effT)}
      </span>

      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-3.5 -translate-y-1/2">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-ink-3/50"
              style={{ left: `${((t - min) / span) * 100}%` }}
            />
          ))}
        </div>
        <input
          type="range"
          className="scrub relative w-full"
          min={min}
          max={now}
          step={60_000}
          value={effT}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-label="Zaman kaydırıcısı"
          aria-valuetext={fmtDayTime(effT)}
        />
      </div>

      <button
        onClick={onLive}
        className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] tracking-wide transition-colors active:scale-[0.98] ${
          live
            ? "border-cobalt/60 bg-cobalt/15 text-ink"
            : "border-line text-ink-3 hover:text-ink"
        }`}
      >
        {live ? "CANLI" : "ŞİMDİ"}
      </button>
    </div>
  );
}
