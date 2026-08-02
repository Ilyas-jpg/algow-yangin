import test from "node:test";
import assert from "node:assert/strict";
import { bulunma, yonelme } from "./ek.ts";
import { PROVINCES } from "./provinces.ts";

test("bulunma hâli — kalın/ince ve sertleşme", () => {
  assert.equal(bulunma("Muğla"), "Muğla'da");
  assert.equal(bulunma("İzmir"), "İzmir'de");
  assert.equal(bulunma("Zonguldak"), "Zonguldak'ta");
  assert.equal(bulunma("Bilecik"), "Bilecik'te");
  assert.equal(bulunma("Sinop"), "Sinop'ta");
  assert.equal(bulunma("Rize"), "Rize'de");
  assert.equal(bulunma("Uşak"), "Uşak'ta");
  assert.equal(bulunma("Tokat"), "Tokat'ta");
});

test("yönelme hâli — kaynaştırma y'si", () => {
  assert.equal(yonelme("Muğla"), "Muğla'ya");
  assert.equal(yonelme("Rize"), "Rize'ye");
  assert.equal(yonelme("İzmir"), "İzmir'e");
  assert.equal(yonelme("Zonguldak"), "Zonguldak'a");
  assert.equal(yonelme("Bursa"), "Bursa'ya");
  assert.equal(yonelme("Sinop"), "Sinop'a");
});

test("81 ilin hiçbiri boş/bozuk ek almıyor", () => {
  for (const p of PROVINCES) {
    const b = bulunma(p.ad);
    const y = yonelme(p.ad);
    assert.match(b, /'(d|t)[ae]$/, `${p.ad} bulunma: ${b}`);
    assert.match(y, /'y?[ae]$/, `${p.ad} yönelme: ${y}`);
  }
});

test("son ünlü belirleyici — önceki heceler değil", () => {
  // "Kırıkkale": son ünlü e → ince
  assert.equal(bulunma("Kırıkkale"), "Kırıkkale'de");
  // "İstanbul": son ünlü u → kalın
  assert.equal(bulunma("İstanbul"), "İstanbul'da");
});
