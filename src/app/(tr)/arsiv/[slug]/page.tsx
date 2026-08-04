import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArchiveFireView from "@/components/ArchiveFireView";
import { archiveIndex } from "@/lib/archive-server";
import { archiveText } from "@/lib/archive";
import { fmtNum } from "@/lib/format";
import { OG_LOCALE, alternates, fill } from "@/lib/i18n";
import { ogIntroImage } from "@/lib/og";
import { archiveFireLd } from "@/lib/jsonld";
import JsonLd from "@/components/JsonLd";
import { getDict } from "@/i18n";

const LOCALE = "tr" as const;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return archiveIndex().map((k) => ({ slug: k.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const k = archiveIndex().find((x) => x.slug === slug);
  if (!k) return {};
  const t = getDict(LOCALE);
  const { ad } = archiveText(k, LOCALE);
  const title = fill(t.meta.archiveFireTitle, { ad });
  const description = fill(t.meta.archiveFireDescription, {
    ad,
    il: k.il,
    n: k.tespit,
    days: fmtNum((k.son - k.ilk) / 86400_000, 1, LOCALE),
    mw: k.maxFrp,
  });
  return {
    title,
    description,
    alternates: alternates(`/arsiv/${k.slug}`),
    openGraph: {
      title,
      description,
      type: "article",
      locale: OG_LOCALE.tr,
      images: ogIntroImage(LOCALE),
    },
  };
}

export default async function ArchiveFirePage({ params }: Props) {
  const { slug } = await params;
  const k = archiveIndex().find((x) => x.slug === slug);
  if (!k) notFound();

  const { ad } = archiveText(k, LOCALE);
  return (
    <>
      {/* Arşiv kaydı belgelenmiş bir olay: Article + Place. */}
      <JsonLd
        data={archiveFireLd(LOCALE, {
          title: fill(getDict(LOCALE).meta.archiveFireTitle, { ad }),
          description: k.ozet,
          url: `/arsiv/${k.slug}`,
          il: k.il,
          ilk: k.ilk,
          son: k.son,
        })}
      />
      <ArchiveFireView k={k} locale={LOCALE} />
    </>
  );
}
