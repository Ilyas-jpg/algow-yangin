/**
 * MapLibre 6 worker'ının paketlenmiş adresi.
 *
 * Tek yerde duruyor çünkü iki kullanıcısı aynı dosyayı göstermek zorunda:
 * `FireMap` bunu `setWorkerUrl`'e veriyor, `ClientApp` sayfa açılır açılmaz
 * ön yüklüyor. Next `new URL("…", import.meta.url)` kalıbını görüp dosyayı
 * hash'li statik varlık olarak üretiyor; ifade bir JS içe aktarımı değil,
 * MapLibre'nin kodunu ilk pakete taşımaz.
 *
 * NEDEN ÖN YÜKLEME (ölçüldü 2026-10-18): v5'te worker ana pakete gömülüydü
 * (tek dosya, 275 KB gzip). v6'da ana parça 285 KB + ayrı worker 143 KB ve
 * worker ancak harita kurulurken isteniyordu — yani harita parçası indikten
 * SONRA. Vektör karolarını worker çektiği için bu sıra ilk karoyu worker'ın
 * inme süresi kadar geciktiriyordu; zayıf bağlantıda saniyeler. Ön yüklemeyle
 * worker harita parçasıyla paralel iner.
 */
export function maplibreWorkerUrl(): string {
  return new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString();
}
