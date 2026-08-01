# Meteosat 15 dakikalık veri — kalan tek adım (İlyas)

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
