"use client";

import type { FireEvent, WindPoint } from "@/lib/types";
import type { ConeGeom } from "@/lib/wind";
import { compassTr } from "@/lib/geo";
import { angDiff, fmtAgo, fmtDayTime, fmtNum } from "@/lib/format";
import { fmtNext, type PassInfo } from "@/lib/passes";
import Sparkline from "./Sparkline";

const STATUS_LABEL: Record<FireEvent["status"], { text: string; cls: string }> = {
  active: { text: "AKTİF", cls: "border-danger/50 text-danger" },
  waning: { text: "SÖNÜYOR", cls: "border-warn/50 text-warn" },
  old: { text: "ESKİ", cls: "border-line text-ink-3" },
};

function trendOf(ev: FireEvent): { text: string; cls: string } | null {
  if (ev.passes.length < 2) return null;
  const a = ev.passes[0].frp;
  const b = ev.passes[ev.passes.length - 1].frp;
  if (b > a * 1.25) return { text: "büyüyor", cls: "text-danger" };
  if (b < a * 0.75) return { text: "geriliyor", cls: "text-ok" };
  return { text: "yatay", cls: "text-ink-2" };
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
  pass?: PassInfo;
}

/** Yakıt sınıfının insan diliyle karşılığı + neden önemli olduğu */
const FUEL_LABEL: Record<string, { ad: string; not: string; uyari: boolean }> = {
  ORMAN: { ad: "Ormanlık", not: "ağaçlık örtü", uyari: false },
  MAKI: { ad: "Makilik", not: "sert yapraklı çalı", uyari: false },
  OT: { ad: "Otlak", not: "çayır/bozkır", uyari: false },
  TARIM: {
    ad: "Tarım alanı",
    not: "büyük olasılıkla anız yakma — orman yangını değil",
    uyari: true,
  },
  YAPI: { ad: "Yerleşim/sanayi", not: "baca veya tesis ısısı olabilir", uyari: true },
  CIPLAK: { ad: "Çıplak arazi", not: "seyrek bitki örtüsü", uyari: false },
  SU: { ad: "Su yüzeyi", not: "büyük olasılıkla yanlış pozitif", uyari: true },
};

export default function EventPanel(props: EventPanelProps) {
  const { events, selectedId, onSelect, now } = props;
  const activeCount = events.filter(
    (e) => e.status === "active" && !e.abroad
  ).length;
  const abroadCount = events.filter((e) => e.abroad).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-baseline justify-between border-b border-line px-3 py-2.5">
        <span className="text-xs text-ink-2">Türkiye&apos;de aktif</span>
        <span
          className="font-mono text-[11px] text-ink-3"
          title={`${abroadCount} olay komşu ülkelerde (uydu görüş alanı sınırla bitmiyor)`}
        >
          <span className="text-danger">{activeCount}</span> aktif ·{" "}
          {events.length - abroadCount} olay
          {abroadCount > 0 && ` · +${abroadCount} sınır ötesi`}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="px-3 py-6 text-xs leading-relaxed text-ink-3">
          Seçili zaman penceresinde uydu tespiti yok. Pencereyi genişletmeyi
          deneyebilirsin; uydular her bölgeyi günde birkaç kez tarar.
        </div>
      ) : (
        <ul className="scroll-slim min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto">
          {events.map((ev) => (
            <EventCard key={ev.id} ev={ev} {...props} ago={fmtAgo(ev.lastSeen, now)} />
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
  pass,
}: EventPanelProps & { ev: FireEvent; ago: string }) {
  const selected = ev.id === selectedId;
  const status = STATUS_LABEL[ev.status];
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
              YURT DIŞI
            </span>
          )}
          <span
            className={`shrink-0 rounded border px-1.5 py-px font-mono text-[9px] tracking-wide ${status.cls}`}
          >
            {status.text}
          </span>
        </div>
        <div className="mt-1 font-mono text-[11px] text-ink-2">
          {ev.count} tespit · {fmtNum(ev.frpLast)} MW · {ago}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Sparkline passes={ev.passes} />
          {trend && (
            <span className={`font-mono text-[10px] ${trend.cls}`}>{trend.text}</span>
          )}
          {ev.drift && (
            <span className="ml-auto font-mono text-[10px] text-ink-2">
              {compassTr(ev.drift.bearingDeg)} yönünde {fmtNum(ev.drift.km, 1)} km
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
          <Assessment
            ev={ev}
            weather={weather}
            cone={cone}
            live={live}
            fuel={selected ? fuel : null}
            pass={pass}
          />
          {ev.passes.length >= 3 && ev.drift === null && (
            <p className="mt-2 rounded border border-line bg-obsidian-3/60 px-2 py-1.5 text-[10px] leading-relaxed text-ink-2">
              Bu nokta {ev.passes.length} uydu geçişi boyunca yerinden
              kıpırdamadı. Sabit bir ısı kaynağı (baca, santral, sanayi tesisi)
              olabilir.
            </p>
          )}
          <p className="mt-2 border-t border-line/60 pt-2 text-[10px] leading-relaxed text-ink-3">
            Uydu ısı görür; her tespit yangın olmayabilir. Yönelim
            göstergesidir, resmi uyarı yerine geçmez. Acil durumda{" "}
            <span className="font-mono text-ink-2">112</span> · Orman Yangını İhbar{" "}
            <span className="font-mono text-ink-2">177</span>
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
    return (
      <p className="text-[11px] text-ink-3">
        Bölge hava verisi şu an alınamıyor.
      </p>
    );
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
      // "-dan" eki kritik: hemen altındaki tahmin yangının GİDECEĞİ yönü
      // veriyor. Ek olmadan iki zıt pusula yan yana okunup ters anlaşılıyordu.
      k: "Rüzgar",
      v:
        weather.windKmh !== null && weather.windDirDeg !== null
          ? `${compassTr(weather.windDirDeg)}'dan ${fmtNum(weather.windKmh)} km/sa`
          : "—",
    },
    {
      k: "Hamle",
      v: weather.gustKmh !== null ? `${fmtNum(weather.gustKmh)} km/sa` : "—",
    },
    {
      k: "Nem",
      v: weather.rh !== null ? `%${fmtNum(weather.rh)}` : "—",
      cls: weather.rh !== null && weather.rh < 30 ? "text-warn" : undefined,
    },
    {
      k: "Sıcaklık",
      v: weather.tempC !== null ? `${fmtNum(weather.tempC)}°C` : "—",
    },
    {
      k: "VPD",
      v: weather.vpdKpa !== null ? `${fmtNum(weather.vpdKpa, 2)} kPa` : "—",
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
              title={`FFMC ${weather.fwi.ffmc} · DMC ${weather.fwi.dmc} · DC ${weather.fwi.dc} · ISI ${weather.fwi.isi} · BUI ${weather.fwi.bui} (${weather.fwi.days} günlük seri)`}
            >
              <span className="text-[10px] text-ink-3">Yangın hava indeksi</span>
              <span className={`font-mono text-[11px] ${FWI_CLS[weather.fwi.level]}`}>
                {fmtNum(weather.fwi.fwi, 1)}
              </span>
              <span className={`text-[10px] ${FWI_CLS[weather.fwi.level]}`}>
                {weather.fwi.label}
              </span>
            </div>
          )}
          {weather.pm25 !== null && (
            <div
              className="flex items-baseline gap-1.5"
              title="Yüzeydeki ince partikül — duman göstergesi (CAMS)"
            >
              <span className="text-[10px] text-ink-3">Duman (PM2.5)</span>
              <span className={`font-mono text-[11px] ${aqiCls ?? "text-ink"}`}>
                {fmtNum(weather.pm25)} µg/m³
              </span>
              {weather.aqi !== null && (
                <span className={`text-[10px] ${aqiCls ?? "text-ink-3"}`}>
                  AQI {fmtNum(weather.aqi)}
                </span>
              )}
            </div>
          )}
          {weather.terrain && (
            <div
              className="flex items-baseline gap-1.5"
              title="Yangın yokuş yukarı hızlanır — rüzgâr ters yöne esse bile"
            >
              <span className="text-[10px] text-ink-3">Arazi</span>
              <span className="font-mono text-[11px] text-ink">
                {fmtNum(weather.terrain.elevM)} m · %{fmtNum(weather.terrain.slopePct)} eğim
              </span>
              {weather.terrain.slopePct >= 10 && (
                <span className="text-[10px] text-warn">
                  yokuş {compassTr(weather.terrain.upslopeDeg)}
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
  pass,
}: {
  ev: FireEvent;
  weather: WindPoint | undefined;
  cone: ConeGeom | undefined;
  live: boolean;
  fuel?: string | null;
  pass?: PassInfo;
}) {
  const lines: React.ReactNode[] = [];

  // Yakıt: kullanıcı en çok "bu orman yangını mı, anız mı" diye merak ediyor.
  // Aktif listenin büyük kısmı güneydoğuda tarımsal anız yakma.
  const f = fuel ? FUEL_LABEL[fuel] : null;
  if (f) {
    lines.push(
      <span key="fuel" className={f.uyari ? "text-warn" : undefined}>
        Arazi örtüsü: <b className="font-normal text-ink">{f.ad}</b> — {f.not}
      </span>
    );
  }

  // "Tespit yok" ≠ "yangın bitti": kullanıcı kör aralıkta olduğunu bilsin.
  if (live && pass?.inGap && pass.nextH !== null) {
    lines.push(
      <span key="gap" className="text-warn">
        Şu an uydu kör aralığında: yeni tespit {fmtNext(pass.nextH)} beklenir.
        Tespit gelmemesi yangının söndüğü anlamına gelmez.
      </span>
    );
  }

  // Geçmiş: nereden çıktı, ne kadar süredir yanıyor
  const yanmaSaati = Math.max(0.5, (ev.lastSeen - ev.firstSeen) / 3600_000);
  lines.push(
    <span key="gecmis">
      İlk görülme:{" "}
      <b className="font-mono font-normal text-ink">
        {fmtDayTime(ev.firstSeen)}
      </b>{" "}
      · {ev.passes.length} uydu geçişi boyunca{" "}
      {yanmaSaati < 24
        ? `${fmtNum(yanmaSaati)} saattir`
        : `${fmtNum(yanmaSaati / 24, 1)} gündür`}{" "}
      izleniyor
    </span>
  );

  if (ev.drift) {
    const hours = Math.max(0.5, ev.drift.spanMs / 3600_000);
    lines.push(
      <span key="drift">
        Geldiği yön:{" "}
        <b className="font-mono font-normal text-ink">
          {compassTr((ev.drift.bearingDeg + 180) % 360)}&apos;dan
        </b>{" "}
        →{" "}
        <b className="font-mono font-normal text-ink">
          {compassTr(ev.drift.bearingDeg)} yönüne
        </b>{" "}
        {fmtNum(ev.drift.km, 1)} km / {fmtNum(hours)} sa
      </span>
    );
  } else if (ev.passes.length >= 2) {
    // Sürüklenme eşiğin altında kaldı — sessiz kalmak yerine sebebini söyle
    lines.push(
      <span key="nodrift" className="text-ink-3">
        Belirgin bir yer değişimi yok: yangın ilk çıktığı bölgede genişliyor.
      </span>
    );
  }

  if (cone) {
    lines.push(
      <span key="cone">
        {/* 2026-08-02 doğrulama (6 sezon, 232 orman/maki ilerlemesi):
            rüzgâr+eğim bileşkesi rastgeleden iyi ama ortanca hata 68°.
            Yarım açı ve yarıçap artık gözlenen dağılımdan geliyor. */}
        En olası yön:{" "}
        <b className="font-mono font-normal text-ink">
          {compassTr(cone.spreadDeg)}
        </b>{" "}
        · rüzgâr ve eğimin bileşkesi
        {cone.isDisc ? (
          <span className="text-warn">
            {" "}
            — ama rüzgâr zayıf, yön kuvvetli değil
          </span>
        ) : (
          <> · sapma payı ±{Math.round(cone.halfAngle)}°</>
        )}
      </span>
    );
    lines.push(
      <span key="cone-mean" className="text-ink-3">
        Şekil 1·3·6 saatlik <b className="font-normal">%90&apos;lık erişim</b>:
        ölçtüğümüz yangınların onda dokuzunda, <b className="font-normal">en
        uzağa ilerleyen nokta bile</b> bu sınırın içinde kaldı — bu oran
        modelin görmediği sezonlarda sınandı. Baş yönüne doğru geriye göre{" "}
        <b className="font-normal">2,4 kat</b> uzun; yangınlar gerçekte böyle
        bir damla çiziyor. Söndürme müdahalesi hesaba katılmaz.
      </span>
    );
    // Rüzgârın dönmesi, doğrulama testinde tahmin hatasının kalemlerinden
    // biriydi; halkalar artık saatlik tahminle çiziliyor, kullanıcı görsün.
    if (cone.driftDeg >= 30) {
      lines.push(
        <span key="drift" className="text-warn">
          Rüzgâr önümüzdeki 6 saatte{" "}
          <b className="font-normal">yaklaşık {Math.round(cone.driftDeg)}° dönüyor</b> —
          uzak halkalar bu dönüşe göre çizildi
        </span>
      );
    }
    if (ev.drift && cone.isDisc) {
      // Daire modunda ortada bir yön iddiası yok; en güvenilir sinyal gözlem.
      lines.push(
        <span key="obs" className="text-ok">
          Elimizdeki en güvenilir yön bilgisi gözlem:{" "}
          <b className="font-normal">
            son geçişlerde {compassTr(ev.drift.bearingDeg)} yönüne ilerledi
          </b>
        </span>
      );
    } else if (ev.drift) {
      const d = angDiff(ev.drift.bearingDeg, cone.spreadDeg);
      lines.push(
        d <= 45 ? (
          <span key="agree" className="text-ok">
            Gözlenen ilerleme tahmin yönüyle uyuşuyor — güven artar
          </span>
        ) : (
          <span key="dis" className="text-warn">
            Gözlenen ilerleme rüzgâr yönünden sapıyor; arazi, yakıt veya
            söndürme etkili olabilir — <b className="font-normal">gözlenen
            yönü esas al</b>
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
            Dik yamaç (%{fmtNum(weather.terrain.slopePct)}):{" "}
            {compassTr(weather.terrain.upslopeDeg)} yönünde yokuş yukarı da
            ilerleyebilir
          </span>
        );
      }
    }
  } else if (!live) {
    lines.push(
      <span key="past" className="text-ink-3">
        Tahmin konisi yalnız canlı görünümde çizilir
      </span>
    );
  } else if (weather && weather.windKmh !== null && weather.windKmh < 4) {
    lines.push(
      <span key="calm" className="text-ink-3">
        Rüzgar durgun — belirgin bir yönelim yok
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
