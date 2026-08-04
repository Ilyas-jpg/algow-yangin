import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GRID_LAT0,
  GRID_LON0,
  GRID_NX,
  GRID_NY,
  GRID_STEP,
  REGION,
  REGION_BBOX,
  SMOKE_NX,
  SMOKE_NY,
  inRegion,
} from "./bbox.ts";

test("REGION_BBOX FIRMS'in beklediği sırada", () => {
  // west,south,east,north — sıra karışırsa FIRMS sessizce boş döner
  assert.equal(REGION_BBOX, "19.2,34.4,45.5,42.6");
});

test("kutu Yunanistan'ın batısını ve Girit'in güneyini içeriyor", () => {
  assert.ok(inRegion(19.92, 39.62), "Korfu");
  assert.ok(inRegion(21.73, 38.25), "Patras");
  assert.ok(inRegion(22.11, 37.04), "Kalamata");
  assert.ok(inRegion(24.02, 35.51), "Hanya");
  assert.ok(inRegion(24.08, 34.83), "Gavdos — Yunanistan'ın en güneyi");
});

test("kutu Türkiye'yi ve eski kapsamı korumaya devam ediyor", () => {
  assert.ok(inRegion(28.15, 37.62), "Çine");
  assert.ok(inRegion(44.5, 39.9), "Iğdır");
  assert.ok(inRegion(33.02, 34.71), "Limasol");
  assert.ok(!inRegion(18.5, 40.1), "Otranto/İtalya — kutunun dışında");
  assert.ok(!inRegion(46.2, 38.0), "Tebriz — kutunun dışında");
});

test("her ızgara Open-Meteo'nun dakikalık lokasyon tavanına sığıyor", () => {
  // 3 Ağustos 2026'da canlıda ölçüldü: limit istek SAYISINA değil sorulan
  // LOKASYON sayısına bakıyor ve tavan ~600. Kutu batıya genişleyince 0,5°
  // rüzgâr ızgarası 1.026 hücreye çıktı ve 11 parçanın 5'i 429 yedi.
  // Eksik hücre "kaba rüzgâr" değil HİÇ rüzgâr demek: sampleUV null döner,
  // o yangına koni çizilmez. Bu testin işi o regresyonu bir daha yaşatmamak.
  const TAVAN = 600;
  assert.ok(
    GRID_NX * GRID_NY <= TAVAN,
    `rüzgâr ızgarası ${GRID_NX}x${GRID_NY}=${GRID_NX * GRID_NY} > ${TAVAN}`
  );
  assert.ok(
    SMOKE_NX * SMOKE_NY <= TAVAN,
    `duman ızgarası ${SMOKE_NX}x${SMOKE_NY}=${SMOKE_NX * SMOKE_NY} > ${TAVAN}`
  );
});

test("meteorolojik ızgara kutuyu TAMAMEN kapsıyor", () => {
  // Kenarda kalan hücre dört komşusunu bulamaz ve yangın rüzgârsız kalır
  // (Güney Kıbrıs vakası). Izgara her yönde en az bir adım dışarı taşmalı.
  const lonMax = GRID_LON0 + (GRID_NX - 1) * GRID_STEP;
  const latMax = GRID_LAT0 + (GRID_NY - 1) * GRID_STEP;
  assert.ok(GRID_LON0 <= REGION.west, `grid batısı ${GRID_LON0}`);
  assert.ok(GRID_LAT0 <= REGION.south, `grid güneyi ${GRID_LAT0}`);
  assert.ok(lonMax >= REGION.east, `grid doğusu ${lonMax}`);
  assert.ok(latMax >= REGION.north, `grid kuzeyi ${latMax}`);
});

/**
 * 🔴 CANLI HATA (4 Ağu 2026) — bu testin varlık sebebi.
 *
 * Kutu Yunanistan'ı kapsamak için batıya genişletildiğinde (25,0 → 19,2)
 * `lib/bbox` tek kaynak yapılmıştı; ama BEŞ rota kendi elle yazdığı kopyayı
 * taşımaya devam etti: wind/point, smoke, terrain, wind/forecast, ml/cone.
 * Sonuç: 24,9°D'nin batısındaki her yangında hava paneli ve duman tahmini
 * HTTP 400 dönüyor, eğim ve saatlik rüzgâr çekilemiyor, üstelik o yangınlar
 * eğitim setine hiç yazılmıyordu — ml/cone'un kendi yorumu Yunanistan'ın
 * "içeride" olduğunu söylediği hâlde. Korint yangınında canlıda yakalandı.
 *
 * Kopya sessiz bozuluyor: kimse hata vermiyor, veri yokmuş gibi görünüyor.
 */
test("hiçbir rota kendi kutusunu elle yazmıyor", () => {
  const kok = join(process.cwd(), "src", "app", "api");
  const suphe = /\b(24\.9|25\.0|34\.5|42\.7|45\.6)\b/;

  const tara = (dizin: string): string[] => {
    const cikti: string[] = [];
    for (const g of readdirSync(dizin, { withFileTypes: true })) {
      const yol = join(dizin, g.name);
      if (g.isDirectory()) cikti.push(...tara(yol));
      else if (g.name.endsWith(".ts") || g.name.endsWith(".tsx")) {
        for (const [i, satir] of readFileSync(yol, "utf8").split("\n").entries()) {
          // Yorum satırı serbest: hatayı ANLATAN metinler var.
          const kirp = satir.trim();
          if (kirp.startsWith("*") || kirp.startsWith("//") || kirp.startsWith("/*")) continue;
          if (suphe.test(satir)) cikti.push(`${yol.split("api")[1]}:${i + 1}`);
        }
      }
    }
    return cikti;
  };

  const bulunan = tara(kok);
  assert.deepEqual(
    bulunan,
    [],
    `elle yazılmış kutu sınırı kalmış (inRegion kullan): ${bulunan.join(", ")}`
  );
});

test("Yunanistan anakarası kapsam içinde — batı genişlemesi korunuyor", () => {
  assert.ok(inRegion(22.93, 37.94), "Korint — canlıda 400 dönen yangın");
  assert.ok(inRegion(23.73, 37.98), "Atina");
  assert.ok(inRegion(20.02, 40.07), "Girokastra, Arnavutluk");
  assert.ok(inRegion(21.43, 42.0), "Üsküp civarı");
});
