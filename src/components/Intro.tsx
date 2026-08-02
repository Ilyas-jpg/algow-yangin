"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { useT } from "./LocaleProvider";

const KEY = "algow-yangin-intro-v1";
/** globals.css'teki --intro-hold + --intro-out ile aynı olmalı */
const TOPLAM_MS = 2850;

/**
 * Açılış perdesi.
 *
 * Bu bir yangın haritası: perde hiçbir koşulda erişimi geciktirmemeli.
 * Bu yüzden ① harita perdenin altında aynı anda kuruluyor, ② herhangi
 * bir dokunuş/tuş/tekerlek perdeyi anında kaldırıyor, ③ oturumda bir kez
 * gösteriliyor, ④ hareket azaltma açıksa, bağlantı zayıfsa veya gömme
 * görünümündeysek hiç gösterilmiyor.
 */
export default function Intro() {
  const t = useT();

  // Karar ilk render'da veriliyor: bileşen zaten yalnız tarayıcıda
  // çalışıyor (ssr:false), sonradan açmak haritanın üstüne geç düşen
  // bir perde demek olurdu.
  const [acik, setAcik] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      if (sessionStorage.getItem(KEY)) return false;
    } catch {
      /* depolama kapalı — perdeyi bir kez göstermek zararsız */
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
    const c = (
      navigator as Navigator & {
        connection?: { effectiveType?: string; saveData?: boolean };
      }
    ).connection;
    if (c?.saveData || c?.effectiveType === "2g" || c?.effectiveType === "slow-2g") {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (!acik) return;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* yoksay */
    }

    const kapat = () => setAcik(false);
    const zamanlayici = setTimeout(kapat, TOPLAM_MS);
    const opsiyon = { passive: true, once: true } as const;
    window.addEventListener("pointerdown", kapat, opsiyon);
    window.addEventListener("keydown", kapat, opsiyon);
    window.addEventListener("wheel", kapat, opsiyon);
    window.addEventListener("touchstart", kapat, opsiyon);
    return () => {
      clearTimeout(zamanlayici);
      window.removeEventListener("pointerdown", kapat);
      window.removeEventListener("keydown", kapat);
      window.removeEventListener("wheel", kapat);
      window.removeEventListener("touchstart", kapat);
    };
  }, [acik]);

  if (!acik) return null;

  return (
    <div className="intro" role="presentation">
      <div className="intro__stage">
        <picture>
          <source srcSet="/intro/bg-900.webp" media="(max-width: 720px)" />
          <img
            className="intro__bg"
            src="/intro/bg-1600.webp"
            alt=""
            aria-hidden
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <div className="intro__veil" aria-hidden />

        <div className="intro__icerik">
          {/* Söz iki dilde de ORİJİNAL tasarımıyla duruyor: dizilmiş harf
              formları işin kendisi, canlı metinle taklidi tasarımı bozar.
              İngilizce karşılığı yalnız alt metninde — ekran okuyucu ve
              görsel yüklenmediğinde anlam kaybolmasın. */}
          <img
            className="intro__soz"
            src="/intro/soz.webp"
            alt={t.intro.alt}
            width={816}
            height={160}
            fetchPriority="high"
            decoding="async"
          />
          {/* Gerçek marka asset'i — wordmark metinle yazılmaz */}
          <img
            className="intro__mark"
            src="/brand/algow-wordmark.webp"
            alt="Algow"
            decoding="async"
          />
        </div>
      </div>

      <button
        type="button"
        className="intro__gec"
        onClick={() => setAcik(false)}
      >
        {t.intro.skip}
      </button>
    </div>
  );
}
