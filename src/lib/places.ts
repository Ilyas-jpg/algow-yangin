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

/**
 * ORTADOĞU KOMŞULARI — ısı sinyali ağırlıkla petrol flare'i ve tarla yakması.
 *
 * Haritada kalıyorlar (kamu bilgisi, uydu ne gördüyse o) ama:
 *   ① yön modelinin eğitim setine girmiyorlar (`api/ml/cone`, `api/ml/export`)
 *   ② olay listesinde en dibe sıralanıyorlar (`App.tsx`) — İlyas 2026-08-04:
 *      *"şu sol panelde suriye ırak en altta olsun bizi gram alakadar etmiyor"*.
 *      Musul'da 1.171 MW'lık bir flare, Çankırı'daki 512 MW'lık gerçek orman
 *      yangınını listenin altına itiyordu.
 *
 * Avrupa komşuları (Yunanistan, Bulgaristan, Arnavutluk, K. Makedonya, Kosova,
 * Sırbistan, Karadağ, Kıbrıs) ve Kafkasya (Gürcistan, Ermenistan, Azerbaycan)
 * bu sette DEĞİL: oralarda anız yakma yaygın değil ve Yunanistan yangınları
 * hem haritanın hem eğitim setinin en değerli verisi.
 *
 * 🔑 TEK KAYNAK. Aynı liste daha önce üç yerde ayrı yazılıydı (cone route,
 * export route'ta düz metin, güneydoğu il listesi) — kutu sınırının beş rotaya
 * kopyalanıp bayatlaması dersinin aynısı, o yüzden buraya taşındı.
 */
export const ORTADOGU = new Set(["Irak", "Suriye", "İran"]);

/**
 * GÜNEYDOĞU İLLERİ — aynı sebep, yurt içi hâli: ardışık tarla yakmaları 3 km
 * kümeleme eşiğinde tek "olay"a düşüp "ilerleme" gibi görünüyor (ölçüldü:
 * 260 olayın 90'ı tarım). Eğitim setinden çıkarılıyor; harita ve listede
 * sıralaması DEĞİŞMİYOR — burada gerçek orman yangını da çıkıyor.
 */
export const GUNEYDOGU = new Set([
  "Adıyaman",
  "Batman",
  "Diyarbakır",
  "Gaziantep",
  "Kilis",
  "Mardin",
  "Siirt",
  "Şanlıurfa",
  "Şırnak",
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
