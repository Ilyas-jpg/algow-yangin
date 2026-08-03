import test from "node:test";
import assert from "node:assert/strict";
import {
  GRID_LAT0,
  GRID_LON0,
  GRID_NX,
  GRID_NY,
  GRID_STEP,
  REGION,
  REGION_BBOX,
  SMOKE_NX,
  SMOKE_NY,
  inRegion,
} from "./bbox.ts";

test("REGION_BBOX FIRMS'in beklediği sırada", () => {
  // west,south,east,north — sıra karışırsa FIRMS sessizce boş döner
  assert.equal(REGION_BBOX, "19.2,34.4,45.5,42.6");
});

test("kutu Yunanistan'ın batısını ve Girit'in güneyini içeriyor", () => {
  assert.ok(inRegion(19.92, 39.62), "Korfu");
  assert.ok(inRegion(21.73, 38.25), "Patras");
  assert.ok(inRegion(22.11, 37.04), "Kalamata");
  assert.ok(inRegion(24.02, 35.51), "Hanya");
  assert.ok(inRegion(24.08, 34.83), "Gavdos — Yunanistan'ın en güneyi");
});

test("kutu Türkiye'yi ve eski kapsamı korumaya devam ediyor", () => {
  assert.ok(inRegion(28.15, 37.62), "Çine");
  assert.ok(inRegion(44.5, 39.9), "Iğdır");
  assert.ok(inRegion(33.02, 34.71), "Limasol");
  assert.ok(!inRegion(18.5, 40.1), "Otranto/İtalya — kutunun dışında");
  assert.ok(!inRegion(46.2, 38.0), "Tebriz — kutunun dışında");
});

test("her ızgara Open-Meteo'nun dakikalık lokasyon tavanına sığıyor", () => {
  // 3 Ağustos 2026'da canlıda ölçüldü: limit istek SAYISINA değil sorulan
  // LOKASYON sayısına bakıyor ve tavan ~600. Kutu batıya genişleyince 0,5°
  // rüzgâr ızgarası 1.026 hücreye çıktı ve 11 parçanın 5'i 429 yedi.
  // Eksik hücre "kaba rüzgâr" değil HİÇ rüzgâr demek: sampleUV null döner,
  // o yangına koni çizilmez. Bu testin işi o regresyonu bir daha yaşatmamak.
  const TAVAN = 600;
  assert.ok(
    GRID_NX * GRID_NY <= TAVAN,
    `rüzgâr ızgarası ${GRID_NX}x${GRID_NY}=${GRID_NX * GRID_NY} > ${TAVAN}`
  );
  assert.ok(
    SMOKE_NX * SMOKE_NY <= TAVAN,
    `duman ızgarası ${SMOKE_NX}x${SMOKE_NY}=${SMOKE_NX * SMOKE_NY} > ${TAVAN}`
  );
});

test("meteorolojik ızgara kutuyu TAMAMEN kapsıyor", () => {
  // Kenarda kalan hücre dört komşusunu bulamaz ve yangın rüzgârsız kalır
  // (Güney Kıbrıs vakası). Izgara her yönde en az bir adım dışarı taşmalı.
  const lonMax = GRID_LON0 + (GRID_NX - 1) * GRID_STEP;
  const latMax = GRID_LAT0 + (GRID_NY - 1) * GRID_STEP;
  assert.ok(GRID_LON0 <= REGION.west, `grid batısı ${GRID_LON0}`);
  assert.ok(GRID_LAT0 <= REGION.south, `grid güneyi ${GRID_LAT0}`);
  assert.ok(lonMax >= REGION.east, `grid doğusu ${lonMax}`);
  assert.ok(latMax >= REGION.north, `grid kuzeyi ${latMax}`);
});
