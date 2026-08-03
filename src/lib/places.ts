import { PLACES_TR } from "@/data/places-tr";
import { havKm } from "./geo";

/**
 * Uydu bbox'ı komşu ülkeleri de kapsar; bunlar yurt dışı sayılır.
 * Aynı liste `provinces.ts`'te de gerekiyor (il sayfası yalnız TR için) —
 * iki kopya tutulursa kutu büyüdüğünde biri güncellenip diğeri unutuluyor,
 * o yüzden dışa açık.
 */
export const FOREIGN = new Set([
  "Suriye",
  "Irak",
  "İran",
  "Gürcistan",
  "Ermenistan",
  "Azerbaycan",
  "Yunanistan",
  "Bulgaristan",
  "Kıbrıs",
  "Arnavutluk",
  "K. Makedonya",
  "Kosova",
  "Karadağ",
  "Sırbistan",
]);

export interface PlaceInfo {
  label: string;
  abroad: boolean;
  /** En yakın merkezin bağlı olduğu il (yurt dışıysa ülke adı). */
  il: string;
  /** En yakın merkezin kendi adı ("Bergama"). */
  name: string;
}

/**
 * En yakın merkeze göre insan-okur yer etiketi.
 * "Bergama, İzmir" / il merkeziyse "İzmir" / yurt dışıysa "Musul, Irak".
 */
export function nearestPlace(lon: number, lat: number): PlaceInfo {
  let best = PLACES_TR[0];
  let bestKm = Infinity;
  for (const p of PLACES_TR) {
    const d = havKm(lon, lat, p[3], p[2]);
    if (d < bestKm) {
      bestKm = d;
      best = p;
    }
  }
  const [name, il] = best;
  const base = name === il ? name : `${name}, ${il}`;
  return {
    label: bestKm > 60 ? `${base} açıkları` : base,
    abroad: FOREIGN.has(il),
    il,
    name,
  };
}
