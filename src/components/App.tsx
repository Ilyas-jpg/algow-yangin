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
import { EV_PARAM, WIN_PARAM, eventPath, provincePath } from "@/lib/share";
import { resolveEvent } from "@/lib/event-id";
import { buildCone, type ConeGeom } from "@/lib/wind";
import type { TerrainPoint } from "@/app/api/terrain/route";
import type { WindForecastPoint } from "@/app/api/wind/forecast/route";
import type { SmokeGrid } from "@/app/api/smoke/grid/route";
import type { NewsResponse } from "@/app/api/news/route";
import { nextPassEstimate } from "@/lib/passes";
import { firstAlarms } from "@/lib/first-alarm";
import { fmtAgo, fmtClock, fmtDayTime, fmtNum } from "@/lib/format";
import { fill, path as localePath } from "@/lib/i18n";
import {
  CONE_MINZOOM,
  bearingDeg,
  compass,
  havKm,
  metersPerPixel,
} from "@/lib/geo";
import Intro from "./Intro";
import { useLocale, useT } from "./LocaleProvider";
import MapLoading from "./MapLoading";
import Rich from "./Rich";
import { useGeolocation } from "./useGeolocation";
import { useAlerts } from "./useAlerts";
import { useFuel, fuelKey } from "./useFuel";
import { heatFootprint } from "@/lib/footprint";
import AlertPanel from "./AlertPanel";
import dynamic from "next/dynamic";
import TopBar from "./TopBar";
import EmbedBar from "./EmbedBar";
import ProvinceSummary from "./ProvinceSummary";
import EventPanel from "./EventPanel";
import TimelineBar from "./TimelineBar";
import Legend from "./Legend";

/**
 * Harita motoru (MapLibre, ~290 KB) ayrı parçada yüklenir: zayıf bağlantıda
 * olay listesi ve veriler haritayı beklemeden görünür.
 */
const FireMap = dynamic(() => import("./FireMap"), {
  ssr: false,
  loading: () => <MapLoading />,
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

export interface ProvinceOzet {
  /** sabit ısı kaynakları düşülmüş tespit sayısı */
  yanginTespit: number;
  gecmisOrtalama: number;
  sabitTespit: number;
  enYuksek: { frp: number; tarih: string; yer: string } | null;
  yil: number;
}

export interface AppProps {
  /** İl sayfasından gelindiğinde harita bu ile odaklanır. */
  focus?: {
    ad: string;
    lat: number;
    lon: number;
    /** o ilin sezon özeti — panelde görünür, sayfada da metin olarak var */
    ozet?: ProvinceOzet | null;
  };
  /**
   * Gömme görünümü: yan panel, zaman çizgisi, uyarılar ve konum kapalı.
   * Haber sitesine iframe ile alınan sade harita.
   */
  embed?: boolean;
}

export default function App({ focus, embed = false }: AppProps = {}) {
  const t = useT();
  const locale = useLocale();
  // Pencere de bağlantıdan gelebilir: paylaşan 5 günlük görünümdeyse, alıcının
  // 24 saatlik varsayılanında o yangın hiç bulunmayabilirdi.
  const [windowHours, setWindowHours] = useState<WindowHours>(() => {
    if (typeof window === "undefined") return 24;
    const g = new URLSearchParams(window.location.search).get(WIN_PARAM);
    return g === "5" ? 120 : g === "2" ? 48 : 24;
  });
  const [scrub, setScrub] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerToggles>({
    wind: true,
    heat: true,
    cones: true,
    hideFarm: false,
    satellite: false,
    today: false,
    terrain: false,
    burnt: false,
    danger: false,
    smoke: false,
    msg: true,
    news: true,
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
    zoom?: number;
  } | null>(() => {
    // İl sayfası: bağlantıda olay yoksa harita doğrudan o ile açılsın.
    // Efektle yapmak yerine ilk değerde veriliyor — açılışta fazladan
    // bir render turu ve kısa bir "önce Türkiye, sonra il" sıçraması olmuyor.
    if (!focus) return null;
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      if (q.get(EV_PARAM)) return null; // olay varsa uçuşu o belirler
    }
    return { lon: focus.lon, lat: focus.lat, key: 1, zoom: 8 };
  });

  /**
   * Paylaşılan bağlantıdaki olay (?ev=). Kümeleme istemcide olduğu için
   * veri gelmeden çözülemez; ilk değeri render sırasında okuyoruz (bu bileşen
   * yalnız tarayıcıda çalışır) ki URL yazıcı efekt bayrağı silmesin.
   */
  const [pendingEv, setPendingEv] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get(EV_PARAM)
  );
  const [evMissing, setEvMissing] = useState(false);

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

  // Haber ihbarı: uydunun hiç göremediği yangınların tek kanalı. Katman
  // kapalıyken çekilmez — kapalı katmanın kimseye maliyeti olmasın.
  const { data: news } = useSWR<NewsResponse>(
    layers.news ? "/api/news" : null,
    fetcher,
    { refreshInterval: 600_000, keepPreviousData: true, revalidateOnFocus: true }
  );

  const { data: windGrid, error: windError } = useSWR<WindGrid>(
    "/api/wind/grid",
    fetcher,
    { refreshInterval: 1_800_000, revalidateOnFocus: false }
  );

  // Duman alanı yalnız katman açıkken çekilir — kapalıyken kimseye maliyeti yok
  const { data: smokeGrid } = useSWR<SmokeGrid>(
    layers.smoke ? "/api/smoke/grid" : null,
    fetcher,
    { refreshInterval: 1_800_000, revalidateOnFocus: false }
  );

  /** Grid → nokta bulutu. Yarıçap hücreyi kaplasın diye zoom'a bağlı. */
  const smokeFC = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!smokeGrid) return EMPTY_FC;
    const feats: GeoJSON.Feature[] = [];
    for (let r = 0; r < smokeGrid.ny; r++) {
      for (let c = 0; c < smokeGrid.nx; c++) {
        const v = smokeGrid.pm[r * smokeGrid.nx + c];
        // null = veri yok. 0 yazıp "temiz" göstermek olmayan bilgiyi
        // iyi haber diye sunmak olurdu.
        if (v === null || v === undefined) continue;
        feats.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [
              smokeGrid.lon0 + c * smokeGrid.dLon,
              smokeGrid.lat0 + r * smokeGrid.dLat,
            ],
          },
          properties: { pm: v },
        });
      }
    }
    return { type: "FeatureCollection", features: feats };
  }, [smokeGrid]);

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

  /**
   * İlk alarm — MTG'nin gördüğü ama FIRMS'in doğrulamadığı ısı kaynakları.
   *
   * 2 Ağustos'ta Bayramiç yangınını MTG 16:08'de gördü, FIRMS hiç görmedi,
   * ilk haber 17:39'da çıktı. Veri elimizdeydi ama yalnız harita üstünde
   * geçici bir halkaydı: listede yoktu, sayaçta yoktu, uyarı üretmedi ve
   * yangın sönünce halka da silindi. Bu memo o tespiti öne çıkarıyor.
   */
  const firstAlarm = useMemo(() => {
    if (!live || !layers.msg || !msg?.features?.length) return [];
    return firstAlarms(
      msg.features.map((f) => ({
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        frp: f.properties.frp,
        dt: f.properties.dt,
      })),
      points
      // Yurt dışı alarm bandına çıkmıyor. Olay LİSTESİNDE sınır ötesi
      // yangınlar "YURT DIŞI" rozetiyle duruyor ve orada kalmalı — ama
      // ekranın tepesindeki alarm bandı Türkiye için bir uyarı; Güney
      // Kıbrıs'taki bir ısı kaynağını oraya koymak bandı gürültüye boğar.
    ).filter((a) => !a.abroad);
  }, [live, layers.msg, msg, points]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId]
  );

  /**
   * Anız süzgeci. Sınıflandırma yalnız süzgeç açıkken istenir.
   * Sınıfı bilinmeyen olay GİZLENMEZ: "bilmiyorum"u "tarım değil" saymak da
   * "tarım" saymak da yanlış olurdu, ikisi de kullanıcıyı yanıltır.
   */
  const fuelData = useFuel(events, layers.hideFarm);
  const hiddenIds = useMemo(() => {
    if (!layers.hideFarm) return new Set<string>();
    const out = new Set<string>();
    for (const e of events) {
      if (fuelData.map.get(fuelKey(e.lon, e.lat)) === "TARIM") out.add(e.id);
    }
    return out;
  }, [events, fuelData, layers.hideFarm]);

  /** Listede ve haritada gösterilenler. Arama/seçim `events` üzerinden kalır. */
  const shownEvents = useMemo(
    () => (hiddenIds.size ? events.filter((e) => !hiddenIds.has(e.id)) : events),
    [events, hiddenIds]
  );

  const mapFC = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!fires) return EMPTY_FC;
    const feats = fires.features.map((f) => ({
      ...f,
      properties: { ...f.properties, eventId: pointEvent[f.properties.id] ?? "" },
    }));
    return {
      type: "FeatureCollection",
      // Gizlenen olayın tespitleri haritadan da düşer; yoksa liste temizlenip
      // harita anız noktalarıyla dolu kalırdı.
      features: hiddenIds.size
        ? feats.filter((f) => !hiddenIds.has(f.properties.eventId))
        : feats,
    };
  }, [fires, pointEvent, hiddenIds]);

  const coneCandidates = useMemo(() => {
    if (!windGrid || !live) return [];
    // Koni yurt dışı bayrağına göre kısıtlanmaz: sınır boyunda en yakın
    // yerleşim karşı tarafta kalabiliyor (Akçakale, Nusaybin, Silopi...),
    // o yüzden gerçek bir TR yangını yanlışlıkla konisiz kalmasın.
    // Sabit ısı kaynağına koni çizilmez: yayılacak bir yangın yok.
    const candidates = shownEvents
      .filter((e) => e.status === "active" && !e.fixedSource)
      .slice(0, 14);
    if (
      selectedEvent &&
      selectedEvent.status !== "old" &&
      !selectedEvent.fixedSource &&
      !candidates.some((c) => c.id === selectedEvent.id)
    ) {
      candidates.push(selectedEvent);
    }
    return candidates;
  }, [shownEvents, selectedEvent, windGrid, live]);

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

  // Halkalar kendi saatlerinin rüzgârıyla çizilsin diye saatlik tahmin.
  const forecastKey = useMemo(() => {
    if (!coneCandidates.length) return null;
    const pts = [
      ...new Set(
        coneCandidates.map(
          (e) => `${(Math.round(e.lon * 10) / 10).toFixed(1)},${(Math.round(e.lat * 10) / 10).toFixed(1)}`
        )
      ),
    ].sort();
    return `/api/wind/forecast?pts=${pts.slice(0, 19).join("|")}`;
  }, [coneCandidates]);

  const { data: fcData } = useSWR<{ points: WindForecastPoint[] }>(
    forecastKey,
    fetcher,
    { refreshInterval: 1_800_000, revalidateOnFocus: false }
  );

  const cones = useMemo<ConeGeom[]>(() => {
    if (!windGrid || !live) return [];
    const terr = new Map(
      (terrainData?.points ?? []).map((p) => [`${p.lon.toFixed(2)},${p.lat.toFixed(2)}`, p])
    );
    const fc = new Map(
      (fcData?.points ?? []).map((p) => [`${p.lon.toFixed(1)},${p.lat.toFixed(1)}`, p])
    );
    const out: ConeGeom[] = [];
    for (const ev of coneCandidates) {
      const kT = `${(Math.round(ev.lon * 20) / 20).toFixed(2)},${(Math.round(ev.lat * 20) / 20).toFixed(2)}`;
      const kF = `${(Math.round(ev.lon * 10) / 10).toFixed(1)},${(Math.round(ev.lat * 10) / 10).toFixed(1)}`;
      // Arazi veya tahmin düşerse koni yine çizilir — eski davranışa döner.
      const cone = buildCone(ev, windGrid, terr.get(kT) ?? null, fc.get(kF) ?? null);
      if (cone) out.push(cone);
    }
    return out;
  }, [coneCandidates, windGrid, live, terrainData, fcData]);

  /**
   * Erişim şekli bu ölçekte görülebiliyor mu?
   *
   * Kalibrasyondan sonra en büyük halka ~2,7 km — Türkiye görünümünde (z≈5,3)
   * bu 1-2 piksel, yani şekil çiziliyor ama göze "hiç yok" gibi geliyor ve
   * "Tahmin" düğmesi bozuk sanılıyor. Şekli sahte büyütmek yanlış bir erişim
   * vaadi olurdu; onun yerine ölçeği söylüyoruz.
   */
  const coneTooSmall = useMemo(() => {
    if (!layers.cones || !live || cones.length === 0) return null;
    let maxKm = 0;
    for (const c of cones) {
      const son = c.rings[c.rings.length - 1];
      if (!son) continue;
      for (const p of son.ring) {
        const km = havKm(c.apex[0], c.apex[1], p[0], p[1]);
        if (km > maxKm) maxKm = km;
      }
    }
    if (maxKm === 0) return null;
    // Eşik harita katmanıyla ORTAK (lib/geo) — arayüz "gizli" derken şekil
    // görünür kalmasın.
    if (zoom >= CONE_MINZOOM) return null;
    const mpp = metersPerPixel(mapCenter?.lat ?? 39, zoom);
    return { km: maxKm, px: (maxKm * 1000) / mpp };
  }, [cones, layers.cones, live, zoom, mapCenter]);

  /** Uydu geçiş pencereleri verinin kendisinden ölçülür (yörünge tablosu yok) */
  const passInfo = useMemo(
    () =>
      nextPassEstimate(
        (fires?.features ?? []).map((f) => f.properties.dt),
        now,
        fires?.meta?.newest ?? null
      ),
    [fires, now]
  );

  /** Seçili yangının yakıt sınıfı — panelde "anız mı orman mı" ayrımı için */
  const selectedFuel = useMemo(() => {
    if (!selectedEvent || !terrainData?.points) return null;
    const k = `${(Math.round(selectedEvent.lon * 20) / 20).toFixed(2)},${(Math.round(selectedEvent.lat * 20) / 20).toFixed(2)}`;
    return terrainData.points.find((p) => `${p.lon.toFixed(2)},${p.lat.toFixed(2)}` === k)?.fuel ?? null;
  }, [selectedEvent, terrainData]);

  /**
   * Seçili yangının uydu ayak izi. "Kaç hektar yandı" haberin ilk sorusu ve
   * panelde hiç yoktu. Yetkili kaynak EFFIS perimetresidir ama Türkiye için
   * poligon dönmüyor (sorguldu, boş); ölçebildiğimizi adını doğru koyarak
   * veriyoruz — bkz. lib/footprint.
   */
  const selectedFootprint = useMemo(() => {
    if (!selectedEvent || !fires) return null;
    const pts = fires.features
      .filter(
        (f) =>
          pointEvent[f.properties.id] === selectedEvent.id &&
          f.properties.dt <= effT
      )
      .map((f) => ({
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        sat: f.properties.sat,
      }));
    return heatFootprint(pts);
  }, [selectedEvent, fires, pointEvent, effT]);

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
        label: fmtClock(p.t, locale),
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
        // Medyan değil en erken tespit — bkz. PassGroup.t0
        label: `${t.map.firstSeen} · ${fmtDayTime(ilk.t0, locale)}`,
      },
    });

    return { type: "FeatureCollection", features };
  }, [selectedEvent, effT, t, locale]);

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
      dir: compass(
        bearingDeg(userLoc.lon, userLoc.lat, best.lon, best.lat),
        locale
      ),
    };
  }, [userLoc, events, locale]);

  const msgFC = useMemo<GeoJSON.FeatureCollection>(
    () =>
      msg?.features?.length
        ? { type: "FeatureCollection", features: msg.features }
        : EMPTY_FC,
    [msg]
  );

  /**
   * Haber ihbarları — nokta değil YAKLAŞIK ALAN. Yarıçap sunucudan geliyor
   * ve eşleşmenin kabalığını taşıyor (ilçe adı geçtiyse dar, yalnız il adı
   * geçtiyse geniş). Meteosat pikselinde verdiğimiz kararın aynısı: kaba
   * konumu keskin bir nokta gibi çizmek, olmayan bir hassasiyet vaat eder.
   */
  const newsFC = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!layers.news || !news?.signals?.length) return EMPTY_FC;
    return {
      type: "FeatureCollection",
      features: news.signals.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
        properties: {
          id: s.id,
          radiusKm: s.radiusKm,
          place: s.place,
          il: s.il,
          status: s.status,
          label: s.place === s.il ? s.place : `${s.place}, ${s.il}`,
          // Sönmüş ihbar soluk çizilir: hâlâ bilgi ama uyarı değil.
          done: s.status === "sondu" ? 1 : 0,
          // Tıklanınca açılan kart için — dairenin hangi habere dayandığını
          // kullanıcı görmeden "doğrulanmamış ihbar" demek yetmez.
          title: s.title,
          source: s.source,
          link: s.link,
          t: s.t,
          sourceCount: s.sourceCount,
          trusted: s.trusted ? 1 : 0,
        },
      })),
    };
  }, [layers.news, news]);

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

  /**
   * Paylaşılan olayı veri gelince seç. Olay artık zaman penceresinde değilse
   * sessizce yutma: kullanıcı linke tıklamış, bir cevap hak ediyor.
   */
  /* eslint-disable react-hooks/set-state-in-effect --
     Kümeleme istemcide yapılıyor ve veri SWR ile sonradan geliyor; paylaşılan
     olay ancak veri indikten SONRA çözülebilir. Render sırasında türetilemez,
     çünkü seçim kullanıcının da değiştirdiği bir state. pendingEv bir kez
     temizlendikten sonra bu efekt bir daha iş yapmaz. */
  useEffect(() => {
    if (!pendingEv || !fires) return;
    const ev = resolveEvent(events, pendingEv);
    if (ev) {
      setSelectedId(ev.id);
      setFlyTarget({ lon: ev.lon, lat: ev.lat, key: Date.now() });
      setSheetOpen(true);
    } else {
      setEvMissing(true);
    }
    setPendingEv(null);
  }, [pendingEv, events, fires]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** Seçim → URL. Paylaşılabilir bağlantı her zaman adres çubuğunda durur. */
  useEffect(() => {
    if (pendingEv) return; // açılıştaki ?ev= henüz çözülmedi, silme
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set(EV_PARAM, selectedId);
    else url.searchParams.delete(EV_PARAM);
    const days = DAYS_PARAM[windowHours];
    if (days !== "1") url.searchParams.set(WIN_PARAM, days);
    else url.searchParams.delete(WIN_PARAM);
    window.history.replaceState(null, "", url);
  }, [selectedId, pendingEv, windowHours]);

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
      notes.push(t.layerNote.heatZoom);
    }
    if (layers.cones && !live) {
      notes.push(t.layerNote.conePast);
    } else if (coneTooSmall) {
      notes.push(
        fill(t.layerNote.coneSmall, {
          km: fmtNum(coneTooSmall.km, 1, locale),
        })
      );
    } else if (layers.cones && live && cones.length === 0 && events.length > 0) {
      notes.push(
        windGrid ? t.layerNote.coneCalm : t.layerNote.coneWaiting
      );
    }
    if (layers.wind && !windGrid) {
      notes.push(t.layerNote.windWaiting);
    }
    if (layers.wind && reducedMotion) {
      notes.push(t.layerNote.windReduced);
    }
    // Süzgecin ne yaptığını ve neyi yapamadığını açıkça söyle: sessizce
    // "temizlenmiş" bir harita, eksiği olmayan bir harita sanılır.
    if (layers.hideFarm) {
      if (fuelData.loading) {
        notes.push(t.layerNote.fuelLoading);
      } else {
        notes.push(
          fill(t.layerNote.farmHidden, { n: hiddenIds.size }) +
            (fuelData.unclassified > 0
              ? fill(t.layerNote.farmUnclassified, {
                  n: fuelData.unclassified,
                })
              : "")
        );
      }
    }
    return notes;
  }, [
    layers,
    zoom,
    live,
    cones.length,
    events.length,
    windGrid,
    reducedMotion,
    fuelData,
    hiddenIds.size,
    coneTooSmall,
    t,
    locale,
  ]);

  const panel = (
    <EventPanel
      events={shownEvents}
      selectedId={selectedId}
      onSelect={handleSelect}
      now={now}
      live={live}
      weather={weather}
      weatherLoading={weatherLoading}
      weatherError={Boolean(weatherError)}
      cones={cones}
      fuel={selectedFuel}
      footprint={selectedFootprint}
      pass={passInfo}
      days={DAYS_PARAM[windowHours]}
      hideFarm={layers.hideFarm}
      onHideFarm={() => toggleLayer("hideFarm")}
      hiddenFarmCount={hiddenIds.size}
      fuelLoading={fuelData.loading}
    />
  );

  return (
    <main className="fixed inset-0 flex flex-col bg-obsidian-1">
      {/* Gömme görünümünde YOK: haber sitesinin sayfasında açılış perdesi
          açmak misafirlikte perde çekmek olurdu. */}
      {!embed && <Intro />}
      <h1 className="sr-only">
        {focus
          ? fill(t.province.srH1, { ad: focus.ad })
          : t.province.srH1Home}
      </h1>
      {embed ? (
        <EmbedBar
          meta={fires?.meta}
          now={now}
          href={
            focus
              ? provincePath(focus.ad, locale)
              : localePath("home", locale)
          }
        />
      ) : (
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
          pass={passInfo}
        />
      )}

      {(offline ||
        (fires as (FiresResponse & { __offline?: boolean }) | undefined)
          ?.__offline) && (
        <div className="relative z-20 border-b border-warn/40 bg-warn/10 px-3 py-1.5 text-xs text-warn">
          {fill(t.banner.offline, {
            when: fires
              ? fill(t.banner.offlineWhen, {
                  clock: fmtClock(fires.meta.fetchedAt, locale),
                })
              : "",
          })}
        </div>
      )}
      {evMissing && (
        <div
          role="status"
          className="relative z-20 flex items-center gap-3 border-b border-line bg-obsidian-2 px-3 py-1.5 text-[11px] text-ink-2"
        >
          <span>{t.banner.eventMissing}</span>
          <button
            onClick={() => setEvMissing(false)}
            className="ml-auto shrink-0 rounded border border-line px-2 py-0.5 text-[10px] text-ink hover:border-cobalt/60"
          >
            {t.common.close}
          </button>
        </div>
      )}
      {noData && !offline && (
        <div
          role="alert"
          className="relative z-20 border-b border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger"
        >
          {t.banner.noData}
        </div>
      )}
      {fires && fires.meta.sourcesOk < fires.meta.sourcesTotal && (
        <div
          role="status"
          className="relative z-20 border-b border-warn/40 bg-warn/10 px-3 py-1.5 text-xs text-warn"
        >
          {fill(t.banner.sourcesDown, {
            total: fires.meta.sourcesTotal,
            down: fires.meta.sourcesTotal - fires.meta.sourcesOk,
          })}
        </div>
      )}
      {windGrid && windGrid.failedChunks > 0 && (
        <div
          role="status"
          className="relative z-20 border-b border-warn/40 bg-warn/10 px-3 py-1.5 text-xs text-warn"
        >
          {t.banner.windPartial}
        </div>
      )}
      {thinMode && (
        <div
          role="status"
          className="relative z-20 flex items-center gap-3 border-b border-line bg-obsidian-2 px-3 py-1.5 text-[11px] text-ink-2"
        >
          <span>{t.banner.thin}</span>
          <button
            onClick={() => {
              setLayers((l) => ({ ...l, wind: true, heat: true }));
              setThinMode(false);
            }}
            className="ml-auto shrink-0 rounded border border-line px-2 py-0.5 text-[10px] text-ink hover:border-cobalt/60"
          >
            {t.banner.thinAction}
          </button>
        </div>
      )}
      {layers.msg && msg?.meta && (
        <div className="relative z-20 border-b border-line bg-obsidian-2 px-3 py-1 text-[11px] text-ink-2">
          <span className="font-mono text-warn">
            {fill(t.banner.msgSource, {
              src: msg.meta.kaynak ?? "MSG",
              min: msg.meta.araDk ?? 15,
            })}
          </span>
          {fill(t.banner.msgScan, { clock: fmtClock(msg.meta.slot, locale) })}
          {msg.meta.count > 0 ? (
            <>
              {fill(t.banner.msgCount, { n: msg.meta.count })}
              <span className="text-ink-3">{t.banner.msgCoarse}</span>
            </>
          ) : (
            <span className="text-ink-3">{t.banner.msgEmpty}</span>
          )}
        </div>
      )}
      {firstAlarm.length > 0 && (
        <div
          role="alert"
          className="relative z-20 border-b border-warn/50 bg-warn/10 px-3 py-1.5 text-[11px] text-ink-2"
        >
          <span className="font-mono text-warn">
            {fill(t.banner.firstAlarm, { n: firstAlarm.length })}
          </span>
          {firstAlarm.slice(0, 3).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() =>
                setFlyTarget({ lon: a.lon, lat: a.lat, key: Date.now(), zoom: 9 })
              }
              className="ml-2 underline decoration-dotted underline-offset-2 hover:text-ink"
            >
              {a.label} ({fmtNum(a.frp, 0, locale)} MW)
            </button>
          ))}
          <span className="text-ink-3">{t.banner.firstAlarmNote}</span>
        </div>
      )}
      {layers.news && news && (
        <div
          role="status"
          className="relative z-20 border-b border-line bg-obsidian-2 px-3 py-1 text-[11px] text-ink-2"
        >
          <span className="font-mono text-[#93c5fd]">
            {fill(t.banner.newsCount, { n: news.signals.length })}
          </span>
          <span className="text-ink-3">{t.banner.newsUnverified}</span>
          <span className="text-ink-3">{t.banner.newsPopupHint}</span>
          {news.meta.unlocated > 0 && (
            <span className="text-ink-3">
              {fill(t.banner.newsUnlocated, { n: news.meta.unlocated })}
            </span>
          )}
        </div>
      )}
      {windError && (
        <div
          role="status"
          className="relative z-20 border-b border-warn/40 bg-warn/10 px-3 py-1.5 text-xs text-warn"
        >
          {t.banner.windDown}
        </div>
      )}
      {staleData && fires && (
        <div
          role="status"
          className="relative z-20 border-b border-warn/40 bg-warn/10 px-3 py-1.5 text-xs text-warn"
        >
          {fires.meta.windowHours !== windowHours
            ? fill(t.banner.staleWindow, {
                want:
                  windowHours >= 120
                    ? t.banner.window120
                    : fill(t.banner.windowHours, { n: windowHours }),
                have:
                  fires.meta.windowHours >= 120
                    ? t.banner.window120
                    : fill(t.banner.windowHours, {
                        n: fires.meta.windowHours,
                      }),
              })
            : fill(t.banner.staleConn, {
                clock: fmtClock(fires.meta.fetchedAt, locale),
              })}
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
          newsFC={newsFC}
          smokeFC={smokeFC}
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
                  {t.geo.locating}
                </p>
              )}
              {geo.state.status === "denied" && (
                <p className="text-[11px] leading-relaxed text-ink-2">
                  {t.geo.denied}
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
                        <Rich
                          segs={t.geo.nearest}
                          vars={{
                            km: fmtNum(
                              nearestToMe.km,
                              nearestToMe.km < 10 ? 1 : 0,
                              locale
                            ),
                            dir: nearestToMe.dir,
                          }}
                        />
                        <span className="text-ink-3"> · {nearestToMe.ev.place}</span>
                      </p>
                    ) : (
                      <p className="text-[12px]">{t.geo.none}</p>
                    )}
                    <p className="mt-0.5 font-mono text-[10px] text-ink-3">
                      {fill(t.geo.accuracy, {
                        m: fmtNum(geo.state.loc.accuracy, 0, locale),
                      })}
                    </p>
                  </div>
                  {nearestToMe && (
                    <button
                      onClick={() => handleSelect(nearestToMe.ev.id)}
                      className="shrink-0 rounded border border-line px-2 py-1 text-[10px] text-ink-2 transition-colors hover:text-ink active:scale-[0.98]"
                    >
                      {t.common.show}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gömme görünümünde seçilen yangının sade kartı — yan panel yok */}
        {embed && selectedEvent && (
          <div className="absolute top-3 left-3 z-10 max-w-[280px] rounded-md border border-line bg-obsidian-1/95 px-3 py-2">
            <p className="text-[13px] font-medium">{selectedEvent.place}</p>
            <p className="mt-0.5 font-mono text-[11px] text-ink-2">
              {fill(t.embed.cardMeta, {
                count: selectedEvent.count,
                mw: fmtNum(selectedEvent.frpLast, 0, locale),
                ago: fmtAgo(selectedEvent.lastSeen, now, locale),
              })}
            </p>
            <a
              href={eventPath(selectedEvent, DAYS_PARAM[windowHours], locale)}
              target="_blank"
              rel="noopener"
              className="mt-1.5 inline-block text-[10px] text-cobalt hover:underline"
            >
              {t.embed.detail}
            </a>
          </div>
        )}

        {/* Masaüstü sol panel */}
        {!embed && (
          <aside className="absolute top-0 bottom-0 left-0 z-10 hidden w-[340px] flex-col border-r border-line bg-obsidian-1/95 md:flex">
            {focus?.ozet && (
              <ProvinceSummary ad={focus.ad} ozet={focus.ozet} />
            )}
            <div className="min-h-0 flex-1">{panel}</div>
          </aside>
        )}

        {/* Masaüstü zaman çizgisi + lejant */}
        <div
          className={`pointer-events-none absolute bottom-4 left-[352px] right-[240px] z-10 hidden justify-center ${embed ? "" : "md:flex"}`}
        >
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
        {!embed && layerNotes.length > 0 && (
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
        <div
          className={`absolute inset-x-0 bottom-0 z-10 flex-col md:hidden ${embed ? "hidden" : "flex"}`}
        >
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
                    shownEvents.filter(
                      (e) =>
                        e.status === "active" && !e.abroad && !e.fixedSource
                    ).length
                  }
                </span>
                {fill(t.embed.mobileCount, {
                  events: shownEvents.filter((e) => !e.abroad).length,
                })}
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
