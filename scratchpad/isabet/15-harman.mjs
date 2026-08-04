/**
 * 15 — HARMAN, CEPHE TANIMIYLA (spec §6.1'in ikinci denemesi)
 *
 * 12-persistence.mjs harmanı MERKEZ çapalı tanımla denedi ve kazanç YOKTU
 * (sezon-dışı +1,3° daha kötü). Ama 14-cephe-skor.mjs şunu gösterdi:
 * persistence'ın değeri ÖLÇÜTE bağlı —
 *   merkez    tanımında PERSIST 91° (rüzgâr 67°)  → çöp
 *   cephe     tanımında PERSIST 75° (rüzgâr 76°)  → eşit
 *   alanCephe tanımında PERSIST 72° (rüzgâr 80°)  → RÜZGÂRI GEÇİYOR
 *
 * Sebep fiziksel: cephe ölçütü yangının kendi eksenini ölçer, merkez çapası
 * yangının BOYUNU yön ölçüsüne karıştırır. "Önceki yön" ancak boyuttan
 * arındırılmış bir ölçütte anlamlı bir büyüklüktür.
 *
 * Burada: iki karşılaştırılabilir yetenekli tahminciyi (fizik + persistence)
 * vektörel harmanlıyoruz. w SEZON-DIŞI seçilir, kazanç EŞLEŞMİŞ farkla ve
 * olay-bazlı bootstrap ile sınanır.
 */
import { readFileSync } from "node:fs";
import { angDiff, bootDiff, ekey, ozet, phis, vecSum, windAt } from "./fizik.mjs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const cases = JSON.parse(readFileSync(here("cases-cephe.json"), "utf8"));
const wind = JSON.parse(readFileSync(here("wind-w.json"), "utf8"));
const elev = JSON.parse(readFileSync(here("elev-srtm.json"), "utf8"));

const evT0 = new Map();
for (const c of cases) {
  const t = evT0.get(c.ev);
  if (t === undefined || c.t0 < t) evT0.set(c.ev, c.t0);
}

const rows = [];
for (const c of cases) {
  if (!["ORMAN", "MAKI"].includes(c.yakit)) continue; // orman+maki (otlak ayrı rejim)
  const e = elev[ekey(c)];
  const w = windAt(wind, c, c.t0, c.t0);
  if (!e || !w) continue;
  const { phiW, phiS } = phis(c.yakit, w.kmh, e.egim);
  rows.push({
    c,
    fizik: vecSum([[w.deg, phiW], [e.yokus, phiS]]),
    windKmh: w.kmh,
    yasSa: (c.t0 - evT0.get(c.ev)) / 3600_000,
    sezon: new Date(c.t0).getUTCFullYear(),
  });
}

const W_GRID = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

function rapor(olcut) {
  // adil altküme: gerçek yön + persistence + fizik dolu
  const pool = rows.filter((r) => r.c[olcut] !== null && r.c.prev?.[olcut] != null && r.fizik !== null);
  const evs = new Set(pool.map((r) => r.c.ev)).size;
  process.stdout.write(`\n${"═".repeat(74)}\nÖLÇÜT: ${olcut} · ${pool.length} vaka / ${evs} yangın\n${"═".repeat(74)}\n`);
  if (pool.length < 25) {
    process.stdout.write("yetersiz\n");
    return;
  }
  const truth = (r) => r.c[olcut];
  const persist = (r) => r.c.prev[olcut];
  const harman = (r, w) => vecSum([[persist(r), w], [r.fizik, 1 - w]]);
  const errF = (r) => angDiff(r.fizik, truth(r));
  const errP = (r) => angDiff(persist(r), truth(r));
  const errH = (r, w) => {
    const t = harman(r, w);
    return t === null ? NaN : angDiff(t, truth(r));
  };

  const f = ozet(pool.map(errF));
  const p = ozet(pool.map(errP));
  process.stdout.write(
    `  FIZIK      medyan ${f.med.toFixed(1)}°  ort ${f.ort.toFixed(1)}°  ≤45° %${f.p45.toFixed(0)}  >135° %${f.ust135.toFixed(0)}\n` +
      `  PERSIST    medyan ${p.med.toFixed(1)}°  ort ${p.ort.toFixed(1)}°  ≤45° %${p.p45.toFixed(0)}  >135° %${p.ust135.toFixed(0)}\n`
  );

  process.stdout.write("  w taraması (tüm veri, SEÇİM DEĞİL):  ");
  for (const w of W_GRID) {
    const s = ozet(pool.map((r) => errH(r, w)));
    process.stdout.write(`${w}:${s ? s.med.toFixed(0) : "—"}  `);
  }
  process.stdout.write("\n");

  /* sezon-dışı w seçimi — ortalama hatayı küçültecek şekilde (medyan zıplıyor) */
  const sezonlar = [...new Set(pool.map((r) => r.sezon))].sort();
  const oos = [];
  const secilen = [];
  for (const s of sezonlar) {
    const train = pool.filter((r) => r.sezon !== s);
    const test = pool.filter((r) => r.sezon === s);
    if (train.length < 25 || test.length < 4) continue;
    let bw = 0;
    let bm = Infinity;
    for (const w of W_GRID) {
      const o = ozet(train.map((r) => errH(r, w)));
      if (o && o.ort < bm) {
        bm = o.ort;
        bw = w;
      }
    }
    secilen.push(`${s}:${bw}`);
    for (const r of test) oos.push({ ev: r.c.ev, h: errH(r, bw), fz: errF(r) });
  }
  if (!oos.length) return;
  const h = ozet(oos.map((x) => x.h));
  const fz = ozet(oos.map((x) => x.fz));
  const d = bootDiff(oos.map((x) => ({ ev: x.ev, a: x.h, b: x.fz })));
  const ortFark = oos.reduce((s, x) => s + (x.h - x.fz), 0) / oos.length;
  const medFark = h.med - fz.med;
  process.stdout.write(
    `  SEZON-DIŞI · seçilen w: ${secilen.join(" ")}\n` +
      `    HARMAN medyan ${h.med.toFixed(1)}°  ort ${h.ort.toFixed(1)}°  ≤45° %${h.p45.toFixed(0)}  >135° %${h.ust135.toFixed(0)}\n` +
      `    FIZIK  medyan ${fz.med.toFixed(1)}°  ort ${fz.ort.toFixed(1)}°  ≤45° %${fz.p45.toFixed(0)}  >135° %${fz.ust135.toFixed(0)}\n` +
      `    eşleşmiş fark (harman−fizik): ort ${ortFark >= 0 ? "+" : ""}${ortFark.toFixed(1)}°  ` +
      `%95 GA ${d ? `${d[0].toFixed(1)}…${d[1].toFixed(1)}°` : "—"}   medyan farkı ${medFark >= 0 ? "+" : ""}${medFark.toFixed(1)}°\n` +
      `    → ${d && d[1] < 0 ? "✅ KAZANÇ KANITLI (GA tamamen negatif)" : "❌ kazanç kanıtlanmadı"}\n`
  );

  /* rüzgâr rejimine göre: zayıf rüzgârda persistence daha mı değerli? */
  process.stdout.write("  rüzgâr rejimi (tüm veride en iyi w):\n");
  for (const [ad, sel] of [
    ["<8 km/sa", (r) => r.windKmh < 8],
    ["8–15", (r) => r.windKmh >= 8 && r.windKmh < 15],
    ["≥15", (r) => r.windKmh >= 15],
  ]) {
    const sub = pool.filter(sel);
    if (sub.length < 15) {
      process.stdout.write(`    ${ad.padEnd(10)} n=${sub.length} (yetersiz)\n`);
      continue;
    }
    let bw = 0;
    let bm = Infinity;
    for (const w of W_GRID) {
      const o = ozet(sub.map((r) => errH(r, w)));
      if (o && o.ort < bm) {
        bm = o.ort;
        bw = w;
      }
    }
    process.stdout.write(
      `    ${ad.padEnd(10)} n=${String(sub.length).padStart(3)}  fizik ${ozet(sub.map(errF)).ort.toFixed(0)}°  ` +
        `persist ${ozet(sub.map(errP)).ort.toFixed(0)}°  en iyi w=${bw} → ${bm.toFixed(0)}°\n`
    );
  }
}

process.stdout.write(`${rows.length} orman+maki vakası\n`);
for (const o of ["cephe", "cepheBas", "alanCephe", "merkez"]) rapor(o);
