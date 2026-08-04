"use client";

import { useMemo, useState } from "react";
import type { FireEvent, WindPoint } from "@/lib/types";
import { foldTr } from "@/lib/slug";
import type { ConeGeom } from "@/lib/wind";
import { targetsInDirection } from "@/lib/cone-places";
import type { Footprint } from "@/lib/footprint";
import { compass } from "@/lib/geo";
import { angDiff, fmtAgo, fmtDayTime, fmtNum } from "@/lib/format";
import { fmtNext, type PassInfo } from "@/lib/passes";
import { fill, type Locale } from "@/lib/i18n";
import type { Dict } from "@/i18n/tr";
import { useLocale, useT } from "./LocaleProvider";
import Rich from "./Rich";
import Sparkline from "./Sparkline";
import ShareButton from "./ShareButton";
import SmokeForecast from "./SmokeForecast";

const STATUS_CLS: Record<FireEvent["status"], string> = {
  active: "border-danger/50 text-danger",
  waning: "border-warn/50 text-warn",
  old: "border-line text-ink-3",
};

/**
 * FRP eğilimi — GEÇMİŞİ anlatır, geleceği DEĞİL.
 *
 * Eskiden "büyüyor / geriliyor" yazıyordu ve bu bir tahmin gibi okunuyordu.
 * 820 vaka / 210 yangınla sınandı (2026-08-02): rozetin ayırt etme gücü
 * AUC 0,502 — yani yazı tura. "Büyüyor" etiketli yangın, "geriliyor"
 * etiketliden daha fazla ilerlemiyor (ortanca 0,76 km vs 0,93 km); üstelik
 * "büyüyor" diyenin FRP'si sonraki geçişte düşüyor (0,67×), "geriliyor"
 * diyeninki yükseliyor (1,64×) — klasik ortalamaya dönüş.
 *
 * Bu yüzden etiket, olduğu şeye çevrildi: ölçülen ısının nasıl değiştiğinin
 * TARİFİ. Alternatif kural (son iki geçişin oranı) da denendi, o da ayırmadı.
 */
function trendOf(
  ev: FireEvent
): { key: "up" | "down" | "flat"; cls: string } | null {
  if (ev.passes.length < 2) return null;
  const a = ev.passes[0].frp;
  const b = ev.passes[ev.passes.length - 1].frp;
  if (b > a * 1.25) return { key: "up", cls: "text-danger" };
  if (b < a * 0.75) return { key: "down", cls: "text-ok" };
  return { key: "flat", cls: "text-ink-2" };
}

interface EventPanelProps {
  events: FireEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  now: number;
  live: boolean;
  weather: WindPoint | undefined;
  weatherLoading: boolean;
  weatherError: boolean;
  cones: ConeGeom[];
  /** CORINE yakıt sınıfı — anız yangınını orman yangınından ayırmak için */
  fuel?: string | null;
  /** Uydunun sıcak gördüğü alan — resmî yanan alan DEĞİL (bkz. lib/footprint) */
  footprint?: Footprint | null;
  pass?: PassInfo;
  /** Açık olan zaman penceresi (1|2|5) — paylaşım bağlantısına yazılır */
  days: string;
  /** Anız (tarım) süzgeci — katman değil liste süzgeci olduğu için burada */
  hideFarm: boolean;
  onHideFarm: () => void;
  hiddenFarmCount: number;
  fuelLoading: boolean;
}

/** Yakıt sınıfının uyarı gerektirip gerektirmediği — metin sözlükte. */
const FUEL_WARN: Record<string, boolean> = {
  ORMAN: false,
  MAKI: false,
  OT: false,
  TARIM: true,
  YAPI: true,
  CIPLAK: false,
  SU: true,
};

export default function EventPanel(props: EventPanelProps) {
  const t = useT();
  const locale = useLocale();
  const { events, now, hideFarm, onHideFarm, hiddenFarmCount, fuelLoading } =
    props;
  const [q, setQ] = useState("");
  // Sabit ısı kaynakları (rafineri, çelik, santral) yangın değil — sayacı
  // şişiriyorlardı. Haritada kalıyorlar ama "aktif yangın" sayılmıyorlar.
  // `lowConfidence`: tüm tespitleri düşük güvenli GÜNDÜZ kaydı olan olay
  // (güneş yansıması en olası açıklama). Listede duruyor, sayaca girmiyor.
  const activeCount = events.filter(
    (e) =>
      e.status === "active" && !e.abroad && !e.fixedSource && !e.lowConfidence
  ).length;
  const fixedCount = events.filter((e) => e.fixedSource && !e.abroad).length;
  const abroadCount = events.filter((e) => e.abroad).length;

  /**
   * İl/ilçe araması. Yüzlerce olay arasında kendi bölgesini arayan kullanıcı
   * listeyi tek tek tarayamıyordu. Katlama Türkçe'ye duyarlı: "cine" → "Çine",
   * "IZMIR" → "İzmir" (bkz. lib/slug). Yer adları iki dilde de Türkçe
   * olduğu için katlama İngilizce arayüzde de aynı çalışıyor.
   */
  const filtered = useMemo(() => {
    const k = foldTr(q.trim());
    if (!k) return events;
    return events.filter(
      (e) => foldTr(e.place).includes(k) || foldTr(e.il).includes(k)
    );
  }, [events, q]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-baseline justify-between border-b border-line px-3 py-2.5">
        <span className="text-xs text-ink-2">{t.panel.activeHere}</span>
        <span
          className="font-mono text-[11px] text-ink-3"
          title={fill(t.panel.abroadTitle, { n: abroadCount })}
        >
          <span className="text-danger">{activeCount}</span>
          {fill(t.panel.counts, { events: events.length - abroadCount })}
          {fixedCount > 0 && fill(t.panel.fixedCount, { n: fixedCount })}
          {abroadCount > 0 && fill(t.panel.abroadCount, { n: abroadCount })}
        </span>
      </div>

      {events.length > 0 && (
        <div className="relative border-b border-line px-3 py-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.panel.searchPlaceholder}
            aria-label={t.panel.searchAria}
            className="w-full rounded border border-line bg-obsidian-2 px-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-3 focus-visible:border-cobalt/60"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button
              onClick={onHideFarm}
              aria-pressed={hideFarm}
              title={t.panel.hideFarmTitle}
              className={`shrink-0 rounded border px-2 py-0.5 text-[10px] transition-colors active:scale-[0.98] ${
                hideFarm
                  ? "border-cobalt/60 bg-cobalt/10 text-ink"
                  : "border-line text-ink-3 hover:text-ink-2"
              }`}
            >
              {t.panel.hideFarm}
              {hideFarm && !fuelLoading && hiddenFarmCount > 0
                ? ` · ${hiddenFarmCount}`
                : ""}
            </button>
            {hideFarm && fuelLoading && (
              <span className="font-mono text-[10px] text-ink-3">
                {t.panel.fuelLoading}
              </span>
            )}
            {q.trim() !== "" && (
              <span className="ml-auto font-mono text-[10px] text-ink-3">
                {fill(t.panel.matches, { n: filtered.length })}
              </span>
            )}
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="px-3 py-6 text-xs leading-relaxed text-ink-3">
          {t.panel.empty}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-3 py-6 text-xs leading-relaxed text-ink-3">
          <Rich segs={t.panel.noMatch} vars={{ q: q.trim() }} />
        </div>
      ) : (
        <ul className="scroll-slim min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto">
          {filtered.map((ev) => (
            <EventCard
              key={ev.id}
              ev={ev}
              {...props}
              ago={fmtAgo(ev.lastSeen, now, locale)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EventCard({
  ev,
  ago,
  selectedId,
  onSelect,
  live,
  weather,
  weatherLoading,
  weatherError,
  cones,
  fuel,
  footprint,
  pass,
  days,
}: EventPanelProps & { ev: FireEvent; ago: string }) {
  const t = useT();
  const locale = useLocale();
  const selected = ev.id === selectedId;
  const trend = trendOf(ev);
  const cone = cones.find((c) => c.eventId === ev.id);

  return (
    <li>
      <button
        onClick={() => onSelect(selected ? null : ev.id)}
        className={`block w-full px-3 py-2.5 text-left transition-colors ${
          selected
            ? "bg-obsidian-2 shadow-[inset_2px_0_0_0_var(--color-cobalt)]"
            : "hover:bg-obsidian-2/60"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
            {ev.place}
          </span>
          {ev.abroad && (
            <span className="shrink-0 rounded border border-line px-1.5 py-px font-mono text-[9px] tracking-wide text-ink-3">
              {t.card.abroad}
            </span>
          )}
          {/* Sensör doyması: ölçülen FRP gerçeğin ALT sınırı. Sabit ısı
              kaynağında gösterilmiyor — baca da doyurur, "şiddetli yangın"
              diye okunması yanlış olurdu. */}
          {ev.saturated && !ev.fixedSource && (
            <span
              className="shrink-0 rounded border border-danger/60 px-1.5 py-px font-mono text-[9px] tracking-wide text-danger"
              title={t.card.saturatedTitle}
            >
              {t.card.saturated}
            </span>
          )}
          <span
            className={`shrink-0 rounded border px-1.5 py-px font-mono text-[9px] tracking-wide ${
              ev.fixedSource ? "border-ink-3/50 text-ink-3" : STATUS_CLS[ev.status]
            }`}
          >
            {ev.fixedSource ? t.card.fixedSource : t.card.status[ev.status]}
          </span>
        </div>
        <div className="mt-1 font-mono text-[11px] text-ink-2">
          {fill(t.card.meta, {
            count: ev.count,
            mw: fmtNum(ev.frpLast, 0, locale),
            ago,
          })}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Sparkline passes={ev.passes} />
          {trend && (
            <span className={`font-mono text-[10px] ${trend.cls}`}>
              {t.card.trend[trend.key]}
            </span>
          )}
          {ev.drift && (
            <span className="ml-auto font-mono text-[10px] text-ink-2">
              {fill(t.card.drift, {
                dir: compass(ev.drift.bearingDeg, locale),
                km: fmtNum(ev.drift.km, 1, locale),
              })}
            </span>
          )}
        </div>
      </button>

      {selected && (
        <div className="border-t border-line/60 bg-obsidian-2/50 px-3 py-2.5">
          <FireWeather
            weather={weather}
            loading={weatherLoading}
            error={weatherError}
          />
          {/* Anlık PM2.5 yukarıda; asıl merak edilen "ne zaman kötüleşecek" */}
          <SmokeForecast lat={ev.lat} lon={ev.lon} />
          <Assessment
            ev={ev}
            weather={weather}
            cone={cone}
            live={live}
            fuel={selected ? fuel : null}
            footprint={selected ? footprint : null}
            pass={pass}
            t={t}
            locale={locale}
          />
          {ev.passes.length >= 3 && ev.drift === null && (
            <p className="mt-2 rounded border border-line bg-obsidian-3/60 px-2 py-1.5 text-[10px] leading-relaxed text-ink-2">
              {fill(t.card.stationary, { n: ev.passes.length })}
            </p>
          )}
          <div className="mt-2 flex justify-end">
            <ShareButton ev={ev} days={days} />
          </div>
          <p className="mt-2 border-t border-line/60 pt-2 text-[10px] leading-relaxed text-ink-3">
            <Rich segs={t.card.disclaimer} />
          </p>
        </div>
      )}
    </li>
  );
}

function FireWeather({
  weather,
  loading,
  error,
}: {
  weather: WindPoint | undefined;
  loading: boolean;
  error: boolean;
}) {
  const t = useT();
  const locale = useLocale();

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3.5 animate-pulse rounded-sm bg-obsidian-3" />
        ))}
      </div>
    );
  }
  if (error || !weather) {
    return <p className="text-[11px] text-ink-3">{t.weather.unavailable}</p>;
  }
  const FWI_CLS = [
    "text-ok",
    "text-ok",
    "text-ink",
    "text-warn",
    "text-danger",
    "text-danger",
  ];
  const aqiCls =
    weather.aqi === null
      ? undefined
      : weather.aqi > 150
        ? "text-danger"
        : weather.aqi > 100
          ? "text-warn"
          : undefined;

  const rows: { k: string; v: string; cls?: string }[] = [
    {
      // Yön eki kritik: hemen altındaki tahmin yangının GİDECEĞİ yönü
      // veriyor. Ek olmadan iki zıt pusula yan yana okunup ters anlaşılıyordu.
      k: t.weather.wind,
      v:
        weather.windKmh !== null && weather.windDirDeg !== null
          ? fill(t.weather.windValue, {
              dir: compass(weather.windDirDeg, locale),
              n: fmtNum(weather.windKmh, 0, locale),
            })
          : "—",
    },
    {
      k: t.weather.gust,
      v:
        weather.gustKmh !== null
          ? fill(t.weather.gustValue, { n: fmtNum(weather.gustKmh, 0, locale) })
          : "—",
    },
    {
      k: t.weather.humidity,
      v:
        weather.rh !== null
          ? fill(t.weather.humidityValue, { n: fmtNum(weather.rh, 0, locale) })
          : "—",
      cls: weather.rh !== null && weather.rh < 30 ? "text-warn" : undefined,
    },
    {
      k: t.weather.temp,
      v:
        weather.tempC !== null
          ? fill(t.weather.tempValue, { n: fmtNum(weather.tempC, 0, locale) })
          : "—",
    },
    {
      k: t.weather.vpd,
      v:
        weather.vpdKpa !== null
          ? fill(t.weather.vpdValue, { n: fmtNum(weather.vpdKpa, 2, locale) })
          : "—",
      cls:
        weather.vpdKpa !== null && weather.vpdKpa > 1.6
          ? "text-danger"
          : undefined,
    },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {rows.map((r) => (
          <div key={r.k} className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] text-ink-3">{r.k}</span>
            <span className={`font-mono text-[11px] ${r.cls ?? "text-ink"}`}>
              {r.v}
            </span>
          </div>
        ))}
      </div>

      {/* Yakıt kuruluğu ve duman — ham veriden karara */}
      {(weather.fwi || weather.pm25 !== null) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/60 pt-2">
          {weather.fwi && (
            <div
              className="flex items-baseline gap-1.5"
              title={fill(t.weather.fwiTitle, {
                ffmc: weather.fwi.ffmc,
                dmc: weather.fwi.dmc,
                dc: weather.fwi.dc,
                isi: weather.fwi.isi,
                bui: weather.fwi.bui,
                days: weather.fwi.days,
              })}
            >
              <span className="text-[10px] text-ink-3">{t.weather.fwi}</span>
              <span className={`font-mono text-[11px] ${FWI_CLS[weather.fwi.level]}`}>
                {fmtNum(weather.fwi.fwi, 1, locale)}
              </span>
              <span className={`text-[10px] ${FWI_CLS[weather.fwi.level]}`}>
                {t.fwiLevels[weather.fwi.level]}
              </span>
            </div>
          )}
          {weather.pm25 !== null && (
            <div className="flex items-baseline gap-1.5" title={t.weather.smokeTitle}>
              <span className="text-[10px] text-ink-3">{t.weather.smoke}</span>
              <span className={`font-mono text-[11px] ${aqiCls ?? "text-ink"}`}>
                {fill(t.weather.smokeValue, {
                  n: fmtNum(weather.pm25, 0, locale),
                })}
              </span>
              {weather.aqi !== null && (
                <span className={`text-[10px] ${aqiCls ?? "text-ink-3"}`}>
                  AQI {fmtNum(weather.aqi, 0, locale)}
                </span>
              )}
            </div>
          )}
          {weather.terrain && (
            <div
              className="flex items-baseline gap-1.5"
              title={t.weather.terrainTitle}
            >
              <span className="text-[10px] text-ink-3">{t.weather.terrain}</span>
              <span className="font-mono text-[11px] text-ink">
                {fill(t.weather.terrainValue, {
                  m: fmtNum(weather.terrain.elevM, 0, locale),
                  slope: fmtNum(weather.terrain.slopePct, 0, locale),
                })}
              </span>
              {weather.terrain.slopePct >= 10 && (
                <span className="text-[10px] text-warn">
                  {fill(t.weather.upslope, {
                    dir: compass(weather.terrain.upslopeDeg, locale),
                  })}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Assessment({
  ev,
  weather,
  cone,
  live,
  fuel,
  footprint,
  pass,
  t,
  locale,
}: {
  ev: FireEvent;
  weather: WindPoint | undefined;
  cone: ConeGeom | undefined;
  live: boolean;
  fuel?: string | null;
  footprint?: Footprint | null;
  pass?: PassInfo;
  t: Dict;
  locale: Locale;
}) {
  const lines: React.ReactNode[] = [];

  /**
   * Sabit ısı kaynağı — gizlemiyoruz, açıklıyoruz.
   * Kullanıcı haritada her gün aynı yerde duran sarı noktayı görüyor ve
   * "burası neden hep yanıyor" diye soruyor. Cevabı burada veriyoruz.
   */
  if (ev.fixedSource) {
    lines.push(
      <span key="sabit" className="text-ink-3">
        <Rich segs={t.assess.fixed} vars={{ days: ev.fixedSource.days }} />
      </span>
    );
  }

  // "Kaç hektar yandı" haberin ilk sorusu. Ölçebildiğimiz şey yanan alan
  // değil, uydunun ısı gördüğü alan — adı da öyle konuyor.
  if (footprint) {
    lines.push(
      <span key="alan">
        <Rich
          segs={t.assess.footprint}
          vars={{
            ha: fmtNum(footprint.ha, 0, locale),
            cells: footprint.cells,
          }}
        />
      </span>
    );
  }

  // Yakıt: kullanıcı en çok "bu orman yangını mı, anız mı" diye merak ediyor.
  const f = fuel ? t.fuel[fuel as keyof Dict["fuel"]] : null;
  if (f) {
    lines.push(
      <span key="fuel" className={FUEL_WARN[fuel!] ? "text-warn" : undefined}>
        <Rich segs={t.assess.fuelLine} vars={{ ad: f.ad, not: f.not }} />
      </span>
    );
  }

  // Isı eğilimi geleceği haber vermiyor (AUC 0,502); kullanıcı bunu
  // büyüme tahmini sanmasın diye açıkça yazıyoruz.
  const trend = ev.passes.length >= 2 ? trendOf(ev) : null;
  if (trend && trend.key === "up") {
    lines.push(
      <span key="isi" className="text-ink-3">
        <Rich segs={t.assess.heatUp} />
      </span>
    );
  }

  // "Tespit yok" ≠ "yangın bitti": kullanıcı kör aralıkta olduğunu bilsin.
  if (live && pass?.inGap && pass.nextH !== null) {
    lines.push(
      <span key="gap" className="text-warn">
        {fill(t.assess.gap, { next: fmtNext(pass.nextH, locale) })}
      </span>
    );
  }

  // Geçmiş: nereden çıktı, ne kadar süredir yanıyor
  const yanmaSaati = Math.max(0.5, (ev.lastSeen - ev.firstSeen) / 3600_000);
  lines.push(
    <span key="gecmis">
      <Rich
        segs={t.assess.history}
        vars={{
          first: fmtDayTime(ev.firstSeen, locale),
          passes: ev.passes.length,
          span:
            yanmaSaati < 24
              ? fill(t.assess.spanHours, { n: fmtNum(yanmaSaati, 0, locale) })
              : fill(t.assess.spanDays, {
                  n: fmtNum(yanmaSaati / 24, 1, locale),
                }),
        }}
      />
    </span>
  );

  if (ev.drift) {
    const hours = Math.max(0.5, ev.drift.spanMs / 3600_000);
    lines.push(
      <span key="drift">
        <Rich
          segs={t.assess.drift}
          vars={{
            from: compass((ev.drift.bearingDeg + 180) % 360, locale),
            to: compass(ev.drift.bearingDeg, locale),
            km: fmtNum(ev.drift.km, 1, locale),
            hours: fmtNum(hours, 0, locale),
          }}
        />
      </span>
    );
  } else if (ev.passes.length >= 2) {
    // Sürüklenme eşiğin altında kaldı — sessiz kalmak yerine sebebini söyle
    lines.push(
      <span key="nodrift" className="text-ink-3">
        {t.assess.noDrift}
      </span>
    );
  }

  if (cone) {
    /* 2026-08-02 doğrulama (6 sezon, 232 orman/maki ilerlemesi):
       rüzgâr+eğim bileşkesi rastgeleden iyi ama ortanca hata 68°.
       Yarım açı ve yarıçap artık gözlenen dağılımdan geliyor. */
    lines.push(
      <span key="cone">
        <Rich
          segs={t.assess.cone}
          vars={{ dir: compass(cone.spreadDeg, locale) }}
        />
        {cone.isDisc ? (
          <span className="text-warn">{t.assess.coneWeak}</span>
        ) : (
          fill(t.assess.coneSpread, { deg: Math.round(cone.halfAngle) })
        )}
      </span>
    );
    lines.push(
      <span key="cone-mean" className="text-ink-3">
        <Rich segs={t.assess.coneMean} />
      </span>
    );
    /**
     * Koninin işaret ettiği yerleşimler.
     *
     * Koni haritada zaten var ama haritaya bakmayan biri için soyut kalıyor;
     * yer adı "bana doğru mu geliyor" sorusunu okunur kılıyor.
     * Dil bilerek nötr: yönelim bildirimi, TAHLİYE DEĞİL.
     */
    const hedefler = targetsInDirection(cone);
    if (hedefler.length > 0) {
      lines.push(
        <span key="cone-places">
          {fill(t.assess.conePlaces, {
            yerler: hedefler
              .map((p) =>
                fill(t.assess.conePlacesItem, {
                  ad: p.name,
                  km: fmtNum(p.km, 0, locale),
                })
              )
              .join(" · "),
          })}
          <span className="text-ink-3"> {t.assess.conePlacesNote}</span>
        </span>
      );
    }
    // Rüzgârın dönmesi, doğrulama testinde tahmin hatasının kalemlerinden
    // biriydi; halkalar artık saatlik tahminle çiziliyor, kullanıcı görsün.
    if (cone.driftDeg >= 30) {
      lines.push(
        <span key="wind-turn" className="text-warn">
          <Rich
            segs={t.assess.windTurn}
            vars={{ deg: Math.round(cone.driftDeg) }}
          />
        </span>
      );
    }
    if (ev.drift && cone.isDisc) {
      // Daire modunda ortada bir yön iddiası yok; en güvenilir sinyal gözlem.
      lines.push(
        <span key="obs" className="text-ok">
          <Rich
            segs={t.assess.observed}
            vars={{ dir: compass(ev.drift.bearingDeg, locale) }}
          />
        </span>
      );
    } else if (ev.drift) {
      const d = angDiff(ev.drift.bearingDeg, cone.spreadDeg);
      lines.push(
        d <= 45 ? (
          <span key="agree" className="text-ok">
            {t.assess.agree}
          </span>
        ) : (
          <span key="dis" className="text-warn">
            <Rich segs={t.assess.disagree} />
          </span>
        )
      );
    }
    // Dik yamaçta alevler rüzgârdan bağımsız tırmanır — doğrulama testimizde
    // koninin yanılma sebeplerinden biri buydu, kullanıcı bilsin.
    if (weather?.terrain && weather.terrain.slopePct >= 15) {
      const d = angDiff(weather.terrain.upslopeDeg, cone.spreadDeg);
      if (d > 60) {
        lines.push(
          <span key="slope" className="text-warn">
            {fill(t.assess.slope, {
              slope: fmtNum(weather.terrain.slopePct, 0, locale),
              dir: compass(weather.terrain.upslopeDeg, locale),
            })}
          </span>
        );
      }
    }
  } else if (!live) {
    lines.push(
      <span key="past" className="text-ink-3">
        {t.assess.past}
      </span>
    );
  } else if (weather && weather.windKmh !== null && weather.windKmh < 4) {
    lines.push(
      <span key="calm" className="text-ink-3">
        {t.assess.calm}
      </span>
    );
  }

  if (lines.length === 0) return null;
  return (
    <div className="mt-2 space-y-1 border-t border-line/60 pt-2 text-[11px] leading-relaxed text-ink-2">
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  );
}
