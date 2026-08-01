/**
 * FIRMS_MAP_KEY yokken kullanılan gerçekçi demo verisi.
 * Zamanlar "şimdi"ye göre üretilir — güncellik rozeti ve zaman
 * kaydırıcısı gerçek davranışıyla test edilebilir.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoEvent {
  lat: number;
  lon: number;
  /** saat önce başladı */
  ageH: number;
  passCount: number;
  /** derece; olayın sürüklendiği yön (0=K) */
  driftDeg: number;
  /** geçiş başına km sürüklenme */
  driftKmPerPass: number;
  /** FRP eğilimi: 1 büyüyor, -1 sönüyor */
  trend: 1 | -1;
  scale: number;
}

const EVENTS: DemoEvent[] = [
  // Bergama kuzeyi — büyüyen, KD'ye ilerliyor
  { lat: 39.16, lon: 27.22, ageH: 30, passCount: 6, driftDeg: 40, driftKmPerPass: 0.9, trend: 1, scale: 1.6 },
  // Marmaris doğusu — orta, D'ye ilerliyor
  { lat: 36.9, lon: 28.38, ageH: 20, passCount: 4, driftDeg: 95, driftKmPerPass: 0.7, trend: 1, scale: 1.0 },
  // Manavgat kuzeyi — sönmekte
  { lat: 36.98, lon: 31.52, ageH: 60, passCount: 8, driftDeg: 10, driftKmPerPass: 0.4, trend: -1, scale: 1.2 },
  // Ayvacık — taze, tek geçiş
  { lat: 39.55, lon: 26.5, ageH: 3, passCount: 1, driftDeg: 70, driftKmPerPass: 0, trend: 1, scale: 0.5 },
];

const KM_PER_DEG_LAT = 111;

export function genFixtureCsv(now = Date.now()): string {
  const rnd = mulberry32(20260801);
  const rows: string[] = [
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight",
  ];

  const push = (lat: number, lon: number, dt: number, frp: number, sat: string) => {
    const d = new Date(dt);
    const acqDate = d.toISOString().slice(0, 10);
    const acqTime = String(d.getUTCHours() * 100 + d.getUTCMinutes());
    const dn = d.getUTCHours() >= 8 && d.getUTCHours() <= 16 ? "D" : "N";
    rows.push(
      [
        lat.toFixed(5),
        lon.toFixed(5),
        (330 + rnd() * 30).toFixed(1),
        "0.39",
        "0.36",
        acqDate,
        acqTime,
        sat,
        "VIIRS",
        frp > 25 ? "h" : "n",
        "2.0NRT",
        (290 + rnd() * 10).toFixed(1),
        frp.toFixed(1),
        dn,
      ].join(",")
    );
  };

  for (const ev of EVENTS) {
    const start = now - ev.ageH * 3600_000;
    const stepMs = (ev.ageH * 3600_000) / Math.max(1, ev.passCount - 1 || 1);
    for (let p = 0; p < ev.passCount; p++) {
      const t = ev.passCount === 1 ? now - ev.ageH * 3600_000 : start + p * stepMs;
      const driftKm = ev.driftKmPerPass * p;
      const dLat = (driftKm * Math.cos((ev.driftDeg * Math.PI) / 180)) / KM_PER_DEG_LAT;
      const dLon =
        (driftKm * Math.sin((ev.driftDeg * Math.PI) / 180)) /
        (KM_PER_DEG_LAT * Math.cos((ev.lat * Math.PI) / 180));
      const cLat = ev.lat + dLat;
      const cLon = ev.lon + dLon;

      const growth = ev.trend === 1 ? 0.5 + (p / ev.passCount) * 1.2 : 1.6 - (p / ev.passCount) * 1.3;
      const nPts = Math.max(2, Math.round((3 + p * 2) * ev.scale * (ev.trend === 1 ? 1 : 0.8)));
      const sat = p % 2 === 0 ? "N20" : "N21";
      for (let i = 0; i < nPts; i++) {
        const spreadKm = 0.8 * ev.scale + rnd() * 1.4 * ev.scale;
        const ang = rnd() * Math.PI * 2;
        const pLat = cLat + (spreadKm * Math.cos(ang)) / KM_PER_DEG_LAT;
        const pLon =
          cLon + (spreadKm * Math.sin(ang)) / (KM_PER_DEG_LAT * Math.cos((cLat * Math.PI) / 180));
        const frp = Math.max(1.5, (8 + rnd() * 55) * growth * ev.scale);
        push(pLat, pLon, t + Math.round(rnd() * 8) * 60_000, frp, sat);
      }
    }
  }

  // Dağınık tekil tespitler (anız/tarımsal)
  const singles: [number, number][] = [
    [38.9, 33.4], [39.6, 35.2], [37.5, 38.5], [40.2, 30.1],
    [38.2, 42.0], [37.1, 36.4], [39.9, 41.4], [36.7, 34.0],
  ];
  for (const [lat, lon] of singles) {
    const t = now - (2 + rnd() * 40) * 3600_000;
    push(lat + rnd() * 0.05, lon + rnd() * 0.05, t, 3 + rnd() * 12, "N");
  }

  return rows.join("\n");
}
