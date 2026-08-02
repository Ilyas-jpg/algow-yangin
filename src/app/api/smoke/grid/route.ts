import { NextResponse } from "next/server";

/**
 * TR bölgesi 0,5° duman (PM2.5) gridi — CAMS üzerinden.
 *
 * Nokta bazlı duman tahmini seçili yangın için vardı; haritada katman olunca
 * "duman nereye gidiyor" bakışta okunuyor. Dağılımı biz hesaplamıyoruz:
 * ECMWF/CAMS'in çalıştırdığı dağılım modelinin çıktısını gösteriyoruz.
 *
 * Izgara aralığı bilinçli olarak kaba: CAMS'in kendi çözünürlüğü ~0,4°, daha
 * sık örneklemek olmayan bir detay uydurmak olurdu.
 *
 * Yapı rüzgâr gridiyle aynı (100'lük parça, ikişerli dalga, 2 tekrar) —
 * o desen Open-Meteo'nun dakikalık sınırına takılmamak için ödenmiş bir ders.
 */
const LON0 = 25.0;
const LAT0 = 34.5;
const D = 0.5;
const NX = 42;
const NY = 17;

export interface SmokeGrid {
  lon0: number;
  lat0: number;
  dLon: number;
  dLat: number;
  nx: number;
  ny: number;
  /** µg/m³, eksik hücre null */
  pm: (number | null)[];
  time: number;
  failedChunks: number;
  totalChunks: number;
}

export async function GET() {
  const coords: { lat: number; lon: number }[] = [];
  for (let r = 0; r < NY; r++) {
    for (let c = 0; c < NX; c++) {
      coords.push({ lat: LAT0 + r * D, lon: LON0 + c * D });
    }
  }

  const CHUNK = 100;
  // Eksik hücre 0 DEĞİL null: 0 "hava tertemiz" demektir ve olmayan bir
  // bilgiyi iyi haber diye gösterirdi.
  const pm = new Array<number | null>(coords.length).fill(null);
  const totalChunks = Math.ceil(coords.length / CHUNK);
  let failedChunks = 0;

  const fetchChunk = async (offset: number, attempt = 0): Promise<void> => {
    const slice = coords.slice(offset, offset + CHUNK);
    const url =
      "https://air-quality-api.open-meteo.com/v1/air-quality" +
      `?latitude=${slice.map((c) => c.lat.toFixed(2)).join(",")}` +
      `&longitude=${slice.map((c) => c.lon.toFixed(2)).join(",")}` +
      "&current=pm2_5&timezone=UTC";
    try {
      const res = await fetch(url, { next: { revalidate: 1800 } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [data];
      arr.forEach((loc, i) => {
        const v = loc?.current?.pm2_5;
        if (typeof v === "number") pm[offset + i] = Math.round(v * 10) / 10;
      });
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        return fetchChunk(offset, attempt + 1);
      }
      failedChunks++;
    }
  };

  const offsets: number[] = [];
  for (let s = 0; s < coords.length; s += CHUNK) offsets.push(s);
  const WAVE = 2;
  for (let i = 0; i < offsets.length; i += WAVE) {
    await Promise.all(offsets.slice(i, i + WAVE).map((o) => fetchChunk(o)));
  }

  if (failedChunks >= totalChunks) {
    return NextResponse.json(
      { error: "Duman verisine ulaşılamadı" },
      { status: 503 }
    );
  }

  const body: SmokeGrid = {
    lon0: LON0,
    lat0: LAT0,
    dLon: D,
    dLat: D,
    nx: NX,
    ny: NY,
    pm,
    time: Date.now(),
    failedChunks,
    totalChunks,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
