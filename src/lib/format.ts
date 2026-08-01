const TZ = "Europe/Istanbul";

const clockFmt = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

const dayTimeFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

export const fmtClock = (ms: number) => clockFmt.format(ms);
export const fmtDayTime = (ms: number) => dayTimeFmt.format(ms);

export function fmtAgo(ms: number, now: number): string {
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  if (m < 60) return `${m} dk önce`;
  const h = m / 60;
  if (h < 24) return `${h < 10 ? h.toFixed(1).replace(".", ",") : Math.round(h)} sa önce`;
  return `${Math.round(h / 24)} g önce`;
}

export const fmtNum = (n: number, digits = 0) =>
  n.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/** iki yön arasındaki mutlak açı farkı (0-180) */
export function angDiff(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}
