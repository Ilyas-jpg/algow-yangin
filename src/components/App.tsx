"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type {
  FirePoint,
  FiresResponse,
  LayerToggles,
  MsgResponse,
  WindGrid,
  WindPoint,
  WindowHours,
} from "@/lib/types";
import { clusterEvents, statusOf } from "@/lib/cluster";
import { buildCone, type ConeGeom } from "@/lib/wind";
import type { TerrainPoint } from "@/app/api/terrain/route";
import { fmtClock, fmtDayTime, fmtNum } from "@/lib/format";
import { bearingDeg, compassTr, havKm } from "@/lib/geo";
import { useGeolocation } from "./useGeolocation";
import { useAlerts } from "./useAlerts";
import AlertPanel from "./AlertPanel";
import dynamic from "next/dynamic";
import TopBar from "./TopBar";
import EventPanel from "./EventPanel";
import TimelineBar from "./TimelineBar";
import Legend from "./Legend";

/**
 * Harita motoru (MapLibre, ~290 KB) ayrı parçada yüklenir: zayıf bağlantıda
 * olay listesi ve veriler haritayı beklemeden görünür.
 */
const FireMap = dynamic(() => import("./FireMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-obsidian-1">
      <span className="font-mono text-[11px] text-ink-3">harita yükleniyor…</span>
    </div>
  ),
});

/**
 * Service Worker önbellekten servis ettiyse işareti yanıt gövdesine gömer.
 * Modül değişkeni kullanılmaz: React'ın görüp bandı gösterebilmesi ve
 * farklı uçların birbirinin bayrağını ezmemesi gerekiyor.
 */
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return { ...body, __offline: res.headers.get("x-algow-offline") === "1" };
};

/**
 * Zayıf/ölçülü bağlantı: ağır katmanlar kapalı başlar.
 *
 * 3g bilinçli olarak DIŞARIDA: tarayıcı sayfa açılırken ölçüm henüz
 * oturmadığı için sık sık "3g" raporluyor, sonra 4g'ye geçiyor. Bu yüzden
 * rüzgâr ve ısı katmanları sebepsiz kapalı geliyor, kullanıcı da nedenini
 * bilmiyordu. Artık yalnız gerçekten yavaş bağlantıda devreye giriyor
 * ve devreye girdiğinde kullanıcıya söyleniyor.
 */
function isThinConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;
  if (!c) return false;
  return (
    c.saveData === true ||
    c.effectiveType === "2g" ||
    c.effectiveType === "slow-2g"
  );
}

const DAYS_PARAM: Record<WindowHours, string> = { 24: "1", 48: "2", 120: "5" };
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export default function App() {
  const [windowHours, setWindowHours] = useState<WindowHours>(24);
  const [scrub, setScrub] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerToggles>({
    wind: true,
    heat: true,
    cones: true,
    satellite: false,
    burnt: false,
    danger: false,
    msg: true,
  });
  const [offline, setOffline] = useState(false);
  const geo = useGeolocation();
  const userLoc = geo.state.status === "ready" ? geo.state.loc : null;
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lon: number; lat: number } | null>(null);
  const [zoom, setZoom] = useState(5.35);
  const [now, setNow] = useState(() => Date.now());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{
    lon: number;
    lat: number;
    key: number;
  } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const cb = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, []);

  // Zayıf bağlantıda rüzgar animasyonu ve ısı katmanı kapalı başlasın.
  // Sessizce yapılmaz: kullanıcı hem bilgilendirilir hem tek tıkla geri açar.
  const [thinMode, setThinMode] = useState(false);
  useEffect(() => {
    if (isThinConnection()) {
      setLayers((l) => ({ ...l, wind: false, heat: false }));
      setThinMode(true);
    }
  }, []);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // ── Veri
  const {
    data: fires,
    error: firesError,
    isLoading: firesLoading,
  } = useSWR<FiresResponse>(`/api/fires?days=${DAYS_PARAM[windowHours]}`, fetcher, {
    refreshInterval: 600_000,
    keepPreviousData: true,
    revalidateOnFocus: true,
  });

  // Meteosat: 15 dakikada bir yenilenir, VIIRS'in kör aralığını doldurur
  const { data: msg } = useSWR<MsgResponse>("/api/meteosat", fetcher, {
    refreshInterval: 420_000,
    keepPreviousData: true,
    revalidateOnFocus: true,
  });

  const { data: windGrid, error: windError } = useSWR<WindGrid>(
    "/api/wind/grid",
    fetcher,
    { refreshInterval: 1_800_000, revalidateOnFocus: false }
  );

  const live = scrub === null;
  const effT = scrub ?? now;
  const windowMs = windowHours * 3600_000;

  // Pencere değişince kaydırıcı pencere dışında kalmasın
  useEffect(() => {
    if (scrub !== null && scrub < now - windowMs) setScrub(null);
  }, [scrub, now, windowMs]);

  // ── Türetilmiş veri
  const points = useMemo<FirePoint[]>(() => {
    if (!fires) return [];
    return fires.features.map((f) => ({
      ...f.properties,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }));
  }, [fires]);

  const { events: rawEvents, pointEvent } = useMemo(
    () => clusterEvents(points),
    [points]
  );

  // Durum ve sıralama saate bağlı; kümelemeyi yeniden çalıştırmadan türetilir.
  const events = useMemo(() => {
    const rank = { active: 0, waning: 1, old: 2 } as const;
    return rawEvents
      .map((e) => ({ ...e, status: statusOf(e.lastSeen, now) }))
      .sort(
        (a, b) =>
          Number(a.abroad) - Number(b.abroad) ||
          rank[a.status] - rank[b.status] ||
          b.frpLast - a.frpLast
      );
  }, [rawEvents, now]);

  const alerts = useAlerts(events);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId]
  );

  const mapFC = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!fires) return EMPTY_FC;
    return {
      type: "FeatureCollection",
      features: fires.features.map((f) => ({
        ...f,
        properties: { ...f.properties, eventId: pointEvent[f.properties.id] ?? "" },
      })),
    };
  }, [fires, pointEvent]);

  const coneCandidates = useMemo(() => {
    if (!windGrid || !live) return [];
    // Koni yurt dışı bayrağına göre kısıtlanmaz: sınır boyunda en yakın
    // yerleşim karşı tarafta kalabiliyor (Akçakale, Nusaybin, Silopi...),
    // o yüzden gerçek bir TR yangını yanlışlıkla konisiz kalmasın.
    const candidates = events.filter((e) => e.status === "active").slice(0, 14);
    if (
      selectedEvent &&
      selectedEvent.status !== "old" &&
      !candidates.some((c) => c.id === selectedEvent.id)
    ) {
      candidates.push(selectedEvent);
    }
    return candidates;
  }, [events, selectedEvent, windGrid, live]);

  // Koni yönü rüzgâr + eğim bileşkesinden çiziliyor; eğim burada toplu çekilir.
  // Anahtar 0,05°'ye yuvarlanmış ve sıralı → her tazelemede aynı, cache tutuyor.
  const terrainKey = useMemo(() => {
    if (!coneCandidates.length) return null;
    const pts = [
      ...new Set(
        coneCandidates.map(
          (e) =>
            `${(Math.round(e.lon * 20) / 20).toFixed(2)},${(Math.round(e.lat * 20) / 20).toFixed(2)}`
        )
      ),
    ].sort();
    return `/api/terrain?pts=${pts.slice(0, 19).join("|")}`;
  }, [coneCandidates]);

  const { data: terrainData } = useSWR<{ points: TerrainPoint[] }>(
    terrainKey,
    fetcher,
    { refreshInterval: 0, revalidateOnFocus: false, revalidateIfStale: false }
  );

  const cones = useMemo<ConeGeom[]>(() => {
    if (!windGrid || !live) return [];
    const terr = new Map(
      (terrainData?.points ?? []).map((p) => [`${p.lon.toFixed(2)},${p.lat.toFixed(2)}`, p])
    );
    const out: ConeGeom[] = [];
    for (const ev of coneCandidates) {
      const k = `${(Math.round(ev.lon * 20) / 20).toFixed(2)},${(Math.round(ev.lat * 20) / 20).toFixed(2)}`;
      // Arazi düşerse koni yine çizilir — yalnız rüzgâra düşer.
      const cone = buildCone(ev, windGrid, terr.get(k) ?? null);
      if (cone) out.push(cone);
    }
    return out;
  }, [coneCandidates, windGrid, live, terrainData]);

  const conesFC = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: cones.flatMap((c) =>
        c.rings.map((r) => ({
          type: "Feature" as const,
          geometry: { type: "Polygon" as const, coordinates: [r.ring] },
          properties: { hours: r.hours, eventId: c.eventId },
        }))
      ),
    }),
    [cones]
  );

  const coneLinesFC = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      // Daire modunda merkez çizgisi yok (yön iddiası taşımasın): boş
      // LineString geçersiz GeoJSON'dur, o yüzden tamamen eleniyor.
      features: cones
        .filter((c) => c.centerline.length >= 2)
        .map((c) => ({
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: c.centerline },
          properties: { eventId: c.eventId },
        })),
    }),
    [cones]
  );

  /**
   * Seçili yangının geçmişi: nereden çıktı, hangi yolu izledi.
   * Başlangıç noktası ve geçiş saatleri ayrı işaretlenir — "gideceği yer
   * kadar geldiği yer de önemli".
   */
  const trailFC = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!selectedEvent) return EMPTY_FC;
    const passes = selectedEvent.passes.filter((p) => p.t <= effT);
    if (passes.length === 0) return EMPTY_FC;

    const features: GeoJSON.Feature[] = passes.map((p, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: {
        kind: "pass",
        order: passes.length === 1 ? 1 : i / (passes.length - 1),
        label: fmtClock(p.t),
      },
    }));

    if (passes.length >= 2) {
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: passes.map((p) => [p.lon, p.lat]),
        },
        properties: { kind: "line" },
      });
    }

    // İlk görüldüğü nokta — yangının çıkış yeri
    const ilk = passes[0];
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [ilk.lon, ilk.lat] },
      properties: {
        kind: "start",
        label: `İLK GÖRÜLEN · ${fmtDayTime(ilk.t)}`,
      },
    });

    return { type: "FeatureCollection", features };
  }, [selectedEvent, effT]);

  /** Seçili yangının o ana kadar yaktığı alan (tüm geçmiş tespitleri). */
  const burnedFC = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!selectedEvent || !fires) return EMPTY_FC;
    const ids = new Set(
      Object.entries(pointEvent)
        .filter(([, ev]) => ev === selectedEvent.id)
        .map(([pid]) => pid)
    );
    if (!ids.size) return EMPTY_FC;
    return {
      type: "FeatureCollection",
      features: fires.features.filter(
        (f) => ids.has(f.properties.id) && f.properties.dt <= effT
      ),
    };
  }, [selectedEvent, fires, pointEvent, effT]);

  /** Konum açıkken: sana en yakın yangın ne kadar uzakta, hangi yönde. */
  const nearestToMe = useMemo(() => {
    if (!userLoc || events.length === 0) return null;
    let best: (typeof events)[number] | null = null;
    let bestKm = Infinity;
    for (const ev of events) {
      if (ev.status === "old") continue;
      const km = havKm(userLoc.lon, userLoc.lat, ev.lon, ev.lat);
      if (km < bestKm) {
        bestKm = km;
        best = ev;
      }
    }
    if (!best) return null;
    return {
      ev: best,
      km: bestKm,
      dir: compassTr(bearingDeg(userLoc.lon, userLoc.lat, best.lon, best.lat)),
    };
  }, [userLoc, events]);

  const msgFC = useMemo<GeoJSON.FeatureCollection>(
    () =>
      msg?.features?.length
        ? { type: "FeatureCollection", features: msg.features }
        : EMPTY_FC,
    [msg]
  );

  const ticks = useMemo(() => {
    const q = new Set<number>();
    const min = now - windowMs;
    for (const p of points) {
      if (p.dt >= min) q.add(Math.round(p.dt / 900_000) * 900_000);
    }
    return [...q].sort((a, b) => a - b);
  }, [points, now, windowMs]);

  // ── Hava (seçili olay)
  const {
    data: weather,
    error: weatherError,
    isLoading: weatherLoading,
  } = useSWR<WindPoint>(
    selectedEvent
      ? `/api/wind/point?lat=${selectedEvent.lat.toFixed(2)}&lon=${selectedEvent.lon.toFixed(2)}`
      : null,
    fetcher,
    { refreshInterval: 1_800_000, revalidateOnFocus: false }
  );

  // ── Oynatma
  const playRef = useRef(0);
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const from = live ? now - windowMs : effT;
    const span = now - from;
    if (span <= 0) {
      setPlaying(false);
      return;
    }
    const DURATION = 18_000; // pencere ~18 sn'de oynar
    // Her karede state güncellemek tüm ağacı (kümeleme, koni, panel)
    // 60 fps yeniden hesaplatıyordu; ~10 fps oynatma için fazlasıyla yeterli.
    let lastCommit = 0;
    const tick = (t: number) => {
      const frac = Math.min(1, (t - start) / DURATION);
      const cur = from + span * frac;
      if (frac >= 1) {
        setPlaying(false);
        setScrub(null);
        return;
      }
      if (t - lastCommit >= 100) {
        lastCommit = t;
        setScrub(cur);
      }
      playRef.current = requestAnimationFrame(tick);
    };
    playRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(playRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const handleSelect = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id) {
        const ev = events.find((e) => e.id === id);
        if (ev) setFlyTarget({ lon: ev.lon, lat: ev.lat, key: Date.now() });
        setSheetOpen(true);
      }
    },
    [events]
  );

  // Konum ilk kez geldiğinde haritayı oraya getir (sonraki güncellemelerde değil)
  const flewToMe = useRef(false);
  useEffect(() => {
    if (!userLoc) {
      flewToMe.current = false;
      return;
    }
    if (flewToMe.current) return;
    flewToMe.current = true;
    setFlyTarget({ lon: userLoc.lon, lat: userLoc.lat, key: Date.now() });
  }, [userLoc]);

  const toggleLayer = useCallback(
    (k: keyof LayerToggles) => setLayers((l) => ({ ...l, [k]: !l[k] })),
    []
  );

  const staleData = Boolean(firesError && fires);
  const noData = Boolean(firesError && !fires);

  /**
   * Açık olup da ekranda karşılığı olmayan katmanlar için açıklama.
   * "Toggle'a bastım, hiçbir şey olmadı" hissinin panzehiri.
   */
  const layerNotes = useMemo(() => {
    const notes: string[] = [];
    if (layers.heat && zoom > 10.5) {
      notes.push(
        "Isı katmanı yakın zumda kapanır — bu ölçekte tek tek tespitler zaten görünüyor."
      );
    }
    if (layers.cones && !live) {
      notes.push(
        "Tahmin konisi yalnız canlı görünümde çizilir; geçmişe sardığın için gizli."
      );
    } else if (layers.cones && live && cones.length === 0 && events.length > 0) {
      notes.push(
        windGrid
          ? "Tahmin konisi yok: aktif yangınların bulunduğu yerlerde rüzgâr çok durgun."
          : "Tahmin konisi için rüzgâr verisi bekleniyor."
      );
    }
    if (layers.wind && !windGrid) {
      notes.push("Rüzgâr animasyonu için veri bekleniyor.");
    }
    if (layers.wind && reducedMotion) {
      notes.push(
        "Hareket azaltma açık olduğu için rüzgâr animasyonu çalışmıyor."
      );
    }
    return notes;
  }, [layers, zoom, live, cones.length, events.length, windGrid, reducedMotion]);

  const panel = (
    <EventPanel
      events={events}
      selectedId={selectedId}
      onSelect={handleSelect}
      now={now}
      live={live}
      weather={weather}
      weatherLoading={weatherLoading}
      weatherError={Boolean(weatherError)}
      cones={cones}
    />
  );

  return (
    <main className="fixed inset-0 flex flex-col bg-obsidian-1">
      <h1 className="sr-only">
        Algow Yangın — Türkiye canlı yangın haritası ve yön tahmini
      </h1>
      <TopBar
        windowHours={windowHours}
        onWindow={(w) => {
          setWindowHours(w);
          setScrub(null);
          setPlaying(false);
        }}
        layers={layers}
        onToggle={toggleLayer}
        meta={fires?.meta}
        now={now}
        loading={firesLoading}
        geoActive={geo.state.status === "ready"}
        geoBusy={geo.state.status === "locating"}
        onGeoToggle={geo.toggle}
        alertCount={alerts.points.length}
        onAlertsToggle={() => setAlertsOpen((o) => !o)}
      />

      {(offline ||
        (fires as (FiresResponse & { __offline?: boolean }) | undefined)
          ?.__offline) && (
        <div className="relative z-20 border-b border-warn/40 bg-warn/10 px-3 py-1.5 text-xs text-warn">
          Çevrimdışısın — cihazında saklanan son veri gösteriliyor
          {fires ? ` (${fmtClock(fires.meta.fetchedAt)})` : ""}. Bağlantı
          gelince kendiliğinden tazelenir.
        </div>
      )}
      {noData && !offline && (
        <div
          role="alert"
          className="relative z-20 border-b border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger"
        >
          NASA FIRMS verisine şu an ulaşılamıyor — bağlantı aralıklarla yeniden
          denenecek.
        </div>
      )}
      {fires && fires.meta.sourcesOk < fires.meta.sourcesTotal && (
        <div
          role="status"
          className="relative z-20 border-b border-warn/40 bg-warn/10 px-3 py-1.5 text-xs text-warn"
        >
          {fires.meta.sourcesTotal} uydu kaynağından{" "}
          {fires.meta.sourcesTotal - fires.meta.sourcesOk} tanesi yanıt
          vermiyor — bazı tespitler eksik olabilir.
        </div>
      )}
      {windGrid && windGrid.failedChunks > 0 && (
        <div
          role="status"
          className="relative z-20 border-b border-warn/40 bg-warn/10 px-3 py-1.5 text-xs text-warn"
        >
          Rüzgâr verisi kısmen eksik — bazı bölgelerde yön tahmini
          gösterilmiyor.
        </div>
      )}
      {thinMode && (
        <div
          role="status"
          className="relative z-20 flex items-center gap-3 border-b border-line bg-obsidian-2 px-3 py-1.5 text-[11px] text-ink-2"
        >
          <span>
            Bağlantın yavaş göründüğü için rüzgâr animasyonu ve ısı katmanı
            kapalı başlatıldı.
          </span>
          <button
            onClick={() => {
              setLayers((l) => ({ ...l, wind: true, heat: true }));
              setThinMode(false);
            }}
            className="ml-auto shrink-0 rounded border border-line px-2 py-0.5 text-[10px] text-ink hover:border-cobalt/60"
          >
            Yine de aç
          </button>
        </div>
      )}
      {layers.msg && msg?.meta && (
        <div className="relative z-20 border-b border-line bg-obsidian-2 px-3 py-1 text-[11px] text-ink-2">
          <span className="font-mono text-warn">MSG 15dk</span> · Meteosat{" "}
          {fmtClock(msg.meta.slot)} taraması:{" "}
          {msg.meta.count > 0 ? (
            <>
              {msg.meta.count} tespit ·{" "}
              <span className="text-ink-3">
                konum kabadır (turuncu halka pikselin gerçek alanıdır)
              </span>
            </>
          ) : (
            <span className="text-ink-3">
              bu taramada Türkiye&apos;de tespit yok — Meteosat yalnız büyük
              yangınları görür, hassas uydu katmanı açık kalsın
            </span>
          )}
        </div>
      )}
      {windError && (
        <div
          role="status"
          className="relative z-20 border-b border-warn/40 bg-warn/10 px-3 py-1.5 text-xs text-warn"
        >
          Rüzgâr verisine ulaşılamıyor — yön tahmini ve rüzgâr katmanı şu an
          devre dışı.
        </div>
      )}
      {staleData && fires && (
        <div
          role="status"
          className="relative z-20 border-b border-warn/40 bg-warn/10 px-3 py-1.5 text-xs text-warn"
        >
          {fires.meta.windowHours !== windowHours
            ? `Seçtiğin ${windowHours >= 120 ? "5 günlük" : windowHours + " saatlik"} aralık şu an alınamadı — ekranda hâlâ ${fires.meta.windowHours >= 120 ? "5 günlük" : fires.meta.windowHours + " saatlik"} veri var.`
            : `Bağlantı sorunu — ${fmtClock(fires.meta.fetchedAt)} itibarıyla alınan son veri gösteriliyor.`}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <FireMap
          mapFC={mapFC}
          conesFC={conesFC}
          coneLinesFC={coneLinesFC}
          trailFC={trailFC}
          burnedFC={burnedFC}
          msgFC={msgFC}
          selectedId={selectedId}
          effT={effT}
          windowHours={windowHours}
          live={live}
          layers={layers}
          windGrid={windGrid}
          reducedMotion={reducedMotion}
          flyTarget={flyTarget}
          userLoc={userLoc}
          onSelect={handleSelect}
          onCenterChange={setMapCenter}
          onZoomChange={setZoom}
        />

        {alertsOpen && (
          <AlertPanel
            points={alerts.points}
            onAdd={alerts.add}
            onRemove={alerts.remove}
            permission={alerts.permission}
            onRequestPermission={alerts.requestPermission}
            userLoc={userLoc}
            mapCenter={mapCenter}
            onClose={() => setAlertsOpen(false)}
          />
        )}

        {/* Konum durumu: yalnız cihazda kalır, sunucuya gönderilmez */}
        {geo.state.status !== "idle" && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute top-3 left-1/2 z-10 w-[min(92vw,420px)] -translate-x-1/2 md:left-[calc(340px+(100%-340px)/2)]"
          >
            <div className="pointer-events-auto rounded-md border border-line bg-obsidian-1/95 px-3 py-2">
              {geo.state.status === "locating" && (
                <p className="font-mono text-[11px] text-ink-2">
                  konum alınıyor…
                </p>
              )}
              {geo.state.status === "denied" && (
                <p className="text-[11px] leading-relaxed text-ink-2">
                  Konum izni verilmedi. Tarayıcı ayarlarından bu siteye konum
                  izni verirsen kendini haritada görebilirsin.
                </p>
              )}
              {geo.state.status === "error" && (
                <p className="text-[11px] text-ink-2">{geo.state.message}</p>
              )}
              {geo.state.status === "ready" && (
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-cobalt" />
                  <div className="min-w-0 flex-1">
                    {nearestToMe ? (
                      <p className="text-[12px] leading-tight">
                        Sana en yakın yangın{" "}
                        <b className="font-medium">
                          {fmtNum(nearestToMe.km, nearestToMe.km < 10 ? 1 : 0)} km
                        </b>{" "}
                        <b className="font-medium">{nearestToMe.dir}</b> yönünde
                        <span className="text-ink-3"> · {nearestToMe.ev.place}</span>
                      </p>
                    ) : (
                      <p className="text-[12px]">
                        Yakınında aktif yangın tespiti yok.
                      </p>
                    )}
                    <p className="mt-0.5 font-mono text-[10px] text-ink-3">
                      konum ±{fmtNum(geo.state.loc.accuracy)} m · cihazından
                      çıkmaz
                    </p>
                  </div>
                  {nearestToMe && (
                    <button
                      onClick={() => handleSelect(nearestToMe.ev.id)}
                      className="shrink-0 rounded border border-line px-2 py-1 text-[10px] text-ink-2 transition-colors hover:text-ink active:scale-[0.98]"
                    >
                      Göster
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Masaüstü sol panel */}
        <aside className="absolute top-0 bottom-0 left-0 z-10 hidden w-[340px] border-r border-line bg-obsidian-1/95 md:block">
          {panel}
        </aside>

        {/* Masaüstü zaman çizgisi + lejant */}
        <div className="pointer-events-none absolute bottom-4 left-[352px] right-[240px] z-10 hidden justify-center md:flex">
          <TimelineBar
            className="pointer-events-auto w-full max-w-[620px]"
            windowHours={windowHours}
            now={now}
            effT={effT}
            live={live}
            playing={playing}
            ticks={ticks}
            onScrub={(t) => {
              setPlaying(false);
              setScrub(t >= now - 60_000 ? null : t);
            }}
            onLive={() => {
              setPlaying(false);
              setScrub(null);
            }}
            onPlayToggle={() => setPlaying((p) => !p)}
          />
        </div>
        {/* Açık ama görünür çıktısı olmayan katmanların sebebini söyle —
            aksi hâlde toggle "bozuk" gibi hissettiriyor. */}
        {layerNotes.length > 0 && (
          <div className="pointer-events-none absolute bottom-4 left-3 z-10 hidden max-w-[300px] space-y-1 md:block">
            {layerNotes.map((n) => (
              <p
                key={n}
                className="rounded border border-line bg-obsidian-1/95 px-2 py-1 text-[10px] leading-relaxed text-ink-3"
              >
                {n}
              </p>
            ))}
          </div>
        )}

        <div className="absolute right-3 bottom-4 z-10 hidden md:block">
          <Legend />
        </div>

        {/* Mobil alt yığın: zaman çizgisi + olay listesi */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col md:hidden">
          <TimelineBar
            className="mx-2 mb-2"
            windowHours={windowHours}
            now={now}
            effT={effT}
            live={live}
            playing={playing}
            ticks={ticks}
            onScrub={(t) => {
              setPlaying(false);
              setScrub(t >= now - 60_000 ? null : t);
            }}
            onLive={() => {
              setPlaying(false);
              setScrub(null);
            }}
            onPlayToggle={() => setPlaying((p) => !p)}
          />
          <div className="border-t border-line bg-obsidian-1">
            <button
              onClick={() => setSheetOpen((o) => !o)}
              aria-expanded={sheetOpen}
              aria-controls="olay-listesi"
              className="flex w-full items-center justify-between px-4 py-2.5"
            >
              <span className="text-xs text-ink-2">
                <span className="font-mono text-danger">
                  {
                    events.filter((e) => e.status === "active" && !e.abroad)
                      .length
                  }
                </span>{" "}
                aktif yangın · {events.filter((e) => !e.abroad).length} olay
              </span>
              <svg
                width="12"
                height="7"
                viewBox="0 0 12 7"
                aria-hidden
                className={`text-ink-3 transition-transform ${sheetOpen ? "rotate-180" : ""}`}
              >
                <path
                  d="M1 6 L6 1 L11 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
            </button>
            {sheetOpen && (
              <div id="olay-listesi" className="h-[42dvh]">
                {panel}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
