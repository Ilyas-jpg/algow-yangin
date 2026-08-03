/**
 * Haber sinyali testleri.
 *
 * Bu katman kamu güvenliği haritasına "doğrulanmamış ihbar" koyuyor.
 * Yanlış yere pin düşürmek, hiç pin düşürmemekten daha zararlı — o yüzden
 * buradaki testlerin çoğu YANLIŞ POZİTİFİ kovalıyor. Üçü de canlı veride
 * gerçekten görülmüş hatalardır, uydurma senaryo değil.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bitkiYanginiMi,
  buildSignals,
  matchPlace,
  parseRss,
  readStatus,
  taninanKaynakMi,
  YARICAP_KM,
  type RawItem,
} from "./news.ts";

const T0 = Date.parse("2026-08-02T20:00:00Z");

function item(title: string, dkOnce = 0, source = "Kaynak"): RawItem {
  return {
    title,
    link: `https://ornek/${encodeURIComponent(title)}`,
    source,
    t: T0 - dkOnce * 60_000,
  };
}

test("parseRss başlık, kaynak ve zamanı çıkarır", () => {
  const xml = `<rss><channel>
    <item>
      <title>Bayramiç’teki orman yangını kontrol altına alındı - Yeni Şafak</title>
      <link>https://ornek/haber</link>
      <pubDate>Sun, 02 Aug 2026 20:14:31 GMT</pubDate>
      <source url="https://yenisafak.com">Yeni Şafak</source>
    </item>
  </channel></rss>`;
  const out = parseRss(xml);
  assert.equal(out.length, 1);
  // Google başlığın sonuna " - Yayın" ekliyor; <source> zaten taşıyor.
  assert.equal(out[0].title, "Bayramiç’teki orman yangını kontrol altına alındı");
  assert.equal(out[0].source, "Yeni Şafak");
  assert.equal(out[0].t, Date.parse("2026-08-02T20:14:31Z"));
});

test("parseRss CDATA ve HTML varlıklarını çözer", () => {
  const xml = `<rss><item>
    <title><![CDATA[Muğla&#39;da orman yangını]]></title>
    <link>https://ornek/x</link>
    <pubDate>Sun, 02 Aug 2026 18:00:00 GMT</pubDate>
  </item></rss>`;
  assert.equal(parseRss(xml)[0].title, "Muğla'da orman yangını");
});

test("matchPlace ilçeyi ile tercih eder", () => {
  const m = matchPlace("Çanakkale'nin Bayramiç ilçesinde orman yangını");
  assert.ok(m);
  assert.equal(m.place[0], "Bayramiç");
  assert.equal(m.precision, "ilce");
});

test("matchPlace Türkçe ekli yazımı yakalar", () => {
  const m = matchPlace("Bayramiç'te orman yangını çıktı");
  assert.equal(m?.place[0], "Bayramiç");
});

test("matchPlace küçük harfli gündelik kelimeyi yer sanmaz", () => {
  // CANLI HATA: "bahçe yangını" başlığı Bahçe/Osmaniye ilçesine pin düşürüyordu.
  assert.equal(matchPlace("Evin bahçe kısmında yangın çıktı"), null);
  // Aynı kelime özel ad olarak geçtiğinde eşleşmeli.
  assert.equal(matchPlace("Bahçe ilçesinde orman yangını")?.place[0], "Bahçe");
});

test("matchPlace tümü büyük harfli başlıkta ayrımı zorlamaz", () => {
  assert.equal(matchPlace("BAYRAMİÇ'TE ORMAN YANGINI")?.place[0], "Bayramiç");
});

test("matchPlace yalnız il geçiyorsa il hassasiyeti döner", () => {
  const m = matchPlace("Çanakkale'de orman yangını");
  assert.equal(m?.place[0], "Çanakkale");
  assert.equal(m?.precision, "il");
});

test("readStatus durumu başlıktan okur", () => {
  assert.equal(readStatus("Bayramiç'te orman yangını"), "devam");
  assert.equal(readStatus("Yangın kontrol altına alındı"), "kontrol");
  assert.equal(readStatus("Orman yangını söndürüldü"), "sondu");
});

test("bitkiYanginiMi bina yangınını eler", () => {
  // CANLI HATA: ilk çekimde gelen ilk sinyal buydu.
  assert.equal(bitkiYanginiMi("Erzurum'da yangın: 6 kişi dumandan etkilendi"), false);
  assert.equal(bitkiYanginiMi("Otluk alanda çıkan yangın"), true);
  assert.equal(bitkiYanginiMi("Bayramiç'te orman yangını"), true);
});

test("buildSignals bitki örtüsü kanıtı olmayan grubu düşürür", () => {
  const out = buildSignals([item("Konya'da yangın: 2 araç kullanılamaz hale geldi")], {
    now: T0,
  });
  assert.equal(out.length, 0);
});

test("buildSignals kanıtı GRUP düzeyinde arar", () => {
  // Yeni başlıkta "orman" geçmiyor ama aynı yerin eski haberinde geçiyor;
  // sinyal düşmemeli ve durumu YENİ başlıktan almalı.
  const out = buildSignals(
    [
      item("Bayramiç'te orman yangını çıktı", 300, "A"),
      item("Bayramiç'teki yangın kontrol altına alındı", 10, "B"),
    ],
    { now: T0 }
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].status, "kontrol");
  assert.equal(out[0].sourceCount, 2);
});

test("buildSignals aynı yangını il+ilçe diye ikiye bölmez", () => {
  // CANLI HATA: tek Bayramiç yangını için "Bayramiç" (ilçe) ve "Çanakkale"
  // (il) diye iki sinyal oluşuyordu.
  const out = buildSignals(
    [
      item("Bayramiç'te orman yangını", 60, "Hürriyet"),
      item("Bayramiç orman yangınında son durum", 50, "B"),
      // İl grubu da kalite eşiğini kendi başına geçmeli, yoksa zaten
      // birleşmeden önce elenir.
      item("Çanakkale'de orman yangını", 70, "NTV"),
      item("Çanakkale orman yangını sürüyor", 65, "C"),
    ],
    { now: T0 }
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].place, "Bayramiç");
  assert.equal(out[0].precision, "ilce");
  // İl grubunun yayınları ilçe sinyaline eklenir, kaybolmaz.
  assert.equal(out[0].sourceCount, 4);
});

test("buildSignals yarıçapı eşleşmenin kabalığından alır", () => {
  const ilce = buildSignals([item("Bayramiç'te orman yangını", 0, "Hürriyet")], {
    now: T0,
  });
  const il = buildSignals([item("Sivas'ta orman yangını", 0, "NTV")], { now: T0 });
  assert.equal(ilce[0].radiusKm, YARICAP_KM.ilce);
  assert.equal(il[0].radiusKm, YARICAP_KM.il);
  assert.ok(il[0].radiusKm > ilce[0].radiusKm);
});

test("taninanKaynakMi kısaltmayı kelime içinde aramaz", () => {
  // CANLI HATA: "aa" (Anadolu Ajansı) "Bursa Saati Gazetesi"nin içindeki
  // "saati"ye takılıp o yayını tanınan sayıyordu.
  assert.equal(taninanKaynakMi("Bursa Saati Gazetesi"), false);
  assert.equal(taninanKaynakMi("24 Saat Gazetesi Ankara"), false);
  assert.equal(taninanKaynakMi("AA"), true);
  assert.equal(taninanKaynakMi("Anadolu Ajansı"), true);
  assert.equal(taninanKaynakMi("DHA"), true);
  assert.equal(taninanKaynakMi("Hürriyet"), true);
  assert.equal(taninanKaynakMi("bilinmeyensite.com"), false);
});

test("tek ve tanınmayan kaynak haritaya çıkmaz", () => {
  const out = buildSignals(
    [item("Bayramiç'te orman yangını", 20, "bilinmeyensite.com")],
    { now: T0 }
  );
  assert.equal(out.length, 0);
});

test("tek kaynak da olsa tanınan yayın yeter", () => {
  const out = buildSignals([item("Bayramiç'te orman yangını", 20, "Hürriyet")], {
    now: T0,
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].trusted, true);
});

test("iki bağımsız bilinmeyen kaynak eşiği geçer ama trusted değildir", () => {
  const out = buildSignals(
    [
      item("Bayramiç'te orman yangını", 30, "yerelgazete1"),
      item("Bayramiç orman yangını sürüyor", 20, "yerelgazete2"),
    ],
    { now: T0 }
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].sourceCount, 2);
  assert.equal(out[0].trusted, false);
});

test("durum en YENİ haberden gelir, tanınan yayının eskisinden değil", () => {
  const out = buildSignals(
    [
      item("Bayramiç'te orman yangını çıktı", 300, "Hürriyet"),
      item("Bayramiç'teki yangın kontrol altına alındı", 5, "yerelgazete"),
    ],
    { now: T0 }
  );
  assert.equal(out[0].status, "kontrol");
});

test("buildSignals eski haberi almaz", () => {
  const out = buildSignals([item("Bayramiç'te orman yangını", 60 * 48, "Hürriyet")], {
    now: T0,
    maxYasSaat: 36,
  });
  assert.equal(out.length, 0);
});
