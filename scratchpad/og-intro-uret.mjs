/**
 * Kök paylaşım kartını üretir: açılış perdesinin (Intro.tsx) tam yüklenmiş hâli.
 *
 * Neden statik dosya, neden `opengraph-image.tsx` değil:
 * ① Perde %100 statik — canlı veri yok, her istekte yeniden çizmenin karşılığı yok.
 * ② Next 16'da **dosya konvansiyonu `generateMetadata`'yı EZİYOR**
 *    (node_modules/next/dist/docs/.../generate-metadata.md: "File-based metadata
 *    has the higher priority"). `app/(tr)/opengraph-image.png` koysaydık olay
 *    paylaşım kartı (`?ev=`, api/og) ölürdü — o kart sunucuda yeniden kümelenmiş
 *    gerçek veriyi taşıyor, kaybı dezenformasyon riski demek.
 * ③ Satori WebP çözemiyor; perdenin asset'leri webp. sharp burada zaten var.
 *
 * Yerleşim sayıları globals.css'teki `.intro__*` kurallarından birebir alındı;
 * biri değişirse burası da değişmeli.
 *
 * Çalıştır:  node scratchpad/og-intro-uret.mjs
 */
import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

const KOK = process.cwd();
const P = (...parca) => join(KOK, ...parca);

const G = 1200;
const Y = 630;

/* globals.css → .intro__soz  { top: 46%; width: min(80vw, 660px) } */
const SOZ_GENISLIK = 660;
const SOZ_MERKEZ = 0.46;
/* globals.css → .intro__mark { bottom: 8%; width: clamp(92px, 11vw, 124px) } */
const MARK_GENISLIK = 124;
const MARK_ALT = 0.08;

/**
 * globals.css → .intro__veil
 *   radial-gradient(78% 62% at 50% 44%, transparent 0%, rgba(0,0,0,.55) 100%)
 *   linear-gradient(to bottom, rgba(0,0,0,.45) 0%, transparent 26%)
 *
 * CSS'in elips yarıçapları genişlik/yüksekliğe ayrı ayrı oranlı; SVG'de daire
 * çizip `gradientTransform` ile Y'de eziyoruz — yoksa perde yuvarlak kalır ve
 * kenar koyulaşması üstte/altta erken başlar.
 */
function perde() {
  const rx = 0.78 * G;
  const ry = 0.62 * Y;
  const cx = 0.5 * G;
  const cy = 0.44 * Y;
  const olcekY = ry / rx;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${G}" height="${Y}">
  <defs>
    <radialGradient id="kenar" gradientUnits="userSpaceOnUse"
      cx="${cx}" cy="${cy}" r="${rx}"
      gradientTransform="translate(${cx} ${cy}) scale(1 ${olcekY}) translate(${-cx} ${-cy})">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.55"/>
    </radialGradient>
    <linearGradient id="ust" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.45"/>
      <stop offset="0.26" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${G}" height="${Y}" fill="url(#kenar)"/>
  <rect width="${G}" height="${Y}" fill="url(#ust)"/>
</svg>`);
}

/** Genişliğe göre ölçekler, yerleştirme için gerçek yüksekliği de döndürür. */
async function olcekle(yol, genislik) {
  const tampon = await sharp(yol).resize({ width: genislik }).png().toBuffer();
  const { height } = await sharp(tampon).metadata();
  return { tampon, yukseklik: height };
}

const soz = await olcekle(P("public", "intro", "soz.webp"), SOZ_GENISLIK);
const mark = await olcekle(P("public", "brand", "algow-wordmark.webp"), MARK_GENISLIK);

const kare = sharp(P("public", "intro", "bg-1600.webp"))
  .resize(G, Y, { fit: "cover", position: "centre" })
  .composite([
    { input: perde(), top: 0, left: 0 },
    {
      input: soz.tampon,
      left: Math.round((G - SOZ_GENISLIK) / 2),
      top: Math.round(SOZ_MERKEZ * Y - soz.yukseklik / 2),
    },
    {
      input: mark.tampon,
      left: Math.round((G - MARK_GENISLIK) / 2),
      top: Math.round(Y - MARK_ALT * Y - mark.yukseklik),
    },
  ]);

await mkdir(P("public", "og"), { recursive: true });

/**
 * Fotoğrafik zemin PNG'de 1 MB'ı aşıyor; hedef <300 KB (sohbet uygulamaları
 * büyük kartı geç çözüyor ya da hiç çözmüyor). Önce paletli PNG deneniyor,
 * sığmazsa JPEG'e düşülüyor — hangisinin kazandığı çıktıda yazıyor.
 */
const SINIR = 300 * 1024;
const pngYol = P("public", "og", "intro.png");

await kare.clone().png({ palette: true, quality: 90, effort: 10 }).toFile(pngYol);
const pngBoyut = (await stat(pngYol)).size;

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`söz     : ${SOZ_GENISLIK}×${soz.yukseklik}`);
console.log(`wordmark: ${MARK_GENISLIK}×${mark.yukseklik}`);
console.log(`png     : ${kb(pngBoyut)} ${pngBoyut <= SINIR ? "✓" : "✗ SINIR AŞILDI"}`);

// Ölçüldü (2026-08-04): paletli PNG 188 KB ile sınırın altında kaldı, JPEG'e
// düşmek gerekmedi. Zemin görseli değişirse bu dal yeniden devreye girebilir.
if (pngBoyut > SINIR) {
  const jpgYol = P("public", "og", "intro.jpg");
  await kare.clone().jpeg({ quality: 86, mozjpeg: true }).toFile(jpgYol);
  console.log(`jpg     : ${kb((await stat(jpgYol)).size)}`);
  console.log("→ PNG sınırı aştı: layout'taki og:image'ı /og/intro.jpg'e çevir");
}
