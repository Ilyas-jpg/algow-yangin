"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapGL } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MlMap,
  MapMouseEvent,
} from "maplibre-gl";
import type { LayerToggles, UserLocation, WindGrid } from "@/lib/types";
import { metersPerPixel } from "@/lib/geo";
import type { ConeGeom } from "@/lib/wind";
import { WindParticleLayer } from "./WindParticles";

const STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const ESRI_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/**
 * Copernicus EFFIS/GWIS WMS — ücretsiz, atıf zorunlu.
 * STYLES boş da olsa GÖNDERİLMELİ: MapServer 8 onu zorunlu tutuyor,
 * yoksa görüntü yerine ServiceException XML dönüyor.
 */
const wms = (service: string, layer: string) =>
  `https://maps.effis.emergency.copernicus.eu/${service}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
  `&LAYERS=${layer}&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857` +
  `&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256`;

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** frp → yarıçap (px, temel) */
const R_EXPR: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["sqrt", ["max", 0.5, ["get", "frp"]]],
  1, 3,
  5.5, 6,
  11, 9.5,
  20, 14,
];

const FIRE_COLOR: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "frp"],
  0, "#9a3412",
  15, "#c2410c",
  40, "#f97316",
  120, "#fdba74",
  300, "#fff1e0",
];

interface FireMapProps {
  mapFC: GeoJSON.FeatureCollection;
  conesFC: GeoJSON.FeatureCollection;
  coneLinesFC: GeoJSON.FeatureCollection;
  trailFC: GeoJSON.FeatureCollection;
  burnedFC: GeoJSON.FeatureCollection;
  msgFC: GeoJSON.FeatureCollection;
  selectedId: string | null;
  effT: number;
  windowHours: number;
  live: boolean;
  layers: LayerToggles;
  windGrid: WindGrid | undefined;
  reducedMotion: boolean;
  flyTarget: { lon: number; lat: number; key: number } | null;
  userLoc: UserLocation | null;
  onSelect: (id: string | null) => void;
  onCenterChange?: (c: { lon: number; lat: number }) => void;
  onZoomChange?: (z: number) => void;
}

export default function FireMap({
  mapFC,
  conesFC,
  coneLinesFC,
  trailFC,
  burnedFC,
  msgFC,
  selectedId,
  effT,
  windowHours,
  live,
  layers,
  windGrid,
  reducedMotion,
  flyTarget,
  userLoc,
  onSelect,
  onCenterChange,
  onZoomChange,
}: FireMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const windRef = useRef<WindParticleLayer | null>(null);
  const [ready, setReady] = useState(false);
  const [styleFailed, setStyleFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  const onCenterRef = useRef(onCenterChange);
  const onZoomRef = useRef(onZoomChange);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onCenterRef.current = onCenterChange;
    onZoomRef.current = onZoomChange;
  });

  // ── Harita kurulumu (bir kez)
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new MapGL({
      container: containerRef.current,
      style: STYLE_URL,
      center: [32.6, 39.0],
      zoom: 5.35,
      minZoom: 4,
      maxZoom: 15,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    // Teşhis kancası: ?debug=1 ile harita nesnesi konsoldan incelenebilir.
    // Katman görünürlüklerini dışarıdan doğrulamak için gerekiyor.
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("debug")
    ) {
      (window as unknown as { __map?: MlMap }).__map = map;
    }

    map.on("error", (e) => {
      // Altlık yüklenemezse "load" hiç ateşlenmez ve kullanıcı sebepsiz
      // boş bir kutu görür; en azından listenin çalıştığını söyleyelim.
      if (!map.isStyleLoaded()) setStyleFailed(true);
      console.error("[harita]", e.error?.message ?? e);
    });

    map.on("load", () => {
      // Basemap kontrastını ters çevir: dark-matter'da su (#2C353C) karadan
      // (#0e0e0e) açık. Yangın haritasında kara öne çıkmalı, deniz geri çekilmeli.
      if (map.getLayer("background")) {
        map.setPaintProperty("background", "background-color", "#16181c");
      }
      if (map.getLayer("water")) {
        map.setPaintProperty("water", "fill-color", "#080b0f");
      }
      if (map.getLayer("water_shadow")) {
        map.setPaintProperty("water_shadow", "fill-color", "#05070a");
      }

      // Yerleşim adları: dark-matter bunları geç zoom'da açar (ilçe z8, köy z10).
      // Yangın haritasında "neresi yanıyor" okunabilmeli → erken göster ve
      // koyu zeminde okunur hale getir (halo + parlak metin).
      const PLACE_MINZOOM: Record<string, number> = {
        place_town: 5,
        place_villages: 7,
        place_hamlet: 9,
        place_suburbs: 10,
        place_city_r6: 4.5,
        place_city_r5: 4.5,
        place_city_dot_r7: 4.5,
        place_city_dot_z7: 5,
        place_capital_dot_z7: 4,
      };
      for (const [id, mz] of Object.entries(PLACE_MINZOOM)) {
        if (map.getLayer(id)) map.setLayerZoomRange(id, mz, 24);
      }
      for (const layer of map.getStyle().layers) {
        if (layer.type !== "symbol" || !layer.id.startsWith("place_")) continue;
        map.setPaintProperty(layer.id, "text-color", "#e7e7ea");
        map.setPaintProperty(layer.id, "text-halo-color", "#08090b");
        map.setPaintProperty(layer.id, "text-halo-width", 1.4);
        map.setPaintProperty(layer.id, "text-halo-blur", 0.4);
      }

      // Veri katmanları basemap etiketlerinin ALTINA girer; yer adları
      // her zaman en üstte kalsın (yangın halkaları ismi kapatmasın).
      const labelTop = map
        .getStyle()
        .layers.find((l) => l.type === "symbol")?.id;

      // Uydu görüntüsü (varsayılan kapalı)
      map.addSource("sat", {
        type: "raster",
        tiles: [ESRI_TILES],
        tileSize: 256,
        attribution: "Esri, Maxar, Earthstar Geographics",
      });
      map.addLayer(
        {
          id: "sat",
          type: "raster",
          source: "sat",
          layout: { visibility: "none" },
          paint: { "raster-opacity": 0.92 },
        },
        labelTop
      );

      // Yangın tehlikesi (GWIS FWI tahmini) — en altta, zemin gibi
      map.addSource("danger", {
        type: "raster",
        tiles: [wms("gwis", "ecmwf.fwi")],
        tileSize: 256,
        attribution: "GWIS / Copernicus EMS",
      });
      map.addLayer(
        {
          id: "danger",
          type: "raster",
          source: "danger",
          layout: { visibility: "none" },
          paint: { "raster-opacity": 0.45 },
        },
        labelTop
      );

      // Yanan alan perimetreleri (EFFIS, Sentinel-2 tabanlı)
      map.addSource("burnt", {
        type: "raster",
        tiles: [wms("effis", "effis.nrt.ba.poly")],
        tileSize: 256,
        attribution: "EFFIS / Copernicus EMS",
      });
      map.addLayer(
        {
          id: "burnt",
          type: "raster",
          source: "burnt",
          layout: { visibility: "none" },
          paint: { "raster-opacity": 0.75 },
        },
        labelTop
      );

      map.addSource("fires", { type: "geojson", data: EMPTY_FC });
      map.addSource("cones", { type: "geojson", data: EMPTY_FC });
      map.addSource("cone-lines", { type: "geojson", data: EMPTY_FC });
      map.addSource("trail", { type: "geojson", data: EMPTY_FC });
      map.addSource("burned", { type: "geojson", data: EMPTY_FC });
      map.addSource("me", { type: "geojson", data: EMPTY_FC });
      map.addSource("msg", { type: "geojson", data: EMPTY_FC });

      // Meteosat: pikseli 15-25 km² olduğu için nokta değil ALAN olarak
      // çizilir — kullanıcı konumun kaba olduğunu görsel olarak anlamalı.
      map.addLayer(
        {
          id: "msg-area",
          type: "circle",
          source: "msg",
          paint: {
            "circle-radius": [
              "interpolate", ["exponential", 2], ["zoom"],
              5, ["*", 1.1, ["sqrt", ["get", "pixelKm2"]]],
              10, ["*", 26, ["sqrt", ["get", "pixelKm2"]]],
            ],
            "circle-color": "#f59e0b",
            "circle-opacity": 0.12,
            "circle-stroke-color": "#f59e0b",
            "circle-stroke-width": 1,
            "circle-stroke-opacity": 0.5,
          },
        },
        labelTop
      );
      map.addLayer(
        {
          id: "msg-dot",
          type: "circle",
          source: "msg",
          paint: {
            "circle-radius": 3,
            "circle-color": "#fbbf24",
            "circle-stroke-color": "#0a0a0b",
            "circle-stroke-width": 1,
          },
        },
        labelTop
      );

      map.addLayer({
        id: "fires-heat",
        type: "heatmap",
        source: "fires",
        maxzoom: 11,
        paint: {
          "heatmap-weight": ["min", 1, ["/", ["sqrt", ["max", 0.5, ["get", "frp"]]], 12]],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 9, 1.6],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 14, 10, 34],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.55, 10.5, 0],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.2, "rgba(124,45,18,0.4)",
            0.5, "rgba(194,65,12,0.6)",
            0.8, "rgba(249,115,22,0.8)",
            1, "rgba(253,186,116,0.9)",
          ],
        },
      }, labelTop);

      map.addLayer({
        id: "cone-fills",
        type: "fill",
        source: "cones",
        paint: {
          "fill-color": "#3d5bff",
          "fill-opacity": ["match", ["get", "hours"], 1, 0.2, 3, 0.12, 6, 0.06, 0.1],
        },
      }, labelTop);
      map.addLayer({
        id: "cone-borders",
        type: "line",
        source: "cones",
        paint: { "line-color": "#5872ff", "line-width": 0.8, "line-opacity": 0.45 },
      }, labelTop);
      map.addLayer({
        id: "cone-center",
        type: "line",
        source: "cone-lines",
        paint: {
          "line-color": "#8fa2ff",
          "line-width": 1.2,
          "line-opacity": 0.85,
          "line-dasharray": [1.5, 1.8],
        },
      }, labelTop);

      // Yön oku: erişim şekli baş yönünde 2,4 kat uzun ama bu tek başına
      // yeterince okunmuyordu — ucundaki ok "nereye gidebilir"i tartışmasız
      // hale getiriyor. ">" ASCII: "▶" basemap glyph setinde yok (iz oklarında
      // öğrenilen ders).
      map.addLayer({
        id: "cone-arrow",
        type: "symbol",
        source: "cone-lines",
        layout: {
          "symbol-placement": "line-center",
          "text-field": ">",
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 20,
          "text-offset": [0.6, 0],
          "text-rotation-alignment": "map",
          "text-keep-upright": false,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#b9c6ff",
          "text-halo-color": "#0a0a0b",
          "text-halo-width": 1.4,
        },
      }, labelTop);

      // ── Seçili yangının GEÇMİŞİ
      // "Nereye gidecek" kadar "nereden geldi" de okunmalı. Katman sırası
      // arkadan öne: yanmış alan → yol → oklar → geçiş halkaları → başlangıç.

      // Yanmış alan: olayın o ana kadarki tüm tespitleri, kor rengi
      map.addLayer({
        id: "burned-area",
        type: "circle",
        source: "burned",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            5, 3.5,
            9, 9,
            12, 20,
          ],
          "circle-color": "#7f1d1d",
          "circle-opacity": 0.5,
          "circle-blur": 0.45,
        },
      }, labelTop);

      map.addLayer({
        id: "trail-line",
        type: "line",
        source: "trail",
        filter: ["==", ["get", "kind"], "line"],
        paint: {
          "line-color": "#fde68a",
          "line-width": 2,
          "line-opacity": 0.85,
        },
      }, labelTop);

      // Yol üzerinde yön okları — hangi yöne yürüdüğü tek bakışta
      map.addLayer({
        id: "trail-arrows",
        type: "symbol",
        source: "trail",
        filter: ["==", ["get", "kind"], "line"],
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 60,
          // "▶" basemap glyph setinde yok — hiç çizilmiyordu.
          // ASCII ">" her fontta var ve aynı işi görüyor.
          "text-field": ">",
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 16,
          "text-rotation-alignment": "map",
          "text-keep-upright": false,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#fde68a",
          "text-halo-color": "#0a0a0b",
          "text-halo-width": 1.2,
        },
      }, labelTop);

      map.addLayer({
        id: "trail-passes",
        type: "circle",
        source: "trail",
        filter: ["==", ["get", "kind"], "pass"],
        paint: {
          "circle-radius": ["+", 3, ["*", 4, ["get", "order"]]],
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#fde68a",
          "circle-stroke-width": 1.6,
          "circle-stroke-opacity": ["+", 0.4, ["*", 0.6, ["get", "order"]]],
        },
      }, labelTop);

      // Geçiş saatleri — ilerlemenin ne kadar sürdüğü okunsun
      map.addLayer({
        id: "trail-times",
        type: "symbol",
        source: "trail",
        filter: ["==", ["get", "kind"], "pass"],
        minzoom: 7.5,
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-size": 10,
          "text-offset": [0, -1.4],
          "text-anchor": "bottom",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#fde68a",
          "text-halo-color": "#0a0a0b",
          "text-halo-width": 1.4,
        },
      }, labelTop);

      // Başlangıç noktası — yangının çıktığı yer
      map.addLayer({
        id: "trail-start",
        type: "circle",
        source: "trail",
        filter: ["==", ["get", "kind"], "start"],
        paint: {
          "circle-radius": 7,
          "circle-color": "#0a0a0b",
          "circle-stroke-color": "#fde68a",
          "circle-stroke-width": 2.5,
        },
      }, labelTop);
      map.addLayer({
        id: "trail-start-label",
        type: "symbol",
        source: "trail",
        filter: ["==", ["get", "kind"], "start"],
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-size": 10,
          "text-offset": [0, 1.5],
          "text-anchor": "top",
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#fde68a",
          "text-halo-color": "#0a0a0b",
          "text-halo-width": 1.4,
        },
      }, labelTop);

      map.addLayer({
        id: "fires-pulse",
        type: "circle",
        source: "fires",
        paint: {
          "circle-radius": R_EXPR,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#fdba74",
          "circle-stroke-width": 1.4,
          "circle-stroke-opacity": 0,
        },
      }, labelTop);

      map.addLayer({
        id: "fires-circles",
        type: "circle",
        source: "fires",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            4, ["*", 0.65, R_EXPR],
            8, R_EXPR,
            11, ["*", 1.7, R_EXPR],
          ],
          "circle-color": FIRE_COLOR,
          "circle-stroke-color": "#000000",
          "circle-stroke-width": 0.6,
          "circle-stroke-opacity": 0.5,
        },
      }, labelTop);

      map.addLayer({
        id: "fires-selected",
        type: "circle",
        source: "fires",
        filter: ["==", ["get", "eventId"], "__none__"],
        paint: {
          "circle-radius": ["+", 3.5, R_EXPR],
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#fafafa",
          "circle-stroke-width": 1.1,
          "circle-stroke-opacity": 0.9,
        },
      }, labelTop);

      // Kullanıcının konumu — etiketlerin de üstünde, her zaman görünür
      map.addLayer({
        id: "me-accuracy",
        type: "circle",
        source: "me",
        paint: {
          "circle-radius": ["get", "rpx"],
          "circle-color": "#3d5bff",
          "circle-opacity": 0.12,
          "circle-stroke-color": "#3d5bff",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "me-dot",
        type: "circle",
        source: "me",
        paint: {
          "circle-radius": 6,
          "circle-color": "#5872ff",
          "circle-stroke-color": "#fafafa",
          "circle-stroke-width": 2,
        },
      });

      map.on("click", "fires-circles", (e: MapMouseEvent) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ["fires-circles"] })[0];
        const id = f?.properties?.eventId;
        if (typeof id === "string") onSelectRef.current(id);
      });
      map.on("click", (e: MapMouseEvent) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ["fires-circles"] });
        if (hits.length === 0) onSelectRef.current(null);
      });
      map.on("mouseenter", "fires-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "fires-circles", () => {
        map.getCanvas().style.cursor = "";
      });

      const emitCenter = () => {
        const c = map.getCenter();
        onCenterRef.current?.({ lon: c.lng, lat: c.lat });
        onZoomRef.current?.(map.getZoom());
      };
      emitCenter();
      map.on("moveend", emitCenter);

      windRef.current = new WindParticleLayer(map, containerRef.current!);
      setReady(true);
    });

    return () => {
      windRef.current?.destroy();
      windRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // ── Veri güncellemeleri
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("fires") as GeoJSONSource | undefined)?.setData(mapFC);
  }, [ready, mapFC]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("cones") as GeoJSONSource | undefined)?.setData(
      layers.cones && live ? conesFC : EMPTY_FC
    );
    (map.getSource("cone-lines") as GeoJSONSource | undefined)?.setData(
      layers.cones && live ? coneLinesFC : EMPTY_FC
    );
  }, [ready, conesFC, coneLinesFC, layers.cones, live]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("trail") as GeoJSONSource | undefined)?.setData(trailFC);
    (map.getSource("burned") as GeoJSONSource | undefined)?.setData(burnedFC);
  }, [ready, trailFC, burnedFC]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("msg") as GeoJSONSource | undefined)?.setData(
      layers.msg && live ? msgFC : EMPTY_FC
    );
  }, [ready, msgFC, layers.msg, live]);

  // ── Zaman filtresi + yaş soldurması (kaydırıcı)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const windowMs = windowHours * 3600_000;
    const timeFilter: ExpressionSpecification = ["<=", ["get", "dt"], effT];
    const opacity: ExpressionSpecification = [
      "interpolate", ["linear"], ["get", "dt"],
      effT - windowMs, 0.3,
      Math.max(effT - windowMs + 1, effT - 6 * 3600_000), 0.65,
      effT, 0.95,
    ];
    map.setFilter("fires-circles", timeFilter);
    map.setFilter("fires-heat", timeFilter);
    map.setPaintProperty("fires-circles", "circle-opacity", opacity);
    const selFilter: ExpressionSpecification = [
      "all",
      ["<=", ["get", "dt"], effT],
      ["==", ["get", "eventId"], selectedId ?? "__none__"],
    ];
    map.setFilter("fires-selected", selFilter);
  }, [ready, effT, windowHours, selectedId]);

  // ── Taze tespit nabzı (yalnız canlı görünümde)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!live || reducedMotion) {
      map.setFilter("fires-pulse", ["==", ["get", "dt"], -1]);
      return;
    }
    let raf = 0;
    const start = performance.now();
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      // setPaintProperty her çağrıda expression'ı yeniden derletiyor;
      // 60 yerine ~20 fps nabız için yeterli ve harita akıcı kalıyor.
      if (t - last < 50) return;
      last = t;
      const phase = ((t - start) % 2000) / 2000;
      map.setPaintProperty("fires-pulse", "circle-radius", [
        "+", R_EXPR, 2 + phase * 11,
      ]);
      map.setPaintProperty("fires-pulse", "circle-stroke-opacity", 0.5 * (1 - phase));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // effT bağımlılığa girmez: canlı modda 30 sn'de bir değişip animasyonu
    // baştan başlatıyor ve nabız gözle görülür şekilde zıplıyordu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, live, reducedMotion]);

  // Nabız filtresi (taze tespitler) ayrı effect'te — animasyonu sıfırlamadan
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !live || reducedMotion) return;
    map.setFilter("fires-pulse", [">=", ["get", "dt"], effT - 6 * 3600_000]);
  }, [ready, live, effT, reducedMotion]);

  // ── Katman görünürlükleri
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setLayoutProperty("sat", "visibility", layers.satellite ? "visible" : "none");
    map.setLayoutProperty("fires-heat", "visibility", layers.heat ? "visible" : "none");
    map.setLayoutProperty("burnt", "visibility", layers.burnt ? "visible" : "none");
    map.setLayoutProperty("danger", "visibility", layers.danger ? "visible" : "none");
  }, [ready, layers.satellite, layers.heat, layers.burnt, layers.danger]);

  // ── Rüzgar partikülleri
  useEffect(() => {
    if (!ready) return;
    const wind = windRef.current;
    if (!wind) return;
    wind.setGrid(windGrid ?? null);
    wind.setEnabled(Boolean(layers.wind && windGrid && !reducedMotion));
  }, [ready, windGrid, layers.wind, reducedMotion]);

  // ── Kullanıcı konumu (doğruluk halkası zoom'a göre metre → piksel)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const src = map.getSource("me") as GeoJSONSource | undefined;
    if (!src) return;
    if (!userLoc) {
      src.setData(EMPTY_FC);
      return;
    }
    const render = () => {
      const mPerPx = metersPerPixel(userLoc.lat, map.getZoom());
      src.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [userLoc.lon, userLoc.lat] },
            properties: {
              rpx: Math.max(8, Math.min(140, userLoc.accuracy / mPerPx)),
            },
          },
        ],
      });
    };
    render();
    map.on("zoomend", render);
    return () => {
      map.off("zoomend", render);
    };
  }, [ready, userLoc]);

  // ── Seçime uçuş
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !flyTarget) return;
    const isDesktop = window.innerWidth >= 768;
    map.easeTo({
      center: [flyTarget.lon, flyTarget.lat],
      zoom: Math.max(map.getZoom(), 9),
      padding: isDesktop
        ? { left: 360, top: 60, right: 40, bottom: 80 }
        : { left: 20, top: 60, right: 20, bottom: 260 },
      // Tam ekran kamera hareketi vestibüler rahatsızlık yaratabilir
      duration: reducedMotion ? 0 : 700,
    });
  }, [ready, flyTarget, reducedMotion]);

  // Dış sarmalayıcı konumu verir; MapLibre kendi container'ına
  // position:relative bastığı için harita div'i yüzdeyle doldurulur.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      {styleFailed && !ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
          <p className="max-w-[300px] text-center text-xs leading-relaxed text-ink-2">
            Harita altlığı yüklenemedi. Yangın listesi ve uyarılar çalışmaya
            devam ediyor; bağlantı düzelince harita kendiliğinden gelir.
          </p>
        </div>
      )}
    </div>
  );
}
