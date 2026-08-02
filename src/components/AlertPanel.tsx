"use client";

import { useState } from "react";
import type { WatchPoint } from "./useAlerts";
import type { UserLocation } from "@/lib/types";
import { fmtNum } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { useLocale, useT } from "./LocaleProvider";
import Rich from "./Rich";

interface AlertPanelProps {
  points: WatchPoint[];
  onAdd: (p: Omit<WatchPoint, "id">) => void;
  onRemove: (id: string) => void;
  permission: NotificationPermission;
  onRequestPermission: () => Promise<NotificationPermission>;
  userLoc: UserLocation | null;
  mapCenter: { lon: number; lat: number } | null;
  onClose: () => void;
}

const RADII = [10, 25, 50];

export default function AlertPanel({
  points,
  onAdd,
  onRemove,
  permission,
  onRequestPermission,
  userLoc,
  mapCenter,
  onClose,
}: AlertPanelProps) {
  const t = useT();
  const locale = useLocale();
  const [name, setName] = useState("");
  const [radius, setRadius] = useState(25);
  const [source, setSource] = useState<"konum" | "harita">(
    userLoc ? "konum" : "harita"
  );

  const coord = source === "konum" ? userLoc : mapCenter;
  const canAdd = Boolean(coord && name.trim());

  return (
    <div className="absolute inset-x-0 top-0 z-30 mx-auto w-[min(94vw,420px)] rounded-b-md border border-t-0 border-line bg-obsidian-1 p-3 shadow-xl md:left-[340px] md:mx-0 md:mt-0">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium">{t.alerts.heading}</h2>
        <button
          onClick={onClose}
          aria-label={t.common.close}
          className="rounded border border-line px-2 py-0.5 text-[11px] text-ink-3 hover:text-ink"
        >
          {t.common.close}
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-2">
        <Rich segs={t.alerts.intro} />
      </p>

      {permission !== "granted" && (
        <button
          onClick={onRequestPermission}
          className="mt-2 w-full rounded border border-cobalt/60 bg-cobalt/10 px-3 py-1.5 text-[12px] text-ink transition-colors hover:bg-cobalt/20"
        >
          {permission === "denied"
            ? t.alerts.permissionDenied
            : t.alerts.permissionAsk}
        </button>
      )}

      <div className="mt-3 space-y-2 border-t border-line pt-3">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.alerts.namePlaceholder}
            maxLength={24}
            className="min-w-0 flex-1 rounded border border-line bg-obsidian-2 px-2 py-1 text-[12px] text-ink placeholder:text-ink-3"
          />
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            aria-label={t.alerts.radiusAria}
            className="rounded border border-line bg-obsidian-2 px-2 py-1 font-mono text-[11px] text-ink"
          >
            {RADII.map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setSource("konum")}
            aria-pressed={source === "konum"}
            disabled={!userLoc}
            className={`flex-1 rounded border px-2 py-1 text-[11px] transition-colors disabled:opacity-40 ${
              source === "konum"
                ? "border-cobalt/60 bg-cobalt/10 text-ink"
                : "border-line text-ink-3"
            }`}
          >
            {t.alerts.fromLocation}
          </button>
          <button
            onClick={() => setSource("harita")}
            aria-pressed={source === "harita"}
            className={`flex-1 rounded border px-2 py-1 text-[11px] transition-colors ${
              source === "harita"
                ? "border-cobalt/60 bg-cobalt/10 text-ink"
                : "border-line text-ink-3"
            }`}
          >
            {t.alerts.fromMap}
          </button>
        </div>

        {coord && (
          <p className="font-mono text-[10px] text-ink-3">
            {fmtNum(coord.lat, 3, locale)}, {fmtNum(coord.lon, 3, locale)}
          </p>
        )}

        <button
          onClick={() => {
            if (!coord || !name.trim()) return;
            onAdd({ name: name.trim(), lon: coord.lon, lat: coord.lat, radiusKm: radius });
            setName("");
          }}
          disabled={!canAdd}
          className="w-full rounded border border-line bg-obsidian-3 px-3 py-1.5 text-[12px] text-ink transition-colors hover:bg-obsidian-2 disabled:opacity-40"
        >
          {t.alerts.add}
        </button>
      </div>

      {points.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-line pt-2">
          {points.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px]">{p.name}</span>
              <span className="shrink-0 font-mono text-[10px] text-ink-3">
                {p.radiusKm} km
              </span>
              <button
                onClick={() => onRemove(p.id)}
                aria-label={fill(t.alerts.removeAria, { name: p.name })}
                className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-3 hover:text-danger"
              >
                {t.alerts.remove}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 border-t border-line pt-2 text-[10px] leading-relaxed text-ink-3">
        {t.alerts.footer}
      </p>
    </div>
  );
}
