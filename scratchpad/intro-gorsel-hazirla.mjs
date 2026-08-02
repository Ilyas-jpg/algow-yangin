/**
 * Açılış görsellerini web'e hazırlar.
 *
 * Kaynak PNG 3,3 MB — bu platformun ilk ziyaret bütçesi 792 KB, yani
 * arkaplanı olduğu gibi koymak açılışı iki katından fazla şişirirdi.
 * WebP + iki boyut (masaüstü/mobil) ile birkaç yüz KB'ye iniyor.
 *
 * Metin katmanı TAM KAREYI kaplayan bir görsel olarak KULLANILMIYOR:
 * 1920×1080 komposizyonda söz karenin %41'i kadar; telefonda `cover` ile
 * kırpılınca cümlenin kenarları kesiliyor, `contain` ile de okunamayacak
 * kadar küçülüyordu. Onun yerine yalnız sözün kendisi kırpılıp CSS ile
 * boyutlanıyor. Wordmark ayrı: projede zaten gerçek marka asset'i var
 * (public/brand/algow-wordmark.webp).
 *
 * Çalıştır: node scratchpad/intro-gorsel-hazirla.mjs
 */
import sharp from "sharp";
import { statSync } from "node:fs";
import { join } from "node:path";

const IN_BG = "C:/Users/milya/Downloads/arkaplan.png";
const IN_TX = "C:/Users/milya/Downloads/arkaplanmetni.png";
const OUT = join(process.cwd(), "public", "intro");

const kb = (p) => Math.round(statSync(p).size / 1024);

/**
 * Sözün kaynak karedeki yeri — alfa kanalı taranarak ölçüldü:
 * satırlar y 468-611, sütunlar x 560-1359. Çevresine birkaç piksel pay
 * bırakılıyor ki kenar yumuşaması kesilmesin.
 */
const SOZ = { left: 552, top: 460, width: 816, height: 160 };

const isler = [
  {
    ad: "arkaplan (masaüstü)",
    yap: () =>
      sharp(IN_BG).resize(1600, 900, { fit: "cover" }).webp({ quality: 58 }),
    cikti: join(OUT, "bg-1600.webp"),
  },
  {
    ad: "arkaplan (mobil)",
    yap: () =>
      sharp(IN_BG).resize(900, 506, { fit: "cover" }).webp({ quality: 56 }),
    cikti: join(OUT, "bg-900.webp"),
  },
  {
    // Saydam: alfa kayıplı sıkışırsa harf kenarları kirlenir → lossless.
    ad: "söz",
    yap: () => sharp(IN_TX).extract(SOZ).webp({ lossless: true }),
    cikti: join(OUT, "soz.webp"),
  },
];

console.log(`kaynak arkaplan: ${kb(IN_BG)} KB · kaynak metin: ${kb(IN_TX)} KB`);
for (const i of isler) {
  await i.yap().toFile(i.cikti);
  console.log(`✓ ${i.ad}: ${i.cikti.split("public")[1]} · ${kb(i.cikti)} KB`);
}
