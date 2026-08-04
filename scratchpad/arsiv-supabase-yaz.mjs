/**
 * Arşivi Supabase'e taşır — yön/ilerleme modelinin eğitim seti.
 *
 * NE YAZAR (her arşiv kaydı için):
 *   fire_event      — olay, arazi (eğim/yokuş-yukarı/yükselti) ve yakıt
 *   fire_pass       — her uydu geçişi + O ANIN havası (rüzgâr, hamle,
 *                     sıcaklık, nem, BASINÇ, yağış, FWI kodları)
 *                     + ETİKET: bir sonraki geçişte nereye ne kadar taştı
 *   fire_detection  — ham piksel; etiket tanımı değişirse geometri yeniden
 *                     türetilebilsin diye
 *
 * Hava ERA5 yeniden-analizinden (Open-Meteo archive, anahtarsız) geliyor:
 * yeniden üretilebilir veri, o yüzden uydu tespitinin aksine sonradan
 * doldurmakta sakınca yok. `weather_source='era5'` ile işaretleniyor —
 * canlı tahmin verisiyle karıştırılırsa model geçmişi bilen bir rüzgârla
 * eğitilip sahada tahmin rüzgârıyla çalışır ve sızıntı olur.
 *
 * Kullanım:
 *   node --import ./test/register.mjs scratchpad/arsiv-supabase-yaz.mjs [--kuru]
 *   --kuru : hiçbir şey yazma, ne yazacağını göster
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { clusterEvents } from "../src/lib/cluster.ts";
import { havKm, toRad } from "../src/lib/geo.ts";
import { expandArchive } from "../src/lib/archive.ts";
import { progression } from "../src/lib/progression.ts";
import { runFwiSeries } from "../src/lib/fwi.ts";
import { corineAt } from "../src/lib/corine.ts";

const KURU = process.argv.includes("--kuru");
const KOK = process.cwd();
const ARSIV = join(KOK, "public", "arsiv");

// ── Supabase ─────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(join(KOK, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY yok (.env.local)");
  process.exit(1);
}
const REF = JSON.parse(Buffer.from(KEY.split(".")[1], "base64url").toString()).ref;
const URL_ = `https://${REF}.supabase.co/rest/v1`;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function db(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${URL_}/${path}`, {
    method,
    headers: prefer ? { ...H, Prefer: prefer } : H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  if (!res.ok) {
    const e = new Error(`${res.status} ${txt.slice(0, 300)}`);
    e.status = res.status;
    throw e;
  }
  return txt ? JSON.parse(txt) : null;
}

// ── Open-Meteo ───────────────────────────────────────────────────────────
async function json(url, deneme = 3) {
  for (let i = 0; i < deneme; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      // 429 = kota; beklemek işe yarar, 400 = yanlış istek, yaramaz
      if (r.status !== 429 && r.status < 500) return null;
    } catch {
      /* ağ — tekrar dene */
    }
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  return null;
}

const gunISO = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Olayın tüm ömrünü kapsayan saatlik ERA5 — olay başına tek istek. */
async function saatlikSeri(lat, lon, bas, son) {
  const d = await json(
    "https://archive-api.open-meteo.com/v1/archive" +
      `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&start_date=${gunISO(bas - 86400_000)}&end_date=${gunISO(son + 86400_000)}` +
      "&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m," +
      "relative_humidity_2m,surface_pressure,precipitation,vapour_pressure_deficit" +
      "&wind_speed_unit=kmh&timezone=UTC"
  );
  if (!d?.hourly?.time) return null;
  const idx = new Map(d.hourly.time.map((t, i) => [t.slice(0, 13), i]));
  return (tMs) => {
    const k = new Date(Math.round(tMs / 3600_000) * 3600_000).toISOString().slice(0, 13);
    const i = idx.get(k);
    if (i === undefined) return null;
    const h = d.hourly;
    return {
      wind_kmh: h.wind_speed_10m[i],
      wind_from_deg: h.wind_direction_10m[i],
      gust_kmh: h.wind_gusts_10m[i],
      temp_c: h.temperature_2m[i],
      humidity: h.relative_humidity_2m[i],
      pressure_hpa: h.surface_pressure[i],
      precip_mm: h.precipitation[i],
      vpd_kpa: h.vapour_pressure_deficit?.[i] ?? null,
    };
  };
}

/**
 * FWI kodları: yakıtın ne kadar kuru olduğunu tek bir sayı değil, biriken
 * bir seri belirler. DC (derin kuruluk) haftalar sürer — o yüzden olaydan
 * 30 gün öncesinden başlayan günlük seri çekiliyor ve her gün için kodlar
 * ilerletiliyor.
 */
async function fwiTakvimi(lat, lon, bas, son) {
  const d = await json(
    "https://archive-api.open-meteo.com/v1/archive" +
      `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&start_date=${gunISO(bas - 30 * 86400_000)}&end_date=${gunISO(son + 86400_000)}` +
      "&daily=temperature_2m_max,relative_humidity_2m_min,wind_speed_10m_max,precipitation_sum" +
      "&wind_speed_unit=kmh&timezone=UTC"
  );
  if (!d?.daily?.time) return () => null;
  const gunler = d.daily.time.map((t, i) => ({
    gun: t,
    t: d.daily.temperature_2m_max[i],
    rh: d.daily.relative_humidity_2m_min[i],
    wind: d.daily.wind_speed_10m_max[i],
    rain: d.daily.precipitation_sum[i],
    // ⚠️ 0-TABANLI. fwi.ts'in DAY_LENGTH tabloları 12 elemanlı dizi (0=Ocak) ve
    // üretimdeki /api/wind/point `getUTCMonth()` veriyor. 1-12 geçirmek gündüz
    // uzunluğu düzeltmesini bir ay kaydırır, Aralık'ta diziden taşıp NaN üretir.
    month: +t.slice(5, 7) - 1,
  }));
  const kod = new Map();
  for (let i = 0; i < gunler.length; i++) {
    const seri = gunler
      .slice(0, i + 1)
      .filter((g) => [g.t, g.rh, g.wind, g.rain].every((x) => typeof x === "number"));
    kod.set(gunler[i].gun, seri.length ? runFwiSeries(seri) : null);
  }
  return (tMs) => kod.get(gunISO(tMs)) ?? null;
}

/** Eğim + yokuş-yukarı yön + yükselti (1 km tabanlı merkezi fark) */
async function arazi(lat, lon) {
  const dLat = 1 / 111;
  const dLon = 1 / (111 * Math.cos(toRad(lat)));
  const lats = [lat, lat + dLat, lat - dLat, lat, lat];
  const lons = [lon, lon, lon, lon + dLon, lon - dLon];
  const d = await json(
    "https://api.open-meteo.com/v1/elevation" +
      `?latitude=${lats.map((x) => x.toFixed(4)).join(",")}` +
      `&longitude=${lons.map((x) => x.toFixed(4)).join(",")}`
  );
  const e = d?.elevation;
  if (!Array.isArray(e) || e.length !== 5) return null;
  const dzdy = (e[1] - e[2]) / 2000;
  const dzdx = (e[3] - e[4]) / 2000;
  return {
    elev_m: e[0],
    slope_pct: Math.round(Math.hypot(dzdx, dzdy) * 10000) / 100,
    upslope_deg: Math.round((((Math.atan2(dzdx, dzdy) * 180) / Math.PI + 360) % 360) * 10) / 10,
  };
}

// ── Tabloların varlığını erken kontrol et ────────────────────────────────
if (!KURU) {
  try {
    await db("fire_event?select=id&limit=1");
  } catch (e) {
    if (e.status === 404 || /does not exist|schema cache/i.test(e.message)) {
      console.error(
        "\n⚠️  Tablolar yok. Önce supabase/migrations/0004_fire_archive.sql'i\n" +
          "   Supabase panelinde SQL Editor'e yapıştırıp çalıştır.\n" +
          `   Panel: https://supabase.com/dashboard/project/${REF}/sql/new\n`
      );
      process.exit(2);
    }
    throw e;
  }
}

// ── Ana akış ─────────────────────────────────────────────────────────────
const PASS_GAP = 90 * 60_000;

/**
 * ⚠️ Her geçiş satırı AYNI anahtar kümesiyle gitmeli. PostgREST toplu
 * insert'te kolon listesini ilk nesneden çıkarıyor ve farklı anahtarlı
 * ikinci nesneye "All object keys must match" diye 400 dönüyor. Son geçişin
 * etiketi olmadığı (ardılı yok) için satırlar doğal olarak heterojen.
 */
const BOS_GECIS = Object.fromEntries(
  [
    "wind_kmh", "wind_from_deg", "gust_kmh", "temp_c", "humidity", "vpd_kpa",
    "pressure_hpa", "precip_mm", "ffmc", "dmc", "dc", "isi", "bui", "fwi",
    "weather_source", "next_pass_at", "span_hours", "head_bearing_deg",
    "head_growth_km", "front_bearing_deg", "new_pixels", "centroid_bearing_deg",
    "centroid_km", "labeled_at",
  ].map((k) => [k, null])
);

const indeks = JSON.parse(readFileSync(join(ARSIV, "index.json"), "utf8"));
const dosyalar = readdirSync(ARSIV).filter((f) => f.endsWith(".json") && f !== "index.json");

let toplamGecis = 0;
let toplamEtiket = 0;

for (const dosya of dosyalar) {
  const slug = dosya.replace(".json", "");
  const a = JSON.parse(readFileSync(join(ARSIV, dosya), "utf8"));
  const meta = indeks.find((k) => k.slug === slug);
  const pts = expandArchive(a);
  const { events } = clusterEvents(pts);
  const ev = events.sort((x, y) => y.count - x.count)[0];
  if (!ev) {
    console.log(`${slug}: küme yok, atlandı`);
    continue;
  }

  // Geçiş → nokta eşlemesi (etiket ve ham kayıt için)
  const passPts = ev.passes.map((p) =>
    pts.filter((q) => Math.abs(q.dt - p.t) <= PASS_GAP)
  );

  const ar = await arazi(ev.lat, ev.lon);
  const fuel = await corineAt(ev.lon, ev.lat);
  const saatlik = await saatlikSeri(ev.lat, ev.lon, ev.firstSeen, ev.lastSeen);
  const fwiAl = await fwiTakvimi(ev.lat, ev.lon, ev.firstSeen, ev.lastSeen);

  const olay = {
    event_key: ev.id,
    origin: "archive",
    slug,
    name: meta?.ad ?? a.ad ?? slug,
    place: ev.place,
    il: ev.il,
    abroad: ev.abroad,
    lon: ev.lon,
    lat: ev.lat,
    first_seen: new Date(ev.firstSeen).toISOString(),
    last_seen: new Date(ev.lastSeen).toISOString(),
    detections: ev.count,
    frp_max: ev.frpMax,
    sats: a.sats ?? null,
    fuel,
    fixed_source_days: ev.fixedSource?.days ?? null,
    ...(ar ?? {}),
    updated_at: new Date().toISOString(),
  };

  // Geçiş satırları + etiketler
  const gecisler = [];
  for (let i = 0; i < ev.passes.length; i++) {
    const p = ev.passes[i];
    const hava = saatlik?.(p.t) ?? null;
    const fwi = fwiAl(p.t);
    const satir = {
      ...BOS_GECIS,
      pass_no: i,
      t: new Date(p.t).toISOString(),
      t0: new Date(p.t0).toISOString(),
      lon: p.lon,
      lat: p.lat,
      frp: p.frp,
      pixel_count: p.count,
      weather_source: hava ? "era5" : null,
      ...(hava ?? {}),
      ...(fwi ?? {}),
    };

    // ── ETİKET: bir sonraki geçişte nereye taştı ──
    const sonraki = ev.passes[i + 1];
    if (sonraki) {
      const saat = (sonraki.t - p.t) / 3600_000;
      const il = progression(passPts[i], passPts[i + 1]);
      // Boşluk 18 saati aşarsa arada bir geçiş kaçmış demektir; "tek adımda
      // şuraya gitti" etiketi yanıltıcı olur (uydu görmediği için değil,
      // yangın gerçekten iki farklı yöne gitmiş olabilir).
      if (saat <= 18 && il.newPixels > 0) {
        satir.next_pass_at = new Date(sonraki.t).toISOString();
        satir.span_hours = Math.round(saat * 100) / 100;
        satir.head_bearing_deg = il.headBearingDeg;
        satir.head_growth_km = Math.round(il.headGrowthKm * 100) / 100;
        satir.front_bearing_deg = il.frontBearingDeg;
        satir.new_pixels = il.newPixels;
        satir.centroid_bearing_deg = il.centroidBearingDeg;
        satir.centroid_km = Math.round(il.centroidKm * 100) / 100;
        satir.labeled_at = new Date().toISOString();
        toplamEtiket++;
      }
    }
    gecisler.push(satir);
    toplamGecis++;
  }

  const etiketli = gecisler.filter((g) => g.labeled_at).length;
  console.log(
    `${slug.padEnd(24)} ${String(ev.passes.length).padStart(3)} geçiş · ` +
      `${String(etiketli).padStart(3)} etiket · ${String(ev.count).padStart(5)} piksel · ` +
      `eğim %${ar ? ar.slope_pct.toFixed(0) : "?"} · yakıt ${fuel ?? "?"} · ` +
      `hava ${saatlik ? "ERA5" : "YOK"}`
  );

  if (KURU) continue;

  // ── Yazım ──
  const [kayit] = await db("fire_event?on_conflict=event_key", {
    method: "POST",
    body: [olay],
    prefer: "resolution=merge-duplicates,return=representation",
  });
  const eventId = kayit.id;

  await db("fire_pass?on_conflict=event_id,pass_no", {
    method: "POST",
    body: gecisler.map((g) => ({ ...g, event_id: eventId })),
    prefer: "resolution=merge-duplicates,return=minimal",
  });

  // Ham piksel: parça parça (Manavgat 9 bin satır)
  const ham = [];
  ev.passes.forEach((p, i) => {
    for (const q of passPts[i]) {
      ham.push({
        event_id: eventId,
        pass_no: i,
        dt: new Date(q.dt).toISOString(),
        lon: q.lon,
        lat: q.lat,
        frp: q.frp,
        sat: q.sat,
        dn: q.dn,
      });
    }
  });
  for (let i = 0; i < ham.length; i += 1000) {
    await db("fire_detection?on_conflict=event_id,dt,lon,lat", {
      method: "POST",
      body: ham.slice(i, i + 1000),
      prefer: "resolution=ignore-duplicates,return=minimal",
    });
  }
  console.log(`  ↳ yazıldı: olay #${eventId} · ${gecisler.length} geçiş · ${ham.length} piksel`);
}

console.log(
  `\nTOPLAM ${toplamGecis} geçiş · ${toplamEtiket} etiketli ilerleme` +
    (KURU ? "  (KURU ÇALIŞMA — hiçbir şey yazılmadı)" : "")
);
