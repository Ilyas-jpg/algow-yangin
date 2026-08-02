"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { FireEvent } from "@/lib/types";
import type { FuelPoint } from "@/app/api/fuel/route";

const CHUNK = 60;
const CHUNKS = 3; // en fazla 180 olay sınıflandırılır

/** 0,05°'ye yuvarlanmış anahtar — /api/fuel ile aynı ızgara. */
export function fuelKey(lon: number, lat: number): string {
  return `${(Math.round(lon * 20) / 20).toFixed(2)},${(Math.round(lat * 20) / 20).toFixed(2)}`;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface FuelResult {
  /** ızgara anahtarı → yakıt sınıfı (null = CORINE kapsamı dışı) */
  map: Map<string, string | null>;
  /** sınıflandırma isteği tamamlandı mı */
  loading: boolean;
  /** sınırın dışında kalıp hiç sorulmamış olay sayısı */
  unclassified: number;
}

/**
 * Olayların arazi örtüsü — anız süzgeci için.
 *
 * Yalnız süzgeç açıkken istek atılır: kapalıyken kimseye maliyeti yok.
 * Üst sınır bilinçli (180 olay): yoğun anız günlerinde 400+ olay olabiliyor
 * ve hepsini sınıflandırmak upstream'i zorlar. Sınırın dışında kalanlar
 * gizlenmez ve arayüzde kaç tanesinin sorulamadığı yazılır — sessizce
 * "temizlenmiş" bir harita göstermek yanıltıcı olurdu.
 */
export function useFuel(events: FireEvent[], enabled: boolean): FuelResult {
  const keys = useMemo(() => {
    if (!enabled) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of events) {
      const k = fuelKey(e.lon, e.lat);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(k);
      if (out.length >= CHUNK * CHUNKS) break;
    }
    return out;
  }, [events, enabled]);

  const urls = useMemo(() => {
    const out: (string | null)[] = [];
    for (let i = 0; i < CHUNKS; i++) {
      const dilim = keys.slice(i * CHUNK, (i + 1) * CHUNK);
      out.push(dilim.length ? `/api/fuel?pts=${dilim.join("|")}` : null);
    }
    return out;
  }, [keys]);

  // Kanca sayısı sabit olmalı → dilim sayısı kadar sabit SWR çağrısı
  const o = { revalidateOnFocus: false, revalidateIfStale: false, refreshInterval: 0 };
  const a = useSWR<{ points: FuelPoint[] }>(urls[0], fetcher, o);
  const b = useSWR<{ points: FuelPoint[] }>(urls[1], fetcher, o);
  const c = useSWR<{ points: FuelPoint[] }>(urls[2], fetcher, o);

  return useMemo(() => {
    const map = new Map<string, string | null>();
    for (const r of [a.data, b.data, c.data]) {
      for (const p of r?.points ?? []) map.set(fuelKey(p.lon, p.lat), p.fuel);
    }
    const bekleyen = urls.filter(Boolean).length;
    const gelen = [a.data, b.data, c.data].filter(Boolean).length;
    return {
      map,
      loading: enabled && gelen < bekleyen,
      unclassified: enabled
        ? events.filter((e) => !map.has(fuelKey(e.lon, e.lat))).length
        : 0,
    };
  }, [a.data, b.data, c.data, urls, enabled, events]);
}
