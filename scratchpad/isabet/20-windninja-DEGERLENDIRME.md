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

---

# 🔴 KARAR (2026-08-05): KURULMAYACAK — şart sınandı, tutmadı

Aşağıdaki öneri *"korpus binlere çıkınca dene"* diyordu. **Korpus çıktı**
(232 → **2.403 vaka**, 78 → **938 olay**) ve belirleyici ölçüm tekrarlandı
(`32-windninja-karar.mjs`). Sonuç:

| ölçüm | 2026-08-04 (232 vaka) | 2026-08-05 (2.403 vaka) |
|---|---|---|
| eğimin toplam katkısı | 3,0° | **3,3°** (doğrulandı) |
| k'nın kat-arası oynaması | 35 / 8 / 0,5 → **70×** | 12,5 / 3 / 12,5 / 4,5 / 8,5 → **4,2×** |
| k eğrisinin toplam oynaması (k=0…32) | — | **5,7°** (k=2 ile 16 arası yalnız 1,1°) |

**① 10× veri gerçekten yardım etti** — k'nın kararsızlığı 70× → 4,2×'e indi.
Ama hâlâ kararlı değil ve asıl mesele bu bile değil.

**② Asıl bulgu: k'yı ayarlamak ÜRETİMDEKİ k=1'den DAHA KÖTÜ.** Aynı test
katlarında, örneklem dışında:

```
kat 1: ayarlı(k=12,5) 80,3°  ·  sabit(k=1) 73,5°   → sabit 6,8° İYİ
kat 2: ayarlı(k=3)    74,8°  ·  sabit(k=1) 75,1°   → ayarlı 0,3° iyi
kat 3: ayarlı(k=12,5) 78,0°  ·  sabit(k=1) 78,7°   → ayarlı 0,7° iyi
kat 4: ayarlı(k=4,5)  80,9°  ·  sabit(k=1) 80,7°   → sabit 0,2° iyi
kat 5: ayarlı(k=8,5)  81,9°  ·  sabit(k=1) 81,6°   → sabit 0,3° iyi
ORTALAMA  ayarlı 79,2°  ·  sabit k=1 77,9°  → ayarlamak 1,3° KÖTÜ
```

Hata eğrisi neredeyse düz olduğu için "en iyi k" her katta gürültüyü takip
ediyor ve o gürültü teste taşınmıyor. **Üretimdeki k=1 zaten doğru seçim.**

**③ Hüküm.** Eğim, birinci derece arazi etkisi, toplam 3,3° kazandırıyor ve
tek parametresi bile veriden kararlı çıkarılamıyor. WindNinja'nın modellediği
şey (vadi kanalizasyonu, sırt hızlanması) **eğimden daha ince** bir etki.
Eğimin kendisi bu örneklemde ancak bu kadar ayrışıyorsa, ondan incesi hiç
ayrışmaz. Üstelik yön hatası ~78° iken 2-3°'lik bir kazanç kullanıcı için
görünmez.

**Kurulum yapılmayacak. Kapı kapanmadı ama şartı değişti:** WindNinja ancak
girdi çözünürlüğü arttığında (MTG 10 dk ile 12 saatlik pencere yerine
dakikalık ilerleme) yeniden gündeme gelir — o zaman ölçtüğümüz şey artık
"12 saatte ortalama yön" değil, arazinin gerçekten şekillendirdiği kısa
ölçekli hareket olur.

---

## Öneri (2026-08-04, artık sınandı — yukarıya bak)

Sıra spec'in kendi mantığına uyuyor — §7.2 pan-Akdeniz eğitim seti (2018-2026,
TR+GR+ES+PT+IT+HR) örneklemi binlere çıkarıyor. WindNinja'yı orada denemek
anlamlı; bugün denemek "ölçtük, ayrışmadı" sonucundan öteye gitmez ve o
sonucu şimdiden biliyoruz.

Kapı açık kalıyor: kurulum yapılırsa bu dosyanın yanına `21-windninja.mjs`
sürücüsü yazılır, aynı `cases-cephe.json` üzerinden aynı protokolle skorlanır
(sezon-dışı + olay-bazlı bootstrap).
