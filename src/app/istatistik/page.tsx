import type { Metadata } from "next";
import Link from "next/link";
import { ilStats, trTarih } from "@/lib/il-stats";
import { slugifyTr } from "@/lib/slug";

export const metadata: Metadata = {
  title: "Türkiye yangın sezonu istatistikleri — uydu tespitleri",
  description:
    "Türkiye'de bu yangın sezonunda uydunun gördüğü ısı tespitleri, geçmiş sezonlarla karşılaştırmalı. İllere göre dağılım, sezon eğrisi ve verinin sınırları.",
  alternates: { canonical: "/istatistik" },
};

const YIL_RENK: Record<string, string> = {
  "2021": "#7f8ea3",
  "2022": "#63707f",
  "2023": "#63707f",
  "2024": "#63707f",
  "2025": "#8fa2ff",
};

/** Kümülatif eğri — sezonun hangi noktasında olduğumuz böyle okunuyor. */
function Egri({
  gunluk,
  guncelYil,
  gunSayisi,
}: {
  gunluk: Record<string, number[]>;
  guncelYil: number;
  gunSayisi: number;
}) {
  const W = 660;
  const H = 220;
  const P = { l: 44, r: 8, t: 8, b: 22 };

  const kumul = (a: number[]) => {
    let s = 0;
    return a.map((n) => (s += n));
  };
  const seriler = Object.entries(gunluk).map(([yil, a]) => ({
    yil,
    veri: kumul(a),
  }));
  const max = Math.max(...seriler.flatMap((s) => s.veri), 1);

  const x = (i: number) => P.l + (i / (gunSayisi - 1)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const yol = (veri: number[], kes: boolean) => {
    const n = kes ? veri.length : veri.length;
    return veri
      .slice(0, n)
      .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");
  };

  // Güncel sezonun verisi bugüne kadar; sonrası çizilmesin
  const bugunIdx =
    (gunluk[String(guncelYil)] ?? []).reduce(
      (son, _, i, a) => (a.slice(i).some((v) => v > 0) ? i : son),
      0
    ) + 1;

  const eksenler = [0, 0.5, 1].map((f) => Math.round(max * f));

  return (
    <figure className="mt-6">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Sezon başından bugüne birikimli uydu tespiti eğrisi; ${guncelYil} ve önceki sezonlar`}
      >
        {eksenler.map((v) => (
          <g key={v}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={y(v)}
              y2={y(v)}
              stroke="#26262c"
              strokeWidth="1"
            />
            <text
              x={P.l - 6}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-[#7e7e88] font-mono"
              fontSize="9"
            >
              {v.toLocaleString("tr-TR")}
            </text>
          </g>
        ))}
        {seriler
          .filter((s) => s.yil !== String(guncelYil))
          .map((s) => (
            <path
              key={s.yil}
              d={yol(s.veri, false)}
              fill="none"
              stroke={YIL_RENK[s.yil] ?? "#4a5563"}
              strokeWidth="1.2"
              opacity="0.7"
            />
          ))}
        {seriler
          .filter((s) => s.yil === String(guncelYil))
          .map((s) => (
            <path
              key={s.yil}
              d={yol(s.veri.slice(0, bugunIdx), true)}
              fill="none"
              stroke="#e8563f"
              strokeWidth="2.2"
            />
          ))}
        <text
          x={P.l}
          y={H - 6}
          className="fill-[#7e7e88] font-mono"
          fontSize="9"
        >
          1 Mayıs
        </text>
        <text
          x={W - P.r}
          y={H - 6}
          textAnchor="end"
          className="fill-[#7e7e88] font-mono"
          fontSize="9"
        >
          bugün
        </text>
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[#e8563f]" /> {guncelYil}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[#8fa2ff]" /> 2025
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[#7f8ea3]" /> 2021
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[#63707f]" /> 2022–2024
        </span>
        <span>birikimli tespit · 1 Mayıs&apos;tan itibaren</span>
      </figcaption>
    </figure>
  );
}

export default function IstatistikPage() {
  const veri = ilStats();
  if (!veri?.ulke) {
    return (
      <main className="mx-auto min-h-dvh max-w-[720px] px-5 py-10">
        <p className="text-sm text-ink-2">İstatistik verisi henüz hazırlanmadı.</p>
      </main>
    );
  }

  const { ulke, guncelYil } = veri;
  const yillar = Object.keys(ulke.yillar).map(Number).sort();
  const gecmis = yillar.filter((y) => y !== guncelYil);
  const gecmisOrt = Math.round(
    gecmis.reduce((a, y) => a + ulke.yillar[y], 0) / gecmis.length
  );
  const bu = ulke.yillar[guncelYil];
  const fark = Math.round(((bu - gecmisOrt) / gecmisOrt) * 100);
  const enYuksekYil = yillar.reduce((a, b) =>
    ulke.yillar[a] >= ulke.yillar[b] ? a : b
  );

  const iller = Object.entries(veri.iller)
    .map(([ad, s]) => ({ ad, ...s }))
    .filter((x) => x.yanginTespit > 0)
    .sort((a, b) => b.yanginTespit - a.yanginTespit);

  return (
    <main className="mx-auto min-h-dvh max-w-[760px] px-5 py-10">
      <nav className="mb-8 flex items-center gap-3 text-[11px] text-ink-3">
        <Link href="/" className="hover:text-ink">
          ← Canlı harita
        </Link>
        <Link href="/arsiv" className="hover:text-ink">
          Arşiv
        </Link>
        <Link href="/hakkinda" className="hover:text-ink">
          Hakkında
        </Link>
      </nav>

      <h1 className="text-[28px] leading-tight font-medium">
        {guncelYil} yangın sezonu — uydu ne gördü?
      </h1>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
        1 Mayıs&apos;tan bugüne Türkiye üzerinde NASA FIRMS uydularının kaydettiği
        ısı tespitleri, geçmiş beş sezonun aynı dönemiyle karşılaştırmalı. Sabit
        ısı kaynakları (rafineri, demir-çelik tesisi, enerji santrali) bu
        sayıların dışında tutuldu.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-line bg-obsidian-2/40 px-4 py-3">
          <p className="font-mono text-[10px] text-ink-3">bu sezon</p>
          <p className="mt-0.5 font-mono text-[22px] text-danger">
            {bu.toLocaleString("tr-TR")}
          </p>
          <p className="text-[11px] text-ink-3">ısı tespiti</p>
        </div>
        <div className="rounded-md border border-line bg-obsidian-2/40 px-4 py-3">
          <p className="font-mono text-[10px] text-ink-3">geçmiş 5 sezon ort.</p>
          <p className="mt-0.5 font-mono text-[22px]">
            {gecmisOrt.toLocaleString("tr-TR")}
          </p>
          <p className={`text-[11px] ${fark > 0 ? "text-warn" : "text-ok"}`}>
            bu sezon %{Math.abs(fark)} {fark > 0 ? "üstünde" : "altında"}
          </p>
        </div>
        <div className="rounded-md border border-line bg-obsidian-2/40 px-4 py-3">
          <p className="font-mono text-[10px] text-ink-3">en yüksek sezon</p>
          <p className="mt-0.5 font-mono text-[22px]">{enYuksekYil}</p>
          <p className="text-[11px] text-ink-3">
            {ulke.yillar[enYuksekYil].toLocaleString("tr-TR")} tespit
          </p>
        </div>
      </div>

      <h2 className="mt-10 text-[18px] font-medium">Sezon nasıl gidiyor</h2>
      <Egri
        gunluk={ulke.gunluk}
        guncelYil={guncelYil}
        gunSayisi={ulke.gunSayisi}
      />

      <h2 className="mt-10 text-[18px] font-medium">Sezonlara göre toplam</h2>
      <ul className="mt-3 space-y-1.5">
        {yillar.map((y) => {
          const n = ulke.yillar[y];
          const oran = (n / ulke.yillar[enYuksekYil]) * 100;
          return (
            <li key={y} className="flex items-center gap-3">
              <span className="w-10 shrink-0 font-mono text-[11px] text-ink-2">
                {y}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-sm bg-obsidian-3">
                <span
                  className={`block h-full ${y === guncelYil ? "bg-danger" : "bg-ink-3/50"}`}
                  style={{ width: `${oran}%` }}
                />
              </span>
              <span className="w-16 shrink-0 text-right font-mono text-[11px]">
                {n.toLocaleString("tr-TR")}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-ink-3">
        {guncelYil} sezonu henüz sürüyor; diğer yıllar da aynı takvim
        penceresine (1 Mayıs&nbsp;–&nbsp;bugün) kırpıldı, karşılaştırma bu yüzden
        adil.
      </p>

      <h2 className="mt-10 text-[18px] font-medium">İllere göre</h2>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-2">
        Aşağıdaki sayılar arazi örtüsüne göre ayrıştırılmamıştır: tarım
        alanlarındaki ısı tespitleri de bu toplamlara dahildir ve bunlar orman
        yangını değildir. Bu yüzden liste bir &quot;en çok yanan iller&quot;
        sıralaması olarak okunmamalıdır.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[10px] text-ink-3">
              <th className="py-1.5 pr-3 font-normal">il</th>
              <th className="py-1.5 pr-3 text-right font-normal">bu sezon</th>
              <th className="py-1.5 pr-3 text-right font-normal">geçmiş ort.</th>
              <th className="py-1.5 text-right font-normal">en yüksek ısı</th>
            </tr>
          </thead>
          <tbody>
            {iller.map((x) => (
              <tr key={x.ad} className="border-b border-line/50">
                <td className="py-1.5 pr-3">
                  <Link
                    href={`/yangin/${slugifyTr(x.ad)}`}
                    className="hover:text-cobalt"
                  >
                    {x.ad}
                  </Link>
                </td>
                <td className="py-1.5 pr-3 text-right font-mono">
                  {x.yanginTespit.toLocaleString("tr-TR")}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono text-ink-3">
                  {x.gecmisOrtalama.toLocaleString("tr-TR")}
                </td>
                <td className="py-1.5 text-right font-mono text-ink-3">
                  {x.enYuksekFrp
                    ? `${x.enYuksekFrp.frp} MW · ${trTarih(x.enYuksekFrp.tarih)}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-[18px] font-medium">Bu sayılar ne değildir</h2>
      <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-ink-2 [&>li]:list-disc [&>li]:ml-4">
        <li>
          <b className="font-medium text-ink">Yangın sayısı değildir.</b> Tek bir
          yangın günlerce sürerse yüzlerce tespit üretir; küçük ve kısa süreli
          bir yangın hiç görünmeyebilir.
        </li>
        <li>
          <b className="font-medium text-ink">Yanan alan değildir.</b> Tespit
          sayısı ile hektar arasında sabit bir oran yoktur.
        </li>
        <li>
          <b className="font-medium text-ink">Eksiktir.</b> Bulut altında kalan,
          kanopi altında ilerleyen ya da iki uydu geçişi arasında sönen yangınlar
          kayda girmez.
        </li>
        <li>
          <b className="font-medium text-ink">Kaynak farkı taşır.</b> Güncel
          sezon yakın-gerçek-zamanlı beslemeden, geçmiş sezonlar yeniden işlenmiş
          arşivden geliyor. İkisinin çakıştığı bir gün olmadığı için aradaki farkı
          ölçemedik; karşılaştırma yaklaşıktır.
        </li>
        <li>
          Kaynak seti bilerek sabit tutuldu (Suomi-NPP ve NOAA-20). NOAA-21 dahil
          edilseydi 2021–2022 sezonları yapay olarak düşük görünürdü.
        </li>
      </ul>

      <p className="mt-8 border-t border-line pt-4 text-[11px] leading-relaxed text-ink-3">
        Veri: NASA FIRMS (VIIRS 375 m). Bu sayfa uydu kayıtlarından otomatik
        üretilir ve sezon ilerledikçe güncellenir; resmi istatistik yerine
        geçmez.
      </p>
    </main>
  );
}
