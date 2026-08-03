import { havKm } from "./geo";

/**
 * Yangın söndürme hava araçlarının ADS-B takibi.
 *
 * Kaynak: api.airplanes.live — ücretsiz, anahtarsız, gönüllü alıcı ağı.
 * Uçağın TİP kodunu (`t`) ve TESCİLİNİ (`r`) doğrudan veriyor; OpenSky
 * bunu vermediği için elenmişti (metadata API'si HTTP 410).
 *
 * ── Neden iki kova var ──────────────────────────────────────────────────────
 * İlk ölçümde (3 Ağustos 2026, Atina yangını) tip listesine `DH8D` koymuştum:
 * Dash 8 gerçekten tanker olarak kullanılıyor. Besleme 18.000 ft'te seyreden
 * bir 9H-MATI döndürdü — sıradan bir yolcu seferi. Yani "tip = söndürme
 * uçağı" varsayımı tek başına yanlış pozitif üretiyor.
 *
 * Bu yüzden tipler ikiye ayrıldı:
 *  • ÖZEL tipler (S-64, CL-215/415, AT-802, Dromader, Ka-32): sivil havacılıkta
 *    pratikte başka işte kullanılmıyor → tek başına yeter.
 *  • ÇİFT KULLANIMLI tipler (Bell/Mil/Super Puma sınıfı helikopterler): aynı
 *    gövde ambulans, kargo ya da turist uçuşu da olabilir → yalnız yangının
 *    dibinde, alçak ve yavaşken sayılır, o zaman bile "muhtemel" denir.
 *
 * Hiçbir durumda "bu uçak yangına müdahale ediyor" diye KESİN konuşmuyoruz:
 * elimizdeki veri tip + konum, görev bildirimi değil.
 */

/** Sivil havacılıkta pratikte yalnız yangın söndürmede kullanılan tipler */
const OZEL_TIP =
  /^(S64|CL2|CL4|CL21|CL41|AT8|A802|AT5|PZL|M18|KA32|BE12|B461|B462|B463)/i;

/**
 * Döner kanat (helikopter) tipleri — haritada uçaktan AYRI ikon alıyorlar.
 * Aynı yangında Skycrane de AT-802 de dönüyor; ikisini aynı silüetle
 * çizmek "havada ne var" sorusunun cevabını siliyordu.
 */
const DONER_KANAT =
  /^(S64|KA32|KA27|MI8|MI17|MI26|B212|B214|B412|B205|B206|B407|B429|AS32|AS3B|EC25|EC13|EC17|H215|H225|S70|H60|UH1|AW139|A139|BK17|H500|K126|R44|R66|EC35|H135|H145)/i;

export function kanatTipi(tip: string): "doner" | "sabit" {
  return DONER_KANAT.test(tip) ? "doner" : "sabit";
}

/**
 * Söndürmede kullanılan ama başka işte de uçan gövdeler.
 * Yangın karinesi için yakınlık + alçaklık + yavaşlık şartı aranır.
 */
const CIFT_KULLANIM =
  /^(B212|B214|B412|B205|B206|B407|B429|MI8|MI17|MI26|AS32|AS3B|EC25|H215|H225|S70|H60|UH1|AW139|A139|BK17|H500|K126)/i;

/** Çift kullanımlı gövde için yangın karinesi eşikleri */
export const CIFT_MAX_KM = 15;
export const CIFT_MAX_FT = 6000;
export const CIFT_MAX_KT = 160;

/** Bu uzaklıktan öteye düşen hava aracı gösterilmez (transit trafiği) */
export const KAPSAM_KM = 80;

/** Bu irtifanın altı "alçak uçuş" — su alma/atma turu bu bantta geçiyor */
export const CALISMA_TAVANI_FT = 5000;

/** airplanes.live `ac` kaydının kullandığımız alanları */
export interface AdsbRaw {
  hex?: string;
  /** tescil, ör. "N154AC" */
  r?: string;
  /** ICAO tip kodu, ör. "S64" */
  t?: string;
  /** uzun tip adı, ör. "SIKORSKY S-64 Skycrane" */
  desc?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  /** ft ya da yerdeyse "ground" */
  alt_baro?: number | string;
  /** yer hızı, knot */
  gs?: number;
  /** rota, derece */
  track?: number;
  /** kaydın yaşı, saniye */
  seen?: number;
}

export interface Aircraft {
  hex: string;
  tescil: string | null;
  tip: string | null;
  tipAdi: string | null;
  lon: number;
  lat: number;
  /** ft; yerdeyse 0 */
  altFt: number | null;
  yerde: boolean;
  hizKt: number | null;
  rota: number | null;
  /** en yakın yangın kümesine uzaklık, km */
  yanginKm: number | null;
  /**
   * `ozel`  — tipi zaten söndürme uçağı
   * `muhtemel` — çift kullanımlı gövde, yangının dibinde alçak uçuyor
   */
  sinif: "ozel" | "muhtemel";
  /** Haritada helikopter mi uçak mı çizileceği */
  kanat: "doner" | "sabit";
  /** alçak uçuş bandında mı — su alma/atma turu göstergesi */
  alcak: boolean;
  /** kaydın yaşı, saniye */
  yasSn: number | null;
}

export interface FireCenter {
  lon: number;
  lat: number;
  frp: number;
}

/**
 * Tespitleri kaba hücrelerde toplayıp en güçlü yangın merkezlerini çıkarır.
 * ADS-B sorgusu bunların çevresine atılıyor — tüm bölgeyi taramak hem
 * gereksiz veri hem gereksiz upstream yükü.
 */
export function fireCenters(
  points: { lon: number; lat: number; frp: number }[],
  limit = 6
): FireCenter[] {
  const cells = new Map<string, { lon: number; lat: number; n: number; frp: number }>();
  for (const p of points) {
    const k = `${Math.round(p.lon * 20)}:${Math.round(p.lat * 20)}`;
    const c = cells.get(k) ?? { lon: 0, lat: 0, n: 0, frp: 0 };
    c.lon += p.lon;
    c.lat += p.lat;
    c.n++;
    c.frp += p.frp;
    cells.set(k, c);
  }
  const merkezler = [...cells.values()]
    // Tek tespit gürültü olabilir; hava müdahalesi gerektiren yangın
    // birden çok piksel üretir.
    .filter((c) => c.n >= 3)
    .map((c) => ({ lon: c.lon / c.n, lat: c.lat / c.n, frp: c.frp }))
    .sort((a, b) => b.frp - a.frp);

  // Birbirine yakın kümeler tek sorguya düşsün: 100 km yarıçaplı bir
  // sorgu zaten komşu yangını da kapsıyor, ikinci istek boşuna olurdu.
  const secili: FireCenter[] = [];
  for (const m of merkezler) {
    if (secili.length >= limit) break;
    if (secili.some((s) => havKm(s.lon, s.lat, m.lon, m.lat) < 100)) continue;
    secili.push(m);
  }
  return secili;
}

function altToFt(alt: AdsbRaw["alt_baro"]): { ft: number | null; yerde: boolean } {
  if (alt === "ground") return { ft: 0, yerde: true };
  if (typeof alt === "number" && isFinite(alt)) return { ft: alt, yerde: false };
  return { ft: null, yerde: false };
}

/**
 * Ham ADS-B kayıtlarını söndürme hava aracı listesine indirger.
 * Aynı uçak birden çok sorgudan gelebilir — `hex` ile tekilleştirilir.
 */
export function classifyAircraft(
  raw: AdsbRaw[],
  fires: FireCenter[]
): Aircraft[] {
  const out = new Map<string, Aircraft>();

  for (const a of raw) {
    if (!a.hex || typeof a.lat !== "number" || typeof a.lon !== "number") continue;
    const tip = (a.t ?? "").trim();
    if (!tip) continue;

    let yanginKm: number | null = null;
    for (const f of fires) {
      const km = havKm(a.lon, a.lat, f.lon, f.lat);
      if (yanginKm === null || km < yanginKm) yanginKm = km;
    }
    if (yanginKm === null || yanginKm > KAPSAM_KM) continue;

    const { ft, yerde } = altToFt(a.alt_baro);
    const hiz = typeof a.gs === "number" ? a.gs : null;

    let sinif: Aircraft["sinif"] | null = null;
    if (OZEL_TIP.test(tip)) {
      sinif = "ozel";
    } else if (CIFT_KULLANIM.test(tip)) {
      // Çift kullanımlı gövde: yangının dibinde, alçak ve yavaş olmalı.
      // Bilinmeyen irtifa/hız karine SAYILMAZ — eksik veriyi lehte yorumlamak
      // sıradan bir ambulans helikopterini söndürme uçağı gösterirdi.
      const yakin = yanginKm <= CIFT_MAX_KM;
      const alcakUcus = ft !== null && ft <= CIFT_MAX_FT;
      const yavas = hiz !== null && hiz <= CIFT_MAX_KT;
      if (yakin && alcakUcus && yavas) sinif = "muhtemel";
    }
    if (!sinif) continue;

    const kayit: Aircraft = {
      hex: a.hex,
      tescil: a.r?.trim() || null,
      tip,
      tipAdi: a.desc?.trim() || null,
      lon: a.lon,
      lat: a.lat,
      altFt: ft,
      yerde,
      hizKt: hiz,
      rota: typeof a.track === "number" ? a.track : null,
      yanginKm: Math.round(yanginKm * 10) / 10,
      sinif,
      kanat: kanatTipi(tip),
      alcak: ft !== null && !yerde && ft <= CALISMA_TAVANI_FT,
      yasSn: typeof a.seen === "number" ? Math.round(a.seen) : null,
    };

    // Aynı uçak iki sorgudan geldiyse yangına daha yakın olan kaydı tut
    const varOlan = out.get(a.hex);
    if (!varOlan || (varOlan.yanginKm ?? 1e9) > (kayit.yanginKm ?? 1e9)) {
      out.set(a.hex, kayit);
    }
  }

  return [...out.values()].sort(
    (a, b) => (a.yanginKm ?? 1e9) - (b.yanginKm ?? 1e9)
  );
}
