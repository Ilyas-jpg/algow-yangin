import test from "node:test";
import assert from "node:assert/strict";
import { contextMap } from "./og-map.ts";
import type { FireEvent } from "./types.ts";

const G = 470;
const Y = 300;

function olay(over: Partial<FireEvent> = {}): FireEvent {
  const now = Date.now();
  return {
    id: "27.3:38.5:1",
    lon: 27.3,
    lat: 38.5,
    place: "Test",
    il: "İzmir",
    fixedSource: null,
    abroad: false,
    firstSeen: now - 7200_000,
    lastSeen: now,
    count: 3,
    frpLast: 100,
    frpMax: 120,
    passes: [{ t: now, t0: now, lon: 27.3, lat: 38.5, frp: 100, count: 3 }],
    drift: null,
    lastPassPoints: [
      { lon: 27.3, lat: 38.5 },
      { lon: 27.31, lat: 38.51 },
    ],
    lowConfidence: false,
    saturated: false,
    status: "active",
    ...over,
  };
}

const svgCoz = (src: string) =>
  Buffer.from(src.replace(/^data:image\/svg\+xml;base64,/, ""), "base64").toString();

test("SVG metin taşımıyor — etiketler dışarıda basılmalı", () => {
  // data-URI olarak <img>'de rasterize ediliyor ve o aşamada font YOK.
  // SVG'ye <text> konursa kart sessizce etiketsiz çıkar, hata da vermez.
  const { src } = contextMap(olay(), G, Y);
  const svg = svgCoz(src);
  assert.ok(!svg.includes("<text"), "SVG'ye metin sızmış");
  assert.ok(svg.startsWith("<svg"), "geçerli SVG değil");
});

test("her tespit karenin içinde çiziliyor", () => {
  // Kutu en yakın yerleşimi içeri almak için büyüyor; bu büyütme yangının
  // kendi sınırını ASLA kırpmamalı, yoksa kart yangının bir parçasını gizler.
  const nokta = Array.from({ length: 40 }, (_, i) => ({
    lon: 27.0 + (i % 8) * 0.08,
    lat: 38.3 + Math.floor(i / 8) * 0.08,
  }));
  const { src } = contextMap(
    olay({ lastPassPoints: nokta, count: nokta.length }),
    G,
    Y
  );
  const svg = svgCoz(src);

  const daireler = [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)"/g)];
  assert.ok(daireler.length > 0, "hiç nokta çizilmemiş");
  for (const [, cx, cy] of daireler) {
    const x = Number(cx);
    const y = Number(cy);
    assert.ok(x >= 0 && x <= G, `nokta kare dışında: x=${x}`);
    assert.ok(y >= 0 && y <= Y, `nokta kare dışında: y=${y}`);
  }
});

test("en yakın yerleşim kutuya alınıyor — harita boş kalmıyor", () => {
  // Ölçüldü (2026-08-04): kutu yalnız yangının sınırına göre kurulunca
  // kareye hiçbir yer adı girmiyordu, "bağlam haritası" bağlam vermiyordu.
  const { labels } = contextMap(olay(), G, Y);
  assert.ok(labels.length > 0, "hiç yerleşim etiketi yok");
  for (const l of labels) {
    assert.ok(l.x >= 0 && l.x <= G, `etiket kare dışında: x=${l.x}`);
    assert.ok(l.y >= 0 && l.y <= Y, `etiket kare dışında: y=${l.y}`);
    assert.ok(l.text.length > 0, "boş etiket");
  }
});

test("yoğun yangında nokta bulutu seyreltiliyor", () => {
  // Kart sunucuda saniyeler içinde üretilmeli; binlerce daire data-URI'yi şişirir.
  const nokta = Array.from({ length: 3000 }, (_, i) => ({
    lon: 27.0 + (i % 60) * 0.01,
    lat: 38.3 + Math.floor(i / 60) * 0.01,
  }));
  const { src } = contextMap(
    olay({ lastPassPoints: nokta, count: nokta.length }),
    G,
    Y
  );
  const svg = svgCoz(src);
  // Tespit başına 2 daire (halo + çekirdek) + yerleşim işaretleri
  const daire = (svg.match(/<circle/g) ?? []).length;
  assert.ok(daire <= 2 * 400 + 10, `çok fazla daire: ${daire}`);
});

test("ölçek çubuğu okunur bir adım seçiyor", () => {
  const { scaleText, scale } = contextMap(olay(), G, Y);
  assert.match(scaleText, /^(1|2|5|10|20|50|100|200|500) km$/);
  assert.ok(scale.w > 20 && scale.w < G, `ölçek çubuğu ölçüsüz: ${scale.w}`);
});

test("geçiş izi yalnız birden çok geçiş varken çiziliyor", () => {
  const now = Date.now();
  // Ölçek çubuğu ve kuzey oku da <path> — izi ayıran şey kesikli olması.
  const tek = svgCoz(contextMap(olay(), G, Y).src);
  assert.ok(!tek.includes("stroke-dasharray"), "tek geçişte iz çizilmiş");

  const cok = svgCoz(
    contextMap(
      olay({
        passes: [
          { t: now - 7200_000, t0: now - 7200_000, lon: 27.2, lat: 38.4, frp: 40, count: 2 },
          { t: now, t0: now, lon: 27.3, lat: 38.5, frp: 100, count: 3 },
        ],
      }),
      G,
      Y
    ).src
  );
  assert.ok(cok.includes("stroke-dasharray"), "çok geçişte iz çizilmemiş");
});
