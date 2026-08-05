/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import LangSwitch from "@/components/LangSwitch";
import { alternates } from "@/lib/i18n";
import { getDict } from "@/i18n";

const t = getDict("tr");

export const metadata: Metadata = {
  title: t.meta.aboutTitle,
  description: t.meta.aboutDescription,
  alternates: alternates("/hakkinda"),
};

export default function HakkindaPage() {
  return (
    <div className="min-h-dvh overflow-y-auto bg-obsidian-1">
      <div className="mx-auto max-w-[640px] px-5 py-10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="font-mono text-xs text-ink-3 transition-colors hover:text-ink"
          >
            {t.common.backToMap}
          </Link>
          <LangSwitch
            locale="tr"
            label={t.common.otherLang}
            title={t.common.otherLangTitle}
            className="ml-auto"
          />
        </div>

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
            <b>on dakikada bir</b> tarıyor; veri bize yaklaşık yarım saat içinde
            ulaşıyor. Ağustos 2026&apos;dan itibaren yeni nesil{" "}
            <b>Meteosat Üçüncü Nesil</b> ürününü kullanıyoruz: ölçtüğümüzde tek
            bir pikselin ülkemiz üzerindeki alanı{" "}
            <b>yaklaşık iki kilometrekare</b> çıktı. Önceki nesilde bu on beş
            ila yirmi beş kilometrekareydi; yani yangının yeri artık kabaca on
            kat daha kesin. Yine de bu bir nokta değil bir alan olduğu için
            tespitleri, pikselin gerçek büyüklüğünü gösteren turuncu bir halka
            olarak çiziyoruz — yangın o halkanın içinde bir yerdedir, tam
            merkezinde değil. Küçük yangınları hâlâ göremez. Kısacası Meteosat,
            hassas uyduların yerini almaz; aralarındaki kör saatleri doldurur.
            Yeni ürüne ulaşılamazsa kendiliğinden önceki nesle düşülür.
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

          <section
            aria-labelledby="anma"
            className="rounded-md border border-line bg-obsidian-2 p-5"
          >
            <div className="h-px w-10 bg-ok" />
            <h2
              id="anma"
              className="mt-4 text-lg font-medium tracking-tight text-ink"
            >
              Yeşil vatanı korurken şehit olanlar
            </h2>
            <p className="mt-3 leading-relaxed">
              <b className="font-medium text-ink">23 Temmuz 2025</b>, Eskişehir
              Seyitgazi. Yangına müdahale eden ekip, rüzgârın yön değiştirmesiyle
              alevlerin arasında kaldı.{" "}
              <b className="font-medium text-ink">
                Beş orman işçisi ve beş AKUT gönüllüsü
              </b>{" "}
              şehit oldu. O sezon Türkiye orman yangınlarında toplam{" "}
              <b className="font-medium text-ink">17 şehit</b>{" "}
              verildi; İzmir Ödemiş&apos;te, Bursa&apos;da, Osmaniye&apos;de de
              görevi başında şehit olanlar oldu.
            </p>
            <p className="mt-3 leading-relaxed">
              Herkesin kaçtığı yöne yürüyen insanlardı. Bir yangın hattında
              rüzgârın dönmesi saniyeler meselesidir ve geri dönüş yolunu bir
              anda kapatır; Seyitgazi&apos;de olan buydu. Şehitlerimizi saygı ve
              minnetle anıyoruz.
            </p>
            <p className="mt-3 leading-relaxed">
              Bu sitedeki koninin ölçtüğü tek şey{" "}
              <b className="font-medium text-ink">
                rüzgârın ateşi nereye taşıdığıdır
              </b>
              . Onu ne kadar dürüst ölçebildiğimizi, hangi koşulda
              yanıldığımızı bu sayfada açıkça yazmamızın sebebi burada:
              tahminin abartılması, sahada birinin yanlış yere güvenmesi
              demektir.
            </p>
            <p className="mt-3 leading-relaxed text-ink-3">
              Bu platform resmî bir operasyon aracı değildir ve sahadaki
              ekiplere ulaşmaz. Onların işini kolaylaştırdığı iddiasında
              değiliz. Yalnızca, bu ülkenin ormanlarını koruyanların ödediği
              bedeli bilerek çalışıyoruz.
            </p>
          </section>

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
              <p className="font-medium text-ink">
                5 Ağustos 2026 — &quot;onda dokuz&quot; iddiasını on kat veriyle
                yeniden sınadık; bu kez tuttu
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    Kapsama iddiası bağımsız olarak doğrulandı.
                  </b>{" "}
                  Sitede &quot;yangının ilerlediği hücrelerin onda dokuzu
                  çizdiğimiz şeklin içinde kalır&quot; diyoruz. Bu iddia bir kez
                  yanlış çıkmıştı (2 Ağustos notuna bakın), o yüzden yeniden
                  sınadık — ama bu sefer 232 Türkiye vakasıyla değil,{" "}
                  <b className="font-medium text-ink">
                    sekiz sezonluk Akdeniz havzasından 2.383 vaka ve 41.103
                    hücreyle
                  </b>
                  . Sonuç: tümünde %90,4, yalnız Türkiye&apos;de %89,1. Ayarı
                  Türkiye&apos;yi hiç görmeden yurt dışı verisiyle seçip
                  Türkiye&apos;de sınadığımızda da %89 çıktı — yani rakam bir
                  ülkeye özel şans değil. Sezonları teker teker dışarıda
                  bırakınca ortalama %90.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Koniyi küçültmeyi denedik, anlamlı bir yol bulamadık — ve
                    bunu değiştirmemeyi seçtik.
                  </b>{" "}
                  Aynı güvenilirlikte daha dar bir koni çizebilmek için üç ayrı
                  yol denendi: emniyet payını rüzgâra göre değiştirmek,
                  yangının bir önceki gözlenen ilerlemesiyle kendini
                  düzeltmesi, ve &quot;bu yangın büyümeyecek&quot; tahmini.
                  Üçü de tek başına ancak %3 civarı kazandırdı, üstelik
                  birleştirilince toplanmadılar — hepsi aynı fazlalığı kırpıyor.
                  Ölçüm belirsizliğinin altındaki bir kazanç için çalışan bir
                  şeyi bozmadık.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Makine öğrenmesi, yön tahmininde fizik modelini geçemedi.
                  </b>{" "}
                  Sekiz sezonluk veriyle bir model eğittik. Eğitildiği
                  coğrafyada fizik modelinden birkaç derece iyiydi, ama
                  Türkiye&apos;de aradaki fark rastgeleliğin içinde kayboldu.
                  Bunu yazıyoruz çünkü &quot;yapay zekâ ekledik&quot; demek
                  kolay, işe yaramadığını söylemek zor.
                </li>
                <li>
                  Bu turda{" "}
                  <b className="font-medium text-ink">
                    haritada hiçbir şey değişmedi
                  </b>
                  . Yaptığımız iş ölçmek ve doğrulamaktı.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">
                4 Ağustos 2026 — yeni bir uydu, piksel dürüstlüğü ve
                sustuğumuzu fark ettiğimiz bir hata
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    Erişim şekli artık rüzgâra göre değişiyor — ve önceki
                    ölçümümüz bozukmuş.
                  </b>{" "}
                  Şekli &quot;baş yönüne doğru geriye göre 2,4 kat uzun&quot;
                  diye çiziyorduk, rüzgâr ne olursa olsun aynı. O sayıyı
                  ölçerken yangının yönünü{" "}
                  <i>kütle merkezinden</i>{" "}
                  hesaplamışız; 30 kilometrelik bir
                  yangında merkeze göre &quot;geri&quot; olan yön, cephenin
                  yanı olabiliyor. Ölçümü her 375 metrelik hücre için ayrı ayrı
                  ve hücrenin kendi komşusundan yeniden yaptık (5.719 hücre):
                  zayıf rüzgârda yangın gerçekten her yöne benzer ilerliyor
                  (1,2 kat, yani neredeyse daire), 15 km/sa üstünde ise geriye
                  <b className="font-medium text-ink"> neredeyse hiç</b>{" "}
                  gitmiyor (5,5 kat). Tek sabit şekil ikisini de yanlış
                  çiziyordu. Yeni şekil hem daha çok kapsıyor (%88 → %91) hem{" "}
                  <b className="font-medium text-ink">daha küçük</b> — güçlü
                  rüzgârda çizdiğimiz alan üçte bir küçüldü, çünkü artık alanı
                  yangının gitmediği tarafa harcamıyoruz.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    &quot;Sade&quot; düğmesi ve kapatılabilir bilgi bantları.
                  </b>{" "}
                  Sade düğmesi üst şeridi, sol listeyi, lejantı ve veri kaynağı
                  açıklamalarını gizliyor; ekranda yalnız harita kalıyor —
                  ekran görüntüsü almak ya da sadece haritaya bakmak için. Geri
                  dönmek için sağ üstteki küçük tutamak veya ESC. Ayrıca üstteki
                  her bilgi bandının sağında artık bir çarpı var: hangisini
                  okuduysanız kapatabiliyorsunuz, telefonda haritaya kalan yer
                  belirgin biçimde artıyor.{" "}
                  <b className="font-medium text-ink">
                    Tek istisna doğrulanmamış ısı kaynağı uyarısı:
                  </b>{" "}
                  onu kapatmak yalnız o anki uyarı için geçerli, uydu yeni bir
                  kaynak gördüğünde geri geliyor. Sitenin en erken uyarısını
                  kalıcı olarak susturmak istemedik. Sade görünümde sol altta
                  Algow imzası ve haritanın üzerinde çok soluk bir{" "}
                  <b className="font-medium text-ink">yangin.algow.net</b>{" "}
                  filigranı duruyor: platform ücretsiz ve açık kaynak, ama
                  görüntüsü başkasının malı gibi satılmasın.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Suriye ve Irak&apos;taki ısı kaynakları listenin en altına
                    indi.
                  </b>{" "}
                  Uydu kutumuz komşu ülkeleri de görüyor ve orada ölçülen büyük
                  güçlerin çoğu yangın değil: petrol kuyularında yakılan gaz,
                  yani hiç sönmeyen sanayi ısısı. Musul&apos;daki 1.171
                  megavatlık bir baca, Çankırı&apos;daki 512 megavatlık gerçek
                  orman yangınını listenin altına itiyordu. Haritadan
                  kaldırmadık — uydu ne görüyorsa onu gösteriyoruz — ama
                  sıralamada en dibe aldık. Yunanistan ve Balkanlar bu
                  düzenlemenin dışında: oradaki büyük yangın gerçek yangın.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Yunanistan ve Balkanlar&apos;daki yangınlarda hava paneli
                    aylardır çalışmıyormuş — düzelttik.
                  </b>{" "}
                  Kapsamı batıya genişlettiğimizde altı ayrı yerde sınırı elle
                  yazmışız ve beşini güncellemeyi unutmuşuz. Sonuç: 24,9°
                  doğunun batısındaki her yangında rüzgâr, nem, yangın hava
                  indeksi, duman tahmini, eğim ve yakıt bilgisi sessizce boş
                  geliyordu. Hiçbir hata mesajı çıkmadığı için &quot;veri
                  yok&quot; gibi görünüyordu. Haritadaki en büyük yangınların
                  bir kısmı tam da o bölgedeydi. Sınır artık tek yerde
                  tanımlı ve bir daha kopyalanamasın diye teste bağlandı.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Uydu pikselinin gerçek büyüklüğünü çiziyoruz.
                  </b>{" "}
                  Yakınlaşınca her tespitin çevresinde kesikli bir elips
                  görüyorsunuz: ısının içinde bulunduğu hücre bu. Nokta
                  &quot;yangın tam burada&quot; demek değil. VIIRS uydusunda
                  hücre en iyi durumda 375 metre, MODIS&apos;te tarama
                  kenarında 4 kilometreye kadar çıkıyor — konumun neden bazen
                  kaydığı artık gözle görünüyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Aktif yangın sayacı biraz düştü, çünkü eskisi biraz
                    şişikti.
                  </b>{" "}
                  Uydu her tespite bir güven notu veriyor; biz bunu hiç
                  kullanmıyorduk. Artık düşük güvenli <i>gündüz</i> tespitleri
                  haritada soluk çiziliyor ve sayaca katılmıyor. Gündüz yanlış
                  alarmların başlıca sebebi güneş yansıması: sera örtüsü,
                  metal çatı, su yüzeyi. Gece bu mekanizma olmadığı için gece
                  tespitleri düşürülmüyor — yangınlar gece de büyüyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Yeni uydu: Sentinel-3.
                  </b>{" "}
                  Avrupa&apos;nın SLSTR ölçeri günde dört ek geçiş getiriyor,
                  hücresi 1 kilometre. Meteosat&apos;tan keskin ama ondan
                  yavaş: taramadan yayına yaklaşık iki saat geçiyor (ölçtük).
                  Yani kör aralığı kapatmıyor, keskin katmana ayrı bir geçiş
                  ekliyor. Bu ölçüm kendi hata payını da veriyor, o yüzden
                  &quot;30 ± 4 MW&quot; diyebiliyoruz.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Sensör doyduğunda söylüyoruz.
                  </b>{" "}
                  Yangın çok şiddetliyse uydunun ısı kanalı doyuyor ve ölçtüğü
                  güç gerçeğin <i>alt sınırı</i> oluyor. Bu durumda kartta
                  &quot;ÇOK ŞİDDETLİ&quot; yazıyor: gösterilen rakam
                  yangının olabileceği en küçük değer.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Yangının yöneldiği yer yazıyla da görünüyor.
                  </b>{" "}
                  Erişim şekli haritada zaten vardı ama haritaya bakmayan için
                  soyut kalıyordu. Artık &quot;bu yönde: X ~7 km&quot; diye
                  okunuyor. Bu bir tahliye uyarısı değildir ve yangının oraya
                  ulaşacağı anlamına gelmez — rüzgâr döner, ekipler müdahale
                  eder.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Duman: ölçüm varsa ölçümü, yoksa modeli gösteriyoruz.
                  </b>{" "}
                  Duman satırı bugüne kadar tamamen bir modelin (ECMWF/CAMS)
                  çıktısıydı ve bunu yazmıyorduk. Artık yangının 25 km
                  çevresinde ölçüm yapan bir yer istasyonu varsa onun gerçek
                  değeri ayrı satırda görünüyor. Dürüst olalım: Türkiye&apos;de
                  bu satır çoğunlukla çıkmayacak, çünkü ulusal hava kalitesi
                  ağının açık veri akışı{" "}
                  <b className="font-medium text-ink">Mayıs 2023&apos;te
                  durmuş</b>{" "}
                  — kayıtlı 406 istasyondan yalnız 8&apos;i hâlâ veri veriyor ve
                  hepsi İstanbul&apos;da. Yunanistan ve Avrupa tarafında
                  çalışıyor. İstasyon yoksa satırın altında &quot;bu tamamen
                  modeldir&quot; yazıyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Bağlantıyı paylaşınca açılış ekranımız görünüyor.
                  </b>{" "}
                  Sohbet uygulamalarında ve sosyal medyada çıkan önizleme
                  kartı, siteyi açtığınızda gördüğünüz ilk ekranın aynısı.
                  Ayrıca arama motorları ve JavaScript çalıştırmayan
                  tarayıcılar için sayfanın özeti artık sunucudan geliyor:
                  en yeni tespitin yaşı, aktif olay sayısı ve acil numaraları
                  harita hiç yüklenmese de okunabiliyor.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">
                3 Ağustos 2026 — Yunanistan kapsama girdi, söndürme uçakları
                haritada
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    Haritanın kapsadığı alan batıya genişledi.
                  </b>{" "}
                  Eskiden Yunanistan&apos;ın yalnız Ege kıyısını ve doğu
                  adalarını görüyorduk; anakaranın batısı, Mora yarımadası, İyon
                  adaları ve Girit&apos;in güneyi kapsama hiç girmiyordu.
                  Genişletmenin ilk gününde oradaki en büyük yangın{" "}
                  <b className="font-medium text-ink">2.645 MW</b>{" "}
                  ölçüldü — o
                  güne kadar Türkiye&apos;de gördüğümüz en büyük yangının iki
                  katı. Komşu ülke yangınları &quot;YURT DIŞI&quot; rozetiyle
                  işaretleniyor ve Türkiye sayacına katılmıyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Olay listesi artık yangının büyüklüğüne göre sıralanıyor.
                  </b>{" "}
                  Önceden sınır ötesi yangınlar koşulsuz olarak listenin sonuna
                  atılıyordu. Kapsam genişleyince bu kural bilgi gizlemeye
                  başladı: Korint&apos;te 1.230 MW yanarken listenin başında
                  182 MW&apos;lık bir yangın duruyordu. Hangi ülke olduğunu
                  artık sıralama değil, kartın üstündeki rozet söylüyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Yangına giden uçak ve helikopterleri gösteren yeni bir
                    katman var.
                  </b>{" "}
                  Kaynak, gönüllülerin işlettiği açık ADS-B ağı. Uçağın tipini
                  ve tescilini gerçekten biliyoruz; görevini bilmiyoruz — yani
                  bu katman &quot;orada müdahale var&quot; diye okunmalı, resmî
                  bir görev kaydı olarak değil. Uçağın görünmemesi de müdahale
                  olmadığı anlamına gelmez: her hava aracı yayın yapmaz ve
                  dağlık alanda kapsama zayıftır. Aktif yangın sayısına
                  katılmaz.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Kendi hatamız: rüzgâr haritasının bir bölümü sessizce boş
                    kalıyordu.
                  </b>{" "}
                  Kapsamı büyütünce rüzgâr verisini aldığımız servisin dakikalık
                  sınırını aştık ve ızgaranın kuzey kesimi doldurulamadı. Orası
                  önemli, çünkü rüzgârı olmayan yangına{" "}
                  <b className="font-medium text-ink">
                    yön tahmini de çizilmiyor
                  </b>{" "}
                  — kullanıcı sebebini bilmeden eksik harita görüyordu. Izgarayı
                  biraz seyrelttik; artık kapsamın tamamı doluyor. Bedeli yön
                  hesabında ortalama 11 derecelik bir kabalaşma; tahminin kendi
                  hata payı zaten bunun çok üstünde olduğu için doğru takas.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">
                3 Ağustos 2026 — kaçırdığımız yangın, haber ihbarı, ilk alarm
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    2 Ağustos&apos;ta Bayramiç&apos;teki yangını size
                    gösteremedik — oysa görmüştük.
                  </b>{" "}
                  Yüksek çözünürlüklü uydular (VIIRS/MODIS) o yangını{" "}
                  <b className="font-medium text-ink">hiç görmedi</b>: yangın
                  onların geçişleri arasında çıktı ve aynı aralıkta kontrol
                  altına alındı. Jeostasyoner Meteosat ise{" "}
                  <b className="font-medium text-ink">saat 16:08&apos;de</b>,
                  ilk haber bültenlerinden{" "}
                  <b className="font-medium text-ink">91 dakika önce</b> gördü —
                  tepe noktasında 303 MW. Ama bu tespit haritada yalnız geçici
                  bir turuncu halkaydı: yangın listesine girmiyor, sayaca
                  katılmıyor, uyarı üretmiyordu ve yangın sönünce halka da
                  silindi. Elimizdeki bilgiyi size söylemedik.
                </li>
                <li>
                  <b className="font-medium text-ink">İlk alarm eklendi.</b>{" "}
                  Meteosat&apos;ın gördüğü ama yüksek çözünürlüklü uydunun
                  henüz doğrulamadığı ısı kaynakları artık haritanın üstünde
                  ayrı bir uyarı olarak yazıyor. Doğrulanmamıştır ve aktif
                  yangın sayısına katılmaz; sanayi bacaları listeden düşülür.
                  Meteosat halkasına tıklayınca artık &quot;bölgede yangın
                  şüphesi&quot; diyor ve neyin belirsiz olduğunu anlatıyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Haber ihbarı katmanı eklendi.
                  </b>{" "}
                  Uydunun göremediği küçük ve kısa ömürlü yangınlar için
                  haberler ikinci kanal olarak izleniyor. Doğrulanmamış
                  ihbardır: haritada nokta değil, yerin yaklaşık bölgesi olarak
                  daire çiziliyor ve aktif yangın sayısına katılmıyor. Daireye
                  tıklayınca hangi habere dayandığı, kaç yayının yazdığı ve
                  yangının kontrol altına alınıp alınmadığı görünüyor.
                </li>
                <li>
                  Bayramiç yangını{" "}
                  <Link href="/arsiv/bayramic-2026" className="underline">
                    arşive eklendi
                  </Link>{" "}
                  — arşivdeki tek kayıt ki tümüyle Meteosat tespitlerinden
                  kuruldu, çünkü diğer uydularda hiç izi yok.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">
                2 Ağustos 2026 — İngilizce dil desteği
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    Platform artık İngilizce de var.
                  </b>{" "}
                  Harita, yangın paneli, il sayfaları, sezon istatistikleri ve
                  arşiv <span className="font-mono">/en</span> altında
                  İngilizce yayınlanıyor. Türkçe adresler değişmedi: daha önce
                  paylaşılmış her bağlantı çalışmaya devam ediyor. Yer adları
                  iki dilde de Türkçe kalıyor — ad bir kimliktir, çevrilseydi
                  haritadaki isimle sahadaki isim birbirinden kopardı.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">
                2 Ağustos 2026 — sabit ısı kaynakları, il sayfaları, paylaşım
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    Sanayi tesislerini yangın saymayı bıraktık — sayacımız
                    şişikti.
                  </b>{" "}
                  Uydu alev değil ısı görür; rafineri, demir-çelik tesisi ve
                  enerji santrali her gün sıcaktır. Bunları &quot;aktif
                  yangın&quot; sayıyorduk. Ölçtük: aynı noktada{" "}
                  <b className="font-medium">40&apos;tan fazla ayrı günde</b>{" "}
                  sıcaklık görülen 50 yer var. Karşılaştırma için Türkiye&apos;nin
                  ölçülmüş en uzun orman yangını 16,5 gün sürdü. Bu noktalar
                  haritada duruyor ama artık &quot;sabit kaynak&quot; diye
                  işaretleniyor ve yangın sayısına katılmıyor. Başlıktaki rakam
                  bu yüzden düştü — eskisi yanlıştı, yenisi doğru.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    81 il için ayrı sayfa açıldı.
                  </b>{" "}
                  Her ilin kendi sayfasında o ilin sezon verisi var: kaç
                  tespit, geçmiş sezonlara göre nasıl, en yüksek ısı ne zaman
                  nerede ölçüldü. Sayılardan sabit ısı kaynakları düşülüyor —
                  yoksa sanayi bölgelerinde rakam gerçeğin kat kat üstünde
                  çıkıyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Yangınlar artık paylaşılabiliyor.
                  </b>{" "}
                  Bir yangını seçip bağlantısını gönderdiğinde karşı taraf
                  doğrudan o yangını görüyor; sohbet uygulamalarında da yerin
                  adı, ısı gücü ve süresi görünüyor. Karttaki sayılar bağlantıya
                  yazılmıyor, her seferinde gerçek veriden üretiliyor — uydurma
                  bir kart oluşturulamasın diye.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Duman tahmini eklendi.
                  </b>{" "}
                  Yangının yerinde önümüzdeki 48 saatte havadaki ince partikülün
                  (PM2.5) ne zaman zirve yapacağını gösteriyoruz. Dağılımı biz
                  hesaplamıyoruz; Avrupa&apos;nın atmosfer izleme servisi
                  CAMS&apos;in çıktısını aktarıyoruz.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Geçmiş yangınların arşivi açıldı.
                  </b>{" "}
                  2021&apos;in Manavgat, Marmaris ve Milas yangınları baştan
                  sona oynatılabiliyor. Arşivde tahmin şekli bilerek
                  çizilmiyor: o gün yapılmamış bir tahmini sonradan yapılmış
                  gibi göstermeyiz.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Tarım alanlarındaki ateşler gizlenebiliyor, il/ilçe araması
                    geldi.
                  </b>{" "}
                  Arazi örtüsü tarım olan tespitler tek düğmeyle listeden ve
                  haritadan çıkıyor. Örtüsü sorulamayan olaylar gizlenmiyor ve
                  kaç tanesi olduğu yazılıyor — sessizce temizlenmiş bir harita
                  yanıltıcı olurdu.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Erişim şekli yakın ölçekte çiziliyor.
                  </b>{" "}
                  Türkiye görünümünde şekil birkaç piksel kalıyordu; çizilse de
                  okunmuyor, sadece leke bırakıyordu. Artık bir yangına
                  yaklaşınca geliyor ve neden görünmediği yazıyor. Ayrıca en
                  dıştaki 6 saatlik sınır belirginleştirildi — asıl okunması
                  gereken çizgi oydu ama en soluğu oydu.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Uydunun sıcak gördüğü alan gösteriliyor.
                  </b>{" "}
                  Hektar cinsinden. Bu resmî yanan alan değildir: közlenen
                  bölümler ısı imzasını kaybeder, tespit edilen piksel de
                  bütünüyle yanmamış olabilir. Adını da öyle koyduk.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">2 Ağustos 2026 — Kıbrıs ve görseller</p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    Yer adları Türkçeleştirildi, KKTC sınırı eklendi.
                  </b>{" "}
                  Harita Türkçe bir ürün olduğu hâlde adları yerel dilde
                  gösteriyordu — Kıbrıs&apos;ta Yunanca, ülke adında İngilizce.
                  Artık Lefkoşa, Girne, Gazimağusa, Larnaka, Baf ve Türkiye
                  yazıyor. KKTC kara sınırı da çizilmeye başlandı; ada tek parça
                  görünüyordu.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    &quot;Büyüyor&quot; etiketi sınandı, çürüdü, dili
                    düzeltildi.
                  </b>{" "}
                  Yangın kartındaki eğilim etiketi bir tahmin gibi okunuyordu.
                  820 ilerleme üzerinde ölçtük:{" "}
                  <b className="font-medium">ayırt etme gücü yazı tura</b>{" "}
                  (AUC 0,502). &quot;Büyüyor&quot; denen yangın,
                  &quot;geriliyor&quot; denenden daha fazla ilerlemiyor; üstelik
                  yükselen ısı çoğunlukla geri düşüyor. Etiket artık olduğu
                  şeyi söylüyor: <b className="font-medium">ısı arttı / azaldı</b>{" "}
                  — geçmişin tarifi, geleceğin tahmini değil.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Tanıtım görselleri yenilendi.
                  </b>{" "}
                  algow.net&apos;teki proje sayfasının ekran görüntüleri bu
                  sürüme göre değiştirildi; yeni erişim şekli, arazi katmanı ve
                  dürüstlük uyarıları görünüyor. Önceki sürümün görselleri
                  silinmedi, arşivde erişilebilir duruyor.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">2 Ağustos 2026 — denetim</p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    İl sınırları artık eksiksiz.
                  </b>{" "}
                  Harita altlığının il sınırları kopuk geliyordu; bazı
                  bölgelerde hiç çizilmiyordu. Sınırları kendi verimizden
                  (Natural Earth, kamu malı) çiziyoruz — 81 il, her zumda
                  tam. İlk açılışı geciktirmemesi için harita oturduktan
                  sonra yükleniyor.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Yön hesabına regresyon testleri eklendi.
                  </b>{" "}
                  Koninin yönü artık çok katmanlı bir hesap; oradaki bir işaret
                  hatası ekranda hiçbir şeyi kırmadan koniyi ters çevirebilirdi.
                  25 test eklendi ve testlerin gerçekten yakaladığı, kasıtlı
                  hata enjekte edilerek doğrulandı.
                </li>
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
