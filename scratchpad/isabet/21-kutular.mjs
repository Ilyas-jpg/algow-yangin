/**
 * Pan-Akdeniz kutuları — YAN ETKİSİZ modül.
 *
 * ⚠️ Neden ayrı dosya: bu sabit önce `21-akdeniz-boyut.mjs`in içindeydi ve
 * indirici oradan import ediyordu. Import, o dosyanın en üst seviyesindeki
 * ÖLÇÜMÜ de çalıştırıyor — her yıl indirmesi 124 isteklik boyut ölçümünü
 * boşa tekrarlıyordu. (Aynı hataya bu projede `04b-yakit.mjs` ile de
 * düşülmüştü: script'ten fonksiyon import etmek scripti KOŞTURUR.)
 *
 * Havza dört kutuya bölündü. Tek dev kutu (-10..46) yarısı deniz ve Sahra
 * olurdu; FIRMS ücretsiz kotasını boş alana harcamamak için ülke gruplarına
 * ayrıldı. Kenarlarda bilinçli örtüşme var — tespitler (lon,lat,dt) ile
 * tekilleştiriliyor.
 */
export const KUTULAR = {
  /** İber: ES + PT (kuzey Fas'ın bir şeridi kaçınılmaz olarak giriyor) */
  iberya: "-9.6,36.0,3.4,44.0",
  /** Güney Fransa + Korsika + İtalya + Sardinya + Sicilya + Slovenya */
  italya: "3.4,36.5,19.0,46.5",
  /** Batı Balkanlar + Yunanistan + Ege + Bulgaristan */
  balkan: "19.0,34.5,30.0,45.0",
  /** Türkiye — ürünün kendi kutusu, mevcut korpusla kıyaslanabilir kalsın */
  turkiye: "25.0,34.8,45.5,42.6",
};
