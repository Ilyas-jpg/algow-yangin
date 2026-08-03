/**
 * İlk alarm testleri.
 *
 * Senaryolar Bayramiç/Çanakkale ölçümünden alındı (2 Ağu 2026): MTG o
 * yangını 16:00'da 2 piksel, 16:30'da 8 piksel olarak gördü; FIRMS hiç
 * görmedi. Buradaki iş, o tespiti TEK alarma çevirip doğrulanmış
 * yangınları alarm diye tekrar göstermemek.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { firstAlarms, type HeatPixel } from "./first-alarm.ts";

const T = Date.UTC(2026, 7, 2, 13, 30); // 16:30 TR

/** Bayramiç yangınının gerçek MTG pikselleri (16:30 dilimi) */
const BAYRAMIC: HeatPixel[] = [
  { lon: 26.739, lat: 39.926, frp: 35.2, dt: T },
  { lon: 26.753, lat: 39.927, frp: 108.8, dt: T },
  { lon: 26.768, lat: 39.928, frp: 39.4, dt: T },
  { lon: 26.732, lat: 39.912, frp: 102.3, dt: T },
  { lon: 26.747, lat: 39.913, frp: 302.9, dt: T },
  { lon: 26.761, lat: 39.914, frp: 131.1, dt: T },
  { lon: 26.740, lat: 39.899, frp: 29.7, dt: T },
  { lon: 26.755, lat: 39.900, frp: 15.3, dt: T },
];

test("doğrulanmamış ısı kaynağı alarma dönüşür", () => {
  const out = firstAlarms(BAYRAMIC, []);
  assert.equal(out.length, 1, "8 bitişik piksel TEK alarm olmalı");
  assert.equal(out[0].pixels, 8);
  // Toplam değil en yüksek piksel — örtüşen pikselleri toplamak şişirir.
  assert.equal(out[0].frp, 302.9);
  assert.match(out[0].label, /Bayramiç|Çanakkale|Ezine|Ayvacık/);
});

test("FIRMS doğrulamışsa alarm üretilmez", () => {
  // Aynı yangını VIIRS de görüyorsa zaten olay listesinde; tekrar alarm
  // vermek kullanıcıya iki ayrı yangın varmış gibi gelir.
  const out = firstAlarms(BAYRAMIC, [{ lon: 26.747, lat: 39.913 }]);
  assert.equal(out.length, 0);
});

test("uzaktaki FIRMS tespiti doğrulama saymaz", () => {
  // 5 km eşiğinin dışında (~40 km güneyde) başka bir yangın
  const out = firstAlarms(BAYRAMIC, [{ lon: 26.747, lat: 39.55 }]);
  assert.equal(out.length, 1);
});

test("ayrı bölgelerdeki ısı kaynakları ayrı alarm olur", () => {
  const out = firstAlarms(
    [
      { lon: 26.747, lat: 39.913, frp: 100, dt: T },
      { lon: 29.2, lat: 36.73, frp: 60, dt: T }, // Fethiye
    ],
    []
  );
  assert.equal(out.length, 2);
  // En güçlüsü başta
  assert.equal(out[0].frp, 100);
});

test("sabit sanayi kaynağı alarm üretmez", () => {
  // Aliağa/İzmir (26.95, 38.75) — sezonun 90 gününde sıcak görünen tesis.
  // Elenmezse alarm sürekli yanar ve kullanıcı bakmayı bırakır.
  const out = firstAlarms([{ lon: 26.95, lat: 38.75, frp: 120, dt: T }], []);
  assert.equal(out.length, 0);
});

test("boş girdi boş sonuç", () => {
  assert.deepEqual(firstAlarms([], []), []);
  assert.deepEqual(firstAlarms([], [{ lon: 30, lat: 39 }]), []);
});

test("yurt dışı alarm listede sonda", () => {
  const out = firstAlarms(
    [
      { lon: 43.8, lat: 34.9, frp: 500, dt: T }, // Samarra, Irak
      { lon: 26.747, lat: 39.913, frp: 50, dt: T },
    ],
    []
  );
  assert.equal(out.length, 2);
  // FRP'si düşük olsa da yurt içi önce gelir
  assert.equal(out[0].abroad, false);
  assert.equal(out[1].abroad, true);
});
