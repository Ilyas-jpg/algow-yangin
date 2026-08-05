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

Koni, rüzgâr ile arazi eğimini Rothermel bileşkesiyle birleştirir ve CORINE
yakıt sınıfını kullanır; **söndürme müdahalesi hesaba katılmaz** — pratikte
kalan hatanın büyük kısmı oradan gelir. Koni bir tahliye kararı aracı
değildir; arayüz bunu her yerde belirtir ve acil durumda 112 / 177'ye
yönlendirir.

## Doğruluk — ölçülen, iddia edilen değil

Yayındaki tek nicel iddia şu: **yangının ilerlediği hücrelerin %90'ı çizilen
şeklin içinde kalır.** Bu iddia 2026-08-05'te sekiz sezonluk pan-Akdeniz
korpusunda (**2.383 vaka / 41.103 hücre**) yeniden sınandı:

| küme | hücre kapsaması |
|---|---|
| tümü | %90,4 |
| yalnız Türkiye | %89,1 |
| ayar yurt dışında seçilip Türkiye'de sınandığında | %89 |
| sezonlar teker teker dışarıda bırakıldığında (ortalama) | %90 |

Yön tahmininin dürüst rakamı: **ortanca hata ~80°**, gözlenen yönlerin
**%28'i ±45° içinde**. Rüzgâr zayıfken yön neredeyse belirsizdir, kuvvetli
rüzgârda belirginleşir — koninin yarım açısı bu yüzden rüzgâra bağlıdır.

Denenip **işe yaramayan**lar da kayıtlıdır: sekiz sezonluk veriyle eğitilen
LightGBM modeli yön tahmininde Rothermel'i Türkiye holdout'unda geçemedi;
koniyi daraltmak için üç ayrı yol denendi, üçü de ölçüm belirsizliğinin
altında kaldı ve üretime alınmadı. Ölçüm betikleri `scratchpad/isabet/`
altındadır (`29-kapsama-akdeniz.mjs` kapsama sınaması, `28-model.py` model).

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
- `src/lib/progression.ts` — iki geçiş arasında yangının gerçekte nereye taştığı
  (yön modelinin etiketi; ölçüm ve üretim aynı tanımı paylaşır)
- `src/app/api/ml/cone` — çizilen koniyi özellikleriyle kaydeder (tahmin günlüğü)
- `src/app/api/ml/verify` — sonraki geçiş gelince tahmini gözlemle karşılaştırır
- `src/app/api/ml/export` — eğitim seti dışa aktarımı (CSV/JSON)
- `src/app/api/archive` — arşive programatik erişim (olay + geçiş + ham piksel)
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
