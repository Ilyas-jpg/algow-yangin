/**
 * 29 — YAYINDAKİ %90 KAPSAMA İDDİASININ 10× KORPUSTA SINANMASI
 *
 * `19-kapsama2.mjs`'in birebir aynı geometrisi ve ölçütü, YENİ korpusla:
 * 232 Türkiye vakası yerine 2.874 pan-Akdeniz vakası.
 *
 * NEDEN: yayındaki ROS çapaları ham ölçümü n=107 / 139 / 27 / 15 olan bir
 * setten geliyor — karar veren üst uçta n=27 ve n=15 — ve 45 km/sa çapası hiç
 * ölçülmemiş ("trendden uzatıldı").
 * İddia bir kez zaten yanlış çıkmıştı (yayınlanan %90, sezon-dışı sınamada
 * %81 → çapalar ×1,5). Şimdi şekil değil KORPUS değişti; 19'un kendi başlığındaki
 * ilke aynen geçerli: kalibrasyonu yenilemeden bırakmak iddiayı sessizce
 * yanlışlamaktır.
 *
 * 🔴 ASIL SORU COĞRAFİ: ürün TÜRKİYE'de çalışıyor. Bu yüzden D bölümü k'yı
 * Türkiye DIŞINDA seçip Türkiye'de sınıyor — sezon-dışı değil, ÜLKE-dışı.
 *
 * ⚠️ 19'dan tek fark: yakıt havuzu ORMAN+MAKİ (OT yok), çünkü çevre verisi
 * (26-akdeniz-cevre.mjs) yalnız o havuz için çekildi.
 *
 * Koşum: node scratchpad/isabet/29-kapsama-akdeniz.mjs
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
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

/* ── ÜRÜNDEKİ ham çapalar (yayında k=1,5 gömülü) — 19 ile birebir ── */
const ROS_ANCHORS = [[4, 0.26], [11, 0.44], [18, 0.47], [26, 0.83], [45, 1.3]];
const headSpreadKmh = (w, k = 1) => k * interp(w, ROS_ANCHORS);
const K_YAYIN = 1.5;

/* ── Yayındaki rüzgâra bağlı şekil ── */
const SHAPE_ZAYIF = [[0, 1.0], [30, 0.95], [60, 0.92], [90, 0.88], [120, 0.84], [150, 0.82], [180, 0.8]];
const SHAPE_GUCLU = [[0, 1.0], [30, 0.94], [60, 0.88], [90, 0.82], [120, 0.24], [150, 0.17], [180, 0.16]];
const ZAYIF_KMH = 8;
const GUCLU_KMH = 15;
function reachRatio(off, kmh) {
  const a = Math.min(180, Math.abs(off));
  const z = interp(a, SHAPE_ZAYIF);
  const g = interp(a, SHAPE_GUCLU);
  const t = Math.max(0, Math.min(1, (kmh - ZAYIF_KMH) / (GUCLU_KMH - ZAYIF_KMH)));
  return z + (g - z) * t;
}

const FUEL = {
  ORMAN: { sigma: 1500, beta: 0.03, waf: 0.15 },
  MAKI: { sigma: 1800, beta: 0.012, waf: 0.3 },
};
function rothermelDir(fuel, kmh, deg, slopePct, upslope) {
  const { sigma, beta, waf } = FUEL[fuel] ?? FUEL.MAKI;
  const betaOp = 3.348 * sigma ** -0.8189;
  const C = 7.47 * Math.exp(-0.133 * sigma ** 0.55);
  const B = 0.02526 * sigma ** 0.54;
  const E = 0.715 * Math.exp(-3.59e-4 * sigma);
  const phiW = C * (Math.max(0, kmh) * 54.6807 * waf) ** B * (beta / betaOp) ** -E;
  const phiS = 5.275 * beta ** -0.3 * (slopePct / 100) ** 2;
  const x = phiW * Math.sin(toRad(deg)) + phiS * Math.sin(toRad(upslope));
  const y = phiW * Math.cos(toRad(deg)) + phiS * Math.cos(toRad(upslope));
  return Math.hypot(x, y) < 1e-9 ? deg : (toDeg(Math.atan2(x, y)) + 360) % 360;
}

/* ── korpus ── */
const clc = JSON.parse(readFileSync(here("clc-all.json"), "utf8"));
const wind = JSON.parse(readFileSync(here("akdeniz-ruzgar.json"), "utf8"));
const elev = JSON.parse(readFileSync(here("akdeniz-egim.json"), "utf8"));
const ckey = (c) => `${(Math.round(c.lat * 100) / 100).toFixed(2)},${(Math.round(c.lon * 100) / 100).toFixed(2)}`;
const wkey = (c) => `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}|${new Date(c.t0).getUTCFullYear()}`;
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
const gap = (a, b) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

const hepsi = [];
for (const f of readdirSync(here(".")).filter((f) => /^vaka-akdeniz-\d{4}\.json$/.test(f)).sort())
  hepsi.push(...JSON.parse(readFileSync(here(f), "utf8")));

/** Ürün mantığı: vaka süresince saat saat integre baş erişimi + Rothermel yönü. */
function reachFor(c, k) {
  const w = wind[wkey(c)];
  const e = elev[ekey(c)];
  if (!w || !e) return null;
  const i0 = Math.round((c.t0 - w.t0) / 3600_000);
  const saat = Math.max(1, Math.round(c.hours));
  let km = 0, x = 0, y = 0, n = 0;
  for (let i = 0; i < saat; i++) {
    const s = w.spd[i0 + i], d = w.dir[i0 + i];
    if (typeof s !== "number" || typeof d !== "number") continue;
    km += headSpreadKmh(s, k);
    const to = (d + 180) % 360;
    x += s * Math.sin(toRad(to));
    y += s * Math.cos(toRad(to));
    n++;
  }
  if (!n) return null;
  const wDeg = (toDeg(Math.atan2(x, y)) + 360) % 360;
  const wKmh = Math.hypot(x, y) / n;
  return { km, kmh: wKmh, dir: rothermelDir(yakitOf(clc[ckey(c)]), wKmh, wDeg, e.egim, e.yokus) };
}

const rows = [];
for (const c of hepsi) {
  if (ORTADOGU.has(c.bolge)) continue;
  if (!["ORMAN", "MAKI"].includes(yakitOf(clc[ckey(c)]))) continue;
  if (!c.hucreler.length) continue;
  if (!reachFor(c, 1)) continue;
  rows.push({ c, yil: new Date(c.t0).getUTCFullYear(), tr: c.bolge === "Türkiye" });
}
const TR = rows.filter((r) => r.tr);
const DIS = rows.filter((r) => !r.tr);
process.stdout.write(
  `${rows.length} vaka · ${rows.reduce((s, r) => s + r.c.hucreler.length, 0)} hücre\n` +
    `  Türkiye ${TR.length} vaka / ${TR.reduce((s, r) => s + r.c.hucreler.length, 0)} hücre · ` +
    `dış ${DIS.length} vaka / ${DIS.reduce((s, r) => s + r.c.hucreler.length, 0)} hücre\n`
);

/** TÜM yeni hücreler şeklin içinde mi (kullanıcının okuduğu "yangın bunu aşmaz"). */
function kapsama(set, k) {
  let okVaka = 0, nVaka = 0, okHucre = 0, nHucre = 0;
  for (const r of set) {
    const rr = reachFor(r.c, k);
    if (!rr) continue;
    let hepsiIcinde = true;
    for (const [brg, km] of r.c.hucreler) {
      const sinir = rr.km * reachRatio(gap(rr.dir, brg), rr.kmh);
      if (km <= sinir) okHucre++;
      else hepsiIcinde = false;
      nHucre++;
    }
    if (hepsiIcinde) okVaka++;
    nVaka++;
  }
  return { vaka: okVaka / nVaka, hucre: okHucre / nHucre, nVaka, nHucre };
}

const K_GRID = [];
for (let k = 0.5; k <= 20; k += 0.25) K_GRID.push(+k.toFixed(2));
const kIcin = (set, hedef = 0.9) => {
  let best = 1, bestD = Infinity;
  for (const k of K_GRID) {
    const d = Math.abs(kapsama(set, k).hucre - hedef);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
};

/* ═══ A) YAYINDAKİ AYAR (k=1,5) YENİ KORPUSTA NE VERİYOR ═══ */
process.stdout.write(`\n${"═".repeat(74)}\nA) YAYINDAKİ AYAR (k=${K_YAYIN}) — iddia: hücre kapsaması %90\n${"═".repeat(74)}\n`);
process.stdout.write("küme                 vaka kapsaması   hücre kapsaması\n");
for (const [ad, set] of [["TÜMÜ", rows], ["Türkiye (ürünün sahası)", TR], ["dış", DIS]]) {
  const c = kapsama(set, K_YAYIN);
  process.stdout.write(
    `${ad.padEnd(22)}${("%" + (100 * c.vaka).toFixed(0)).padStart(8)}${("%" + (100 * c.hucre).toFixed(1)).padStart(18)}` +
      `   (n=${c.nVaka} vaka)\n`
  );
}

/* ═══ B) %90 İÇİN GEREKEN k ═══ */
process.stdout.write(`\n${"═".repeat(74)}\nB) %90 HÜCRE KAPSAMASI İÇİN GEREKEN k\n${"═".repeat(74)}\n`);
for (const [ad, set] of [["TÜMÜ", rows], ["Türkiye", TR], ["dış", DIS]]) {
  const k = kIcin(set);
  const c = kapsama(set, k);
  process.stdout.write(
    `${ad.padEnd(10)} k=${String(k).padStart(5)} (yayında ${K_YAYIN}) → hücre %${(100 * c.hucre).toFixed(0)} · vaka %${(100 * c.vaka).toFixed(0)}\n` +
      `           çapalar: ${ROS_ANCHORS.map(([w, r]) => `${w}→${(r * k).toFixed(2)}`).join(" · ")}\n`
  );
}

/* ═══ C) ÜLKE-DIŞI SINAMA — asıl soru ═══ */
process.stdout.write(`\n${"═".repeat(74)}\nC) ÜLKE-DIŞI: k Türkiye DIŞINDA seçilir, Türkiye'de sınanır\n${"═".repeat(74)}\n`);
const kDis = kIcin(DIS);
const trIle = kapsama(TR, kDis);
process.stdout.write(
  `dışta seçilen k=${kDis} → Türkiye'de hücre %${(100 * trIle.hucre).toFixed(0)} · vaka %${(100 * trIle.vaka).toFixed(0)}\n` +
    `${trIle.hucre >= 0.88 ? "✅ taşınıyor" : "🔴 TAŞIMIYOR — hedef %90"}\n`
);

/* ═══ D) SEZON-DIŞI (19 ile aynı, yeni korpusta) ═══ */
process.stdout.write(`\n${"═".repeat(74)}\nD) SEZON-DIŞI (k diğer sezonlarda seçilir, tutulan sezonda sınanır)\n${"═".repeat(74)}\n`);
const yillar = [...new Set(rows.map((r) => r.yil))].sort();
const test = [], ks = [];
for (const y of yillar) {
  const te = rows.filter((r) => r.yil === y);
  const tr = rows.filter((r) => r.yil !== y);
  if (te.length < 20) continue;
  const k = kIcin(tr);
  ks.push(`${y}:${k}`);
  test.push(kapsama(te, k).hucre);
}
process.stdout.write(
  `seçilen k → ${ks.join(" ")}\nsezon-dışı hücre kapsaması ort. %${((100 * test.reduce((a, b) => a + b, 0)) / test.length).toFixed(0)} ` +
    `(${test.map((t) => "%" + (100 * t).toFixed(0)).join(" ")})\n`
);

/* ═══ E) §7.6 — AYNI KAPSAMADA DAHA AZ ALAN ═══
 * k şu an TEK küresel sabit. Ama gerekli pay rüzgâra göre değişiyorsa,
 * rüzgâra bağlı k aynı %90'ı daha küçük alanla verir. Ölçelim. */
process.stdout.write(`\n${"═".repeat(74)}\nE) §7.6 — k rüzgâra göre değişmeli mi (aynı kapsama, daha az alan)\n${"═".repeat(74)}\n`);

/** Şeklin göreli alanı (yarıçap 1) — açı üzerinden integre. */
function sekilAlani(kmh) {
  let a = 0;
  const N = 360;
  for (let i = 0; i < N; i++) {
    const off = Math.min(180, Math.abs(((i + 180) % 360) - 180));
    const r = reachRatio(off, kmh);
    a += 0.5 * r * r * ((2 * Math.PI) / N);
  }
  return a;
}
/** Vakanın çizilen alanı: (k·baş erişimi)² × şekil alanı. */
function vakaAlani(r, k) {
  const rr = reachFor(r.c, k);
  return rr ? rr.km * rr.km * sekilAlani(rr.kmh) : 0;
}

const RUZ_KENAR = [0, 6, 10, 14, 18, 200];
const kovaOf = (kmh) => {
  for (let i = 0; i < RUZ_KENAR.length - 1; i++) if (kmh >= RUZ_KENAR[i] && kmh < RUZ_KENAR[i + 1]) return i;
  return RUZ_KENAR.length - 2;
};
for (const r of rows) r.kova = kovaOf(reachFor(r.c, 1).kmh);

process.stdout.write("rüzgâr kovası      n vaka   %90 için k   yayın k=1.5'te kapsama\n");
const kKova = [];
for (let i = 0; i < RUZ_KENAR.length - 1; i++) {
  const s = rows.filter((r) => r.kova === i);
  if (s.length < 40) { kKova.push(K_YAYIN); continue; }
  const k = kIcin(s);
  kKova.push(k);
  process.stdout.write(
    `${String(RUZ_KENAR[i]).padStart(3)}-${String(RUZ_KENAR[i + 1] > 100 ? "∞" : RUZ_KENAR[i + 1]).padEnd(4)} km/sa ` +
      `${String(s.length).padStart(8)}   ${String(k).padStart(9)}   ` +
      `%${(100 * kapsama(s, K_YAYIN).hucre).toFixed(0)}\n`
  );
}

/* aynı kapsamada alan kıyası */
const alanSabit = rows.reduce((a, r) => a + vakaAlani(r, K_YAYIN), 0);
const alanKova = rows.reduce((a, r) => a + vakaAlani(r, kKova[r.kova]), 0);
const kapsSabit = kapsama(rows, K_YAYIN).hucre;
let okH = 0, nH = 0;
for (const r of rows) {
  const rr = reachFor(r.c, kKova[r.kova]);
  for (const [brg, km] of r.c.hucreler) {
    if (km <= rr.km * reachRatio(gap(rr.dir, brg), rr.kmh)) okH++;
    nH++;
  }
}
process.stdout.write(
  `\nSABİT k=${K_YAYIN}          → kapsama %${(100 * kapsSabit).toFixed(1)} · toplam alan ${alanSabit.toFixed(0)} (birim)\n` +
    `RÜZGÂRA BAĞLI k        → kapsama %${((100 * okH) / nH).toFixed(1)} · toplam alan ${alanKova.toFixed(0)} ` +
    `(%${(100 * (1 - alanKova / alanSabit)).toFixed(1)} daha az)\n` +
    `⚠️ Yukarısı ÖRNEKLEM İÇİ — kova k'ları aynı veride seçildi, iyimser.\n`
);

/* ═══ F) Örneklem-dışı: kova k'ları TÜRKİYE DIŞINDA seçilir, Türkiye'de sınanır ═══ */
process.stdout.write(`\n${"═".repeat(74)}\nF) ÖRNEKLEM-DIŞI DOĞRULAMA (k'lar dışta seçilir, Türkiye'de sınanır)\n${"═".repeat(74)}\n`);
const kKovaDis = [];
for (let i = 0; i < RUZ_KENAR.length - 1; i++) {
  const s = DIS.filter((r) => r.kova === i);
  kKovaDis.push(s.length < 40 ? K_YAYIN : kIcin(s));
}
process.stdout.write(
  `dışta seçilen k'lar: ${kKovaDis.map((k, i) => `${RUZ_KENAR[i]}-${RUZ_KENAR[i + 1] > 100 ? "∞" : RUZ_KENAR[i + 1]}→${k}`).join(" · ")}\n`
);
function trDegerlendir(kFn, ad) {
  let ok = 0, n = 0, alan = 0;
  for (const r of TR) {
    const k = kFn(r);
    const rr = reachFor(r.c, k);
    alan += rr.km * rr.km * sekilAlani(rr.kmh);
    for (const [brg, km] of r.c.hucreler) {
      if (km <= rr.km * reachRatio(gap(rr.dir, brg), rr.kmh)) ok++;
      n++;
    }
  }
  return { ad, kaps: ok / n, alan };
}
const a1 = trDegerlendir(() => K_YAYIN, `sabit k=${K_YAYIN} (yayın)`);
const a2 = trDegerlendir((r) => kKovaDis[r.kova], "rüzgâra bağlı k (dışta seçilmiş)");
process.stdout.write(
  `\nTÜRKİYE'DE (n=${TR.length} vaka / ${TR.reduce((s, r) => s + r.c.hucreler.length, 0)} hücre)\n` +
    `  ${a1.ad.padEnd(34)} kapsama %${(100 * a1.kaps).toFixed(1)} · alan ${a1.alan.toFixed(0)}\n` +
    `  ${a2.ad.padEnd(34)} kapsama %${(100 * a2.kaps).toFixed(1)} · alan ${a2.alan.toFixed(0)} ` +
    `(%${(100 * (1 - a2.alan / a1.alan)).toFixed(1)} daha az)\n` +
    (a2.kaps >= a1.kaps - 0.01
      ? "  ✅ Kapsama korunuyor VE alan düşüyor — gerçek kazanç.\n"
      : `  ⚠️ Kapsama %${(100 * (a1.kaps - a2.kaps)).toFixed(1)} düştü — alan kazancı bedava değil.\n`)
);

/* ═══ G) ÜRETİME NE KOYALIM — kova değil DÜZ EĞRİ ═══
 * Kova sınırları veriye özgü; üretime gömmek gürültü ezberlemek olur.
 * Aday k(rüzgâr) eğrilerini aynı örneklem-dışı ölçütle sına. */
process.stdout.write(`\n${"═".repeat(74)}\nG) ÜRETİM ADAYI: düz k(rüzgâr) eğrisi (dışta ölçülüp Türkiye'de sınanır)\n${"═".repeat(74)}\n`);
const ADAYLAR = {
  "yayın (sabit 1,5)": [[0, 1.5], [45, 1.5]],
  "A: 3→1,0 · 8→1,75 · 20→1,7": [[3, 1.0], [8, 1.75], [20, 1.7], [45, 1.7]],
  "B: 3→1,0 · 9→1,7 · 45→1,7": [[3, 1.0], [9, 1.7], [45, 1.7]],
  "C: 4→1,1 · 10→1,65 · 45→1,65": [[4, 1.1], [10, 1.65], [45, 1.65]],
  "D: yalnız zayıfı kıs (6→1,0 · 10→1,5)": [[6, 1.0], [10, 1.5], [45, 1.5]],
};
process.stdout.write("aday                                    TR kapsama   TR alan   alan farkı\n");
const taban = trDegerlendir(() => K_YAYIN, "");
for (const [ad, egri] of Object.entries(ADAYLAR)) {
  const r = trDegerlendir((row) => interp(reachFor(row.c, 1).kmh, egri), ad);
  process.stdout.write(
    `${ad.padEnd(40)}   %${(100 * r.kaps).toFixed(1)}   ${r.alan.toFixed(0).padStart(7)}   ` +
      `${(100 * (1 - r.alan / taban.alan) >= 0 ? "−%" : "+%") + Math.abs(100 * (1 - r.alan / taban.alan)).toFixed(1)}` +
      `${r.kaps >= 0.89 ? "  ✅" : "  🔴 kapsama düşük"}\n`
  );
}

/* ═══ H) GÖNDERİLECEK BİÇİMİ SINA — k SAAT SAAT uygulanıyor ═══
 * Yukarıda k, vakanın ORTALAMA rüzgârından bir kez hesaplanıp tüm saatlere
 * uygulandı. Üretimde `headSpreadKmh` saat saat çağrılıyor, yani k de saatlik
 * rüzgârla değişecek. Farklı şey — gönderdiğimi doğrulamış olayım. */
process.stdout.write(`\n${"═".repeat(74)}\nH) ÜRETİM BİÇİMİ: k SAAT SAAT (headSpreadKmh'in gerçek çağrı şekli)\n${"═".repeat(74)}\n`);
function reachSaatlik(c, egri) {
  const w = wind[wkey(c)];
  const e = elev[ekey(c)];
  if (!w || !e) return null;
  const i0 = Math.round((c.t0 - w.t0) / 3600_000);
  const saat = Math.max(1, Math.round(c.hours));
  let km = 0, x = 0, y = 0, n = 0;
  for (let i = 0; i < saat; i++) {
    const s = w.spd[i0 + i], d = w.dir[i0 + i];
    if (typeof s !== "number" || typeof d !== "number") continue;
    km += interp(s, egri) * interp(s, ROS_ANCHORS); // ← üretimdeki birebir biçim
    const to = (d + 180) % 360;
    x += s * Math.sin(toRad(to));
    y += s * Math.cos(toRad(to));
    n++;
  }
  if (!n) return null;
  const wDeg = (toDeg(Math.atan2(x, y)) + 360) % 360;
  const wKmh = Math.hypot(x, y) / n;
  return { km, kmh: wKmh, dir: rothermelDir(yakitOf(clc[ckey(c)]), wKmh, wDeg, e.egim, e.yokus) };
}
process.stdout.write("aday                                    TR kapsama   TR alan   alan farkı\n");
for (const [ad, egri] of Object.entries(ADAYLAR)) {
  let ok = 0, n = 0, alan = 0;
  for (const r of TR) {
    const rr = reachSaatlik(r.c, egri);
    alan += rr.km * rr.km * sekilAlani(rr.kmh);
    for (const [brg, km] of r.c.hucreler) {
      if (km <= rr.km * reachRatio(gap(rr.dir, brg), rr.kmh)) ok++;
      n++;
    }
  }
  process.stdout.write(
    `${ad.padEnd(40)}   %${((100 * ok) / n).toFixed(1)}   ${alan.toFixed(0).padStart(7)}   ` +
      `${(100 * (1 - alan / taban.alan) >= 0 ? "−%" : "+%") + Math.abs(100 * (1 - alan / taban.alan)).toFixed(1)}` +
      `${ok / n >= 0.89 ? "  ✅" : "  🔴 kapsama düşük"}\n`
  );
}
