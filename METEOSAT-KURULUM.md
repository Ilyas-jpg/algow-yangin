# Dış veri kaynakları — İlyas'ın kayıt açması gereken adımlar

> Üçü de ücretsiz. Kod tarafı hazır ya da hazırlanabilir; tek engel hesap
> açma işlemi (bana kapalı).

| Kaynak | Ne katar | Süre | Durum |
|---|---|---|---|
| **EUMETSAT LSA SAF** | Kör aralık 5 sa → **15 dk** | 2 dk | ⏳ aşağıda |
| **Earth Fire Alliance (FireSat)** | 2027'de "Fire Progression" API'si | 30 dk | ⏳ aşağıda |
| **Google Earth Engine** | Tarihsel arşiv + yakıt haritası | 10 dk | ⏳ aşağıda |

---

# 1) Meteosat 15 dakikalık veri — en yüksek etkili adım

Bu entegrasyon platformdaki **en büyük tek iyileştirme**: uydu kör aralığını
5 saatten **15 dakikaya** indirir. Veri ücretsiz (CC BY 4.0) ve sunucu açık —
tek engel hesap.

## Neden ben yapamadım

`https://datalsasaf.lsasvcs.ipma.pt/` dizin listelemesi herkese açık ama
**dosya indirme HTTP 401 istiyor.** Hesap açmak bana kapalı bir işlem; bu
adımı senin yapman gerekiyor.

## Yapılacak (2 dakika)

1. https://mokey.lsasvcs.ipma.pt/auth/signup adresinden ücretsiz kayıt ol
   (EUMETSAT LSA SAF veri erişimi).
2. E-posta doğrulamasını tamamla.
3. Kullanıcı adı + parolayı bana ver — `.env.local` ve Vercel ortam
   değişkenlerine `LSASAF_USER` / `LSASAF_PASS` olarak koyup entegrasyonu
   bitireyim.

## Doğrulanmış teknik bilgiler (araştırma + canlı test)

| | |
|---|---|
| Sunucu | `https://datalsasaf.lsasvcs.ipma.pt/PRODUCTS/MSG/FRP-PIXEL/HDF5/YYYY/MM/DD/` |
| Dosya adı | `HDF5_LSASAF_MSG_FRP-PIXEL-ListProduct_MSG-Disk_YYYYMMDDhhmm` |
| Sıklık | **15 dakika** (0000, 0015, 0030, 0045…) |
| **Ölçülen gecikme** | **~37 dakika** (test anında son dosya 08:45, saat 09:22'ydi) |
| Format | HDF5 — Node tarafında `h5wasm` ile okunabilir |
| İki ürün | `ListProduct` (yalnız yangın pikselleri, küçük) · `QualityProduct` (tüm pikseller) → **bize ListProduct lazım** |
| Lisans | CC BY 4.0 — atıfla ücretsiz, ticari kullanım dahil |

## Dürüst kısıt (kullanıcıya da söylenecek)

Meteosat 36 bin km'den bakıyor: çözünürlük nadirde 3 km, **Türkiye
enleminde ~3×5 km'ye genişliyor.** VIIRS'in 375 m'sinden çok daha kaba, yani
**küçük yangınları VIIRS'ten daha kötü görür.** Bunun yerine geçmez —
arasını doldurur. Arayüzde iki kaynak ayrı etiketlenmeli:
"VIIRS (hassas, 5 saatte bir)" / "Meteosat (kaba, 15 dakikada bir)".

## Sorulacak soru (opsiyonel, daha iyi geometri için)

`helpdesk.landsaf@ipma.pt` adresine: *"Meteosat-9 IODC (45,5°E) tabanlı
FRP-PIXEL ürünü Türkiye'yi kapsıyor mu, nasıl erişilir?"* — IODC uydusu
Türkiye boylamına neredeyse dik baktığı için piksel geometrisi belirgin
daha iyi olur.

---

# 2) Google Research Wildfires — ne alınabilir, ne alınamaz

İncelendi: https://sites.research.google/gr/wildfires/

## ❌ Doğrudan alınamayan: Boundary Tracking

Google'ın yangın sınırı ürünü **yalnızca Google Search ve Maps arayüzünde**
gösteriliyor; **geliştirici API'si yok**. Kazıma (scraping) hem kullanım
şartlarına aykırı hem de kırılgan olurdu — yapılmayacak.

**Beklenmedik bulgu — bizim için iyi haber:** Google'ın "10-15 dakikada bir
güncelleme" iddiası **geostasyoner uydu gördüğü bölgeler için** geçerli:
GOES-18/19 (Amerika), Himawari-9 ve GK2A (Avustralya/Asya). **Türkiye dahil
diğer bölgelerde Suomi-NPP ve NOAA-20 VIIRS kullanıyorlar** — yani bizim
kullandığımız kaynağın aynısı, aynı 5 saatlik kör aralıkla.
→ **LSA SAF Meteosat entegrasyonu tamamlandığında Türkiye'de Google'ın
kendi ürününden daha güncel olacağız.**

## ✅ Alınabilecek: FireSat (Earth Fire Alliance)

Google'ın desteklediği uydu takımyıldızı. İlk 3 operasyonel uydu Temmuz
2026'da yörüngede. **Ürünler 2027'de**, ve bizi ilgilendiren "Fire
Progression" tam olarak bu platformun yaptığı iş.

**Non-commercial katman ücretsiz** — açık kaynak (AGPL-3.0) ve kâr amacı
gütmeyen konumumuz uygun. Erken erişim kaydı **bugün açık**:
👉 https://earthfirealliance.org/data-access/

## ✅ Alınabilecek: Google Earth Engine

Araştırma, eğitim ve kâr amacı gütmeyen kullanımda **ücretsiz**.
Kayıt: https://earthengine.google.com/signup/

**Dürüst değerlendirme — bize ne katar, ne katmaz:**

| Katar | Katmaz |
|---|---|
| **Tarihsel arşiv**: 2021 Manavgat, 2025 sezonu gibi büyük yangınlarla tahmin modelimizi geriye dönük sınamak | Canlı yangın tespiti — FIRMS'i zaten doğrudan alıyoruz, EE aynı veriyi *daha geç* sunuyor |
| **Sentinel-2 yakıt/bitki örtüsü** haritası (CORINE'den güncel) | Yanan alan perimetresi — EFFIS'ten zaten alıyoruz, hazır ve ücretsiz |
| Yanma öncesi/sonrası **hasar analizi** (NBR) | Gerçek zamanlı hiçbir şey |

⚠️ **Teknik not:** Earth Engine sunucu tarafı hesaplama ister (service
account + Python/JS client). Vercel'in serverless yapısına doğrudan
oturmuyor; muhtemelen ayrı bir toplu-iş (batch) olarak, sonuçları statik
dosyaya yazacak şekilde kurulmalı. Yani **canlı platformun parçası değil,
analiz aracı** olur.

**Önceliğim:** Meteosat > FireSat kaydı > Earth Engine. İlk ikisi ürünü
doğrudan güçlendiriyor; Earth Engine ise tahmin modelini bilimsel olarak
doğrulamak istediğimizde değerli.
