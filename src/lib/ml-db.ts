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

/**
 * Tekrar deneme politikası. Test sıfırlayabilsin diye dışa açık nesne.
 *
 * NEDEN VAR (2026-09-11, ölçüldü): Supabase'in API geçidi 22:40 UTC'den
 * itibaren aralıklı `504 {"message":"Gateway Timeout"}` döndü — aynı sorgu
 * bir sonraki saniye 200 veriyordu (15/15 doğrudan ölçüm). Tek denemede pes
 * eden boru hattı o gece ingest'te üç dilimi (23:20/23:30/23:40) geri
 * gelmeyecek şekilde KAYBETTİ, cone/enrich/label/verify turları düştü ve
 * sağlık denetimi "sorgu düştü" diye mail attı. Üretilemeyen veri için
 * (uydu tespiti) tek bir geçit hıçkırığı kabul edilebilir bedel değil.
 *
 * Neden tekrar GÜVENLİ: 504 "yazıldı mı, yazılmadı mı" bilgisini yutar; ama
 * üç işlem de idempotent — GET, `ignore/merge-duplicates` upsert ve
 * `payload`'daki id'ye göre UPDATE yapan `apply_*` RPC'leri (0002/0003/0004).
 * Aynı isteği ikinci kez göndermek aynı sonucu verir.
 *
 * Yalnız GEÇİCİ sınıf tekrarlanır: ağ hatası, 5xx, 429. 4xx kalıcıdır
 * (şema/anahtar/biçim) — `lib/fetch-retry.ts` ile aynı politika; o yardımcı
 * durum kodunu yutup `null` döndüğü ve `next.revalidate` kullandığı için
 * burada kullanılmadı.
 */
export const DB_RETRY = { deneme: 3, beklemeMs: 500 };

const geciciMi = (status: number) => status >= 500 || status === 429;

async function fetchRetry(url: string, init: RequestInit, etiket: string): Promise<Response> {
  let sonYanit: Response | undefined;
  let sonHata: unknown;
  for (let deneme = 1; deneme <= DB_RETRY.deneme; deneme++) {
    try {
      const res = await fetch(url, init);
      if (!geciciMi(res.status)) {
        // Hıçkırık Vercel logunda görünür kalsın — sessizce yutulmasın.
        if (deneme > 1) {
          console.warn(
            `supabase ${etiket} ${sonYanit?.status ?? "ağ hatası"} → ${deneme}. denemede tamam`
          );
        }
        return res;
      }
      // Ara denemenin gövdesi okunmazsa soket askıda kalır.
      if (deneme < DB_RETRY.deneme) await res.text().catch(() => undefined);
      sonYanit = res;
      sonHata = undefined;
    } catch (e) {
      sonHata = e;
      sonYanit = undefined;
    }
    if (deneme < DB_RETRY.deneme) {
      await new Promise((r) => setTimeout(r, DB_RETRY.beklemeMs * deneme));
    }
  }
  // Son deneme de düştü: 5xx ise çağıran durum+gövdeyi loglasın diye yanıt
  // döner; ağ hatasıysa eskisi gibi fırlatılır.
  if (sonYanit) return sonYanit;
  throw sonHata;
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
      const res = await fetchRetry(
        `${url}/rest/v1/${path}`,
        { headers, cache: "no-store" },
        "select"
      );
      if (!res.ok) {
        // Gövde istemciye yansıtılmaz: şema/anahtar ayrıntısı sızabilir.
        console.error("supabase select", res.status, await res.text());
        return { error: "okunamadı", detay: String(res.status) };
      }
      return { rows: (await res.json()) as T[] };
    },
    async upsert(path, rows, resolution, ret = "minimal") {
      const res = await fetchRetry(
        `${url}/rest/v1/${path}`,
        {
          method: "POST",
          headers: { ...headers, Prefer: `resolution=${resolution},return=${ret}` },
          body: JSON.stringify(rows),
        },
        "upsert"
      );
      if (!res.ok) {
        console.error("supabase upsert", res.status, await res.text());
        return { error: "yazılamadı", detay: String(res.status) };
      }
      const body = ret === "representation" ? await res.json() : [];
      return { ok: true as const, rows: body };
    },
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const res = await fetchRetry(
        `${url}/rest/v1/rpc/${fn}`,
        { method: "POST", headers, body: JSON.stringify(args) },
        `rpc ${fn}`
      );
      if (!res.ok) {
        console.error("supabase rpc", fn, res.status, await res.text());
        return { error: "rpc başarısız", detay: String(res.status) };
      }
      return { result: (await res.json()) as T };
    },
  };
}
