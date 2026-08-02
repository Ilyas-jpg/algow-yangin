/**
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
  [42.15, 36.95, 94, 1], // Cizre, Şırnak
  [26.95, 38.75, 90, 1], // Aliağa, İzmir
  [42.1, 36.95, 89, 1], // Cizre, Şırnak
  [26.25, 39.85, 88, 1], // Ezine, Çanakkale
  [33.75, 36.25, 86, 1], // Silifke, Mersin
  [27.2, 38.45, 85, 1], // Bornova, İzmir
  [28.55, 41, 84, 1], // Çatalca, İstanbul
  [41.9, 36.9, 82, 1], // İdil, Şırnak
  [30.45, 37.25, 80, 1], // Bucak, Burdur
  [36.2, 36.75, 79, 1], // Dörtyol, Hatay
  [30.05, 39.5, 78, 1], // Kütahya
  [27.5, 39.1, 78, 1], // Kınık, İzmir
  [31.4, 41.25, 76, 1], // Ereğli, Zonguldak
  [31.45, 41.25, 76, 1], // Ereğli, Zonguldak
  [36.2, 36.7, 75, 1], // İskenderun, Hatay
  [29.75, 40.75, 74, 1], // Gölcük, Kocaeli
  [36.45, 41.25, 73, 1], // Samsun
  [37.15, 37.35, 72, 1], // Kahramanmaraş
  [32.65, 41.2, 71, 1], // Karabük
  [34.75, 36.85, 68, 0], // Mersin
  [37.15, 37.3, 68, 0], // Gaziantep
  [30.3, 39.85, 68, 0], // Eskişehir
  [29.35, 37.85, 67, 0], // Pamukkale, Denizli
  [39.25, 38.65, 63, 0], // Elazığ
  [29.6, 40.8, 62, 0], // Karamürsel, Kocaeli
  [37, 36.8, 61, 0], // Kilis
  [38.75, 37.3, 61, 0], // Şanlıurfa
  [33.2, 39.95, 58, 0], // Kırıkkale
  [29.55, 40.75, 57, 0], // Karamürsel, Kocaeli
  [32.65, 41.15, 57, 0], // Karabük
  [38.75, 38.45, 56, 0], // Malatya
  [32.65, 40.05, 56, 0], // Ankara
  [27.7, 41.65, 54, 0], // Vize, Kırklareli
  [30.6, 38.65, 53, 0], // Afyonkarahisar
  [28.85, 39.9, 52, 0], // Orhaneli, Bursa
  [33.15, 39.95, 51, 0], // Ankara
  [27.5, 39.1, 50, 0], // Kınık, İzmir
  [40.8, 37.35, 49, 0], // Mardin
  [26.7, 41.8, 49, 0], // Lalapaşa, Edirne
  [30.05, 40.25, 49, 0], // Bilecik
  [32.4, 39.6, 48, 0], // Ankara
  [36.1, 37, 46, 0], // Erzin, Hatay
  [27.15, 40.45, 45, 0], // Şarköy, Tekirdağ
  [36.95, 39.7, 45, 0], // Sivas
  [32.55, 37.95, 44, 0], // Konya
  [27.9, 39.6, 43, 0], // Balıkesir
  [39.75, 38.65, 42, 0], // Elazığ
  [30.2, 39.75, 41, 0], // Eskişehir
  [32.6, 41.2, 41, 0], // Karabük
  [27.65, 39.15, 40, 0], // Kırkağaç, Manisa
];
