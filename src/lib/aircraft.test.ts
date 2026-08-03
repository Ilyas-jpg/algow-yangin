import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyAircraft,
  fireCenters,
  kanatTipi,
  type AdsbRaw,
} from "./aircraft.ts";

const YANGIN = [{ lon: 23.29, lat: 38.15, frp: 1047 }];

/** Atina yangınında gerçekten ölçülmüş kayıtlar (3 Ağustos 2026) */
const SKYCRANE: AdsbRaw = {
  hex: "a1b2c3",
  r: "N154AC",
  t: "S64",
  desc: "SIKORSKY S-64 Skycrane",
  lat: 38.17,
  lon: 23.31,
  alt_baro: 2000,
  gs: 0.7,
  seen: 4,
};

test("özel tip yangın çevresinde tanınır", () => {
  const r = classifyAircraft([SKYCRANE], YANGIN);
  assert.equal(r.length, 1);
  assert.equal(r[0].sinif, "ozel");
  assert.equal(r[0].tescil, "N154AC");
  assert.ok(r[0].alcak, "2000 ft çalışma bandında");
  assert.ok((r[0].yanginKm ?? 99) < 5);
});

test("helikopter ve uçak ayrı ikon alır", () => {
  // Aynı yangında Skycrane (havada asılı su boşaltır) ile AT-802 (120 kt'la
  // geçiş yapar) birlikte dönüyor; aynı silüetle çizmek bilgiyi siliyordu.
  assert.equal(kanatTipi("S64"), "doner", "Skycrane helikopter");
  assert.equal(kanatTipi("KA32"), "doner");
  assert.equal(kanatTipi("B412"), "doner");
  assert.equal(kanatTipi("AT8T"), "sabit", "Air Tractor sabit kanat");
  assert.equal(kanatTipi("CL4T"), "sabit");
  assert.equal(kanatTipi("M18"), "sabit");
  assert.equal(classifyAircraft([SKYCRANE], YANGIN)[0].kanat, "doner");
});

test("yolcu uçağı tipe benzese de listeye girmez", () => {
  // Gerçek yanlış pozitif: Dash 8 tanker olarak da kullanılıyor ama
  // ölçümde 18.000 ft'te seyreden sıradan bir tarifeli sefer yakalandı.
  const dash: AdsbRaw = {
    hex: "d1",
    r: "9H-MATI",
    t: "DH8D",
    lat: 38.2,
    lon: 23.3,
    alt_baro: 18000,
    gs: 340,
  };
  assert.equal(classifyAircraft([dash], YANGIN).length, 0);
});

test("çift kullanımlı helikopter yalnız yangının dibinde ve alçakken sayılır", () => {
  const yakinAlcak: AdsbRaw = {
    hex: "h1",
    t: "B412",
    lat: 38.16,
    lon: 23.3,
    alt_baro: 1500,
    gs: 60,
  };
  const uzak: AdsbRaw = { ...yakinAlcak, hex: "h2", lat: 38.6, lon: 23.9 };
  const yuksek: AdsbRaw = { ...yakinAlcak, hex: "h3", alt_baro: 9000 };
  const hizli: AdsbRaw = { ...yakinAlcak, hex: "h4", gs: 200 };

  assert.equal(classifyAircraft([yakinAlcak], YANGIN)[0]?.sinif, "muhtemel");
  assert.equal(classifyAircraft([uzak], YANGIN).length, 0);
  assert.equal(classifyAircraft([yuksek], YANGIN).length, 0);
  assert.equal(classifyAircraft([hizli], YANGIN).length, 0);
});

test("çift kullanımlı gövdede eksik irtifa karine sayılmaz", () => {
  // Eksik veriyi lehte yorumlamak ambulans helikopterini söndürme
  // uçağı gösterirdi.
  const irtifasiz: AdsbRaw = {
    hex: "h5",
    t: "B412",
    lat: 38.16,
    lon: 23.3,
    gs: 60,
  };
  assert.equal(classifyAircraft([irtifasiz], YANGIN).length, 0);
});

test("kapsam dışı transit uçak elenir", () => {
  const transit: AdsbRaw = {
    hex: "t1",
    t: "AT8T",
    lat: 40.4,
    lon: 22.54,
    alt_baro: 10550,
    gs: 149,
  };
  assert.equal(classifyAircraft([transit], YANGIN).length, 0);
});

test("aynı uçak iki sorgudan gelirse tekilleşir", () => {
  const r = classifyAircraft([SKYCRANE, { ...SKYCRANE }], YANGIN);
  assert.equal(r.length, 1);
});

test("tipsiz kayıt atlanır", () => {
  const tipsiz: AdsbRaw = { hex: "x1", lat: 38.15, lon: 23.29, alt_baro: 1200 };
  assert.equal(classifyAircraft([tipsiz], YANGIN).length, 0);
});

test("fireCenters tek tespitlik gürültüyü almaz, güçlüyü öne alır", () => {
  const pts = [
    ...Array.from({ length: 5 }, () => ({ lon: 23.29, lat: 38.15, frp: 200 })),
    ...Array.from({ length: 4 }, () => ({ lon: 29.2, lat: 36.73, frp: 40 })),
    { lon: 41.0, lat: 37.0, frp: 900 }, // tek tespit — gürültü
  ];
  const c = fireCenters(pts);
  assert.equal(c.length, 2);
  assert.ok(c[0].frp > c[1].frp, "en güçlü küme başta");
  assert.ok(!c.some((x) => Math.round(x.lon) === 41), "tekil tespit elendi");
});

test("fireCenters yakın kümeleri tek sorguya indirir", () => {
  // 100 km içindeki ikinci küme zaten aynı yarıçapta kalıyor.
  const pts = [
    ...Array.from({ length: 5 }, () => ({ lon: 23.29, lat: 38.15, frp: 300 })),
    ...Array.from({ length: 5 }, () => ({ lon: 23.5, lat: 38.3, frp: 100 })),
  ];
  assert.equal(fireCenters(pts).length, 1);
});
