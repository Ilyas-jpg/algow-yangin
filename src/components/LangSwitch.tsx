"use client";

import { usePathname } from "next/navigation";
import { switchPath, type Locale } from "@/lib/i18n";

/**
 * Dil düğmesi.
 *
 * `useSearchParams` BİLEREK kullanılmıyor: statik üretilen 81 il sayfasını
 * istemci tarafına düşürüyor. Bunun yerine href yalnız yoldan üretiliyor
 * (JS olmadan da çalışır), tıklamada sorgu dizesi ekleniyor — paylaşılan
 * `?ev=` bağlantısı dil değiştirince kaybolmasın.
 */
export default function LangSwitch({
  locale,
  label,
  title,
  className = "",
}: {
  locale: Locale;
  label: string;
  title: string;
  className?: string;
}) {
  const pathname = usePathname();
  const other: Locale = locale === "tr" ? "en" : "tr";
  const href = switchPath(pathname ?? "/", other);

  return (
    <a
      href={href}
      hrefLang={other}
      lang={other}
      title={title}
      onClick={(e) => {
        const q = window.location.search;
        if (!q) return;
        e.preventDefault();
        window.location.href = href + q;
      }}
      className={`shrink-0 font-mono text-[11px] tracking-wide text-ink-3 transition-colors hover:text-ink ${className}`}
    >
      {label}
    </a>
  );
}
