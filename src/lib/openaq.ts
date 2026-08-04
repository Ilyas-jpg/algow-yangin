import { inRegion } from "./bbox";

/**
 * Yer istasyonu PM2.5 — duman katmanının gözlemle doğrulanması.
 *
 * Duman şu an %100 model (ECMWF/CAMS). Model kaba ızgarada çalışıyor ve
 * yangın dumanını saatlerce kaydırabiliyor. Yakında bir istasyon varsa
 * ÖLÇÜM gösterilir; yoksa model gösterilir ve hangisi olduğu yazılır.
 * Amaç modeli gizlemek değil, iki bilgiyi birbirine karıştırmamak.
 *
 * ⚠️ ÖLÇÜLDÜ (2026-08-04): Türkiye'nin resmî SİM beslemesi OpenAQ'ya
 * **Mayıs 2023'te durmuş**. 406 istasyonun yalnız 8'i son 7 günde veri
 * vermiş ve hepsi Kadıköy'de — yani orman yangını bölgelerinde değil.
 * Yunanistan ve AB tarafı (EEA sağlayıcısı) taze. Bu yüzden özellik
 * Türkiye'de çoğu zaman sessizce "istasyon yok"a düşecek; bu bir hata
 * değil, verinin gerçeği. Arayüz de öyle yazıyor.
 */

const TABAN = "https://api.openaq.org/v3";

/** PM2.5'in OpenAQ parametre kimliği. */
const PM25 = 2;

/**
 * Arama yarıçapı, km.
 *
 * ⚠️ 25 **API'nin sert tavanı**, bizim tercihimiz değil: `radius` 25000'i
 * aşınca OpenAQ **HTTP 422** döndürüyor (ölçüldü — 25000 ✓, 25001 ✗).
 * İlk sürümde 30 yazılmıştı ve uç sessizce boş dönüyordu; route 422'yi
 * yutup modele düşüyor, hiçbir yerde hata görünmüyordu. Bu sayıyı
 * büyütmek özelliği yeniden sessizce öldürür.
 */
export const AZAMI_KM = 25;

/**
 * Bundan eski ölçüm "şu anki duman" sayılmaz.
 *
 * Eşik bilerek dar: OpenAQ'da istasyon kaydı duruyor ama beslemesi yıllar
 * önce kesilmiş olabiliyor (Türkiye vakası). Tarihi bir ölçümü bugünün
 * dumanı gibi göstermek, modeli göstermekten çok daha kötü olurdu.
 */
export const AZAMI_YAS_SA = 6;

export interface StationPm25 {
  /** istasyon adı */
  name: string;
  /** µg/m³ */
  value: number;
  /** ölçümün zamanı (epoch ms) */
  at: number;
  /** yangına uzaklık, km */
  km: number;
  /** veriyi kim yayınlıyor (ör. EEA) — atıf için */
  provider: string | null;
}

interface AqLocation {
  id?: number;
  name?: string;
  provider?: { name?: string };
  /** metre */
  distance?: number;
  datetimeLast?: { utc?: string };
  sensors?: { id: number; parameter?: { name?: string } }[];
}

function bas(): Record<string, string> | null {
  const k = process.env.OPENAQ_KEY;
  return k ? { "X-API-Key": k } : null;
}

/**
 * Yangına en yakın, VERİSİ TAZE istasyonun PM2.5 ölçümü.
 * Bulunamazsa null — çağıran taraf modele düşer.
 */
export async function nearestPm25(
  lon: number,
  lat: number,
  now = Date.now()
): Promise<StationPm25 | null> {
  const headers = bas();
  if (!headers || !inRegion(lon, lat)) return null;

  try {
    // `coordinates` lat,lon sırasında — ters yazmak istasyonu denizde arar.
    const url =
      `${TABAN}/locations?coordinates=${lat.toFixed(4)},${lon.toFixed(4)}` +
      `&radius=${Math.round(AZAMI_KM * 1000)}&parameters_id=${PM25}&limit=10`;
    const res = await fetch(url, { headers, next: { revalidate: 1800 } });
    if (!res.ok) {
      console.warn("[openaq] locations HTTP", res.status);
      return null;
    }

    const j = (await res.json()) as { results?: AqLocation[] };
    const adaylar = (j.results ?? [])
      .filter((l) => {
        const son = l.datetimeLast?.utc ? Date.parse(l.datetimeLast.utc) : 0;
        return son > 0 && now - son <= AZAMI_YAS_SA * 3600_000;
      })
      // OpenAQ mesafeyi metre olarak veriyor; yoksa sıralamayı bozmayalım.
      .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));

    // Taze istasyon bulunamaması NORMAL (Türkiye'de kural bile) — log YOK,
    // yoksa her yangın seçiminde sunucu logunu dolduruyor. Çağıran taraf
    // null'ı zaten "model" etiketiyle karşılıyor.
    const l = adaylar[0];
    if (!l) return null;

    const sensor = (l.sensors ?? []).find((s) => s.parameter?.name === "pm25");
    if (!sensor || !l.id) return null;

    /**
     * ⚠️ `/sensors/{id}/measurements` KULLANMA: kaydın EN ESKİSİNDEN
     * başlıyor ve hiçbir sıralama parametresi bunu çevirmiyor (ölçüldü —
     * `sort=desc`, `order_by`, `sort_order` üçü de 2020 tarihli ilk kaydı
     * döndürdü). `/parameters/{id}/latest` ise koordinatı yok sayıyor,
     * dünyanın öbür ucundan istasyon veriyor. Doğrusu konum bazlı `latest`.
     */
    const mRes = await fetch(`${TABAN}/locations/${l.id}/latest`, {
      headers,
      next: { revalidate: 900 },
    });
    if (!mRes.ok) return null;

    const mj = (await mRes.json()) as {
      results?: { sensorsId?: number; value?: number; datetime?: { utc?: string } }[];
    };
    const m = (mj.results ?? []).find((x) => x.sensorsId === sensor.id);
    const deger = m?.value;
    const at = m?.datetime?.utc ? Date.parse(m.datetime.utc) : 0;
    if (typeof deger !== "number" || !Number.isFinite(deger) || !at) return null;
    // Ölçüm listesi eski olabilir: istasyon taze görünse de son kayıt bayatsa alma.
    if (now - at > AZAMI_YAS_SA * 3600_000) return null;

    return {
      name: l.name ?? "?",
      value: Math.round(deger * 10) / 10,
      at,
      km: Math.round(((l.distance ?? 0) / 1000) * 10) / 10,
      provider: l.provider?.name ?? null,
    };
  } catch (e) {
    console.warn("[openaq] hata:", String(e).slice(0, 120));
    return null;
  }
}
