/** sabit-kaynaklar.json → src/data/fixed-sources.ts (paketlenmiş modül) */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";

const d = JSON.parse(readFileSync("public/sabit-kaynaklar.json", "utf8"));
const k = d.kaynaklar.sort((a, b) => b.gun - a.gun);
const satir = k
  .map((x) => `  [${x.lon}, ${x.lat}, ${x.gun}, ${x.kesin ? 1 : 0}], // ${x.yer}`)
  .join("\n");

const out = `/**
 * Sabit ısı kaynakları — uydunun sürekli sıcak gördüğü noktalar.
 *
 * Uydu alev değil ISI görür. Rafineri, çelik fabrikası, enerji santrali ve gaz
 * bacası her gün sıcaktır; bunlar yangın olmadıkları hâlde tespit üretir ve
 * "aktif yangın" sayısını şişirir.
 *
 * ÖLÇÜT (2026 sezonu, 1 May–2 Ağu, 94 gün): aynı 0,05° hücrede ≥40 AYRI GÜNDE
 * tespit. Dayanak: Türkiye'nin ölçülmüş en uzun yangını Manavgat 2021, 16,5 gün.
 * Anız da haftalar içinde biter, üç ay sürmez. Dağılım iki tepeli — 2377
 * hücrenin 2125'i ≤5 gün, 50 tanesi ≥40 gün; arada neredeyse hiçbir şey yok.
 *
 * ⚠️ CORINE ikinci sinyal olarak denendi ve ELENDİ: hücre 0,05°'ye (≈5 km)
 * yuvarlandığı için sorgu noktası tesisin yanına düşüyor (Ereğli'deki çelik
 * fabrikası "SU", İskenderun "ORMAN" çıktı). Örtüye göre sınıflandırmak
 * yanlış olurdu; gün sayısı tek başına daha güçlü kanıt.
 *
 * ⚠️ Şirket/tesis adı YOK. Veriden çıkan şey "burada sürekli bir ısı kaynağı
 * var"; hangi tesis olduğu veriden gelmiyor ve kamu haritasında özel bir
 * şirketi adıyla işaretlemek veriyle desteklenmeyen bir iddia olurdu.
 *
 * Üretici: scratchpad/sabit-kaynak-pisir.mjs → scratchpad/sabit-kaynak-modul.mjs
 */

/** [lon, lat, ayrıGün, kesinMi] */
export type FixedSourceTuple = [number, number, number, 0 | 1];

export const FIXED_SOURCES: FixedSourceTuple[] = [
${satir}
];
`;

writeFileSync("src/data/fixed-sources.ts", out);
// public'teki ara çıktı gerekmiyor: veri artık pakete gömülü
if (existsSync("public/sabit-kaynaklar.json")) unlinkSync("public/sabit-kaynaklar.json");
console.log(
  `src/data/fixed-sources.ts yazıldı — ${k.length} kayıt (${k.filter((x) => x.kesin).length} kesin), ${Math.round(out.length / 1024)} KB`
);
