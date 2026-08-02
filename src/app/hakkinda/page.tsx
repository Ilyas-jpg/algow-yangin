/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hakkında — Algow Yangın",
  description:
    "Algow Yangın'ın veri kaynakları, güncellik sınırları ve yön tahmininin nasıl çalıştığı üzerine dürüst bir açıklama.",
};

export default function HakkindaPage() {
  return (
    <div className="min-h-dvh overflow-y-auto bg-obsidian-1">
      <div className="mx-auto max-w-[640px] px-5 py-10">
        <Link
          href="/"
          className="font-mono text-xs text-ink-3 transition-colors hover:text-ink"
        >
          ← Haritaya dön
        </Link>

        <h1 className="mt-6 text-2xl font-medium tracking-tight">
          Bu harita ne gösteriyor?
        </h1>
        <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-2">
          <p>
            Algow Yangın, Türkiye ve yakın çevresindeki aktif yangınları uydu
            verisiyle izleyen, rüzgâra göre olası yayılma yönünü gösteren
            ücretsiz bir platformdur. Amacı basit: herkesin, teknik bilgiye
            ihtiyaç duymadan, yangınların nerede olduğunu ve hangi yöne doğru
            ilerleyebileceğini tek bakışta anlayabilmesi. Toplum ve doğa
            yararına geliştirildi; reklam içermez, veri satmaz.
          </p>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            Veri nereden geliyor?
          </h2>
          <p>
            Yangın tespitleri NASA&apos;nın FIRMS sistemi üzerinden VIIRS ve
            MODIS uydu sensörlerinden alınır. Bu uydular her bölgeyi günde
            birkaç kez tarar; bir tespit, uydunun o anda gördüğü ısı
            anomalisidir. Bu yüzden harita bir güvenlik kamerası gibi anlık
            değildir: tespitler uydunun geçiş saatine bağlı olarak bir ile dört
            saat gecikmeyle düşer. Üstteki &quot;son tespit&quot; rozeti tam da
            bu dürüstlük için var — verinin ne kadar taze olduğunu her an
            görürsün. Küçük veya bulut altında kalan yangınlar hiç
            görünmeyebilir; bir noktanın haritada olmaması, orada yangın
            olmadığını garanti etmez.
          </p>
          <p>
            Bu boşluğu kısmen kapatmak için ikinci bir kaynak daha kullanıyoruz:
            Avrupa&apos;nın hava uydusu <b>Meteosat</b>. Bu uydu dünyayla
            birlikte döndüğü için Türkiye&apos;yi sürekli görüyor ve{" "}
            <b>on beş dakikada bir</b> tarıyor; veri bize yaklaşık yarım saat
            içinde ulaşıyor. Bedeli çözünürlük: 36 bin kilometreden bakıldığı
            için tek bir piksel ülkemiz üzerinde on beş ila yirmi beş
            kilometrekarelik bir alana denk geliyor. Bu yüzden Meteosat
            tespitlerini nokta olarak değil, o pikselin gerçek büyüklüğünü
            gösteren turuncu bir halka olarak çiziyoruz — yangın o halkanın
            içinde bir yerdedir, tam merkezinde değil. Küçük yangınları da
            göremez. Kısacası Meteosat, hassas uyduların yerini almaz;
            aralarındaki kör saatleri doldurur.
          </p>
          <p>
            Rüzgâr, nem, sıcaklık ve buhar basıncı açığı (VPD) değerleri
            Open-Meteo&apos;nun açık hava tahmin modellerinden gelir. Haritada
            akan partiküller o anki rüzgâr alanını gösterir; bir yangına
            tıkladığında açılan panel, o bölgenin yangın meteorolojisini
            özetler. Aynı panelde yakıtın ne kadar kurumuş olduğunu anlatan
            Yangın Hava İndeksi, dumanın havadaki izini gösteren partikül
            ölçümü ve alevlerin tırmanabileceği yamaç bilgisi de yer alır.
          </p>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            Haritadaki her nokta yangın değildir
          </h2>
          <p>
            Bunu açıkça söylemek gerekiyor: uydu alev görmez, <b>ısı görür</b>.
            Sensör, yeryüzünde çevresinden belirgin biçimde sıcak olan her
            noktayı işaretler. Orman yangını bunların en dikkat çekeni, ama tek
            kaynağı değil. Rafineri ve petrokimya tesislerinin bacaları,
            doğal gaz yakma alevleri, termik santraller, demir-çelik ve çimento
            fabrikaları, çöp yakma tesisleri gündüz gece aynı noktada
            görünmeye devam eder. Hasat sonrası tarlada yakılan anız da,
            özellikle temmuz ve ağustos aylarında, haritayı küçük noktalarla
            doldurur. Zaman kaydırıcısını geri sardığında bir nokta her gün
            aynı yerde ve aynı şiddette beliriyorsa, orada büyük ihtimalle bir
            yangın değil sabit bir ısı kaynağı vardır.
          </p>
          <p>
            Ters yönde hatalar da olur. Bulut altında kalan, ağaç örtüsünün
            altında ilerleyen veya uydu geçişleri arasına denk gelen yangınlar
            hiç görünmeyebilir. Sensör düşük çözünürlükte çalıştığı için
            konumda birkaç yüz metrelik sapma normaldir; bir tespitin
            merkezindeki nokta, alevin tam yerini değil o pikselin merkezini
            gösterir. Sıcak çıplak kayalık ve güneş yansıması gibi durumlar da
            zaman zaman yanlış tespite yol açar.
          </p>
          <p>
            Kısacası bu harita bir <b>ipucu ve durum farkındalığı aracıdır</b>;
            sahadaki gözlemin, resmi açıklamaların ve orman teşkilatının
            yerine geçmez. Bir noktanın burada görünmesi orada yangın olduğunu
            kanıtlamaz, görünmemesi de olmadığını göstermez.
          </p>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            Yön tahmini nasıl çalışıyor, neyi vaat etmiyor?
          </h2>
          <p>
            Bir yangının etrafındaki mavi koni, son uydu geçişindeki öncü
            kenardan başlayarak olası yayılma yönünü ve kaba bir hızla bir, üç
            ve altı saatlik erişimi gösterir. Yön, <b>rüzgâr ile arazi eğiminin
            bileşkesinden</b> hesaplanır (Rothermel rüzgâr ve eğim katsayılarının
            vektör toplamı; yakıt Akdeniz makisi kabul edilir). Düz arazide eğim
            terimi kendiliğinden sıfıra yaklaşır, dik yamaçta ise koniyi yokuş
            yukarı çeker. Yakıt nemi ve söndürme müdahalesi hesaba katılmaz.
          </p>
          <p>
            Bu konunun dürüst olmayı en çok hak eden kısmı şu: kendi verimizle
            geriye dönük bir sınama yaptık. <b>Altı yangın sezonu</b>{" "}
            (2021–2026), <b>468 bin uydu tespiti</b>, orman ve makilik alanda{" "}
            <b>79 yangına ait 232 ölçülebilir ilerleme</b>. Her birinde bir
            geçiş anındaki tahmini, yangının bir sonraki geçişte gerçekte hangi
            yöne büyüdüğüyle karşılaştırdık.
          </p>
          <p>
            Sonuç: tahmin rastgeleden <b>iyi, ama kesin değil</b>. Ortanca açı
            hatası <b>68°</b> (rastgele beklenti 90°); tahminlerin{" "}
            <b>%33&apos;ü</b> 45° içinde isabet ediyor (rastgelede %25),{" "}
            <b>%16&apos;sı</b> tamamen ters yönü gösteriyor (rastgelede %25).
            Daha önce bu sayfada yirmi üç örneğe dayanarak &quot;rastgeleden
            iyi değil&quot; yazıyorduk;{" "}
            <b>o örneklem yanılmamıza yetecek kadar küçükmüş</b> — düzelttik.
            Eğimi hesaba katmak dik arazide (%15 üzeri) en kötü hatayı
            belirgin biçimde azaltıyor: tamamen ters tahmin oranı{" "}
            <b>%22&apos;den %11&apos;e</b> iniyor.
          </p>
          <p>
            Koninin <i>boyutunu</i> da ilk kez ölçtük ve burada ciddi biçimde
            yanılıyormuşuz. Eski halkalar hiçbir ölçüme dayanmıyordu ve
            gerçeğin <b>birkaç katıydı</b> — 3 saatlik halkayı 7,6 km
            çiziyorduk, oysa ölçülen yangınlar aynı sürede kendi kenarından çok
            daha az ilerliyordu. Halkalar ölçüme göre küçültüldü ve artık net,
            sınanabilir bir anlamı var:{" "}
            <b>&quot;yangınların onda dokuzunda en uzağa ilerleyen nokta bile bu
            sınırın içinde kaldı&quot;</b>. Bu oranı, modelin hiç görmediği
            sezonlarda ayrıca sınadık — her sezonu sırayla dışarıda bırakıp
            kalanlarla ayarladık ve dışarıdakinde ölçtük; ortalama{" "}
            <b>%90</b> çıktı. İlk denemede %81&apos;de kalmıştı, halkaları
            buna göre büyüttük. Aynı şekilde koninin açısı da 15–30° ile fazla dar
            ve fazla iddialıydı; gözlenen sapmaların yalnız %30&apos;unu
            kapsıyordu. Artık açı da ölçülen dağılımdan geliyor — rüzgâr
            zayıfken yön neredeyse belirsiz olduğu için koni genişliyor,{" "}
            <b>çok belirsizse kama yerine daire</b> çiziliyor: sahip olmadığımız
            bir kesinliği ima etmemek için.
          </p>
          <p>
            Tavanı da ölçtük: iki geçiş arasındaki <i>gerçek</i>{" "}
            ortalama rüzgâr
            önceden bilinseydi bile ortanca hata ancak 64°&apos;ye inerdi. Yani
            kalan hata rüzgâr tahmininden değil, <b>söndürme müdahalesinden,
            arazi ve yakıt ayrıntısından</b> geliyor — hiçbir koni bu belirsizliği
            kapatamaz. Bir bulgu daha: yangının <b>bir önceki geçişte gözlenen
            yönü, sonraki adımın kötü bir habercisi</b> (ortanca hata 99°,
            rastgeleden kötü) — çünkü ilerleyen baş söndürülünce yangın yanlarda
            ve geride yanmaya devam ediyor. Bu yüzden beyaz izi ileri doğru
            uzatmıyoruz.
          </p>
          <p>
            Bu yüzden koniyi bir kehanet gibi değil, <b>&quot;rüzgâr ve arazi
            şu anda bu yöne işaret ediyor&quot;</b> bilgisi olarak sunuyoruz.
            Yangının son
            saatlerde gerçekte nereye ilerlediğini gösteren beyaz iz ise
            gözleme dayanır ve daha güvenilirdir; ikisi ayrıştığında{" "}
            <b>gözlenen yönü esas alın</b>. Koni hiçbir koşulda tahliye kararı
            aracı değildir.
          </p>

          <div className="rounded-md border border-danger/40 bg-danger/10 p-4 text-ink">
            <p className="leading-relaxed">
              Bu site resmi bir uyarı sistemi değildir. Yangın görürseniz veya
              tehlike altındaysanız vakit kaybetmeden arayın:
            </p>
            <p className="mt-2 font-mono text-xl">
              112 <span className="text-sm text-ink-2">Acil Çağrı</span>
              <span className="mx-3 text-ink-3">·</span>
              177 <span className="text-sm text-ink-2">Orman Yangını İhbar</span>
            </p>
          </div>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            Konumun ve gizliliğin
          </h2>
          <p>
            Üst bardaki &quot;Konumum&quot; düğmesiyle kendini haritada
            görebilir, sana en yakın yangının kaç kilometre ötede ve hangi yönde
            olduğunu okuyabilirsin. Konum bilgin yalnızca kendi cihazında
            işlenir; bize veya başka bir sunucuya gönderilmez, saklanmaz.
            İstediğin an aynı düğmeyle kapatabilirsin. Site ziyaretçi takibi
            yapmaz, çerez kullanmaz, reklam içermez.
          </p>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            Açık kaynak
          </h2>
          <p>
            Bu platformun kaynak kodu{" "}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line underline-offset-2 hover:text-ink"
            >
              AGPL-3.0
            </a>{" "}
            ile açıktır. İnceleyebilir, çalıştırabilir, üzerine yeni özellikler
            ekleyebilirsiniz; bunu isteriz. Tek koşul şu: geliştirdiğiniz sürümü
            başkalarının kullanımına açarsanız onun kaynağını da açık
            bırakmanız gerekir. Böylece proje herkesin elinde kalır, kimse
            kapalı bir kopyasını çıkaramaz. Algow adı ve görsel kimliği bu
            lisansın dışındadır; kendi sürümünüze kendi adınızı verin.
          </p>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            Güncelleme notları
          </h2>
          <p className="text-sm">
            Neyi ne zaman değiştirdiğimizi burada açıkça yazıyoruz — özellikle
            de kendi hatamızı düzelttiğimizde.
          </p>

          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-ink">2 Ağustos 2026 — denetim</p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    Kendi iddiamızı sınadık ve yanlış çıktı; düzelttik.
                  </b>{" "}
                  Halkaların &quot;%90&quot; eşiğini, ölçtüğümüz aynı veriyle
                  ayarlamıştık — yani iddia kendi kendini doğruluyordu. Her
                  sezonu sırayla dışarıda bırakıp sınayınca, halkanın yangının
                  en uzak noktasını yalnız <b className="font-medium">%81</b>{" "}
                  oranında kapsadığı görüldü. Halkalar büyütüldü; yeni ayarda
                  modelin görmediği sezonlarda kapsama{" "}
                  <b className="font-medium">%90</b>.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">2 Ağustos 2026 — harita turu</p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">Topoğrafya eklendi.</b>{" "}
                  &quot;Arazi&quot; düğmesi tepe gölgelemesini açıyor: vadiler,
                  sırtlar ve yamaç yönleri görünüyor. Yangın davranışının yarısı
                  arazi olduğu için bu, koninin neden o tarafa eğildiğini de
                  okunur kılıyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Uydu altlığı yenilendi ve bir de günlük görüntü geldi.
                  </b>{" "}
                  Önceki altlık yıllar öncesine ait olabilen bir mozaikti.
                  Yerine <b className="font-medium">Sentinel-2 cloudless</b>{" "}
                  (10 m, bulutsuz) geldi. Ayrıca{" "}
                  <b className="font-medium">&quot;Bugün&quot;</b> düğmesi NASA
                  GIBS günlük gerçek renk görüntüsünü açıyor — çözünürlüğü kaba
                  (250 m) ama tarihi bugün, yani büyük yangınların dumanı
                  görülebiliyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Çift yazılan şehir adları düzeltildi.
                  </b>{" "}
                  Etiketleri erken zoom&apos;da göstermek için yaptığımız ayar,
                  birbirini dışlaması gereken şehir katmanlarını aynı anda
                  açıyordu; aynı şehir iki kez yazılıyordu.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">2 Ağustos 2026 — ikinci tur</p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    Erişim şekli ölçüldü: artık damla, daire değil.
                  </b>{" "}
                  &quot;Tahmin edilen yönden şu kadar sapan yönlerde yangın ne
                  kadar ilerledi?&quot; sorusunu ölçtük. Yangınlar baş yönüne
                  doğru geriye göre <b className="font-medium">2,4 kat</b> uzağa
                  gidiyor. Simetrik daire bu bilgiyi çöpe atıyordu; şekil artık
                  ölçülen zarfı çiziyor ve ucundaki okla nereye eğildiği
                  okunuyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Halkalar saatlik tahmin rüzgârıyla çiziliyor.
                  </b>{" "}
                  Önceden &quot;mevcut rüzgâr altı saat sabit kalır&quot;
                  varsayılıyordu. Artık her halka kendi saatinin rüzgârını
                  kullanıyor; rüzgâr dönüyorsa uzak halkalar buna göre bükülüyor
                  ve panelde kaç derece döndüğü yazıyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Arazi örtüsü gösteriliyor.
                  </b>{" "}
                  Seçilen yangının CORINE arazi sınıfı yazılıyor. Özellikle
                  güneydoğuda listenin büyük kısmı tarımsal anız yakma;
                  bunlar artık &quot;orman yangını değil&quot; diye
                  işaretleniyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Uydu kör aralığı uyarısı.
                  </b>{" "}
                  Geçiş pencereleri verinin kendisinden ölçülüyor. Kör aralıkta
                  isek üst barda ve panelde yazıyor:{" "}
                  <i>tespit gelmemesi yangının söndüğü anlamına gelmez</i>.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">2 Ağustos 2026</p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    Koninin boyutu ölçülüp küçültüldü.
                  </b>{" "}
                  Halkaların yarıçapı bugüne kadar hiçbir ölçüme dayanmıyordu
                  ve gerçeğin <b className="font-medium">8–12 katıydı</b>. Altı
                  sezonluk veriyle ölçtük: 3 saatlik halkayı 7,6 km çiziyorduk,
                  yangınların %90&apos;ı aynı sürede kendi kenarından 2,5
                  km&apos;den az ilerlemişti. Halkalar bu ölçüme çekildi.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Koninin açısı gerçek belirsizliği yansıtıyor.
                  </b>{" "}
                  Eski 15–30°&apos;lik dar kama, gözlenen sapmaların yalnız
                  %30&apos;unu kapsıyordu. Açı artık ölçülen dağılımdan geliyor;
                  rüzgâr zayıfken yön neredeyse belirsiz olduğu için{" "}
                  <b className="font-medium">kama yerine daire</b> çiziliyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Yön tahminine arazi eğimi eklendi.
                  </b>{" "}
                  Yön artık rüzgâr ve eğimin bileşkesi. Dik arazide tamamen
                  ters tahmin oranı %22&apos;den %11&apos;e indi.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Doğrulama yenilendi, eski hükmümüz düzeltildi.
                  </b>{" "}
                  Bu sayfa yirmi üç örneğe dayanarak &quot;tahmin rastgeleden
                  iyi değil&quot; diyordu. Altı sezon ve 468 bin tespitle
                  tekrarlayınca bunun küçük örneklem yanılgısı olduğu görüldü.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">1 Ağustos 2026</p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  Meteosat 15 dakikalık katman eklendi; kör aralık 5 saatten
                  ~35 dakikaya indi.
                </li>
                <li>
                  Yangın hava indeksi (FWI), duman (PM2.5), arazi eğimi, yanan
                  alan ve tehlike katmanları eklendi.
                </li>
                <li>
                  Yakınımda yangın uyarısı eklendi — kayıtlı yerler cihazdan
                  çıkmaz.
                </li>
                <li>Platform yayına alındı; kaynak kodu açıldı.</li>
              </ul>
            </div>
          </div>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            Atıflar
          </h2>
          <p className="text-sm">
            Yangın verisi: NASA FIRMS (Fire Information for Resource Management
            System), VIIRS ve MODIS ürünleri. Hava verisi:{" "}
            <a
              href="https://open-meteo.com/"
              className="underline decoration-line underline-offset-2 hover:text-ink"
              rel="noreferrer"
              target="_blank"
            >
              Open-Meteo
            </a>{" "}
            (CC BY 4.0). Harita altlığı: ©{" "}
            <a
              href="https://carto.com/attributions"
              className="underline decoration-line underline-offset-2 hover:text-ink"
              rel="noreferrer"
              target="_blank"
            >
              CARTO
            </a>{" "}
            · ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              className="underline decoration-line underline-offset-2 hover:text-ink"
              rel="noreferrer"
              target="_blank"
            >
              OpenStreetMap
            </a>{" "}
            katkıda bulunanları. Uydu görüntüsü: <b>Sentinel-2 cloudless</b> (EOX
            IT Services, değiştirilmiş Copernicus Sentinel verisi içerir).
            Günlük görüntü: <b>NASA EOSDIS GIBS</b>, VIIRS/NOAA-20 gerçek renk.
            Arazi yüksekliği: Mapzen/AWS Terrain Tiles (SRTM, ASTER). NASA, bu
            platformun içeriğini onaylamış veya desteklemiş değildir; veri
            olduğu gibi sunulur.
          </p>
        </div>

        <footer className="mt-10 border-t border-line pt-5">
          <a
            href="https://algow.net"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2.5"
          >
            <img
              src="/brand/algow-wordmark.webp"
              alt="Algow"
              className="h-[15px] w-auto"
            />
          </a>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            Bu platform Algow tarafından toplum ve doğa yararına geliştirildi
            ve ücretsiz sunuluyor.
          </p>
        </footer>
      </div>
    </div>
  );
}
