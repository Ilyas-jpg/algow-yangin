/**
 * 12 — PERSISTENCE BASELINE + HARMAN (spec §6.1)
 *
 * Soru: "son gözlenen büyüme yönü aynen devam eder" tahmini, rüzgâr modelini
 * döver mi? Spec'in beklentisi buydu. 05b zaten SÜREKLİLİK'i ölçtü ve
 * rastgeleden KÖTÜ çıktı (99–114°); burada onu ① aynı altkümede rüzgârla yan
 * yana koyuyoruz (adil kıyas) ② harmanın (w·persistence + (1-w)·fizik) bir
 * kazanç verip vermediğini SEZON-DIŞI ölçüyoruz.
 *
 * Neden aynı altküme şart: persistence yalnız ikinci geçişten itibaren tanımlı.
 * Rüzgârın 68°'si TÜM vakalarda ölçülmüştü; persistence'ı o sayıyla kıyaslamak
 * farklı iki popülasyonu kıyaslamak olurdu.
 *
 * w SEZON-DIŞI seçilir (leave-one-season-out): w'yi ölçtüğü veride seçmek
 * kendi kendini doğrulayan iddia üretir — 08-kapsama.mjs'de aynı tuzağa
 * düşülmüştü, aynı disiplin burada da geçerli.
 */
import { readFileSync } from "node:fs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

const cases = JSON.parse(readFileSync(here("cases-wild.json"), "utf8"));
const wind = JSON.parse(readFileSync(here("wind-w.json"), "utf8"));
const elev = JSON.parse(readFileSync(here("elev-srtm.json"), "utf8"));

const wkey = (c) =>
  `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;

const angDiff = (a, b) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

/** Ağırlıklı vektör toplamı; hepsi sıfırsa null (yön iddiası yok). */
function vecSum(parts) {
  let x = 0;
  let y = 0;
  for (const [deg, mag] of parts) {
    if (deg === null || !Number.isFinite(deg) || !Number.isFinite(mag) || mag <= 0) continue;
    x += mag * Math.sin(toRad(deg));
    y += mag * Math.cos(toRad(deg));
  }
  return Math.hypot(x, y) < 1e-9 ? null : (toDeg(Math.atan2(x, y)) + 360) % 360;
}

/* ── Rothermel φw / φs — 05b ile birebir aynı ── */
const FUEL = {
  ORMAN: { sigma: 1500, beta: 0.03, waf: 0.15 },
  MAKI: { sigma: 1800, beta: 0.012, waf: 0.3 },
  OT: { sigma: 3500, beta: 0.0015, waf: 0.4 },
};
function phis(fuel, windKmh, slopePct) {
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
function windAt(c, a, b) {
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
    const to = (d + 180) % 360; // geldiği yön → gittiği yön
    x += s * Math.sin(toRad(to));
    y += s * Math.cos(toRad(to));
    n++;
  }
  return n ? { deg: (toDeg(Math.atan2(x, y)) + 360) % 360, kmh: Math.hypot(x, y) / n } : null;
}

/* ── vaka tablosu: fizik yönü + persistence + yangın yaşı ── */
// Yangın yaşı: olayın kendi ilk vakasından bu vakaya kadar geçen saat.
// (Gerçek tutuşma anı bilinmiyor; ilk GÖRÜLEN geçiş referans alınıyor —
// üretimde de elimizdeki tek şey bu.)
const evT0 = new Map();
for (const c of cases) {
  const t = evT0.get(c.ev);
  if (t === undefined || c.t0 < t) evT0.set(c.ev, c.t0);
}

const rows = [];
for (const c of cases) {
  const e = elev[ekey(c)];
  const w = windAt(c, c.t0, c.t0);
  if (!e || !w) continue;
  const { phiW, phiS } = phis(c.yakit, w.kmh, e.egim);
  rows.push({
    c,
    e,
    w,
    fizik: vecSum([[w.deg, phiW], [e.yokus, phiS]]),
    yasSa: (c.t0 - evT0.get(c.ev)) / 3600_000,
    sezon: new Date(c.t0).getUTCFullYear(),
  });
}

/* ── istatistik yardımcıları ── */
const ozet = (a) => {
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

/** Olay-bazlı bootstrap: aynı yangının vakaları bağımsız değil. */
function bootCI(pairs, iter = 2000) {
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

/** Eşleşmiş fark: aynı vakalarda A ve B'nin hata farkının olay-bazlı GA'sı. */
function bootDiff(pairs, iter = 2000) {
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
    for (let j = 0; j < evs.length; j++) {
      for (const v of evs[(Math.random() * evs.length) | 0]) {
        s += v;
        n++;
      }
    }
    means.push(s / n);
  }
  means.sort((a, b) => a - b);
  return [means[(iter * 0.025) | 0], means[(iter * 0.975) | 0]];
}

/* ── modeller ── */
const W_GRID = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

function persistOf(r, gt) {
  return gt === "BAS" ? r.c.prevBasYon : r.c.prevYon;
}
function truthOf(r, gt) {
  return gt === "BAS" ? r.c.basYon : r.c.yeniYon;
}
/** Harman: iki birim vektörün w ağırlıklı toplamı. */
function harman(r, gt, w) {
  const p = persistOf(r, gt);
  if (p === null || r.fizik === null) return null;
  return vecSum([[p, w], [r.fizik, 1 - w]]);
}
/** Yaşa bağlı w: genç yangında fizik, yaşlıda persistence (spec'in hipotezi). */
function wOfAge(yasSa, wGenc, wYasli, esikSa) {
  return yasSa >= esikSa ? wYasli : wGenc;
}

const forest = (r) => r.c.yakit !== "OT";

function rapor(baslik, gt) {
  // ADİL ALTKÜME: hem gerçek yön hem persistence hem fizik dolu olan vakalar
  const pool = rows.filter(
    (r) => forest(r) && truthOf(r, gt) !== null && persistOf(r, gt) !== null && r.fizik !== null
  );
  const evs = new Set(pool.map((r) => r.c.ev)).size;
  process.stdout.write(
    `\n${"═".repeat(76)}\n${baslik} · gerçek yön ölçütü ${gt} · ${pool.length} vaka / ${evs} yangın\n${"═".repeat(76)}\n`
  );
  if (pool.length < 20) {
    process.stdout.write("yetersiz örneklem\n");
    return null;
  }

  const err = (r, model, w) => {
    const t =
      model === "FIZIK" ? r.fizik : model === "RUZGAR" ? r.w.deg : model === "PERSIST" ? persistOf(r, gt) : harman(r, gt, w);
    return t === null ? NaN : angDiff(t, truthOf(r, gt));
  };

  const satir = (ad, pick) => {
    const s = ozet(pool.map(pick));
    const ci = bootCI(pool.map((r) => ({ ev: r.c.ev, v: pick(r) })));
    if (!s) return;
    process.stdout.write(
      `${ad.padEnd(22)}${String(s.n).padStart(4)} ${s.ort.toFixed(1).padStart(6)} ${s.med.toFixed(1).padStart(7)} ` +
        `${("%" + s.p45.toFixed(0)).padStart(6)} ${("%" + s.p90.toFixed(0)).padStart(6)} ${("%" + s.ust135.toFixed(0)).padStart(6)}   ` +
        `${ci ? `${ci[0].toFixed(0)}–${ci[1].toFixed(0)}°` : "—"}\n`
    );
  };

  process.stdout.write("model                   n    ort°  medyan°   ≤45°   ≤90°  >135°   medyan %95 GA\n");
  satir("RUZGAR (anlık)", (r) => err(r, "RUZGAR"));
  satir("FIZIK (rüzgâr⊕eğim)", (r) => err(r, "FIZIK"));
  satir("PERSISTENCE", (r) => err(r, "PERSIST"));

  /* ── w taraması (sadece görmek için; SEÇİM sezon-dışı yapılır) ── */
  process.stdout.write("\nw taraması (tüm veri — bu satırlar SEÇİM İÇİN KULLANILMAZ):\n  w:");
  for (const w of W_GRID) process.stdout.write(String(w).padStart(6));
  process.stdout.write("\n med:");
  for (const w of W_GRID) {
    const s = ozet(pool.map((r) => err(r, "HARMAN", w)));
    process.stdout.write((s ? s.med.toFixed(1) : "—").padStart(6));
  }
  process.stdout.write("\n");

  /* ── SEZON-DIŞI harman: w eğitim sezonlarında seçilir, test sezonunda ölçülür ── */
  const sezonlar = [...new Set(pool.map((r) => r.sezon))].sort();
  const oosHarman = [];
  const oosFizik = [];
  const secilenW = [];
  for (const s of sezonlar) {
    const train = pool.filter((r) => r.sezon !== s);
    const test = pool.filter((r) => r.sezon === s);
    if (train.length < 30 || test.length < 5) continue;
    let bestW = 0;
    let bestM = Infinity;
    for (const w of W_GRID) {
      const o = ozet(train.map((r) => err(r, "HARMAN", w)));
      if (o && o.med < bestM) {
        bestM = o.med;
        bestW = w;
      }
    }
    secilenW.push(`${s}:${bestW}`);
    for (const r of test) {
      oosHarman.push({ ev: r.c.ev, v: err(r, "HARMAN", bestW) });
      oosFizik.push({ ev: r.c.ev, v: err(r, "FIZIK") });
    }
  }
  if (oosHarman.length) {
    const h = ozet(oosHarman.map((x) => x.v));
    const f = ozet(oosFizik.map((x) => x.v));
    process.stdout.write(
      `\nSEZON-DIŞI (leave-one-season-out) · seçilen w: ${secilenW.join(" ")}\n` +
        `  HARMAN  medyan ${h.med.toFixed(1)}°  ort ${h.ort.toFixed(1)}°  ≤45° %${h.p45.toFixed(0)}  >135° %${h.ust135.toFixed(0)}  (n=${h.n})\n` +
        `  FIZIK   medyan ${f.med.toFixed(1)}°  ort ${f.ort.toFixed(1)}°  ≤45° %${f.p45.toFixed(0)}  >135° %${f.ust135.toFixed(0)}  (n=${f.n})\n`
    );
    // eşleşmiş fark: aynı test vakalarında harman − fizik
    const eş = oosHarman.map((x, i) => ({ ev: x.ev, a: x.v, b: oosFizik[i].v }));
    const dc = bootDiff(eş);
    const ortFark = eş.reduce((s, x) => s + (x.a - x.b), 0) / eş.length;
    process.stdout.write(
      `  eşleşmiş fark (harman − fizik): ${ortFark >= 0 ? "+" : ""}${ortFark.toFixed(1)}°  %95 GA ${dc ? `${dc[0].toFixed(1)}…${dc[1].toFixed(1)}°` : "—"}\n` +
        `  → GA sıfırı içeriyorsa kazanç KANITLANMADI.\n`
    );
  }

  /* ── yaşa bağlı w: yangın yaşlandıkça persistence ağırlığı artmalı mı? ── */
  const yasKova = [
    ["yaş < 12 sa", (r) => r.yasSa < 12],
    ["12–36 sa", (r) => r.yasSa >= 12 && r.yasSa < 36],
    ["≥ 36 sa", (r) => r.yasSa >= 36],
  ];
  process.stdout.write("\nyaşa göre (aynı vakalar, ayrı kovalar):\n");
  process.stdout.write("kova              n   FIZIK°  PERSIST°   en iyi w (o kovada)\n");
  for (const [ad, sel] of yasKova) {
    const sub = pool.filter(sel);
    if (sub.length < 15) {
      process.stdout.write(`${ad.padEnd(16)}${String(sub.length).padStart(3)}   (yetersiz)\n`);
      continue;
    }
    const f = ozet(sub.map((r) => err(r, "FIZIK")));
    const p = ozet(sub.map((r) => err(r, "PERSIST")));
    let bw = 0;
    let bm = Infinity;
    for (const w of W_GRID) {
      const o = ozet(sub.map((r) => err(r, "HARMAN", w)));
      if (o && o.med < bm) {
        bm = o.med;
        bw = w;
      }
    }
    process.stdout.write(
      `${ad.padEnd(16)}${String(sub.length).padStart(3)}  ${f.med.toFixed(1).padStart(6)}  ${p.med.toFixed(1).padStart(8)}   w=${bw} → ${bm.toFixed(1)}°\n`
    );
  }

  /* ── kısa aralık kontrolü: persistence eskidikçe kötüleşir mi? ── */
  process.stdout.write("\npersistence'ın yaşı (önceki aralığın uzunluğu):\n");
  for (const [ad, sel] of [
    ["prevHours < 6", (r) => r.c.prevHours !== null && r.c.prevHours < 6],
    ["6–12", (r) => r.c.prevHours !== null && r.c.prevHours >= 6 && r.c.prevHours < 12],
    ["≥ 12", (r) => r.c.prevHours !== null && r.c.prevHours >= 12],
  ]) {
    const sub = pool.filter(sel);
    if (sub.length < 15) {
      process.stdout.write(`  ${ad.padEnd(14)}${String(sub.length).padStart(3)} (yetersiz)\n`);
      continue;
    }
    const p = ozet(sub.map((r) => err(r, "PERSIST")));
    const f = ozet(sub.map((r) => err(r, "FIZIK")));
    process.stdout.write(
      `  ${ad.padEnd(14)}${String(sub.length).padStart(3)}  PERSIST ${p.med.toFixed(1)}°  FIZIK ${f.med.toFixed(1)}°\n`
    );
  }

  /* ── BEKLENMEDİK BULGU: fizik hatası yangın yaşıyla büyüyor.
       Rakip açıklama: geçiş aralığı uzadıkça rüzgâr tahmini bayatlar.
       İkisi korelasyonlu → çapraz tablo ile ayrıştır. ── */
  process.stdout.write("\nGÜVEN AYRIŞTIRMASI — fizik medyan hatası (n):\n");
  const yasK = [
    ["<12sa", (r) => r.yasSa < 12],
    ["12-36", (r) => r.yasSa >= 12 && r.yasSa < 36],
    ["≥36sa", (r) => r.yasSa >= 36],
  ];
  const araK = [
    ["<8sa", (r) => r.c.hours < 8],
    ["8-12", (r) => r.c.hours >= 8 && r.c.hours < 12],
    ["≥12sa", (r) => r.c.hours >= 12],
  ];
  process.stdout.write("        yaş↓ / aralık→ " + araK.map(([a]) => a.padStart(11)).join("") + "\n");
  for (const [ya, ys] of yasK) {
    let ln = ya.padEnd(21);
    for (const [, as_] of araK) {
      const sub = pool.filter((r) => ys(r) && as_(r));
      const o = ozet(sub.map((r) => err(r, "FIZIK")));
      ln += (o && o.n >= 8 ? `${o.med.toFixed(0)}° (${o.n})` : `— (${sub.length})`).padStart(11);
    }
    process.stdout.write(ln + "\n");
  }
  // Tek değişkenli kenar toplamları — hangisi daha çok ayırıyor?
  for (const [ad, kova] of [["yaş", yasK], ["aralık", araK]]) {
    const parts = kova.map(([a, s]) => {
      const o = ozet(pool.filter(s).map((r) => err(r, "FIZIK")));
      return `${a}=${o ? o.med.toFixed(0) + "°" : "—"}`;
    });
    process.stdout.write(`  kenar (${ad}): ${parts.join("  ")}\n`);
  }
  // Boyut karışıklığı: yaşlı yangın aynı zamanda BÜYÜK yangın olabilir.
  const buyukK = [
    ["küçük (<3 km)", (r) => r.c.spanKm < 3],
    ["orta (3-10)", (r) => r.c.spanKm >= 3 && r.c.spanKm < 10],
    ["büyük (≥10)", (r) => r.c.spanKm >= 10],
  ];
  const bp = buyukK.map(([a, s]) => {
    const o = ozet(pool.filter(s).map((r) => err(r, "FIZIK")));
    return `${a}=${o && o.n >= 8 ? o.med.toFixed(0) + "°" : "—"}(${pool.filter(s).length})`;
  });
  process.stdout.write(`  kenar (boyut): ${bp.join("  ")}\n`);

  // Yaş kontrastı ürüne girmeye değer mi: olay-bazlı bootstrap ile
  // (genç − yaşlı) medyan farkının %95 GA'sı. Aynı yangın hem genç hem
  // yaşlı vaka verdiği için kontrast kısmen olay-içi — yangın kimliğini
  // kendiliğinden kontrol ediyor.
  {
    const byEv = new Map();
    for (const r of pool) {
      const v = err(r, "FIZIK");
      if (!Number.isFinite(v)) continue;
      if (!byEv.has(r.c.ev)) byEv.set(r.c.ev, []);
      byEv.get(r.c.ev).push({ yas: r.yasSa, v });
    }
    const evs = [...byEv.values()];
    const med = (a) => (a.length ? a.sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
    const diffs = [];
    for (let i = 0; i < 2000; i++) {
      const g = [];
      const o = [];
      for (let j = 0; j < evs.length; j++) {
        for (const x of evs[(Math.random() * evs.length) | 0]) {
          if (x.yas < 12) g.push(x.v);
          else if (x.yas >= 36) o.push(x.v);
        }
      }
      if (g.length >= 5 && o.length >= 5) diffs.push(med(o) - med(g));
    }
    diffs.sort((a, b) => a - b);
    const nokta =
      med(pool.filter((r) => r.yasSa >= 36).map((r) => err(r, "FIZIK")).filter(Number.isFinite)) -
      med(pool.filter((r) => r.yasSa < 12).map((r) => err(r, "FIZIK")).filter(Number.isFinite));
    process.stdout.write(
      `  yaş kontrastı (≥36sa − <12sa): ${nokta >= 0 ? "+" : ""}${nokta.toFixed(1)}°  ` +
        `%95 GA ${diffs.length ? `${diffs[(diffs.length * 0.025) | 0].toFixed(1)}…${diffs[(diffs.length * 0.975) | 0].toFixed(1)}°` : "—"}\n`
    );
  }

  return pool;
}

process.stdout.write(
  `${rows.length} vaka yüklendi (${new Set(rows.map((r) => r.c.ev)).size} yangın)\n` +
    "rastgele beklenti: ort 90° · medyan 90° · ≤45° %25 · >135° %25\n"
);
for (const gt of ["MERKEZ", "BAS"]) rapor(gt === "BAS" ? "ORMAN+MAKİ" : "ORMAN+MAKİ", gt);
