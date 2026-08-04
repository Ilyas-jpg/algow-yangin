import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { archiveIndex } from "@/lib/archive-server";
import { supabaseAdmin } from "@/lib/ml-db";

/**
 * Arşive programatik erişim.
 *
 * NEDEN: Arşiv bugüne kadar yalnız `public/arsiv/*.json` statik dosyalarıydı
 * ve yalnız uygulamanın kendi sayfaları okuyabiliyordu — kayıtların
 * ilerleme geometrisi, geçiş geçmişi, o anki hava koşulları hiçbir yerden
 * sorgulanamıyordu. Aynı veri artık veri tabanında geçiş ve piksel
 * ayrıntısıyla duruyor; bu uç onu dışarı açıyor.
 *
 *   GET /api/archive                → kayıt listesi
 *   GET /api/archive?slug=x         → olay + geçişler (hava + ilerleme etiketi)
 *   GET /api/archive?slug=x&pts=1   → ham pikseller de (büyük olabilir)
 *
 * Erişim herkese açık: arşiv zaten `public/arsiv` altında yayında ve bu
 * verinin kamuya açık olması projenin amacı. Anahtar sunucuda kalıyor,
 * tarayıcıya `service_role` inmiyor.
 *
 * Veri tabanı yoksa (henüz göç edilmediyse) statik indekse düşer — arşiv
 * sayfaları çalışmaya devam etsin diye.
 */

export const dynamic = "force-dynamic";

/** Ham piksel istenirse tavan: Manavgat tek başına ~7 bin satır. */
const MAX_PTS = 20000;

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const wantPts = req.nextUrl.searchParams.get("pts") === "1";
  const admin = supabaseAdmin();
  // Yapılandırma yoksa `null`: her okuma statik yedeğe düşer, uç ayakta kalır.
  const db = "error" in admin ? null : admin;

  if (!slug) {
    if (db) {
      const r = await db.select<Record<string, unknown>>(
        "fire_event?select=slug,name,il,place,lon,lat,first_seen,last_seen," +
          "detections,frp_max,fuel,slope_pct,elev_m&origin=eq.archive&order=first_seen.desc"
      );
      if (!("error" in r) && r.rows.length) {
        return NextResponse.json({ source: "db", records: r.rows }, { headers: CACHE });
      }
    }
    // Statik yedek — DB yoksa arşiv yine listelenebilsin
    return NextResponse.json({ source: "static", records: archiveIndex() }, { headers: CACHE });
  }

  // Slug doğrudan sorguya giriyor: desen dışında hiçbir şey geçmemeli.
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) {
    return NextResponse.json({ error: "geçersiz slug" }, { status: 400 });
  }

  const ev = db
    ? await db.select<{ id: number }>(`fire_event?select=*&slug=eq.${slug}&limit=1`)
    : null;

  // DB yok, göç yapılmamış ya da kayıt henüz aktarılmamış → statik dosya.
  // Arşive erişim veri tabanının kurulmuş olmasına bağlı olmamalı.
  if (!db || !ev || "error" in ev || !ev.rows.length) {
    const stat = staticRecord(slug);
    if (stat) return NextResponse.json({ source: "static", ...stat }, { headers: CACHE });
    return NextResponse.json({ error: "kayıt yok" }, { status: 404 });
  }
  const olay = ev.rows[0];

  const passes = await db.select<Record<string, unknown>>(
    `fire_pass?select=*&event_id=eq.${olay.id}&order=pass_no.asc`
  );
  const body: Record<string, unknown> = {
    source: "db",
    event: olay,
    passes: "error" in passes ? [] : passes.rows,
  };

  if (wantPts) {
    const det = await db.select<Record<string, unknown>>(
      `fire_detection?select=pass_no,dt,lon,lat,frp,sat,dn&event_id=eq.${olay.id}` +
        `&order=dt.asc&limit=${MAX_PTS}`
    );
    body.detections = "error" in det ? [] : det.rows;
  }

  return NextResponse.json(body, { headers: CACHE });
}

/** Depodaki statik kayıt — `public/arsiv/<slug>.json` (sütunlu biçim). */
function staticRecord(slug: string): { record: unknown } | null {
  try {
    const raw = readFileSync(join(process.cwd(), "public", "arsiv", `${slug}.json`), "utf8");
    return { record: JSON.parse(raw) };
  } catch {
    return null;
  }
}

// Arşiv geçmiştir, değişmez; uzun cache güvenli.
const CACHE = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};
