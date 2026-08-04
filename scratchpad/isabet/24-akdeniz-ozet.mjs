/**
 * 24 — PAN-AKDENİZ KORPUSUNUN KARNESİ
 *
 * Spec §7.2: *"232 ilerleme ML için çok küçük... örneklem binlere çıkar.
 * Pan-Akdeniz'de eğit, Türkiye'yi holdout bırak."* Bu betik o iddianın
 * gerçekleşip gerçekleşmediğini sayıyor.
 *
 * ⚠️ OLAY BİRİMİ VAKADAN ÖNEMLİ. Aynı yangının vakaları bağımsız değil; 1.205
 * orman tespiti "62 hücre" çıkmıştı (bkz. proje notu). Bu yüzden hem vaka hem
 * OLAY sayılıyor — grup-bazlı bölmede eğitim setinin boyu olay sayısıdır.
 *
 * ⚠️ ORTADOĞU ELENİYOR (İlyas'ın 2026-08-03 kararı): Irak/Suriye/İran'daki
 * "aktif yangın" kütlesi ağırlıkla petrol flare'i ve tarla yakması. Veri
 * SİLİNMİYOR, yalnız eğitim havuzundan çıkarılıyor — `/api/ml/export` de aynısını
 * yapıyor.
 */
import { readdirSync, readFileSync } from "node:fs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const ORTADOGU = new Set(["Irak", "Suriye", "İran"]);

const dosyalar = readdirSync(here("."))
  .filter((f) => /^vaka-akdeniz-\d{4}\.json$/.test(f))
  .sort();

const hepsi = [];
for (const f of dosyalar) {
  const v = JSON.parse(readFileSync(here(f), "utf8"));
  hepsi.push(...v);
}

const olay = (set) => new Set(set.map((c) => c.ev)).size;
const yonlu = (set) => set.filter((c) => c.cephe !== null);
const sat = (ad, set) =>
  `${ad.padEnd(24)}${String(set.length).padStart(7)} vaka ${String(olay(set)).padStart(6)} olay ` +
  `${String(yonlu(set).length).padStart(7)} yön ${String(olay(yonlu(set))).padStart(6)} yön-olay`;

process.stdout.write(
  `PAN-AKDENİZ KORPUSU · ${dosyalar.length} sezon (${dosyalar[0].slice(-9, -5)}–${dosyalar[dosyalar.length - 1].slice(-9, -5)})\n` +
    `${"═".repeat(78)}\n${sat("HAM (her yer)", hepsi)}\n`
);

const egitim = hepsi.filter((c) => !ORTADOGU.has(c.bolge));
process.stdout.write(`${sat("Ortadoğu elenmiş", egitim)}\n`);

const tr = egitim.filter((c) => c.bolge === "Türkiye");
const disi = egitim.filter((c) => c.bolge !== "Türkiye");
process.stdout.write(
  `${sat("  → Türkiye (holdout)", tr)}\n${sat("  → pan-Akdeniz (eğitim)", disi)}\n${"═".repeat(78)}\n`
);

/* ── bölge dağılımı (eğitim havuzu) ── */
const b = {};
for (const c of disi) {
  b[c.bolge] ??= { vaka: 0, ev: new Set() };
  b[c.bolge].vaka++;
  b[c.bolge].ev.add(c.ev);
}
process.stdout.write("\nEĞİTİM HAVUZU BÖLGELERİ (Türkiye holdout, Ortadoğu hariç)\n");
for (const [ad, v] of Object.entries(b).sort((x, y) => y[1].vaka - x[1].vaka))
  process.stdout.write(`  ${ad.padEnd(18)}${String(v.vaka).padStart(6)} vaka  ${String(v.ev.size).padStart(5)} olay\n`);

/* ── sezona göre (sezon-bazlı bölme için) ── */
process.stdout.write("\nSEZONA GÖRE (eğitim havuzu, yön içeren)\n");
const sezon = {};
for (const c of yonlu(disi)) {
  const y = new Date(c.t0).getUTCFullYear();
  sezon[y] ??= { vaka: 0, ev: new Set() };
  sezon[y].vaka++;
  sezon[y].ev.add(c.ev);
}
for (const y of Object.keys(sezon).sort())
  process.stdout.write(`  ${y}  ${String(sezon[y].vaka).padStart(5)} vaka  ${String(sezon[y].ev.size).padStart(4)} olay\n`);

/* ── mevcut Türkiye korpusuyla kıyas ── */
const eski = JSON.parse(readFileSync(here("cases-cephe.json"), "utf8"));
const eskiYonlu = eski.filter((c) => ["ORMAN", "MAKI"].includes(c.yakit) && c.cephe !== null);
process.stdout.write(
  `\n${"─".repeat(78)}\nKIYAS — P2'de kullanılan set: ${eskiYonlu.length} vaka / ` +
    `${new Set(eskiYonlu.map((c) => c.ev)).size} olay (orman+maki, yön içeren, yalnız Türkiye)\n` +
    `Yeni eğitim havuzu: ${yonlu(disi).length} vaka / ${olay(yonlu(disi))} olay ` +
    `→ **${(yonlu(disi).length / eskiYonlu.length).toFixed(1)}× vaka, ` +
    `${(olay(yonlu(disi)) / new Set(eskiYonlu.map((c) => c.ev)).size).toFixed(1)}× olay**\n` +
    `⚠️ Ama yakıt HENÜZ AYRIŞMADI: eski set orman+maki süzülmüştü, yenisinde CORINE\n` +
    `   yalnız Türkiye hücreleri için çekili. Anız dahil bu sayı üst sınır;\n` +
    `   yakıt doldurulunca (sıradaki adım) düşecek.\n`
);
