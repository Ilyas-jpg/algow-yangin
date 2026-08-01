"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoState } from "@/lib/types";

/**
 * Kullanıcının konumu — yalnızca tarayıcıda tutulur, hiçbir sunucuya gönderilmez.
 * Sahada hareket eden ekipler için sürekli izleme (watchPosition) kullanılır.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: "idle" });
  const watchRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setState({ status: "idle" });
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({
        status: "error",
        message: "Bu tarayıcı konum servisini desteklemiyor",
      });
      return;
    }
    setState({ status: "locating" });
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) =>
        setState({
          status: "ready",
          loc: {
            lon: pos.coords.longitude,
            lat: pos.coords.latitude,
            accuracy: pos.coords.accuracy,
            at: pos.timestamp,
          },
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({ status: "denied" });
        } else {
          setState({
            status: "error",
            message:
              err.code === err.TIMEOUT
                ? "Konum alınamadı — açık alanda tekrar deneyin"
                : "Konum servisi şu an yanıt vermiyor",
          });
        }
        if (watchRef.current !== null) {
          navigator.geolocation.clearWatch(watchRef.current);
          watchRef.current = null;
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, []);

  const toggle = useCallback(() => {
    if (watchRef.current !== null) stop();
    else start();
  }, [start, stop]);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  return { state, toggle, stop };
}
