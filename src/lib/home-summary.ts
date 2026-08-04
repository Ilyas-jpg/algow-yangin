import { loadFires } from "./fires-server";
import { clusterEvents, statusOf } from "./cluster";

export interface HomeSummary {
  /** En yeni tespitin zamanı; FIRMS düştüyse null. */
  newest: number | null;
  /** Yurt içi, sabit ısı kaynağı olmayan aktif olay sayısı; hesaplanamadıysa null. */
  active: number | null;
  now: number;
}

/**
 * Kök sayfanın sunucu tarafı özeti (bkz. components/SeoSummary).
 *
 * Sayılar arayüzdekiyle AYNI kurallardan geçiyor: sanayi bacaları düşülüyor,
 * yurt dışı olaylar sayılmıyor. Farklı bir formül kullanmak, sunucudan gelen
 * özetin haritadaki sayaçla çelişmesi demek olurdu.
 *
 * FIRMS düşükse özet sayısız basılır — sayfa yine açılır, "veri alınamıyor"
 * denir. Yangın haritasında sessizce sıfır göstermek yanlış bilgi olurdu.
 */
export async function homeSummary(): Promise<HomeSummary> {
  const now = Date.now();
  try {
    const { points, meta } = await loadFires("1");
    const { events } = clusterEvents(points);
    const active = events.filter(
      (e) =>
        !e.abroad && !e.fixedSource && statusOf(e.lastSeen, now) === "active"
    ).length;
    return { newest: meta.newest, active, now };
  } catch {
    return { newest: null, active: null, now };
  }
}
