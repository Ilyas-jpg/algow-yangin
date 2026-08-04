import test from "node:test";
import assert from "node:assert/strict";
import { footprintFC, footprintRing } from "./pixel-footprint.ts";

const KUTU = { west: 26, south: 36, east: 30, north: 40 };

const nokta = (lon: number, lat: number, sc?: number, tk?: number) => ({
  geometry: { coordinates: [lon, lat] as [number, number] },
  properties: sc === undefined ? {} : { sc, tk },
});

test("elips kapalı ve tarama yönünde daha geniş", () => {
  // VIIRS tarama kenarı: scan 0,8 km, track 0,4 km → doğu-batı basık değil,
  // GENİŞ olmalı. Eksenleri ters bağlamak pikseli 90° döndürürdü.
  const halka = footprintRing(28, 38, 0.8, 0.4);
  assert.deepEqual(halka[0], halka[halka.length - 1], "halka kapanmamış");

  const lons = halka.map((p) => p[0]);
  const lats = halka.map((p) => p[1]);
  const enKm = (Math.max(...lons) - Math.min(...lons)) * 111.32 * Math.cos((38 * Math.PI) / 180);
  const boyKm = (Math.max(...lats) - Math.min(...lats)) * 110.57;

  assert.ok(Math.abs(enKm - 0.8) < 0.05, `tarama ekseni ${enKm.toFixed(3)} km`);
  assert.ok(Math.abs(boyKm - 0.4) < 0.05, `iz ekseni ${boyKm.toFixed(3)} km`);
});

test("nadir pikseli enlemden bağımsız ~375 m kalıyor", () => {
  // Boylam derecesi kuzeye gidince kısalıyor; cos düzeltmesi olmasaydı
  // aynı piksel Trabzon'da İzmir'dekinden dar çizilirdi.
  for (const lat of [36, 42]) {
    const halka = footprintRing(28, lat, 0.375, 0.375);
    const lons = halka.map((p) => p[0]);
    const enKm =
      (Math.max(...lons) - Math.min(...lons)) * 111.32 * Math.cos((lat * Math.PI) / 180);
    assert.ok(Math.abs(enKm - 0.375) < 0.02, `${lat}° enlemde ${enKm.toFixed(3)} km`);
  }
});

test("kare dışındaki nokta üretilmiyor", () => {
  const fc = footprintFC(
    [nokta(28, 38, 0.4, 0.4), nokta(44, 38, 0.4, 0.4)],
    KUTU
  );
  assert.equal(fc.features.length, 1);
});

test("ölçüsü olmayan nokta için ayak izi UYDURULMUYOR", () => {
  // Meteosat ve eski arşiv kayıtlarında scan/track yok. Varsayılan bir
  // boy atamak, bilmediğimiz bir belirsizliği biliyormuş gibi çizmek olurdu.
  const fc = footprintFC([nokta(28, 38)], KUTU);
  assert.equal(fc.features.length, 0);
});

test("çıktı geçerli Polygon FeatureCollection", () => {
  const fc = footprintFC([nokta(28, 38, 0.39, 0.6)], KUTU);
  assert.equal(fc.type, "FeatureCollection");
  assert.equal(fc.features[0].geometry.type, "Polygon");
  assert.equal(fc.features[0].geometry.coordinates.length, 1);
  assert.ok(fc.features[0].geometry.coordinates[0].length > 8);
});
