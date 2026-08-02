/**
 * Favicon üretimi — Google arama sonuçlarında ikon çıksın diye.
 *
 * Sorun: /favicon.ico 404 veriyordu. Google <link rel="icon"> okusa da
 * /favicon.ico'yu arar ve ikonun 48px'in KATI olmasını ister; bizde yalnız
 * 32 ve 48 vardı. Kaynak: public/brand/algow-icon.png (1750x1750, sparkle).
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const KAYNAK = "public/brand/algow-icon.png";

// Google için büyük PNG (48'in katı) + PWA/Apple boyutları
for (const px of [96, 192, 512]) {
  await sharp(KAYNAK)
    .trim() // kaynakta sparkle'ın çevresinde geniş şeffaf boşluk var
    .resize(Math.round(px * 0.88), Math.round(px * 0.88), {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: Math.round(px * 0.06), bottom: px - Math.round(px * 0.88) - Math.round(px * 0.06),
      left: Math.round(px * 0.06), right: px - Math.round(px * 0.88) - Math.round(px * 0.06),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(`public/brand/favicon-${px}.png`);
  console.log(`public/brand/favicon-${px}.png yazıldı`);
}

// ICO: başlık(6) + her görsel için dizin girdisi(16) + PNG gövdeleri.
// Vista+ ICO gövdede PNG kabul ediyor, ayrı BMP kodlamaya gerek yok.
const boyutlar = [16, 32, 48];
const pngler = [];
for (const px of boyutlar) {
  pngler.push(
    await sharp(KAYNAK)
      .trim() // kaynakta sparkle'ın çevresinde geniş şeffaf boşluk var
    .resize(Math.round(px * 0.88), Math.round(px * 0.88), {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: Math.round(px * 0.06), bottom: px - Math.round(px * 0.88) - Math.round(px * 0.06),
      left: Math.round(px * 0.06), right: px - Math.round(px * 0.88) - Math.round(px * 0.06),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
      .png({ compressionLevel: 9 })
      .toBuffer()
  );
}

const basli = Buffer.alloc(6);
basli.writeUInt16LE(0, 0); // reserved
basli.writeUInt16LE(1, 2); // tip 1 = ICO
basli.writeUInt16LE(boyutlar.length, 4);

let ofset = 6 + 16 * boyutlar.length;
const dizin = [];
boyutlar.forEach((px, i) => {
  const d = Buffer.alloc(16);
  d.writeUInt8(px === 256 ? 0 : px, 0); // genişlik
  d.writeUInt8(px === 256 ? 0 : px, 1); // yükseklik
  d.writeUInt8(0, 2); // palet yok
  d.writeUInt8(0, 3); // reserved
  d.writeUInt16LE(1, 4); // düzlem
  d.writeUInt16LE(32, 6); // bit/piksel
  d.writeUInt32LE(pngler[i].length, 8);
  d.writeUInt32LE(ofset, 12);
  ofset += pngler[i].length;
  dizin.push(d);
});

const ico = Buffer.concat([basli, ...dizin, ...pngler]);
writeFileSync("src/app/favicon.ico", ico);
console.log(`src/app/favicon.ico yazıldı — ${boyutlar.join("/")} px, ${ico.length} bayt`);
