import { loadFires } from "./fires-server";
import { clusterEvents, statusOf } from "./cluster";
import { resolveEvent } from "./event-id";
import type { FireEvent } from "./types";

/**
 * Paylaşılan bağlantıdaki olayı sunucuda çöz.
 *
 * Kümeleme normalde istemcide çalışıyor; paylaşım kartının ve sayfa
 * başlığının gerçek sayıları gösterebilmesi için aynı işi burada da
 * yapıyoruz. Sayılar bilerek URL'den okunmuyor: kamu güvenliği haritasında
 * uydurma bir "1203 MW" kartı üretilebilmesi dezenformasyon vektörüdür.
 */
export async function lookupEvent(
  id: string,
  days = "1"
): Promise<FireEvent | null> {
  try {
    const { points } = await loadFires(days);
    const { events } = clusterEvents(points);
    const ev = resolveEvent(events, id);
    if (!ev) return null;
    return { ...ev, status: statusOf(ev.lastSeen, Date.now()) };
  } catch {
    // FIRMS düşükse paylaşım kartı genel hâline döner — sayfa açılmaya devam
    return null;
  }
}

/** days parametresini güvenli alfabeye indirger. */
export function normalizeDays(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "2" || s === "5" ? s : "1";
}
