import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ClientApp from "@/components/ClientApp";
import { PROVINCES, provinceBySlug, type Province } from "@/lib/provinces";
import { ilStat, ilStats, kiyas, trTarih, type IlStat } from "@/lib/il-stats";
import { havKm } from "@/lib/geo";
import { bulunma, yonelme } from "@/lib/ek";

type Props = {
  params: Promise<{ il: string }>;
};

/** 81 il önceden bilinir; bilinmeyen slug 404. */
export function generateStaticParams() {
  return PROVINCES.map((p) => ({ il: p.slug }));
}

export const dynamicParams = false;

/** Coğrafi olarak en yakın iller — 81'inin tamamını her sayfaya koymak
 *  sayfaları birbirinin kopyası yapıyordu (ölçüldü: %100 kelime ortaklığı). */
function komsular(p: Province, n = 7): Province[] {
  return PROVINCES.filter((x) => x.slug !== p.slug)
    .map((x) => ({ x, km: havKm(p.lon, p.lat, x.lon, x.lat) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
    .map((r) => r.x);
}

/** Sezon özeti cümlesi — hem metadata hem sayfa metni bunu kullanır. */
function ozet(ad: string, s: IlStat | null, yil: number): string {
  if (!s) return "";
  if (s.yanginTespit === 0) {
    return `${bulunma(ad)} bu sezon uydu yangın kaynaklı ısı tespiti görmedi.`;
  }
  const k = kiyas(s.yanginTespit, s.gecmisOrtalama);
  const kiyasMetni =
    k.yuzde === null
      ? "geçmiş sezon ortalamasına yakın"
      : `geçmiş sezon ortalamasının %${k.yuzde} ${k.yon}`;
  const enBuyuk = s.enYuksekFrp
    ? ` En yüksek ısı ${trTarih(s.enYuksekFrp.tarih)} günü ${s.enYuksekFrp.yer} yakınında ölçüldü (${s.enYuksekFrp.frp} MW).`
    : "";
  return `${bulunma(ad)} ${yil} sezonunda uydu ${s.yanginTespit} yangın kaynaklı ısı tespiti gördü — ${kiyasMetni}.${enBuyuk}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { il } = await params;
  const p = provinceBySlug(il);
  if (!p) return {};
  const veri = ilStats();
  const s = ilStat(p.ad);

  const title = `${p.ad} yangın haritası — canlı uydu tespitleri`;
  // Açıklama da ile özgü: 81 sayfa aynı meta description ile çıkmasın.
  const description = s
    ? `${ozet(p.ad, s, veri?.guncelYil ?? new Date().getFullYear())} Canlı harita, yangının geldiği yön ve rüzgâra göre olası erişim alanı.`
    : `${p.ad} ve çevresindeki orman yangınlarını NASA FIRMS uydu tespitleriyle canlı izleyin.`;

  return {
    title,
    description,
    alternates: { canonical: `/yangin/${p.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "tr_TR",
      url: `/yangin/${p.slug}`,
    },
  };
}

export default async function ProvincePage({ params }: Props) {
  const { il } = await params;
  const p = provinceBySlug(il);
  if (!p) notFound();

  const veri = ilStats();
  const s = ilStat(p.ad);
  const yil = veri?.guncelYil ?? new Date().getFullYear();
  const yakin = komsular(p);
  const k = s ? kiyas(s.yanginTespit, s.gecmisOrtalama) : null;

  return (
    <>
      {/*
        Harita tarayıcıda çiziliyor; arama motorunun ve ekran okuyucunun
        göreceği içerik burada sunucudan geliyor. Sayılar panelde de aynen
        görünüyor — gizlenen bir metin değil, aynı bilginin metin hâli.
      */}
      <section className="sr-only">
        <h1>{p.ad} yangın haritası</h1>

        {s && (
          <>
            <h2>
              {bulunma(p.ad)} {yil} yangın sezonu
            </h2>
            <p>{ozet(p.ad, s, yil)}</p>
            <ul>
              <li>
                Bu sezon yangın kaynaklı ısı tespiti: {s.yanginTespit}
              </li>
              <li>
                Geçmiş beş sezonun aynı döneminde ortalama: {s.gecmisOrtalama}
                {k?.yuzde !== null && k ? ` (bu sezon %${k.yuzde} ${k.yon})` : ""}
              </li>
              {s.enYogunGun && (
                <li>
                  En yoğun gün: {trTarih(s.enYogunGun.tarih)} ({s.enYogunGun.n}{" "}
                  tespit)
                </li>
              )}
              {s.enYuksekFrp && (
                <li>
                  En yüksek ısı: {trTarih(s.enYuksekFrp.tarih)},{" "}
                  {s.enYuksekFrp.yer}, {s.enYuksekFrp.frp} MW
                </li>
              )}
              {s.sabitTespit > 0 && (
                <li>
                  Ayrıca {s.sabitTespit} tespit sabit ısı kaynaklarından
                  (sanayi tesisi, enerji santrali) geliyor ve yangın sayılmıyor.
                </li>
              )}
            </ul>
            <h3>Yıllara göre {p.ad}</h3>
            <ul>
              {Object.entries(s.yillar).map(([y, n]) => (
                <li key={y}>
                  {y}: {n} tespit
                </li>
              ))}
            </ul>
          </>
        )}

        <h2>Bu sayılar ne anlama geliyor</h2>
        <p>
          Sayılar uydu ısı tespitidir, yangın sayısı değildir: tek bir yangın
          günlerce sürerse çok sayıda tespit üretir, küçük ve kısa süreli bir
          yangın ise hiç görünmeyebilir. Bulut altında kalan bölgeler de
          eksiktir. Veriler NASA FIRMS (VIIRS 375 m) tespitlerinden gelir;
          güncel sezon yakın-gerçek-zamanlı beslemeden, geçmiş sezonlar yeniden
          işlenmiş arşivden alındığı için karşılaştırma yaklaşıktır. Bu sayfa
          resmi uyarı yerine geçmez; acil durumda 112, orman yangını ihbarı için
          177.
        </p>

        <nav aria-label="Yakındaki iller">
          <h2>{yonelme(p.ad)} yakın illerin yangın haritaları</h2>
          <ul>
            {yakin.map((x) => (
              <li key={x.slug}>
                <Link href={`/yangin/${x.slug}`}>{x.ad} yangın haritası</Link>
              </li>
            ))}
            <li>
              <Link href="/arsiv">Geçmiş yangınların uydu arşivi</Link>
            </li>
          </ul>
        </nav>
      </section>

      <ClientApp
        focus={{
          ad: p.ad,
          lat: p.lat,
          lon: p.lon,
          ozet: s
            ? {
                yanginTespit: s.yanginTespit,
                gecmisOrtalama: s.gecmisOrtalama,
                sabitTespit: s.sabitTespit,
                enYuksek: s.enYuksekFrp,
                yil,
              }
            : null,
        }}
      />
    </>
  );
}
