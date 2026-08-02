import Link from "next/link";
import { archiveText } from "@/lib/archive";
import { archiveIndex } from "@/lib/archive-server";
import { fmtNum } from "@/lib/format";
import { archiveHref, fill, type Locale } from "@/lib/i18n";
import { getDict } from "@/i18n";
import PageNav from "./PageNav";

const DATE_LOCALE: Record<Locale, string> = { tr: "tr-TR", en: "en-GB" };

const tarih = (t: number, locale: Locale) =>
  new Date(t).toLocaleDateString(DATE_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** Arşiv dizini — iki dil de aynı kayıtları, aynı sayıları gösterir. */
export default function ArchiveIndexView({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const kayitlar = archiveIndex();

  return (
    <main className="mx-auto min-h-dvh max-w-[720px] px-5 py-10">
      <PageNav locale={locale} current="archive" />

      <h1 className="text-[28px] leading-tight font-medium">{t.archive.h1}</h1>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
        {t.archive.intro}
      </p>

      {kayitlar.length === 0 ? (
        <p className="mt-8 text-[13px] text-ink-3">{t.archive.empty}</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {kayitlar.map((k) => (
            <li key={k.slug}>
              <Link
                href={archiveHref(k.slug, locale)}
                className="block rounded-md border border-line bg-obsidian-2/40 px-4 py-3.5 transition-colors hover:border-cobalt/50"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[15px] font-medium">
                    {archiveText(k, locale).ad}
                  </span>
                  <span className="font-mono text-[11px] text-ink-3">
                    {k.il}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-ink-2">
                  {fill(t.archive.itemMeta, {
                    from: tarih(k.ilk, locale),
                    to: tarih(k.son, locale),
                    days: fmtNum((k.son - k.ilk) / 86400_000, 1, locale),
                    n: k.tespit,
                    mw: k.maxFrp,
                  })}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-2">
                  {archiveText(k, locale).ozet}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 border-t border-line pt-4 text-[11px] leading-relaxed text-ink-3">
        {t.archive.footer}
      </p>
    </main>
  );
}
