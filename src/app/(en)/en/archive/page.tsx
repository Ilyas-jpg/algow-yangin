import type { Metadata } from "next";
import ArchiveIndexView from "@/components/ArchiveIndexView";
import { alternatesEn } from "@/lib/i18n";
import { getDict } from "@/i18n";

const LOCALE = "en" as const;
const t = getDict(LOCALE);

export const metadata: Metadata = {
  title: t.meta.archiveTitle,
  description: t.meta.archiveDescription,
  alternates: alternatesEn("/arsiv"),
};

export default function EnArchiveIndexPage() {
  return <ArchiveIndexView locale={LOCALE} />;
}
