import { slugifyTr } from "./slug";
import { provinceHref, type Locale } from "./i18n";

export const EV_PARAM = "ev";
/** Zaman penceresi: /api/fires'ın days parametresiyle aynı alfabe (1|2|5). */
export const WIN_PARAM = "g";

export interface ShareableEvent {
  id: string;
  il: string;
  abroad: boolean;
}

/**
 * Bir yangının paylaşılabilir yolu.
 *
 * Kök sayfaya bağlanır, il sayfasına DEĞİL — ve bu bilinçli bir takas:
 * `generateMetadata` içinde `searchParams` okumak Next'te o rotanın tamamını
 * dinamik hâle getiriyor. İl sayfaları arama motoru için asıl yüzey olduğundan
 * onları statik bıraktık; olayın kendi kartını (yer + MW + süre) üretebilmek
 * için paylaşım bağlantısı zaten dinamik olan köke gidiyor.
 *
 * İl sayfası ?ev= ile açılırsa harita yine o yangını seçer — yalnız sosyal
 * kart il düzeyinde kalır. Yani eski/elle yazılmış bağlantılar da çalışır.
 *
 * Pencere de taşınır: paylaşan kişi 5 günlük görünümdeyse, alıcının
 * varsayılan 24 saatlik penceresinde o yangın hiç bulunmayabilirdi.
 */
export function eventPath(
  ev: ShareableEvent,
  days = "1",
  locale: Locale = "tr"
): string {
  const q = new URLSearchParams({ [EV_PARAM]: ev.id });
  if (days !== "1") q.set(WIN_PARAM, days);
  // "/" + sorgu · "/en" + sorgu — dil kökü paylaşılan bağlantıda korunur
  return `${locale === "en" ? "/en" : "/"}?${q.toString()}`;
}

/** İlin kendi sayfası — arama motoru yüzeyi, statik. */
export function provincePath(il: string, locale: Locale = "tr"): string {
  return provinceHref(slugifyTr(il), locale);
}
