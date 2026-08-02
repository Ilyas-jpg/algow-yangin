/**
 * Sabit ısı kaynağı listesi — "bu nokta yangın değil, baca".
 *
 * SORUN: ana sayfadaki "N aktif yangın" sayacı rafineri ve çelik fabrikalarını
 * yangın sayıyordu. Uydu alev değil ısı görüyor; bu tesisler her gün sıcak.
 *
 * ÖLÇÜT — ayrı gün sayısı. 94 günlük pencerede ≥40 ayrı günde sıcak olan nokta.
 * Dayanağı: Türkiye'nin ölçülmüş en uzun yangını Manavgat 2021, **16,5 gün**.
 * 40+ ayrı günde sıcak olan bir nokta yangın olamaz; anız da olamaz (anız
 * haftalar içinde biter, üç ay boyunca sürmez). Dağılım da iki tepeli:
 * 2377 hücrenin 2125'i ≤5 gün, 50 tanesi ≥40 gün — arada neredeyse hiç yok.
 *
 * ⚠️ CORINE İKİNCİ SİNYAL OLARAK DENENDİ VE ELENDİ: hücre 0,05°'ye (≈5 km)
 * yuvarlandığı için sorgu noktası tesisin yanına düşüyor — Ereğli'deki çelik
 * fabrikası "SU", İskenderun "ORMAN" çıktı. 50 hücrenin yalnız 8'i YAPI
 * göründü; bu bir ölçüm kusuru, gerçek değil. Örtüye göre sınıflandırmak
 * yanlış olurdu, gün sayısı tek başına daha güçlü kanıt.
 *
 * ⚠️ ŞİRKET ADI YAZMIYORUZ. Veriden çıkan şey "burada sürekli bir ısı kaynağı
 * var"; hangi tesis olduğu veriden gelmiyor. Kamu haritasında özel bir şirketi
 * adıyla işaretlemek veriyle desteklenmeyen bir iddia olur.
 *
 * Çalıştırma: node --import ./test/register.mjs scratchpad/sabit-kaynak-pisir.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nearestPlace } from "../src/lib/places.ts";


const KOK = process.cwd();
const YIL = new Date().getUTCFullYear();
const MIN_GUN = 40;

const ham = JSON.parse(
  readFileSync(join(KOK, "scratchpad", "ara", `yil-${YIL}.json`), "utf8")
);

const adaylar = [];
for (const [il, h] of Object.entries(ham.hucreler ?? {})) {
  for (const [k, v] of Object.entries(h)) {
    const gun = Object.keys(v.gunler).length;
    if (gun < MIN_GUN) continue;
    const [lon, lat] = k.split(",").map(Number);
    adaylar.push({ il, lon, lat, n: v.n, gun });
  }
}
adaylar.sort((a, b) => b.gun - a.gun);
console.log(`${adaylar.length} aday hücre (≥${MIN_GUN} ayrı gün)`);

/**
 * Güven kademesi. Şirket adı YAZMIYORUZ — veriden çıkan şey "burada sürekli
 * bir ısı kaynağı var", hangi tesis olduğu değil. Kamu haritasında özel bir
 * şirketi adıyla işaretlemek veriyle desteklenmeyen bir iddia olur.
 */
const kaynaklar = adaylar.map((a) => ({
  lon: a.lon,
  lat: a.lat,
  yer: nearestPlace(a.lon, a.lat).label,
  il: a.il,
  gun: a.gun,
  n: a.n,
  // ≥70 gün (%75+): mevsim boyunca neredeyse kesintisiz → tartışmasız
  kesin: a.gun >= 70,
}));

const kesin = kaynaklar.filter((k) => k.kesin);
console.log(`\nkesin (≥70 gün): ${kesin.length} · olası (40-69 gün): ${kaynaklar.length - kesin.length}`);
console.log("\n— kesin —");
kesin.forEach((k) =>
  console.log(`  ${String(k.gun).padStart(3)}/94 gün · ${String(k.n).padStart(4)} tespit · ${k.yer}`)
);

const yol = join(KOK, "public", "sabit-kaynaklar.json");
writeFileSync(
  yol,
  JSON.stringify({
    olcum: { yil: YIL, minGun: MIN_GUN, pencere: "05-01 → bugün" },
    kaynaklar,
  })
);
console.log(`\n✓ public/sabit-kaynaklar.json — ${kaynaklar.length} kayıt`);
