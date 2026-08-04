/**
 * Geçiş grubu zamanlarının testi.
 *
 * CANLI HATA (3 Ağu 2026): Bayramiç arşiv kaydı jeostasyoner MTG'den
 * kurulunca 73 tespit TEK geçiş grubuna düştü (16:08–18:58) ve haritadaki
 * "İLK GÖRÜLEN" etiketi grubun MEDYANINI yazdı → 17:08. Gerçek ilk tespit
 * 16:08'di; etiket tam bir saat yanlıştı ve /hakkinda'da yayınladığımız
 * sayıyla çelişiyordu.
 *
 * Kutupsal uyduda geçiş ~2 dakika sürdüğü için medyan ile ilk arasında
 * fark yok; hata yalnız saatlerce süren jeostasyoner kayıtta görünür oldu.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterEvents, sortEvents } from "./cluster.ts";
import type { FirePoint } from "./types.ts";

const T = Date.UTC(2026, 7, 2, 13, 8);

function p(dkSonra: number, frp = 50): FirePoint {
  return {
    id: `x${dkSonra}`,
    lon: 26.747,
    lat: 39.913,
    frp,
    conf: "n",
    sat: "MTG",
    dt: T + dkSonra * 60_000,
    dn: "D",
  };
}

test("geçiş grubu t0'ı en erken tespiti taşır (t medyandır)", () => {
  // 10 dakikada bir, 3 saat boyunca — jeostasyoner tarama deseni
  const pts = Array.from({ length: 18 }, (_, i) => p(i * 10));
  const { events } = clusterEvents(pts);
  assert.equal(events.length, 1);
  const g = events[0].passes;
  assert.equal(g.length, 1, "90 dk'dan küçük boşluklar tek gruba düşer");
  assert.equal(g[0].t0, T, "t0 = ilk tespit");
  assert.ok(g[0].t > g[0].t0, "medyan ilkten sonra gelir (kayıt saatlerce sürüyor)");
});

test("kutupsal desende t0 ile t pratikte aynı", () => {
  // Tek geçiş = birkaç dakikalık pencere
  const pts = [p(0), p(1), p(2)];
  const { events } = clusterEvents(pts);
  const g = events[0].passes[0];
  assert.equal(g.t0, T);
  assert.ok(g.t - g.t0 <= 2 * 60_000);
});

test("ayrı geçişlerde her grubun kendi t0'ı olur", () => {
  const pts = [p(0), p(5), p(200), p(205)]; // araya >90 dk boşluk
  const { events } = clusterEvents(pts);
  const g = events[0].passes;
  assert.equal(g.length, 2);
  assert.equal(g[0].t0, T);
  assert.equal(g[1].t0, T + 200 * 60_000);
});

/* ── Güven ve şiddet bayrakları (FIRMS ince ayar, 2026-08-04) ── */

const pk = (over: Partial<FirePoint>, dk = 0): FirePoint => ({
  ...p(dk),
  id: `k${dk}${over.conf ?? ""}${over.dn ?? ""}${over.saturated ? "s" : ""}`,
  ...over,
});

test("hepsi düşük güvenli GÜNDÜZ ise olay aktif sayılmaz", () => {
  const { events } = clusterEvents([
    pk({ conf: "l", dn: "D" }, 0),
    pk({ conf: "l", dn: "D" }, 2),
  ]);
  assert.equal(events[0].lowConfidence, true);
});

test("düşük güvenli GECE tespiti olayı sayacın dışına atmaz", () => {
  // Gündüz yanlış pozitiflerin sebebi güneş yansıması; gece o mekanizma yok.
  // Geceyi de elemek, büyüyen yangını kimsenin bakmadığı saatte gizlerdi.
  const { events } = clusterEvents([
    pk({ conf: "l", dn: "N" }, 0),
    pk({ conf: "l", dn: "N" }, 2),
  ]);
  assert.equal(events[0].lowConfidence, false);
});

test("tek güvenilir tespit olayı sayaca geri sokar", () => {
  // Eşik bilerek 'hepsi': gerçek yangını gizlemek, şüpheliyi saymaktan kötü.
  const { events } = clusterEvents([
    pk({ conf: "l", dn: "D" }, 0),
    pk({ conf: "h", dn: "D" }, 2),
  ]);
  assert.equal(events[0].lowConfidence, false);
});

test("doyma yalnız SON geçişten okunur", () => {
  // Dünkü doyma bugünkü yangının şiddetini anlatmaz.
  const eski = clusterEvents([
    pk({ saturated: true }, 0),
    pk({ saturated: false }, 200),
  ]);
  assert.equal(eski.events[0].saturated, false, "eski doyma taşınmamalı");

  const yeni = clusterEvents([
    pk({ saturated: false }, 0),
    pk({ saturated: true }, 200),
  ]);
  assert.equal(yeni.events[0].saturated, true);
});

/* ── sortEvents: Ortadoğu en dibe (İlyas 2026-08-04) ── */

const ev = (il: string, frpLast: number, status: "active" | "waning" | "old" = "active") =>
  ({ il, frpLast, status }) as const;

test("Ortadoğu olayları, şiddetleri ne olursa olsun listenin dibinde", () => {
  const s = sortEvents([
    ev("Irak", 1171),
    ev("Suriye", 900),
    ev("Çankırı", 512),
    ev("İran", 800),
    ev("Muğla", 120),
  ]);
  assert.deepEqual(
    s.map((e) => e.il),
    ["Çankırı", "Muğla", "Irak", "Suriye", "İran"],
    "1.171 MW'lık Musul flare'i 120 MW'lık Muğla yangınının altında olmalı"
  );
});

test("Yunanistan/Balkanlar dibe İNMEZ — gerçek yangın, şiddetine göre sıralanır", () => {
  // 3 Ağustos'ta kaldırılan "yurt dışı koşulsuz sona" kuralı geri gelmedi:
  // Korint'te 1.230 MW yanarken 182 MW'lık Çankırı'yı başa koymak bilgi gizler.
  const s = sortEvents([ev("Çankırı", 182), ev("Yunanistan", 1230), ev("Irak", 500)]);
  assert.deepEqual(
    s.map((e) => e.il),
    ["Yunanistan", "Çankırı", "Irak"]
  );
});

test("Ortadoğu içinde durum ve FRP sırası korunur", () => {
  const s = sortEvents([
    ev("Irak", 100, "active"),
    ev("Irak", 900, "old"),
    ev("Irak", 400, "active"),
  ]);
  assert.deepEqual(
    s.map((e) => [e.status, e.frpLast]),
    [
      ["active", 400],
      ["active", 100],
      ["old", 900],
    ]
  );
});

test("yurt içinde durum FRP'yi ezer — sönmüş büyük yangın aktifin altında", () => {
  const s = sortEvents([ev("Muğla", 900, "old"), ev("Antalya", 50, "active")]);
  assert.deepEqual(
    s.map((e) => e.il),
    ["Antalya", "Muğla"]
  );
});

test("sortEvents girdiyi bozmaz (yerinde sıralama yok)", () => {
  const girdi = [ev("Irak", 1000), ev("Muğla", 10)];
  sortEvents(girdi);
  assert.equal(girdi[0].il, "Irak", "çağıran dizinin sırası değişmemeli");
});
