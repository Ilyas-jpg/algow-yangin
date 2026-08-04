# §6.3 WindNinja — değerlendirme (2026-08-04)

Spec: *"WindNinja ile aynı 232 örneği yeniden skorla. 64° tavanının ne kadarı
arazi detayıymış, ölçmüş olursun; kazanç varsa canlıya al."*

## Durum: YAPILMADI — kurulum kararı İlyas'ın

`WindNinja_cli` bu makinede kurulu değil (`C:\Program Files\WindNinja` yok).
Çalıştırmak için firelab.org'dan Windows kurulum paketi indirip kurmak
gerekiyor. **Üçüncü taraf ikili indirip kurmayı kendi başıma yapmıyorum** —
bu kararı vermek İlyas'a ait. Kurulursa sürücü betiği yazılır: her vaka için
10×10 km DEM alanı + tek WindNinja koşusu, 232 vaka birkaç dakika sürer.

## Ama kazanç beklentisi ölçümle daraltılabilir

Bu turda çıkan sayılar WindNinja'nın ne kadar yer bulabileceğini sınırlıyor:

| ölçüm | sonuç | ne söylüyor |
|---|---|---|
| ORACLE (aralığın gerçek ortalama ERA5 rüzgârı) | 63–68° (fizik 67–73°) | **ZAMANLAMA** düzeltmesinin tavanı ~5° |
| eğimin toplam katkısı (2026-08-02 + bağımsız tekrar) | 3° (81,4 → 78,1) | arazinin BİRİNCİ derece etkisi bu kadar |
| eğim ağırlığı k'nın olay-bazlı çapraz doğrulaması | katlar arası 35 / 8 / 0,5 diye zıplıyor | veri, uydurulmuş arazi parametresini **desteklemiyor** |

⚠️ ORACLE tavanı WindNinja'yı **bağlamaz**: o da aynı kaba ERA5 ızgarasını
kullanıyor, yalnız zamanlaması kusursuz. WindNinja'nın hedefi uzaysal detay
(vadi kanalizasyonu, sırt hızlanması) ve bu ORACLE'da hiç yok. Yani teorik
olarak 63°'nin altına inebilir.

**Ama** üçüncü satır asıl uyarı: 232 vaka / 78 olayla eğimin TEK parametresi
bile kararlı fit edilemiyor. Vadi kanalizasyonu ondan daha ince bir etki;
bu örneklemde ölçülse bile ölçüm gürültüden ayrışmayacak. Ek olarak koninin
yön hatası ~70° iken 3-5°'lik bir kazanç kullanıcı için görünmez.

## Öneri: şimdi değil, korpus büyüyünce

Sıra spec'in kendi mantığına uyuyor — §7.2 pan-Akdeniz eğitim seti (2018-2026,
TR+GR+ES+PT+IT+HR) örneklemi binlere çıkarıyor. WindNinja'yı orada denemek
anlamlı; bugün denemek "ölçtük, ayrışmadı" sonucundan öteye gitmez ve o
sonucu şimdiden biliyoruz.

Kapı açık kalıyor: kurulum yapılırsa bu dosyanın yanına `21-windninja.mjs`
sürücüsü yazılır, aynı `cases-cephe.json` üzerinden aynı protokolle skorlanır
(sezon-dışı + olay-bazlı bootstrap).
