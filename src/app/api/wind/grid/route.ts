import { NextResponse } from "next/server";
import type { WindGrid } from "@/lib/types";
import {
  GRID_LAT0,
  GRID_LON0,
  GRID_NX,
  GRID_NY,
  GRID_STEP,
} from "@/lib/bbox";

/**
 * Bölgenin 0.5° rüzgar gridi (Open-Meteo current, m/s).
 * ~1000 nokta, 100'lük parçalarla; upstream 20 dk cache'lenir.
 *
 * Geometri `lib/bbox.ts`'ten geliyor: FIRMS kutusunu tamamen kapsaması şart,
 * aksi hâlde kapsam dışı yangın sessizce konisiz kalır (Güney Kıbrıs vakası).
 */
const LON0 = GRID_LON0;
const LAT0 = GRID_LAT0;
const D = GRID_STEP;
const NX = GRID_NX;
const NY = GRID_NY;

export async function GET() {
  const coords: { lat: number; lon: number }[] = [];
  for (let r = 0; r < NY; r++) {
    for (let c = 0; c < NX; c++) {
      coords.push({ lat: LAT0 + r * D, lon: LON0 + c * D });
    }
  }

  const CHUNK = 100;
  // Eksik hücre 0 DEĞİL null olmalı: 0 "tam durgun" demektir ve
  // interpolasyona girip koniyi olduğundan kısa çizer.
  const u = new Array<number | null>(coords.length).fill(null);
  const v = new Array<number | null>(coords.length).fill(null);
  const totalChunks = Math.ceil(coords.length / CHUNK);
  let failedChunks = 0;

  let obsTime: string | null = null;

  // Dakikalık limit lokasyon sayısına bakıyor: 429 gelmişse kalan parçalar
  // da kesin 429 yiyecek. Denemeye devam etmek kotayı daha çok tüketip
  // hemen ardından çalışan duman ızgarasını da düşürüyordu.
  let minutelyLimit = false;

  const fetchChunk = async (offset: number, attempt = 0): Promise<void> => {
    if (minutelyLimit) {
      failedChunks++;
      return;
    }
    const slice = coords.slice(offset, offset + CHUNK);
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${slice.map((c) => c.lat.toFixed(2)).join(",")}` +
      `&longitude=${slice.map((c) => c.lon.toFixed(2)).join(",")}` +
      "&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=UTC";
    try {
      // 1/3/6 saatlik projeksiyon için 3 saatlik bayat rüzgâr fazla:
      // deniz meltemi gün içinde yön değiştirebiliyor.
      const res = await fetch(url, { next: { revalidate: 1200 } });
      if (res.status === 429) {
        minutelyLimit = true;
        failedChunks++;
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [data];
      arr.forEach((loc, i) => {
        const spd = loc?.current?.wind_speed_10m;
        const dir = loc?.current?.wind_direction_10m;
        if (typeof spd === "number" && typeof dir === "number") {
          const rad = (dir * Math.PI) / 180;
          // dir = rüzgarın GELDİĞİ yön → vektör ters yöne akar
          u[offset + i] = -spd * Math.sin(rad);
          v[offset + i] = -spd * Math.cos(rad);
        }
      });
      if (!obsTime && typeof arr[0]?.current?.time === "string") {
        obsTime = arr[0].current.time;
      }
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        return fetchChunk(offset, attempt + 1);
      }
      failedChunks++;
    }
  };

  // Tüm parçaları aynı anda göndermek Open-Meteo'nun dakikalık sınırına
  // takılıyor ve gridin üçte biri boş dönüyordu; ikişerli dalgalar hâlinde.
  const offsets: number[] = [];
  for (let s = 0; s < coords.length; s += CHUNK) offsets.push(s);
  const WAVE = 2;
  for (let i = 0; i < offsets.length; i += WAVE) {
    await Promise.all(offsets.slice(i, i + WAVE).map((o) => fetchChunk(o)));
  }

  if (failedChunks >= totalChunks) {
    return NextResponse.json(
      { error: "Rüzgar verisine ulaşılamadı" },
      { status: 503 }
    );
  }

  const body: WindGrid = {
    lon0: LON0,
    lat0: LAT0,
    dLon: D,
    dLat: D,
    nx: NX,
    ny: NY,
    u: u.map((x) => (x === null ? null : Math.round(x * 100) / 100)),
    v: v.map((x) => (x === null ? null : Math.round(x * 100) / 100)),
    time: Date.now(),
    obsTime,
    failedChunks,
    totalChunks,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
