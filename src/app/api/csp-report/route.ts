import type { NextRequest } from "next/server";

/**
 * CSP ihlal toplayıcısı.
 *
 * Amaç güvenlik duvarı değil **erken uyarı**: bu haritaya sürekli yeni dış
 * katman ekleniyor (WMS sunucuları, uydu karoları, ADS-B beslemesi). CSP'de
 * unutulan bir kaynak tarayıcıda sessizce bloklanıyor — katman açılıyor,
 * hiçbir şey görünmüyor, hata da çıkmıyor. "Tehlike" katmanının aylarca boş
 * geldiğini böyle bir sessiz boşluk yüzünden geç fark etmiştik.
 *
 * Gövde sunucu loguna yazılır, saklanmaz: rapor kullanıcı sayfasından gelir
 * ve içinde gezinilen adres bulunur — kalıcı tutmak gereksiz veri biriktirmek
 * olurdu.
 */
export const runtime = "nodejs";

/** Kötü niyetli/bozuk gövdeler logu boğmasın. */
const AZAMI_GOVDE = 8 * 1024;

type Sozluk = Record<string, unknown>;

export async function POST(request: NextRequest) {
  // Tarayıcı `application/csp-report` ya da `application/reports+json` gönderir;
  // ikisi de JSON. İçerik tipine göre reddetmiyoruz, ayrıştırmaya çalışıyoruz.
  let ham: string;
  try {
    ham = await request.text();
  } catch {
    return new Response(null, { status: 204 });
  }
  if (!ham || ham.length > AZAMI_GOVDE) return new Response(null, { status: 204 });

  try {
    const veri: unknown = JSON.parse(ham);
    const kayit: unknown[] = Array.isArray(veri) ? veri : [veri];
    for (const k of kayit) {
      const o = (k ?? {}) as Sozluk;
      // Eski biçim `csp-report`'u sarar, Reporting API düz gönderir.
      const r = ((o["csp-report"] as Sozluk) ?? o) as Sozluk;
      console.warn("[csp]", {
        directive: r["violated-directive"] ?? r["effectiveDirective"],
        blocked: r["blocked-uri"] ?? r["blockedURL"],
        document: r["document-uri"] ?? r["documentURL"],
      });
    }
  } catch {
    console.warn("[csp] ayrıştırılamayan rapor");
  }

  // Tarayıcı yanıtı okumuyor; gövde göndermenin anlamı yok.
  return new Response(null, { status: 204 });
}
