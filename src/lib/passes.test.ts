/**
 * Uydu geçiş penceresi çıkarımının testleri.
 *
 * Bu mantık kullanıcıya "şu an kör aralıktasın, tespit gelmemesi yangının
 * söndüğü anlamına gelmez" diyor. Yanlış çalışırsa ya sürekli yanlış alarm
 * verir ya da gerçekten kör olduğumuz anda susar; ikisi de yanıltıcı.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextPassEstimate, fmtNext } from "./passes.ts";

/** verilen UTC saatlerinde n adet tespit üret (son 48 saat içinde) */
function tespitler(saatler: number[], now: number, adet = 12): number[] {
  const out: number[] = [];
  for (const gunFarki of [0, 1]) {
    for (const h of saatler) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - gunFarki);
      d.setUTCHours(h, 30, 0, 0);
      if (d.getTime() > now) continue;
      for (let i = 0; i < adet; i++) out.push(d.getTime() + i * 1000);
    }
  }
  return out;
}

test("yetersiz örnekte pencere iddia edilmez", () => {
  const now = Date.UTC(2026, 7, 2, 6, 0);
  const r = nextPassEstimate([now - 3600_000], now, now - 3600_000);
  assert.equal(r.nextH, null, "az veriyle tahmin yapılmamalı");
  assert.equal(r.inGap, false, "az veriyle kör aralık iddiası da yok");
  assert.ok(r.sinceH !== null && r.sinceH > 0.9, "yine de son tespit yaşı bilinir");
});

test("geçiş pencereleri veriden çıkarılır", () => {
  const now = Date.UTC(2026, 7, 2, 6, 0); // 06:00 UTC — pencereler dışında
  const r = nextPassEstimate(tespitler([1, 11, 13, 22], now), now, now - 5 * 3600_000);
  assert.deepEqual(r.windows, [1, 11, 13, 22], "yalnız yoğun saatler pencere sayılmalı");
});

test("pencere dışında kör aralık bildirilir ve sonraki geçiş hesaplanır", () => {
  const now = Date.UTC(2026, 7, 2, 6, 0);
  const r = nextPassEstimate(tespitler([1, 11, 13, 22], now), now, now - 5 * 3600_000);
  assert.equal(r.inGap, true, "06:00'da pencere yok → kör aralık");
  assert.ok(r.nextH !== null && Math.abs(r.nextH - 5) < 1.01, `11:00'a ~5 saat kalmalı, ${r.nextH}`);
});

test("pencere içindeyken kör aralık bildirilmez", () => {
  const now = Date.UTC(2026, 7, 2, 11, 20);
  const r = nextPassEstimate(tespitler([1, 11, 13, 22], now), now, now - 600_000);
  assert.equal(r.inGap, false, "11:20'de pencere içindeyiz");
});

test("gün dönümünü sararak sonraki pencereyi bulur", () => {
  const now = Date.UTC(2026, 7, 2, 23, 30); // son pencere 22, sonraki ertesi gün 01
  const r = nextPassEstimate(tespitler([1, 11, 13, 22], now), now, now - 3600_000);
  assert.equal(r.inGap, true, "23:30 pencere dışı");
  assert.ok(r.nextH !== null && r.nextH < 3, `gece yarısını aşıp 01:00'i bulmalı, ${r.nextH}`);
});

test("her saat tespit varsa kör aralık iddiası yapılmaz", () => {
  const now = Date.UTC(2026, 7, 2, 6, 0);
  const hepsi = Array.from({ length: 24 }, (_, i) => i);
  const r = nextPassEstimate(tespitler(hepsi, now, 6), now, now - 600_000);
  assert.equal(r.inGap, false, "sürekli kapsama varsa kör aralık yok");
  assert.equal(r.nextH, null, "tahmin edilecek bir boşluk yok");
});

test("fmtNext insan diliyle yazar", () => {
  assert.equal(fmtNext(null, "tr"), "—");
  assert.equal(fmtNext(0.2, "tr"), "birazdan");
  assert.equal(fmtNext(1, "tr"), "≈1 sa sonra");
  assert.equal(fmtNext(4.4, "tr"), "≈4 sa sonra");
});

test("fmtNext İngilizcede de aynı eşikleri kullanır", () => {
  assert.equal(fmtNext(null, "en"), "—");
  assert.equal(fmtNext(0.2, "en"), "shortly");
  assert.equal(fmtNext(1, "en"), "in ≈1 h");
  assert.equal(fmtNext(4.4, "en"), "in ≈4 h");
});
