"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import useSWR from "swr";
import type { ArchiveFire } from "@/lib/archive";
import { expandArchive } from "@/lib/archive";
import { clusterEvents } from "@/lib/cluster";
import { fmtDayTime, fmtNum } from "@/lib/format";
import { archiveDataHref, fill, path } from "@/lib/i18n";
import type { Dict } from "@/i18n/tr";
import type { Locale } from "@/lib/i18n";
import { LocaleProvider, useLocale, useT } from "./LocaleProvider";
import MapLoading from "./MapLoading";
import TimelineBar from "./TimelineBar";

const FireMap = dynamic(() => import("./FireMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const fetcher = (u: string) => fetch(u).then((r) => r.json());

/**
 * Geçmiş bir yangının oynatması.
 *
 * Canlı uygulamadan ayrı tutuldu: canlı taraf "şimdi"ye ve SWR tazelemesine
 * göre kurulu, arşiv ise sabit ve kapalı bir zaman aralığı. Aynı bileşene
 * iki zaman modeli sığdırmak canlı tarafı kırılgan yapardı.
 *
 * Tahmin konisi bilerek YOK: 2021'in saatlik rüzgârıyla koni çizmek, o gün
 * yapılmamış bir tahmini sonradan yapılmış gibi gösterirdi.
 */
export default function ArchiveViewer({
  slug,
  locale,
  dict,
  ad,
  ozet,
  il,
}: {
  slug: string;
  locale: Locale;
  dict: Dict;
  /** Ad ve özet sunucudan (index.json) geliyor: kayıt dosyasının kendisi
   *  tek dilde ve 362 KB'a kadar çıkıyor, ikinci kopyası yok. */
  ad: string;
  ozet: string;
  il: string;
}) {
  return (
    <LocaleProvider locale={locale} dict={dict}>
      <Viewer slug={slug} ad={ad} ozet={ozet} il={il} />
    </LocaleProvider>
  );
}

function Viewer({
  slug,
  ad,
  ozet,
  il,
}: {
  slug: string;
  ad: string;
  ozet: string;
  il: string;
}) {
  const t = useT();
  const locale = useLocale();
  // Arşiv verisi TEK kopya: İngilizce sayfa da aynı JSON'u okur, ikinci bir
  // kopya üretmiyoruz (sayılar iki dilde ayrışamasın).
  const { data, error } = useSWR<ArchiveFire>(archiveDataHref(slug), fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });

  const [tScrub, setTScrub] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // İlk değer render sırasında okunuyor (bileşen yalnız tarayıcıda çalışır);
  // efekt yalnız değişikliğe abone oluyor.
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cb = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, []);

  const points = useMemo(() => (data ? expandArchive(data) : []), [data]);

  // Kümeleme bir kez, tüm kayıt üzerinde: her karede yeniden çalıştırmak
  // 9 bin noktada oynatmayı dondururdu.
  const { events, pointEvent } = useMemo(
    () => clusterEvents(points),
    [points]
  );

  const son = data?.son ?? 0;
  const ilk = data?.ilk ?? 0;
  const effT = tScrub ?? son;

  const gorunen = useMemo(
    () => points.filter((p) => p.dt <= effT),
    [points, effT]
  );

  const mapFC = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: gorunen.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: {
          id: p.id,
          frp: p.frp,
          conf: p.conf,
          sat: p.sat,
          dt: p.dt,
          dn: p.dn,
          eventId: pointEvent[p.id] ?? "",
        },
      })),
    }),
    [gorunen, pointEvent]
  );

  const enBuyuk = useMemo(
    () => [...events].sort((a, b) => b.frpMax - a.frpMax)[0] ?? null,
    [events]
  );

  const trailFC = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!enBuyuk) return EMPTY;
    const passes = enBuyuk.passes.filter((p) => p.t <= effT);
    if (!passes.length) return EMPTY;
    const feats: GeoJSON.Feature[] = passes.map((p, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: {
        kind: "pass",
        order: passes.length === 1 ? 1 : i / (passes.length - 1),
        label: fmtDayTime(p.t, locale),
      },
    }));
    if (passes.length >= 2) {
      feats.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: passes.map((p) => [p.lon, p.lat]),
        },
        properties: { kind: "line" },
      });
    }
    feats.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [passes[0].lon, passes[0].lat] },
      properties: {
        kind: "start",
        label: `${t.map.firstSeen} · ${fmtDayTime(passes[0].t, locale)}`,
      },
    });
    return { type: "FeatureCollection", features: feats };
  }, [enBuyuk, effT, t, locale]);

  const ticks = useMemo(() => {
    const q = new Set<number>();
    for (const p of points) q.add(Math.round(p.dt / 3600_000) * 3600_000);
    return [...q].sort((a, b) => a - b);
  }, [points]);

  // ── Oynatma: kayıt ne kadar uzun olursa olsun ~22 saniyede akar
  const raf = useRef(0);
  useEffect(() => {
    if (!playing || !data) return;
    const basla = performance.now();
    const from = tScrub !== null && tScrub < son ? tScrub : ilk;
    // Kayıt boşsa oynatacak bir şey yok; state'e dokunmadan çık.
    // (t her zaman son'dan küçüğe çekildiği için normalde span > 0.)
    const span = son - from;
    if (span <= 0) return;
    let lastCommit = 0;
    const tick = (x: number) => {
      const frac = Math.min(1, (x - basla) / 22_000);
      if (frac >= 1) {
        setTScrub(son);
        setPlaying(false);
        return;
      }
      if (x - lastCommit >= 110) {
        lastCommit = x;
        setTScrub(from + span * frac);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, data]);

  if (error) {
    return (
      <div className="grid h-dvh place-items-center bg-obsidian-1 p-6">
        <p className="max-w-[320px] text-center text-xs leading-relaxed text-ink-2">
          {t.archive.viewerError}
        </p>
      </div>
    );
  }

  const toplamFrp = gorunen.reduce((s, p) => s + p.frp, 0);
  const gunler = data ? (son - ilk) / 86400_000 : 0;

  return (
    <main className="fixed inset-0 flex flex-col bg-obsidian-1">
      <header className="relative z-20 flex items-center gap-2.5 border-b border-line bg-obsidian-1 px-3 py-2">
        <img src="/brand/algow-wordmark.webp" alt="Algow" className="h-[16px] w-auto shrink-0" />
        <span className="h-3.5 w-px shrink-0 bg-line" aria-hidden />
        <span className="min-w-0 truncate text-[14px] font-medium">
          {ad || t.archive.viewerFallback}
        </span>
        {data && (
          <span className="hidden shrink-0 font-mono text-[11px] text-ink-3 sm:inline">
            {fill(t.archive.viewerMeta, {
              il,
              days: fmtNum(gunler, 1, locale),
              n: data.pts.length,
            })}
          </span>
        )}
        <Link
          href={path("archive", locale)}
          className="ml-auto shrink-0 text-[11px] text-ink-3 hover:text-ink"
        >
          {t.common.archive}
        </Link>
        <Link
          href={path("home", locale)}
          className="shrink-0 text-[11px] text-ink-3 hover:text-ink"
        >
          {t.common.liveMap}
        </Link>
      </header>

      <div className="relative min-h-0 flex-1">
        <FireMap
          mapFC={mapFC}
          conesFC={EMPTY}
          coneLinesFC={EMPTY}
          trailFC={trailFC}
          burnedFC={EMPTY}
          msgFC={EMPTY}
          newsFC={EMPTY}
          smokeFC={EMPTY}
          selectedId={selectedId}
          effT={effT}
          windowHours={Math.max(1, (son - ilk) / 3600_000)}
          live={false}
          layers={{
            wind: false,
            heat: true,
            cones: false,
            hideFarm: false,
            satellite: false,
            today: false,
            terrain: true,
            burnt: false,
            danger: false,
            smoke: false,
            msg: false,
            // Arşiv geçmiş bir yangını oynatıyor; bugünün haber akışının
            // orada işi yok.
            news: false,
          }}
          windGrid={undefined}
          reducedMotion={reducedMotion}
          flyTarget={
            data ? { lon: data.center[0], lat: data.center[1], key: 1, zoom: 9.2 } : null
          }
          userLoc={null}
          onSelect={setSelectedId}
        />

        <div className="pointer-events-none absolute top-3 left-3 z-10 max-w-[300px]">
          <div className="pointer-events-auto rounded-md border border-line bg-obsidian-1/95 px-3 py-2">
            <p className="font-mono text-[11px] text-ink-2">
              {fmtDayTime(effT, locale)}
            </p>
            <p className="mt-1 font-mono text-[11px]">
              <span className="text-danger">{gorunen.length}</span>
              {fill(t.archive.viewerCount, {
                mw: fmtNum(toplamFrp, 0, locale),
              })}
            </p>
            {ozet && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-ink-3">
                {ozet}
              </p>
            )}
            <p className="mt-1.5 border-t border-line/60 pt-1.5 text-[10px] leading-relaxed text-ink-3">
              {t.archive.viewerNote}
            </p>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center px-2 pb-3">
          {data && (
            <TimelineBar
              className="w-full max-w-[620px]"
              windowHours={Math.max(1, (son - ilk) / 3600_000)}
              now={son}
              effT={effT}
              live={tScrub === null}
              playing={playing}
              ticks={ticks}
              onScrub={(x) => {
                setPlaying(false);
                setTScrub(x >= son ? null : x);
              }}
              onLive={() => {
                setPlaying(false);
                setTScrub(null);
              }}
              onPlayToggle={() => {
                // Sona gelmişken oynata basılırsa baştan başlasın
                if (tScrub !== null && tScrub >= son) setTScrub(null);
                setPlaying((p) => !p);
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
}
