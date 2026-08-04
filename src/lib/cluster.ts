import { bearingDeg, havKm, toRad } from "./geo";
import { nearestPlace } from "./places";
import { fixedSourceAt } from "./fixed-sources";
import { dusukGuven } from "./firms";
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
/** Olay durumu son görülmeye göre — render sırasında ucuzca türetilir. */
export function statusOf(lastSeen: number, now: number): FireEvent["status"] {
  const ageH = (now - lastSeen) / 3600_000;
  return ageH <= 12 ? "active" : ageH <= 24 ? "waning" : "old";
}

/**
 * Kümeleme `now` almaz: saat ilerledikçe (30 sn'de bir) tüm kümeleme ve
 * yer-adı aramasının baştan çalışmasına gerek yok. Durum türetimi ayrı.
 */
export function clusterEvents(points: FirePoint[]): ClusterResult {
  if (points.length === 0) return { events: [], pointEvent: {} };

  const cellDeg = EPS_KM / 111; // ~lat hücre boyu
  // Boylam bölenini SABİT tut: noktanın kendi enlemine göre hesaplanırsa
  // ızgara tutarsız olur ve eşiğe yakın komşular 3x3 taramanın dışında
  // kalıp tek yangın iki olaya bölünür.
  const lonCell = cellDeg / Math.cos(toRad(42.6));
  const cellOf = (lon: number, lat: number) => ({
    cx: Math.floor(lon / lonCell),
    cy: Math.floor(lat / cellDeg),
  });
  const key = (p: FirePoint) => {
    const c = cellOf(p.lon, p.lat);
    return `${c.cx}:${c.cy}`;
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
      const { cx, cy } = cellOf(p.lon, p.lat);
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
      let sLon = 0, sLat = 0;
      // FRP'yi uyduya göre ayır: aynı yörünge düzlemindeki VIIRS platformları
      // ~50 dk arayla geçiyor ve tek "geçiş" penceresine düşüyor. Toplamak
      // aynı ısıyı iki-üç kez sayıp şiddeti ve trendi şişiriyordu.
      const bySat = new Map<string, number>();
      for (const g of group) {
        sLon += g.lon;
        sLat += g.lat;
        bySat.set(g.sat, (bySat.get(g.sat) ?? 0) + g.frp);
      }
      passes.push({
        t: group[Math.floor(group.length / 2)].dt,
        t0: group[0].dt,
        lon: sLon / group.length,
        lat: sLat / group.length,
        frp: Math.round(Math.max(...bySat.values()) * 10) / 10,
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
    // Centroid, piksel sayısı değiştikçe yangın ilerlemese de kayar.
    // Eşik VIIRS piksel ölçeğinin (375 m) üstünde olmalı, yoksa ölçüm
    // gürültüsü "yön değişimi" iddiası olarak sunulur. Tek-iki pikselli
    // geçişlerde centroid zaten güvenilmez.
    const MIN_DRIFT_KM = 1.2;
    const enoughPixels = first.count >= 3 && last.count >= 3;
    if (passes.length >= 2 && enoughPixels) {
      const km = havKm(first.lon, first.lat, last.lon, last.lat);
      const spanMs = last.t - first.t;
      const hours = Math.max(0.5, spanMs / 3600_000);
      if (km >= MIN_DRIFT_KM) {
        drift = {
          bearingDeg: bearingDeg(first.lon, first.lat, last.lon, last.lat),
          km: Math.round(km * 10) / 10,
          kmh: Math.round((km / hours) * 100) / 100,
          spanMs,
        };
      }
    }

    const lastCut = last.t - PASS_GAP_MS;
    const sonGecis = pts.filter((p) => p.dt >= lastCut);
    const lastPassPoints = sonGecis.map((p) => ({ lon: p.lon, lat: p.lat }));

    // Tespitlerin HEPSİ düşük güvenli gündüz kaydıysa olay aktif sayılmaz.
    // Tek bir güvenilir (ya da gece) tespit varsa olay sayılır — eşik
    // bilerek "hepsi", çoğunluk değil: gerçek yangını gizlemek, şüpheliyi
    // saymaktan daha kötü.
    const lowConfidence = pts.every(dusukGuven);
    // Şiddet göstergesi güncel olmalı: dünkü doyma bugünkü yangını anlatmaz.
    const saturated = sonGecis.some((p) => p.saturated === true);

    const frpMax = Math.max(...passes.map((p) => p.frp));

    // Kimlik İLK geçişe bağlanır: son geçiş centroid'i her tazelemede
    // kayıyor ve seçili olay kullanıcının elinden düşüyordu.
    const evId = `${first.lon.toFixed(2)}:${first.lat.toFixed(2)}:${Math.round(first.t / 3600_000)}`;
    for (const p of pts) pointEvent[p.id] = evId;
    const where = nearestPlace(last.lon, last.lat);
    events.push({
      id: evId,
      lon: last.lon,
      lat: last.lat,
      place: where.label,
      il: where.il,
      fixedSource: fixedSourceAt(last.lon, last.lat),
      abroad: where.abroad,
      firstSeen: first.t,
      lastSeen: pts[pts.length - 1].dt,
      count: pts.length,
      frpLast: last.frp,
      frpMax,
      passes,
      drift,
      lastPassPoints,
      lowConfidence,
      saturated,
      status: "active",
    });
  }
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
