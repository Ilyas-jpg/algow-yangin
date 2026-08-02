import type { FirePoint } from "./types";

/**
 * Arşiv kaydı — FIRMS SP verisinden pişirilmiş statik dosya.
 * Sütunlu biçim bilinçli: GeoJSON'a göre ~3 kat küçük, 9 bin tespitli
 * Manavgat kaydı 362 KB'de kalıyor.
 */
export interface ArchiveFire {
  slug: string;
  ad: string;
  il: string;
  ozet: string;
  center: [number, number];
  ilk: number;
  son: number;
  sats: string[];
  /** [lon, lat, frp, dt, satIdx, gece] */
  pts: [number, number, number, number, number, number][];
}

export interface ArchiveIndexItem {
  slug: string;
  ad: string;
  il: string;
  ozet: string;
  ilk: number;
  son: number;
  tespit: number;
  maxFrp: number;
}

/** Sütunlu kayıt → uygulamanın her yerinde kullanılan FirePoint. */
export function expandArchive(a: ArchiveFire): FirePoint[] {
  return a.pts.map((p, i) => ({
    id: String(i),
    lon: p[0],
    lat: p[1],
    frp: p[2],
    dt: p[3],
    sat: a.sats[p[4]] ?? "?",
    dn: p[5] === 1 ? "N" : "D",
    // SP arşivi güven alanı taşıyor ama oynatmada kullanılmıyor; kayıt
    // boyutunu şişirmemek için normal kabul ediliyor.
    conf: "n",
  }));
}
