import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ClientApp from "@/components/ClientApp";
import { PROVINCES, provinceBySlug } from "@/lib/provinces";

type Props = {
  params: Promise<{ il: string }>;
};

/** 81 il önceden bilinir; bilinmeyen slug 404. */
export function generateStaticParams() {
  return PROVINCES.map((p) => ({ il: p.slug }));
}

export const dynamicParams = false;

/**
 * Bilerek `searchParams` OKUNMUYOR: Next'te metadata içinde searchParams'a
 * dokunmak rotanın tamamını dinamik yapıyor ve 81 il sayfası statik olmaktan
 * çıkıyordu. Bu sayfalar arama motoru yüzeyi, statik kalmaları önemli.
 * Olay bazlı paylaşım kartı zaten dinamik olan kök sayfada üretiliyor
 * (bkz. lib/share → eventPath).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { il } = await params;
  const p = provinceBySlug(il);
  if (!p) return {};

  const title = `${p.ad} yangın haritası — canlı uydu tespitleri`;
  const description = `${p.ad} ve çevresindeki orman yangınlarını NASA FIRMS uydu tespitleriyle canlı izleyin: yangının nereden geldiği, rüzgâr ve eğime göre olası erişim alanı, yangın hava indeksi ve duman. Ücretsiz, Türkçe, kayıt gerekmez.`;

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

  const komsu = PROVINCES.filter((x) => x.slug !== p.slug).slice(0, 81);

  return (
    <>
      {/*
        Haritanın kendisi tarayıcıda çiziliyor; arama motorunun ve ekran
        okuyucunun göreceği içerik burada sunucudan geliyor. Metin gerçek ve
        sayfaya dair — anahtar kelime doldurması değil.
      */}
      <section className="sr-only">
        <h1>{p.ad} yangın haritası</h1>
        <p>
          Bu sayfa {p.ad} ve çevresindeki aktif orman yangını tespitlerini
          gösterir. Veriler NASA FIRMS uydu ısı anomalisi tespitlerinden
          (VIIRS 375 m ve MODIS) ve Meteosat&apos;ın 15 dakikalık taramasından
          gelir. Uydu ısı görür; her tespit yangın olmayabilir ve küçük,
          kısa süreli yangınlar gözden kaçabilir. Bu sayfa resmi uyarı yerine
          geçmez; acil durumda 112, orman yangını ihbarı için 177.
        </p>
        <nav aria-label="Diğer iller">
          <h2>Diğer illerin yangın haritaları</h2>
          <ul>
            {komsu.map((x) => (
              <li key={x.slug}>
                <Link href={`/yangin/${x.slug}`}>{x.ad} yangın haritası</Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
      <ClientApp focus={{ ad: p.ad, lat: p.lat, lon: p.lon }} />
    </>
  );
}
