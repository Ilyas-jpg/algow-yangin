import test from "node:test";
import assert from "node:assert/strict";
import { progression, angleGap, pointInRing, NEW_KM } from "./progression.ts";

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
