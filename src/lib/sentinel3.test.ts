import test from "node:test";
import assert from "node:assert/strict";
import { parseFrpCsv } from "./sentinel3.ts";

/** Canlıdan alınmış gerçek başlık + satırlar (4 Ağu 2026, S3B granülü). */
const BASLIK =
  "#title = SLSTR Level 2 Product, Fire Radiative Power (FRP) measurement, Near Real Time (NRT)\n" +
  "#description = csv output from the Standard MWIR 1km scheme\n" +
  "#institution = EUMETSAT (Darmstadt, Germany)\n" +
  "lat(deg),lon(deg),day,time,D/N,FRP(MW),FRPerr(MW),used_channel,confidence(%),confidence_class(lower=0;nominal=1;higher=2),MWIR_BT(K),IFOV_area(m2),SZA(deg),VZA(deg),actrack(km),altrack(km),satellite\n";

const satir = (lat: number, lon: number, ek = "") =>
  `${lat},${lon},2026-08-04,09:31:08,D,17.143855,2.019463,F1,96.5,2,333.64,1153234.500,29.72,6.37,1.07,1.08,S3B${ek}`;

test("gerçek başlıktan tespit ayrıştırıyor", () => {
  const f = parseFrpCsv(BASLIK + satir(37.62, 28.15) + "\n"); // Çine
  assert.equal(f.length, 1);
  assert.equal(f[0].frp, 17.143855);
  assert.equal(f[0].frpErr, 2.019463);
  assert.equal(f[0].conf, 96.5);
  assert.equal(f[0].sat, "S3B");
  assert.equal(f[0].dn, "D");
  assert.equal(f[0].dt, Date.parse("2026-08-04T09:31:08Z"));
});

test("piksel ayak izi alanları FIRMS scan/track karşılığı olarak geliyor", () => {
  // lib/pixel-footprint.ts bu iki alanı doğrudan kullanıyor; adları
  // değişirse elips sessizce çizilmez olur.
  const f = parseFrpCsv(BASLIK + satir(37.62, 28.15) + "\n");
  assert.equal(f[0].actrack, 1.07);
  assert.equal(f[0].altrack, 1.08);
});

test("kutu dışındaki tespit ELENİYOR", () => {
  // Arama, kutuyla KESİŞEN granülü döndürüyor; içeriği başka ülkede
  // olabiliyor. Canlıda ilk çektiğimiz granül Sicilya'daydı (37,44/14,08)
  // ve tek bir tespiti bile bizim kutumuza girmiyordu.
  const f = parseFrpCsv(
    BASLIK + satir(37.442667, 14.083508) + "\n" + satir(37.62, 28.15) + "\n"
  );
  assert.equal(f.length, 1, "Sicilya tespiti sızmış");
  assert.equal(Math.round(f[0].lon), 28);
});

test("sütun adındaki birim değişse de eşleşme kök adla yapılıyor", () => {
  // `FRP(MW)` → `FRP(kW)` olsa bile ayrıştırıcı boş dönmemeli.
  const degisik = BASLIK.replace("FRP(MW)", "FRP(kW)").replace(
    "actrack(km)",
    "actrack(m)"
  );
  const f = parseFrpCsv(degisik + satir(37.62, 28.15) + "\n");
  assert.equal(f.length, 1);
  assert.equal(f[0].frp, 17.143855);
});

test("boş ürün ve bozuk gövde çökmüyor", () => {
  assert.deepEqual(parseFrpCsv(BASLIK), []);
  assert.deepEqual(parseFrpCsv(""), []);
  assert.deepEqual(parseFrpCsv("#yalnizca yorum\n"), []);
  assert.deepEqual(parseFrpCsv(BASLIK + "abc,def\n"), []);
});
