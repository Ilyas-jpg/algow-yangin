import test from "node:test";
import assert from "node:assert/strict";
import { targetsInDirection } from "./cone-places.ts";
import type { ConeGeom } from "./wind.ts";

/** Merkezi (lon,lat), yarıçapı km olan kaba halka — mesafe tavanı için. */
function halka(lon: number, lat: number, km: number): [number, number][] {
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  const r: [number, number][] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    r.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  r.push(r[0]);
  return r;
}

/**
 * Koni kurucusu. Gerçek `buildCone` çıktısına ihtiyaç yok: bu modül yalnız
 * apex + spreadDeg + halfAngle + isDisc + rings alanlarını okuyor.
 */
function koni(
  lon: number,
  lat: number,
  spreadDeg: number,
  over: Partial<ConeGeom> = {}
): ConeGeom {
  return {
    eventId: "t",
    apex: [lon, lat],
    spreadDeg,
    windKmh: 12,
    // Gerçek koniler halka taşır; fixture da taşısın ki mesafe tavanı
    // gerçek yoldan geçsin (halkasız hâl yalnız yedek dalı sınar).
    rings: [{ hours: 6, ring: halka(lon, lat, 6) }],
    centerline: [],
    windOnlyDeg: spreadDeg,
    slopeShare: 0,
    halfAngle: 30,
    isDisc: false,
    driftDeg: 0,
    ...over,
  };
}

/* Muğla/Menteşe civarı — çevresinde başka ilçe merkezleri var. */
const LON = 28.3636;
const LAT = 37.2153;

test("yönde kalan yerleşim bulunuyor", () => {
  // Geniş koni (20 km halka → tavan 40 km) ki veri seti yoğunluğuna
  // bağlı kalmadan en az bir merkez yakalansın.
  const genis = (yon: number) =>
    koni(LON, LAT, yon, { rings: [{ hours: 6, ring: halka(LON, LAT, 20) }] });
  const toplam = [0, 90, 180, 270].flatMap((y) => targetsInDirection(genis(y), 3));
  assert.ok(toplam.length > 0, "hiçbir yönde yerleşim bulunamadı");
  for (const t of toplam) {
    assert.ok(t.km > 0 && t.km <= 40, `mesafe tavanı aşılmış: ${t.km}`);
    assert.ok(t.offDeg <= 45, `sapma eşiği aşılmış: ${t.offDeg}`);
  }
});

test("ters yöndeki yerleşim ELENİYOR", () => {
  // Aynı noktadan iki zıt yön aynı yeri döndüremez.
  const kuzey = targetsInDirection(koni(LON, LAT, 0), 5).map((t) => t.name);
  const guney = targetsInDirection(koni(LON, LAT, 180), 5).map((t) => t.name);
  const ortak = kuzey.filter((n) => guney.includes(n));
  assert.deepEqual(ortak, [], `zıt yönlerde ortak yer: ${ortak.join(", ")}`);
});

test("yön bilgisi yoksa (disk) iddia da yok", () => {
  // Rüzgâr durgunken koni daireye dönüyor; "şu yöne gidiyor" demek yanlış olurdu.
  assert.deepEqual(targetsInDirection(koni(LON, LAT, 0, { isDisc: true })), []);
});

test("en yakın önce sıralanıyor", () => {
  const r = targetsInDirection(koni(LON, LAT, 0, { halfAngle: 80 }), 5);
  for (let i = 1; i < r.length; i++) {
    assert.ok(r[i - 1].km <= r[i].km, "mesafe sıralaması bozuk");
  }
});

test("ıssız yerde boş dönüyor, çökmüyor", () => {
  // Akdeniz ortası: menzilde kayıtlı merkez yok.
  assert.deepEqual(targetsInDirection(koni(30.0, 34.6, 0)), []);
});

test("küçük koni uzaktaki yeri İDDİA ETMİYOR", () => {
  // Canlıda yaşandı: 0,9 km'lik koni "Bu yönde: Erbil ~57 km" yazdırdı.
  // Tavan artık dış halkanın katı — durgun rüzgârda iddia da küçük kalmalı.
  const kucuk = koni(43.13, 36.34, 90, {
    windKmh: 1,
    rings: [{ hours: 6, ring: halka(43.13, 36.34, 0.45) }],
  });
  const r = targetsInDirection(kucuk, 5);
  assert.ok(
    r.every((t) => t.km <= 12),
    `küçük koni uzağı iddia etti: ${r.map((t) => `${t.name} ${t.km.toFixed(0)}km`).join(", ")}`
  );
});

test("hızlı yangında menzil genişliyor", () => {
  const hizli = koni(28.3636, 37.2153, 0, {
    windKmh: 30,
    rings: [{ hours: 6, ring: halka(28.3636, 37.2153, 20) }],
  });
  const kucuk = koni(28.3636, 37.2153, 0, {
    windKmh: 2,
    rings: [{ hours: 6, ring: halka(28.3636, 37.2153, 0.5) }],
  });
  const enUzakHizli = Math.max(0, ...targetsInDirection(hizli, 9).map((t) => t.km));
  const enUzakKucuk = Math.max(0, ...targetsInDirection(kucuk, 9).map((t) => t.km));
  assert.ok(
    enUzakHizli >= enUzakKucuk,
    "hızlı yangının menzili küçük koniden dar çıktı"
  );
});

test("limit uygulanıyor", () => {
  const r = targetsInDirection(koni(LON, LAT, 0, { halfAngle: 90 }), 1);
  assert.ok(r.length <= 1);
});
