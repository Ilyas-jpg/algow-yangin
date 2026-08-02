import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface IlStat {
  /** ham tespit (sabit kaynaklar dahil) */
  buSezon: number;
  /** sabit ısı kaynaklarından gelen tespitler — yangın değil */
  sabitTespit: number;
  /** sabit kaynaklar düşülmüş; sayfada gösterilen sayı bu */
  yanginTespit: number;
  enYogunGun: { tarih: string; n: number } | null;
  enYuksekFrp: { frp: number; tarih: string; yer: string } | null;
  gecmisOrtalama: number;
  yillar: Record<string, number>;
}

export interface IlStatFile {
  pencere: { bas: string; son: string };
  guncelYil: number;
  iller: Record<string, IlStat>;
}

/**
 * İl bazlı sezon istatistiği — derleme anında okunur, çalışma anında ne
 * FIRMS'e ne diske gidilir.
 *
 * Neden var: 81 il sayfası metinsel olarak birebir aynıydı (%100 kelime
 * ortaklığı) — arama motoru açısından 81 ayrı sayfa değil, bir sayfanın 81
 * kopyası. Bu veri her sayfayı gerçekten farklı kılıyor.
 */
let bellek: IlStatFile | null = null;

export function ilStats(): IlStatFile | null {
  if (bellek) return bellek;
  try {
    bellek = JSON.parse(
      readFileSync(join(process.cwd(), "public", "il-istatistik.json"), "utf8")
    ) as IlStatFile;
    return bellek;
  } catch {
    return null;
  }
}

export function ilStat(ad: string): IlStat | null {
  return ilStats()?.iller[ad] ?? null;
}

/** "2026-07-29" → "29 Temmuz" */
export function trTarih(iso: string): string {
  const AY = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${AY[d.getUTCMonth()]}`;
}

/**
 * Geçmiş ortalamaya göre konum. Küçük sayılarda yüzde anlamsızlaşır
 * (1 → 2 tespit "%100 artış" değildir), o yüzden eşik var.
 */
export function kiyas(
  bu: number,
  ort: number
): { yon: "üstünde" | "altında" | "yakın"; yuzde: number | null } {
  if (ort < 10 || bu < 10) return { yon: "yakın", yuzde: null };
  const fark = ((bu - ort) / ort) * 100;
  if (Math.abs(fark) < 15) return { yon: "yakın", yuzde: null };
  return {
    yon: fark > 0 ? "üstünde" : "altında",
    yuzde: Math.abs(Math.round(fark)),
  };
}
