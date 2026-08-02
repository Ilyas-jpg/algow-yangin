import test from "node:test";
import assert from "node:assert/strict";
import { fixedSourceAt } from "./fixed-sources.ts";
import { FIXED_SOURCES } from "../data/fixed-sources.ts";

test("liste dolu ve kesin kayıtlar var", () => {
  assert.ok(FIXED_SOURCES.length >= 20);
  assert.ok(FIXED_SOURCES.some((s) => s[3] === 1));
});

test("bilinen sabit kaynağın üstü eşleşir", () => {
  const [lon, lat] = FIXED_SOURCES[0];
  const hit = fixedSourceAt(lon, lat);
  assert.ok(hit);
  assert.ok(hit.days >= 40);
});

test("2 km ötesi hâlâ eşleşir (hücre yuvarlaması payı)", () => {
  const [lon, lat] = FIXED_SOURCES[0];
  // ~2 km kuzey
  const hit = fixedSourceAt(lon, lat + 0.018);
  assert.ok(hit, "hücre payı içindeki nokta eşleşmeli");
});

test("uzaktaki nokta eşleşmez", () => {
  const [lon, lat] = FIXED_SOURCES[0];
  // ~22 km kuzey — başka bir yangın
  assert.equal(fixedSourceAt(lon, lat + 0.2), null);
});

test("kaynaksız bölge null döner", () => {
  // Tuz Gölü ortası — sanayi yok
  assert.equal(fixedSourceAt(33.4, 38.75), null);
});

test("kesin bayrağı gün sayısıyla tutarlı", () => {
  for (const [lon, lat, days, certain] of FIXED_SOURCES) {
    const hit = fixedSourceAt(lon, lat);
    assert.ok(hit);
    if (certain === 1) assert.ok(days >= 70, `kesin ama ${days} gün`);
  }
});
