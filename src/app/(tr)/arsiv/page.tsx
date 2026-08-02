import type { Metadata } from "next";
import ArchiveIndexView from "@/components/ArchiveIndexView";
import { alternates } from "@/lib/i18n";
import { getDict } from "@/i18n";

const LOCALE = "tr" as const;
const t = getDict(LOCALE);

export const metadata: Metadata = {
  title: t.meta.archiveTitle,
  description: t.meta.archiveDescription,
  alternates: alternates("/arsiv"),
};

export default function ArchiveIndexPage() {
  return <ArchiveIndexView locale={LOCALE} />;
}
