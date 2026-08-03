/**
 * Tekrar denemeli JSON çekimi.
 *
 * Open-Meteo eşzamanlı istek yoğunluğunda 429/5xx dönebiliyor; tek denemede
 * pes etmek paneli sebepsiz "veri yok"a düşürüyordu. 4xx (429 hariç) kalıcı
 * hatadır, tekrar denenmez.
 */
export async function fetchJson<T>(
  url: string,
  revalidate: number
): Promise<T | null> {
  const body = await fetchText(url, revalidate);
  if (body === null) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

/** Aynı politika, gövdeyi ham metin olarak döner (RSS/XML için). */
export async function fetchText(
  url: string,
  revalidate: number,
  init?: RequestInit
): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { ...init, next: { revalidate } });
      if (res.ok) return await res.text();
      if (res.status < 500 && res.status !== 429) return null;
    } catch {
      /* ağ hatası — tekrar dene */
    }
    await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
  }
  return null;
}
