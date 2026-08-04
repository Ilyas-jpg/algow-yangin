import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/ml-db";
import { GUNEYDOGU, ORTADOGU } from "@/lib/places";

/**
 * Eğitim seti dışa aktarımı — `ml_progression` görünümü, CSV ya da JSON.
 *
 * Bir satır = bir uydu geçişi. Girdiler o anın koşulları (rüzgâr, hamle,
 * sıcaklık, nem, VPD, basınç, yağış, FWI kodları, eğim, yokuş-yukarı yön,
 * yükselti, yakıt, yangının yaşı, FRP, piksel sayısı), çıktı bir sonraki
 * geçişte gerçekleşen ilerleme (yön ve mesafe).
 *
 * ⚠️ EĞİTMEDEN ÖNCE İKİ TUZAK:
 *
 * ① `weather_source` KARIŞTIRILMAZ. 'era5' satırlarındaki rüzgâr o saatin
 *    gerçekleşmiş halidir; 'live' satırlarındaki tahmindir. İkisini birlikte
 *    eğitip sahada tahmin rüzgârıyla çalıştırmak sızıntıdır — model
 *    eğitimde gördüğü kesinliği sahada bulamaz.
 *
 * ② YÖN AÇIDIR, SAYI DEĞİL. 350° ile 10° arası 20°'dir, 340 değil. Hedefi
 *    doğrudan dereceye regresyon yapmak modeli 0/360 sınırında saçmalatır;
 *    (sin θ, cos θ) çiftini öğretip atan2 ile geri çevir.
 *
 * Kullanım: GET /api/ml/export?format=csv&source=era5&limit=5000
 *           (x-ingest-secret başlığı zorunlu)
 */

export const dynamic = "force-dynamic";

const MAX_LIMIT = 50000;

export async function GET(req: NextRequest) {
  const secret = process.env.ML_INGEST_SECRET;
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  if ("error" in db) return NextResponse.json(db, { status: 500 });

  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") === "csv" ? "csv" : "json";
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get("limit")) || 10000));
  const source = sp.get("source");

  let path = `ml_progression?select=*&order=observed_at.asc&limit=${limit}`;
  if (source === "era5" || source === "live") path += `&weather_source=eq.${source}`;
  // Etiketsiz satır zaten görünümde yok; yön etiketi boş olanları da eleyelim
  path += "&head_bearing_deg=not.is.null";

  // ── Kapsam süzgeci: Ortadoğu ve güneydoğu hariç, gerisi içeride ──
  // Irak/Suriye/İran'daki "aktif yangın" kütlesi ağırlıkla petrol flare'i ve
  // tarla yakması; güneydoğuda ardışık anız ateşleri 3 km eşiğinde tek olaya
  // kümelenip "ilerleme" gibi görünüyor (ölçüldü: 260 olayın 90'ı tarım).
  // Avrupa ve Kafkasya komşuları içeride — oralarda anız yakma yaygın değil.
  //
  // Süzgeç DIŞA AKTARIMDA, silmeyle değil: satırlar tabloda duruyor, çünkü
  // "hangi ısı yangın değildi" sorusu ileride başka bir modelin eğitim
  // verisi olabilir. Uydu tespiti bir kez kaçarsa geri gelmiyor.
  // `?all=1` süzgeci kapatır.
  //
  // 🔑 Liste `lib/places`'ten geliyor: aynı ayrımı `api/ml/cone` (kaydetmeden
  // önce) ve olay listesi sıralaması (Ortadoğu en dibe) da kullanıyor. Daha
  // önce burada düz metin olarak duruyordu — üçüncü kopya.
  if (sp.get("all") !== "1") {
    const haric = [...GUNEYDOGU, ...ORTADOGU].join(",");
    path += `&il=not.in.(${haric})`;
  }

  const r = await db.select<Record<string, unknown>>(path);
  if ("error" in r) return NextResponse.json(r, { status: 502 });

  if (format === "json") {
    return NextResponse.json({ rows: r.rows.length, data: r.rows });
  }

  if (!r.rows.length) return new NextResponse("", { headers: CSV });

  const cols = Object.keys(r.rows[0]);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    cols.join(","),
    ...r.rows.map((row) => cols.map((c) => esc(row[c])).join(",")),
  ].join("\n");

  return new NextResponse(csv, { headers: CSV });
}

const CSV = {
  "Content-Type": "text/csv; charset=utf-8",
  "Content-Disposition": 'attachment; filename="ilerleme.csv"',
};
