/**
 * CANLI KARNE — "bu sezon çizdiğimiz koniler ne kadar tuttu?"
 *
 * `/api/ml/cone` her 15 dakikada aktif yangınların konisini özellikleriyle
 * kaydeder; `/api/ml/verify` bir sonraki uydu geçişinde sonucu yazar. Burası o
 * satırları tek bir karneye indiriyor. Amaç, `/hakkinda`'daki dürüstlük
 * bölümünün GERÇEK ZAMANLI hâli: arşiv üzerinde ölçülmüş sayılar değil, bu
 * sezon canlıda üretilmiş tahminlerin karnesi.
 *
 * 🔴 HANGİ CETVELLE ÖLÇÜLDÜĞÜ SÖYLENMEK ZORUNDA. Yayındaki "ortanca 68°"
 * sayısı, gerçek yönü yangının KÜTLE MERKEZİNE çapalayan cetvelden geliyor.
 * Canlı doğrulama ise `progression.ts`'in cephe cetvelini kullanıyor: her yeni
 * piksel KENDİ en yakın yanmış pikselinden ölçülüyor. 2026-08-04'te aynı 228
 * vaka iki cetvelle ölçüldü: merkez 67°, cephe 73°. Yani canlı karnenin 68'in
 * üstünde çıkması bir gerileme DEĞİL, farklı cetvel. İki sayıyı yan yana
 * koyarken bunu yazmamak, kendi kendini kandırmanın en kolay yolu olurdu.
 *
 * ⚠️ "Gözlem yok" bir başarısızlık değildir ve hata 0 diye yazılamaz: yangın
 * sönmüş ya da uydu bir daha uğramamış olabilir. Ayrı sayılıyor.
 */

export interface KarneRow {
  error_deg: number | null;
  head_inside_shape: boolean | null;
  new_pixels: number | null;
  new_pixels_inside: number | null;
}

export interface Karne {
  /** doğrulanmış ve yön hatası ölçülebilmiş tahmin sayısı */
  olculen: number;
  /** doğrulandı ama sonraki geçişte hiç tespit yok (yangın söndü / uydu uğramadı) */
  gozlemYok: number;
  /** uydu gördü ama yangın ölçülebilir biçimde (>1,5 km) ilerlemedi */
  ilerlemedi: number;
  ortancaHataDeg: number | null;
  ortHataDeg: number | null;
  /** ≤45° isabet oranı, % (rastgele beklenti %25) */
  isabet45: number | null;
  /** >135°, yani "tamamen ters" oranı, % (rastgele beklenti %25) */
  tersOran: number | null;
  /** öncü kenarın çizilen şeklin içinde kaldığı oran, % */
  kapsama: number | null;
  /** ilerleyen tüm hücrelerin şekil içinde kalma oranı, % */
  hucreKapsama: number | null;
}

const medyan = (a: number[]): number | null => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

const yuzde = (pay: number, toplam: number): number | null =>
  toplam > 0 ? Math.round((1000 * pay) / toplam) / 10 : null;

export function karneOf(rows: KarneRow[]): Karne {
  const hatalar = rows
    .map((r) => r.error_deg)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  // İki farklı "hata ölçülemedi" hâli, ve ikisi aynı şey DEĞİL:
  //   new_pixels === null → uydu bir daha hiç görmedi (yangın söndü / geçiş yok)
  //   new_pixels === 0    → gördü, ama yangın 1,5 km'den fazla ilerlemedi
  // İkisine de "gözlem yok" demek, tahmin tutmadığında sorumluluğu uyduya
  // yıkmanın kolay yolu olurdu. Hiçbiri hata 0 diye sayılmıyor.
  const gozlemYok = rows.filter(
    (r) => r.error_deg === null && r.new_pixels === null
  ).length;
  const ilerlemedi = rows.filter(
    (r) => r.error_deg === null && r.new_pixels === 0
  ).length;

  const kapsamaVar = rows.filter((r) => typeof r.head_inside_shape === "boolean");
  const iceride = kapsamaVar.filter((r) => r.head_inside_shape).length;

  let hucre = 0;
  let hucreIc = 0;
  for (const r of rows) {
    if (typeof r.new_pixels === "number" && typeof r.new_pixels_inside === "number") {
      hucre += r.new_pixels;
      hucreIc += r.new_pixels_inside;
    }
  }

  return {
    olculen: hatalar.length,
    gozlemYok,
    ilerlemedi,
    ortancaHataDeg: medyan(hatalar),
    ortHataDeg: hatalar.length
      ? Math.round((10 * hatalar.reduce((a, b) => a + b, 0)) / hatalar.length) / 10
      : null,
    isabet45: yuzde(hatalar.filter((v) => v <= 45).length, hatalar.length),
    tersOran: yuzde(hatalar.filter((v) => v > 135).length, hatalar.length),
    kapsama: yuzde(iceride, kapsamaVar.length),
    hucreKapsama: yuzde(hucreIc, hucre),
  };
}

/**
 * Sezon başı — 1 Mayıs. İl/sezon istatistikleri de aynı pencereyi kullanıyor
 * (`il-istatistik-pisir.mjs`), karne onlarla aynı takvimde okunsun.
 */
export function sezonBasi(now = new Date()): string {
  const yil = now.getUTCMonth() >= 4 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${yil}-05-01T00:00:00.000Z`;
}
