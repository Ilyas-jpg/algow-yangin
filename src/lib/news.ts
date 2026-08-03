/**
 * Haber sinyali — uydunun hiç göremediği yangınlar için ikinci kanal.
 *
 * Neden var: ölçtük, platformun kaçırdığı bir yangın SINIFI var ve bu sınıf
 * tekrar ediyor. Dikili/Çandarlı (1 Ağu) ve Bayramiç/Çanakkale (2 Ağu) —
 * ikisi de otluk/makilik, ikisi de iki uydu geçişi arasında doğup aynı
 * aralıkta söndürüldü, ikisinde de FIRMS'in dört kaynağı da, MTG de sıfır
 * tespit verdi. Bayramiç ~17:30'da çıktı, ~23:00'te kontrol altına alındı;
 * en yakın geçiş penceresi 15:00→20:00 kör aralığının içindeydi. Yani bu
 * bir ayar hatası değil, uydunun fiziksel sınırı: küçük + kısa ömürlü
 * yangın hiçbir çözünürlükte görünmüyor.
 *
 * Haber o boşluğu dolduran tek ücretsiz kanal — Bayramiç'in ilk haberi
 * 17:39'da düşmüştü, yani yangın başladıktan ~10 dakika sonra.
 *
 * ⚠️ Bu veri UYDU TESPİTİ DEĞİLDİR ve öyle gösterilmez:
 * - aktif yangın sayacına karışmaz,
 * - koni (yön tahmini) çizilmez — konum bir başlıktan çıkarıldı, yön
 *   tahmini yapacak hassasiyette değil,
 * - haritada nokta değil YAKLAŞIK ALAN olarak çizilir; dairenin yarıçapı
 *   eşleşmenin kabalığını gösterir (Meteosat pikselinde aldığımız kararın
 *   aynısı: kaba konumu nokta gibi çizmek yalan olur).
 */
import { PLACES_TR, type PlaceTuple } from "@/data/places-tr";
import { PROVINCES } from "./provinces";
import { foldTr, slugifyTr } from "./slug";

export type NewsStatus = "devam" | "kontrol" | "sondu";
export type NewsPrecision = "ilce" | "il";

export interface NewsSignal {
  id: string;
  /** haber başlığı — kırpılmadan, yorumlanmadan */
  title: string;
  link: string;
  source: string;
  /** yayın anı, epoch ms */
  t: number;
  lat: number;
  lon: number;
  /** yer eşleşmesinin kabalığı — haritadaki dairenin gerçek yarıçapı */
  radiusKm: number;
  /** eşleşen yerin adı ("Bayramiç") */
  place: string;
  il: string;
  precision: NewsPrecision;
  status: NewsStatus;
  /** aynı yeri yazan farklı yayın sayısı — sinyalin gücü */
  sourceCount: number;
  /** haberi yazanlar arasında tanınan bir yayın var mı */
  trusted: boolean;
}

export interface RawItem {
  title: string;
  link: string;
  source: string;
  t: number;
}

/**
 * Yarıçaplar. İlçe eşleşmesinde "bu ilçenin bir yerinde" diyebiliyoruz —
 * Türkiye'de ortalama ilçe yarıçapı bu mertebede. Yalnız il adı geçiyorsa
 * gerçekten sadece ili biliyoruz; daireyi küçük çizmek bilmediğimiz bir
 * hassasiyeti varmış gibi göstermek olurdu.
 */
export const YARICAP_KM: Record<NewsPrecision, number> = { ilce: 12, il: 45 };

/**
 * 4 harften kısa yer adları elendi. "Of" (Trabzon) ve "Bor" (Niğde) gerçek
 * ilçeler ama cümle içinde sürekli yanlış eşleşiyorlar; kamu güvenliği
 * haritasında yanlış konumlu bir ihbar, eksik ihbardan daha zararlı.
 */
const MIN_AD_UZUNLUK = 4;

const IL_ADLARI = new Set(PROVINCES.map((p) => p.ad));

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decodeEntities(m[1]) : "";
}

/** Google News RSS → ham kayıtlar. */
export function parseRss(xml: string): RawItem[] {
  const out: RawItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const source = tag(b, "source");
    let title = tag(b, "title");
    // Google başlığın sonuna " - Yayın Adı" ekliyor; <source> zaten var.
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(source.length + 3));
    }
    const t = Date.parse(tag(b, "pubDate"));
    if (!title || !Number.isFinite(t)) continue;
    out.push({ title, link: tag(b, "link"), source, t });
  }
  return out;
}

/**
 * Türkçe ekler apostrofla geliyor ("Bayramiç'te", "Muğla'da"), o yüzden
 * düz `includes` yetmez ama tam kelime eşleşmesi de fazla katı olur.
 */
function kelimeGecerMi(katlanmisMetin: string, katlanmisAd: string): boolean {
  const esc = katlanmisAd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}(['’][a-z]*)?($|[^a-z0-9])`).test(
    katlanmisMetin
  );
}

/**
 * Bazı ilçe adları aynı zamanda gündelik kelime: Bahçe (Osmaniye), Çay
 * (Afyon), Kale (Denizli). "bahçe yangını" başlığı Osmaniye'ye pin
 * düşürüyordu — ölçtük, canlı veride çıktı. Türkçede yer adı büyük harfle
 * yazılır, gündelik kelime yazılmaz; ayrım için orijinal başlığa bakıyoruz.
 */
function ozelAdGibiMi(title: string, ad: string): boolean {
  if (title.includes(ad)) return true;
  // Tümü büyük yazılmış başlıkta ("BAYRAMİÇ'TE YANGIN") büyük/küçük
  // ayrımı bilgi taşımaz — orada bu testi uygulamak haksız olur.
  const harf = title.replace(/[^\p{L}]/gu, "");
  if (!harf) return false;
  const buyuk = [...harf].filter((c) => c === c.toLocaleUpperCase("tr")).length;
  return buyuk / harf.length > 0.8;
}

/**
 * Bitki örtüsü kanıtı. İkinci sorgu ("yangın çıktı") ev/araç/fabrika
 * yangınlarını da getiriyor — ölçtük: ilk canlı çekimde gelen ilk sinyal
 * "Erzurum'da yangın: 6 kişi dumandan etkilendi" idi, yani bir bina
 * yangını. Orman yangını haritasında bunun işi yok.
 *
 * Kanıt GRUP düzeyinde aranıyor: aynı yeri yazan haberlerden biri "orman
 * yangını" diyorsa, "kontrol altına alındı" diyen daha yeni başlık da o
 * yangına aittir ve kanıt kelimesi taşımasa da düşmez.
 */
const BITKI_KANITI =
  /(orman|makil?i?k?\b|otluk|an[i]z|tarla|ekin|zeytinlik|fundalik|agaclik|calilik|sazlik|mera|bugday|bostan|milli park|bitki ortusu|kizilcam|ormanlik|arazi)/;

export function bitkiYanginiMi(title: string): boolean {
  return BITKI_KANITI.test(foldTr(title));
}

/**
 * Tanınan yayınlar — ulusal ajanslar ve büyük gazeteler.
 *
 * Beyaz liste TEK BAŞINA kullanılmıyor ve kullanılmamalı: yerel yangını ilk
 * yazan çoğu zaman yerel gazete oluyor (Bayramiç'i Çanakkale Gündem ulusal
 * yayınlardan önce yazdı). Listeyi filtre yapmak en hızlı kaynağı kesmek
 * olurdu.
 *
 * İki yerde kullanılıyor:
 * ① gösterilecek başlık seçilirken tanınan yayın tercih edilir,
 * ② tek kaynaklı bir ihbar ancak tanınan bir yayından geliyorsa haritaya
 *    çıkar — bilmediğimiz tek bir site, kamu güvenliği haritasına pin
 *    düşürmek için yeterli değil.
 */
/**
 * Kısaltmalar TAM KELİME eşleşir. Alt dizi araması burada gerçekten
 * yanlış cevap veriyordu: "aa" (Anadolu Ajansı) "Bursa Saati Gazetesi"
 * içindeki "saati"ye takılıp o yayını tanınan sayıyordu — canlı veride
 * görüldü, uydurma senaryo değil.
 */
const TANINAN_KISALTMA = new Set([
  "aa", "dha", "iha", "trt", "ntv", "bbc", "t24", "tele1", "cnn",
]);

/** Ayırt edici uzun adlar; yayın adının içinde geçmesi yeterli. */
const TANINAN_AD = [
  "anadolu ajansi", "demiroren", "ihlas haber", "hurriyet", "milliyet",
  "sabah", "haberturk", "cnn turk", "sozcu", "cumhuriyet", "yeni safak",
  "aksam", "birgun", "takvim", "halk tv", "euronews", "gazete duvar",
  "bianet", "evrensel", "posta",
];

export function taninanKaynakMi(source: string): boolean {
  const s = foldTr(source).trim();
  if (!s) return false;
  if (TANINAN_AD.some((t) => s.includes(t))) return true;
  return s
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .some((tok) => TANINAN_KISALTMA.has(tok));
}

export interface PlaceMatch {
  place: PlaceTuple;
  precision: NewsPrecision;
}

/**
 * Başlıktan yer çıkarımı. İlçe eşleşmesi ile eşleşmesine her zaman tercih
 * edilir: "Bayramiç'te orman yangını, Çanakkale" başlığında ikisi de geçer
 * ama bize lazım olan dar olanı.
 */
export function matchPlace(title: string): PlaceMatch | null {
  const metin = foldTr(title);
  let best: PlaceTuple | null = null;
  let bestScore = -1;

  for (const p of PLACES_TR) {
    const [ad, il] = p;
    if (!IL_ADLARI.has(il)) continue; // komşu ülke kayıtlarını eleme
    if (ad.length < MIN_AD_UZUNLUK) continue;
    if (!kelimeGecerMi(metin, foldTr(ad))) continue;
    if (!ozelAdGibiMi(title, ad)) continue;
    const score = (ad !== il ? 1000 : 0) + ad.length;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  if (!best) return null;
  return { place: best, precision: best[0] !== best[1] ? "ilce" : "il" };
}

/**
 * Başlıktan durum. Bu bilgi bizde hiç yoktu — uydu "söndü mü" demiyor,
 * ısı imzası kaybolunca susuyor. Haber söylüyor.
 */
export function readStatus(title: string): NewsStatus {
  const m = foldTr(title);
  if (/sondurul|tamamen sondu|sondu ruldu/.test(m)) return "sondu";
  if (/kontrol altina alin|kontrol altinda|kontrol edildi/.test(m))
    return "kontrol";
  return "devam";
}

export interface BuildOpts {
  /** şu an, epoch ms */
  now: number;
  /** bu yaştan eski haber alınmaz */
  maxYasSaat?: number;
}

/**
 * Ham RSS → haritaya konabilir sinyaller.
 *
 * Aynı yangını on yayın birden yazıyor. Her birini ayrı ihbar gibi çizmek
 * hem haritayı kirletir hem de tek yangını on yangın gibi gösterir — bu,
 * sanayi bacalarında sayacı %40 şişiren hatanın aynısı olurdu. Bu yüzden
 * yere göre gruplanıp TEK sinyal üretiliyor; kaç ayrı yayının yazdığı
 * `sourceCount` olarak taşınıyor (sinyalin gücü), durum ise EN YENİ
 * habere göre belirleniyor — "kontrol altına alındı" sonra gelir.
 */
export function buildSignals(items: RawItem[], opts: BuildOpts): NewsSignal[] {
  const { now, maxYasSaat = 36 } = opts;
  const enEski = now - maxYasSaat * 3600_000;

  const gruplar = new Map<string, { items: RawItem[]; m: PlaceMatch }>();

  for (const it of items) {
    if (it.t < enEski || it.t > now + 3600_000) continue;
    if (!/yang[ıi]n/i.test(it.title)) continue;
    const m = matchPlace(it.title);
    if (!m) continue;
    const key = `${m.place[0]}|${m.place[1]}`;
    const g = gruplar.get(key);
    if (g) g.items.push(it);
    else gruplar.set(key, { items: [it], m });
  }

  const out: NewsSignal[] = [];
  for (const [, g] of gruplar) {
    // Bitki örtüsü kanıtı grup düzeyinde aranır (bkz. BITKI_KANITI).
    if (!g.items.some((i) => bitkiYanginiMi(i.title))) continue;

    const sirali = [...g.items].sort((a, b) => b.t - a.t);
    const kaynakSayisi = new Set(sirali.map((s) => s.source || s.link)).size;
    const taninanVar = sirali.some((s) => taninanKaynakMi(s.source));

    // Kalite eşiği: ya birden fazla bağımsız yayın yazmış olacak, ya da
    // tanıdığımız bir yayın. Tek ve bilinmeyen kaynak haritaya çıkmaz.
    if (kaynakSayisi < 2 && !taninanVar) continue;

    // Her alan EN YENİ haberden gelir — özellikle durum. Tanınan yayının
    // başlığını tercih etmek cazipti ama o başlık daha eskiyse "kontrol
    // altına alındı" bilgisini kaçırırdık; tazelik burada doğruluktan
    // önce gelir. Tanınırlık yalnızca eşik ve rozet olarak kullanılıyor.
    const yeni = sirali[0];
    const [ad, il, lat, lon] = g.m.place;
    out.push({
      id: `n:${slugifyTr(ad)}-${slugifyTr(il)}`,
      title: yeni.title,
      link: yeni.link,
      source: yeni.source,
      trusted: taninanVar,
      t: yeni.t,
      lat,
      lon,
      radiusKm: YARICAP_KM[g.m.precision],
      place: ad,
      il,
      precision: g.m.precision,
      status: readStatus(yeni.title),
      sourceCount: kaynakSayisi,
    });
  }

  return birlestirIlIlce(out).sort((a, b) => b.t - a.t);
}

/**
 * Tek yangın, iki sinyal olmasın.
 *
 * Ölçülen vaka: aynı Bayramiç yangını için hem "Bayramiç" (ilçe, 14 yayın)
 * hem "Çanakkale" (il, 25 yayın) grubu oluştu — bazı başlıklar ilçeyi,
 * bazıları yalnız ili yazıyor. İkisini birden çizmek tek yangını iki
 * yangın gibi gösterirdi; sanayi bacalarında sayacı %40 şişiren hatanın
 * aynısı.
 *
 * Aynı ilde ilçe sinyali varsa il sinyali düşer ve yayınları en güçlü
 * ilçe sinyaline eklenir — konum uydurmuyoruz, zaten var olan daha dar
 * eşleşmeyi güçlendiriyoruz.
 */
function birlestirIlIlce(list: NewsSignal[]): NewsSignal[] {
  const ilceler = new Map<string, NewsSignal[]>();
  for (const s of list) {
    if (s.precision !== "ilce") continue;
    const a = ilceler.get(s.il);
    if (a) a.push(s);
    else ilceler.set(s.il, [s]);
  }

  const out: NewsSignal[] = [];
  for (const s of list) {
    if (s.precision === "ilce") {
      out.push(s);
      continue;
    }
    const adaylar = ilceler.get(s.il);
    if (!adaylar?.length) {
      out.push(s);
      continue;
    }
    const hedef = adaylar.reduce((a, b) =>
      b.sourceCount > a.sourceCount ? b : a
    );
    hedef.sourceCount += s.sourceCount;
    hedef.trusted ||= s.trusted;
  }
  return out;
}
