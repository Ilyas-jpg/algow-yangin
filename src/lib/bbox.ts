/**
 * Platformun kapsadığı coğrafi kutu — TEK KAYNAK.
 *
 * Daha önce aynı sayılar beş dosyada ayrı ayrı yazılıydı (firms, meteosat,
 * rüzgâr gridi, duman gridi, olay kimliği doğrulaması). Kutuyu büyütmek
 * hepsini birden ilgilendiriyor ve biri unutulursa hata SESSİZ oluyor:
 * yangın gelir ama rüzgârı gelmez, koni kısa çizilir. O yüzden tek yer.
 *
 * ── 2026-08-03: batı sınırı 25,0° → 19,2° ───────────────────────────────────
 * Eski kutu Yunanistan'ın yalnız Ege kıyısını ve doğu adalarını alıyordu;
 * anakaranın batısı (Epir, Mora, İyon adaları) ve Girit'in güneyi dışarıda
 * kalıyordu. Ölçüm (5 günlük pencere, 3 Ağustos 2026): batıda kazanılan
 * 4.055 tespitin 3.956'sı (%98) Yunanistan anakarası, içinde 2.645 MW'lık
 * bir yangın — o güne kadar gördüğümüz en büyük Türkiye yangınının iki katı.
 * Dikdörtgen kaçınılmaz olarak Arnavutluk/Makedonya/Kosova'yı da alıyor ama
 * oradan gelen toplam 99 nokta (%2); yer etiketleri eklendi, "yurt dışı"
 * ayrımı bunları zaten listenin altında tutuyor.
 *
 * Güney sınırı 34,8 → 34,4: Girit'in güney kıyısı 34,90 ve Gavdos adası
 * 34,83 tam sınırın üstündeydi, yani kırpılma riski vardı.
 */
export const REGION = {
  west: 19.2,
  south: 34.4,
  east: 45.5,
  north: 42.6,
} as const;

/** FIRMS area API'sinin beklediği "west,south,east,north" biçimi */
export const REGION_BBOX = `${REGION.west},${REGION.south},${REGION.east},${REGION.north}`;

export function inRegion(lon: number, lat: number): boolean {
  return (
    lon >= REGION.west &&
    lon <= REGION.east &&
    lat >= REGION.south &&
    lat <= REGION.north
  );
}

/**
 * Meteorolojik ızgaraların ortak geometrisi (rüzgâr + duman).
 *
 * Izgara REGION'ı TAMAMEN kapsamak zorunda: köşede kalan yangın için
 * `sampleUV` dört komşusunu bulamaz ve rüzgârsız kalır — koni de kısa
 * çizilir. Bu daha önce Güney Kıbrıs'ta yaşandı, o yüzden aşağıdaki
 * hesap sınırı içeri değil DIŞARI yuvarlıyor.
 */
export function gridGeometry(step: number) {
  const lon0 = Math.floor(REGION.west / step) * step;
  const lat0 = Math.floor(REGION.south / step) * step;
  return {
    step,
    lon0,
    lat0,
    nx: Math.ceil((REGION.east - lon0) / step) + 1,
    ny: Math.ceil((REGION.north - lat0) / step) + 1,
  };
}

/** Rüzgâr ızgarası — 0,5°, 54×19 = 1026 nokta */
export const GRID_STEP = 0.5;
const wind = gridGeometry(GRID_STEP);
export const GRID_LON0 = wind.lon0; // 19.0
export const GRID_LAT0 = wind.lat0; // 34.0
export const GRID_NX = wind.nx; // 19.0 → 45.5
export const GRID_NY = wind.ny; // 34.0 → 43.0

/**
 * Duman ızgarası bilerek daha seyrek: 0,75°, 37×13 = 481 nokta.
 *
 * Sebebi ölçülmüş bir kısıt. Open-Meteo'nun dakikalık limiti istek SAYISINA
 * değil sorulan LOKASYON sayısına bağlı (3 Ağustos 2026 ölçümü: 100+200+300
 * lokasyon geçti, 513 daha isteyince HTTP 429 "minutely limit"). Kutu
 * batıya genişleyince iki ızgaranın toplamı 2.052 noktaya çıktı ve duman
 * ızgarasının 11 parçasından 5'i düştü — kuzey yarısı boş kaldı.
 *
 * Rüzgâr 0,5°'de kalmak zorunda: koni yönü ve hızı doğrudan ona bağlı.
 * Duman ise seyreltmeye elverişli, çünkü CAMS'in kendi çözünürlüğü zaten
 * ~0,4° — 0,75° örneklemek olmayan bir detayı uydurmamak demek, kayıp değil.
 */
export const SMOKE_STEP = 0.75;
const smoke = gridGeometry(SMOKE_STEP);
export const SMOKE_LON0 = smoke.lon0;
export const SMOKE_LAT0 = smoke.lat0;
export const SMOKE_NX = smoke.nx;
export const SMOKE_NY = smoke.ny;
