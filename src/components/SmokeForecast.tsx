"use client";

import useSWR from "swr";
import type { SmokeResponse, SmokePoint } from "@/app/api/smoke/route";
import { fmtClock, fmtNum } from "@/lib/format";
import { fill, type Locale } from "@/lib/i18n";
import type { Dict } from "@/i18n/tr";
import { useLocale, useT } from "./LocaleProvider";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** US AQI eşikleri — sayı yerine ne yapması gerektiğini söyler. */
function aqiBand(
  aqi: number | null,
  t: Dict
): { ad: string; cls: string } | null {
  if (aqi === null) return null;
  if (aqi <= 50) return { ad: t.smoke.bands.good, cls: "text-ok" };
  if (aqi <= 100) return { ad: t.smoke.bands.moderate, cls: "text-ink-2" };
  if (aqi <= 150) return { ad: t.smoke.bands.sensitive, cls: "text-warn" };
  if (aqi <= 200) return { ad: t.smoke.bands.unhealthy, cls: "text-danger" };
  if (aqi <= 300)
    return { ad: t.smoke.bands.veryUnhealthy, cls: "text-danger" };
  return { ad: t.smoke.bands.hazardous, cls: "text-danger" };
}

/** "bugün 22:00" / "tomorrow 06:00" — 48 saatlik seride gün belirsiz kalmasın. */
function neZaman(t: number, now: number, dict: Dict, locale: Locale): string {
  const saat = fmtClock(t, locale);
  const g0 = new Date(now).setHours(0, 0, 0, 0);
  const gun = Math.round((new Date(t).setHours(0, 0, 0, 0) - g0) / 86400_000);
  const tpl =
    gun <= 0
      ? dict.smoke.today
      : gun === 1
        ? dict.smoke.tomorrow
        : dict.smoke.dayAfter;
  return fill(tpl, { t: saat });
}

function Cizgi({ series, peak }: { series: SmokePoint[]; peak: SmokePoint }) {
  if (series.length < 2) return null;
  const W = 132;
  const H = 22;
  const max = Math.max(peak.v, 1);
  const d = series
    .map((p, i) => {
      const x = (i / (series.length - 1)) * W;
      const y = H - (p.v / max) * (H - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const px = (series.indexOf(peak) / (series.length - 1)) * W;
  return (
    <svg width={W} height={H} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.75" />
      <circle cx={px} cy={H - (peak.v / max) * (H - 2) - 1} r="2" fill="currentColor" />
    </svg>
  );
}

/**
 * Duman tahmini — önümüzdeki 48 saat.
 *
 * Platformun en geniş kitleye dokunan bilgisi: yangına 50 km uzaktaki astım
 * hastası için yangının yerinden çok dumanın ne zaman geleceği önemli.
 * Dağılımı CAMS hesaplıyor, biz göstermiyoruz — bu ayrım metinde de yazılı.
 */
export default function SmokeForecast({
  lat,
  lon,
  label,
}: {
  lat: number;
  lon: number;
  label?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const { data, error, isLoading } = useSWR<SmokeResponse>(
    `/api/smoke?lat=${lat.toFixed(1)}&lon=${lon.toFixed(1)}`,
    fetcher,
    { refreshInterval: 1_800_000, revalidateOnFocus: false }
  );

  if (isLoading) {
    return <div className="mt-2 h-3.5 animate-pulse rounded-sm bg-obsidian-3" />;
  }
  if (error || !data?.peak || !data.now) {
    return (
      <p className="mt-2 text-[10px] text-ink-3">{t.smoke.unavailable}</p>
    );
  }

  const { now: simdi, peak } = data;
  const band = aqiBand(peak.aqi, t);
  const artiyor = peak.v > simdi.v * 1.35;

  return (
    <div className="mt-2 border-t border-line/60 pt-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-ink-3">{label ?? t.smoke.label}</span>
        <span className={`ml-auto shrink-0 font-mono text-[11px] ${band?.cls ?? "text-ink"}`}>
          {fill(t.weather.smokeValue, { n: fmtNum(peak.v, 0, locale) })}
        </span>
        {peak.aqi !== null && (
          <span className={`shrink-0 text-[10px] ${band?.cls ?? "text-ink-3"}`}>
            AQI {peak.aqi}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 text-ink-2">
        <Cizgi series={data.series} peak={peak} />
        <p className="text-[10px] leading-tight">
          {artiyor ? (
            <>
              <b className="font-normal text-ink">
                {neZaman(peak.t, data.fetchedAt, t, locale)}
              </b>
              {t.smoke.peaks}
            </>
          ) : (
            <>{t.smoke.noPeak}</>
          )}
          {band && <span className={band.cls}> · {band.ad}</span>}
        </p>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-ink-3">
        {t.smoke.source}
      </p>
    </div>
  );
}
