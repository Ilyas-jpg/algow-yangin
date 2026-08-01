"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { havKm } from "@/lib/geo";
import type { FireEvent } from "@/lib/types";

export interface WatchPoint {
  id: string;
  name: string;
  lon: number;
  lat: number;
  /** uyarı yarıçapı, km */
  radiusKm: number;
}

const LS_KEY = "algow-yangin-watch-v1";
const LS_SEEN = "algow-yangin-seen-v1";

function load(): WatchPoint[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as WatchPoint[]) : [];
  } catch {
    return [];
  }
}

function loadSeen(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LS_SEEN);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * Yakınımdaki yangın uyarısı.
 *
 * Bilinçli tasarım: abonelik sunucuda tutulmuyor, konum hiçbir yere
 * gönderilmiyor. Kontrol tarayıcıda yapılıyor, bildirim cihazın kendi
 * bildirim merkezinden çıkıyor. Karşılığında bir sınır var: uygulama
 * tamamen kapalıyken bildirim yalnızca Periodic Background Sync
 * destekleyen cihazlarda (kurulu PWA, Android/Chrome) gelir.
 */
export function useAlerts(events: FireEvent[]) {
  const [points, setPoints] = useState<WatchPoint[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setPoints(load());
    seenRef.current = loadSeen();
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const persist = useCallback((next: WatchPoint[]) => {
    setPoints(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* depolama dolu/kapalı — uyarılar yine oturum boyunca çalışır */
    }
  }, []);

  const add = useCallback(
    (p: Omit<WatchPoint, "id">) => {
      const next = [...load(), { ...p, id: `${Date.now()}` }].slice(-8);
      persist(next);
    },
    [persist]
  );

  const remove = useCallback(
    (id: string) => persist(load().filter((p) => p.id !== id)),
    [persist]
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied" as const;
    const r = await Notification.requestPermission();
    setPermission(r);
    if (r === "granted") {
      // Uygulama kapalıyken de kontrol edilebilsin (destekleyen cihazlarda)
      try {
        const reg = await navigator.serviceWorker?.ready;
        const ps = (reg as ServiceWorkerRegistration & {
          periodicSync?: { register: (t: string, o: object) => Promise<void> };
        })?.periodicSync;
        await ps?.register("yangin-kontrol", { minInterval: 30 * 60 * 1000 });
      } catch {
        /* desteklenmiyorsa sayfa açıkken çalışmaya devam eder */
      }
    }
    return r;
  }, []);

  // İzlenen noktaya yaklaşan YENİ olayları bildir
  useEffect(() => {
    if (permission !== "granted" || points.length === 0 || events.length === 0) return;

    const fresh: { ev: FireEvent; wp: WatchPoint; km: number }[] = [];
    for (const ev of events) {
      if (ev.status === "old" || ev.abroad) continue;
      if (seenRef.current.has(ev.id)) continue;
      for (const wp of points) {
        const km = havKm(wp.lon, wp.lat, ev.lon, ev.lat);
        if (km <= wp.radiusKm) {
          fresh.push({ ev, wp, km });
          break;
        }
      }
    }
    if (!fresh.length) return;

    fresh.forEach(({ ev, wp, km }) => seenRef.current.add(ev.id));
    try {
      localStorage.setItem(LS_SEEN, JSON.stringify([...seenRef.current].slice(-400)));
    } catch {
      /* yoksay */
    }

    (async () => {
      const reg = await navigator.serviceWorker?.ready.catch(() => null);
      for (const { ev, wp, km } of fresh.slice(0, 3)) {
        const title = `${wp.name}: ${Math.round(km)} km yakında yangın`;
        const body = `${ev.place} · ${Math.round(ev.frpLast)} MW · ${ev.count} uydu tespiti`;
        const opts: NotificationOptions = {
          body,
          icon: "/brand/algow-icon.png",
          badge: "/brand/favicon-48.png",
          tag: `yangin-${ev.id}`,
          data: { url: "/" },
        };
        if (reg) await reg.showNotification(title, opts);
        else new Notification(title, opts);
      }
    })();
  }, [events, points, permission]);

  return { points, add, remove, permission, requestPermission };
}
