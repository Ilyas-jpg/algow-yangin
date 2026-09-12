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

test("ağ hatası üç kez: eskisi gibi fırlatılır (çağıran 500 döner)", async () => {
  const s = sahteFetch([new TypeError("a"), new TypeError("b"), new TypeError("c")]);
  await assert.rejects(db().select("x?select=id"), /c/);
  s.geriAl();
  assert.equal(s.cagrilar.length, 3);
});
