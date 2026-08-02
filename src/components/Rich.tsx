import { Fragment } from "react";
import { fill, type Seg } from "@/lib/i18n";

/**
 * Vurgulu cümle. Sözlükteki `Seg[]` dizisini kalın/monospace parçalarıyla
 * birlikte basar.
 *
 * Neden ayrı bileşen: aynı cümleyi JSX'e gömdüğümüzde `</b>` satır sonuna
 * denk gelince sonraki boşluk yutuluyordu ("küçükmüş— düzelttik"). Burada
 * boşluklar metnin kendi içinde durduğu için o sınıf hata imkânsız.
 *
 * Sunucu ve istemci ağacının ikisinde de kullanılabilir (bilerek
 * "use client" yok).
 */
export default function Rich({
  segs,
  vars,
}: {
  segs: Seg[];
  vars?: Record<string, string | number>;
}) {
  return (
    <>
      {segs.map(([text, kind], i) => {
        const s = vars ? fill(text, vars) : text;
        if (kind === "b") {
          return (
            <b key={i} className="font-normal text-ink">
              {s}
            </b>
          );
        }
        if (kind === "m") {
          return (
            <b key={i} className="font-mono font-normal text-ink">
              {s}
            </b>
          );
        }
        if (kind === "d") {
          return (
            <span key={i} className="text-ink-3">
              {s}
            </span>
          );
        }
        return <Fragment key={i}>{s}</Fragment>;
      })}
    </>
  );
}
