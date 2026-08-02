"use client";

import { useState } from "react";
import type { FireEvent } from "@/lib/types";
import { eventPath } from "@/lib/share";
import { fmtNum } from "@/lib/format";

/**
 * Bir yangını paylaşmak.
 *
 * Mobilde yerel paylaşım sayfası (WhatsApp/Telegram/mesaj), masaüstünde
 * panoya kopyalama. Büyük yangınlarda insanlar linki birbirine yolluyor;
 * bunu yapamamak platformun en büyük erişim kaybıydı.
 */
export default function ShareButton({
  ev,
  days,
}: {
  ev: FireEvent;
  /** Paylaşanın açık olan zaman penceresi — bağlantıda taşınır */
  days: string;
}) {
  const [durum, setDurum] = useState<"hazir" | "kopyalandi" | "hata">("hazir");

  const paylas = async () => {
    const url = new URL(eventPath(ev, days), window.location.origin).toString();
    const baslik = `${ev.place} — ${fmtNum(ev.frpLast)} MW yangın tespiti`;
    const metin = `${baslik} · Algow Yangın haritasında`;

    // navigator.share yalnız güvenli bağlamda ve kullanıcı hareketiyle çalışır;
    // desteklenmiyorsa ya da kullanıcı vazgeçerse panoya düşüyoruz.
    if (navigator.share) {
      try {
        await navigator.share({ title: baslik, text: metin, url });
        return;
      } catch (e) {
        // AbortError = kullanıcı paylaşım sayfasını kapattı, hata değil
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setDurum("kopyalandi");
      setTimeout(() => setDurum("hazir"), 2200);
    } catch {
      setDurum("hata");
      setTimeout(() => setDurum("hazir"), 2800);
    }
  };

  return (
    <button
      onClick={paylas}
      className="flex shrink-0 items-center gap-1.5 rounded border border-line px-2 py-1 text-[10px] text-ink-2 transition-colors hover:border-cobalt/60 hover:text-ink active:scale-[0.98]"
    >
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
        <path
          d="M8.4 3.9a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8ZM3.6 7.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Zm4.8 3.5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8ZM4.8 5.7l2.4-1.2M4.8 6.3l2.4 1.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>
      {durum === "kopyalandi"
        ? "bağlantı kopyalandı"
        : durum === "hata"
          ? "kopyalanamadı"
          : "Paylaş"}
    </button>
  );
}
