import test from "node:test";
import assert from "node:assert/strict";
import { parseEventId, resolveEvent } from "./event-id.ts";

const ev = (id: string, lon: number, lat: number) => ({ id, lon, lat });

test("parseEventId kimliği bileşenlerine ayırır", () => {
  const p = parseEventId("28.15:37.62:483210");
  assert.ok(p);
  assert.equal(p.lon, 28.15);
  assert.equal(p.lat, 37.62);
  assert.equal(p.hour, 483210);
});

test("parseEventId bozuk kimliği reddeder", () => {
  assert.equal(parseEventId("saçma"), null);
  assert.equal(parseEventId("28.15:37.62"), null);
  assert.equal(parseEventId("a:b:c"), null);
});

test("parseEventId bbox dışını reddeder", () => {
  // Uydu kutusunun dışı: uydurma ya da bozulmuş bağlantı
  assert.equal(parseEventId("-70.0:40.0:483210"), null);
  assert.equal(parseEventId("28.15:12.0:483210"), null);
});

test("resolveEvent önce birebir eşleşmeyi seçer", () => {
  const events = [ev("28.15:37.62:483210", 28.2, 37.6), ev("28.16:37.63:483211", 28.15, 37.62)];
  const r = resolveEvent(events, "28.15:37.62:483210");
  assert.equal(r?.id, "28.15:37.62:483210");
});

test("resolveEvent kimlik değişse de yakındaki yangını bulur", () => {
  // Pencere kayınca ilk geçiş düşer ve kimlik değişir; bağlantı ölmemeli.
  const events = [ev("28.19:37.66:483260", 28.19, 37.66)];
  const r = resolveEvent(events, "28.15:37.62:483210");
  assert.equal(r?.id, "28.19:37.66:483260");
});

test("resolveEvent uzaktaki yangını eşleştirmez", () => {
  // ~90 km ötedeki başka bir yangın "aynı yangın" sayılmamalı
  const events = [ev("29.15:37.62:483210", 29.15, 37.62)];
  assert.equal(resolveEvent(events, "28.15:37.62:483210"), null);
});

test("resolveEvent boş listede null döner", () => {
  assert.equal(resolveEvent([], "28.15:37.62:483210"), null);
});
