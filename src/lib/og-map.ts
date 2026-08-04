import { PLACES_TR } from "@/data/places-tr";
import { havKm } from "./geo";
import type { FireEvent } from "./types";

/**
 * Paylaşım kartındaki mini bağlam haritası.
 *
 * Harita karosu ÇEKİLMİYOR: kart sunucuda saniyeler içinde üretilmeli ve
 * dış servise bağımlı olmamalı. Onun yerine elde zaten olan veriyle
 * çiziliyor — tespit noktaları, geçişten geçişe ilerleme izi ve bundled
 * `places-tr` merkezleri.
 *
 * Sınır çizgisi bilerek YOK: projede sınır geometrisi bundled değil (haritadaki
 * sınırlar Carto karolarından geliyor, sunucuda yok). Uydurma bir çizgi
 * çizmektense coğrafi bağlamı yer adı + km ölçeği veriyor.
 *
 * SVG yalnız GEOMETRİ taşır, metin taşımaz: data-URI olarak `<img>` içinde
 * rasterize ediliyor ve o aşamada font yok — `<text>` boş çıkardı. Etiketler
 * çağıran tarafta Satori metni olarak, buradan dönen piksel konumlarına
 * mutlak yerleştiriliyor.
 */

/**
 * Kutunun asgari kenarı.
 *
 * Ölçüldü (2026-08-04): 8 km'de tek geçişlik küçük bir yangında kutuya hiçbir
 * yerleşim girmiyor ve harita bomboş çıkıyordu — "bağlam haritası" bağlam
 * vermiyordu. 24 km, tespitler hâlâ okunurken çevredeki merkezi de içeri alıyor.
 */
const MIN_SPAN_KM = 24;
/** Kutunun kenarında nokta kalmasın. */
const PAD = 1.35;
/** En yakın yerleşimi içeri almak için kutu bu kadara kadar büyüyebilir. */
const MAX_YARI_KM = 45;
/** Kart ağırlaşmasın: yoğun yangınlarda nokta bulutu seyreltilir. */
const MAX_DOT = 400;

const KM_PER_DEG_LAT = 110.57;
const KM_PER_DEG_LON = 111.32;

const OLCEK_ADIM = [1, 2, 5, 10, 20, 50, 100, 200, 500];

export interface MapLabel {
  x: number;
  y: number;
  text: string;
}

export interface ContextMap {
  /** `data:image/svg+xml;base64,...` — doğrudan <img src> */
  src: string;
  /** Yerleşim adları; çağıran taraf Satori metni olarak basar. */
  labels: MapLabel[];
  /** Ölçek çubuğunun yazısı, ör. "10 km" */
  scaleText: string;
  /** Ölçek çubuğunun sol ucu ve uzunluğu (piksel) */
  scale: { x: number; y: number; w: number };
}

interface Nokta {
  lon: number;
  lat: number;
}

/** "Güzel" bir ölçek uzunluğu seç: kutunun ~dörtte biri kadar. */
function olcekSec(kmPerPx: number, genislik: number): number {
  const hedef = (genislik / 4) * kmPerPx;
  for (const adim of OLCEK_ADIM) if (adim >= hedef) return adim;
  return OLCEK_ADIM[OLCEK_ADIM.length - 1];
}

function seyrelt<T>(dizi: T[], azami: number): T[] {
  if (dizi.length <= azami) return dizi;
  const adim = dizi.length / azami;
  const cikti: T[] = [];
  for (let i = 0; i < azami; i++) cikti.push(dizi[Math.floor(i * adim)]);
  return cikti;
}

const yuvarla = (n: number) => Math.round(n * 10) / 10;

export function contextMap(
  ev: FireEvent,
  genislik: number,
  yukseklik: number
): ContextMap {
  const gecisler = ev.passes.map((p) => ({ lon: p.lon, lat: p.lat }));
  const tespitler = seyrelt(ev.lastPassPoints, MAX_DOT);
  const hepsi: Nokta[] = [...tespitler, ...gecisler];
  if (hepsi.length === 0) hepsi.push({ lon: ev.lon, lat: ev.lat });

  const merkezLat =
    hepsi.reduce((a, p) => a + p.lat, 0) / hepsi.length;
  const merkezLon =
    hepsi.reduce((a, p) => a + p.lon, 0) / hepsi.length;

  // Derece yerine km uzayında çalışıyoruz: enlem yükseldikçe boylam derecesi
  // kısalıyor, ham dereceyle çizilse yangın doğu-batı yönünde geriliyordu.
  const kmLon = KM_PER_DEG_LON * Math.cos((merkezLat * Math.PI) / 180);
  const xKm = (lon: number) => (lon - merkezLon) * kmLon;
  const yKm = (lat: number) => (merkezLat - lat) * KM_PER_DEG_LAT;

  const yanginX = Math.max(
    Math.max(...hepsi.map((p) => Math.abs(xKm(p.lon)))) * PAD,
    MIN_SPAN_KM / 2
  );
  const yanginY = Math.max(
    Math.max(...hepsi.map((p) => Math.abs(yKm(p.lat)))) * PAD,
    MIN_SPAN_KM / 2
  );

  /* Yerleşimler bir kez ölçülüyor: hem kutuyu büyütmek hem etiketlemek için. */
  const yerler = PLACES_TR.map((p) => ({
    name: p[0] as string,
    lat: p[2] as number,
    lon: p[3] as number,
    km: havKm(merkezLon, merkezLat, p[3] as number, p[2] as number),
  })).sort((a, b) => a.km - b.km);

  /**
   * En yakın yerleşim kutuya alınır.
   *
   * Ölçüldü (2026-08-04): kutu yalnız yangının kendi sınırına göre kurulunca
   * kareye hiçbir yer adı girmiyordu (Girokastra'da 21 tespit, en yakın merkez
   * dışarıda) — "bağlam haritası" ölçek çubuğundan ibaret kalıyordu. Yangının
   * neye göre nerede olduğunu söyleyen şey komşu yerleşim.
   *
   * Kutu asla yangının kendi sınırından küçülmez; büyütme de MAX_YARI_KM ile
   * sınırlı, yoksa uzak bir merkezi içeri almak için yangın noktaya inerdi.
   */
  const enYakin = yerler[0];
  const yariX = enYakin
    ? Math.max(yanginX, Math.min(Math.abs(xKm(enYakin.lon)) / 0.82, MAX_YARI_KM))
    : yanginX;
  const yariY = enYakin
    ? Math.max(yanginY, Math.min(Math.abs(yKm(enYakin.lat)) / 0.82, MAX_YARI_KM))
    : yanginY;

  // Tek ölçek: en/boy oranı korunsun, yangın ezilmesin.
  const pxPerKm = Math.min(genislik / (2 * yariX), yukseklik / (2 * yariY));
  const px = (p: Nokta) => ({
    x: yuvarla(genislik / 2 + xKm(p.lon) * pxPerKm),
    y: yuvarla(yukseklik / 2 + yKm(p.lat) * pxPerKm),
  });

  /* Kareye gerçekten düşen en yakın yerleşimler — coğrafi bağlamı bunlar
     veriyor. Eleme km ile değil piksel konumuyla: ölçek iki eksenin
     dar olanına göre oturuyor, km ile bakmak kenarda etiket bırakıyordu. */
  const KENAR = 26;
  const yakinlar = yerler
    .map((y) => ({ ...y, q: px(y) }))
    .filter(
      (y) =>
        y.q.x >= KENAR &&
        y.q.x <= genislik - KENAR &&
        y.q.y >= KENAR &&
        y.q.y <= yukseklik - KENAR
    )
    .slice(0, 3);

  /* ---- SVG (yalnız geometri) ---- */
  const parca: string[] = [];

  // İlerleme izi: geçiş merkezlerini eskiden yeniye bağlar.
  if (gecisler.length > 1) {
    const d = gecisler
      .map((g, i) => {
        const q = px(g);
        return `${i === 0 ? "M" : "L"}${q.x} ${q.y}`;
      })
      .join(" ");
    parca.push(
      `<path d="${d}" fill="none" stroke="#d9a441" stroke-opacity="0.75" stroke-width="2.5" stroke-dasharray="6 4" stroke-linecap="round"/>`
    );
    // İlk görülen yer: içi boş halka. Son geçiş dolu — yön ek metin
    // olmadan okunuyor ("boştan doluya").
    const ilk = px(gecisler[0]);
    parca.push(
      `<circle cx="${ilk.x}" cy="${ilk.y}" r="6" fill="none" stroke="#d9a441" stroke-width="2.5"/>`
    );
  }

  // Son geçişin tespitleri: yangının şu anki ayak izi.
  for (const t of tespitler) {
    const q = px(t);
    parca.push(
      `<circle cx="${q.x}" cy="${q.y}" r="5.5" fill="#ff6a3d" fill-opacity="0.22"/>`,
      `<circle cx="${q.x}" cy="${q.y}" r="2.6" fill="#ff8a5c"/>`
    );
  }

  // Yerleşim işaretleri (etiketleri çağıran taraf basıyor).
  for (const y of yakinlar) {
    const q = y.q;
    parca.push(
      `<circle cx="${q.x}" cy="${q.y}" r="3" fill="none" stroke="#8a8a95" stroke-width="1.5"/>`
    );
  }

  /* Ölçek çubuğu */
  const kmPerPx = 1 / pxPerKm;
  const olcekKm = olcekSec(kmPerPx, genislik);
  const olcekPx = yuvarla(olcekKm * pxPerKm);
  const oX = 18;
  const oY = yukseklik - 20;
  parca.push(
    `<path d="M${oX} ${oY} h${olcekPx}" stroke="#a8a8b3" stroke-width="2"/>`,
    `<path d="M${oX} ${oY - 4} v8 M${oX + olcekPx} ${oY - 4} v8" stroke="#a8a8b3" stroke-width="2"/>`
  );

  /* Kuzey oku — sağ üst */
  const kX = genislik - 24;
  const kY = 22;
  parca.push(
    `<path d="M${kX} ${kY - 10} L${kX - 5} ${kY + 6} L${kX} ${kY + 2} L${kX + 5} ${kY + 6} Z" fill="#a8a8b3"/>`
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${genislik}" height="${yukseklik}" viewBox="0 0 ${genislik} ${yukseklik}"><rect width="${genislik}" height="${yukseklik}" fill="#0d0d10"/>${parca.join("")}</svg>`;

  return {
    src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    labels: yakinlar.map((y) => ({ x: y.q.x, y: y.q.y, text: y.name })),
    scaleText: `${olcekKm} km`,
    scale: { x: oX, y: oY, w: olcekPx },
  };
}
