/**
 * Türkiye'deki YANMA KAYNAKLI sanayi tesislerini OpenStreetMap'ten pişirir.
 *
 * Neden: uydu alev değil ISI görür. Rafineri bacası, çelik fabrikası,
 * termik santral ve gaz flare'i her gün sıcaktır. Elimizdeki sabit kaynak
 * listesi (50 kayıt) FIRMS verisinden türetilmişti — "aynı hücrede ≥40
 * ayrı gün sıcak". Bu güçlü ama DAR: yalnız uydunun sık gördüğü büyük
 * tesisleri yakalıyor ve modele "burası tesis" bilgisini ancak o eşiği
 * geçtikten sonra verebiliyor.
 *
 * OSM ise tesisin NEREDE olduğunu baştan söylüyor. Bunu MODELE ÖZELLİK
 * olarak veriyoruz (en yakın yanma tesisine uzaklık + türü), sert etiket
 * olarak DEĞİL: bir rafineriden 2 km ötede gerçek orman yangını çıkabilir
 * ve "yakınında fabrika var" demek onu yangın olmaktan çıkarmaz.
 *
 * ⚠️ Güneş/rüzgâr/hidro santraller BİLEREK dışarıda — ısı üretmezler,
 * dahil edilseler modele yanlış sinyal verirlerdi.
 */
import { writeFileSync } from "node:fs";

const SORGU = `[out:json][timeout:300];
area["ISO3166-1"="TR"][admin_level=2]->.tr;
(
  nwr["man_made"="works"](area.tr);
  nwr["industrial"="refinery"](area.tr);
  nwr["man_made"="petroleum_well"](area.tr);
  nwr["man_made"="flare"](area.tr);
  nwr["man_made"="chimney"](area.tr);
  nwr["power"="plant"]["plant:source"~"^(coal|gas|oil|diesel|biomass|waste|geothermal)$"](area.tr);
  nwr["landuse"="quarry"]["resource"="lime"](area.tr);
);
out center tags;`;

const UCLAR = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];

// Overpass User-Agent'sız isteklere 406 veriyor; kim olduğumuzu söylüyoruz.
// ⚠️ ASCII olmalı: HTTP başlıkları latin-1 (ByteString) — Türkçe karakter
// koyunca fetch "Cannot convert argument to a ByteString" diye patlıyor.
const UA = "AlgowYangin/1.0 (public-interest wildfire map; info@algow.net)";

let veri = null;
for (const u of UCLAR) {
  for (let deneme = 0; deneme < 2 && !veri; deneme++) {
    try {
      console.log("deneniyor:", u, deneme ? "(2. deneme)" : "");
      const res = await fetch(u, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": UA,
          Accept: "application/json",
        },
        body: "data=" + encodeURIComponent(SORGU),
      });
      if (!res.ok) {
        console.log("  HTTP", res.status);
        // 429 = meşgul; kısa bekleyip bir kez daha dene.
        if (res.status === 429) await new Promise((r) => setTimeout(r, 8000));
        continue;
      }
      veri = await res.json();
    } catch (e) {
      console.log("  hata:", String(e.message).slice(0, 60));
    }
  }
  if (veri) break;
}
if (!veri) {
  console.error("Overpass'tan veri alınamadı");
  process.exit(1);
}

/** OSM etiketlerinden kaba bir tür çıkar — model için kategorik özellik. */
function tur(t = {}) {
  if (t.industrial === "refinery" || t["works:type"] === "refinery") return "rafineri";
  if (t.man_made === "flare") return "flare";
  if (t.man_made === "chimney") return "baca";
  if (t.man_made === "petroleum_well") return "petrol";
  if (t.power === "plant") return "santral_" + (t["plant:source"] ?? "?");
  if (t.man_made === "works") {
    const w = (t["works:type"] ?? t.product ?? "").toLowerCase();
    if (/steel|iron|demir|çelik/.test(w)) return "celik";
    if (/cement|çimento/.test(w)) return "cimento";
    if (/glass|cam/.test(w)) return "cam";
    return "fabrika";
  }
  if (t.resource === "lime") return "kirec";
  return "diger";
}

const kayitlar = [];
const gorulen = new Set();
for (const el of veri.elements ?? []) {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  // 0,002° (~200 m) ızgarada tekille: aynı tesisin bina/alan/nokta
  // kayıtları OSM'de üç ayrı öğe olarak duruyor.
  const k = `${lon.toFixed(3)},${lat.toFixed(3)}`;
  if (gorulen.has(k)) continue;
  gorulen.add(k);
  kayitlar.push([+lon.toFixed(4), +lat.toFixed(4), tur(el.tags)]);
}

kayitlar.sort((a, b) => a[0] - b[0]);

const sayim = {};
for (const [, , t] of kayitlar) sayim[t] = (sayim[t] ?? 0) + 1;

const out = `/**
 * Türkiye'deki yanma kaynaklı sanayi tesisleri — OpenStreetMap (ODbL).
 *
 * Üretim: \`scratchpad/sanayi-pisir.mjs\` (Overpass API).
 * Uydu alev değil ISI görür; rafineri, çelik fabrikası, termik santral ve
 * gaz flare'i her gün sıcaktır.
 *
 * ⚠️ Bu liste SERT ETİKET DEĞİL, MODELE ÖZELLİK. "Yakınında fabrika var"
 * bir tespiti yangın olmaktan çıkarmaz — rafineriden 2 km ötede gerçek
 * orman yangını çıkabilir. Sert negatif etiket yalnız ölçülmüş kanıttan
 * gelir (aynı hücrede ≥40 ayrı gün sıcak, bkz. data/fixed-sources.ts).
 *
 * ⚠️ Güneş/rüzgâr/hidro santraller bilerek YOK — ısı üretmezler.
 *
 * [lon, lat, tür]
 */
export type SanayiTur =
${[...new Set(kayitlar.map((k) => k[2]))].sort().map((t) => `  | ${JSON.stringify(t)}`).join("\n")};

export const SANAYI_TR: [number, number, SanayiTur][] = ${JSON.stringify(kayitlar)
  .replace(/\],\[/g, "],\n  [")
  .replace(/^\[/, "[\n  ")
  .replace(/\]$/, ",\n]")};
`;

writeFileSync("src/data/industrial-tr.ts", out);
console.log("");
console.log("kayıt:", kayitlar.length, "· dosya:", Math.round(out.length / 1024), "KB");
console.log("tür dağılımı:", JSON.stringify(sayim, null, 1));
