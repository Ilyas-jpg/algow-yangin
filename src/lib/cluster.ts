import { bearingDeg, havKm, toRad } from "./geo";
import { nearestPlace } from "./places";
import type { FirePoint, FireEvent, PassGroup } from "./types";

const EPS_KM = 3;
const PASS_GAP_MS = 90 * 60_000;

export interface ClusterResult {
  events: FireEvent[];
  /** nokta id → olay id (harita tıklaması / render zenginleştirme) */
  pointEvent: Record<string, string>;
}

/**
 * Basit tek-bağlantılı (single-linkage) mekânsal kümeleme.
 * Grid-hash ile komşuluk: 3 km hücreler, 3x3 tarama.
 */
export function clusterEvents(points: FirePoint[], now: number): ClusterResult {
  if (points.length === 0) return { events: [], pointEvent: {} };

  const cellDeg = EPS_KM / 111; // ~lat hücre boyu
  const key = (p: FirePoint) => {
    const cx = Math.floor(p.lon / (cellDeg / Math.cos(toRad(p.lat))));
    const cy = Math.floor(p.lat / cellDeg);
    return `${cx}:${cy}`;
  };

  const cells = new Map<string, number[]>();
  points.forEach((p, i) => {
    const k = key(p);
    const arr = cells.get(k);
    if (arr) arr.push(i);
    else cells.set(k, [i]);
  });

  const compOf = new Array<number>(points.length).fill(-1);
  let nComp = 0;

  for (let i = 0; i < points.length; i++) {
    if (compOf[i] !== -1) continue;
    const comp = nComp++;
    const stack = [i];
    compOf[i] = comp;
    while (stack.length) {
      const cur = stack.pop()!;
      const p = points[cur];
      const cx = Math.floor(p.lon / (cellDeg / Math.cos(toRad(p.lat))));
      const cy = Math.floor(p.lat / cellDeg);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = cells.get(`${cx + dx}:${cy + dy}`);
          if (!bucket) continue;
          for (const j of bucket) {
            if (compOf[j] !== -1) continue;
            const q = points[j];
            if (havKm(p.lon, p.lat, q.lon, q.lat) <= EPS_KM) {
              compOf[j] = comp;
              stack.push(j);
            }
          }
        }
      }
    }
  }

  const byComp = new Map<number, FirePoint[]>();
  points.forEach((p, i) => {
    const c = compOf[i];
    const arr = byComp.get(c);
    if (arr) arr.push(p);
    else byComp.set(c, [p]);
  });

  const events: FireEvent[] = [];
  const pointEvent: Record<string, string> = {};
  for (const pts of byComp.values()) {
    pts.sort((a, b) => a.dt - b.dt);

    // Geçiş grupları: 90 dk'dan büyük boşluk = yeni uydu geçişi
    const passes: PassGroup[] = [];
    let group: FirePoint[] = [];
    const flush = () => {
      if (!group.length) return;
      let sLon = 0, sLat = 0, sFrp = 0;
      for (const g of group) {
        sLon += g.lon;
        sLat += g.lat;
        sFrp += g.frp;
      }
      passes.push({
        t: group[Math.floor(group.length / 2)].dt,
        lon: sLon / group.length,
        lat: sLat / group.length,
        frp: Math.round(sFrp * 10) / 10,
        count: group.length,
      });
      group = [];
    };
    for (const p of pts) {
      if (group.length && p.dt - group[group.length - 1].dt > PASS_GAP_MS) flush();
      group.push(p);
    }
    flush();

    const last = passes[passes.length - 1];
    const first = passes[0];

    let drift: FireEvent["drift"] = null;
    if (passes.length >= 2) {
      const km = havKm(first.lon, first.lat, last.lon, last.lat);
      const hours = Math.max(0.5, (last.t - first.t) / 3600_000);
      if (km >= 0.4) {
        drift = {
          bearingDeg: bearingDeg(first.lon, first.lat, last.lon, last.lat),
          km: Math.round(km * 10) / 10,
          kmh: Math.round((km / hours) * 100) / 100,
        };
      }
    }

    const lastCut = last.t - PASS_GAP_MS;
    const lastPassPoints = pts
      .filter((p) => p.dt >= lastCut)
      .map((p) => ({ lon: p.lon, lat: p.lat }));

    const ageH = (now - last.t) / 3600_000;
    const status: FireEvent["status"] =
      ageH <= 12 ? "active" : ageH <= 24 ? "waning" : "old";

    const frpMax = Math.max(...passes.map((p) => p.frp));

    const evId = `${last.lon.toFixed(2)}:${last.lat.toFixed(2)}:${Math.round(first.t / 86400_000)}`;
    for (const p of pts) pointEvent[p.id] = evId;
    const where = nearestPlace(last.lon, last.lat);
    events.push({
      id: evId,
      lon: last.lon,
      lat: last.lat,
      place: where.label,
      abroad: where.abroad,
      firstSeen: first.t,
      lastSeen: pts[pts.length - 1].dt,
      count: pts.length,
      frpLast: last.frp,
      frpMax,
      passes,
      drift,
      lastPassPoints,
      status,
    });
  }

  // Önem sırası: yurt içi önce → durum → son geçiş FRP
  const rank = { active: 0, waning: 1, old: 2 } as const;
  events.sort(
    (a, b) =>
      Number(a.abroad) - Number(b.abroad) ||
      rank[a.status] - rank[b.status] ||
      b.frpLast - a.frpLast
  );
  return { events, pointEvent };
}

/** Rüzgar yönünde en uç son-geçiş noktası (koninin tepe noktası). */
export function leadingEdge(
  ev: FireEvent,
  spreadBearingDeg: number
): { lon: number; lat: number } {
  if (!ev.lastPassPoints.length) return { lon: ev.lon, lat: ev.lat };
  const rad = toRad(spreadBearingDeg);
  const ux = Math.sin(rad);
  const uy = Math.cos(rad);
  let best = ev.lastPassPoints[0];
  let bestProj = -Infinity;
  for (const p of ev.lastPassPoints) {
    const dx = (p.lon - ev.lon) * Math.cos(toRad(ev.lat)) * 111;
    const dy = (p.lat - ev.lat) * 111;
    const proj = dx * ux + dy * uy;
    if (proj > bestProj) {
      bestProj = proj;
      best = p;
    }
  }
  return best;
}
