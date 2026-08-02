"use client";

import useSWR from "swr";
import type { SmokeResponse, SmokePoint } from "@/app/api/smoke/route";
import { fmtNum } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** US AQI eşikleri — sayı yerine ne yapması gerektiğini söyler. */
function aqiBand(aqi: number | null): { ad: string; cls: string } | null {
  if (aqi === null) return null;
  if (aqi <= 50) return { ad: "iyi", cls: "text-ok" };
  if (aqi <= 100) return { ad: "orta", cls: "text-ink-2" };
  if (aqi <= 150)
    return { ad: "hassas gruplar için sağlıksız", cls: "text-warn" };
  if (aqi <= 200) return { ad: "sağlıksız", cls: "text-danger" };
  if (aqi <= 300) return { ad: "çok sağlıksız", cls: "text-danger" };
  return { ad: "tehlikeli", cls: "text-danger" };
}

/** "bugün 22:00" / "yarın 06:00" — 48 saatlik seride gün belirsiz kalmasın. */
function ne_zaman(t: number, now: number): string {
  const saat = new Date(t).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const g0 = new Date(now).setHours(0, 0, 0, 0);
  const gun = Math.round((new Date(t).setHours(0, 0, 0, 0) - g0) / 86400_000);
  return gun <= 0 ? `bugün ${saat}` : gun === 1 ? `yarın ${saat}` : `öbür gün ${saat}`;
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
  label = "Duman tahmini",
}: {
  lat: number;
  lon: number;
  label?: string;
}) {
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
      <p className="mt-2 text-[10px] text-ink-3">
        Duman tahmini şu an alınamıyor.
      </p>
    );
  }

  const { now: simdi, peak } = data;
  const band = aqiBand(peak.aqi);
  const artiyor = peak.v > simdi.v * 1.35;

  return (
    <div className="mt-2 border-t border-line/60 pt-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-ink-3">{label}</span>
        <span className={`ml-auto shrink-0 font-mono text-[11px] ${band?.cls ?? "text-ink"}`}>
          {fmtNum(peak.v)} µg/m³
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
                {ne_zaman(peak.t, data.fetchedAt)}
              </b>{" "}
              zirve yapıyor
            </>
          ) : (
            <>48 saat boyunca belirgin artış beklenmiyor</>
          )}
          {band && <span className={band.cls}> · {band.ad}</span>}
        </p>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-ink-3">
        Dağılımı biz hesaplamıyoruz: ECMWF/CAMS modelinin çıktısı. Yangın
        dışındaki kaynakları (trafik, sanayi, toz) da içerir.
      </p>
    </div>
  );
}
