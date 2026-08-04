import { REGION_BBOX, inRegion } from "./bbox";

/**
 * Sentinel-3 SLSTR — Fire Radiative Power (NRT).
 *
 * VIIRS'in yerini ALMAZ, arasını doldurur: piksel 1 km (VIIRS 375 m), ama
 * bağımsız yörünge ve günde ~4 ek geçiş. Gecikme ölçüldü (4 Ağu 2026):
 * tarama bitişinden yayına **110 dakika** — MTG'den (≈17 dk) yavaş, VIIRS
 * NRT'den (1-8 sa) hızlı. Yani "kör aralığı MTG gibi kapatan" bir kaynak
 * değil, keskin katmanda ekstra bir geçiş.
 *
 * 🔑 Ürün `.SEN3` = zip, içinde hem NetCDF hem **CSV** var ve Data Store
 * tek dosya indirmeye izin veriyor: 1,45 MB'lık granül yerine 1,7 KB'lık
 * CSV çekiliyor (~850 kat). NetCDF ayrıştırıcısına hiç gerek kalmadı —
 * MTG'de yaşanan sürprizin aynısı.
 */

const TOKEN_URL = "https://api.eumetsat.int/token";
const ARAMA_URL = "https://api.eumetsat.int/data/search-products/os";
const INDIR_URL = "https://api.eumetsat.int/data/download/1.0.0/collections";

/** Ölçüldü: 0207 diye bir arama koleksiyonu YOK (404). Doğrusu bu. */
export const S3_COLLECTION = "EO:EUM:DAT:0417";

/**
 * Üç şema var; **standard** asıl olan.
 * `alternative` aynı piksel için farklı FRP veriyor (17,1 vs 13,2 MW) —
 * ikisini birleştirmek aynı yangını iki kez saymak olurdu.
 * `SWIR500m` yalnız çok sıcak/küçük yangınları görüyor (örnek granülde 0).
 */
const SEMA = "FRP_MWIR1km_standard.csv";

export interface S3Fire {
  lon: number;
  lat: number;
  /** MW */
  frp: number;
  /** FRP'nin hata payı (MW) — FIRMS bunu vermiyor, S3 veriyor */
  frpErr: number;
  /** güven yüzdesi (0-100), FIRMS'in l/n/h'sinden ince */
  conf: number;
  /** piksel ayak izi, km — FIRMS scan/track karşılığı */
  actrack: number;
  altrack: number;
  dn: "D" | "N";
  /** S3A / S3B */
  sat: string;
  dt: number;
}

/**
 * CSV → tespitler. Saf: ağ yok, ortam değişkeni yok, test edilebilir.
 *
 * Başlıkta `#` ile başlayan meta satırları var; sütun satırı ilk `#`
 * olmayan satır. Sütun adları birim taşıyor (`lat(deg)`, `FRP(MW)`),
 * bu yüzden parantezden önceki kısma göre eşleştiriliyor — EUMETSAT
 * birimi değiştirirse ayrıştırıcı sessizce boş dönmesin.
 */
export function parseFrpCsv(text: string): S3Fire[] {
  const satir = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"));
  if (satir.length < 2) return [];

  const kok = (s: string) => s.split("(")[0].trim().toLowerCase();
  const basliklar = satir[0].split(",").map(kok);
  const idx = (ad: string) => basliklar.indexOf(ad.toLowerCase());

  const iLat = idx("lat");
  const iLon = idx("lon");
  const iGun = idx("day");
  const iSaat = idx("time");
  const iDn = idx("d/n");
  const iFrp = idx("frp");
  const iErr = idx("frperr");
  const iConf = idx("confidence");
  const iAc = idx("actrack");
  const iAl = idx("altrack");
  const iSat = idx("satellite");
  if (iLat < 0 || iLon < 0 || iGun < 0 || iSaat < 0) return [];

  const sayi = (c: string[], i: number, varsayilan = 0) => {
    if (i < 0) return varsayilan;
    const v = parseFloat(c[i]);
    return Number.isFinite(v) ? v : varsayilan;
  };

  const out: S3Fire[] = [];
  for (let i = 1; i < satir.length; i++) {
    const c = satir[i].split(",");
    const lat = parseFloat(c[iLat]);
    const lon = parseFloat(c[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    // Granül kutuyla KESİŞENİ döndürüyor; içeriği kutuda olmayabilir
    // (örnek granül Sicilya'daydı). Süzgeç burada, kaynağın dibinde.
    if (!inRegion(lon, lat)) continue;

    const dt = Date.parse(`${c[iGun]}T${c[iSaat]}Z`);
    if (!Number.isFinite(dt)) continue;

    out.push({
      lon,
      lat,
      frp: Math.max(0, sayi(c, iFrp)),
      frpErr: Math.max(0, sayi(c, iErr)),
      conf: sayi(c, iConf, 100),
      actrack: sayi(c, iAc, 1),
      altrack: sayi(c, iAl, 1),
      dn: (c[iDn] ?? "D").trim().toUpperCase() === "N" ? "N" : "D",
      sat: (c[iSat] ?? "S3").trim(),
      dt,
    });
  }
  return out;
}

/* ── Ağ katmanı ── */

let tokenOnbellek: { deger: string; biter: number } | null = null;

/**
 * Erişim jetonu. Ömrü ~58 dk; süre dolmadan 60 sn önce yenileniyor.
 * ⚠️ Token ucu geçici olarak **503** verebiliyor (canlıda görüldü) —
 * üç deneme, artan bekleme.
 */
export async function getToken(): Promise<string | null> {
  const key = process.env.EUMETSAT_KEY;
  const secret = process.env.EUMETSAT_SECRET;
  if (!key || !secret) return null;

  if (tokenOnbellek && Date.now() < tokenOnbellek.biter) return tokenOnbellek.deger;

  const basic = Buffer.from(`${key}:${secret}`).toString("base64");
  for (let deneme = 0; deneme < 3; deneme++) {
    try {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        cache: "no-store",
      });
      if (res.ok) {
        const j = (await res.json()) as { access_token: string; expires_in: number };
        tokenOnbellek = {
          deger: j.access_token,
          biter: Date.now() + Math.max(60, j.expires_in - 60) * 1000,
        };
        return j.access_token;
      }
    } catch {
      /* aşağıda tekrar denenecek */
    }
    await new Promise((r) => setTimeout(r, 400 * (deneme + 1)));
  }
  return null;
}

interface Granul {
  id: string;
  /** tarama bitişi */
  bitis: number;
}

/** Kutuyla kesişen granüller, yeniden eskiye. */
export async function searchGranules(
  token: string,
  hoursBack: number,
  limit = 12
): Promise<Granul[]> {
  const simdi = Date.now();
  const iso = (t: number) => new Date(t).toISOString().slice(0, 19) + "Z";
  const url =
    `${ARAMA_URL}?format=json&pi=${encodeURIComponent(S3_COLLECTION)}` +
    `&dtstart=${iso(simdi - hoursBack * 3600_000)}&dtend=${iso(simdi)}` +
    `&bbox=${REGION_BBOX}&si=0&c=${limit}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 600 },
  });
  if (!res.ok) return [];

  const j = (await res.json()) as {
    features?: { id: string; properties?: { date?: string } }[];
  };
  const out: Granul[] = [];
  for (const f of j.features ?? []) {
    if (!f.id) continue;
    const bitisStr = f.properties?.date?.split("/")?.[1];
    out.push({ id: f.id, bitis: bitisStr ? Date.parse(bitisStr) : 0 });
  }
  return out.sort((a, b) => b.bitis - a.bitis);
}

/** Granülün yalnız CSV'sini çeker (tam zip'i değil). */
export async function fetchGranuleCsv(
  token: string,
  id: string
): Promise<S3Fire[]> {
  const url =
    `${INDIR_URL}/${encodeURIComponent(S3_COLLECTION)}/products/${encodeURIComponent(id)}` +
    `/entry?name=${encodeURIComponent(`${id}/${SEMA}`)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return parseFrpCsv(await res.text());
  } catch {
    return [];
  }
}

export interface S3Sonuc {
  fires: S3Fire[];
  granul: number;
  /** en yeni tespitin zamanı */
  newest: number | null;
}

/**
 * Son `hoursBack` saatteki tespitler.
 *
 * Granüller SIRAYLA çekiliyor, paralel değil: Open-Meteo'da paralel istek
 * limite takılıp veriyi sessizce yarım bırakmıştı ([[reference_open_meteo_limitleri]]
 * dersinin kardeşi). Burada hacim küçük (granül başına ~2 KB), sıra yeterli.
 */
export async function fetchLatest(hoursBack = 12): Promise<S3Sonuc | null> {
  const token = await getToken();
  if (!token) return null;

  const granuller = await searchGranules(token, hoursBack);
  if (granuller.length === 0) return { fires: [], granul: 0, newest: null };

  const hepsi: S3Fire[] = [];
  for (const g of granuller) hepsi.push(...(await fetchGranuleCsv(token, g.id)));

  // Aynı piksel iki granülün örtüştüğü şeritte iki kez gelebilir.
  const gorulen = new Set<string>();
  const fires: S3Fire[] = [];
  for (const f of hepsi) {
    const k = `${f.lat.toFixed(4)}:${f.lon.toFixed(4)}:${f.dt}`;
    if (gorulen.has(k)) continue;
    gorulen.add(k);
    fires.push(f);
  }

  return {
    fires,
    granul: granuller.length,
    newest: fires.length ? Math.max(...fires.map((f) => f.dt)) : null,
  };
}
