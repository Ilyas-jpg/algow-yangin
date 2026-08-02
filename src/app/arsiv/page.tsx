import type { Metadata } from "next";
import Link from "next/link";
import { archiveIndex } from "@/lib/archive-server";
import { fmtNum } from "@/lib/format";

export const metadata: Metadata = {
  title: "Yangın arşivi — geçmiş büyük yangınların uydu kaydı",
  description:
    "Türkiye'nin büyük orman yangınlarının NASA FIRMS uydu arşivinden oynatması: yangın nerede başladı, hangi yöne ilerledi, kaç gün sürdü.",
  alternates: { canonical: "/arsiv" },
};

const tarih = (t: number) =>
  new Date(t).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function ArchiveIndexPage() {
  const kayitlar = archiveIndex();

  return (
    <main className="mx-auto min-h-dvh max-w-[720px] px-5 py-10">
      <nav className="mb-8 flex items-center gap-3 text-[11px] text-ink-3">
        <Link href="/" className="hover:text-ink">
          ← Canlı harita
        </Link>
        <Link href="/istatistik" className="hover:text-ink">
          Sezon istatistikleri
        </Link>
        <Link href="/hakkinda" className="hover:text-ink">
          Hakkında
        </Link>
      </nav>

      <h1 className="text-[28px] leading-tight font-medium">Yangın arşivi</h1>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
        Canlı harita yalnız son günleri gösterir; uydu arşivi ise 2012&apos;ye
        kadar açık. Aşağıdaki kayıtlar NASA FIRMS&apos;in arşiv (SP) verisinden
        hazırlandı: yangının nerede başladığını, hangi yöne ilerlediğini ve kaç
        gün sürdüğünü baştan sona oynatabilirsin.
      </p>

      {kayitlar.length === 0 ? (
        <p className="mt-8 text-[13px] text-ink-3">
          Arşiv kaydı henüz hazırlanmadı.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {kayitlar.map((k) => (
            <li key={k.slug}>
              <Link
                href={`/arsiv/${k.slug}`}
                className="block rounded-md border border-line bg-obsidian-2/40 px-4 py-3.5 transition-colors hover:border-cobalt/50"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[15px] font-medium">{k.ad}</span>
                  <span className="font-mono text-[11px] text-ink-3">
                    {k.il}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-ink-2">
                  {tarih(k.ilk)} → {tarih(k.son)} ·{" "}
                  {fmtNum((k.son - k.ilk) / 86400_000, 1)} gün ·{" "}
                  <span className="text-danger">{k.tespit}</span> uydu tespiti ·
                  en yüksek {k.maxFrp} MW
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-2">
                  {k.ozet}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 border-t border-line pt-4 text-[11px] leading-relaxed text-ink-3">
        Uydu ısı anomalisi görür; tespit sayısı yanan alanla birebir orantılı
        değildir ve bulut altında kalan, kanopi altında ilerleyen ya da iki
        geçiş arasında sönen yangınlar kayıtta eksik görünür. Bu sayfa bir
        yangının resmî büyüklük kaydı değil, uydunun gördüğüdür.
      </p>
    </main>
  );
}
