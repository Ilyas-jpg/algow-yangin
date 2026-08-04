"use client";

/* eslint-disable @next/next/no-img-element */

/**
 * SADE GÖRÜNÜMÜN MARKA KATMANI — sol altta wordmark + haritayı kaplayan
 * çok soluk filigran.
 *
 * İlyas 2026-08-04: *"sade görünümde de sol altta falan algow logosu olsun ve
 * ekran görüntüsü alınca hafif bir algow filigranı olsun ekranı kaplayan ki
 * çalıp çırpıp parayla satılamasın ama sadece ekran görüntülerinde olsun
 * mümkünse"*.
 *
 * 🔴 "YALNIZ EKRAN GÖRÜNTÜSÜNDE" TARAYICIDA MÜMKÜN DEĞİL. İşletim sistemi
 * düzeyinde alınan bir ekran görüntüsünü (PrintScreen, Snipping Tool, telefonun
 * kendi kısayolu) web sayfası GÖREMEZ — böyle bir tarayıcı API'si yok ve
 * olmaması bilinçli bir gizlilik kararı. Bu yüzden filigran, ekran
 * görüntüsünün alındığı MODA bağlandı: sade görünüm zaten "haritayı tek başına
 * göster" modu, yani pratikte ekran görüntüsü modu. Normal görünümde filigran
 * yok, harita hiç kirlenmiyor.
 * (Filigranın gerçekten yalnız görüntüde olması isteniyorsa yolu ayrı: haritayı
 * canvas'a çizip filigranı basan bir "görüntüyü indir" düğmesi. MapLibre'de
 * `preserveDrawingBuffer` gerektiriyor ve FPS'e bedeli var, ölçülmeden
 * açılmamalı — bu yüzden şimdilik yapılmadı.)
 *
 * Opaklık bilinçli olarak ÇOK düşük (0,05): amaç haritayı okunmaz yapmak değil,
 * alıntılandığında kaynağın görünmesi. Koyu harita üstünde beyaz metin bu
 * opaklıkta ekranda zar zor, ekran görüntüsü büyütülünce net okunuyor.
 */
export default function Filigran() {
  return (
    <>
      {/* Tam ekranı kaplayan eğik tekrarlı yazı. Data-URI yerine INLINE SVG:
          CSP `img-src`'de data: açık olsa da inline SVG hiçbir izne muhtaç
          değil ve kaynak metni HTML'de kalıyor (kopyalanan sayfada da görünür). */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[15] h-full w-full select-none"
      >
        <defs>
          <pattern
            id="algow-filigran"
            width="300"
            height="170"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-28)"
          >
            <text
              x="0"
              y="24"
              fill="#ffffff"
              fillOpacity="0.05"
              fontSize="15"
              fontFamily="var(--font-inter), system-ui, sans-serif"
              letterSpacing="1.5"
            >
              yangin.algow.net
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#algow-filigran)" />
      </svg>

      {/* Sol altta wordmark: sade görünümde üst şerit kapalı olduğu için
          markanın tek göründüğü yer burası. Harita atıf şeridi sağ altta
          (lisans şartı, gizlenemez) — bu yüzden sol alt seçildi.
          bottom-16: zaman çizgisi bottom-4'te ve 40 px yüksek. */}
      <div className="pointer-events-none absolute bottom-16 left-4 z-[16] flex items-center gap-2 select-none">
        <img
          src="/brand/algow-wordmark.webp"
          alt="Algow"
          className="h-[15px] w-auto opacity-70"
          draggable={false}
        />
        <span className="h-3 w-px bg-line" aria-hidden />
        <span className="font-mono text-[10px] text-ink-3">yangin.algow.net</span>
      </div>
    </>
  );
}
