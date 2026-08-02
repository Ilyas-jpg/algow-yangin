import Link from "next/link";
import { ilStats, fmtDate } from "@/lib/il-stats";
import { slugifyTr } from "@/lib/slug";
import { fmtNum } from "@/lib/format";
import { fill, provinceHref, type Locale } from "@/lib/i18n";
import { getDict } from "@/i18n";
import type { Dict } from "@/i18n/tr";
import PageNav from "./PageNav";
import Rich from "./Rich";

const YIL_RENK: Record<string, string> = {
  "2021": "#7f8ea3",
  "2022": "#63707f",
  "2023": "#63707f",
  "2024": "#63707f",
  "2025": "#8fa2ff",
};

/** Kümülatif eğri — sezonun hangi noktasında olduğumuz böyle okunuyor. */
function Egri({
  gunluk,
  guncelYil,
  gunSayisi,
  t,
  locale,
}: {
  gunluk: Record<string, number[]>;
  guncelYil: number;
  gunSayisi: number;
  t: Dict;
  locale: Locale;
}) {
  const W = 660;
  const H = 220;
  const P = { l: 44, r: 8, t: 8, b: 22 };

  const kumul = (a: number[]) => {
    let s = 0;
    return a.map((n) => (s += n));
  };
  const seriler = Object.entries(gunluk).map(([yil, a]) => ({
    yil,
    veri: kumul(a),
  }));
  const max = Math.max(...seriler.flatMap((s) => s.veri), 1);

  const x = (i: number) => P.l + (i / (gunSayisi - 1)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const yol = (veri: number[]) =>
    veri
      .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");

  // Güncel sezonun verisi bugüne kadar; sonrası çizilmesin
  const bugunIdx =
    (gunluk[String(guncelYil)] ?? []).reduce(
      (son, _, i, a) => (a.slice(i).some((v) => v > 0) ? i : son),
      0
    ) + 1;

  const eksenler = [0, 0.5, 1].map((f) => Math.round(max * f));

  return (
    <figure className="mt-6">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={fill(t.stats.curveAria, { yil: guncelYil })}
      >
        {eksenler.map((v) => (
          <g key={v}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={y(v)}
              y2={y(v)}
              stroke="#26262c"
              strokeWidth="1"
            />
            <text
              x={P.l - 6}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-[#7e7e88] font-mono"
              fontSize="9"
            >
              {fmtNum(v, 0, locale)}
            </text>
          </g>
        ))}
        {seriler
          .filter((s) => s.yil !== String(guncelYil))
          .map((s) => (
            <path
              key={s.yil}
              d={yol(s.veri)}
              fill="none"
              stroke={YIL_RENK[s.yil] ?? "#4a5563"}
              strokeWidth="1.2"
              opacity="0.7"
            />
          ))}
        {seriler
          .filter((s) => s.yil === String(guncelYil))
          .map((s) => (
            <path
              key={s.yil}
              d={yol(s.veri.slice(0, bugunIdx))}
              fill="none"
              stroke="#e8563f"
              strokeWidth="2.2"
            />
          ))}
        <text
          x={P.l}
          y={H - 6}
          className="fill-[#7e7e88] font-mono"
          fontSize="9"
        >
          {t.stats.curveStart}
        </text>
        <text
          x={W - P.r}
          y={H - 6}
          textAnchor="end"
          className="fill-[#7e7e88] font-mono"
          fontSize="9"
        >
          {t.stats.curveEnd}
        </text>
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[#e8563f]" /> {guncelYil}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[#8fa2ff]" /> 2025
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[#7f8ea3]" /> 2021
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[#63707f]" /> 2022–2024
        </span>
        <span>{t.stats.curveLegend}</span>
      </figcaption>
    </figure>
  );
}

/** Sezon istatistikleri sayfası — iki dil de aynı sayıları gösterir. */
export default function StatsView({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const veri = ilStats();
  if (!veri?.ulke) {
    return (
      <main className="mx-auto min-h-dvh max-w-[720px] px-5 py-10">
        <p className="text-sm text-ink-2">{t.stats.notReady}</p>
      </main>
    );
  }

  const { ulke, guncelYil } = veri;
  const yillar = Object.keys(ulke.yillar).map(Number).sort();
  const gecmis = yillar.filter((y) => y !== guncelYil);
  const gecmisOrt = Math.round(
    gecmis.reduce((a, y) => a + ulke.yillar[y], 0) / gecmis.length
  );
  const bu = ulke.yillar[guncelYil];
  const fark = Math.round(((bu - gecmisOrt) / gecmisOrt) * 100);
  const enYuksekYil = yillar.reduce((a, b) =>
    ulke.yillar[a] >= ulke.yillar[b] ? a : b
  );

  const iller = Object.entries(veri.iller)
    .map(([ad, s]) => ({ ad, ...s }))
    .filter((x) => x.yanginTespit > 0)
    .sort((a, b) => b.yanginTespit - a.yanginTespit);

  return (
    <main className="mx-auto min-h-dvh max-w-[760px] px-5 py-10">
      <PageNav locale={locale} current="stats" />

      <h1 className="text-[28px] leading-tight font-medium">
        {fill(t.stats.h1, { yil: guncelYil })}
      </h1>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
        {t.stats.intro}
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-line bg-obsidian-2/40 px-4 py-3">
          <p className="font-mono text-[10px] text-ink-3">{t.stats.thisSeason}</p>
          <p className="mt-0.5 font-mono text-[22px] text-danger">
            {fmtNum(bu, 0, locale)}
          </p>
          <p className="text-[11px] text-ink-3">{t.stats.detections}</p>
        </div>
        <div className="rounded-md border border-line bg-obsidian-2/40 px-4 py-3">
          <p className="font-mono text-[10px] text-ink-3">{t.stats.pastAvg}</p>
          <p className="mt-0.5 font-mono text-[22px]">
            {fmtNum(gecmisOrt, 0, locale)}
          </p>
          <p className={`text-[11px] ${fark > 0 ? "text-warn" : "text-ok"}`}>
            {fill(t.stats.vsPast, {
              n: Math.abs(fark),
              dir: fark > 0 ? t.stats.above : t.stats.below,
            })}
          </p>
        </div>
        <div className="rounded-md border border-line bg-obsidian-2/40 px-4 py-3">
          <p className="font-mono text-[10px] text-ink-3">{t.stats.peakSeason}</p>
          <p className="mt-0.5 font-mono text-[22px]">{enYuksekYil}</p>
          <p className="text-[11px] text-ink-3">
            {fill(t.stats.peakDetections, {
              n: fmtNum(ulke.yillar[enYuksekYil], 0, locale),
            })}
          </p>
        </div>
      </div>

      <h2 className="mt-10 text-[18px] font-medium">{t.stats.h2Curve}</h2>
      <Egri
        gunluk={ulke.gunluk}
        guncelYil={guncelYil}
        gunSayisi={ulke.gunSayisi}
        t={t}
        locale={locale}
      />

      <h2 className="mt-10 text-[18px] font-medium">{t.stats.h2Totals}</h2>
      <ul className="mt-3 space-y-1.5">
        {yillar.map((y) => {
          const n = ulke.yillar[y];
          const oran = (n / ulke.yillar[enYuksekYil]) * 100;
          return (
            <li key={y} className="flex items-center gap-3">
              <span className="w-10 shrink-0 font-mono text-[11px] text-ink-2">
                {y}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-sm bg-obsidian-3">
                <span
                  className={`block h-full ${y === guncelYil ? "bg-danger" : "bg-ink-3/50"}`}
                  style={{ width: `${oran}%` }}
                />
              </span>
              <span className="w-16 shrink-0 text-right font-mono text-[11px]">
                {fmtNum(n, 0, locale)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-ink-3">
        {fill(t.stats.totalsNote, { yil: guncelYil })}
      </p>

      <h2 className="mt-10 text-[18px] font-medium">{t.stats.h2Provinces}</h2>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-2">
        {t.stats.provincesNote}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[10px] text-ink-3">
              <th className="py-1.5 pr-3 font-normal">{t.stats.thProvince}</th>
              <th className="py-1.5 pr-3 text-right font-normal">
                {t.stats.thThis}
              </th>
              <th className="py-1.5 pr-3 text-right font-normal">
                {t.stats.thPast}
              </th>
              <th className="py-1.5 text-right font-normal">{t.stats.thPeak}</th>
            </tr>
          </thead>
          <tbody>
            {iller.map((x) => (
              <tr key={x.ad} className="border-b border-line/50">
                <td className="py-1.5 pr-3">
                  <Link
                    href={provinceHref(slugifyTr(x.ad), locale)}
                    className="hover:text-cobalt"
                  >
                    {x.ad}
                  </Link>
                </td>
                <td className="py-1.5 pr-3 text-right font-mono">
                  {fmtNum(x.yanginTespit, 0, locale)}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono text-ink-3">
                  {fmtNum(x.gecmisOrtalama, 0, locale)}
                </td>
                <td className="py-1.5 text-right font-mono text-ink-3">
                  {x.enYuksekFrp
                    ? `${x.enYuksekFrp.frp} MW · ${fmtDate(x.enYuksekFrp.tarih, locale)}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-[18px] font-medium">{t.stats.h2NotWhat}</h2>
      <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-ink-2 [&>li]:list-disc [&>li]:ml-4">
        {t.stats.notWhat.map((segs, i) => (
          <li key={i}>
            <Rich segs={segs} />
          </li>
        ))}
      </ul>

      <p className="mt-8 border-t border-line pt-4 text-[11px] leading-relaxed text-ink-3">
        {t.stats.footer}
      </p>
    </main>
  );
}
