/**
 * ML veri tabanı erişimi — yalnız SUNUCU.
 *
 * `service_role` anahtarı RLS'i bypass eder ve tarayıcıya asla inmemeli.
 * Bu modülü bir istemci bileşeninden import etme.
 */
import "server-only";

/**
 * Ortam değişkeni temizliği.
 *
 * Panele elle girilen değerlere görünmez karakter bulaşıyor: BOM (U+FEFF),
 * CRLF, kopyalarken kaçan tırnak. Bu projede yaşandı — Windows'ta
 * `vercel env add` pipe'ı FIRMS anahtarına `\r` ekleyip üretimde 4/4
 * "Invalid MAP_KEY" verdirmişti; kardeş projede Turnstile anahtarına BOM
 * bulaşmıştı. Bu bozulma sessizdir ve hiçbir şey anlatmayan hatalarla çıkar.
 */
export function cleanEnv(v: string | undefined): string {
  return (v ?? "").replace(/^﻿/, "").replace(/^["']|["']$/g, "").trim();
}

const SUPABASE_URL_RE = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i;

/**
 * Proje URL'ini service_role anahtarından türetir.
 *
 * Supabase JWT'sinin gövdesinde proje referansı (`ref`) zaten var; URL onun
 * bir fonksiyonu. Ayrı bir `SUPABASE_URL` tutmak, tutarsız olabilecek
 * İKİNCİ bir yapılandırma noktası demek — nitekim panele elle girilirken
 * bozuldu (41 karakter, olması gereken 40) ve "fetch failed: unknown
 * scheme" diye hiçbir şey anlatmayan bir çökmeye yol açtı.
 * Kural: aynı gerçeği iki yerde tutma, biri diğerinden türetilebiliyorsa türet.
 */
function urlFromKey(key: string): string | null {
  try {
    const payload = key.split(".")[1];
    if (!payload) return null;
    const ref = (
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
        ref?: string;
      }
    ).ref;
    return ref && /^[a-z0-9-]+$/i.test(ref) ? `https://${ref}.supabase.co` : null;
  } catch {
    return null;
  }
}

export interface DbError {
  error: string;
  detay?: string;
}

export interface Db {
  select<T>(path: string): Promise<{ rows: T[] } | DbError>;
  /**
   * `ret: "representation"` yazılan satırları geri ister — üretilen `id`'ye
   * ihtiyaç duyan çağrılar için (olay yazıp geçişleri ona bağlamak gibi).
   * Varsayılan `minimal`: gövde taşımamak hem hızlı hem de büyük toplu
   * yazımlarda yanıtı şişirmiyor.
   */
  upsert<T = never>(
    path: string,
    rows: unknown[],
    resolution: "merge-duplicates" | "ignore-duplicates",
    ret?: "minimal" | "representation"
  ): Promise<{ ok: true; rows: T[] } | DbError>;
  rpc<T>(fn: string, args: Record<string, unknown>): Promise<{ result: T } | DbError>;
}

export function supabaseAdmin(): Db | DbError {
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key) return { error: "supabase yapılandırılmadı" };

  const envUrl = cleanEnv(process.env.SUPABASE_URL).replace(/\/+$/, "");
  const url = SUPABASE_URL_RE.test(envUrl) ? envUrl : urlFromKey(key);
  if (!url) return { error: "supabase URL çözülemedi" };

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  return {
    async select<T>(path: string) {
      const res = await fetch(`${url}/rest/v1/${path}`, { headers, cache: "no-store" });
      if (!res.ok) {
        // Gövde istemciye yansıtılmaz: şema/anahtar ayrıntısı sızabilir.
        console.error("supabase select", res.status, await res.text());
        return { error: "okunamadı", detay: String(res.status) };
      }
      return { rows: (await res.json()) as T[] };
    },
    async upsert(path, rows, resolution, ret = "minimal") {
      const res = await fetch(`${url}/rest/v1/${path}`, {
        method: "POST",
        headers: { ...headers, Prefer: `resolution=${resolution},return=${ret}` },
        body: JSON.stringify(rows),
      });
      if (!res.ok) {
        console.error("supabase upsert", res.status, await res.text());
        return { error: "yazılamadı", detay: String(res.status) };
      }
      const body = ret === "representation" ? await res.json() : [];
      return { ok: true as const, rows: body };
    },
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers,
        body: JSON.stringify(args),
      });
      if (!res.ok) {
        console.error("supabase rpc", fn, res.status, await res.text());
        return { error: "rpc başarısız", detay: String(res.status) };
      }
      return { result: (await res.json()) as T };
    },
  };
}
