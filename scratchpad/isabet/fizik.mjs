/**
 * Rothermel φw/φs + ERA5 rüzgâr okuma — 05b-model.mjs'ten AYNEN çıkarıldı.
 * Üç ölçüm scriptinin (05b · 12 · 14) aynı fiziği kullanması için tek yerde.
 */
export const toRad = (d) => (d * Math.PI) / 180;
export const toDeg = (r) => (r * 180) / Math.PI;

export const angDiff = (a, b) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

export function vecSum(parts) {
  let x = 0;
  let y = 0;
  for (const [deg, mag] of parts) {
    if (deg === null || !Number.isFinite(deg) || !Number.isFinite(mag) || mag <= 0) continue;
    x += mag * Math.sin(toRad(deg));
    y += mag * Math.cos(toRad(deg));
  }
  return Math.hypot(x, y) < 1e-9 ? null : (toDeg(Math.atan2(x, y)) + 360) % 360;
}

const FUEL = {
  ORMAN: { sigma: 1500, beta: 0.03, waf: 0.15 },
  MAKI: { sigma: 1800, beta: 0.012, waf: 0.3 },
  OT: { sigma: 3500, beta: 0.0015, waf: 0.4 },
};

export function phis(fuel, windKmh, slopePct) {
  const { sigma, beta, waf } = FUEL[fuel] ?? FUEL.MAKI;
  const betaOp = 3.348 * sigma ** -0.8189;
  const C = 7.47 * Math.exp(-0.133 * sigma ** 0.55);
  const B = 0.02526 * sigma ** 0.54;
  const E = 0.715 * Math.exp(-3.59e-4 * sigma);
  const U = Math.max(0, windKmh) * 54.6807 * waf;
  return {
    phiW: C * U ** B * (beta / betaOp) ** -E,
    phiS: 5.275 * beta ** -0.3 * (slopePct / 100) ** 2,
  };
}

export const wkey = (c) =>
  `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
export const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;

/** a..b aralığının vektör-ortalama rüzgârı; yön GİTTİĞİ yön (ERA5 geldiği yön verir). */
export function windAt(wind, c, a, b) {
  const w = wind[wkey(c)];
  if (!w) return null;
  const i0 = Math.round((a - w.t0) / 3600_000);
  const i1 = Math.round((b - w.t0) / 3600_000);
  let x = 0;
  let y = 0;
  let n = 0;
  for (let i = Math.max(0, i0); i <= Math.min(w.spd.length - 1, i1); i++) {
    const s = w.spd[i];
    const d = w.dir[i];
    if (typeof s !== "number" || typeof d !== "number") continue;
    const to = (d + 180) % 360;
    x += s * Math.sin(toRad(to));
    y += s * Math.cos(toRad(to));
    n++;
  }
  return n ? { deg: (toDeg(Math.atan2(x, y)) + 360) % 360, kmh: Math.hypot(x, y) / n } : null;
}

export const ozet = (a) => {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return null;
  const p = (t) => (100 * s.filter((x) => x <= t).length) / s.length;
  return {
    n: s.length,
    ort: s.reduce((x, y) => x + y, 0) / s.length,
    med: s[Math.floor(s.length / 2)],
    p45: p(45),
    p90: p(90),
    ust135: 100 - p(135),
  };
};

/** Olay-bazlı bootstrap medyan GA — aynı yangının vakaları bağımsız değil. */
export function bootCI(pairs, iter = 2000) {
  const byEv = new Map();
  for (const { ev, v } of pairs) {
    if (!Number.isFinite(v)) continue;
    if (!byEv.has(ev)) byEv.set(ev, []);
    byEv.get(ev).push(v);
  }
  const evs = [...byEv.values()];
  if (evs.length < 5) return null;
  const meds = [];
  for (let i = 0; i < iter; i++) {
    const pool = [];
    for (let j = 0; j < evs.length; j++) pool.push(...evs[(Math.random() * evs.length) | 0]);
    pool.sort((a, b) => a - b);
    meds.push(pool[Math.floor(pool.length / 2)]);
  }
  meds.sort((a, b) => a - b);
  return [meds[(iter * 0.025) | 0], meds[(iter * 0.975) | 0]];
}

/** Eşleşmiş fark (A−B) ortalamasının olay-bazlı %95 GA'sı. */
export function bootDiff(pairs, iter = 2000) {
  const byEv = new Map();
  for (const { ev, a, b } of pairs) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (!byEv.has(ev)) byEv.set(ev, []);
    byEv.get(ev).push(a - b);
  }
  const evs = [...byEv.values()];
  if (evs.length < 5) return null;
  const means = [];
  for (let i = 0; i < iter; i++) {
    let s = 0;
    let n = 0;
    for (let j = 0; j < evs.length; j++)
      for (const v of evs[(Math.random() * evs.length) | 0]) {
        s += v;
        n++;
      }
    means.push(s / n);
  }
  means.sort((a, b) => a - b);
  return [means[(iter * 0.025) | 0], means[(iter * 0.975) | 0]];
}
