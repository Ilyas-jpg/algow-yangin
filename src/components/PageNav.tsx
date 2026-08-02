import Link from "next/link";
import { path, type Locale } from "@/lib/i18n";
import { getDict } from "@/i18n";
import LangSwitch from "./LangSwitch";

/**
 * Metin sayfalarının üst gezinmesi (arşiv · istatistik · hakkında).
 *
 * Dil düğmesi burada olmak zorunda: harita dışındaki sayfalarda üst bar yok
 * ve dil değiştirmenin başka bir yolu kalmıyordu.
 */
export default function PageNav({
  locale,
  current,
}: {
  locale: Locale;
  current: "stats" | "archive" | "about";
}) {
  const t = getDict(locale);
  const items = (
    [
      { key: "stats", label: t.common.stats },
      { key: "archive", label: t.common.archive },
      { key: "about", label: t.common.about },
    ] as const
  ).filter((i) => i.key !== current);

  return (
    <nav className="mb-8 flex items-center gap-3 text-[11px] text-ink-3">
      <Link href={path("home", locale)} className="hover:text-ink">
        {t.common.liveMapBack}
      </Link>
      {items.map((i) => (
        <Link key={i.key} href={path(i.key, locale)} className="hover:text-ink">
          {i.label}
        </Link>
      ))}
      <LangSwitch
        locale={locale}
        label={t.common.otherLang}
        title={t.common.otherLangTitle}
        className="ml-auto"
      />
    </nav>
  );
}
