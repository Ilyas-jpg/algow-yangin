/**
 * Backfill sürücüsü — arşivi güne yayarak çeker.
 *
 * Neden güne yayıyoruz: modelin ezberlemesini engellemek için MEVSİM ve
 * BÖLGE çeşitliliği lazım. Tek bir haftanın 24 saatini çekmek, o haftanın
 * yangınlarını ezberletir; 45 günün dörder saatini çekmek aynı indirme
 * maliyetiyle 45 farklı gün verir.
 *
 * Ayrıca negatif sınıf (sabit sanayi kaynağı) için gün sayısı kritik:
 * tesisler 24 saat sıcak, yani hangi saati çektiğin fark etmiyor — kaç
 * ayrı gün çektiğin fark ediyor.
 *
 * Kullanım: node scratchpad/backfill-surucu.mjs 2026-06-19 2026-07-11
 */
import { readFileSync } from "node:fs";

const env = readFileSync("C:/Users/milya/Desktop/00-Projeler/algow-yangin/.env.local", "utf8");
const SECRET = (env.match(/^ML_INGEST_SECRET=(.*)$/m)?.[1] ?? "").trim();
const BASE = "http://localhost:3060";

/** Her günden çekilecek pencere (UTC). 09-13 = 12:00-16:00 TR, yangın tepe saatleri. */
const SAAT_BAS = 9;
const SLOTS = 24; // 4 saat

const [ilkGun, sonGun] = process.argv.slice(2);
if (!ilkGun || !sonGun) {
  console.error("kullanım: node backfill-surucu.mjs <YYYY-MM-DD> <YYYY-MM-DD>");
  process.exit(1);
}

const bas = Date.parse(`${ilkGun}T00:00:00Z`);
const son = Date.parse(`${sonGun}T00:00:00Z`);
let toplamSatir = 0;
let toplamDilim = 0;
let hata = 0;
const t0 = Date.now();

for (let g = bas; g <= son; g += 86400_000) {
  const gun = new Date(g).toISOString().slice(0, 10);
  const from = `${gun}T${String(SAAT_BAS).padStart(2, "0")}:00:00Z`;
  try {
    const res = await fetch(`${BASE}/api/ml/backfill?from=${from}&slots=${SLOTS}`, {
      headers: { "x-ingest-secret": SECRET },
    });
    if (!res.ok) {
      hata++;
      console.log(`  ${gun}  ✗ HTTP ${res.status}`);
      continue;
    }
    const j = await res.json();
    toplamSatir += j.rows ?? 0;
    toplamDilim += j.okunanDilim ?? 0;
    console.log(
      `  ${gun}  ${String(j.okunanDilim).padStart(2)} dilim  ${String(j.rows).padStart(4)} satır` +
        (j.bosDilim ? `  (${j.bosDilim} boş)` : "")
    );
  } catch (e) {
    hata++;
    console.log(`  ${gun}  ✗ ${String(e.message).slice(0, 50)}`);
  }
}

const dk = ((Date.now() - t0) / 60000).toFixed(1);
console.log("");
console.log(`TOPLAM: ${toplamDilim} dilim · ${toplamSatir} satır · ${hata} hata · ${dk} dk`);
