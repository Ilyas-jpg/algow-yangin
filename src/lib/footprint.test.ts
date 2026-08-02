import test from "node:test";
import assert from "node:assert/strict";
import { heatFootprint } from "./footprint.ts";

const p = (lon: number, lat: number, sat = "N") => ({ lon, lat, sat });

test("tek piksel ≈ 14 ha", () => {
  const f = heatFootprint([p(30, 39)]);
  assert.equal(f?.cells, 1);
  assert.equal(f?.ha, 14);
});

test("aynı hücredeki tekrar tespitler bir kez sayılır", () => {
  // Aynı noktanın farklı geçişlerde tekrar görülmesi alanı büyütmemeli
  const f = heatFootprint([p(30, 39), p(30, 39), p(30.0001, 39.0001)]);
  assert.equal(f?.cells, 1);
});

test("ayrı hücreler toplanır", () => {
  // ~1 km kuzeyde: 375 m ızgarada kesinlikle başka hücre
  const f = heatFootprint([p(30, 39), p(30, 39.01)]);
  assert.equal(f?.cells, 2);
  assert.equal(f?.ha, 28);
});

test("MODIS tespitleri sayılmaz (1 km piksel alanı şişirir)", () => {
  assert.equal(heatFootprint([p(30, 39, "Aqua"), p(30, 39.05, "Terra")]), null);
});

test("MODIS varken yalnız VIIRS sayılır", () => {
  const f = heatFootprint([p(30, 39, "N"), p(30, 39.05, "Terra")]);
  assert.equal(f?.cells, 1);
});

test("boş girdi null döner", () => {
  assert.equal(heatFootprint([]), null);
});
