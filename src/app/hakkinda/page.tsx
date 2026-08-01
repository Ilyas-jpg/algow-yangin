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
            kenardan başlayarak <b>rüzgârın taşıma yönünü</b> ve kaba bir hızla
            bir, üç ve altı saatlik olası erişimi gösterir. Hesap bilinçli
            olarak basittir: rüzgâr hızına göre Akdeniz bitki örtüsü için tipik
            yayılma hızları kullanılır; arazi eğimi, yakıt tipi ve söndürme
            müdahalesi hesaba katılmaz.
          </p>
          <p>
            Bu konunun dürüst olmayı en çok hak eden kısmı şu: kendi verimizle
            geriye dönük bir sınama yaptık. Yedi günlük yangınlarda, bir uydu
            geçişindeki rüzgâra bakıp yaptığımız yön tahminini, yangının bir
            sonraki geçişte gerçekte hangi yöne büyüdüğüyle karşılaştırdık.
            Yirmi üç ölçülebilir örnekte <b>tahmin, gözlenen yönü rastgele bir
            tahminden daha iyi kestiremedi</b>. Sebepleri anlaşılır: söndürme
            ekipleri çoğu zaman yangının ilerleyen başını keser, dağlık arazide
            alevler rüzgârdan bağımsız olarak yamaç yukarı tırmanır ve uydu iki
            geçiş arasında rüzgârın döndüğünü göremez.
          </p>
          <p>
            Bu yüzden koniyi bir kehanet gibi değil, <b>&quot;rüzgâr şu anda
            bu yöne taşıyor&quot;</b> bilgisi olarak sunuyoruz. Yangının son
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
            katkıda bulunanları. Uydu görüntüsü katmanı: Esri, Maxar, Earthstar
            Geographics. NASA, bu platformun içeriğini onaylamış veya
            desteklemiş değildir; veri olduğu gibi sunulur.
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
