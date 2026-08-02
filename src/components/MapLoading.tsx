"use client";

import { useT } from "./LocaleProvider";

/**
 * Harita motoru inerken görünen yer tutucu.
 *
 * Ayrı bileşen olmasının sebebi: `dynamic()` modül düzeyinde çağrılıyor,
 * orada kanca kullanılamaz. Bir bileşene sarınca metin sözlükten gelebiliyor
 * ve yükleme yazısı da doğru dilde çıkıyor.
 */
export default function MapLoading({
  className = "absolute inset-0",
}: {
  className?: string;
}) {
  const t = useT();
  return (
    <div className={`${className} grid place-items-center bg-obsidian-1`}>
      <span className="font-mono text-[11px] text-ink-3">
        {t.common.mapLoading}
      </span>
    </div>
  );
}
