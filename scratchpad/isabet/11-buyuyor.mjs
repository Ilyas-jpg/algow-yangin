/**
 * 11 — "büyüyor / yatay / geriliyor" rozeti gerçekten bir şey haber veriyor mu?
 *
 * Üründeki kural (EventPanel.trendOf) sezgisel ve hiç sınanmadı:
 *   ilk geçişin toplam FRP'si ile son geçişinki karşılaştırılır
 *   son > ilk × 1,25 → "büyüyor" · son < ilk × 0,75 → "geriliyor" · arası "yatay"
 *
 * Test: rozet, kullanıcının onu gördüğü ANDA hesaplanır (yalnız o ana kadarki
 * geçişlerle). Sonra BİR SONRAKİ aralıkta ne olduğuna bakılır:
 *   • yangın ne kadar ilerledi (km)
 *   • FRP büyüdü mü
 * Rozet işe yarıyorsa "büyüyor" diyenler, "geriliyor" diyenlerden belirgin
 * biçimde daha fazla ilerlemeli.
 */
import { readFileSync } from "node:fs";
const here = (f) => new URL(f, import.meta.url).pathname.replace(/^\//, "");

const cases = JSON.parse(readFileSync(here("cases-fuel.json"), "utf8"));

// Olay bazında zaman sırasına diz; her vaka bir (geçiş a → geçiş b) çifti
const olaylar = new Map();
for (const c of cases) {
  if (c.iler90 === null || c.iler90 === undefined) continue;
  (olaylar.get(c.ev) ?? olaylar.set(c.ev, []).get(c.ev)).push(c);
}
for (const arr of olaylar.values()) arr.sort((x, y) => x.t0 - y.t0);

/** Ürünün kuralı — yalnız o ana kadarki bilgiyle */
function rozet(ilkFrp, sonFrp) {
  if (sonFrp > ilkFrp * 1.25) return "büyüyor";
  if (sonFrp < ilkFrp * 0.75) return "geriliyor";
  return "yatay";
}

const satirlar = [];
for (const arr of olaylar.values()) {
  if (arr.length < 2) continue;
  const ilkFrp = arr[0].frpA; // olayın ilk geçişinin FRP'si
  for (let i = 0; i < arr.length; i++) {
    const c = arr[i];
    // Kullanıcı bu anda (a geçişi görüldüğünde) hangi rozeti görürdü?
    const r = rozet(ilkFrp, c.frpA);
    satirlar.push({
      rozet: r,
      // SONRAKİ aralıkta olan: ilerleme ve FRP değişimi
      ilerleme: c.iler90,
      ilerMax: c.ilerMax,
      frpOran: c.frpA > 0 ? c.frpB / c.frpA : null,
      saat: c.hours,
      devam: c.iler90 > 0.5, // kayda değer yeni alan yaktı mı
    });
  }
}
process.stdout.write(`${satirlar.length} vaka · ${olaylar.size} olay\n\n`);

const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * p)] : null; };
const ort = (a) => { const s = a.filter(Number.isFinite); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null; };

process.stdout.write("═".repeat(78) + "\n");
process.stdout.write("ROZET → SONRAKİ ARALIKTA NE OLDU?\n");
process.stdout.write("═".repeat(78) + "\n");
process.stdout.write("rozet         n     ilerleme(km)          FRP oranı   'yayılmaya devam' oranı\n");
process.stdout.write("                  ortanca   %90      ortanca\n");
const gruplar = {};
for (const s of satirlar) (gruplar[s.rozet] ??= []).push(s);
for (const ad of ["büyüyor", "yatay", "geriliyor"]) {
  const g = gruplar[ad] ?? [];
  if (!g.length) continue;
  process.stdout.write(
    `${ad.padEnd(12)}${String(g.length).padStart(5)}  ` +
      `${q(g.map((x) => x.ilerleme), 0.5).toFixed(2).padStart(7)}  ${q(g.map((x) => x.ilerleme), 0.9).toFixed(2).padStart(6)}  ` +
      `${(q(g.map((x) => x.frpOran), 0.5) ?? 0).toFixed(2).padStart(11)}  ` +
      `${("%" + (100 * g.filter((x) => x.devam).length / g.length).toFixed(0)).padStart(14)}\n`
  );
}

/* ── Ayırt edici mi? "büyüyor" ile "geriliyor" arasındaki fark anlamlı mı ── */
const B = gruplar["büyüyor"] ?? [], G = gruplar["geriliyor"] ?? [];
if (B.length > 20 && G.length > 20) {
  // Mann–Whitney U benzeri basit sıralama testi: rastgele seçilen bir "büyüyor"
  // vakasının bir "geriliyor" vakasından daha fazla ilerleme ihtimali (AUC).
  const auc = (a, b) => {
    let kazanan = 0, esit = 0, n = 0;
    const bs = b.map((x) => x.ilerleme).sort((p, q2) => p - q2);
    for (const x of a) {
      const v = x.ilerleme;
      let lo = 0, hi = bs.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (bs[m] < v) lo = m + 1; else hi = m; }
      let lo2 = 0, hi2 = bs.length;
      while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (bs[m] <= v) lo2 = m + 1; else hi2 = m; }
      kazanan += lo; esit += lo2 - lo; n += bs.length;
    }
    return (kazanan + esit / 2) / n;
  };
  const a1 = auc(B, G);
  process.stdout.write(
    `\nAyırt etme gücü (AUC): ${a1.toFixed(3)}\n` +
      `  0,50 = rozet hiçbir şey söylemiyor · 1,00 = kusursuz ayırıyor\n` +
      `  Yorum: rastgele bir "büyüyor" yangını, rastgele bir "geriliyor" yangınından\n` +
      `  %${(100 * a1).toFixed(0)} ihtimalle daha fazla ilerliyor.\n`
  );
}

/* ── Alternatif: son İKİ geçişin FRP eğilimi daha mı iyi haber veriyor? ── */
process.stdout.write("\n" + "═".repeat(78) + "\n");
process.stdout.write("ALTERNATİF KURAL: ilk-son yerine SON İKİ geçişin FRP oranı\n");
process.stdout.write("═".repeat(78) + "\n");
const alt = [];
for (const arr of olaylar.values()) {
  for (let i = 1; i < arr.length; i++) {
    const oncekiFrp = arr[i - 1].frpA, simdikiFrp = arr[i].frpA;
    if (!(oncekiFrp > 0)) continue;
    alt.push({ rozet: rozet(oncekiFrp, simdikiFrp), ilerleme: arr[i].iler90 });
  }
}
const g2 = {};
for (const s of alt) (g2[s.rozet] ??= []).push(s);
process.stdout.write("rozet         n     ilerleme ortanca   %90\n");
for (const ad of ["büyüyor", "yatay", "geriliyor"]) {
  const g = g2[ad] ?? [];
  if (!g.length) continue;
  process.stdout.write(
    `${ad.padEnd(12)}${String(g.length).padStart(5)}  ${q(g.map((x) => x.ilerleme), 0.5).toFixed(2).padStart(14)}  ${q(g.map((x) => x.ilerleme), 0.9).toFixed(2).padStart(6)}\n`
  );
}
