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
  /**
   * Gruptaki EN ERKEN tespit. "İlk görülen" etiketi bunu kullanmalı.
   *
   * Kutupsal uyduda geçiş ~2 dakika sürer, medyan ile ilk arasında fark
   * yoktur. Jeostasyoner (Meteosat) veride ise tek grup saatlerce sürüyor:
   * Bayramiç kaydında 73 tespit 16:08–18:58 arasına yayılmış tek grup oldu
   * ve medyan 17:08 çıktı — arşiv haritası "İLK GÖRÜLEN 17:08" yazarken
   * gerçek ilk tespit 16:08'di, tam bir saat yanlış.
   */
  t0: number;
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
  /** En yakın merkezin ili — il sayfası filtresi ve arama için */
  il: string;
  /**
   * Burada sürekli bir ısı kaynağı var (rafineri, çelik, santral, gaz bacası).
   * Yangın değil — "aktif yangın" sayısından düşülür ama haritada kalır.
   */
  fixedSource: { days: number; certain: boolean } | null;
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
    /** EFFIS sınıfı — adı arayüz kendi dilinde yazar (bkz. i18n `fwiLevels`) */
    level: 0 | 1 | 2 | 3 | 4 | 5;
    days: number;
  } | null;
  time: number;
}

export type WindowHours = 24 | 48 | 120;

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
  /**
   * Haber ihbarları — uydunun göremediği yangınlar. Doğrulanmamış veridir,
   * yaklaşık ALAN olarak çizilir ve aktif yangın sayacına karışmaz.
   * Gerekçe ve ölçüm: `lib/news.ts`.
   */
  news: boolean;
  /**
   * Tarım (anız) ateşlerini gizle. Katman değil süzgeç ama arayüzde aynı
   * şeritte duruyor. Ölçümde vakaların yarısından çoğu anızdı; kullanıcının
   * "orman yangını var mı" sorusunu bu gürültü boğuyordu.
   */
  hideFarm: boolean;
  /** Sentinel-2 cloudless 10 m altlık (Esri'nin yıllar öncesine ait olabilen
   *  mozaiğinin yerine) */
  satellite: boolean;
  /** NASA GIBS günlük gerçek renk — dün/bugünün görüntüsü, dumanı gösterir */
  today: boolean;
  /** Terrarium DEM tabanlı tepe gölgelemesi (topoğrafya) */
  terrain: boolean;
  /** EFFIS yanan alan poligonları (Sentinel-2 tabanlı, günde 2 kez) */
  burnt: boolean;
  /** GWIS yangın tehlike tahmini (FWI) */
  danger: boolean;
  /** CAMS yüzey PM2.5 alanı — "duman nereye gidiyor" */
  smoke: boolean;
  /** Meteosat 15 dakikalık tespitler (kaba çözünürlük, kör aralığı doldurur) */
  msg: boolean;
  /**
   * Söndürme hava araçları (ADS-B). Uydu verisi DEĞİL: gönüllü alıcı ağından
   * geliyor, yayın yapmayan uçak görünmez. Aktif yangın sayacına karışmaz.
   * Gerekçe ve sınıflandırma: `lib/aircraft.ts`.
   */
  aircraft: boolean;
}

export interface AircraftResponse {
  aircraft: import("./aircraft").Aircraft[];
  /** Kaç yangın merkezinin çevresine bakıldı — 0 ise "uçak yok" DEĞİL */
  centers: number;
  scanned?: number;
  failed?: number;
  fetchedAt: number;
  /** Boş dönüşün sebebi: `fires` (yangın verisi alınamadı) / `no-fires` */
  reason?: "fires" | "no-fires";
}

export interface MsgResponse {
  type: "FeatureCollection";
  features: GeoJSON.Feature<GeoJSON.Point, {
    id: string;
    frp: number;
    conf: number;
    pixelKm2: number;
    dt: number;
  }>[];
  meta: {
    slot: number;
    count: number;
    source: string;
    /** MTG (piksel ~2 km², 10 dk) ya da yedek MSG (~20 km², 15 dk) */
    kaynak?: "MTG" | "MSG";
    araDk?: number;
  } | null;
  error?: string;
}
