"use client";

import type { ProvinceOzet } from "./App";
import { fmtNum } from "@/lib/format";

/** "2026-07-29" → "29 Tem" */
function kisaTarih(iso: string): string {
  const AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${AY[d.getUTCMonth()]}`;
}

/**
 * İl sayfasının sezon özeti.
 *
 * Aynı sayılar sayfanın sunucudan gelen metninde de var — burası onun görünür
 * hâli, gizlenmiş bir SEO metni değil.
 *
 * ⚠️ Gösterilen sayı `yanginTespit`: sabit ısı kaynakları (rafineri, çelik,
 * santral) düşülmüş. Ham sayı yazılsaydı Zonguldak "879 tespit" görünürdü,
 * oysa 872'si tek bir tesis — gerçek yangın tespiti 7.
 */
export default function ProvinceSummary({
  ad,
  ozet,
}: {
  ad: string;
  ozet: ProvinceOzet;
}) {
  const { yanginTespit, gecmisOrtalama, sabitTespit, enYuksek, yil } = ozet;

  // Küçük sayılarda yüzde anlamsız (1→2 "%100 artış" değildir)
  const kiyasVar = gecmisOrtalama >= 10 && yanginTespit >= 10;
  const fark = kiyasVar
    ? Math.round(((yanginTespit - gecmisOrtalama) / gecmisOrtalama) * 100)
    : null;
  const belirgin = fark !== null && Math.abs(fark) >= 15;

  return (
    <section className="shrink-0 border-b border-line px-3 py-2.5">
      <h2 className="text-[13px] font-medium">
        {ad} · {yil} sezonu
      </h2>

      {yanginTespit === 0 ? (
        <p className="mt-1 text-[11px] leading-relaxed text-ink-2">
          Bu sezon uydu, bu ilde yangın kaynaklı ısı tespiti görmedi.
        </p>
      ) : (
        <>
          <p className="mt-1 font-mono text-[11px] text-ink-2">
            <span className="text-danger">{fmtNum(yanginTespit)}</span> yangın
            tespiti · geçmiş ort. {fmtNum(gecmisOrtalama)}
            {belirgin && (
              <span className={fark > 0 ? " text-warn" : " text-ok"}>
                {" "}
                %{Math.abs(fark)} {fark > 0 ? "üstünde" : "altında"}
              </span>
            )}
          </p>
          {enYuksek && (
            <p className="mt-1 text-[11px] leading-relaxed text-ink-2">
              En yüksek ısı{" "}
              <b className="font-mono font-normal text-ink">
                {kisaTarih(enYuksek.tarih)}
              </b>{" "}
              · {enYuksek.yer} ·{" "}
              <b className="font-mono font-normal text-ink">
                {fmtNum(enYuksek.frp)} MW
              </b>
            </p>
          )}
        </>
      )}

      {sabitTespit > 0 && (
        <p className="mt-1.5 text-[10px] leading-relaxed text-ink-3">
          Ayrıca {fmtNum(sabitTespit)} tespit sabit ısı kaynaklarından geliyor
          (sanayi tesisi, enerji santrali) — yangın sayılmadı.
        </p>
      )}
      <p className="mt-1 text-[10px] leading-relaxed text-ink-3">
        Bu sayı tespit sayısıdır, yangın sayısı değil: uzun süren tek bir yangın
        çok tespit üretir, küçük bir yangın hiç görünmeyebilir.
      </p>
    </section>
  );
}
