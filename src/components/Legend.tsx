import Link from "next/link";

export default function Legend() {
  return (
    <div className="w-[212px] rounded-md border border-line bg-obsidian-1/95 p-2.5">
      <p className="text-[10px] text-ink-3">Tespit şiddeti (FRP, MW)</p>
      <div
        className="mt-1.5 h-1.5 rounded-sm"
        style={{
          background:
            "linear-gradient(90deg,#9a3412,#c2410c,#f97316,#fdba74,#fff1e0)",
        }}
      />
      <div className="mt-0.5 flex justify-between font-mono text-[8px] text-ink-3">
        <span>0</span>
        <span>40</span>
        <span>120</span>
        <span>300+</span>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden className="shrink-0">
          <path d="M1 6 L15 1 L15 11 Z" fill="#3d5bff" fillOpacity="0.35" stroke="#5872ff" strokeWidth="0.8" />
        </svg>
        <span className="text-[10px] leading-tight text-ink-2">
          Tahmini yönelim konisi (1·3·6 sa)
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden className="shrink-0">
          <circle cx="8" cy="6" r="2.2" fill="#f97316" />
          <circle cx="8" cy="6" r="4.6" fill="none" stroke="#fdba74" strokeOpacity="0.7" strokeWidth="1" />
        </svg>
        <span className="text-[10px] leading-tight text-ink-2">
          Son 6 saatte görülen tespit
        </span>
      </div>

      <p className="mt-2.5 border-t border-line pt-2 text-[10px] leading-relaxed text-ink-3">
        Uydu alev değil <span className="text-ink-2">ısı</span> görür: bacalar,
        santraller ve anız yakma da nokta olarak düşer. Her gün aynı yerde
        beliren nokta genelde sabit bir ısı kaynağıdır.
      </p>
      <Link
        href="/hakkinda"
        className="mt-1.5 block text-[10px] text-ink-3 transition-colors hover:text-ink"
      >
        Hatalar ve sınırlamalar →
      </Link>
    </div>
  );
}
