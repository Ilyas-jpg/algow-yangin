import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArchiveViewer from "@/components/ArchiveViewer";
import { archiveIndex } from "@/lib/archive-server";
import { fmtNum } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return archiveIndex().map((k) => ({ slug: k.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const k = archiveIndex().find((x) => x.slug === slug);
  if (!k) return {};
  const gun = fmtNum((k.son - k.ilk) / 86400_000, 1);
  const title = `${k.ad} — uydu kaydı ve ilerleyişi`;
  const description = `${k.ad} (${k.il}): ${k.tespit} uydu tespiti, ${gun} gün, en yüksek ${k.maxFrp} MW. NASA FIRMS arşivinden hazırlanan oynatma — yangın nerede başladı, hangi yöne ilerledi.`;
  return {
    title,
    description,
    alternates: { canonical: `/arsiv/${k.slug}` },
    openGraph: { title, description, type: "article", locale: "tr_TR" },
  };
}

export default async function ArchiveFirePage({ params }: Props) {
  const { slug } = await params;
  const k = archiveIndex().find((x) => x.slug === slug);
  if (!k) notFound();

  return (
    <>
      {/* Harita tarayıcıda çiziliyor; arama motorunun göreceği içerik burada */}
      <section className="sr-only">
        <h1>{k.ad} — uydu kaydı</h1>
        <p>{k.ozet}</p>
        <p>
          {k.il} · {k.tespit} uydu tespiti ·{" "}
          {fmtNum((k.son - k.ilk) / 86400_000, 1)} gün · en yüksek yangın
          ışıma gücü {k.maxFrp} MW. Kayıt NASA FIRMS arşiv (SP) verisinden
          hazırlandı; uydu ısı görür ve bulut altında kalan bölümler eksik
          olabilir.
        </p>
      </section>
      <ArchiveViewer slug={k.slug} />
    </>
  );
}
