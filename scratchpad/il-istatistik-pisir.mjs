/**
 * İl bazlı sezon istatistiği pişirici — FIRMS → statik JSON.
 *
 * NEDEN: 81 il sayfası metinsel olarak birebir aynıydı (ölçüldü: %100 kelime
 * ortaklığı, hiçbir ile özgü kelime yok) çünkü içerik yalnız boilerplate +
 * 81 illik gezinme listesiydi. Arama motoru açısından bu 81 ayrı sayfa değil,
 * aynı sayfanın 81 kopyası. Bu betik her ile GERÇEKTEN ait sayıları üretiyor.
 *
 * VERİ KAYNAĞI — iki beslemeyi zorunlu olarak karıştırıyoruz:
 *   • Güncel sezon (2026): NRT. Ölçüldü, 1 Mayıs 2026'ya kadar gidiyor.
 *   • Geçmiş sezonlar (≤2025): SP (yeniden işlenmiş arşiv).
 *   ⚠️ İkisinin ÇAKIŞTIĞI gün yok (SP ~1 Nis 2026'da bitiyor, NRT 1 May'da
 *   başlıyor), dolayısıyla besleme farkını ölçemiyoruz. Uydurmuyoruz:
 *   arayüzde "yeniden işlenmiş arşivle karşılaştırma" olarak yazılıyor.
 *
 * KAYNAK SETİ SABİT: yalnız SNPP + NOAA-20. NOAA-21 bilerek DIŞARIDA —
 * 2023'te devreye girdi, dahil edilseydi 2021-2022 sezonları yapay olarak
 * düşük görünür ve "bu yıl geçen yıllardan fazla" yanılgısı üretirdi.
 *
 * PENCERE: her yıl 1 Mayıs → bugünün ay/günü (elmayla elma).
 *
 * Çalıştırma (proje kökünden, yıl yıl — tek seferde uzun sürer):
 *   node --import ./test/register.mjs scratchpad/il-istatistik-pisir.mjs 2026
 *   ...
 *   node --import ./test/register.mjs scratchpad/il-istatistik-pisir.mjs birlestir
 *
 * Ara çıktılar scratchpad/yil-<yil>.json olarak saklanır (tekrar çalıştırınca
 * indirilmiş yıl atlanır).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { nearestPlace } from "../src/lib/places.ts";

const KOK = process.cwd();
const ARA = join(KOK, "scratchpad", "ara");
mkdirSync(ARA, { recursive: true });

const env = readFileSync(join(KOK, ".env.local"), "utf8");
const KEY = (env.match(/^FIRMS_MAP_KEY=(.*)$/m)?.[1] ?? "").trim();
if (!KEY) throw new Error(".env.local içinde FIRMS_MAP_KEY yok");

const BBOX = "25.0,34.8,45.5,42.6";
const CHUNK = 5; // FIRMS sınırı: dayRange en fazla 5
const BUGUN = new Date();
const SEZON_BASI = "05-01";

/** Elmayla elma: her yıl aynı takvim penceresi */
function pencere(yil) {
  const bas = new Date(`${yil}-${SEZON_BASI}T00:00:00Z`);
  const son =
    yil === BUGUN.getUTCFullYear()
      ? BUGUN
      : new Date(
          Date.UTC(yil, BUGUN.getUTCMonth(), BUGUN.getUTCDate())
        );
  return { bas, son };
}

function gunEkle(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
const iso = (d) => d.toISOString().slice(0, 10);

function csvAyristir(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const h = lines[0].split(",").map((x) => x.trim());
  const i = (n) => h.indexOf(n);
  const iLat = i("latitude"), iLon = i("longitude");
  const iDate = i("acq_date"), iFrp = i("frp");
  if (iLat < 0 || iLon < 0) return [];
  const out = [];
  for (let k = 1; k < lines.length; k++) {
    const c = lines[k].split(",");
    if (c.length < h.length) continue;
    const lat = +c[iLat], lon = +c[iLon];
    if (!isFinite(lat) || !isFinite(lon)) continue;
    out.push({ lat, lon, tarih: c[iDate], frp: parseFloat(c[iFrp]) || 0 });
  }
  return out;
}

async function yilIndir(yil) {
  const dosya = join(ARA, `yil-${yil}.json`);
  if (existsSync(dosya)) {
    console.log(`↷ ${yil} zaten indirilmiş, atlanıyor`);
    return JSON.parse(readFileSync(dosya, "utf8"));
  }

  const nrt = yil === BUGUN.getUTCFullYear();
  const kaynaklar = nrt
    ? ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT"]
    : ["VIIRS_SNPP_SP", "VIIRS_NOAA20_SP"];

  const { bas, son } = pencere(yil);
  const iller = {}; // il → { n, gunler:{}, enFrp:{} }
  const hucreler = {}; // il → { "lon,lat" (0,05°) → tespit sayısı } — yakıt sorgusu hedefi
  let toplam = 0;

  for (const src of kaynaklar) {
    for (let d = new Date(bas); d <= son; d = gunEkle(d, CHUNK)) {
      const kalan = Math.ceil((son - d) / 86400000) + 1;
      const aralik = Math.max(1, Math.min(CHUNK, kalan));
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/${src}/${BBOX}/${aralik}/${iso(d)}`;
      try {
        const r = await fetch(url);
        const txt = await r.text();
        if (!r.ok || !txt.startsWith("latitude")) continue;
        for (const p of csvAyristir(txt)) {
          const yer = nearestPlace(p.lon, p.lat);
          if (yer.abroad) continue; // sınır ötesi tespitler il istatistiğine girmez
          const il = yer.il;
          const rec = (iller[il] ??= { n: 0, gunler: {}, enFrp: null });
          rec.n++;
          toplam++;
          rec.gunler[p.tarih] = (rec.gunler[p.tarih] ?? 0) + 1;
          if (!rec.enFrp || p.frp > rec.enFrp.frp) {
            rec.enFrp = { frp: Math.round(p.frp), tarih: p.tarih, yer: yer.label };
          }
          // Hücre başına AYRI GÜN sayısı kritik: sanayi bacası neredeyse her
          // gün sıcak, yangın birkaç gün. Ham tespit sayısı ikisini ayırmıyor.
          const hk = `${(Math.round(p.lon * 20) / 20).toFixed(2)},${(Math.round(p.lat * 20) / 20).toFixed(2)}`;
          const hh = (hucreler[il] ??= {});
          const hc = (hh[hk] ??= { n: 0, gunler: {} });
          hc.n++;
          hc.gunler[p.tarih] = 1;
        }
      } catch (e) {
        console.log(`   ! ${src} ${iso(d)}: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    process.stdout.write(`  ${src} bitti · toplam ${toplam}\n`);
  }

  writeFileSync(dosya, JSON.stringify({ yil, toplam, iller, hucreler }));
  console.log(`✓ ${yil}: ${toplam} tespit · ${Object.keys(iller).length} il`);
  return { yil, toplam, iller };
}

/**
 * Yakıt sınıfı — "bu ilde yanan ne?" sorusu için.
 *
 * Şanlıurfa bu sezon 5497 tespitle listenin başında ama bunların ezici çoğunluğu
 * anız yakma. Sayfada bunu söylemezsek "Türkiye'nin en çok yanan ili" diye
 * okunur ve YANLIŞ olur. İlin en yoğun tespit hücrelerini CORINE'e sorup
 * baskın örtüyü yazıyoruz.
 *
 * Maliyet disiplini: il başına yalnız en yoğun 3 hücre (0,05°) sorgulanıyor,
 * yani ~240 istek — hepsini sormak binlerce istek olurdu.
 */
async function yakitPisir() {
  const { corineAt } = await import("../src/lib/corine.ts");
  const YIL = BUGUN.getUTCFullYear();
  const ham = JSON.parse(readFileSync(join(ARA, `yil-${YIL}.json`), "utf8"));
  if (!ham.hucreler) {
    console.log(`✗ ${YIL} verisi hücre içermiyor — scratchpad/ara/yil-${YIL}.json sil ve yeniden indir`);
    process.exit(1);
  }
  // il → tespit sayısına göre sıralı hücre listesi
  const hucreler = {};
  for (const [il, h] of Object.entries(ham.hucreler)) {
    hucreler[il] = Object.entries(h)
      .map(([k, v]) => {
        const [lon, lat] = k.split(",").map(Number);
        return { lon, lat, n: v.n, gun: Object.keys(v.gunler).length };
      })
      .sort((a, b) => b.n - a.n);
  }

  const cikti = {};
  const iller = Object.keys(hucreler);
  for (let i = 0; i < iller.length; i++) {
    const il = iller[i];
    const enYogun = hucreler[il].slice(0, 3);
    const siniflar = [];
    for (const h of enYogun) {
      const f = await corineAt(h.lon, h.lat);
      if (f) siniflar.push({ fuel: f, n: h.n });
      await new Promise((r) => setTimeout(r, 200));
    }
    // Tespit sayısıyla ağırlıklı baskın sınıf
    const agirlik = {};
    for (const s of siniflar) agirlik[s.fuel] = (agirlik[s.fuel] ?? 0) + s.n;
    const baskin = Object.entries(agirlik).sort((a, b) => b[1] - a[1])[0];
    cikti[il] = baskin
      ? { baskin: baskin[0], kapsam: siniflar.length, ornek: siniflar.map((s) => s.fuel) }
      : null;
    if ((i + 1) % 15 === 0) console.log(`  ${i + 1}/${iller.length} il`);
  }
  writeFileSync(join(ARA, `yakit-${YIL}.json`), JSON.stringify(cikti));
  const sayim = {};
  for (const v of Object.values(cikti)) if (v) sayim[v.baskin] = (sayim[v.baskin] ?? 0) + 1;
  console.log("✓ yakıt pişti:", Object.entries(sayim).map(([k, v]) => `${k}=${v}`).join(" · "));
  void ham;
}

// ── Çalıştırma
const arg = process.argv[2];

if (arg === "birlestir") {
  const YILLAR = [2021, 2022, 2023, 2024, 2025, 2026];
  const veri = {};
  for (const y of YILLAR) {
    const f = join(ARA, `yil-${y}.json`);
    if (!existsSync(f)) {
      console.log(`✗ ${y} eksik — önce indir`);
      process.exit(1);
    }
    veri[y] = JSON.parse(readFileSync(f, "utf8"));
  }

  const guncel = BUGUN.getUTCFullYear();
  const gecmis = YILLAR.filter((y) => y !== guncel);
  const cikti = { pencere: { bas: SEZON_BASI, son: iso(BUGUN).slice(5) }, guncelYil: guncel, iller: {} };

  // Yalnız 81 il. KKTC nearestPlace'te "yurt dışı" değil (doğru bir tercih)
  // ama bir il de değil ve /yangin/kktc sayfası yok — istatistiğe girmemeli.
  const { PROVINCES } = await import("../src/lib/provinces.ts");
  const gecerli = new Set(PROVINCES.map((p) => p.ad));
  const tumIller = new Set();
  for (const y of YILLAR)
    for (const il of Object.keys(veri[y].iller)) if (gecerli.has(il)) tumIller.add(il);

  // Sabit ısı kaynakları (rafineri/çelik/santral) il sayısını şişiriyor:
  // Zonguldak'ın tespitlerinin neredeyse tamamı tek bir tesis. Ayrıştırılmadan
  // "ilde N yangın tespiti" yazmak yanlış olurdu.
  const { FIXED_SOURCES } = await import("../src/data/fixed-sources.ts");
  const sabitAnahtar = new Set(
    FIXED_SOURCES.map(([lon, lat]) => `${lon.toFixed(2)},${lat.toFixed(2)}`)
  );

  /**
   * Bir yılın o ildeki sabit-kaynak tespitleri. HER YIL için hesaplanıyor:
   * yalnız güncel sezondan düşüp geçmiş ortalamayı ham bırakmak elmayla armut
   * kıyası olurdu (Zonguldak "7 yangın tespiti · geçmiş ort. 869" diye
   * saçmalıyordu — 869'un neredeyse tamamı aynı tesis).
   * Tesisler geçmiş sezonlarda da oradaydı, aynı hücreler düşülüyor.
   */
  const sabitSay = (yil, il) => {
    let n = 0;
    for (const [k, v] of Object.entries(veri[yil].hucreler?.[il] ?? {})) {
      const [lo, la] = k.split(",").map(Number);
      if (sabitAnahtar.has(`${lo.toFixed(2)},${la.toFixed(2)}`)) n += v.n;
    }
    return n;
  };

  for (const il of tumIller) {
    const bu = veri[guncel].iller[il] ?? { n: 0, gunler: {}, enFrp: null };
    const sabitTespit = sabitSay(guncel, il);
    const gecmisSayilar = gecmis.map((y) =>
      Math.max(0, (veri[y].iller[il]?.n ?? 0) - sabitSay(y, il))
    );
    const ortalama = gecmisSayilar.reduce((a, b) => a + b, 0) / gecmisSayilar.length;

    // En yoğun gün
    let enYogun = null;
    for (const [t, n] of Object.entries(bu.gunler)) {
      if (!enYogun || n > enYogun.n) enYogun = { tarih: t, n };
    }

    cikti.iller[il] = {
      buSezon: bu.n,
      /** sabit ısı kaynaklarından gelen tespitler (yangın değil) */
      sabitTespit,
      /** sabit kaynaklar düşülmüş — sayfada gösterilen sayı bu */
      yanginTespit: Math.max(0, bu.n - sabitTespit),
      enYogunGun: enYogun,
      enYuksekFrp: bu.enFrp,
      gecmisOrtalama: Math.round(ortalama),
      // Yıllara göre tablo da sabit kaynaklardan arındırılmış
      yillar: Object.fromEntries(
        YILLAR.map((y) => [
          y,
          Math.max(0, (veri[y].iller[il]?.n ?? 0) - sabitSay(y, il)),
        ])
      ),
    };
  }

  const yol = join(KOK, "public", "il-istatistik.json");
  writeFileSync(yol, JSON.stringify(cikti));
  const kb = Math.round(JSON.stringify(cikti).length / 1024);
  console.log(`\n✓ public/il-istatistik.json yazıldı — ${tumIller.size} il · ${kb} KB`);
  const sirali = [...tumIller]
    .map((il) => [il, cikti.iller[il].buSezon])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  console.log("Bu sezon en çok tespit:", sirali.map(([i, n]) => `${i} ${n}`).join(" · "));
} else if (arg === "yakit") {
  await yakitPisir();
} else {
  const yil = Number(arg);
  if (!yil) {
    console.log("Kullanım: ... il-istatistik-pisir.mjs <yil>|birlestir");
    process.exit(1);
  }
  await yilIndir(yil);
}
