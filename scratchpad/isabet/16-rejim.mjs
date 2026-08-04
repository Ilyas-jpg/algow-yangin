/**
 * 16 — REJİM KURALI: zayıf rüzgârda yangının KENDİ EKSENİ, güçlü rüzgârda fizik
 *
 * 15-harman.mjs'in tek sağlam bulgusu: sabit ağırlıklı harman kazanç vermiyor,
 * ama rüzgâr rejimine göre HANGİ tahmincinin iyi olduğu keskin biçimde
 * değişiyor ve bu ÜÇ BAĞIMSIZ cephe tanımında da aynı yönde tekrarlıyor:
 *
 *            fizik   persist        (ort. hata, cephe/alanCephe tanımı)
 *   <8 km/sa  90–98°   76–77°   → yangının kendi ekseni KAZANIYOR
 *   8–15      80–81°   74–78°   → başabaş
 *   ≥15       67–71°   88–91°   → fizik KAZANIYOR
 *
 * Fiziksel gerekçe (kural veriye bakılmadan da savunulabilir): 3 km/sa'lik bir
 * rüzgâr vektörünün YÖNÜ bilgi taşımaz — hem gerçek akış kaotiktir hem de
 * ERA5/Open-Meteo yön hatası düşük hızda patlar. O rejimde yangının kendi
 * kurulmuş ekseni (yakıt dizilimi, önceki cephe) daha kararlı bir kestirici.
 *
 * ⚠️ EŞİK ÖNCEDEN SABİTLENDİ (8 km/sa) — veriden seçilmedi. Duyarlılık ayrıca
 * raporlanıyor; eşik oynadıkça sonuç uçuyorsa bulgu gürültüdür.
 */
import { readFileSync } from "node:fs";
import { angDiff, bootDiff, ekey, ozet, phis, vecSum, windAt } from "./fizik.mjs";

const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");
const cases = JSON.parse(readFileSync(here("cases-cephe.json"), "utf8"));
const wind = JSON.parse(readFileSync(here("wind-w.json"), "utf8"));
const elev = JSON.parse(readFileSync(here("elev-srtm.json"), "utf8"));

const rows = [];
for (const c of cases) {
  if (!["ORMAN", "MAKI"].includes(c.yakit)) continue;
  const e = elev[ekey(c)];
  const w = windAt(wind, c, c.t0, c.t0);
  if (!e || !w) continue;
  const { phiW, phiS } = phis(c.yakit, w.kmh, e.egim);
  rows.push({
    c,
    fizik: vecSum([[w.deg, phiW], [e.yokus, phiS]]),
    windKmh: w.kmh,
    sezon: new Date(c.t0).getUTCFullYear(),
  });
}

/**
 * Melez tahmin: rüzgâr eşiğin altındaysa persistence, üstündeyse fizik.
 * Persistence yoksa (ilk geçiş çifti) her hâlde fizik — üretimdeki davranış.
 */
function melez(r, olcut, esik) {
  const p = r.c.prev?.[olcut];
  if (r.windKmh < esik && p != null) return p;
  return r.fizik;
}

function rapor(olcut, esik = 8) {
  const pool = rows.filter((r) => r.c[olcut] !== null && r.fizik !== null);
  const evs = new Set(pool.map((r) => r.c.ev)).size;
  const zayif = pool.filter((r) => r.windKmh < esik);
  const zayifP = zayif.filter((r) => r.c.prev?.[olcut] != null);
  const eF = (r) => angDiff(r.fizik, r.c[olcut]);
  const eM = (r) => {
    const t = melez(r, olcut, esik);
    return t === null ? NaN : angDiff(t, r.c[olcut]);
  };
  const f = ozet(pool.map(eF));
  const m = ozet(pool.map(eM));
  const d = bootDiff(pool.map((r) => ({ ev: r.c.ev, a: eM(r), b: eF(r) })));
  const ort = pool.reduce((s, r) => s + (eM(r) - eF(r)), 0) / pool.length;
  process.stdout.write(
    `\n${olcut} · eşik ${esik} km/sa · ${pool.length} vaka / ${evs} yangın ` +
      `(zayıf rüzgâr ${zayif.length}, bunun persistence'ı olan ${zayifP.length} → kural bu kadarını değiştiriyor)\n` +
      `  FIZIK  medyan ${f.med.toFixed(1)}°  ort ${f.ort.toFixed(1)}°  ≤45° %${f.p45.toFixed(0)}  >135° %${f.ust135.toFixed(0)}\n` +
      `  MELEZ  medyan ${m.med.toFixed(1)}°  ort ${m.ort.toFixed(1)}°  ≤45° %${m.p45.toFixed(0)}  >135° %${m.ust135.toFixed(0)}\n` +
      `  eşleşmiş fark ${ort >= 0 ? "+" : ""}${ort.toFixed(1)}°  %95 GA ${d ? `${d[0].toFixed(1)}…${d[1].toFixed(1)}°` : "—"}` +
      `  → ${d && d[1] < 0 ? "✅ KAZANÇ KANITLI" : d && d[0] > 0 ? "🔴 ZARAR" : "❌ kanıtlanmadı"}\n`
  );
  return { f, m, d };
}

/** Sezon-dışı: eşik sabit olduğu için fit edilecek parametre YOK; yine de
 *  her sezonu ayrı ayrı raporla — bulgu tek bir sezondan mı geliyor? */
function sezonBazli(olcut, esik = 8) {
  const pool = rows.filter((r) => r.c[olcut] !== null && r.fizik !== null);
  process.stdout.write(`  sezon sezon (${olcut}, eşik ${esik}):\n`);
  for (const s of [...new Set(pool.map((r) => r.sezon))].sort()) {
    const sub = pool.filter((r) => r.sezon === s);
    if (sub.length < 8) {
      process.stdout.write(`    ${s}  n=${String(sub.length).padStart(3)} (yetersiz)\n`);
      continue;
    }
    const f = ozet(sub.map((r) => angDiff(r.fizik, r.c[olcut])));
    const m = ozet(
      sub.map((r) => {
        const t = melez(r, olcut, esik);
        return t === null ? NaN : angDiff(t, r.c[olcut]);
      })
    );
    const deg = sub.filter((r) => r.windKmh < esik && r.c.prev?.[olcut] != null).length;
    process.stdout.write(
      `    ${s}  n=${String(sub.length).padStart(3)}  fizik ${f.ort.toFixed(0)}° → melez ${m.ort.toFixed(0)}°  ` +
        `(${deg} vaka değişti)  ${m.ort < f.ort ? "↓" : m.ort > f.ort ? "↑" : "="}\n`
    );
  }
}

process.stdout.write(`${rows.length} orman+maki vakası · rastgele beklenti 90°\n`);
for (const o of ["cephe", "cepheBas", "alanCephe", "merkez"]) {
  rapor(o, 8);
  sezonBazli(o, 8);
}

process.stdout.write(`\n${"═".repeat(74)}\nEŞİK DUYARLILIĞI (cephe ölçütü) — eşik oynadıkça sonuç uçuyor mu?\n${"═".repeat(74)}\n`);
for (const esik of [4, 6, 8, 10, 12, 15]) {
  const pool = rows.filter((r) => r.c.cephe !== null && r.fizik !== null);
  const eF = (r) => angDiff(r.fizik, r.c.cephe);
  const eM = (r) => {
    const t = melez(r, "cephe", esik);
    return t === null ? NaN : angDiff(t, r.c.cephe);
  };
  const f = ozet(pool.map(eF));
  const m = ozet(pool.map(eM));
  const d = bootDiff(pool.map((r) => ({ ev: r.c.ev, a: eM(r), b: eF(r) })));
  const deg = pool.filter((r) => r.windKmh < esik && r.c.prev?.cephe != null).length;
  process.stdout.write(
    `  eşik ${String(esik).padStart(2)} km/sa · ${String(deg).padStart(3)} vaka değişti · ` +
      `fizik ${f.ort.toFixed(1)}° → melez ${m.ort.toFixed(1)}°  fark ${(m.ort - f.ort).toFixed(1)}°  ` +
      `GA ${d ? `${d[0].toFixed(1)}…${d[1].toFixed(1)}` : "—"}\n`
  );
}
