import { PLACES_TR } from "@/data/places-tr";
import { slugifyTr } from "./slug";

/**
 * Merkezi kendi adıyla kayıtlı olmayan iller: veri setinde il merkezi
 * ilçe adıyla duruyor (Hatay'ın merkezi "Antakya" gibi). Koordinatı burada
 * tekrar yazmıyoruz — hangi kaydın merkez sayılacağını söylüyoruz ki
 * tek kaynak places-tr olarak kalsın.
 */
const MERKEZ_ILCE: Record<string, string> = {
  Hatay: "Antakya",
  Kocaeli: "İzmit",
  Muğla: "Menteşe",
  Sakarya: "Adapazarı",
};

/** Uydu bbox'ı komşu ülkeleri de kapsıyor; il sayfası yalnız TR illeri için. */
const NOT_PROVINCE = new Set([
  "Suriye",
  "Irak",
  "İran",
  "Gürcistan",
  "Ermenistan",
  "Azerbaycan",
  "Yunanistan",
  "Bulgaristan",
  "Kıbrıs",
  "KKTC",
]);

export interface Province {
  /** "Şanlıurfa" */
  ad: string;
  /** "sanliurfa" — URL parçası */
  slug: string;
  lat: number;
  lon: number;
}

function build(): Province[] {
  const iller = [
    ...new Set(
      PLACES_TR.map((p) => p[1]).filter((il) => !NOT_PROVINCE.has(il))
    ),
  ];

  const out: Province[] = [];
  for (const il of iller) {
    const hedefAd = MERKEZ_ILCE[il] ?? il;
    const merkez = PLACES_TR.find((p) => p[1] === il && p[0] === hedefAd);
    // Merkez bulunamazsa il sessizce düşmesin: ilk kaydı kullan.
    const kayit = merkez ?? PLACES_TR.find((p) => p[1] === il);
    if (!kayit) continue;
    out.push({ ad: il, slug: slugifyTr(il), lat: kayit[2], lon: kayit[3] });
  }
  return out.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}

export const PROVINCES: Province[] = build();

export function provinceBySlug(slug: string): Province | undefined {
  return PROVINCES.find((p) => p.slug === slug);
}
