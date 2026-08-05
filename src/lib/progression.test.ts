import test from "node:test";
import assert from "node:assert/strict";
import { progression, angleGap, pointInRing, NEW_KM, makulIlerlemeKm } from "./progression.ts";

/** ~1 km ≈ 0,009° enlem; boylam 39°'de ~0,0116° */
const kmLat = (km: number) => km / 111;
const kmLon = (km: number, lat = 39) => km / (111 * Math.cos((lat * Math.PI) / 180));

test("ayak izinin içinde kalan pikseller ilerleme sayılmaz", () => {
  const prev = [{ lon: 30, lat: 39 }];
  const next = [{ lon: 30, lat: 39 + kmLat(0.5) }];
  const r = progression(prev, next);
  assert.equal(r.newPixels, 0);
  assert.equal(r.headBearingDeg, null);
});

test("kuzeye taşan piksel 0° yön verir", () => {
  const prev = [{ lon: 30, lat: 39 }];
  const next = [{ lon: 30, lat: 39 + kmLat(3) }];
  const r = progression(prev, next);
  assert.equal(r.newPixels, 1);
  assert.ok(angleGap(r.headBearingDeg!, 0) < 1);
  assert.ok(Math.abs(r.headGrowthKm! - 3) < 0.1);
});

test("yön en yakın yanmış piksele göre ölçülür, olayın ucuna göre değil", () => {
  // 20 km'lik bir yangın: batı ucu ve doğu ucu. Doğu ucunun 3 km doğusunda
  // yeni piksel. Batı ucundan bakılırsa yön ~90° ama uzaklık 23 km çıkar ve
  // "yangın 23 km ilerledi" denirdi; doğrusu en yakın kenardan 3 km.
  const prev = [
    { lon: 30, lat: 39 },
    { lon: 30 + kmLon(20), lat: 39 },
  ];
  const next = [{ lon: 30 + kmLon(23), lat: 39 }];
  const r = progression(prev, next);
  assert.ok(Math.abs(r.headGrowthKm! - 3) < 0.2);
  assert.ok(angleGap(r.headBearingDeg!, 90) < 2);
});

test("cephe ortalaması 359°/1° sarmalını doğru çözer", () => {
  const prev = [{ lon: 30, lat: 39 }];
  const next = [
    { lon: 30 + kmLon(0.1), lat: 39 + kmLat(3) }, // ~2° kuzey
    { lon: 30 - kmLon(0.1), lat: 39 + kmLat(3) }, // ~358° kuzey
  ];
  const r = progression(prev, next);
  // Aritmetik ortalama 180° (tam ters) verirdi
  assert.ok(angleGap(r.frontBearingDeg!, 0) < 5);
});

test("centroid kayması eşiğin altındaysa yön iddiası yok", () => {
  const prev = [{ lon: 30, lat: 39 }];
  const next = [{ lon: 30, lat: 39 + kmLat(1) }];
  const r = progression(prev, next);
  assert.equal(r.centroidBearingDeg, null);
  assert.ok(r.centroidKm > 0.9 && r.centroidKm < 1.1);
});

test("boş geçiş ilerleme üretmez", () => {
  assert.equal(progression([], [{ lon: 30, lat: 39 }]).newPixels, 0);
  assert.equal(progression([{ lon: 30, lat: 39 }], []).newPixels, 0);
});

test("eşik ayarlanabilir", () => {
  const prev = [{ lon: 30, lat: 39 }];
  const next = [{ lon: 30, lat: 39 + kmLat(1) }];
  assert.equal(progression(prev, next).newPixels, 0);
  assert.equal(progression(prev, next, 0.5).newPixels, 1);
  assert.equal(NEW_KM, 1.5);
});

test("angleGap en kısa yayı verir", () => {
  assert.equal(angleGap(10, 350), 20);
  assert.equal(angleGap(0, 180), 180);
  assert.equal(angleGap(270, 90), 180);
});

test("pointInRing kare içi/dışı", () => {
  const ring: [number, number][] = [
    [30, 39],
    [31, 39],
    [31, 40],
    [30, 40],
    [30, 39],
  ];
  assert.equal(pointInRing({ lon: 30.5, lat: 39.5 }, ring), true);
  assert.equal(pointInRing({ lon: 29.5, lat: 39.5 }, ring), false);
  assert.equal(pointInRing({ lon: 30.5, lat: 41 }, ring), false);
});

/* ── Makul ilerleme tavanı (2026-08-05 canlı karne hatası) ──
 * Doğrulama hattı tespitleri kimlikle değil yarıçapla topluyor; aynı yarıçapa
 * düşen AYRI bir yangın "baş" sayılabiliyordu. Canlıda tam bu oldu: tek olayın
 * 7 tahmininde de gözlenen ilerleme birebir 7,92 km yazıldı, oysa geçen süre
 * 0,7–5,6 saat arasındaydı (0,7 saatte 7,92 km = 11,3 km/sa; korpustaki 2.383
 * vakanın maksimumu 7,44). */
test("makulIlerlemeKm süreyle ölçeklenir, tabanı NEW_KM", () => {
  assert.equal(makulIlerlemeKm(0), NEW_KM, "sıfır saatte taban");
  assert.equal(makulIlerlemeKm(-5), NEW_KM, "negatif süre tabanı bozmamalı");
  assert.equal(makulIlerlemeKm(0.1), NEW_KM, "çok kısa pencerede taban geçerli");
  assert.equal(makulIlerlemeKm(4), 5, "4 saat × 1,25 km/sa");
  assert.ok(makulIlerlemeKm(5.6) > makulIlerlemeKm(0.7), "süreyle artmalı");
});

test("fiziksel olarak imkânsız sıçrama 'ilerleme' sayılmaz", () => {
  const prev = [{ lon: 30, lat: 39 }];
  // 8 km ötede tek piksel — canlıdaki 7,92 km'lik hayalet
  const next = [{ lon: 30, lat: 39 + kmLat(8) }];

  // 0,7 saatlik pencere: tavan max(1,5, 2,1) = 2,1 km → REDDEDİLMELİ
  const kisa = progression(prev, next, NEW_KM, makulIlerlemeKm(0.7));
  assert.equal(kisa.head, null, "0,7 saatte 8 km baş sayılmamalı");
  assert.equal(kisa.newPixels, 0);
  assert.equal(kisa.headBearingDeg, null, "yön hatası da üretilmemeli");

  // Tavan verilmezse eski davranış korunur (ölçüm betikleri buna dayanıyor)
  const tavansiz = progression(prev, next);
  assert.ok(tavansiz.head !== null, "tavansız çağrı eski davranışta kalmalı");
});

test("makul hızdaki gerçek ilerleme kırpılmaz", () => {
  const prev = [{ lon: 30, lat: 39 }];
  // 6 saatte 4 km = 0,67 km/sa — korpusun %90'ının üstünde, tavanın altında
  const next = [{ lon: 30, lat: 39 + kmLat(4) }];
  const r = progression(prev, next, NEW_KM, makulIlerlemeKm(6));
  assert.ok(r.head !== null, "0,67 km/sa gerçek yayılım, kırpılmamalı");
  assert.ok(Math.abs(r.headGrowthKm! - 4) < 0.1);
});
