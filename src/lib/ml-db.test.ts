import { test } from "node:test";
import assert from "node:assert/strict";
import { DB_RETRY, supabaseAdmin } from "./ml-db.ts";

/**
 * `lib/ml-db` tekrar deneme politikası.
 *
 * 2026-09-11 gecesi Supabase geçidi aralıklı 504 döndü ve tek denemede pes
 * eden boru hattı ingest dilimlerini kaybetti. Bu testler politikayı
 * kilitler: geçici hata (5xx/429/ağ) tekrarlanır, kalıcı hata (4xx)
 * tekrarlanmaz, deneme sayısı tavanı aşılmaz.
 */

// Sahte service_role JWT: URL gövdedeki `ref`ten türetiliyor, imza okunmuyor.
const govde = Buffer.from(
  JSON.stringify({ ref: "testref0123456789abc", role: "service_role" })
).toString("base64url");
process.env.SUPABASE_SERVICE_ROLE_KEY = `eyJhbGciOiJIUzI1NiJ9.${govde}.imza`;
delete process.env.SUPABASE_URL;
DB_RETRY.beklemeMs = 0; // test beklemesin

/** Sırayla verilecek yanıtlar: durum kodu ya da fırlatılacak hata. */
function sahteFetch(yanitlar: Array<number | Error>) {
  const cagrilar: string[] = [];
  const uyarilar: string[] = [];
  const eskiWarn = console.warn;
  console.warn = (...a: unknown[]) => {
    uyarilar.push(a.map(String).join(" "));
  };
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    cagrilar.push(`${init?.method ?? "GET"} ${String(url)}`);
    const y = yanitlar.shift();
    if (y === undefined) throw new Error("beklenmeyen fazladan çağrı");
    if (y instanceof Error) throw y;
    const iyi = y >= 200 && y < 300;
    const body = iyi ? JSON.stringify([{ id: 1 }]) : JSON.stringify({ message: "Gateway Timeout" });
    return new Response(body, { status: y, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { cagrilar, uyarilar, geriAl: () => (console.warn = eskiWarn) };
}

function db() {
  const d = supabaseAdmin();
  assert.ok(!("error" in d), "sahte anahtarla istemci kurulmalı");
  return d;
}

test("504 sonra 200: tekrar denenir, satırlar döner, hıçkırık uyarı olarak loglanır", async () => {
  const s = sahteFetch([504, 200]);
  const r = await db().select<{ id: number }>("cone_forecast?select=id&limit=1");
  s.geriAl();
  assert.ok("rows" in r, JSON.stringify(r));
  assert.equal(r.rows.length, 1);
  assert.equal(s.cagrilar.length, 2);
  assert.match(s.uyarilar.join("\n"), /504 → 2\. denemede tamam/);
});

test("400 kalıcıdır: tek deneme, hata durum koduyla döner", async () => {
  const s = sahteFetch([400]);
  const r = await db().select("yok?select=id");
  s.geriAl();
  assert.ok("error" in r);
  assert.equal(r.detay, "400");
  assert.equal(s.cagrilar.length, 1);
});

test("üç 5xx: tavan aşılmaz, son yanıtın kodu döner", async () => {
  const s = sahteFetch([504, 503, 504]);
  const r = await db().select("heat_signal?select=id");
  s.geriAl();
  assert.ok("error" in r);
  assert.equal(r.detay, "504");
  assert.equal(s.cagrilar.length, 3);
});

test("upsert: ağ hatası sonra 201 → ok", async () => {
  const s = sahteFetch([new TypeError("fetch failed"), 201]);
  const r = await db().upsert("heat_signal?on_conflict=id", [{ id: 1 }], "ignore-duplicates");
  s.geriAl();
  assert.ok("ok" in r, JSON.stringify(r));
  assert.equal(s.cagrilar.length, 2);
  assert.equal(s.cagrilar[0], `POST https://testref0123456789abc.supabase.co/rest/v1/heat_signal?on_conflict=id`);
});

test("rpc: 500 sonra 200 → sonuç döner", async () => {
  const s = sahteFetch([500, 200]);
  const r = await db().rpc<unknown>("apply_heat_labels", { payload: [] });
  s.geriAl();
  assert.ok("result" in r, JSON.stringify(r));
  assert.equal(s.cagrilar.length, 2);
});

/**
 * Supabase'in sessiz satır tavanını taklit eden sunucu: `limit` ne yazılırsa
 * yazılsın en fazla `tavan` satır döner (gerçekte 1000; 2026-10-18 ölçümü).
 */
function sayfaliFetch(toplam: number, tavan: number) {
  const cagrilar: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    const u = new URL(String(url));
    cagrilar.push(u.search);
    const limit = Number(u.searchParams.get("limit") ?? 1e9);
    const offset = Number(u.searchParams.get("offset") ?? 0);
    const n = Math.max(0, Math.min(limit, tavan, toplam - offset));
    const rows = Array.from({ length: n }, (_, i) => ({ id: offset + i + 1 }));
    return new Response(JSON.stringify(rows), { status: 200 });
  }) as typeof fetch;
  return cagrilar;
}

test("select tavanı SESSİZCE keser — selectAll keserek değil sayfalayarak okur", async () => {
  // Hatanın kendisi: tek select 20000 ister, 1000 alır, hata yok.
  sayfaliFetch(2343, 1000);
  const tek = await db().select<{ id: number }>("cone_forecast?select=id&order=id.asc&limit=20000");
  assert.ok("rows" in tek);
  assert.equal(tek.rows.length, 1000);

  const cagrilar = sayfaliFetch(2343, 1000);
  const r = await db().selectAll<{ id: number }>("cone_forecast?select=id&order=id.asc", 100_000);
  assert.ok("rows" in r, JSON.stringify(r));
  assert.equal(r.rows.length, 2343);
  assert.equal(new Set(r.rows.map((x) => x.id)).size, 2343, "tekrar eden satır yok");
  // 1000 + 1000 + 343 + boş sayfa
  assert.equal(cagrilar.length, 4);
  assert.match(cagrilar[1], /offset=1000/);
});

test("selectAll: tavan 1000'den düşükse de eksiksiz okur", async () => {
  sayfaliFetch(1234, 400);
  const r = await db().selectAll<{ id: number }>("x?select=id&order=id.asc", 100_000);
  assert.ok("rows" in r);
  assert.equal(r.rows.length, 1234);
});

test("selectAll: max'ı aşmaz", async () => {
  const cagrilar = sayfaliFetch(5000, 1000);
  const r = await db().selectAll<{ id: number }>("x?select=id&order=id.asc", 1500);
  assert.ok("rows" in r);
  assert.equal(r.rows.length, 1500);
  assert.match(cagrilar[1], /limit=500&offset=1000/);
});

test("selectAll: sıralamasız ya da limit taşıyan yol reddedilir, istek atılmaz", async () => {
  const cagrilar = sayfaliFetch(10, 1000);
  const a = await db().selectAll("x?select=id", 100);
  const b = await db().selectAll("x?select=id&order=id.asc&limit=50", 100);
  assert.ok("error" in a && "error" in b);
  assert.equal(cagrilar.length, 0);
});

test("ağ hatası üç kez: eskisi gibi fırlatılır (çağıran 500 döner)", async () => {
  const s = sahteFetch([new TypeError("a"), new TypeError("b"), new TypeError("c")]);
  await assert.rejects(db().select("x?select=id"), /c/);
  s.geriAl();
  assert.equal(s.cagrilar.length, 3);
});
