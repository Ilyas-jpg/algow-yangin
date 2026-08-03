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
  /** İngilizce ad ve özet — arşiv kaydının metni yalnız indekste çevrili
   *  tutuluyor; 362 KB'lik tespit dosyalarının ikinci bir kopyası yok. */
  adEn?: string;
  ozetEn?: string;
  ilk: number;
  son: number;
  tespit: number;
  maxFrp: number;
  /**
   * Kaydı üreten uydular. Kaynak atfı buradan türetiliyor: Bayramiç kaydı
   * tümüyle Meteosat'tan kuruldu ve NASA FIRMS'te hiç izi yok — sabit
   * "FIRMS arşivi" metni orada yanlış bir kaynak iddiası olurdu.
   */
  sats?: string[];
}

/** Kayıt yalnız jeostasyoner Meteosat tespitlerinden mi kuruldu? */
export function isMtgOnly(sats: string[] | undefined): boolean {
  return sats?.length === 1 && sats[0] === "MTG";
}

/** Kaydın açık dildeki adı ve özeti; İngilizcesi yoksa Türkçesine düşer. */
export function archiveText(
  k: ArchiveIndexItem,
  locale: "tr" | "en"
): { ad: string; ozet: string } {
  if (locale === "en") {
    return { ad: k.adEn ?? k.ad, ozet: k.ozetEn ?? k.ozet };
  }
  return { ad: k.ad, ozet: k.ozet };
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
