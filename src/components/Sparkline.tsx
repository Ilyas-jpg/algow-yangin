import type { PassGroup } from "@/lib/types";

/** Geçiş başına FRP eğilimi — 64x16 mini çizgi. */
export default function Sparkline({ passes }: { passes: PassGroup[] }) {
  if (passes.length === 0) return null;
  const max = Math.max(...passes.map((p) => p.frp), 1);
  const W = 64;
  const H = 16;
  if (passes.length === 1) {
    return (
      <svg width={W} height={H} className="shrink-0" aria-hidden>
        <circle cx={W - 4} cy={H - 3 - (passes[0].frp / max) * (H - 6)} r="2" fill="#f97316" />
      </svg>
    );
  }
  const pts = passes
    .map((p, i) => {
      const x = 2 + (i / (passes.length - 1)) * (W - 4);
      const y = H - 2 - (p.frp / max) * (H - 5);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={W} height={H} className="shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke="#f97316" strokeWidth="1.3" />
    </svg>
  );
}
