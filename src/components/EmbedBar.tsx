"use client";

/* eslint-disable @next/next/no-img-element */
import type { FiresMeta } from "@/lib/types";
import { fmtAgo } from "@/lib/format";
import { useLocale, useT } from "./LocaleProvider";

/**
 * Gömme görünümünün ince üst şeridi.
 *
 * Haber sitesine gömüldüğünde tek bilgi kaynağı bu şerit: markanın kim
 * olduğu, verinin ne kadar taze olduğu ve tam haritaya çıkış. Kaynak
 * gösterimi AGPL/atıf açısından da gerekli — bu yüzden kapatılabilir değil.
 */
export default function EmbedBar({
  meta,
  now,
  href,
}: {
  meta: FiresMeta | undefined;
  now: number;
  href: string;
}) {
  const t = useT();
  const locale = useLocale();
  const newest = meta?.newest ?? null;
  const ageH = newest ? (now - newest) / 3600_000 : null;
  const dot =
    ageH === null ? "bg-ink-3" : ageH <= 3 ? "bg-ok" : ageH <= 6 ? "bg-warn" : "bg-ink-3";

  return (
    <header className="relative z-20 flex items-center gap-2.5 border-b border-line bg-obsidian-1 px-3 py-1.5">
      <img
        src="/brand/algow-wordmark.webp"
        alt="Algow"
        className="h-[15px] w-auto shrink-0"
      />
      <span className="h-3.5 w-px shrink-0 bg-line" aria-hidden />
      <span className="shrink-0 text-[12px] text-ink-2">{t.common.brand}</span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-ink-3">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {newest ? fmtAgo(newest, now, locale) : t.top.waitingData}
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="shrink-0 rounded border border-line px-2 py-0.5 text-[10px] text-ink-2 transition-colors hover:border-cobalt/60 hover:text-ink"
      >
        {t.embed.fullMap}
      </a>
    </header>
  );
}
