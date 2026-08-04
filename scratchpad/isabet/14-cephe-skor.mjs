/**
 * 14 — Aynı vakalar, ALTI farklı "gerçek yön" tanımı (spec §6.2 karnesi)
 *
 * Tanımlar:
 *   merkez     a geçişinin KÜTLE MERKEZİ → yeni piksellerin merkezi   (02'nin ölçütü, yayındaki 68°)
 *   bas        aynı çapa, yeni piksellerin en uzak 1/3'ü               (02'nin ikinci ölçütü)
 *   cephe      her yeni piksel KENDİ en yakın yanmış pikselinden       (üretim progression.ts)
 *   cepheBas   aynı, en uzak 1/3 dilim
 *   alan       ayak izi hücre maskesinin ALAN merkezi kayması          (concave hull merkezi)
 *   alanCephe  yeni HÜCRELERİN en yakın yanmış hücreden yönü          (yoğunluk-nötr cephe)
 *
 * ⚠️ Kazanan tanım, hatayı en küçük yapan tanım DEĞİLDİR — öyle seçmek
 * kendi kendini doğrulayan iddiadır. Tanım önceden gerekçelenir: cephe
 * ölçütleri yangının BOYUNDAN bağımsızdır, merkez çapası değildir.
 */
import { readFileSync } from "node:fs";
import { angDiff, bootCI, bootDiff, ekey, ozet, phis, vecSum, windAt } from "./fizik.mjs";

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
let eksikCevre = 0;
for (const c of cases) {
  if (!["ORMAN", "MAKI", "OT"].includes(c.yakit)) continue;
  const e = elev[ekey(c)];
  const w = windAt(wind, c, c.t0, c.t0);
  if (!e || !w) {
    eksikCevre++;
    continue;
  }
  const { phiW, phiS } = phis(c.yakit, w.kmh, e.egim);
  rows.push({
    c,
    e,
    w,
    fizik: vecSum([[w.deg, phiW], [e.yokus, phiS]]),
    oracle: windAt(wind, c, c.t0, c.t1)?.deg ?? null,
    yasSa: (c.t0 - evT0.get(c.ev)) / 3600_000,
    sezon: new Date(c.t0).getUTCFullYear(),
  });
}

const OLCUTLER = ["merkez", "bas", "cephe", "cepheBas", "alan", "alanCephe"];
const MODELLER = [
  ["RUZGAR", (r) => r.w.deg],
  ["FIZIK", (r) => r.fizik],
  ["ORACLE", (r) => r.oracle],
  ["PERSIST", (r, o) => r.c.prev?.[o] ?? null],
];

process.stdout.write(
  `${rows.length} doğal-yakıt vakası (${eksikCevre} çevre verisi eksik) · ` +
    `${new Set(rows.map((r) => r.c.ev)).size} yangın\n` +
    "rastgele beklenti: medyan 90° · ≤45° %25 · >135° %25\n"
);

const forest = (r) => r.c.yakit !== "OT";

function tablo(baslik, sel) {
  process.stdout.write(`\n${"═".repeat(78)}\n${baslik}\n${"═".repeat(78)}\n`);
  process.stdout.write("ölçüt        model      n   medyan°  ort°   ≤45°  >135°   medyan %95 GA\n");
  const kayit = {};
  for (const o of OLCUTLER) {
    const pool = rows.filter((r) => sel(r) && r.c[o] !== null);
    if (pool.length < 20) {
      process.stdout.write(`${o.padEnd(12)} (yetersiz: ${pool.length})\n`);
      continue;
    }
    kayit[o] = { pool: pool.length, evs: new Set(pool.map((r) => r.c.ev)).size };
    for (const [ad, pick] of MODELLER) {
      const vals = pool.map((r) => {
        const t = pick(r, o);
        return t === null ? NaN : angDiff(t, r.c[o]);
      });
      const s = ozet(vals);
      if (!s) continue;
      const ci = bootCI(
        pool.map((r) => {
          const t = pick(r, o);
          return { ev: r.c.ev, v: t === null ? NaN : angDiff(t, r.c[o]) };
        })
      );
      process.stdout.write(
        `${(ad === "RUZGAR" ? o : "").padEnd(12)}${ad.padEnd(9)}${String(s.n).padStart(4)}  ` +
          `${s.med.toFixed(1).padStart(6)} ${s.ort.toFixed(1).padStart(6)}  ` +
          `${("%" + s.p45.toFixed(0)).padStart(5)} ${("%" + s.ust135.toFixed(0)).padStart(6)}   ` +
          `${ci ? `${ci[0].toFixed(0)}–${ci[1].toFixed(0)}°` : "—"}\n`
      );
      if (ad === "FIZIK") kayit[o].fizik = s.med;
    }
    process.stdout.write("\n");
  }
  return kayit;
}

const k = tablo("ORMAN + MAKİ", forest);

/* ── merkez → cephe geçişinin eşleşmiş farkı (aynı vakalarda) ── */
{
  const pool = rows.filter((r) => forest(r) && r.c.merkez !== null && r.c.cephe !== null);
  const eş = pool.map((r) => ({
    ev: r.c.ev,
    a: r.fizik === null ? NaN : angDiff(r.fizik, r.c.cephe),
    b: r.fizik === null ? NaN : angDiff(r.fizik, r.c.merkez),
  }));
  const d = bootDiff(eş);
  const ort = eş.filter((x) => Number.isFinite(x.a)).reduce((s, x) => s + (x.a - x.b), 0) / eş.filter((x) => Number.isFinite(x.a)).length;
  process.stdout.write(
    `${"─".repeat(78)}\nAYNI ${pool.length} VAKADA tanım değişikliğinin etkisi (fizik modeli, cephe − merkez):\n` +
      `  ortalama hata farkı ${ort >= 0 ? "+" : ""}${ort.toFixed(1)}°  %95 GA ${d ? `${d[0].toFixed(1)}…${d[1].toFixed(1)}°` : "—"}\n` +
      `  (negatif = cephe tanımı daha az hata; GA sıfırı içeriyorsa fark KANITLANMADI)\n`
  );
}

/* ── yaş kontrastı, en iyi gerekçelenmiş ölçütle (cephe) ── */
for (const o of ["cephe", "cepheBas", "merkez"]) {
  const pool = rows.filter((r) => forest(r) && r.c[o] !== null && r.fizik !== null);
  const byEv = new Map();
  for (const r of pool) {
    if (!byEv.has(r.c.ev)) byEv.set(r.c.ev, []);
    byEv.get(r.c.ev).push({ yas: r.yasSa, v: angDiff(r.fizik, r.c[o]) });
  }
  const evs = [...byEv.values()];
  const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
  const genc = pool.filter((r) => r.yasSa < 12).map((r) => angDiff(r.fizik, r.c[o]));
  const yasli = pool.filter((r) => r.yasSa >= 36).map((r) => angDiff(r.fizik, r.c[o]));
  const diffs = [];
  for (let i = 0; i < 2000; i++) {
    const g = [];
    const y = [];
    for (let j = 0; j < evs.length; j++)
      for (const x of evs[(Math.random() * evs.length) | 0]) {
        if (x.yas < 12) g.push(x.v);
        else if (x.yas >= 36) y.push(x.v);
      }
    if (g.length >= 5 && y.length >= 5) diffs.push(med(y) - med(g));
  }
  diffs.sort((a, b) => a - b);
  process.stdout.write(
    `yaş kontrastı [${o}] genç<12sa ${med(genc)?.toFixed(0)}° (n=${genc.length}) · yaşlı≥36sa ${med(yasli)?.toFixed(0)}° (n=${yasli.length}) · ` +
      `fark +${(med(yasli) - med(genc)).toFixed(1)}° GA ${diffs.length ? `${diffs[(diffs.length * 0.025) | 0].toFixed(1)}…${diffs[(diffs.length * 0.975) | 0].toFixed(1)}°` : "—"}\n`
  );
}

void k;
