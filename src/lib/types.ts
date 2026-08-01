export interface FirePoint {
  id: string;
  lon: number;
  lat: number;
  /** Fire Radiative Power, MW */
  frp: number;
  /** normalize güven: l | n | h */
  conf: "l" | "n" | "h";
  sat: string;
  /** tespit zamanı, epoch ms (UTC) */
  dt: number;
  dn: "D" | "N";
}

export interface FiresMeta {
  demo: boolean;
  fetchedAt: number;
  newest: number | null;
  windowHours: number;
  sourcesOk: number;
  sourcesTotal: number;
}

export interface FiresResponse {
  type: "FeatureCollection";
  features: GeoJSON.Feature<GeoJSON.Point, FirePointProps>[];
  meta: FiresMeta;
}

export interface FirePointProps {
  id: string;
  frp: number;
  conf: "l" | "n" | "h";
  sat: string;
  dt: number;
  dn: "D" | "N";
}

export interface PassGroup {
  /** geçişin temsili zamanı (medyan), epoch ms */
  t: number;
  lon: number;
  lat: number;
  /** geçişteki toplam FRP */
  frp: number;
  count: number;
}

export interface Drift {
  bearingDeg: number;
  km: number;
  kmh: number;
  /** ölçümün kapsadığı süre (ilk → son geçiş), ms */
  spanMs: number;
}

export interface FireEvent {
  id: string;
  /** son geçiş centroid'i */
  lon: number;
  lat: number;
  place: string;
  /** Türkiye dışında (komşu ülke) — listede geri sıraya alınır */
  abroad: boolean;
  firstSeen: number;
  lastSeen: number;
  count: number;
  /** son geçişteki toplam FRP */
  frpLast: number;
  frpMax: number;
  passes: PassGroup[];
  drift: Drift | null;
  /** son geçişe ait noktalar (öncü kenar hesabı için) */
  lastPassPoints: { lon: number; lat: number }[];
  status: "active" | "waning" | "old";
}

export interface WindGrid {
  lon0: number;
  lat0: number;
  dLon: number;
  dLat: number;
  nx: number;
  ny: number;
  /** m/s, row-major (satır = lat, güneyden kuzeye). null = veri alınamadı. */
  u: (number | null)[];
  v: (number | null)[];
  time: number;
  /** gözlem saati (Open-Meteo current.time, UTC) — tazelik göstergesi */
  obsTime: string | null;
  failedChunks: number;
  totalChunks: number;
}

export interface WindPoint {
  tempC: number | null;
  rh: number | null;
  windKmh: number | null;
  windDirDeg: number | null;
  gustKmh: number | null;
  vpdKpa: number | null;
  /** duman göstergesi — CAMS tabanlı yüzey konsantrasyonu, µg/m³ */
  pm25: number | null;
  pm10: number | null;
  aqi: number | null;
  /** arazi — yangın yamaç yukarı hızlanır, rüzgârdan bağımsız */
  terrain: {
    elevM: number;
    /** yüzde eğim */
    slopePct: number;
    /** yokuş yukarı yön (derece) — alevlerin tırmanacağı yön */
    upslopeDeg: number;
  } | null;
  /** yakıt kuruluğu özeti (Kanada FWI) */
  fwi: {
    ffmc: number;
    dmc: number;
    dc: number;
    isi: number;
    bui: number;
    fwi: number;
    label: string;
    level: 0 | 1 | 2 | 3 | 4 | 5;
    days: number;
  } | null;
  time: number;
}

export type WindowHours = 24 | 48 | 168;

export interface UserLocation {
  lon: number;
  lat: number;
  /** yatay doğruluk, metre */
  accuracy: number;
  at: number;
}

export type GeoState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; loc: UserLocation }
  | { status: "denied" }
  | { status: "error"; message: string };

export interface LayerToggles {
  wind: boolean;
  heat: boolean;
  cones: boolean;
  satellite: boolean;
  /** EFFIS yanan alan poligonları (Sentinel-2 tabanlı, günde 2 kez) */
  burnt: boolean;
  /** GWIS yangın tehlike tahmini (FWI) */
  danger: boolean;
}
