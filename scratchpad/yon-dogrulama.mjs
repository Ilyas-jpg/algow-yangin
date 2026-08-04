/**
 * Yön tahmini doğrulaması — arşiv kayıtları üzerinde geriye dönük sınama.
 *
 * SORU: "Şu ana kadar çizdiğimiz yönelim konisi ne kadar isabetli?"
 *
 * YÖNTEM: Arşivdeki her yangını gerçek üretim kodu (`clusterEvents`,
 * `rothermelSpread`, `headSpreadKmh`, `reachShape`) ile yeniden oynatıyoruz.
 * Her uydu geçişinde "o an bilinenle" bir tahmin üretiliyor, sonra BİR SONRAKİ
 * geçişin gerçekte nereye gittiğine bakılıyor. Rüzgâr, tahmin değil ERA5
 * yeniden-analizinden (Open-Meteo archive) o saatin ölçümü.
 *
 * ⚠️ BU SINAMA TAM BAĞIMSIZ DEĞİL. wind.ts'teki ROS ve açı çapaları
 * 6 sezonluk FIRMS arşivinden ölçüldü ve buradaki kayıtların bir kısmı
 * (Manavgat/Marmaris/Milas 2021) o ölçümün içindeydi. Yani kapsama oranı
 * iyimser taraflı. Sezon-dışı (leave-one-season-out) rakam wind.ts'te kayıtlı.
 * Açı hatası daha az taraflı: çapalar hatayı değil yayılımı kalibre ediyor.
 *
 * Kullanım: node --import ./test/register.mjs scratchpad/yon-dogrulama.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clusterEvents, leadingEdge } from "../src/lib/cluster.ts";
import {
  headSpreadKmh,
  coneHalfAngle,
  reachRatio,
  rothermelSpread,
} from "../src/lib/wind.ts";
import { bearingDeg, havKm, reachShape, toRad } from "../src/lib/geo.ts";
import { expandArchive } from "../src/lib/archive.ts";
import { progression, angleGap, pointInRing } from "../src/lib/progression.ts";

const ARSIV = join(process.cwd(), "public", "arsiv");
const MIN_KM = 1.2; // cluster.ts MIN_DRIFT_KM — centroid gürültü eşiği
const MIN_PIX = 3;

const gap = angleGap;

// ── ERA5 saatlik rüzgâr (+ basınç/nem/sıcaklık) ──────────────────────────
// Gün+konum başına tek istek, bellekte tutuluyor.
const havaCache = new Map();
async function saatlikHava(lat, lon, gun) {
  const k = `${lat.toFixed(2)}:${lon.toFixed(2)}:${gun}`;
  if (havaCache.has(k)) return havaCache.get(k);
  const url =
    "https://archive-api.open-meteo.com/v1/archive" +
    `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&start_date=${gun}&end_date=${gun}` +
    "&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m," +
    "temperature_2m,relative_humidity_2m,surface_pressure" +
    "&wind_speed_unit=kmh&timezone=UTC";
  let v = null;
  try {
    const r = await fetch(url);
    if (r.ok) {
      const j = await r.json();
      if (j?.hourly?.time) v = j.hourly;
    }
  } catch {
    /* ağ hatası → o geçiş atlanır, sessiz sayılır */
  }
  havaCache.set(k, v);
  return v;
}

function saatteHava(h, tMs) {
  if (!h) return null;
  const iso = new Date(Math.round(tMs / 3600_000) * 3600_000)
    .toISOString()
    .slice(0, 13);
  const i = h.time.findIndex((t) => t.slice(0, 13) === iso);
  if (i < 0) return null;
  const kmh = h.wind_speed_10m[i];
  const fromDeg = h.wind_direction_10m[i];
  if (typeof kmh !== "number" || typeof fromDeg !== "number") return null;
  return {
    kmh,
    fromDeg,
    toDeg: (fromDeg + 180) % 360,
    gust: h.wind_gusts_10m?.[i] ?? null,
    tempC: h.temperature_2m?.[i] ?? null,
    rh: h.relative_humidity_2m?.[i] ?? null,
    pressure: h.surface_pressure?.[i] ?? null,
  };
}

// ── Arazi: eğim + yokuş-yukarı yön (olay merkezinde bir kez) ─────────────
const arazCache = new Map();
async function arazi(lat, lon) {
  const k = `${lat.toFixed(2)}:${lon.toFixed(2)}`;
  if (arazCache.has(k)) return arazCache.get(k);
  const dLat = 1 / 111;
  const dLon = 1 / (111 * Math.cos(toRad(lat)));
  const lats = [lat, lat + dLat, lat - dLat, lat, lat];
  const lons = [lon, lon, lon, lon + dLon, lon - dLon];
  let v = null;
  try {
    const r = await fetch(
      "https://api.open-meteo.com/v1/elevation" +
        `?latitude=${lats.map((x) => x.toFixed(4)).join(",")}` +
        `&longitude=${lons.map((x) => x.toFixed(4)).join(",")}`
    );
    if (r.ok) {
      const e = (await r.json()).elevation;
      if (Array.isArray(e) && e.length === 5) {
        const dzdy = (e[1] - e[2]) / 2000; // K-G, metre/metre
        const dzdx = (e[3] - e[4]) / 2000; // D-B
        const slopePct = Math.hypot(dzdx, dzdy) * 100;
        const upslopeDeg = ((Math.atan2(dzdx, dzdy) * 180) / Math.PI + 360) % 360;
        v = { elevM: e[0], slopePct, upslopeDeg };
      }
    }
  } catch {
    /* yok say */
  }
  arazCache.set(k, v);
  return v;
}

// ── Ana döngü ────────────────────────────────────────────────────────────
const kayitlar = readdirSync(ARSIV).filter(
  (f) => f.endsWith(".json") && f !== "index.json"
);

const olcumler = [];

for (const dosya of kayitlar) {
  const a = JSON.parse(readFileSync(join(ARSIV, dosya), "utf8"));
  const pts = expandArchive(a);
  const { events } = clusterEvents(pts);
  // Kaydın ana olayı: en çok tespitli küme (kayıt zaten tek yangın için pişmiş)
  const ev = events.sort((x, y) => y.count - x.count)[0];
  if (!ev || ev.passes.length < 2) continue;

  // Geçişe ait noktaları yeniden topla (leadingEdge için lazım)
  const PASS_GAP = 90 * 60_000;
  const passPts = ev.passes.map((p) =>
    pts
      .filter((q) => Math.abs(q.dt - p.t) <= PASS_GAP)
      .map((q) => ({ lon: q.lon, lat: q.lat }))
  );

  const ar = await arazi(ev.lat, ev.lon);

  for (let i = 0; i < ev.passes.length - 1; i++) {
    const p0 = ev.passes[i];
    const p1 = ev.passes[i + 1];
    if (p0.count < MIN_PIX || p1.count < MIN_PIX) continue;

    const km = havKm(p0.lon, p0.lat, p1.lon, p1.lat);
    if (km < MIN_KM) continue; // ilerleme ölçüm gürültüsünün altında

    const saat = (p1.t - p0.t) / 3600_000;
    if (saat < 0.5 || saat > 18) continue; // aşırı uzun boşluk: arada ne olduğu bilinmiyor

    const gun = new Date(p0.t).toISOString().slice(0, 10);
    const hava = saatteHava(await saatlikHava(p0.lat, p0.lon, gun), p0.t);
    if (!hava) continue;

    // ── Üretimdeki iki tahmin: yalnız rüzgâr, ve rüzgâr+eğim ──
    const windOnly = hava.toDeg;
    const bilesik =
      ar && ar.slopePct >= 1
        ? rothermelSpread(hava.kmh, hava.toDeg, ar.slopePct, ar.upslopeDeg, null)
            .spreadDeg
        : windOnly;

    const gozlenen = bearingDeg(p0.lon, p0.lat, p1.lon, p1.lat);

    const apex = leadingEdge(
      { ...ev, lon: p0.lon, lat: p0.lat, lastPassPoints: passPts[i] },
      bilesik
    );
    let headKm = 0;
    for (let h = 0; h < Math.max(1, Math.round(saat)); h++)
      headKm += headSpreadKmh(hava.kmh);
    const ring = reachShape(apex.lon, apex.lat, bilesik, headKm, reachRatio);

    // ── YENİ YANAN alan: bir önceki geçişin ayak izinin dışındaki pikseller.
    // Koninin iddiası bu — "yangın buradan şuraya TAŞACAK".
    //
    // ⚠️ YÖN, AYAK İZİNE GÖRE ÖLÇÜLÜR. İlk denemede yeni pikselin yönü tek bir
    // tepe noktasından (apex) ölçülmüştü; Manavgat 30 km genişken "en uzak yeni
    // piksel" hep karşı uçtaki kanat çıktı ve hata sistematik olarak 90°'yi
    // aştı — yangının büyüklüğünü yön hatası diye ölçmüş oluyorduk. Doğrusu
    // her yeni pikseli EN YAKIN yanmış piksele bağlamak: yangının o noktada
    // hangi yöne taştığı budur ve olay boyutundan bağımsızdır.
    // Etiket üretimi üretim koduyla ORTAK: src/lib/progression.ts.
    // Ölçümün kendi kopyasını tutmak, ölçtüğümüz şeyin sahadaki şeyden
    // sessizce ayrışması demek.
    const ilerleme = progression(passPts[i], passPts[i + 1]);
    const basYon = ilerleme.headBearingDeg;
    const basKm = ilerleme.headGrowthKm;
    const cepheYon = ilerleme.frontBearingDeg;
    const yeni = ilerleme.newPts;
    const yeniIcinde = yeni.filter((q) => pointInRing(q, ring)).length;
    const bas = ilerleme.head;

    olcumler.push({
      kayit: dosya.replace(".json", ""),
      t: p0.t,
      saat,
      km,
      kmh: km / saat,
      windKmh: hava.kmh,
      windToDeg: hava.toDeg,
      pressure: hava.pressure,
      tempC: hava.tempC,
      rh: hava.rh,
      gust: hava.gust,
      slopePct: ar?.slopePct ?? null,
      upslopeDeg: ar?.upslopeDeg ?? null,
      tahminRuzgar: windOnly,
      tahminBilesik: bilesik,
      gozlenen,
      hataRuzgar: gap(windOnly, gozlenen),
      hataBilesik: gap(bilesik, gozlenen),
      // Öncü kenar ölçütü — koninin asıl iddiası
      basYon,
      basKm,
      cepheYon,
      hataBas: basYon === null ? null : gap(bilesik, basYon),
      hataBasRuzgar: basYon === null ? null : gap(windOnly, basYon),
      hataCephe: cepheYon === null ? null : gap(bilesik, cepheYon),
      hataCepheRuzgar: cepheYon === null ? null : gap(windOnly, cepheYon),
      yeniPiksel: yeni.length,
      yeniIcinde,
      halfAngle: coneHalfAngle(hava.kmh),
      kapsamaKm: headKm,
      kapsandi: bas ? pointInRing(bas, ring) : null,
      // Yangının o anki genişliği: koni TEK bir tepe noktasına çapalanıyor,
      // yangın büyüdükçe bu çapa cephenin tamamını temsil etmiyor.
      capKm: (() => {
        let mx = 0;
        for (const a of passPts[i])
          for (const b of passPts[i])
            mx = Math.max(mx, havKm(a.lon, a.lat, b.lon, b.lat));
        return mx;
      })(),
    });
  }
  process.stderr.write(
    `${dosya.padEnd(28)} ${String(ev.passes.length).padStart(3)} geçiş · ` +
      `${olcumler.filter((o) => o.kayit === dosya.replace(".json", "")).length} ölçüm\n`
  );
}

// ── Rapor ────────────────────────────────────────────────────────────────
const say = (xs) => xs.length;
const ort = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const med = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const yuzde = (n, d) => (d ? ((100 * n) / d).toFixed(0) + "%" : "—");
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : "—");

const ALAN = { bas: "hataBas", cephe: "hataCephe", centroid: "hataBilesik" };
const ALAN_R = {
  bas: "hataBasRuzgar",
  cephe: "hataCepheRuzgar",
  centroid: "hataRuzgar",
};
/** @param {"bas"|"cephe"|"centroid"} olcut */
function ozet(baslik, xs0, olcut = "bas") {
  const alan = ALAN[olcut];
  const alanR = ALAN_R[olcut];
  const xs = xs0.filter((o) => o[alan] !== null);
  const hb = xs.map((o) => o[alan]);
  const hr = xs.map((o) => o[alanR]);
  const kaps = xs.filter((o) => o.kapsandi !== null);
  const yeniT = xs.reduce((a, o) => a + o.yeniPiksel, 0);
  const yeniI = xs.reduce((a, o) => a + o.yeniIcinde, 0);
  console.log(
    `${baslik.padEnd(24)} n=${String(say(xs)).padStart(4)}  ` +
      `ort ${f1(ort(hb)).padStart(5)}°  ortanca ${f1(med(hb)).padStart(5)}°  ` +
      `≤45° ${yuzde(hb.filter((h) => h <= 45).length, hb.length).padStart(4)}  ` +
      `≤90° ${yuzde(hb.filter((h) => h <= 90).length, hb.length).padStart(4)}  ` +
      `baş kapsandı ${yuzde(kaps.filter((o) => o.kapsandi).length, kaps.length).padStart(4)}  ` +
      `yeni piksel kapsandı ${yuzde(yeniI, yeniT).padStart(4)}  ` +
      `[rüzgâr-tek ${f1(ort(hr))}°]`
  );
}

console.log("");
console.log("═══ YÖN TAHMİNİ DOĞRULAMASI ═══");
console.log("Tahmin = geçiş anındaki ERA5 rüzgârı (+eğim, Rothermel bileşkesi).");
console.log("Gerçek  = öncü kenardan, BİR ÖNCEKİ geçişte yanmamış en uzak yeni piksele olan yön.");
console.log("Rastgele tahminde beklenen hata 90°, ≤45° oranı %25, ≤90° oranı %50.\n");

ozet("TÜMÜ", olcumler);
console.log("");
for (const k of [...new Set(olcumler.map((o) => o.kayit))])
  ozet("  " + k, olcumler.filter((o) => o.kayit === k));

console.log("");
const bantlar = [
  ["rüzgâr <10 km/sa", (o) => o.windKmh < 10],
  ["rüzgâr 10–20", (o) => o.windKmh >= 10 && o.windKmh < 20],
  ["rüzgâr ≥20", (o) => o.windKmh >= 20],
];
for (const [ad, f] of bantlar) ozet("  " + ad, olcumler.filter(f));

console.log("");
const dik = olcumler.filter((o) => (o.slopePct ?? 0) >= 15);
const duz = olcumler.filter((o) => (o.slopePct ?? 0) < 15);
ozet("  eğim ≥%15", dik);
ozet("  eğim <%15", duz);

console.log("");
console.log("── Yangının o anki genişliğine göre (koni tek noktaya çapalı) ──");
ozet("  çap <5 km", olcumler.filter((o) => o.capKm < 5));
ozet("  çap 5–15 km", olcumler.filter((o) => o.capKm >= 5 && o.capKm < 15));
ozet("  çap ≥15 km", olcumler.filter((o) => o.capKm >= 15));

console.log("");
console.log("── Boşluk süresine göre (koni en fazla 6 saat çiziyor) ──");
ozet("  boşluk ≤6 sa", olcumler.filter((o) => o.saat <= 6));
ozet("  boşluk >6 sa", olcumler.filter((o) => o.saat > 6));

console.log("");
console.log("── Aynı veri, farklı 'gerçek' tanımı ──");
ozet("baş piksel", olcumler, "bas");
ozet("cephe ortalaması", olcumler, "cephe");
ozet("centroid kayması", olcumler, "centroid");
console.log("  (centroid = uygulamanın 'sürüklenme' rozetiyle aynı ölçüt)");

const buyumeler = olcumler
  .map((o) => o.basKm / o.saat)
  .filter((x) => Number.isFinite(x))
  .sort((a, b) => a - b);
console.log("");
console.log(
  `Ayak izinden taşma hızı: ortanca ${f1(med(buyumeler))} km/sa · ` +
    `%90 dilim ${f1(buyumeler[Math.floor(buyumeler.length * 0.9)])} km/sa`
);

const hizlar = olcumler.map((o) => o.kmh).sort((a, b) => a - b);
console.log("");
console.log(
  `İlerleme hızı (gözlenen): ortanca ${f1(med(hizlar))} km/sa · ` +
    `%90 dilim ${f1(hizlar[Math.floor(hizlar.length * 0.9)])} km/sa · ` +
    `en yüksek ${f1(hizlar[hizlar.length - 1])} km/sa`
);

writeFileSync(
  join(process.cwd(), "scratchpad", "ara", "yon-dogrulama.json"),
  JSON.stringify(olcumler, null, 1)
);
console.log(`\n${olcumler.length} ölçüm → scratchpad/ara/yon-dogrulama.json`);
