/**
 * Yön ve erişim zincirinin regresyon testleri.
 *
 * Neden var: koninin yönü ve boyutu artık birkaç katmanlı bir hesap
 * (rüzgâr u/v → gittiği yön → Rothermel rüzgâr/eğim bileşkesi → saatlik
 * ortalama → ölçülmüş erişim şekli). Buradaki bir İŞARET hatası ekranda
 * hiçbir şeyi kırmaz; koni sessizce ters yöne bakar ve kimse fark etmez.
 * Kamuya açık bir güvenlik aracında en tehlikeli hata sınıfı bu.
 *
 * Çalıştırma: npm test   (Node 24 TypeScript'i yerel çalıştırır, ek paket yok)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  uvToSpeedDir,
  rothermelSpread,
  headSpreadKmh,
  coneHalfAngle,
  reachRatio,
  buildCone,
  DISC_THRESHOLD_DEG,
} from "./wind.ts";
import { reachShape, havKm, bearingDeg } from "./geo.ts";
import type { FireEvent, WindGrid } from "./types.ts";

const yakin = (a: number, b: number, tol: number, mesaj: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${mesaj}: ${a} ≉ ${b} (±${tol})`);
/** iki bearing arasındaki en kısa fark */
const acilar = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

/* ══ 1. u/v → rüzgârın GELDİĞİ yön ══
   En kritik işaret noktası. u=doğuya, v=kuzeye bileşen.
   Kuzeye ESEN rüzgâr (v>0) meteorolojik olarak GÜNEY'den gelir (180°). */
test("uvToSpeedDir: kuzeye esen rüzgâr güneyden gelir", () => {
  const r = uvToSpeedDir(0, 5);
  yakin(r.fromDeg, 180, 0.01, "kuzeye esen → geldiği yön güney");
  yakin(r.kmh, 18, 0.01, "5 m/s = 18 km/sa");
});
test("uvToSpeedDir: doğuya esen rüzgâr batıdan gelir", () => {
  yakin(uvToSpeedDir(5, 0).fromDeg, 270, 0.01, "doğuya esen → batıdan");
});
test("uvToSpeedDir: güneye esen rüzgâr kuzeyden gelir", () => {
  yakin(uvToSpeedDir(0, -5).fromDeg, 0, 0.01, "güneye esen → kuzeyden");
});

/* ══ 2. Rothermel bileşkesi ══ */
test("düz arazide yön saf rüzgâr yönüdür", () => {
  const r = rothermelSpread(20, 90, 0, 0);
  yakin(r.spreadDeg, 90, 0.01, "eğim yoksa rüzgâr yönü");
  assert.equal(r.slopeShare, 0, "düzde eğim payı sıfır");
});
test("eğim terimi tan²(eğim) ile büyür: düzde ihmal, dikte belirgin", () => {
  const duz = rothermelSpread(20, 90, 2, 0).slopeShare;
  const dik = rothermelSpread(20, 90, 40, 0).slopeShare;
  assert.ok(duz < 0.02, `düzde eğim payı ihmal edilebilir olmalı, ${duz}`);
  assert.ok(dik > duz * 5, `dik arazide eğim payı belirgin artmalı (${duz} → ${dik})`);
});
test("bileşke yön, rüzgâr ile yokuş arasında kalır", () => {
  // rüzgâr doğuya (90°), yokuş kuzeye (0°) → bileşke 0–90 arası
  const r = rothermelSpread(15, 90, 35, 0);
  assert.ok(
    r.spreadDeg > 0 && r.spreadDeg < 90,
    `bileşke iki yön arasında olmalı, ${r.spreadDeg}`
  );
});
test("eğim büyüdükçe yön yokuşa doğru kayar", () => {
  const az = rothermelSpread(15, 90, 10, 0).spreadDeg;
  const cok = rothermelSpread(15, 90, 45, 0).spreadDeg;
  assert.ok(cok < az, `daha dik yamaç yönü yokuşa (0°) yaklaştırmalı: ${az} → ${cok}`);
});
test("rüzgâr güçlendikçe yön rüzgâra doğru kayar", () => {
  const zayif = rothermelSpread(5, 90, 30, 0).spreadDeg;
  const guclu = rothermelSpread(45, 90, 30, 0).spreadDeg;
  assert.ok(guclu > zayif, `güçlü rüzgâr yönü rüzgâra (90°) yaklaştırmalı: ${zayif} → ${guclu}`);
});

/* ══ 3. Ölçülmüş çapa fonksiyonları ══ */
test("ilerleme hızı rüzgârla monoton artar", () => {
  let onceki = -1;
  for (const w of [0, 5, 10, 15, 20, 30, 45, 80]) {
    const v = headSpreadKmh(w);
    assert.ok(v >= onceki, `hız monoton artmalı (w=${w}: ${v} < ${onceki})`);
    onceki = v;
  }
});
test("ilerleme hızı kalibre edilmiş aralıkta kalır", () => {
  // Sezon-dışı doğrulanmış çapalar: 4 km/sa → 0,39 · 26 km/sa → 1,24
  yakin(headSpreadKmh(4), 0.39, 0.01, "zayıf rüzgâr çapası");
  yakin(headSpreadKmh(26), 1.24, 0.01, "güçlü rüzgâr çapası");
  assert.ok(headSpreadKmh(200) <= 1.95, "çapa dışına taşmamalı (clamp)");
});
test("koni yarım açısı rüzgârla daralır", () => {
  assert.ok(coneHalfAngle(4) > coneHalfAngle(18), "zayıf rüzgârda açı daha geniş");
  assert.ok(coneHalfAngle(4) >= DISC_THRESHOLD_DEG, "zayıf rüzgâr 'yön zayıf' eşiğini aşmalı");
  assert.ok(coneHalfAngle(18) < DISC_THRESHOLD_DEG, "güçlü rüzgârda yön anlamlı");
});

/* ══ 4. Erişim şekli (rüzgâra bağlı damla) ══ */
test("erişim oranı başta 1 ve her rüzgârda monoton azalır", () => {
  for (const kmh of [undefined, 0, 4, 8, 11, 15, 30]) {
    yakin(reachRatio(0, kmh), 1, 1e-9, `baş yönü referans (${kmh})`);
    let onceki = 2;
    for (let a = 0; a <= 180; a += 15) {
      const v = reachRatio(a, kmh);
      assert.ok(v <= onceki + 1e-9, `oran monoton azalmalı (${kmh} km/sa, ${a}°: ${v} > ${onceki})`);
      onceki = v;
    }
  }
});
test("erişim oranı yön işaretinden bağımsız (simetrik)", () => {
  yakin(reachRatio(-60, 20), reachRatio(60, 20), 1e-9, "sol ve sağ sapma eşit");
});

/**
 * ÖLÇÜLEN REJİM AYRIMI (2026-08-04, hücre bazında n=5.719):
 * zayıf rüzgârda yangın daireye yakın (baş/geri 1,19×), güçlüde damla (5,50×).
 * Bu test yönü kilitliyor — eski tek şekil (her rüzgârda 2,4×) bu ayrımı
 * yapmıyordu ve güçlü rüzgârda geriyi 2,5 kat fazla çiziyordu.
 */
test("zayıf rüzgârda şekil neredeyse daire, güçlüde belirgin damla", () => {
  const oran = (kmh: number) => reachRatio(0, kmh) / reachRatio(180, kmh);
  yakin(oran(4), 1.25, 0.1, "zayıf rüzgâr: ölçülen 1,19×");
  assert.ok(oran(30) > 5, `güçlü rüzgâr belirgin asimetri (ölçülen 5,5×), bulunan ${oran(30).toFixed(1)}`);
  assert.ok(oran(11) > oran(4) && oran(11) < oran(30), "arada geçiş monoton");
});
test("rüzgâr verilmezse zayıf (yuvarlak) profile düşer — yön iddiası zayıf taraf", () => {
  yakin(reachRatio(180), reachRatio(180, 0), 1e-9, "rüzgârsız ile bilinmeyen aynı profil");
  assert.ok(reachRatio(180) > reachRatio(180, 30), "bilinmeyen rüzgâr, güçlüden daha yuvarlak");
});
test("şekil kapalıdır ve baş yönü verilen bearing'e oturur", () => {
  const ring = reachShape(30, 39, 90, 10, (o) => reachRatio(o, 20), 72);
  assert.deepEqual(ring[0], ring[ring.length - 1], "poligon kapalı olmalı");
  const bas = havKm(30, 39, ring[0][0], ring[0][1]);
  const geri = havKm(30, 39, ring[36][0], ring[36][1]);
  assert.ok(bas / geri > 4, "20 km/sa'te belirgin damla");
  yakin(bearingDeg(30, 39, ring[0][0], ring[0][1]), 90, 1, "başın yönü verilen bearing");
});

/* ══ 5. Uçtan uca koni ══ */
function sahteOlay(): FireEvent {
  const t = Date.now();
  return {
    id: "e1",
    lon: 30,
    lat: 39,
    place: "test",
    il: "Eskişehir",
    fixedSource: null,
    abroad: false,
    firstSeen: t - 3600_000,
    lastSeen: t,
    count: 1,
    frpLast: 50,
    frpMax: 50,
    passes: [{ t, t0: t, lon: 30, lat: 39, frp: 50, count: 1 }],
    drift: null,
    lastPassPoints: [{ lon: 30, lat: 39 }],
    lowConfidence: false,
    saturated: false,
    status: "active",
  };
}
/** her yerde aynı rüzgârı veren düz grid */
function sahteGrid(u: number, v: number): WindGrid {
  const nx = 4, ny = 4;
  return {
    lon0: 28, lat0: 37, dLon: 2, dLat: 2, nx, ny,
    u: new Array(nx * ny).fill(u), v: new Array(nx * ny).fill(v),
    failedChunks: 0,
  } as unknown as WindGrid;
}

test("buildCone: halkalar saat arttıkça büyür ve şekil yönlüdür", () => {
  const cone = buildCone(sahteOlay(), sahteGrid(6, 0), { slopePct: 0, upslopeDeg: 0 });
  assert.ok(cone, "koni üretilmeli");
  const yaricap = cone!.rings.map((r) =>
    Math.max(...r.ring.map((p) => havKm(cone!.apex[0], cone!.apex[1], p[0], p[1])))
  );
  assert.ok(yaricap[0] < yaricap[1] && yaricap[1] < yaricap[2], `halkalar büyümeli: ${yaricap}`);
  // u=6, v=0 → doğuya esiyor → yayılma yönü doğu (90°)
  yakin(cone!.spreadDeg, 90, 1, "düz arazide yayılma rüzgârın gittiği yön");
});

test("buildCone: durgun rüzgârda koni çizilmez", () => {
  assert.equal(buildCone(sahteOlay(), sahteGrid(0.2, 0), null), null, "durgunda yön anlamsız");
});

test("buildCone: dik yamaç koniyi yokuş yukarı çeker", () => {
  const duz = buildCone(sahteOlay(), sahteGrid(4, 0), { slopePct: 0, upslopeDeg: 0 })!;
  const dik = buildCone(sahteOlay(), sahteGrid(4, 0), { slopePct: 40, upslopeDeg: 0 })!;
  assert.ok(
    acilar(dik.spreadDeg, 0) < acilar(duz.spreadDeg, 0),
    `dik yamaçta yön kuzeye (yokuş) yaklaşmalı: ${duz.spreadDeg} → ${dik.spreadDeg}`
  );
  assert.ok(dik.slopeShare > 0.1, "eğim payı raporlanmalı");
});

test("buildCone: tahmin rüzgârı halkaları kendi saatinin yönüne büker", () => {
  // rüzgâr saatler içinde doğudan kuzeye dönüyor (geldiği yön 270 → 180)
  const cone = buildCone(
    sahteOlay(),
    sahteGrid(4, 0),
    { slopePct: 0, upslopeDeg: 0 },
    { kmh: [15, 15, 15, 15, 15, 15], fromDeg: [270, 260, 240, 220, 200, 180] }
  )!;
  assert.ok(cone.driftDeg > 20, `yön kayması raporlanmalı, ${cone.driftDeg}`);
});
