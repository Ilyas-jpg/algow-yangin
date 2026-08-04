/**
 * Karne toplama testleri.
 *
 * Ölçülen hata sayısı ile "gözlem yok" ayrımı bu dosyanın asıl konusu:
 * ikisini karıştırmak karneyi sistematik olarak güzelleştirir (tahmin
 * tutmadığında "veri yok" saymak, aracın kendi kendini haklı çıkarması olur).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { karneOf, sezonBasi, type KarneRow } from "./karne.ts";

const r = (
  error_deg: number | null,
  head_inside_shape: boolean | null = null,
  new_pixels: number | null = null,
  new_pixels_inside: number | null = null
): KarneRow => ({ error_deg, head_inside_shape, new_pixels, new_pixels_inside });

test("boş girdi tüm alanları null döndürür, sıfır değil", () => {
  const k = karneOf([]);
  assert.equal(k.olculen, 0);
  assert.equal(k.ortancaHataDeg, null, "0° demek 'kusursuz tahmin' demek olurdu");
  assert.equal(k.isabet45, null);
  assert.equal(k.kapsama, null);
});

test("ortanca ve isabet oranları", () => {
  const k = karneOf([r(10), r(30), r(70), r(90), r(170)]);
  assert.equal(k.olculen, 5);
  assert.equal(k.ortancaHataDeg, 70);
  assert.equal(k.isabet45, 40, "10 ve 30 → 2/5");
  assert.equal(k.tersOran, 20, "170 → 1/5");
});

test("gözlem yok, hata 0 diye SAYILMAZ", () => {
  const k = karneOf([r(20), r(null), r(null)]);
  assert.equal(k.olculen, 1, "yalnız ölçülebilen tahmin sayılır");
  assert.equal(k.gozlemYok, 2);
  assert.equal(k.ortancaHataDeg, 20, "null satırlar ortancayı aşağı çekmemeli");
});

test("yön ölçülemeyip piksel görülen satır 'gözlem yok' değildir", () => {
  // Yangın büyümüş (3 yeni piksel) ama yön iddiası kurulamamış: bu bir
  // gözlem YOKLUĞU değil, ölçüm yapılamamasıdır. İkisini birleştirmek
  // "uydu görmedi" sayısını şişirir.
  const k = karneOf([r(null, null, 3, 2)]);
  assert.equal(k.gozlemYok, 0);
  assert.equal(k.hucreKapsama, 66.7);
});

test("kapsama yalnız boolean yazılmış satırlardan hesaplanır", () => {
  // 2 true + 1 false + 1 null → 2/3 = %66,7.
  // null paydaya girse 2/4 = %50 çıkardı, yani kapsama olduğundan kötü görünürdü.
  const k = karneOf([r(10, true), r(15, true), r(20, false), r(30, null)]);
  assert.equal(k.kapsama, 66.7, "null olan satır paydaya girmemeli");
});

test("hücre kapsaması toplam üzerinden, satır ortalaması değil", () => {
  // 100 piksellik yangının 90'ı içeride + 2 piksellik yangının 0'ı içeride:
  // doğru cevap %88,2. Satır ortalaması alınsa %45 çıkardı ve küçük bir
  // yangın büyük bir yangınla eşit ağırlık kazanırdı.
  const k = karneOf([r(10, true, 100, 90), r(20, false, 2, 0)]);
  assert.equal(k.hucreKapsama, 88.2);
});

test("sezon başı 1 Mayıs — mayıstan önce geçen yılın sezonu", () => {
  assert.equal(sezonBasi(new Date("2026-08-04T12:00:00Z")), "2026-05-01T00:00:00.000Z");
  assert.equal(sezonBasi(new Date("2026-05-01T00:00:00Z")), "2026-05-01T00:00:00.000Z");
  assert.equal(
    sezonBasi(new Date("2026-03-15T12:00:00Z")),
    "2025-05-01T00:00:00.000Z",
    "mart ayında hâlâ 2025 sezonu okunur"
  );
});

test("gözlem yok (null) ile 'ilerlemedi' (0) ayrı sayılır", () => {
  // Bu ayrım olmadan, tahmin tutmadığında sorumluluk uyduya yıkılabilirdi:
  // "uydu görmedi" ile "gördü ama yangın büyümedi" aynı kovada olurdu.
  const k = karneOf([r(null, null, null, null), r(null, null, 0, 0), r(40, true, 9, 9)]);
  assert.equal(k.gozlemYok, 1, "new_pixels null → uydu görmedi");
  assert.equal(k.ilerlemedi, 1, "new_pixels 0 → gördü, ilerlemedi");
  assert.equal(k.olculen, 1);
});
