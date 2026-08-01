# Algow Yangın

Türkiye ve yakın çevresi için canlı yangın izleme ve rüzgâra dayalı yön tahmini
haritası. NASA FIRMS uydu tespitleri + Open-Meteo rüzgâr/yangın meteorolojisi,
MapLibre üzerinde. Toplum ve doğa yararına, ücretsiz.

Canlı: **https://yangin.algow.net**

## Ne yapar

Uydu tespitlerini yangın olaylarına kümeler, her olayın uydu geçişleri boyunca
**geçmiş ilerleyişini** çizer (zaman kaydırıcısıyla oynatılabilir) ve son
geçişin öncü kenarından başlayarak rüzgâra göre **1/3/6 saatlik tahmini
yönelim konisi** üretir. Gözlenen ilerleme ile rüzgâr tahminini yan yana
koyar: ikisi ayrışıyorsa rüzgârın döndüğünü söyler.

Tahmin konisi bilimsel bir yangın davranış modeli **değildir** — arazi eğimi,
yakıt tipi ve söndürme müdahalesi hesaba katılmaz. Arayüz bunu her yerde
belirtir ve acil durumda 112 / 177'ye yönlendirir.

## Saha koşulları için tasarım

Hedef kullanıcı kırsalda, zayıf veya kesintili bağlantıdaki ekipler:

- **Service Worker** uygulamayı, harita karolarını ve son veriyi cihazda tutar;
  ikinci açılış ağa hiç çıkmadan gelir.
- **Çevrimdışıyken** son bilinen veri gösterilir, üstte uyarı bandı çıkar.
- **Yavaş bağlantı algılanırsa** (2G/3G veya veri tasarrufu) rüzgâr animasyonu
  ve ısı katmanı kapalı başlar.
- Telefona **uygulama olarak kurulabilir** (PWA).

## Çalıştırma

```bash
npm install
npm run dev
```

`FIRMS_MAP_KEY` tanımlı değilse uygulama gerçekçi **demo veriyle** açılır
(üst barda "Demo veri" rozeti). Gerçek veri için ücretsiz anahtar:
https://firms.modaps.eosdis.nasa.gov/api/map_key/ → `.env.local` içine:

```
FIRMS_MAP_KEY=...
```

## Mimari (özet)

- `src/app/api/fires` — FIRMS area CSV (4 uydu kaynağı) → GeoJSON; 10 dk cache
- `src/app/api/wind/grid` — Open-Meteo 0.5° TR gridi (u/v, m/s); 3 sa cache
- `src/app/api/wind/point` — nokta yangın meteorolojisi (rüzgâr/hamle/nem/sıcaklık/VPD)
- `src/lib/cluster.ts` — olay kümeleme + uydu geçişi grupları + sürüklenme vektörü
- `src/lib/wind.ts` — grid örnekleme, yayılma hızı heuristiği, tahmin konisi
- `src/components/FireMap.tsx` — MapLibre katmanları
- `src/components/WindParticles.ts` — rüzgâr akış animasyonu
- `public/sw.js` — çevrimdışı önbellek stratejileri

> **Not:** `maplibre-gl` sürümü **5.x**'te sabittir. 6.0 sürümünde harita
> sessizce boş kalıyor (karo isteği hiç yapılmıyor, `load` olayı ateşlenmiyor).

## Lisans

[AGPL-3.0](LICENSE). Kodu geliştirebilir ve dağıtabilirsiniz; değiştirilmiş bir
sürümü ağ üzerinden servis ederseniz kaynağını da açmanız gerekir.

**Algow markası ve `public/brand/` içeriği bu lisansın kapsamı dışındadır** —
fork'unuza kendi adınızı ve görsel kimliğinizi verin. Ayrıntı: [NOTICE.md](NOTICE.md).
