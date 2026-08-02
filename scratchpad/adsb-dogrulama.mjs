/**
 * ADS-B söndürme uçağı doğrulaması — AKTİF YANGIN OLAN BİR GÜN, GÜNDÜZ ÇALIŞTIR.
 *
 * Soru: Türkiye'deki söndürme uçak/helikopterleri ADS-B beslemesinde görünüyor
 * mu ve yolcu trafiğinden ayırabiliyor muyuz?
 *
 * ── Neyi ölçtük, ne öğrendik (2026-08-02) ───────────────────────────────────
 * • OpenSky ELENDİ: canlı `states/all` çalışıyor ama Türkiye kırsalında alıcı
 *   yoğunluğu düşük ve uçak TİPİ vermiyor (metadata API'si HTTP 410 Gone).
 *   Aynı anda yangın çevresinde 0 aday gösterdi.
 * • airplanes.live SEÇİLDİ: ücretsiz, anahtarsız, `t` (tip kodu) ve `r`
 *   (tescil) alanlarını doğrudan veriyor. Kapsaması belirgin şekilde daha iyi:
 *   OpenSky tüm Türkiye için ~21 KB dönerken bu tek sorguda 185 KB döndü.
 * • KANIT: 11:42'de Atina çevresinde 6 adet Erickson S-64 Skycrane + 1 Bell 214
 *   söndürme helikopteri, 1000-2000 ft / 65-110 kt ile net göründü
 *   (N217AC, N243AC, N615HX, N154AC, N218AC, N512EV). Yani söndürme
 *   hava araçları bu beslemede GÖRÜNÜYOR ve tipiyle tanınıyor.
 * • AÇIK KALAN: aynı anda Türkiye kutusunda yangın tipi eşleşmesi 0'dı — ama
 *   o gün Türkiye'de kayda değer bir hava müdahalesi de yoktu (en büyük yurt
 *   içi yangın 30 MW). Yani "Türk filosu yayın yapmıyor" SONUCU ÇIKARILAMAZ.
 *
 * ── Karar kuralı ────────────────────────────────────────────────────────────
 * Bu betiği, haberlerde "X uçak Y helikopter müdahale ediyor" denen bir günde
 * öğlen çalıştır:
 *   ✅ Yangın tipi eşleşmesi çıkarsa → özellik yapılabilir, tip+tescil ile
 *      dürüstçe etiketlenir.
 *   ❌ Müdahale olduğu KESİN olan bir günde bile 0 çıkarsa → Türk filosu
 *      beslemede yok demektir, madde kalıcı düşer.
 *
 * Çalıştırma:
 *   node scratchpad/adsb-dogrulama.mjs        # tek tur
 *   node scratchpad/adsb-dogrulama.mjs 6      # 6 tur, 60 sn arayla
 */

const FIRES = "https://yangin.algow.net/api/fires?days=1";
const YAKIN_KM = 25;

/** Türkiye'yi kaplayan sorgu merkezleri (yarıçap 250 nm, API sınırı) */
const MERKEZLER = [
  [38.8, 28.5],
  [38.5, 34.5],
  [38.5, 40.5],
  [40.8, 31.0],
];

/** Türkiye kara kutusu — Yunanistan/Kıbrıs adalarını dışarıda tutar */
const TR = { latMin: 36, latMax: 42.1, lonMin: 26.5, lonMax: 44.8 };

/**
 * Söndürme hava aracı tip kodları.
 * S64 Skycrane · B214/B412 Bell · AT8x/A802 Air Tractor · PZL M18 Dromader
 * KA32 Kamov · MI8/MI17 Mil · CL2x/CL41 Canadair · AS3x/BK17/H500 hafif heli
 */
const YANGIN_TIPI =
  /^(S64|B214|B412|AT8|A802|PZL|M18|KA32|KA27|MI8|MI17|CL2|CL41|AS3|BK17|H500|B205|B206|B407)/i;

const turlar = Number(process.argv[2] ?? 1);

function havKm(lon1, lat1, lon2, lat2) {
  const R = 6371;
  const r = (x) => (x * Math.PI) / 180;
  const dLat = r(lat2 - lat1);
  const dLon = r(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Yoğun tespit kümeleri — kabaca "yangın var" noktaları */
async function yanginNoktalari() {
  const r = await fetch(FIRES);
  if (!r.ok) throw new Error("fires " + r.status);
  const d = await r.json();
  const hucre = new Map();
  for (const f of d.features) {
    const [lon, lat] = f.geometry.coordinates;
    const k = `${Math.round(lon * 20)}:${Math.round(lat * 20)}`;
    const c = hucre.get(k) ?? { lon: 0, lat: 0, n: 0, frp: 0 };
    c.lon += lon;
    c.lat += lat;
    c.n++;
    c.frp += f.properties.frp;
    hucre.set(k, c);
  }
  return [...hucre.values()]
    .filter((c) => c.n >= 3)
    .map((c) => ({ lon: c.lon / c.n, lat: c.lat / c.n, frp: c.frp }))
    .sort((a, b) => b.frp - a.frp)
    .slice(0, 20);
}

async function ucaklar() {
  const hep = new Map();
  for (const [lat, lon] of MERKEZLER) {
    try {
      const r = await fetch(
        `https://api.airplanes.live/v2/point/${lat}/${lon}/250`
      );
      if (!r.ok) continue;
      const d = await r.json();
      for (const a of d.ac ?? []) if (a.hex) hep.set(a.hex, a);
    } catch {
      /* bir merkez düşerse diğerleri devam etsin */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return [...hep.values()];
}

const gorulme = new Map();

for (let tur = 1; tur <= turlar; tur++) {
  const saat = new Date().toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul",
  });
  try {
    const [fires, ac] = await Promise.all([yanginNoktalari(), ucaklar()]);
    const trAc = ac.filter(
      (a) =>
        typeof a.lat === "number" &&
        a.lat > TR.latMin &&
        a.lat < TR.latMax &&
        a.lon > TR.lonMin &&
        a.lon < TR.lonMax
    );

    const tipEsleseni = trAc.filter((a) => YANGIN_TIPI.test(a.t || ""));
    const yakin = [];
    for (const a of trAc) {
      let enYakin = Infinity;
      for (const f of fires) {
        const km = havKm(a.lon, a.lat, f.lon, f.lat);
        if (km < enYakin) enYakin = km;
      }
      const alt = a.alt_baro === "ground" ? 0 : a.alt_baro;
      const alcak = typeof alt === "number" && alt < 9000;
      const yavas = typeof a.gs === "number" && a.gs < 150;
      if (enYakin <= YAKIN_KM && alcak && yavas) {
        yakin.push({ a, km: enYakin });
        gorulme.set(a.hex, (gorulme.get(a.hex) ?? 0) + 1);
      }
    }

    console.log(
      `[tur ${tur}/${turlar} · ${saat}] yangın kümesi=${fires.length} · TR'de uçak=${trAc.length} → yangın tipi=${tipEsleseni.length} · yangına yakın alçak-yavaş=${yakin.length}`
    );
    for (const a of tipEsleseni) {
      console.log(
        `   🔥TİP ${String(a.r || "?").padEnd(10)}${String(a.t).padEnd(6)} alt=${String(a.alt_baro).padStart(6)} ${String(a.gs ?? "-").padStart(6)}kt  ${a.lat.toFixed(2)},${a.lon.toFixed(2)}  ${a.desc ?? ""}`
      );
    }
    for (const { a, km } of yakin) {
      console.log(
        `   yakın ${String(a.r || "?").padEnd(10)}${String(a.t || "?").padEnd(6)} alt=${String(a.alt_baro).padStart(6)} ${String(a.gs).padStart(6)}kt · yangına ${km.toFixed(1)} km · ${gorulme.get(a.hex)}. kez  ${(a.desc ?? "").slice(0, 30)}`
      );
    }
  } catch (e) {
    console.log(`[tur ${tur}] HATA: ${e.message}`);
  }
  if (tur < turlar) await new Promise((r) => setTimeout(r, 60_000));
}

const tekrar = [...gorulme.entries()].filter(([, n]) => n >= 2);
console.log("\n════ SONUÇ ════");
if (tekrar.length) {
  console.log(
    `✅ ${tekrar.length} hava aracı birden çok turda yangın başında kaldı — sinyal gerçek, özellik yapılabilir.`
  );
} else if (gorulme.size) {
  console.log(
    `⚠️ ${gorulme.size} tekil aday var ama hiçbiri tekrar etmedi — geçen trafik olabilir. Daha uzun tur sayısıyla tekrarla.`
  );
} else {
  console.log("❌ Yangın başında kalan hava aracı yok.");
  console.log(
    "   Bunu 'filo yayın yapmıyor' diye OKUMA — o gün hava müdahalesi olmamış da olabilir."
  );
  console.log(
    "   Kesin karar için: haberlerde 'N uçak M helikopter müdahale ediyor' denen bir günde öğlen çalıştır."
  );
}
