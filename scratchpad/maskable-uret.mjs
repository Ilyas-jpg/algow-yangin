/**
 * Android için maskable ikon üretir.
 *
 * Mevcut ikonları `purpose: "maskable"` diye işaretlemek YANLIŞ olurdu:
 * Android maskeyi (daire, squircle, damla) uyguladığında karenin köşelerini
 * kesiyor. Maskable ikonun içeriği "safe zone"da — merkezdeki %80 çapındaki
 * dairenin içinde — kalmalı. Bu yüzden sparkle marka zemini üzerine küçültülüp
 * ortalanıyor; şeffaf zeminli mevcut ikon olduğu gibi maskelenirse hem kenarı
 * kırpılır hem arkasında sistemin gri zemini çıkar.
 *
 * ⚠️ Kaynakta sparkle'ın çevresinde geniş şeffaf boşluk var — `.trim()`
 * olmadan ikon safe zone içinde iyice küçülüyor (favicon turunda öğrenilmişti).
 *
 * Çalıştır:  node scratchpad/maskable-uret.mjs
 */
import sharp from "sharp";
import { join } from "node:path";
import { stat } from "node:fs/promises";

const KOK = process.cwd();
const KAYNAK = join(KOK, "public", "brand", "algow-icon.png");
const ZEMIN = "#0a0a0b"; // manifest background_color ile aynı

/** İçerik kenarın %20'sine girmesin: 512'de 512×0.6 ≈ 307 px. */
const ICERIK_ORAN = 0.6;

const OLCULER = [512, 192];

for (const boy of OLCULER) {
  const icerik = Math.round(boy * ICERIK_ORAN);

  const sparkle = await sharp(KAYNAK)
    .trim()
    .resize(icerik, icerik, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const yol = join(KOK, "public", "brand", `maskable-${boy}.png`);
  await sharp({
    create: { width: boy, height: boy, channels: 4, background: ZEMIN },
  })
    .composite([{ input: sparkle, gravity: "centre" }])
    .png()
    .toFile(yol);

  const { size } = await stat(yol);
  console.log(`maskable-${boy}.png · içerik ${icerik}px · ${(size / 1024).toFixed(1)} KB`);
}
