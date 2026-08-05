/**
 * 26 — PAN-AKDENİZ KORPUSU: ÇEVRE ÖZELLİKLERİ
 *
 * Korpus (21…25) kuruldu ama model eğitilemiyordu: vakalarda hava ve arazi yok.
 * Bu betik o boşluğu dolduruyor.
 *   A) ERA5 saatlik hava — rüzgâr hızı/yönü, sıcaklık, bağıl nem, YAĞIŞ
 *      (archive-api.open-meteo.com; tüm yıllar için tutarlı tek kaynak)
 *   B) Eğim + yokuş-yukarı yönü — SRTM 30 m, 5 noktalı ~1 km kalıp
 *
 * Anahtarlar 03b/03d ile BİREBİR AYNI (`lat.1,lon.1|yıl` ve `lat.3,lon.3`),
 * böylece P2'nin okuyucuları (05b/06/07/08/12) pan-Akdeniz korpusunda da
 * değişmeden çalışır.
 *
 * ── ÜÇ TASARIM KARARI, HEPSİ ÖLÇÜMLE ──
 *
 * ① Pencere: sezon değil, gruba uyarlanmış. 03b sabit 1 May–30 Eyl çekiyordu;
 *    pan-Akdeniz'de bu 218.592 konum-gün ≈ 130 MB eder ve **%3'ü kullanılır**.
 *    Bunun yerine her (konum×yıl) için [ilk yangın − 30 gün, son yangın + 2 gün],
 *    yarım-ay sınırına yuvarlanmış: 60.688 konum-gün ≈ 45 MB. Yarım-ay
 *    yuvarlaması toplu çekimi mümkün kılıyor — aynı istekte ancak aynı tarih
 *    aralığını paylaşan konumlar taşınabilir (146 farklı aralık, 201 istek).
 *
 * ② 30 günlük ön-tarih bilerek: kuraklık türevleri (son yağıştan bu yana geçen
 *    gün, 30 günlük toplam yağış, 30 günlük ortalama VPD) bunsuz üretilemez.
 *    Gerçek FWI değil — o, sezon başından spin-up ister — ama vekil olarak
 *    yeterli ve sonradan çekilemez: pencereyi dar tutmak ikinci bir tam tur
 *    demekti.
 *
 * ③ Havuzda YÖN ŞARTI YOK. Not "yön içeren 2.379 vaka" diyordu; ama §7.1'in ilk
 *    iki hedefi (büyüme olasılığı, büyüme mesafesi) yön istemiyor. Ölçüldü:
 *    şartı kaldırmak 2.403 → 2.874 vaka, karşılığı +29 rüzgâr kaydı ve +2 MB.
 *    Dar çekmek garantili ikinci tur olurdu.
 *
 * ⚠️ `wind-w.json` (P2 Türkiye) YENİDEN KULLANILMIYOR: yağış içermiyor ve
 *    sezonu 20 Mayıs'ta başlıyor — ön-tarih penceresi kayıtlar arasında sessizce
 *    tutarsız olurdu. Eğim farklı: zamandan bağımsız ve hesap birebir aynı,
 *    o yüzden `elev-srtm.json`'daki 232 örtüşen konum tohum olarak alınıyor.
 *
 * Koşum (yeniden başlatılabilir, kaldığı yerden devam eder):
 *   node scratchpad/isabet/26-akdeniz-cevre.mjs
 *   YALNIZ=ruzgar node ...   # yalnız A
 *   YALNIZ=egim node ...     # yalnız B
 *   SINIR=2 node ...         # ilk 2 istekte dur (deneme koşumu)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { yakitOf } from "./04b-yakit-kod.mjs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const GUN = 864e5;
const ONCE = 30; // gün, ön-tarih (kuraklık vekilleri için)
const SONRA = 2; // gün, yangın sonrası pay
const ORTADOGU = new Set(["Irak", "Suriye", "İran"]); // İlyas'ın 2026-08-03 kararı

/* ══ havuz ══ */
const clc = JSON.parse(readFileSync(here("clc-all.json"), "utf8"));
const ckey = (c) =>
  `${(Math.round(c.lat * 100) / 100).toFixed(2)},${(Math.round(c.lon * 100) / 100).toFixed(2)}`;

const hepsi = [];
for (const f of readdirSync(here(".")).filter((f) => /^vaka-akdeniz-\d{4}\.json$/.test(f)).sort())
  hepsi.push(...JSON.parse(readFileSync(here(f), "utf8")));

const havuz = hepsi.filter(
  (c) => !ORTADOGU.has(c.bolge) && ["ORMAN", "MAKI"].includes(yakitOf(clc[ckey(c)]))
);
const yonlu = havuz.filter((c) => c.cephe !== null);
process.stdout.write(
  `HAVUZ: ${havuz.length} vaka · ${new Set(havuz.map((c) => c.ev)).size} olay ` +
    `(orman+maki, Ortadoğu hariç) · yön içeren ${yonlu.length}\n${"═".repeat(78)}\n`
);

const yalniz = process.env.YALNIZ || "";
const SINIR = +process.env.SINIR || Infinity; // deneme koşumu için istek tavanı
let hataVar = false;

/* ══════════════════ A) ERA5 SAATLİK HAVA ══════════════════ */
const wkey = (c) =>
  `${(Math.round(c.lat * 10) / 10).toFixed(1)},${(Math.round(c.lon * 10) / 10).toFixed(1)}` +
  `|${new Date(c.t0).getUTCFullYear()}`;

if (yalniz !== "egim") {
  const dosya = here("akdeniz-ruzgar.json");
  const ruzgar = existsSync(dosya) ? JSON.parse(readFileSync(dosya, "utf8")) : {};

  /* her (konum×yıl) için gereken zaman aralığı */
  const grup = {};
  for (const c of havuz) {
    const k = wkey(c);
    (grup[k] ??= { ilk: Infinity, son: -Infinity });
    grup[k].ilk = Math.min(grup[k].ilk, c.t0);
    grup[k].son = Math.max(grup[k].son, c.t1);
  }

  /* yarım-ay sınırına yuvarla — aynı aralığı paylaşanlar tek istekte gider */
  const yarimAyBas = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() <= 15 ? 1 : 16);
  const yarimAySon = (d) =>
    d.getUTCDate() <= 15
      ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 15)
      : Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const enSon = Date.now() - 7 * GUN; // ERA5 arşivinin gecikmesine pay

  const eksik = Object.keys(grup).filter((k) => !ruzgar[k]);
  const kovalar = new Map();
  for (const k of eksik) {
    const bas = yarimAyBas(new Date(grup[k].ilk - ONCE * GUN));
    const son = Math.min(yarimAySon(new Date(grup[k].son + SONRA * GUN)), enSon);
    const kk = `${iso(bas)}|${iso(son)}`;
    if (!kovalar.has(kk)) kovalar.set(kk, []);
    kovalar.get(kk).push(k);
  }
  const toplamIstek = [...kovalar.values()].reduce((s, v) => s + Math.ceil(v.length / 12), 0);
  process.stdout.write(
    `A) ERA5: ${Object.keys(grup).length} kayıt (konum×yıl) · ${Object.keys(ruzgar).length} zaten var · ` +
      `${eksik.length} çekilecek\n   ${kovalar.size} farklı tarih aralığı → ${toplamIstek} istek ` +
      `(12'lik parti, 4 sn ara ≈ ${Math.ceil((toplamIstek * 4) / 60)} dk)\n`
  );

  const basarisiz = [];
  let istek = 0;
  const t0 = Date.now();

  /* Open-Meteo limiti istek SAYISINA değil taşınan LOKASYON sayısına bakıyor
     (tavan ~600/dk — reference_open_meteo_limitleri). 12 konum + 4 sn = 180/dk. */
  async function cek(url, dene = 5) {
    for (let t = 0; t < dene; t++) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
        if (r.status === 429) {
          // Sınır DAKİKALIK: kısa retry hem veriyi getirmez hem kotayı yer.
          await sleep(65_000);
          throw new Error("HTTP 429");
        }
        if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 150)}`);
        return await r.json();
      } catch (e) {
        if (t === dene - 1) return { hata: String(e.message || e) };
        await sleep(15_000 * (t + 1));
      }
    }
  }

  dis: for (const [aralik, anahtarlar] of kovalar) {
    const [bas, son] = aralik.split("|");
    for (let i = 0; i < anahtarlar.length; i += 12) {
      if (istek >= SINIR) break dis;
      const parti = anahtarlar.slice(i, i + 12);
      const d = await cek(
        `https://archive-api.open-meteo.com/v1/archive` +
          `?latitude=${parti.map((k) => k.split(",")[0]).join(",")}` +
          `&longitude=${parti.map((k) => k.split("|")[0].split(",")[1]).join(",")}` +
          `&start_date=${bas}&end_date=${son}` +
          `&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m,precipitation` +
          `&wind_speed_unit=kmh&timezone=UTC`
      );
      istek++;

      if (d?.hata) {
        // Sessiz boşluk YASAK (P3 dersi: FIRMS'in 400'ü "veri yok" değildi).
        basarisiz.push({ aralik, anahtarlar: parti, sebep: d.hata });
      } else {
        const dizi = Array.isArray(d) ? d : [d];
        if (dizi.length !== parti.length) {
          basarisiz.push({ aralik, anahtarlar: parti, sebep: `konum sayısı ${dizi.length}≠${parti.length}` });
        } else {
          dizi.forEach((loc, k) => {
            ruzgar[parti[k]] = {
              t0: Date.parse(loc.hourly.time[0] + "Z"),
              spd: loc.hourly.wind_speed_10m,
              dir: loc.hourly.wind_direction_10m,
              tmp: loc.hourly.temperature_2m,
              rh: loc.hourly.relative_humidity_2m,
              yagis: loc.hourly.precipitation,
            };
          });
        }
      }

      if (istek % 10 === 0) writeFileSync(dosya, JSON.stringify(ruzgar));
      process.stdout.write(
        `\r   ${istek}/${toplamIstek} istek · ${Object.keys(ruzgar).length} kayıt · ` +
          `${((Date.now() - t0) / 60000).toFixed(1)} dk · başarısız ${basarisiz.length}    `
      );
      /* 03b 4 sn bekliyordu; ölçüm isteğin kendisinin zaten ~9 sn sürdüğünü
         gösterdi (uzun aralık × 5 değişken). 12 konum / ~10 sn ≈ 70 konum/dk,
         tavan ~600 — bekleme 1,5 sn'ye indi, limit hâlâ uzakta. */
      await sleep(1500);
    }
  }
  writeFileSync(dosya, JSON.stringify(ruzgar));

  const mb = (existsSync(dosya) ? readFileSync(dosya).length : 0) / 1e6;
  process.stdout.write(`\n   akdeniz-ruzgar.json: ${Object.keys(ruzgar).length} kayıt · ${mb.toFixed(1)} MB\n`);
  if (basarisiz.length) {
    writeFileSync(here("akdeniz-ruzgar.EKSIK.json"), JSON.stringify(basarisiz, null, 1));
    process.stdout.write(`   ⚠️ ${basarisiz.length} parti çekilemedi → akdeniz-ruzgar.EKSIK.json\n`);
  }
  /* "bitti" iddiası niyetten değil DİSKTEN doğrulanır — SINIR ile kesilmiş
     koşum da, sessizce düşmüş parti de buradan yakalanır. */
  const halaYok = Object.keys(grup).filter((k) => !ruzgar[k]);
  if (halaYok.length) {
    process.stdout.write(`   🔴 ${halaYok.length} kayıt hâlâ eksik — betiği tekrar koştur\n`);
    hataVar = true;
  } else {
    process.stdout.write("   ✅ hepsi çekildi\n");
  }
}

/* ══════════════════ B) EĞİM (SRTM 30 m) ══════════════════ */
const ekey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;

if (yalniz !== "ruzgar") {
  const S = 0.009; // ° ≈ 1000 m — yangının 1-14 saatte kat ettiği ölçek
  const dosya = here("akdeniz-egim.json");
  const egim = existsSync(dosya) ? JSON.parse(readFileSync(dosya, "utf8")) : {};

  /* P2 önbelleği tohum: eğim zamandan bağımsız, hesap birebir aynı (03d). */
  let tohum = 0;
  if (!Object.keys(egim).length && existsSync(here("elev-srtm.json"))) {
    const eski = JSON.parse(readFileSync(here("elev-srtm.json"), "utf8"));
    for (const c of havuz) {
      const k = ekey(c);
      if (eski[k] && !egim[k]) {
        egim[k] = eski[k];
        tohum++;
      }
    }
    if (tohum) writeFileSync(dosya, JSON.stringify(egim));
  }

  const gerekli = [...new Map(havuz.map((c) => [ekey(c), c])).values()];
  /* `null` geçerli bir cevap ("SRTM burada veri vermiyor"), çekilememiş değil —
     anahtarın VARLIĞINA bak, yoksa o hücre her koşumda boşuna yeniden denenir. */
  const eksik = gerekli.filter((c) => !(ekey(c) in egim));
  process.stdout.write(
    `\nB) EĞİM: ${gerekli.length} konum · ${tohum} tohum (elev-srtm.json'dan) · ` +
      `${Object.keys(egim).length} zaten var · ${eksik.length} çekilecek ` +
      `(${Math.ceil(eksik.length / 20)} istek ≈ ${Math.ceil((eksik.length / 20) * 1.3 / 60)} dk)\n`
  );

  async function gonder(noktalar, dene = 6) {
    for (let t = 0; t < dene; t++) {
      try {
        const r = await fetch("https://api.opentopodata.org/v1/srtm30m", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            locations: noktalar.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join("|"),
          }),
          signal: AbortSignal.timeout(90_000),
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        if (!j.results) throw new Error(JSON.stringify(j).slice(0, 120));
        return j.results.map((x) => x.elevation);
      } catch (e) {
        if (t === dene - 1) return null;
        await sleep(4000 * (t + 1));
      }
    }
  }

  let basarisiz = 0;
  const t0 = Date.now();
  for (let i = 0; i < Math.min(eksik.length, SINIR * 20); i += 20) {
    const parti = eksik.slice(i, i + 20);
    const noktalar = parti.flatMap((c) => {
      const dl = S / Math.cos(toRad(c.lat));
      return [[c.lat, c.lon], [c.lat + S, c.lon], [c.lat - S, c.lon], [c.lat, c.lon + dl], [c.lat, c.lon - dl]];
    });
    const z = await gonder(noktalar);
    if (!z) {
      basarisiz += parti.length; // kaydetme — sonraki koşum yeniden dener
    } else {
      parti.forEach((c, k) => {
        const q = z.slice(k * 5, k * 5 + 5);
        if (q.some((v) => v === null || v === undefined)) {
          egim[ekey(c)] = null; // SRTM burada veri vermiyor (deniz/kutup boşluğu)
          return;
        }
        const dd = S * 111_320 * 2;
        const gy = (q[1] - q[2]) / dd, gx = (q[3] - q[4]) / dd;
        const buyukluk = Math.hypot(gx, gy);
        egim[ekey(c)] = {
          z: q[0],
          egim: +(buyukluk * 100).toFixed(2), // %
          aci: +toDeg(Math.atan(buyukluk)).toFixed(2), // derece
          yokus: +((toDeg(Math.atan2(gx, gy)) + 360) % 360).toFixed(1), // yokuş-yukarı bearing
        };
      });
      writeFileSync(dosya, JSON.stringify(egim));
    }
    process.stdout.write(
      `\r   ${Math.min(i + 20, eksik.length)}/${eksik.length} · ` +
        `${((Date.now() - t0) / 60000).toFixed(1)} dk · başarısız ${basarisiz}    `
    );
    await sleep(1300);
  }
  writeFileSync(dosya, JSON.stringify(egim));
  const bosluk = Object.values(egim).filter((v) => v === null).length;
  process.stdout.write(
    `\n   akdeniz-egim.json: ${Object.keys(egim).length} kayıt` +
      (bosluk ? ` (${bosluk}'i SRTM boşluğu)` : "") + "\n"
  );
  const halaYok = gerekli.filter((c) => !(ekey(c) in egim));
  if (halaYok.length) {
    process.stdout.write(`   🔴 ${halaYok.length} konum hâlâ eksik — betiği tekrar koştur\n`);
    hataVar = true;
  } else {
    process.stdout.write("   ✅ hepsi çekildi\n");
  }
}

/* ══════════════════ KAPSAMA KARNESİ ══════════════════ */
const rz = existsSync(here("akdeniz-ruzgar.json"))
  ? JSON.parse(readFileSync(here("akdeniz-ruzgar.json"), "utf8"))
  : {};
const eg = existsSync(here("akdeniz-egim.json"))
  ? JSON.parse(readFileSync(here("akdeniz-egim.json"), "utf8"))
  : {};

/** Vakanın [t0,t1] penceresi çekilen saatlerin İÇİNDE mi — kayıt var demek yetmez. */
const havaVar = (c) => {
  const w = rz[wkey(c)];
  if (!w) return false;
  const i0 = Math.round((c.t0 - w.t0) / 3600e3), i1 = Math.round((c.t1 - w.t0) / 3600e3);
  return i0 >= 0 && i1 <= w.spd.length - 1;
};

const sat = (ad, set) => {
  const h = set.filter(havaVar).length;
  const e = set.filter((c) => eg[ekey(c)]).length;
  const ikisi = set.filter((c) => havaVar(c) && eg[ekey(c)]).length;
  return (
    `${ad.padEnd(26)}${String(set.length).padStart(5)} vaka · hava ${String(h).padStart(5)} ` +
    `(%${((h / set.length) * 100).toFixed(1)}) · eğim ${String(e).padStart(5)} ` +
    `(%${((e / set.length) * 100).toFixed(1)}) · İKİSİ ${String(ikisi).padStart(5)} ` +
    `(%${((ikisi / set.length) * 100).toFixed(1)})`
  );
};

process.stdout.write(`\n${"═".repeat(78)}\nKAPSAMA\n`);
process.stdout.write(`${sat("havuz (orman+maki)", havuz)}\n${sat("  → yön içeren", yonlu)}\n`);
const trH = havuz.filter((c) => c.bolge === "Türkiye");
const disH = havuz.filter((c) => c.bolge !== "Türkiye");
process.stdout.write(`${sat("  → Türkiye holdout", trH)}\n${sat("  → pan-Akdeniz eğitim", disH)}\n`);

const egimli = havuz.map((c) => eg[ekey(c)]).filter(Boolean).map((e) => e.egim).sort((a, b) => a - b);
if (egimli.length)
  process.stdout.write(
    `\nEğim (1 km): medyan %${egimli[egimli.length >> 1]} · ` +
      `%75 ${egimli[Math.floor(egimli.length * 0.75)]} · %90 ${egimli[Math.floor(egimli.length * 0.9)]} · ` +
      `max ${egimli.at(-1)}\n`
  );

if (hataVar) {
  process.stdout.write("\n🔴 İŞ BİTMEDİ — yukarıdaki eksikler için betiği tekrar koştur.\n");
  process.exit(1);
}
process.stdout.write("\n✅ Çevre özellikleri hazır.\n");
