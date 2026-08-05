/**
 * 32 — §6.3 WINDNINJA KARARI: korpus büyüdü, belirleyici ölçümü tekrarla
 *
 * 2026-08-04 değerlendirmesi (`20-windninja-DEGERLENDIRME.md`) kurulumu
 * ERTELEDİ ve gerekçesi tek bir ölçümdü:
 *
 *   "eğim ağırlığı k'nın olay-bazlı çapraz doğrulaması: katlar arası
 *    35 / 8 / 0,5 diye zıplıyor → veri, uydurulmuş arazi parametresini
 *    DESTEKLEMİYOR. 232 vaka / 78 olayla eğimin TEK parametresi bile
 *    kararlı fit edilemiyor; vadi kanalizasyonu ondan daha ince bir etki."
 *
 * Öneri: "şimdi değil, pan-Akdeniz korpusu kurulunca."
 * O korpus artık var: **2.383 vaka / 947 olay** (10× vaka, 12× olay).
 *
 * BU BETİK O ŞARTI SINIYOR. İki soru:
 *   ① Eğim ağırlığı k artık kararlı mı? (kararsızsa WindNinja'nın modelleyeceği
 *      DAHA İNCE etki hiç ayrışmaz — karar yine "hayır")
 *   ② Eğimin toplam katkısı ne? (2026-08-04'te 3°'ydi — tavanı bu belirliyor)
 *
 * Koşum: node scratchpad/isabet/32-windninja-karar.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { yakitOf } from "./04b-yakit-kod.mjs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const SAAT = 3600_000;
const ORTADOGU = new Set(["Irak", "Suriye", "İran"]);
const KAT = 5;
const TOHUM = 20260805;

/* deterministik karıştırma — kat ataması tekrarlanabilir olsun */
function rastgele(tohum) {
  let s = tohum;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

const clc = JSON.parse(readFileSync(here("clc-all.json"), "utf8"));
const ruzgar = JSON.parse(readFileSync(here("akdeniz-ruzgar.json"), "utf8"));
const egimler = JSON.parse(readFileSync(here("akdeniz-egim.json"), "utf8"));
const ckey = (c) => `${(Math.round(c.lat * 100) / 100).toFixed(2)},${(Math.round(c.lon * 100) / 100).toFixed(2)}`;
const wkey = (c) => `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
const fark = (a, b) => { const d = Math.abs(((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; };
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.floor(s.length / 2)].toFixed(1) : null; };

/* Rothermel — 05b-model.mjs ile birebir aynı */
const YAKIT = { ORMAN: { sigma: 1500, beta: 0.03, waf: 0.15 }, MAKI: { sigma: 1800, beta: 0.012, waf: 0.3 } };
function phis(yakit, kmh, egimPct) {
  const { sigma, beta, waf } = YAKIT[yakit] ?? YAKIT.MAKI;
  const betaOp = 3.348 * sigma ** -0.8189;
  const C = 7.47 * Math.exp(-0.133 * sigma ** 0.55);
  const B = 0.02526 * sigma ** 0.54;
  const E = 0.715 * Math.exp(-3.59e-4 * sigma);
  return {
    phiW: C * (Math.max(0, kmh) * 54.6807 * waf) ** B * (beta / betaOp) ** -E,
    phiS: 5.275 * beta ** -0.3 * (egimPct / 100) ** 2,
  };
}
function vecSum(parts) {
  let x = 0, y = 0;
  for (const [deg, mag] of parts) {
    if (deg === null || !Number.isFinite(deg) || !Number.isFinite(mag) || mag <= 0) continue;
    x += mag * Math.sin(toRad(deg));
    y += mag * Math.cos(toRad(deg));
  }
  return Math.hypot(x, y) < 1e-9 ? null : (toDeg(Math.atan2(x, y)) + 360) % 360;
}

/* ── satırlar ── */
const hepsi = [];
for (const f of readdirSync(here(".")).filter((f) => /^vaka-akdeniz-\d{4}\.json$/.test(f)).sort())
  hepsi.push(...JSON.parse(readFileSync(here(f), "utf8")));

const rows = [];
for (const c of hepsi) {
  if (ORTADOGU.has(c.bolge)) continue;
  const yk = yakitOf(clc[ckey(c)]);
  if (!["ORMAN", "MAKI"].includes(yk)) continue;
  if (c.cephe === null) continue;
  const w = ruzgar[wkey(c)], e = egimler[ekey(c)];
  if (!w || !e) continue;
  const i = Math.round((c.t0 - w.t0) / SAAT);
  const s = w.spd[i], d = w.dir[i];
  if (typeof s !== "number" || typeof d !== "number") continue;
  const wDeg = (d + 180) % 360;
  const { phiW, phiS } = phis(yk, s, e.egim);
  rows.push({ ev: c.ev, tr: c.bolge === "Türkiye", gercek: c.cephe, wDeg, yokus: e.yokus, egim: e.egim, phiW, phiS });
}
process.stdout.write(
  `${rows.length} vaka · ${new Set(rows.map((r) => r.ev)).size} olay ` +
    `(2026-08-04 değerlendirmesi: 232 vaka / 78 olay)\n${"═".repeat(74)}\n`
);

const hataFor = (set, k) =>
  set.map((r) => {
    const y = vecSum([[r.wDeg, r.phiW], [r.yokus, r.phiS * k]]);
    return y === null ? null : fark(y, r.gercek);
  }).filter((x) => x !== null);

/* ── ① EĞİMİN TOPLAM KATKISI ── */
process.stdout.write("① EĞİMİN TOPLAM KATKISI (k=0 → k=1)\n");
const h0 = hataFor(rows, 0), h1 = hataFor(rows, 1);
process.stdout.write(
  `   yalnız rüzgâr (k=0):  medyan ${med(h0)}°\n` +
    `   Rothermel  (k=1):     medyan ${med(h1)}°\n` +
    `   → katkı ${(med(h0) - med(h1)).toFixed(1)}°  (2026-08-04'te 3,0°)\n\n`
);

/* ── ② BELİRLEYİCİ ÖLÇÜM: k KARARLI MI? ── */
process.stdout.write(`② EĞİM AĞIRLIĞI k — OLAY BAZLI ${KAT} KATLI ÇAPRAZ DOĞRULAMA\n`);
const K_IZGARA = [];
for (let k = 0; k <= 40; k += 0.5) K_IZGARA.push(k);

const olaylar = [...new Set(rows.map((r) => r.ev))];
const rnd = rastgele(TOHUM);
const karisik = olaylar.map((e) => [e, rnd()]).sort((a, b) => a[1] - b[1]).map(([e]) => e);
const katOf = new Map(karisik.map((e, i) => [e, i % KAT]));

const secilen = [], testHata = [];
for (let kat = 0; kat < KAT; kat++) {
  const egt = rows.filter((r) => katOf.get(r.ev) !== kat);
  const tst = rows.filter((r) => katOf.get(r.ev) === kat);
  let enIyi = 0, enIyiH = Infinity;
  for (const k of K_IZGARA) {
    const m = med(hataFor(egt, k));
    if (m !== null && m < enIyiH) { enIyiH = m; enIyi = k; }
  }
  secilen.push(enIyi);
  testHata.push(med(hataFor(tst, enIyi)));
  process.stdout.write(`   kat ${kat + 1}: seçilen k=${enIyi.toString().padStart(5)} · test medyan ${testHata[kat]}°\n`);
}
const kMin = Math.min(...secilen), kMax = Math.max(...secilen);
const oran = kMin > 0 ? kMax / kMin : Infinity;
process.stdout.write(
  `\n   seçilen k'lar: ${secilen.join(" · ")}\n` +
    `   aralık ${kMin}–${kMax} · en büyük/en küçük = ${Number.isFinite(oran) ? oran.toFixed(1) + "×" : "∞ (biri 0)"}\n` +
    `   2026-08-04 (232 vaka): 35 / 8 / 0,5 → 70× zıplama\n\n`
);

/* ── ③ k'nın hata eğrisi ne kadar keskin? düz eğri = parametre belirsiz ── */
process.stdout.write("③ k'NIN HATA EĞRİSİ (düz eğri = veri k'yı belirlemiyor)\n");
const egri = [0, 0.5, 1, 2, 4, 8, 16, 32].map((k) => [k, med(hataFor(rows, k))]);
const enAz = Math.min(...egri.map(([, m]) => m));
for (const [k, m] of egri)
  process.stdout.write(`   k=${String(k).padStart(4)} → ${m}°  ${m === enAz ? "← en iyi" : "(+" + (m - enAz).toFixed(1) + "°)"}\n`);
const yayilim = Math.max(...egri.map(([, m]) => m)) - enAz;
process.stdout.write(`   tüm k aralığında toplam oynama: ${yayilim.toFixed(1)}°\n`);

/* ── ④ ASIL SORU: k'yı AYARLAMAK, üretimdeki k=1'i örneklem DIŞINDA geçiyor mu? ──
 * ③'teki "k=8 en iyi" örneklem İÇİ. Ayarlamanın değeri, aynı katlarda sabit
 * k=1 ile yarıştırılarak ölçülür — yoksa kendi eğitim verisine bakıp
 * "iyileştik" demiş oluruz. */
process.stdout.write("\n④ AYARLANMIŞ k, ÜRETİMDEKİ k=1'i GEÇİYOR MU (aynı test katlarında)\n");
let ayarT = 0, sabitT = 0, n = 0;
for (let kat = 0; kat < KAT; kat++) {
  const tst = rows.filter((r) => katOf.get(r.ev) === kat);
  const a = med(hataFor(tst, secilen[kat]));
  const s = med(hataFor(tst, 1));
  ayarT += a; sabitT += s; n++;
  process.stdout.write(
    `   kat ${kat + 1}: ayarlı(k=${secilen[kat]}) ${a}° · sabit(k=1) ${s}° · ` +
      `${a < s ? "ayarlı " + (s - a).toFixed(1) + "° iyi" : "sabit " + (a - s).toFixed(1) + "° iyi"}\n`
  );
}
const ayarOrt = ayarT / n, sabitOrt = sabitT / n;
process.stdout.write(
  `   ORTALAMA: ayarlı ${ayarOrt.toFixed(1)}° · sabit k=1 ${sabitOrt.toFixed(1)}° → ` +
    `${ayarOrt < sabitOrt ? "ayarlamak " + (sabitOrt - ayarOrt).toFixed(1) + "° kazandırıyor" : "AYARLAMAK KAZANDIRMIYOR (" + (ayarOrt - sabitOrt).toFixed(1) + "° kötü)"}\n`
);

/* ── HÜKÜM ── */
const kararli = Number.isFinite(oran) && oran <= 4;
process.stdout.write(
  `\n${"═".repeat(74)}\nHÜKÜM\n` +
    `   k kararlı mı? ${kararli ? "EVET" : "HAYIR"} (${Number.isFinite(oran) ? oran.toFixed(1) + "× oynama" : "bir kat 0 seçti"})\n` +
    `   Eğimin toplam katkısı: ${(med(h0) - med(h1)).toFixed(1)}°\n` +
    `   → WindNinja'nın modellediği vadi kanalizasyonu, eğimden DAHA İNCE bir etki.\n` +
    `   ${kararli
      ? "Eğim parametresi artık kararlı → WindNinja denemeye değer."
      : "Eğimin TEK parametresi hâlâ kararlı oturmuyor → daha ince bir etki ayrışmaz. KURMA."}\n`
);
