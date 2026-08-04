/**
 * Harita karolarının geldiği hostlara erken el sıkışma.
 *
 * İlk karo isteği ancak MapLibre yüklenip stil çözüldükten sonra çıkıyor;
 * o ana kadar DNS + TLS bekleniyor. Trafiğin %87'si mobil ve hedef kitle
 * kırsalda zayıf bağlantıda — el sıkışmayı öne almak ilk karonun görünme
 * anını doğrudan öne çekiyor.
 *
 * `crossOrigin` şart: karolar CORS ile çekiliyor, anonim olmayan bağlantı
 * yeniden kurulur ve preconnect boşa gider.
 */
const HOSTLAR = [
  "https://basemaps.cartocdn.com", // temel harita stili + karolar
  "https://tiles.maps.eox.at", // Sentinel-2 cloudless ("Bugün" katmanı)
  "https://gibs.earthdata.nasa.gov", // NASA GIBS uydu görüntüsü
];

export default function Preconnect() {
  return (
    <>
      {HOSTLAR.map((h) => (
        <link key={h} rel="preconnect" href={h} crossOrigin="anonymous" />
      ))}
    </>
  );
}
