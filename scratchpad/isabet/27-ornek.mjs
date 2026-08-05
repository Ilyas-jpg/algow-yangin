/**
 * 27 — §7.3 ÖRNEK İNŞASI: korpus + çevre → LightGBM'in yiyeceği tablo
 *
 * Girdi:  vaka-akdeniz-*.json · clc-all.json · akdeniz-ruzgar.json · akdeniz-egim.json
 * Çıktı:  ornekler.csv (LightGBM) + ornekler-sutunlar.json (kolon sözlüğü)
 *
 * ── ÜÇ HEDEF (spec §7.1) ──
 *   t_buyudu    0/1   — bir sonraki geçişe kadar ölçülebilir ilerleme oldu mu
 *   t_mesafe    km    — olduysa en uzak yeni hücrenin mesafesi (yalnız pozitiflerde)
 *   t_sapma     derece— gerçek yönün RÜZGÂR YÖNÜNDEN sapması, [-180,180]
 *
 * 🔑 Yön neden ham derece değil sapma: 0°/360° dairesel, GBM'de regresyon hedefi
 * olamaz. Rüzgâra göre sapma **doğrusal** bir büyüklük ve fizik temel çizgisinde
 * (sapma=0) merkezlenir — model "rüzgârın nerede yanıldığını" öğrenir, yönü
 * sıfırdan öğrenmez. Tahmin geri çevrilirken: yön = rüzgâr_yönü + sapma.
 *
 * ── PENCERE GERÇEĞİ ──
 * Ölçüldü: 2.874 vakanın 2.704'ü 10-14 saatlik pencerede, 2-7 saat kovaları BOŞ.
 * Sebep VIIRS geçiş ritmi (~12 saat). Yani hedef "keyfi bir pencerede büyüme"
 * değil **"bir sonraki geçişe kadar büyüme"**. `hours` yine de özellik — kalan
 * varyans bir şey taşıyorsa model kullansın.
 *
 * ── 🔴 SIZINTI SINIRI ──
 * HİÇBİR özellik t0'dan SONRAsını görmez. `05b-model.mjs`'teki `ORACLE_ORT`
 * ([t0,t1] ortalama rüzgârı) bilerek DIŞARIDA — o bir tavan ölçüsüydü, özellik
 * değil. Tüm hava toplamaları t0'da biter; `prev_*` geçmiş pencereden gelir.
 *
 * Koşum:  node scratchpad/isabet/27-ornek.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { yakitOf } from "./04b-yakit-kod.mjs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const SAAT = 3600_000;
const ORTADOGU = new Set(["Irak", "Suriye", "İran"]);
const MAX_ILER_KM = 15; // 23-akdeniz-vaka.mjs ile aynı; mesafe sansürü buradan

/* ══ girdi ══ */
const clc = JSON.parse(readFileSync(here("clc-all.json"), "utf8"));
const ruzgar = JSON.parse(readFileSync(here("akdeniz-ruzgar.json"), "utf8"));
const egimler = JSON.parse(readFileSync(here("akdeniz-egim.json"), "utf8"));

const ckey = (c) => `${(Math.round(c.lat * 100) / 100).toFixed(2)},${(Math.round(c.lon * 100) / 100).toFixed(2)}`;
const wkey = (c) =>
  `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}` +
  `|${new Date(c.t0).getUTCFullYear()}`;
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;

const hepsi = [];
for (const f of readdirSync(here(".")).filter((f) => /^vaka-akdeniz-\d{4}\.json$/.test(f)).sort())
  hepsi.push(...JSON.parse(readFileSync(here(f), "utf8")));
const havuz = hepsi.filter(
  (c) => !ORTADOGU.has(c.bolge) && ["ORMAN", "MAKI"].includes(yakitOf(clc[ckey(c)]))
);

/* ══ yardımcılar ══ */
/** Açı farkı, işaretli, [-180,180]. Pozitif = a, b'nin saat yönünde. */
const sapma = (a, b) => {
  let d = ((a - b + 540) % 360) - 180;
  return d === -180 ? 180 : d;
};
const mutlakFark = (a, b) => Math.abs(sapma(a, b));

/** Doymuş buhar basıncı (kPa) — Tetens. VPD = es·(1 − RH/100). */
const es = (t) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
const vpdOf = (t, rh) => (t === null || rh === null ? null : es(t) * (1 - rh / 100));

/**
 * Rüzgârı [bas,son] aralığında VEKTÖREL ortala.
 * Skaler ortalama yön için yanlıştır (350° ve 10°'nin ortalaması 180 çıkar).
 */
function ruzgarAral(w, bas, son) {
  if (!w) return null;
  const i0 = Math.max(0, Math.round((bas - w.t0) / SAAT));
  const i1 = Math.min(w.spd.length - 1, Math.round((son - w.t0) / SAAT));
  if (i1 < i0) return null;
  let x = 0, y = 0, n = 0, enHizli = 0;
  for (let i = i0; i <= i1; i++) {
    const s = w.spd[i], d = w.dir[i];
    if (typeof s !== "number" || typeof d !== "number") continue;
    const varis = (d + 180) % 360; // ERA5 "nereden esiyor" verir; "nereye" lazım
    x += s * Math.sin(toRad(varis));
    y += s * Math.cos(toRad(varis));
    if (s > enHizli) enHizli = s;
    n++;
  }
  if (!n) return null;
  return {
    yon: (toDeg(Math.atan2(x, y)) + 360) % 360, // rüzgârın ESTİĞİ yön
    hiz: Math.hypot(x, y) / n,                   // vektörel ortalama büyüklüğü
    enHizli,
    tutarlilik: Math.hypot(x, y) / n / (enHizli || 1), // 1'e yakın = yön sabit
  };
}

/** Skaler alanların [bas,son] ortalaması / toplamı. */
function havaAral(w, bas, son, alan, topla = false) {
  if (!w) return null;
  const i0 = Math.max(0, Math.round((bas - w.t0) / SAAT));
  const i1 = Math.min(w[alan].length - 1, Math.round((son - w.t0) / SAAT));
  if (i1 < i0) return null;
  let s = 0, n = 0;
  for (let i = i0; i <= i1; i++) {
    const v = w[alan][i];
    if (typeof v !== "number") continue;
    s += v; n++;
  }
  return n ? (topla ? s : s / n) : null;
}

/** t0'dan geriye, ≥0,2 mm yağış görülen son saatten bu yana geçen saat. */
function sonYagistanBeri(w, t0, tavanSaat = 30 * 24) {
  if (!w) return null;
  const i0 = Math.round((t0 - w.t0) / SAAT);
  const bas = Math.max(0, i0 - tavanSaat);
  for (let i = Math.min(i0, w.yagis.length - 1); i >= bas; i--)
    if (typeof w.yagis[i] === "number" && w.yagis[i] >= 0.2) return i0 - i;
  return tavanSaat; // pencerede hiç yağış yok — tavana kırp
}

/* Rothermel φw/φs — 05b-model.mjs ile birebir aynı katsayılar (fizik temel çizgisi). */
const YAKIT_SABIT = {
  ORMAN: { sigma: 1500, beta: 0.03, waf: 0.15 },
  MAKI: { sigma: 1800, beta: 0.012, waf: 0.3 },
};
function rothermel(yakit, hizKmh, egimPct) {
  const { sigma, beta, waf } = YAKIT_SABIT[yakit] ?? YAKIT_SABIT.MAKI;
  const betaOp = 3.348 * sigma ** -0.8189;
  const C = 7.47 * Math.exp(-0.133 * sigma ** 0.55);
  const B = 0.02526 * sigma ** 0.54;
  const E = 0.715 * Math.exp(-3.59e-4 * sigma);
  const U = Math.max(0, hizKmh) * 54.6807 * waf;
  return {
    phiW: C * U ** B * (beta / betaOp) ** -E,
    phiS: 5.275 * beta ** -0.3 * (egimPct / 100) ** 2,
  };
}

/* ══ satır inşası ══ */
const satirlar = [];
const atlanan = { ruzgarYok: 0, egimYok: 0, pencereDisi: 0 };

for (const c of havuz) {
  const w = ruzgar[wkey(c)];
  const e = egimler[ekey(c)];
  if (!w) { atlanan.ruzgarYok++; continue; }
  if (!e) { atlanan.egimYok++; continue; }

  const r0 = ruzgarAral(w, c.t0 - SAAT, c.t0);       // t0 civarı
  const r3 = ruzgarAral(w, c.t0 - 3 * SAAT, c.t0);
  const r24 = ruzgarAral(w, c.t0 - 24 * SAAT, c.t0);
  if (!r0) { atlanan.pencereDisi++; continue; }

  const tmp0 = havaAral(w, c.t0 - SAAT, c.t0, "tmp");
  const rh0 = havaAral(w, c.t0 - SAAT, c.t0, "rh");
  const tmp24 = havaAral(w, c.t0 - 24 * SAAT, c.t0, "tmp");
  const rh24 = havaAral(w, c.t0 - 24 * SAAT, c.t0, "rh");
  const tmp30 = havaAral(w, c.t0 - 30 * 24 * SAAT, c.t0, "tmp");
  const rh30 = havaAral(w, c.t0 - 30 * 24 * SAAT, c.t0, "rh");

  const yakit = yakitOf(clc[ckey(c)]);
  const { phiW, phiS } = rothermel(yakit, r0.hiz, e.egim);

  /* ── hedefler ── */
  const buyudu = c.cephe !== null ? 1 : 0;
  const gKm = c.hucreler.map(([, km]) => km);
  const mesafe = gKm.length ? Math.max(...gKm) : null;
  // 15 km tavanına dayanmış olanlar SANSÜRLÜ: gerçek ilerleme daha uzun olabilir
  // (sıçrama/ikinci yangın kırpıldı). Satır atılmıyor, işaretleniyor.
  const mesafeSansur = mesafe !== null && mesafe > MAX_ILER_KM - 1 ? 1 : 0;

  const gun = new Date(c.t0);
  satirlar.push({
    /* kimlik + bölme anahtarları (ÖZELLİK DEĞİL) */
    ev: c.ev,
    bolge: c.bolge,
    yil: gun.getUTCFullYear(),
    holdout: c.bolge === "Türkiye" ? 1 : 0,
    lon: c.lon,
    lat: c.lat,
    t0: c.t0,

    /* ── özellikler: yangının t0'daki durumu ──
     * 🔴 `c.spanKm` BİLEREK ÖZELLİK DEĞİL: olayın TAMAMINDAN hesaplanıyor,
     * yani t1'den sonraki geçişleri de içeriyor — "bu yangın sonunda ne kadar
     * büyüdü" bilgisini taşır, sızıntıdır. Yerine t0 geçişinde bilinenler. */
    f_nA: c.nA,           // t0'daki tespit sayısı
    f_frpA: c.frpA,       // t0'daki toplam ışıma gücü (MW)
    f_spanA: c.spanA,     // t0 ayak izinin köşegeni (km)
    f_frpBasina: c.nA ? +(c.frpA / c.nA).toFixed(1) : null, // piksel başına şiddet
    f_saat: c.hours,
    f_yakitOrman: yakit === "ORMAN" ? 1 : 0,
    f_gunSaati: gun.getUTCHours() + gun.getUTCMinutes() / 60,
    f_yilGunu: Math.floor((c.t0 - Date.UTC(gun.getUTCFullYear(), 0, 0)) / 86400e3),

    /* ── özellikler: rüzgâr (hepsi t0'da biter) ── */
    f_ruzgarHiz: +r0.hiz.toFixed(2),
    f_ruzgarEnHizli: +r0.enHizli.toFixed(2),
    f_ruzgarHiz3: r3 ? +r3.hiz.toFixed(2) : null,
    f_ruzgarHiz24: r24 ? +r24.hiz.toFixed(2) : null,
    f_ruzgarTutarlilik24: r24 ? +r24.tutarlilik.toFixed(3) : null,
    // yön DEĞİŞİMİ dönmekte olan rüzgârı yakalar; ham yön özellik değil
    // (coğrafi yön modeli bölgeye ezberletir)
    f_ruzgarDonme3: r3 ? +sapma(r0.yon, r3.yon).toFixed(1) : null,
    f_ruzgarDonme24: r24 ? +sapma(r0.yon, r24.yon).toFixed(1) : null,

    /* ── özellikler: arazi ── */
    f_egim: e.egim,
    f_yukseklik: e.z,
    // rüzgâr yokuş yukarı mı esiyor: fiziğin asıl etkileşimi
    f_ruzgarYokusUyum: +mutlakFark(r0.yon, e.yokus).toFixed(1),
    // İŞARETLİ hâli ayrıca: yokuş rüzgârın solunda mı sağında mı — yön için
    // mutlak fark bunu yutuyor. Rothermel temel çizgisi de bunu istiyor.
    f_yokusSapma: +sapma(e.yokus, r0.yon).toFixed(1),

    /* ── özellikler: kuruluk ── */
    f_sicaklik: tmp0 === null ? null : +tmp0.toFixed(2),
    f_nem: rh0 === null ? null : +rh0.toFixed(1),
    f_vpd: vpdOf(tmp0, rh0) === null ? null : +vpdOf(tmp0, rh0).toFixed(3),
    f_vpd24: vpdOf(tmp24, rh24) === null ? null : +vpdOf(tmp24, rh24).toFixed(3),
    f_vpd30g: vpdOf(tmp30, rh30) === null ? null : +vpdOf(tmp30, rh30).toFixed(3),
    f_yagis24: (() => { const v = havaAral(w, c.t0 - 24 * SAAT, c.t0, "yagis", true); return v === null ? null : +v.toFixed(2); })(),
    f_yagis30g: (() => { const v = havaAral(w, c.t0 - 30 * 24 * SAAT, c.t0, "yagis", true); return v === null ? null : +v.toFixed(2); })(),
    f_yagissizSaat: sonYagistanBeri(w, c.t0),

    /* ── özellikler: fizik temel çizgisi ── */
    f_phiW: +phiW.toFixed(3),
    f_phiS: +phiS.toFixed(3),
    /* Eğimin toplam zorlamadaki PAYI — üretimde `slopeShare` diye zaten var.
     * Sapma, eğim ile rüzgâr birbirine yakın güçteyken ve açılıyken büyük. */
    f_egimPayi: +(phiS / (phiW + phiS + 1e-9)).toFixed(4),
    /* Literatür (MDPI Fire 9(3):100 · ScienceDirect S0168192326001267):
     * yayılım açısının rüzgârdan sapması EĞİM dikleştikçe ARTAR, ÇAPRAZ-EĞİM
     * rüzgârı güçlendikçe AZALIR. Rüzgârı yokuş eksenine göre ayrıştır. */
    f_caprazRuzgar: +(r0.hiz * Math.sin(toRad(sapma(e.yokus, r0.yon)))).toFixed(2),
    f_boyunaRuzgar: +(r0.hiz * Math.cos(toRad(sapma(e.yokus, r0.yon)))).toFixed(2),
    /* Yangının "hissettiği" çapraz diklik: yamaç, rüzgâra dik bileşeniyle. */
    f_caprazEgim: +(e.egim * Math.abs(Math.sin(toRad(sapma(e.yokus, r0.yon))))).toFixed(2),

    /* ── özellikler: süreklilik (ÖNCEKİ pencereden, sızıntı değil) ── */
    f_oncekiBuyudu: c.prev ? (c.prev.cephe !== null ? 1 : 0) : null,
    // önceki yönün rüzgâra göre sapması — "geçen sefer rüzgârdan ne kadar saptı"
    f_oncekiSapma: c.prev && c.prev.cephe !== null ? +sapma(c.prev.cephe, r0.yon).toFixed(1) : null,

    /* ── HEDEFLER ── */
    t_buyudu: buyudu,
    t_mesafe: mesafe,
    t_mesafeSansur: mesafeSansur,
    t_sapma: c.cephe !== null ? +sapma(c.cephe, r0.yon).toFixed(1) : null,
    t_yonHam: c.cephe, // geri çevirme ve denetim için; EĞİTİMDE KULLANMA

    /* ── ETİKET KALİTESİ — 🔴 ÖZELLİK DEĞİL, AĞIRLIK ──
     * Bunlar t1 gözleminden türüyor; özellik olarak verilirse SIZINTI olur.
     * Amaçları hedefin ne kadar güvenilir ÖLÇÜLDÜĞÜNÜ söylemek.
     *
     * Ölçüldü (2.403 vaka, rüzgâr temel çizgisi, medyan mutlak hata):
     *   yeni hücre 0-3 → 91,9°   50+ → 50,4°
     *   ilerleme 0-1 km → 96,1°   8+ km → 67,8°
     * Yani az kıpırdayan yangında "yön" neredeyse rastgele. Eşit ağırlıkla
     * eğitmek modele gürültü ezberletir.
     * ⚠️ Bu ikisi kısmen DÖNGÜSEL: çok hücre = dairesel ortalamanın daha iyi
     * kestirilmesi (kestirici varyansı), yangının daha "kararlı" olması değil.
     * Rüzgâr hızı böyle değil — o bağımsız ve f_ruzgarHiz olarak zaten özellik. */
    q_hucreSayisi: c.hucreler.length,
    q_ilerlemeKm: mesafe,
  });
}

/* ══ yazım ══ */
const kolonlar = Object.keys(satirlar[0]);
const csv = [
  kolonlar.join(","),
  ...satirlar.map((s) => kolonlar.map((k) => (s[k] === null || s[k] === undefined ? "" : s[k])).join(",")),
].join("\n");
writeFileSync(here("ornekler.csv"), csv);

const ozellikler = kolonlar.filter((k) => k.startsWith("f_"));
writeFileSync(
  here("ornekler-sutunlar.json"),
  JSON.stringify(
    {
      satir: satirlar.length,
      ozellikler,
      hedefler: ["t_buyudu", "t_mesafe", "t_sapma"],
      kullanma: [
        "ev", "bolge", "yil", "holdout", "lon", "lat", "t0",
        "t_yonHam", "t_mesafeSansur",
        "q_hucreSayisi", "q_ilerlemeKm", // t1'den türer — özellik olursa sızıntı
      ],
      agirlikAdaylari: ["q_hucreSayisi", "q_ilerlemeKm"],
      grupAnahtari: "ev",
      not: "Yön tahmini geri çevrilirken: yön = rüzgâr_yönü + t_sapma. Rüzgâr yönü f_'lerde yok (bölgeye ezberlemesin) — geri çevirme için akdeniz-ruzgar.json'dan yeniden hesapla.",
    },
    null,
    1
  )
);

/* ══ karne ══ */
const say = (f) => satirlar.filter(f).length;
const q = (a, p) => { const s = a.filter((x) => x !== null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * p)] : null; };

process.stdout.write(
  `ornekler.csv — ${satirlar.length} satır · ${ozellikler.length} özellik\n` +
    `atlanan: rüzgâr yok ${atlanan.ruzgarYok} · eğim yok ${atlanan.egimYok} · pencere dışı ${atlanan.pencereDisi}\n` +
    `${"═".repeat(72)}\n` +
    `HEDEF 1 büyüdü   ${say((s) => s.t_buyudu === 1)} pozitif / ${say((s) => s.t_buyudu === 0)} negatif ` +
    `(%${((say((s) => s.t_buyudu === 1) / satirlar.length) * 100).toFixed(1)})\n` +
    `HEDEF 2 mesafe   ${say((s) => s.t_mesafe !== null)} satır · medyan ${q(satirlar.map((s) => s.t_mesafe), 0.5)} km · ` +
    `%90 ${q(satirlar.map((s) => s.t_mesafe), 0.9)} · sansürlü ${say((s) => s.t_mesafeSansur === 1)}\n` +
    `HEDEF 3 sapma    ${say((s) => s.t_sapma !== null)} satır · ` +
    `medyan |sapma| ${q(satirlar.filter((s) => s.t_sapma !== null).map((s) => Math.abs(s.t_sapma)), 0.5)}° · ` +
    `%90 ${q(satirlar.filter((s) => s.t_sapma !== null).map((s) => Math.abs(s.t_sapma)), 0.9)}°\n` +
    `${"═".repeat(72)}\n` +
    `BÖLME  ${new Set(satirlar.map((s) => s.ev)).size} olay · ` +
    `eğitim ${new Set(satirlar.filter((s) => !s.holdout).map((s) => s.ev)).size} · ` +
    `Türkiye holdout ${new Set(satirlar.filter((s) => s.holdout).map((s) => s.ev)).size}\n`
);

/* boş oranı — çok boşluklu özellik modeli yanıltır */
const bos = ozellikler
  .map((k) => [k, satirlar.filter((s) => s[k] === null).length])
  .filter(([, n]) => n > 0)
  .sort((a, b) => b[1] - a[1]);
process.stdout.write(
  bos.length
    ? `\nBOŞ DEĞER: ${bos.map(([k, n]) => `${k} ${n} (%${((n / satirlar.length) * 100).toFixed(1)})`).join(" · ")}\n`
    : "\nBoş değer yok.\n"
);
