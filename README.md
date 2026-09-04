# Algow Yangın

Geliştiren: [İlyas Saltay](https://ilyassaltay.com) · Vaka sayfası: [ilyassaltay.com/isler/algow-yangin](https://ilyassaltay.com/isler/algow-yangin/)

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

### Kaç yangını görüyoruz (tespit tamlığı)

2026-08-06'da ilk kez ölçüldü ve **bağımsız bir referansla**: EFFIS'in uydu
görüntülerinden çıkardığı yanan alan haritaları (`modis.ba.poly.2025`). Yanık
izi ile aktif yangın farklı iki ölçümdür — iz, alevler yanarken hiçbir uydu
görmemiş olsa bile kalır — yani bu, kendi ölçütümüzle kendimizi doğrulamak
değildir.

2025 sezonu, Türkiye, EFFIS'in kaydettiği **351 yangın ≥30 ha**:

| büyüklük | recall |
|---|---|
| ≥1000 ha | **%100** (25/25) |
| 500–1000 ha | %90,9 |
| 100–500 ha | %79,8 |
| 30–100 ha | %77,8 |
| **≥30 ha genel** | **%80,9** |

Tarih toleransı verilince %86,3, zaman şartı hiç konmadığında %90,9 — aradaki
fark referansın tarih belirsizliğinden (yanık izi yangından *sonra* görüntüde
belirir), bizim körlüğümüzden değil. **30 ha altı için güvence yoktur**; EFFIS'in
kendi asgari haritalama sınırı olduğu için o sınıf bu ölçümün dışındadır.
Betikler: `36-recall-effis.mjs` · `37-recall-teshis.mjs` · `38-eksik-kaynaklar.mjs`
· `39-recall-uretim.mjs`.

### Denenip işe yaramayanlar

Bu depoda **negatif sonuçlar da kayıtlıdır** — hangi yolun neden kapandığı,
tekrar açılmasın diye yazılıdır:

| denenen | sonuç |
|---|---|
| yön tahmininde LightGBM (8 sezon, 2.874 vaka) | Türkiye holdout'unda Rothermel'i geçmedi |
| **"temiz alt kümede eğit"** | bir kapı geçer göründü, ama **alakasız bir plasebo kapı da aynı kazancı verdi** → gerçek değil |
| koniyi daraltmanın üç yolu (rüzgâra bağlı k · yeniden başlatma · büyüme modeli) | her biri ~%3, **toplanmıyorlar**, tavan ~%6 |
| **yakıt-koşullu halka** | orman ve maki zaten aynı k'yı istiyor; kazanç n=81 ot vakasından ve kapsamayı düşürüyor |
| WindNinja (arazi-uyarlı rüzgâr) | k'yı ayarlamak üretimdeki sabitten örneklem dışında **daha kötü** |
| MTG 10 dk ile ilerleme ölçümü | uzaysal kısıt: VIIRS 12 saatte vakaların %94,5'ini çözüyor, MTG 10 dk'da %0 |
| **Landsat'ı ikinci doğrulama kaynağı yapmak** | FIRMS `LANDSAT_NRT` **yalnız Kuzey Amerika**'yı kapsıyor (TR/İber/Yunanistan 0 satır) |
| daha yüksek çözünürlüklü rüzgâr (ICON-EU 7 km) | ERA5 25 km ile aynı sonucu veriyor |

Ölçüm betikleri `scratchpad/isabet/` altındadır (`29-kapsama-akdeniz.mjs`
kapsama sınaması, `28-model.py` model, `42`/`43` temiz alt küme + sağlamlık).

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

- `src/app/api/fires` — FIRMS area CSV (VIIRS SNPP/NOAA-20/NOAA-21 + MODIS,
  hepsi NRT) → GeoJSON; yanıt 4 dk cache
- `src/app/api/wind/grid` — Open-Meteo 0.5° TR gridi (u/v, m/s); upstream 20 dk,
  yanıt 15 dk cache
- `src/app/api/wind/point` — nokta yangın meteorolojisi (rüzgâr/hamle/nem/sıcaklık/VPD)
- `src/app/api/meteosat` — MTG/MSG 10 dakikalık ısı tespiti (LSA SAF); kör
  aralığı ~5 saatten ~35 dakikaya indirir
- `src/app/api/saglik` — platformun kendi çıktısını denetler (tazelik ·
  makullük · üst kaynak · doğrulama kuyruğu); 200 sağlıklı, 503 arıza
- `src/lib/cluster.ts` — olay kümeleme + uydu geçişi grupları + sürüklenme vektörü
- `src/lib/wind.ts` — grid örnekleme, yayılma hızı heuristiği, tahmin konisi
- `src/lib/progression.ts` — iki geçiş arasında yangının gerçekte nereye taştığı
  (yön modelinin etiketi; ölçüm ve üretim aynı tanımı paylaşır)
- `src/app/api/ml/cone` — çizilen koniyi özellikleriyle kaydeder (tahmin günlüğü)
- `src/app/api/ml/verify` — sonraki geçiş gelince tahmini gözlemle karşılaştırır
- `src/app/api/ml/ingest` · `label` · `enrich` — jeostasyoner ısı sinyallerini
  Supabase'e toplar, etiketler ve yakıt/sanayi özellikleriyle zenginleştirir
- `src/app/api/ml/export` — eğitim seti dışa aktarımı (CSV/JSON)
- `src/app/api/archive` — arşive programatik erişim (olay + geçiş + ham piksel)
- `src/components/FireMap.tsx` — MapLibre katmanları
- `src/components/WindParticles.ts` — rüzgâr akış animasyonu
- `public/sw.js` — çevrimdışı önbellek stratejileri

> **Not:** `maplibre-gl` sürümü **5.x**'te sabittir. 6.0 sürümünde harita
> sessizce boş kalıyor (karo isteği hiç yapılmıyor, `load` olayı ateşlenmiyor).

### Zamanlama

Veri toplayan uçları **Supabase `pg_cron` + `pg_net`** tetikler
(`supabase/migrations/0005_ml_cron.sql`); sır cron tanımına düz metin yazılmaz,
`vault.decrypted_secrets`'tan okunur.

Bu iş eskiden GitHub Actions'taydı ve **ölçüldü**: beklenen günlük 144
tetiklemenin yalnız ~20'si gerçekleşiyordu (`*/15` yazan iş günde 8 kez
koşuyordu). GitHub ücretsiz/private depolarda zamanlanmış işleri ağır şekilde
düşürüyor. `.github/workflows/ml-cron.yml`'de yalnız **saatlik sağlık
denetimi** kaldı — tek amacı arıza olunca insana e-posta göndermek, ve
pg_cron'un e-posta kanalı yok.

⚠️ `pg_net` ateşle-unut çalışır, HTTP durumunu kimse görmez. Taşınan uçlar bu
yüzden `/api/saglik` üzerinden izlenir: `cone` → `cone_forecast` tazeliği,
`verify` → doğrulama kuyruğunun birikmemesi.

## Lisans

[AGPL-3.0](LICENSE). Kodu geliştirebilir ve dağıtabilirsiniz; değiştirilmiş bir
sürümü ağ üzerinden servis ederseniz kaynağını da açmanız gerekir.

**Algow markası ve `public/brand/` içeriği bu lisansın kapsamı dışındadır** —
fork'unuza kendi adınızı ve görsel kimliğinizi verin. Ayrıntı: [NOTICE.md](NOTICE.md).
