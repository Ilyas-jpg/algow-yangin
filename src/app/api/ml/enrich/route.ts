import { NextRequest, NextResponse } from "next/server";
import { corineAt } from "@/lib/corine";
import { nearestIndustrial } from "@/lib/industrial";
import { supabaseAdmin } from "@/lib/ml-db";

/**
 * Sinyalleri modelin kullanacağı bağlamla zenginleştirir.
 *
 * NEDEN GEREKLİ: `fuel` doldurulmadan model "sıcaksa yangındır" ezberler.
 * Mevcut `fire` etiketi "VIIRS'in de gördüğü gerçek termal anomali"
 * demek ve ANIZ ATEŞLERİNİ DE İÇERİYOR (ölçüm: 260 olayın 90'ı tarım).
 * Alarm vermek istediğimiz sınıf o değil. Yakıt sınıfı özellik olarak
 * girmezse model orman yangını ile anız ateşini ayıramaz.
 *
 * İki özellik yazılıyor:
 *   fuel                     ← CORINE arazi örtüsü (orman / tarım / yapı…)
 *   industrial_km + _kind    ← en yakın yanma tesisi (OSM, 7.771 kayıt)
 *
 * ⚠️ Sanayi yakınlığı ÖZELLİK, sert etiket değil — bkz. lib/industrial.ts.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Tek turda okunacak sinyal. */
const BATCH = 400;

/**
 * Tek turda sorgulanacak benzersiz CORINE hücresi.
 *
 * Kota disiplini `/api/fuel`'den devralındı: koordinat 0,05°'ye
 * yuvarlanıyor (cache anahtarı sabit kalsın) ve istekler altışarlı
 * dalgalar hâlinde gidiyor — eşzamanlı onlarca istek upstream'i 429'a
 * düşürüyor, bu dersi rüzgâr gridinde ödemiştik.
 */
const MAX_CELL = 60;
const DALGA = 6;

interface Signal {
  id: number;
  lon: number;
  lat: number;
}

const cellKey = (lon: number, lat: number) =>
  `${Math.round(lon * 20) / 20},${Math.round(lat * 20) / 20}`;

export async function GET(req: NextRequest) {
  const secret = process.env.ML_INGEST_SECRET;
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  if ("error" in db) return NextResponse.json(db, { status: 500 });

  const bekleyen = await db.select<Signal>(
    `heat_signal?enriched_at=is.null&select=id,lon,lat&order=scanned_at.asc&limit=${BATCH}`
  );
  if ("error" in bekleyen) return NextResponse.json(bekleyen, { status: 502 });
  if (!bekleyen.rows.length) return NextResponse.json({ ok: true, bekleyen: 0 });

  // Hücreye göre tekilleştir: aynı yangının onlarca pikseli tek CORINE
  // hücresine düşüyor, hepsi için ayrı sorgu atmak kotayı boşa harcar.
  const hucreler = new Map<string, { lon: number; lat: number }>();
  for (const s of bekleyen.rows) {
    const k = cellKey(s.lon, s.lat);
    if (!hucreler.has(k) && hucreler.size < MAX_CELL) {
      hucreler.set(k, {
        lon: Math.round(s.lon * 20) / 20,
        lat: Math.round(s.lat * 20) / 20,
      });
    }
  }

  const fuelOf = new Map<string, string | null>();
  const liste = [...hucreler.entries()];
  for (let i = 0; i < liste.length; i += DALGA) {
    const dilim = liste.slice(i, i + DALGA);
    const sonuc = await Promise.all(dilim.map(([, p]) => corineAt(p.lon, p.lat)));
    dilim.forEach(([k], j) => fuelOf.set(k, sonuc[j] ?? null));
  }

  const simdi = new Date().toISOString();
  const guncelle: Record<string, unknown>[] = [];
  let yakitBulunan = 0;
  let sanayiYakin = 0;

  for (const s of bekleyen.rows) {
    const k = cellKey(s.lon, s.lat);
    // Hücresi bu turda sorgulanmadıysa bir sonraki tura bırak — yoksa
    // `enriched_at` damgalanır ve o sinyal yakıtsız kalır.
    if (!fuelOf.has(k)) continue;

    const fuel = fuelOf.get(k) ?? null;
    const sanayi = nearestIndustrial(s.lon, s.lat);
    if (fuel) yakitBulunan++;
    if (sanayi && sanayi.km <= 5) sanayiYakin++;

    guncelle.push({
      id: s.id,
      fuel,
      industrial_km: sanayi ? Math.round(sanayi.km * 100) / 100 : null,
      industrial_kind: sanayi?.kind ?? null,
      enriched_at: simdi,
    });
  }

  if (!guncelle.length) return NextResponse.json({ ok: true, islenen: 0 });

  const yaz = await db.rpc<number>("apply_heat_enrichment", { payload: guncelle });
  if ("error" in yaz) return NextResponse.json(yaz, { status: 502 });

  return NextResponse.json({
    ok: true,
    guncellenen: yaz.result,
    islenen: guncelle.length,
    hucre: hucreler.size,
    yakitBulunan,
    // CORINE doğu illerini kapsamıyor; null kalması beklenen bir durum.
    yakitYok: guncelle.length - yakitBulunan,
    sanayi5kmIcinde: sanayiYakin,
  });
}
