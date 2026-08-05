/**
 * 31 — 12 SAATLİK YENİDEN BAŞLATMA: uydu fiziği düzeltsin
 *
 * Literatürden (Beyki vd., ScienceDirect S2352938525002010): Rothermel
 * simülasyonunu VIIRS üretimiyle hizalı 12 saatlik aralıklarla yeniden
 * başlatıp yayılım hızını (ROS) uydu gözlemine göre düzeltmek.
 *
 * 🔑 Yönü bizim başarısız olan çerçevemizin TERSİ: ML fiziği değiştirmiyor,
 * uydu fiziği düzeltiyor. Ve ritmimiz zaten bu — vakaların %94'ü 10-14 saatlik
 * pencerede (VIIRS geçişleri).
 *
 * FİKİR: yangının ÖNCEKİ penceresinde model ne dedi, gözlem ne dedi?
 *   duzeltme = gözlenen_ilerleme / tahmin_edilen_ilerleme
 * Bunu ŞİMDİKİ pencereye α kuvvetiyle taşı:
 *   km_düzeltilmiş = km_tahmin × duzeltme^α
 * α=0 yayındaki davranış (düzeltme yok), α=1 tam güven.
 *
 * 🔴 SIZINTI YOK: düzeltme yalnız ÖNCEKİ pencereden, yani t0'dan önce
 *    gözlenmiş veriden hesaplanıyor.
 *
 * Ölçüt 29 ile aynı: TÜM yeni hücreler şeklin içinde mi + toplam alan.
 * α ve tavanlar TÜRKİYE DIŞINDA seçilir, TÜRKİYE'de raporlanır.
 *
 * Koşum: node scratchpad/isabet/31-yeniden-baslat.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { yakitOf } from "./04b-yakit-kod.mjs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const ORTADOGU = new Set(["Irak", "Suriye", "İran"]);

function interp(x, pts) {
  if (x <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}
const ROS = [[4, 0.26], [11, 0.44], [18, 0.47], [26, 0.83], [45, 1.3]];
const K = 1.5;
const SZ = [[0, 1], [30, 0.95], [60, 0.92], [90, 0.88], [120, 0.84], [150, 0.82], [180, 0.8]];
const SG = [[0, 1], [30, 0.94], [60, 0.88], [90, 0.82], [120, 0.24], [150, 0.17], [180, 0.16]];
const reachRatio = (off, kmh) => {
  const a = Math.min(180, Math.abs(off));
  const t = Math.max(0, Math.min(1, (kmh - 8) / 7));
  return interp(a, SZ) + (interp(a, SG) - interp(a, SZ)) * t;
};
const FUEL = { ORMAN: { sigma: 1500, beta: 0.03, waf: 0.15 }, MAKI: { sigma: 1800, beta: 0.012, waf: 0.3 } };
function rothDir(fuel, kmh, deg, slope, up) {
  const { sigma, beta, waf } = FUEL[fuel] ?? FUEL.MAKI;
  const betaOp = 3.348 * sigma ** -0.8189, C = 7.47 * Math.exp(-0.133 * sigma ** 0.55);
  const B = 0.02526 * sigma ** 0.54, E = 0.715 * Math.exp(-3.59e-4 * sigma);
  const pW = C * (Math.max(0, kmh) * 54.6807 * waf) ** B * (beta / betaOp) ** -E;
  const pS = 5.275 * beta ** -0.3 * (slope / 100) ** 2;
  const x = pW * Math.sin(toRad(deg)) + pS * Math.sin(toRad(up));
  const y = pW * Math.cos(toRad(deg)) + pS * Math.cos(toRad(up));
  return Math.hypot(x, y) < 1e-9 ? deg : (toDeg(Math.atan2(x, y)) + 360) % 360;
}

const clc = JSON.parse(readFileSync(here("clc-all.json"), "utf8"));
const wind = JSON.parse(readFileSync(here("akdeniz-ruzgar.json"), "utf8"));
const elev = JSON.parse(readFileSync(here("akdeniz-egim.json"), "utf8"));
const ckey = (c) => `${(Math.round(c.lat * 100) / 100).toFixed(2)},${(Math.round(c.lon * 100) / 100).toFixed(2)}`;
const wkey = (c) => `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
const gap = (a, b) => { const d = Math.abs(((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; };

const hepsi = [];
for (const f of readdirSync(here(".")).filter((f) => /^vaka-akdeniz-\d{4}\.json$/.test(f)).sort())
  hepsi.push(...JSON.parse(readFileSync(here(f), "utf8")));

/** Ürün geometrisi: integre baş erişimi (k=1,5) + Rothermel yönü. */
function tahmin(c) {
  const w = wind[wkey(c)], e = elev[ekey(c)];
  if (!w || !e) return null;
  const i0 = Math.round((c.t0 - w.t0) / 3600_000);
  const saat = Math.max(1, Math.round(c.hours));
  let km = 0, x = 0, y = 0, n = 0;
  for (let i = 0; i < saat; i++) {
    const s = w.spd[i0 + i], d = w.dir[i0 + i];
    if (typeof s !== "number" || typeof d !== "number") continue;
    km += K * interp(s, ROS);
    const to = (d + 180) % 360;
    x += s * Math.sin(toRad(to)); y += s * Math.cos(toRad(to)); n++;
  }
  if (!n) return null;
  const kmh = Math.hypot(x, y) / n;
  return { km, kmh, dir: rothDir(yakitOf(clc[ckey(c)]), kmh, (toDeg(Math.atan2(x, y)) + 360) % 360, e.egim, e.yokus) };
}

/* ── olaya göre sırala, her vakaya ÖNCEKİ pencerenin gözlem/tahmin oranını tak ── */
const olaylar = new Map();
for (const c of hepsi) {
  if (ORTADOGU.has(c.bolge)) continue;
  if (!["ORMAN", "MAKI"].includes(yakitOf(clc[ckey(c)]))) continue;
  if (!olaylar.has(c.ev)) olaylar.set(c.ev, []);
  olaylar.get(c.ev).push(c);
}

const rows = [];
let oncekiVar = 0;
for (const [, liste] of olaylar) {
  liste.sort((a, b) => a.t0 - b.t0);
  for (let i = 0; i < liste.length; i++) {
    const c = liste[i];
    if (!c.hucreler.length) continue; // kapsama ölçütü yalnız büyüyenleri sayar
    const t = tahmin(c);
    if (!t) continue;
    /* ÖNCEKİ pencere: gözlenen ilerleme / tahmin edilen ilerleme */
    let oran = null;
    const onceki = liste[i - 1];
    if (onceki && onceki.hucleri !== undefined) { /* koruma; alan adı aşağıda */ }
    if (onceki && onceki.hucreler && onceki.hucreler.length) {
      const to = tahmin(onceki);
      if (to && to.km > 0.05) {
        const gozlenen = Math.max(...onceki.hucreler.map(([, km]) => km));
        oran = gozlenen / to.km;
        oncekiVar++;
      }
    }
    rows.push({ tr: c.bolge === "Türkiye", hucreler: c.hucreler, ...t, oran });
  }
}
const sekilAlani = (kmh) => {
  let a = 0;
  for (let i = 0; i < 360; i++) {
    const r = reachRatio(Math.min(180, Math.abs(((i + 180) % 360) - 180)), kmh);
    a += 0.5 * r * r * ((2 * Math.PI) / 360);
  }
  return a;
};
for (const r of rows) r.sa = sekilAlani(r.kmh);
const TR = rows.filter((r) => r.tr), DIS = rows.filter((r) => !r.tr);
process.stdout.write(
  `${rows.length} vaka (Türkiye ${TR.length} · dış ${DIS.length})\n` +
    `önceki penceresi olan: ${oncekiVar} (%${((100 * oncekiVar) / rows.length).toFixed(0)}) — ` +
    `kalanında düzeltme uygulanmaz, yayındaki davranış sürer\n`
);
const oranlar = rows.filter((r) => r.oran !== null).map((r) => r.oran).sort((a, b) => a - b);
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
process.stdout.write(
  `düzeltme oranı (gözlenen/tahmin): medyan ${q(oranlar, 0.5).toFixed(2)} · ` +
    `%10 ${q(oranlar, 0.1).toFixed(2)} · %90 ${q(oranlar, 0.9).toFixed(2)} · max ${q(oranlar, 1).toFixed(1)}\n` +
    `  (medyan 1'e yakınsa fizik ortalamada doğru; yayılım genişse düzeltmede bilgi var)\n`
);

/* 🔑 HAM ORAN KULLANILAMAZ. Medyanı 0,29 — çünkü k=1,5 zaten %90 kapsama için
 * BİLEREK muhafazakâr. Ham oranı uygulamak o emniyet payını siler ve kapsamayı
 * alanla birlikte düşürür (aşağıdaki ilk tablo bunu gösteriyor).
 * Doğru biçim: oranı MEDYANA göre normalize et — mutlak muhafazakârlık korunur,
 * yalnız "bu yangın tipikten hızlı mı yavaş mı" bilgisi kalır. */
const ORAN_MEDYAN = q(oranlar, 0.5);

/** α kuvvetiyle düzeltilmiş bilanço. Tavan/taban aşırı oranları kırpar. */
function bilanco(set, alfa, taban = 0.5, tavan = 2.0, normalize = true) {
  let ok = 0, n = 0, alan = 0;
  for (const r of set) {
    const ham = r.oran === null ? null : normalize ? r.oran / ORAN_MEDYAN : r.oran;
    const d = ham === null ? 1 : Math.min(tavan, Math.max(taban, ham)) ** alfa;
    const km = r.km * d;
    alan += km * km * r.sa;
    for (const [brg, dist] of r.hucreler) {
      if (dist <= km * reachRatio(gap(r.dir, brg), r.kmh)) ok++;
      n++;
    }
  }
  return { kaps: ok / n, alan };
}

const tabanDis = bilanco(DIS, 0), tabanTR = bilanco(TR, 0);
process.stdout.write(
  `\nyayın (α=0) → dış kapsama %${(100 * tabanDis.kaps).toFixed(1)} · TR kapsama %${(100 * tabanTR.kaps).toFixed(1)}\n` +
    `\n${"═".repeat(76)}\nDIŞTA TARA (kapsama ≥ yayın, alan en az) → TÜRKİYE'de raporla\n${"═".repeat(76)}\n`
);

let en = null;
for (const alfa of [0.25, 0.5, 0.75, 1.0]) {
  for (const tavan of [1.5, 2.0, 3.0]) {
    for (const tb of [0.3, 0.5, 0.7]) {
      const d = bilanco(DIS, alfa, tb, tavan);
      if (d.kaps < tabanDis.kaps) continue;
      if (!en || d.alan < en.d.alan) en = { alfa, tavan, tb, d };
    }
  }
}
const yaz = (ad, d, t) =>
  process.stdout.write(
    `${ad.padEnd(22)} %${(100 * d.kaps).toFixed(1)}        ` +
      `${(1 - d.alan / tabanDis.alan >= 0 ? "−%" : "+%") + Math.abs(100 * (1 - d.alan / tabanDis.alan)).toFixed(1)}`.padEnd(15) +
      `  %${(100 * t.kaps).toFixed(1)}        ` +
      `${(1 - t.alan / tabanTR.alan >= 0 ? "−%" : "+%") + Math.abs(100 * (1 - t.alan / tabanTR.alan)).toFixed(1)}` +
      `${t.kaps >= tabanTR.kaps - 0.005 ? "  ✅" : "  🔴"}\n`
  );
process.stdout.write("düzeltme               dış kapsama   dış alan farkı   TR kapsama   TR alan farkı\n");
process.stdout.write("── HAM oran (emniyet payını siler — yanlış biçim) ──\n");
for (const alfa of [0.25, 0.5])
  yaz(`ham α=${alfa}`, bilanco(DIS, alfa, 0.5, 2.0, false), bilanco(TR, alfa, 0.5, 2.0, false));
process.stdout.write(`── NORMALİZE (medyan ${ORAN_MEDYAN.toFixed(2)}'e göre — doğru biçim) ──\n`);
for (const alfa of [0.25, 0.5, 0.75, 1.0])
  yaz(`normalize α=${alfa}`, bilanco(DIS, alfa, 0.5, 2.0), bilanco(TR, alfa, 0.5, 2.0));
/* ═══ BİRLEŞİM: rüzgâra bağlı k + yeniden başlatma ═══
 * Üç kaldıraç da tek başına ~%3 veriyor. Bağımsızlarsa toplanmalı; toplanmıyorsa
 * hepsi aynı fazlalığı kırpıyor demektir ve TAVAN buradadır. */
const K_EGRI = [[5, 1.4], [15, 1.6], [30, 1.4], [45, 1.4]]; // 29'un monoton-kısıtlı en iyisi
function bilancoBirlesik(set, alfa, kEgri) {
  let ok = 0, n = 0, alan = 0;
  for (const r of set) {
    const kOran = kEgri ? interp(r.kmh, kEgri) / K : 1; // k=1,5'e göre ölçek
    const d = r.oran === null ? 1 : Math.min(2, Math.max(0.5, r.oran / ORAN_MEDYAN)) ** alfa;
    const km = r.km * kOran * d;
    alan += km * km * r.sa;
    for (const [brg, dist] of r.hucreler) {
      if (dist <= km * reachRatio(gap(r.dir, brg), r.kmh)) ok++;
      n++;
    }
  }
  return { kaps: ok / n, alan };
}
process.stdout.write(`\n${"═".repeat(76)}\nBİRLEŞİM (rüzgâra bağlı k + yeniden başlatma) — TÜRKİYE\n${"═".repeat(76)}\n`);
for (const [ad, alfa, kE] of [
  ["yalnız k eğrisi", 0, K_EGRI],
  ["yalnız yeniden başlatma", 0.25, null],
  ["İKİSİ BİRDEN", 0.25, K_EGRI],
]) {
  const t = bilancoBirlesik(TR, alfa, kE);
  process.stdout.write(
    `${ad.padEnd(26)} kapsama %${(100 * t.kaps).toFixed(1)} (yayın %${(100 * tabanTR.kaps).toFixed(1)}) · ` +
      `alan ${(1 - t.alan / tabanTR.alan >= 0 ? "−%" : "+%") + Math.abs(100 * (1 - t.alan / tabanTR.alan)).toFixed(1)}` +
      `${t.kaps >= tabanTR.kaps - 0.005 ? "  ✅" : "  🔴"}\n`
  );
}

if (en) {
  const t = bilanco(TR, en.alfa, en.tb, en.tavan);
  process.stdout.write(
    `\nDIŞTA EN İYİ: α=${en.alfa} · kırpma ${en.tb}–${en.tavan}\n` +
      `  dışta: kapsama %${(100 * en.d.kaps).toFixed(1)} · alan %${(100 * (1 - en.d.alan / tabanDis.alan)).toFixed(1)} az\n` +
      `  🔴 TÜRKİYE'DE: kapsama %${(100 * t.kaps).toFixed(1)} (yayın %${(100 * tabanTR.kaps).toFixed(1)}) · ` +
      `alan %${(100 * (1 - t.alan / tabanTR.alan)).toFixed(1)} az\n` +
      (t.kaps >= tabanTR.kaps - 0.005 && t.alan < tabanTR.alan
        ? "  ✅ Kapsama korunuyor VE alan düşüyor\n"
        : "  ⚠️ Türkiye'ye taşınmadı\n")
  );
}
