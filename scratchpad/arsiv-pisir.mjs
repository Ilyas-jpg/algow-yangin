/**
 * Geçmiş arşivi pişirici — FIRMS SP (Standard Processing) → statik JSON.
 *
 * NRT beslemesi yalnız son ~2 ayı tutar; SP arşivi 2012'ye kadar açıktır.
 * Türkiye'nin büyük yangınlarının halka açık, Türkçe bir oynatması hiçbir
 * yerde yok — kamu hafızası açısından da, "yangın nasıl ilerler" sorusunu
 * canlı harita beklemeden anlatmak açısından da değerli.
 *
 * Çalışma anında FIRMS'e hiç dokunulmaz: çıktı public/arsiv/*.json olarak
 * depoya girer, sunucuda sıfır kota, sıfır gecikme.
 *
 * Çalıştırma (proje kökünden):
 *   node scratchpad/arsiv-pisir.mjs
 *
 * Not: .env.local içindeki FIRMS_MAP_KEY okunur.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const KOK = process.cwd();
const CIKTI = join(KOK, "public", "arsiv");

const env = readFileSync(join(KOK, ".env.local"), "utf8");
const KEY = (env.match(/^FIRMS_MAP_KEY=(.*)$/m)?.[1] ?? "").trim();
if (!KEY) throw new Error(".env.local içinde FIRMS_MAP_KEY yok");

/**
 * Kaynak seti yıla göre değişir — ÖLÇÜLDÜ (2026-08-02):
 * SP arşivi güncel sezonu KAPSAMIYOR (2026'nın her ayında 0 tespit),
 * NRT ise 1 Mayıs 2026'ya kadar gidiyor. Sınır ~1 Nisan 2026.
 */
const SP_KAYNAK = ["VIIRS_SNPP_SP", "VIIRS_NOAA20_SP", "MODIS_SP"];
const NRT_KAYNAK = [
  "VIIRS_SNPP_NRT",
  "VIIRS_NOAA20_NRT",
  "VIIRS_NOAA21_NRT",
  "MODIS_NRT",
];
const GUNCEL_YIL = new Date().getUTCFullYear();
const kaynakSeti = (baslangic) =>
  Number(baslangic.slice(0, 4)) >= GUNCEL_YIL ? NRT_KAYNAK : SP_KAYNAK;
/**
 * FIRMS area API tek istekte en fazla 5 gün veriyor — 10 denendi, HTTP 400
 * "Expects [1..5]" döndü. Bu sınır SP arşivinde de aynı (NRT'de zaten
 * biliniyordu, bbox'a bağlı sanılıyordu; değil, global sınır).
 */
const GUN = 5;

/**
 * Arşivlenecek yangınlar. Tarih ve kutu bilinçli olarak geniş tutuldu;
 * gerçekte veri var mı betiğin çıktısı söyler — uydurma kayıt basmıyoruz.
 */
const YANGINLAR = [
  // ── 2026 sezonu (NRT). Adaylar veriden seçildi: sanayi dışı, 2-16 gün
  // süren, en çok tespit üreten noktalar — kısa ve yoğun patern gerçek
  // orman yangınına işaret ediyor (uzun ve yayvan olanlar tarımsal).
  {
    slug: "seydikemer-2026",
    ad: "Seydikemer yangını",
    il: "Muğla",
    bbox: "28.9,36.3,29.9,37.0",
    baslangic: "2026-07-27",
    gun: 8,
    ozet:
      "29 Temmuz 2026'da Seydikemer çevresinde başlayan yangın, bu sezonun uydudan en yoğun görülen orman yangını oldu.",
    adEn: "Seydikemer fire",
    ozetEn:
      "The fire that began around Seydikemer on 29 July 2026 became this season's most intensely observed forest fire from orbit.",
  },
  {
    slug: "burhaniye-ayvalik-2026",
    ad: "Burhaniye – Ayvalık yangını",
    il: "Balıkesir",
    bbox: "26.4,39.1,27.5,39.9",
    baslangic: "2026-07-20",
    gun: 14,
    ozet:
      "Temmuz 2026'nın ikinci yarısında Burhaniye ve Ayvalık çevresinde birden çok noktada süren yangınlar.",
    adEn: "Burhaniye – Ayvalık fires",
    ozetEn:
      "Fires burning at several points around Burhaniye and Ayvalık through the second half of July 2026.",
  },
  {
    slug: "manavgat-2021",
    ad: "Manavgat yangını",
    il: "Antalya",
    bbox: "31.0,36.3,32.4,37.3",
    baslangic: "2021-07-28",
    gun: 17,
    ozet:
      "28 Temmuz 2021'de Manavgat'ta başlayan ve günlerce süren yangın, Türkiye'nin ölçülmüş en büyük orman yangınlarından biri oldu.",
    adEn: "Manavgat fire",
    ozetEn:
      "Starting in Manavgat on 28 July 2021 and burning for days, this became one of the largest measured forest fires in Türkiye.",
  },
  {
    slug: "marmaris-2021",
    ad: "Marmaris yangını",
    il: "Muğla",
    bbox: "27.9,36.6,28.9,37.3",
    baslangic: "2021-07-29",
    gun: 14,
    ozet:
      "Marmaris ve çevresinde Temmuz sonunda başlayan yangın, kıyı yerleşimlerinin tahliyesine yol açtı.",
    adEn: "Marmaris fire",
    ozetEn:
      "The fire that broke out in and around Marmaris in late July led to the evacuation of coastal settlements.",
  },
  {
    slug: "milas-2021",
    ad: "Milas yangını",
    il: "Muğla",
    bbox: "27.4,36.9,28.3,37.6",
    baslangic: "2021-08-01",
    gun: 12,
    ozet:
      "Milas'taki yangın, Kemerköy Termik Santrali'nin çevresine ulaşarak ülke gündemine oturdu.",
    adEn: "Milas fire",
    ozetEn:
      "The Milas fire reached the grounds of the Kemerköy thermal power plant and dominated the national news.",
  },

  /* ══════════════════════════════════════════════════════════════════════
   * SPEC §8 — ilerleme verisi zengin yangınlar (eklendi 2026-08-05)
   *
   * ⚠️ TARİH VE KUTU BİLEREK GENİŞ: pencereyi olayın bilinen başlangıcından
   * 1-3 gün ÖNCE başlatıyoruz. Geç başlarsak yangının ilk günleri —
   * ilerleme verisinin en değerli kısmı — arşivin dışında kalır. Betik veri
   * bulamazsa o kaydı atlıyor, uydurma basmıyor.
   *
   * ⚠️ ÖZETLER YALNIZ VERİDEN DOĞRULANABİLİR ŞEYİ SÖYLER. Ölü sayısı, yanan
   * hektar, sebep gibi bilgiler uydu verisinde YOK; onları buraya yazmak
   * arşivi kaynağı olmayan iddialarla doldurmak olurdu. Sayfa "uydu bunu
   * gördü" diyor, "şu oldu" demiyor.
   * ══════════════════════════════════════════════════════════════════════ */

  {
    slug: "marmaris-2022",
    ad: "Marmaris yangını (2022)",
    il: "Muğla",
    bbox: "27.9,36.6,28.9,37.3",
    baslangic: "2022-06-20",
    gun: 8,
    ozet:
      "2021'den bir yıl sonra aynı bölgede, Marmaris çevresinde yeniden büyük bir yangın görüldü. İki sezonu yan yana oynatmak, aynı arazinin tekrar yanmasının ne anlama geldiğini gösteriyor.",
    adEn: "Marmaris fire (2022)",
    ozetEn:
      "A year after 2021, another large fire was observed around Marmaris in the same area. Playing the two seasons side by side shows what it means for the same ground to burn again.",
  },
  {
    slug: "canakkale-kepez-2023",
    ad: "Çanakkale – Kepez yangını",
    il: "Çanakkale",
    bbox: "26.0,39.8,26.9,40.5",
    baslangic: "2023-08-20",
    gun: 8,
    ozet:
      "Çanakkale'nin Kepez çevresinde Ağustos 2023'te görülen yangın, Boğaz'ın iki yakasındaki yerleşimlere yakınlığıyla dikkat çekti.",
    adEn: "Çanakkale – Kepez fire",
    ozetEn:
      "The fire observed around Kepez in Çanakkale in August 2023 stood out for how close it came to settlements on both sides of the strait.",
  },
  {
    slug: "izmir-yamanlar-2024",
    ad: "İzmir – Yamanlar yangını",
    il: "İzmir",
    bbox: "26.9,38.3,27.6,38.9",
    baslangic: "2024-08-13",
    gun: 6,
    ozet:
      "Yamanlar ve Karşıyaka sırtlarında Ağustos 2024'te görülen yangın, şehir içi bir yerleşimin hemen üstündeki ormanda ilerledi.",
    adEn: "İzmir – Yamanlar fire",
    ozetEn:
      "The August 2024 fire on the Yamanlar and Karşıyaka ridges advanced through forest directly above an urban settlement.",
  },
  {
    slug: "seferihisar-2025",
    ad: "Seferihisar – Menderes yangını",
    il: "İzmir",
    bbox: "26.7,37.9,27.5,38.5",
    baslangic: "2025-06-28",
    gun: 7,
    ozet:
      "Haziran 2025'te Seferihisar ile Menderes arasında görülen yangın, sezonun erken başladığı bir yılın ilk büyük olaylarından biriydi.",
    adEn: "Seferihisar – Menderes fire",
    ozetEn:
      "Observed between Seferihisar and Menderes in June 2025, this was one of the first large events of a season that started early.",
  },
  {
    slug: "odemis-kiraz-2025",
    ad: "Ödemiş – Kiraz yangını",
    il: "İzmir",
    bbox: "27.8,38.0,28.6,38.6",
    baslangic: "2025-07-03",
    gun: 7,
    ozet:
      "Temmuz 2025'te Ödemiş ve Kiraz çevresinde görülen yangın, İzmir'in iç kesimindeki dağlık arazide ilerledi.",
    adEn: "Ödemiş – Kiraz fire",
    ozetEn:
      "The July 2025 fire around Ödemiş and Kiraz advanced through the mountainous terrain of inland İzmir.",
  },
  {
    slug: "bursa-kestel-2025",
    ad: "Bursa – Kestel yangını",
    il: "Bursa",
    // İlk denemede 19 tespit (VIIRS_SNPP=0) geldi; kutu ve pencere genişletildi.
    bbox: "28.8,39.8,30.1,40.6",
    baslangic: "2025-06-30",
    gun: 20,
    ozet:
      "Kestel ve Gürsu çevresinde Temmuz 2025'te görülen yangın, büyük bir şehrin doğu sırtlarında ilerledi.",
    adEn: "Bursa – Kestel fire",
    ozetEn:
      "The July 2025 fire around Kestel and Gürsu advanced along the eastern ridges of a major city.",
  },
  {
    slug: "karabuk-2025",
    ad: "Karabük yangını",
    il: "Karabük",
    bbox: "32.2,40.9,33.3,41.6",
    baslangic: "2025-07-26",
    gun: 14,
    ozet:
      "Temmuz sonunda Karabük çevresinde başlayan yangın günlerce sürdü. Batı Karadeniz'in yoğun ormanında çıkan yangınlar, kanopi altında ilerlediği için uydudan görülmesi en zor olanlar arasında.",
    adEn: "Karabük fire",
    ozetEn:
      "The fire that began around Karabük in late July burned for days. Fires in the dense forest of the western Black Sea region are among the hardest to see from orbit, because they advance beneath the canopy.",
  },
  {
    slug: "eskisehir-2025",
    ad: "Eskişehir yangını",
    il: "Eskişehir",
    // Kutu il sınırına genişletildi: ilk denemede 30,2–31,4 kullanıldı ve
    // yalnız 20 tespit geldi — Mihalıççık/Seyitgazi gibi doğu ve güney
    // kesimleri kutunun dışında kalıyordu. Pencere de 4 gün öne alındı.
    bbox: "29.9,38.8,32.1,40.3",
    baslangic: "2025-06-24",
    gun: 16,
    // Bu kayıt bir OYNATMA değil, ANMA + ANALİZ olarak yazıldı (spec §8).
    // Can kaybı sayısı, sebebi ve müdahalenin seyri uydu verisinde YOK;
    // buraya yazılmadı. Sayfanın söyleyebildiği tek şey uydunun gördüğü.
    ozet:
      "Haziran 2025'te Eskişehir çevresinde çıkan yangında can kayıpları oldu. Bu kayıt bir gösteri değil: uydunun o günlerde ne gördüğünü, yangının hangi saatlerde nereye ilerlediğini kayda geçiriyor. Ölçemediğimiz her şey — müdahalenin seyri, kaybedilenler — bu verinin dışındadır ve öyle kalmalıdır.",
    adEn: "Eskişehir fire",
    ozetEn:
      "Lives were lost in the fire that broke out around Eskişehir in June 2025. This record is not a spectacle: it documents what the satellite saw on those days, and where the fire advanced hour by hour. Everything we cannot measure — how the response unfolded, those who were lost — lies outside this data and should stay outside it.",
  },

  /* ── Yunanistan: hem arşiv hem eğitim seti için değerli (spec §8).
       Kutu Türkiye dışında; harita zaten Yunanistan'ı kapsıyor. ── */
  {
    slug: "evia-2021",
    ad: "Eğriboz (Evia) yangını",
    il: "Yunanistan",
    bbox: "23.0,38.3,24.4,39.2",
    baslangic: "2021-08-02",
    gun: 16,
    ozet:
      "Ağustos 2021'de Eğriboz adasının kuzeyinde günlerce süren yangın, Akdeniz havzasının uydudan en iyi kaydedilmiş mega yangınlarından biri. İlerleme verisi bu yüzden çok zengin.",
    adEn: "Evia fire",
    ozetEn:
      "Burning for days in northern Evia in August 2021, this is one of the best satellite-documented mega-fires in the Mediterranean basin — which is why its progression record is so rich.",
  },
  {
    slug: "rodos-2023",
    ad: "Rodos yangını",
    il: "Yunanistan",
    bbox: "27.6,35.8,28.4,36.5",
    baslangic: "2023-07-17",
    gun: 12,
    ozet:
      "Temmuz 2023'te Rodos'ta günlerce süren yangın, ada içindeki dağlık kesimden kıyıya doğru ilerledi.",
    adEn: "Rhodes fire",
    ozetEn:
      "The July 2023 fire on Rhodes burned for days, advancing from the island's mountainous interior towards the coast.",
  },
  {
    slug: "evros-dadia-2023",
    ad: "Evros – Dadia yangını",
    il: "Yunanistan",
    bbox: "25.6,40.7,26.6,41.5",
    baslangic: "2023-08-18",
    gun: 20,
    ozet:
      "Ağustos 2023'te Evros'ta, Dadia ormanı çevresinde başlayan yangın haftalarca sürdü ve Avrupa'da uydudan ölçülmüş en büyük yangınlar arasına girdi. Türkiye sınırının hemen batısında olması, aynı iklim ve yakıt tipinde bir yangının nasıl ilerlediğini göstermesi bakımından ayrıca değerli.",
    adEn: "Evros – Dadia fire",
    ozetEn:
      "Beginning around the Dadia forest in Evros in August 2023, this fire burned for weeks and became one of the largest measured from orbit in Europe. Sitting just west of the Turkish border, it is also valuable for showing how a fire advances in the same climate and fuel type.",
  },
  {
    slug: "varnavas-2024",
    ad: "Varnavas – Atina yangını",
    il: "Yunanistan",
    bbox: "23.5,37.9,24.3,38.5",
    baslangic: "2024-08-10",
    gun: 8,
    ozet:
      "Ağustos 2024'te Varnavas'ta başlayan yangın Atina'nın kuzey banliyölerine doğru ilerledi — büyük bir metropolün eşiğinde ilerleyen bir orman yangınının kaydı.",
    adEn: "Varnavas – Athens fire",
    ozetEn:
      "The August 2024 fire that began at Varnavas advanced towards the northern suburbs of Athens — the record of a forest fire moving up to the edge of a major metropolis.",
  },
];

// ⚠️ Yeni kayıt eklerken `adEn` ve `ozetEn` de yaz: İngilizce arşiv sayfası
// bunları index.json'dan okuyor, eksikse o kayıt Türkçe görünür.

function gunEkle(tarih, n) {
  const d = new Date(tarih + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function csvAyristir(csv, satAd) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const h = lines[0].split(",").map((x) => x.trim());
  const i = (n) => h.indexOf(n);
  const iLat = i("latitude"), iLon = i("longitude"), iDate = i("acq_date");
  const iTime = i("acq_time"), iFrp = i("frp"), iDn = i("daynight");
  if (iLat < 0 || iLon < 0) return [];
  const out = [];
  for (let k = 1; k < lines.length; k++) {
    const c = lines[k].split(",");
    if (c.length < h.length) continue;
    const lat = +c[iLat], lon = +c[iLon];
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const t = parseInt(c[iTime], 10);
    const dt = Date.parse(
      `${c[iDate]}T${String(Math.floor(t / 100)).padStart(2, "0")}:${String(t % 100).padStart(2, "0")}:00Z`
    );
    if (!isFinite(dt)) continue;
    const frp = parseFloat(c[iFrp]);
    out.push({
      lon: Math.round(lon * 1e4) / 1e4,
      lat: Math.round(lat * 1e4) / 1e4,
      frp: isFinite(frp) ? Math.round(Math.max(0, frp) * 10) / 10 : 0,
      dt,
      sat: satAd,
      dn: (c[iDn] ?? "D").trim().toUpperCase() === "N" ? "N" : "D",
    });
  }
  return out;
}

mkdirSync(CIKTI, { recursive: true });

/**
 * Tek yangını yeniden pişirmek için: `ONLY=eskisehir-2025 node ...`
 *
 * Neden gerekti: yeni bir kayıt eklerken tarih/kutu tahmini ilk denemede
 * tutmayabiliyor (bursa-kestel ilk turda 19 tespit verdi) ve düzeltmek için
 * 17 yangının tamamını yeniden indirmek gereksiz — FIRMS'e de saygısızlık.
 * ⚠️ ONLY kullanıldığında index.json DOKUNULMAZ: eksik listeyle üzerine
 * yazmak diğer 15 yangını arşivden siler.
 */
const SADECE = (process.env.ONLY ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const secili = SADECE.length ? YANGINLAR.filter((y) => SADECE.includes(y.slug)) : YANGINLAR;
if (SADECE.length) {
  console.log(`ONLY=${SADECE.join(",")} → ${secili.length} yangın pişirilecek, index.json korunacak\n`);
}

const indeks = [];

for (const y of secili) {
  const hepsi = [];
  const kaynakDurum = [];
  for (const src of kaynakSeti(y.baslangic)) {
    let alt = 0;
    for (let off = 0; off < y.gun; off += GUN) {
      const tarih = gunEkle(y.baslangic, off);
      const aralik = Math.min(GUN, y.gun - off);
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/${src}/${y.bbox}/${aralik}/${tarih}`;
      try {
        const r = await fetch(url);
        const txt = await r.text();
        if (!r.ok || !txt.startsWith("latitude")) {
          console.log(`   ! ${src} ${tarih}: ${r.status} ${txt.slice(0, 60)}`);
          continue;
        }
        const p = csvAyristir(txt, src.includes("NOAA20") ? "1" : src.includes("SNPP") ? "N" : "M");
        hepsi.push(...p);
        alt += p.length;
      } catch (e) {
        console.log(`   ! ${src} ${tarih}: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    kaynakDurum.push(`${src}=${alt}`);
  }

  // Tekrar temizliği (aynı piksel iki chunk'ta gelebilir)
  const gorulen = new Set();
  const pts = [];
  for (const p of hepsi.sort((a, b) => a.dt - b.dt)) {
    const k = `${p.sat}:${p.lat}:${p.lon}:${p.dt}`;
    if (gorulen.has(k)) continue;
    gorulen.add(k);
    pts.push(p);
  }

  if (pts.length === 0) {
    console.log(`✗ ${y.slug}: veri yok — atlanıyor (${kaynakDurum.join(" ")})`);
    continue;
  }

  // Ağırlık merkezi ve zaman aralığı veriden gelsin, elle yazılmasın
  const lon = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const ilk = pts[0].dt;
  const son = pts[pts.length - 1].dt;

  // Sütunlu biçim: GeoJSON'a göre ~3 kat küçük
  const SAT = ["N", "1", "M"];
  const govde = {
    slug: y.slug,
    ad: y.ad,
    il: y.il,
    ozet: y.ozet,
    center: [Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4],
    ilk,
    son,
    sats: SAT,
    // [lon, lat, frp, dt, satIdx, gece]
    pts: pts.map((p) => [p.lon, p.lat, p.frp, p.dt, SAT.indexOf(p.sat), p.dn === "N" ? 1 : 0]),
  };

  const yol = join(CIKTI, `${y.slug}.json`);
  writeFileSync(yol, JSON.stringify(govde));
  const kb = Math.round(JSON.stringify(govde).length / 1024);
  console.log(
    `✓ ${y.slug}: ${pts.length} tespit · ${kb} KB · ${new Date(ilk).toISOString().slice(0, 10)} → ${new Date(son).toISOString().slice(0, 10)} · ${kaynakDurum.join(" ")}`
  );
  indeks.push({
    slug: y.slug,
    ad: y.ad,
    adEn: y.adEn,
    il: y.il,
    ozet: y.ozet,
    ozetEn: y.ozetEn,
    ilk,
    son,
    tespit: pts.length,
    maxFrp: Math.round(Math.max(...pts.map((p) => p.frp))),
  });
}

if (SADECE.length) {
  console.log(
    `\nindex.json YAZILMADI (ONLY modu) — tam listeyi tazelemek için betiği süzgeçsiz koştur.`
  );
} else {
  writeFileSync(join(CIKTI, "index.json"), JSON.stringify(indeks, null, 1));
  console.log(`\nindex.json yazıldı — ${indeks.length} yangın`);
}
