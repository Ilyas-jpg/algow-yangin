import { NextResponse } from "next/server";
import { fetchText } from "@/lib/fetch-retry";
import {
  bitkiYanginiMi,
  buildSignals,
  matchPlace,
  parseRss,
  type NewsSignal,
  type RawItem,
} from "@/lib/news";

/**
 * Haber sinyali — uydunun göremediği yangınların tek ücretsiz kanalı.
 *
 * Gerekçe ve sınırlar `lib/news.ts` başında. Buradaki tek karar kaynak
 * seçimi: Google Haberler RSS. Anahtarsız, ücretsiz, Türkçe yayınları
 * toplu tarıyor ve `pubDate` ile yayın anını veriyor — Bayramiç yangınının
 * ilk başlığı çıktıktan ~10 dakika sonra bu beslemede vardı.
 *
 * ⚠️ Başlıkları yorumlamıyoruz, kırpmıyoruz, yeniden yazmıyoruz; yayın adı
 * ve linkiyle olduğu gibi taşıyoruz. Doğruluk iddiası bizim değil.
 */

/** İki sorgu: biri yüksek isabet, biri "otluk alanda yangın çıktı" tipini yakalar. */
const SORGULAR = ["orman yangını", "yangın çıktı"];

const RSS = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(
    `${q} when:2d`
  )}&hl=tr&gl=TR&ceid=TR:tr`;

/**
 * 10 dakika. Haber akışı sürekli değişiyor ama bu bir "ilk haber" kanalı,
 * saniye hassasiyeti gerekmiyor; uydu katmanlarıyla aynı mertebede kalsın.
 */
const REVALIDATE = 600;

export interface NewsResponse {
  signals: NewsSignal[];
  fetchedAt: number;
  meta: {
    /** kaç sorgu yanıt verdi */
    sourcesOk: number;
    sourcesTotal: number;
    /** yer eşleşmesi tutmadığı için düşen haber sayısı — sessizce yutmuyoruz */
    unlocated: number;
  };
}

export async function GET() {
  const now = Date.now();

  const bodies = await Promise.all(
    SORGULAR.map((q) =>
      fetchText(RSS(q), REVALIDATE, {
        // Google bazı istemcilere boş gövde dönüyor; sıradan bir tarayıcı gibi iste.
        headers: { "user-agent": "Mozilla/5.0 (compatible; AlgowYangin/1.0)" },
      })
    )
  );

  const sourcesOk = bodies.filter((b) => b !== null).length;

  // Aynı haber iki sorgudan da gelebilir — linke göre tekille.
  const gorulen = new Set<string>();
  const items: RawItem[] = [];
  for (const body of bodies) {
    if (!body) continue;
    for (const it of parseRss(body)) {
      const k = it.link || `${it.source}|${it.title}`;
      if (gorulen.has(k)) continue;
      gorulen.add(k);
      items.push(it);
    }
  }

  const signals = buildSignals(items, { now });

  // Yer çıkarılamayan haber: katmanın kendi kör noktası, arayüzde yazılıyor.
  // Yalnız BİTKİ ÖRTÜSÜ yangınları sayılır — ev/araç yangını haberinin yeri
  // bulunamamış olması bizim eksiğimiz değil, o haber zaten bize ait değil.
  const unlocated = items.filter(
    (i) =>
      /yang[ıi]n/i.test(i.title) &&
      bitkiYanginiMi(i.title) &&
      matchPlace(i.title) === null
  ).length;

  return NextResponse.json<NewsResponse>(
    {
      signals,
      fetchedAt: now,
      meta: { sourcesOk, sourcesTotal: SORGULAR.length, unlocated },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    }
  );
}
