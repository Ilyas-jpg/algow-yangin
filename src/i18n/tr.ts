import type { Seg } from "@/lib/i18n";

/**
 * Türkçe metinler — arayüzün kaynak dili.
 *
 * `en.ts` bunun birebir aynı şekline sahip (`Dict = typeof tr`), yani
 * eksik bir anahtar derleme hatası verir; sessizce Türkçe sızmaz.
 *
 * Şablonlarda `{ad}` yer tutucusu `fill()` ile doldurulur. Vurgulu
 * cümleler `Seg[]` dizisidir (bkz. lib/i18n).
 */
export const tr = {
  locale: "tr",

  common: {
    brand: "Yangın",
    about: "Hakkında",
    liveMap: "Canlı harita",
    liveMapBack: "← Canlı harita",
    archive: "Arşiv",
    stats: "Sezon istatistikleri",
    statsShort: "İstatistik",
    backToMap: "← Haritaya dön",
    close: "Kapat",
    show: "Göster",
    mapLoading: "harita yükleniyor…",
    otherLang: "EN",
    otherLangTitle: "Switch to English",
    langLabel: "Dil",
  },

  top: {
    windows: { h24: "24s", h48: "48s", h120: "5g" },
    toggles: {
      wind: { label: "Rüzgar", title: "Rüzgâr akış animasyonu" },
      heat: { label: "Isı", title: "Tespit yoğunluğu ısı haritası" },
      cones: { label: "Tahmin", title: "Rüzgâra göre taşıma konisi" },
      smoke: {
        label: "Duman",
        title:
          "Yüzeydeki ince partikül (PM2.5) alanı. Dağılımı ECMWF/CAMS hesaplar; ızgara kaba çünkü modelin kendi çözünürlüğü de kaba. Yangın dışı kaynakları (trafik, sanayi, toz) da içerir.",
      },
      msg: {
        label: "MSG 15dk",
        title:
          "Meteosat: 15 dakikada bir tarar, uydu geçişleri arasındaki boşluğu doldurur. Konum kabadır (piksel 15-25 km²), halka o belirsizliği gösterir.",
      },
      news: {
        label: "Haber ihbarı",
        title:
          "Haberlere düşen yangınlar — uydunun göremediklerini yakalamak için. DOĞRULANMAMIŞ veridir: konum haber başlığından çıkarıldı, o yüzden nokta değil yaklaşık alan olarak çizilir. Aktif yangın sayısına dahil edilmez, yön tahmini yapılmaz.",
      },
      burnt: {
        label: "Yanan alan",
        title: "EFFIS yanan alan perimetreleri (Sentinel-2)",
      },
      danger: { label: "Tehlike", title: "GWIS yangın hava indeksi tahmini" },
      satellite: { label: "Uydu", title: "Sentinel-2 bulutsuz mozaik (10 m)" },
      today: {
        label: "Bugün",
        title:
          "NASA GIBS günlük gerçek renk — büyük yangınların dumanı görünür (250 m)",
      },
      terrain: {
        label: "Arazi",
        title: "Tepe gölgeleme — vadi ve sırtları gösterir",
      },
    },
    demoData: "Demo veri",
    myLocation: "Konumum",
    myLocationTitle: "Kendi konumunu haritada göster (konum cihazından çıkmaz)",
    alerts: "Uyarı",
    alertsTitle: "Bir yeri izlemeye al, yakınında yangın çıkarsa haber ver",
    freshTitle: "En yeni uydu tespiti {clock} · veri {fetched} itibarıyla",
    waitingTitle: "Veri bekleniyor",
    lastDetection: "son tespit {ago}",
    waitingData: "veri bekleniyor",
    blindGap: " · kör aralık, sonraki geçiş {next}",
  },

  legend: {
    intensity: "Tespit şiddeti (FRP, MW)",
    trail: "Geldiği yol — halka ilk görüldüğü yer",
    burned: "Yanmış alan (seçili yangının geçmişi)",
    reach: "Olası erişim (1·3·6 sa · %90) — geniş ucu yangının gideceği yön",
    smoke: "Duman (PM2.5) — koyulaştıkça yoğun; alan CAMS modelinden, ızgara kaba",
    recent: "Son 6 saatte görülen tespit",
    note: [
      ["Uydu alev değil "],
      ["ısı", "b"],
      [
        " görür: bacalar, santraller ve anız yakma da nokta olarak düşer. Her gün aynı yerde beliren nokta genelde sabit bir ısı kaynağıdır.",
      ],
    ] as Seg[],
    limits: "Hatalar ve sınırlamalar →",
  },

  panel: {
    activeHere: "Türkiye'de aktif",
    abroadTitle: "{n} olay komşu ülkelerde (uydu görüş alanı sınırla bitmiyor)",
    counts: " aktif · {events} olay",
    fixedCount: " · {n} sabit kaynak",
    abroadCount: " · +{n} sınır ötesi",
    searchPlaceholder: "İl veya ilçe ara — Muğla, Çine…",
    searchAria: "Yangınları il veya ilçe adına göre ara",
    hideFarm: "Anız gizle",
    hideFarmTitle:
      "Tarım alanlarındaki ateşleri (anız yakma) listeden ve haritadan çıkarır. Sınıflandırma CORINE arazi örtüsünden gelir; doğu illerinde kapsam olmadığı için oradaki olaylar gizlenmez.",
    fuelLoading: "arazi örtüsü sorgulanıyor…",
    matches: "{n} eşleşme",
    empty:
      "Seçili zaman penceresinde uydu tespiti yok. Pencereyi genişletmeyi deneyebilirsin; uydular her bölgeyi günde birkaç kez tarar.",
    noMatch: [
      ["{q}", "b"],
      [
        " için tespit yok. Bu, orada yangın olmadığı anlamına gelmez: uydu küçük ve kısa süreli yangınları kaçırabilir.",
      ],
    ] as Seg[],
  },

  card: {
    status: { active: "AKTİF", waning: "SÖNÜYOR", old: "ESKİ" },
    abroad: "YURT DIŞI",
    fixedSource: "SABİT KAYNAK",
    meta: "{count} tespit · {mw} MW · {ago}",
    trend: { up: "ısı arttı", down: "ısı azaldı", flat: "ısı yatay" },
    drift: "{dir} yönünde {km} km",
    stationary:
      "Bu nokta {n} uydu geçişi boyunca yerinden kıpırdamadı. Sabit bir ısı kaynağı (baca, santral, sanayi tesisi) olabilir.",
    disclaimer: [
      [
        "Uydu ısı görür; her tespit yangın olmayabilir. Yönelim göstergesidir, resmi uyarı yerine geçmez. Acil durumda ",
      ],
      ["112", "m"],
      [" · Orman Yangını İhbar "],
      ["177", "m"],
    ] as Seg[],
  },

  weather: {
    unavailable: "Bölge hava verisi şu an alınamıyor.",
    wind: "Rüzgar",
    windValue: "{dir}'dan {n} km/sa",
    gust: "Hamle",
    gustValue: "{n} km/sa",
    humidity: "Nem",
    humidityValue: "%{n}",
    temp: "Sıcaklık",
    tempValue: "{n}°C",
    vpd: "VPD",
    vpdValue: "{n} kPa",
    fwi: "Yangın hava indeksi",
    fwiTitle:
      "FFMC {ffmc} · DMC {dmc} · DC {dc} · ISI {isi} · BUI {bui} ({days} günlük seri)",
    smoke: "Duman (PM2.5)",
    smokeTitle: "Yüzeydeki ince partikül — duman göstergesi (CAMS)",
    smokeValue: "{n} µg/m³",
    terrain: "Arazi",
    terrainTitle: "Yangın yokuş yukarı hızlanır — rüzgâr ters yöne esse bile",
    terrainValue: "{m} m · %{slope} eğim",
    upslope: "yokuş {dir}",
  },

  /** EFFIS sınıflandırması — sıra `fwiClass` seviyeleriyle aynı (0-5). */
  fwiLevels: ["Çok düşük", "Düşük", "Orta", "Yüksek", "Çok yüksek", "Aşırı"],

  fuel: {
    ORMAN: { ad: "Ormanlık", not: "ağaçlık örtü" },
    MAKI: { ad: "Makilik", not: "sert yapraklı çalı" },
    OT: { ad: "Otlak", not: "çayır/bozkır" },
    TARIM: {
      ad: "Tarım alanı",
      not: "büyük olasılıkla anız yakma — orman yangını değil",
    },
    YAPI: { ad: "Yerleşim/sanayi", not: "baca veya tesis ısısı olabilir" },
    CIPLAK: { ad: "Çıplak arazi", not: "seyrek bitki örtüsü" },
    SU: { ad: "Su yüzeyi", not: "büyük olasılıkla yanlış pozitif" },
  },

  assess: {
    fixed: [
      ["Bu bir yangın değil.", "b"],
      [" Bu nokta bu sezon "],
      ["{days} ayrı günde", "m"],
      [" sıcak göründü. Uydu alev değil "],
      ["ısı", "b"],
      [
        " görür; rafineri, demir-çelik tesisi, enerji santrali ve gaz bacası her gün sıcaktır. Karşılaştırma için: Türkiye'nin ölçülmüş en uzun orman yangını 16,5 gün sürdü. Bu kayıtlar haritada duruyor ama ",
      ],
      ["aktif yangın sayısına katılmıyor", "b"],
      ["."],
    ] as Seg[],
    footprint: [
      ["Uydunun sıcak gördüğü alan: "],
      ["≈{ha} ha", "m"],
      [
        " ({cells} VIIRS pikseli) — resmî yanan alan değildir: közlenen bölümler görünmez, tespit edilen piksel de bütünüyle yanmamış olabilir.",
        "d",
      ],
    ] as Seg[],
    fuelLine: [["Arazi örtüsü: "], ["{ad}", "b"], [" — {not}"]] as Seg[],
    heatUp: [
      [
        "Isının artması yangının büyümeye devam edeceği anlamına gelmiyor: ölçtüğümüzde bu işaret, sonraki ilerlemeyi ",
      ],
      ["yazı turadan iyi kestiremedi", "b"],
      [" ve yükselen ısı çoğu zaman geri düştü."],
    ] as Seg[],
    gap: "Şu an uydu kör aralığında: yeni tespit {next} beklenir. Tespit gelmemesi yangının söndüğü anlamına gelmez.",
    history: [
      ["İlk görülme: "],
      ["{first}", "m"],
      [" · {passes} uydu geçişi boyunca {span} izleniyor"],
    ] as Seg[],
    spanHours: "{n} saattir",
    spanDays: "{n} gündür",
    drift: [
      ["Geldiği yön: "],
      ["{from}'dan", "m"],
      [" → "],
      ["{to} yönüne", "m"],
      [" {km} km / {hours} sa"],
    ] as Seg[],
    noDrift:
      "Belirgin bir yer değişimi yok: yangın ilk çıktığı bölgede genişliyor.",
    cone: [["En olası yön: "], ["{dir}", "m"], [" · rüzgâr ve eğimin bileşkesi"]] as Seg[],
    coneWeak: " — ama rüzgâr zayıf, yön kuvvetli değil",
    coneSpread: " · sapma payı ±{deg}°",
    coneMean: [
      ["Şekil 1·3·6 saatlik "],
      ["%90'lık erişim", "b"],
      [": ölçtüğümüz yangınların onda dokuzunda, "],
      ["en uzağa ilerleyen nokta bile", "b"],
      [
        " bu sınırın içinde kaldı — bu oran modelin görmediği sezonlarda sınandı. Baş yönüne doğru geriye göre ",
      ],
      ["2,4 kat", "b"],
      [
        " uzun; yangınlar gerçekte böyle bir damla çiziyor. Söndürme müdahalesi hesaba katılmaz.",
      ],
    ] as Seg[],
    windTurn: [
      ["Rüzgâr önümüzdeki 6 saatte "],
      ["yaklaşık {deg}° dönüyor", "b"],
      [" — uzak halkalar bu dönüşe göre çizildi"],
    ] as Seg[],
    observed: [
      ["Elimizdeki en güvenilir yön bilgisi gözlem: "],
      ["son geçişlerde {dir} yönüne ilerledi", "b"],
    ] as Seg[],
    agree: "Gözlenen ilerleme tahmin yönüyle uyuşuyor — güven artar",
    disagree: [
      ["Gözlenen ilerleme rüzgâr yönünden sapıyor; arazi, yakıt veya söndürme etkili olabilir — "],
      ["gözlenen yönü esas al", "b"],
    ] as Seg[],
    slope:
      "Dik yamaç (%{slope}): {dir} yönünde yokuş yukarı da ilerleyebilir",
    past: "Tahmin konisi yalnız canlı görünümde çizilir",
    calm: "Rüzgar durgun — belirgin bir yönelim yok",
  },

  smoke: {
    label: "Duman tahmini",
    unavailable: "Duman tahmini şu an alınamıyor.",
    bands: {
      good: "iyi",
      moderate: "orta",
      sensitive: "hassas gruplar için sağlıksız",
      unhealthy: "sağlıksız",
      veryUnhealthy: "çok sağlıksız",
      hazardous: "tehlikeli",
    },
    today: "bugün {t}",
    tomorrow: "yarın {t}",
    dayAfter: "öbür gün {t}",
    peaks: " zirve yapıyor",
    noPeak: "48 saat boyunca belirgin artış beklenmiyor",
    source:
      "Dağılımı biz hesaplamıyoruz: ECMWF/CAMS modelinin çıktısı. Yangın dışındaki kaynakları (trafik, sanayi, toz) da içerir.",
  },

  share: {
    button: "Paylaş",
    copied: "bağlantı kopyalandı",
    failed: "kopyalanamadı",
    title: "{place} — {mw} MW yangın tespiti",
    text: "{title} · Algow Yangın haritasında",
  },

  alerts: {
    heading: "Yakınımda yangın uyarısı",
    intro: [
      [
        "İzlemek istediğin yerleri kaydet; o çevrede yeni bir yangın tespit edilince cihazın seni uyarsın. Kaydettiğin konumlar ",
      ],
      ["yalnızca bu cihazda", "b"],
      [" saklanır, hiçbir sunucuya gitmez."],
    ] as Seg[],
    permissionDenied:
      "Bildirim izni reddedilmiş — tarayıcı ayarlarından açman gerekiyor",
    permissionAsk: "Bildirimlere izin ver",
    namePlaceholder: "Yer adı (ev, tarla, iş...)",
    radiusAria: "Uyarı yarıçapı",
    fromLocation: "Bulunduğum yer",
    fromMap: "Haritanın ortası",
    add: "Bu yeri izlemeye ekle",
    remove: "Kaldır",
    removeAria: "{name} izlemesini kaldır",
    footer:
      "Uygulama tamamen kapalıyken bildirim her cihazda gelmeyebilir; en güvenilir yol uygulamayı ana ekrana eklemek. Uyarılar uydu geçişine bağlıdır — küçük yangınlar görünmeyebilir. Acil durumda 112 / 177.",
    notifyTitle: "{name}: {km} km yakında yangın",
    notifyBody: "{place} · {mw} MW · {count} uydu tespiti",
  },

  geo: {
    unsupported: "Bu tarayıcı konum servisini desteklemiyor",
    timeout: "Konum alınamadı — açık alanda tekrar deneyin",
    unavailable: "Konum servisi şu an yanıt vermiyor",
    locating: "konum alınıyor…",
    denied:
      "Konum izni verilmedi. Tarayıcı ayarlarından bu siteye konum izni verirsen kendini haritada görebilirsin.",
    nearest: [
      ["Sana en yakın yangın "],
      ["{km} km", "b"],
      [" "],
      ["{dir}", "b"],
      [" yönünde"],
    ] as Seg[],
    none: "Yakınında aktif yangın tespiti yok.",
    accuracy: "konum ±{m} m · cihazından çıkmaz",
  },

  /** Haber ihbarı kartı — haritadaki daireye tıklanınca açılır */
  news: {
    status: {
      devam: "SÜRÜYOR",
      kontrol: "KONTROL ALTINDA",
      sondu: "SÖNDÜRÜLDÜ",
    },
    sourceCount: "{n} yayın yazdı",
    trusted: "aralarında tanınan yayın var",
    disclaimer:
      "Doğrulanmamış haber ihbarı — uydu tespiti değil. Konum haber başlığından çıkarıldı; daire ~{km} km'lik yaklaşık bölgedir, yangının kendisi değil.",
  },
  banner: {
    offline:
      "Çevrimdışısın — cihazında saklanan son veri gösteriliyor{when}. Bağlantı gelince kendiliğinden tazelenir.",
    offlineWhen: " ({clock})",
    eventMissing:
      "Paylaşılan yangın seçili zaman penceresinde görünmüyor — sönmüş ya da uydu bir süredir ısı görmemiş olabilir. Pencereyi genişletmeyi deneyebilirsin.",
    noData:
      "NASA FIRMS verisine şu an ulaşılamıyor — bağlantı aralıklarla yeniden denenecek.",
    sourcesDown:
      "{total} uydu kaynağından {down} tanesi yanıt vermiyor — bazı tespitler eksik olabilir.",
    windPartial:
      "Rüzgâr verisi kısmen eksik — bazı bölgelerde yön tahmini gösterilmiyor.",
    windDown:
      "Rüzgâr verisine ulaşılamıyor — yön tahmini ve rüzgâr katmanı şu an devre dışı.",
    thin: "Bağlantın yavaş göründüğü için rüzgâr animasyonu ve ısı katmanı kapalı başlatıldı.",
    thinAction: "Yine de aç",
    staleWindow:
      "Seçtiğin {want} aralık şu an alınamadı — ekranda hâlâ {have} veri var.",
    staleConn:
      "Bağlantı sorunu — {clock} itibarıyla alınan son veri gösteriliyor.",
    window120: "5 günlük",
    windowHours: "{n} saatlik",
    newsPopupHint: " · daireye tıkla, haberi gör",
    newsCount: "Haberde {n} yangın",
    newsUnverified:
      " · doğrulanmamış ihbar, daire yerin yaklaşık bölgesidir — aktif yangın sayısına dahil değil",
    newsUnlocated: " · {n} haberin yeri çıkarılamadı",
    msgSource: "{src} {min}dk",
    msgScan: " · Meteosat {clock} taraması: ",
    msgCount: "{n} tespit · ",
    msgCoarse: "konum kabadır (turuncu halka pikselin gerçek alanıdır)",
    msgEmpty:
      "bu taramada Türkiye'de tespit yok — Meteosat yalnız büyük yangınları görür, hassas uydu katmanı açık kalsın",
  },

  layerNote: {
    heatZoom:
      "Isı katmanı yakın zumda kapanır — bu ölçekte tek tek tespitler zaten görünüyor.",
    conePast:
      "Tahmin konisi yalnız canlı görünümde çizilir; geçmişe sardığın için gizli.",
    coneSmall:
      "Erişim şekli bu ölçekte gizli: en geniş halka {km} km, yani birkaç piksel — okunmadığı için çizilmiyor. Bir yangına yakınlaş, şekil kendiliğinden gelir.",
    coneCalm:
      "Tahmin konisi yok: aktif yangınların bulunduğu yerlerde rüzgâr çok durgun.",
    coneWaiting: "Tahmin konisi için rüzgâr verisi bekleniyor.",
    windWaiting: "Rüzgâr animasyonu için veri bekleniyor.",
    windReduced: "Hareket azaltma açık olduğu için rüzgâr animasyonu çalışmıyor.",
    fuelLoading: "Arazi örtüsü sorgulanıyor — anız süzgeci birazdan oturur.",
    farmHidden: "Anız süzgeci: {n} tarım ateşi gizlendi.",
    farmUnclassified:
      " {n} olayın örtüsü sorulamadı (CORINE doğu illerini kapsamıyor) — onlar listede duruyor.",
  },

  intro: {
    /** Türkçe söz dizilmiş görselden geliyor; bu metin onun karşılığı */
    alt: "Ellerinle yaktığını, gözyaşlarınla söndüremezsin. — Algow",
    skip: "Geç",
  },

  timeline: {
    play: "Zaman akışını oynat",
    pause: "Durdur",
    scrubAria: "Zaman kaydırıcısı",
    live: "CANLI",
    now: "ŞİMDİ",
  },

  map: {
    firstSeen: "İLK GÖRÜLEN",
  },

  embed: {
    fullMap: "Tam harita ↗",
    detail: "ayrıntı ve tahmin ↗",
    cardMeta: "{count} tespit · {mw} MW · {ago}",
    mobileCount: " aktif yangın · {events} olay",
  },

  province: {
    season: "{ad} · {yil} sezonu",
    none: "Bu sezon uydu, bu ilde yangın kaynaklı ısı tespiti görmedi.",
    detections: " yangın tespiti · geçmiş ort. {avg}",
    above: "üstünde",
    below: "altında",
    diff: " %{n} {dir}",
    highest: [
      ["En yüksek ısı "],
      ["{date}", "m"],
      [" · {place} · "],
      ["{mw} MW", "m"],
    ] as Seg[],
    fixedNote:
      "Ayrıca {n} tespit sabit ısı kaynaklarından geliyor (sanayi tesisi, enerji santrali) — yangın sayılmadı.",
    countNote:
      "Bu sayı tespit sayısıdır, yangın sayısı değil: uzun süren tek bir yangın çok tespit üretir, küçük bir yangın hiç görünmeyebilir.",

    /* Sunucudan gelen, arama motorunun ve ekran okuyucunun gördüğü metin */
    h1: "{ad} yangın haritası",
    h2Season: "{ad} {yil} yangın sezonu",
    liNone: "{ad} bu sezon uydu yangın kaynaklı ısı tespiti görmedi.",
    summary:
      "{ad} {yil} sezonunda uydu {n} yangın kaynaklı ısı tespiti gördü — {kiyas}.{enBuyuk}",
    summaryNear: "geçmiş sezon ortalamasına yakın",
    summaryDiff: "geçmiş sezon ortalamasının %{n} {dir}",
    summaryTop: " En yüksek ısı {date} günü {place} yakınında ölçüldü ({mw} MW).",
    liThisSeason: "Bu sezon yangın kaynaklı ısı tespiti: {n}",
    liPastAvg: "Geçmiş beş sezonun aynı döneminde ortalama: {n}",
    liPastDiff: " (bu sezon %{n} {dir})",
    liBusiest: "En yoğun gün: {date} ({n} tespit)",
    liHighest: "En yüksek ısı: {date}, {place}, {mw} MW",
    liFixed:
      "Ayrıca {n} tespit sabit ısı kaynaklarından (sanayi tesisi, enerji santrali) geliyor ve yangın sayılmıyor.",
    h3Years: "Yıllara göre {ad}",
    liYear: "{yil}: {n} tespit",
    h2Meaning: "Bu sayılar ne anlama geliyor",
    meaning:
      "Sayılar uydu ısı tespitidir, yangın sayısı değildir: tek bir yangın günlerce sürerse çok sayıda tespit üretir, küçük ve kısa süreli bir yangın ise hiç görünmeyebilir. Bulut altında kalan bölgeler de eksiktir. Veriler NASA FIRMS (VIIRS 375 m) tespitlerinden gelir; güncel sezon yakın-gerçek-zamanlı beslemeden, geçmiş sezonlar yeniden işlenmiş arşivden alındığı için karşılaştırma yaklaşıktır. Bu sayfa resmi uyarı yerine geçmez; acil durumda 112, orman yangını ihbarı için 177.",
    navNearby: "Yakındaki iller",
    h2Nearby: "{ad} yakın illerin yangın haritaları",
    linkProvince: "{ad} yangın haritası",
    linkStats: "Türkiye geneli sezon istatistikleri",
    linkArchive: "Geçmiş yangınların uydu arşivi",
    srH1: "{ad} yangın haritası — canlı uydu tespitleri ve yön tahmini",
    srH1Home: "Algow Yangın — Türkiye canlı yangın haritası ve yön tahmini",
  },

  archive: {
    h1: "Yangın arşivi",
    intro:
      "Canlı harita yalnız son günleri gösterir; uydu arşivi ise 2012'ye kadar açık. Aşağıdaki kayıtlar NASA FIRMS'in arşiv (SP) verisinden hazırlandı: yangının nerede başladığını, hangi yöne ilerlediğini ve kaç gün sürdüğünü baştan sona oynatabilirsin.",
    empty: "Arşiv kaydı henüz hazırlanmadı.",
    itemMeta:
      "{from} → {to} · {days} gün · {n} uydu tespiti · en yüksek {mw} MW",
    itemDetections: "uydu tespiti",
    itemDays: "gün",
    itemMax: "en yüksek",
    footer:
      "Uydu ısı anomalisi görür; tespit sayısı yanan alanla birebir orantılı değildir ve bulut altında kalan, kanopi altında ilerleyen ya da iki geçiş arasında sönen yangınlar kayıtta eksik görünür. Bu sayfa bir yangının resmî büyüklük kaydı değil, uydunun gördüğüdür.",

    viewerFallback: "Arşiv",
    viewerError:
      "Bu arşiv kaydı yüklenemedi. Bağlantını kontrol edip tekrar deneyebilirsin.",
    viewerMeta: "{il} · {days} gün · {n} tespit",
    viewerCount: " tespit · {mw} MW toplam",
    viewerNote:
      "NASA FIRMS arşiv (SP) verisi. Tahmin konisi çizilmiyor: o gün yapılmamış bir tahmini sonradan yapılmış gibi göstermeyiz.",
    srH1: "{ad} — uydu kaydı",
    srBody:
      "{il} · {n} uydu tespiti · {days} gün · en yüksek yangın ışıma gücü {mw} MW. Kayıt NASA FIRMS arşiv (SP) verisinden hazırlandı; uydu ısı görür ve bulut altında kalan bölümler eksik olabilir.",
  },

  stats: {
    notReady: "İstatistik verisi henüz hazırlanmadı.",
    h1: "{yil} yangın sezonu — uydu ne gördü?",
    intro:
      "1 Mayıs'tan bugüne Türkiye üzerinde NASA FIRMS uydularının kaydettiği ısı tespitleri, geçmiş beş sezonun aynı dönemiyle karşılaştırmalı. Sabit ısı kaynakları (rafineri, demir-çelik tesisi, enerji santrali) bu sayıların dışında tutuldu.",
    thisSeason: "bu sezon",
    detections: "ısı tespiti",
    pastAvg: "geçmiş 5 sezon ort.",
    vsPast: "bu sezon %{n} {dir}",
    above: "üstünde",
    below: "altında",
    peakSeason: "en yüksek sezon",
    peakDetections: "{n} tespit",
    h2Curve: "Sezon nasıl gidiyor",
    curveAria:
      "Sezon başından bugüne birikimli uydu tespiti eğrisi; {yil} ve önceki sezonlar",
    curveStart: "1 Mayıs",
    curveEnd: "bugün",
    curveLegend: "birikimli tespit · 1 Mayıs'tan itibaren",
    h2Totals: "Sezonlara göre toplam",
    totalsNote:
      "{yil} sezonu henüz sürüyor; diğer yıllar da aynı takvim penceresine (1 Mayıs – bugün) kırpıldı, karşılaştırma bu yüzden adil.",
    h2Provinces: "İllere göre",
    provincesNote:
      "Bu tablo her il için aynı şeyi sayıyor: uydunun o ilde gördüğü ısı tespitleri. Sabit sanayi kaynakları düşüldü; geri kalanda hem orman yangını hem tarım alanındaki anız ateşi var ve ikisi birbirinden ayrıştırılmadı. Yüksek bir sayı çok orman yangını anlamına da gelebilir, çok tarım alanı anlamına da — hangisi olduğu o ilin arazi örtüsünden anlaşılır.",
    provincesStubble:
      "Şunu da açıkça yazalım: anız yakmak yasaktır ve haklı olarak yasaktır. Ateş toprağın üstünü değil canlısını öldürür, tarlanın kendi verimini yıllarca düşürür, dumanı en yakın yerleşimin ciğerine gider; rüzgâr sertleştiğinde de tarlada kalmaz, sınırındaki ormana sıçrar. Yazı kurak geçen, rüzgârı sert esen, ormanı zor yetişen bir coğrafyada bu alışkanlığı sürdürmek doğaya karşı işlenen büyük bir ayıptır.",
    thProvince: "il",
    thThis: "bu sezon",
    thPast: "geçmiş ort.",
    thPeak: "en yüksek ısı",
    h2NotWhat: "Bu sayılar ne değildir",
    notWhat: [
      [
        ["Yangın sayısı değildir.", "b"],
        [
          " Tek bir yangın günlerce sürerse yüzlerce tespit üretir; küçük ve kısa süreli bir yangın hiç görünmeyebilir.",
        ],
      ],
      [
        ["Yanan alan değildir.", "b"],
        [" Tespit sayısı ile hektar arasında sabit bir oran yoktur."],
      ],
      [
        ["Eksiktir.", "b"],
        [
          " Bulut altında kalan, kanopi altında ilerleyen ya da iki uydu geçişi arasında sönen yangınlar kayda girmez.",
        ],
      ],
      [
        ["Kaynak farkı taşır.", "b"],
        [
          " Güncel sezon yakın-gerçek-zamanlı beslemeden, geçmiş sezonlar yeniden işlenmiş arşivden geliyor. İkisinin çakıştığı bir gün olmadığı için aradaki farkı ölçemedik; karşılaştırma yaklaşıktır.",
        ],
      ],
      [
        [
          "Kaynak seti bilerek sabit tutuldu (Suomi-NPP ve NOAA-20). NOAA-21 dahil edilseydi 2021–2022 sezonları yapay olarak düşük görünürdü.",
        ],
      ],
    ] as Seg[][],
    footer:
      "Veri: NASA FIRMS (VIIRS 375 m). Bu sayfa uydu kayıtlarından otomatik üretilir ve sezon ilerledikçe güncellenir; resmi istatistik yerine geçmez.",
  },

  og: {
    status: { active: "AKTİF", waning: "SÖNÜYOR", old: "ESKİ" },
    detections: "{n} uydu tespiti · {span}",
    drift: "Gözlenen ilerleme: {dir} yönüne {km} km",
    fallbackTitle: "Türkiye canlı yangın haritası",
    fallbackSub: "Uydu tespitleri, rüzgâr akışı ve yön tahmini tek haritada",
    footer: "NASA FIRMS · resmi uyarı değildir · 112 / 177",
  },

  shareMeta: {
    spanHours: "{n} saattir izleniyor",
    spanDays: "{n} gündür izleniyor",
    status: { active: "aktif", waning: "sönmekte", old: "eski kayıt" },
    title: "{place} — {mw} MW yangın tespiti",
    lead: "Uydu tespiti {status}",
    count: "{n} tespit",
    drift: "gözlenen ilerleme {dir} yönüne {km} km",
    tail: "Uydu ısı görür, her tespit yangın olmayabilir; resmi uyarı değildir.",
  },

  meta: {
    homeTitle: "Algow Yangın — Türkiye canlı yangın haritası ve yön tahmini",
    homeDescription:
      "NASA FIRMS uydu tespitleri ve Open-Meteo rüzgar verisiyle Türkiye'deki orman yangınlarını harita üzerinde izleyin; geçmiş ilerleyişi ve rüzgara göre tahmini yönelimi görün. Uydu ısı anomalisi tespit eder, her nokta yangın olmayabilir. Toplum ve doğa yararına, ücretsiz.",
    homeOgTitle: "Algow Yangın — Türkiye canlı yangın haritası",
    homeOgDescription:
      "Uydu tespitleri, rüzgâr akışı ve yön tahmini tek haritada. NASA FIRMS + Open-Meteo açık verisiyle.",
    appTitle: "Algow Yangın",
    aboutTitle: "Hakkında — Algow Yangın",
    aboutDescription:
      "Algow Yangın'ın veri kaynakları, güncellik sınırları ve yön tahmininin nasıl çalıştığı üzerine dürüst bir açıklama.",
    statsTitle: "Türkiye yangın sezonu istatistikleri — uydu tespitleri",
    statsDescription:
      "Türkiye'de bu yangın sezonunda uydunun gördüğü ısı tespitleri, geçmiş sezonlarla karşılaştırmalı. İllere göre dağılım, sezon eğrisi ve verinin sınırları.",
    archiveTitle: "Yangın arşivi — geçmiş büyük yangınların uydu kaydı",
    archiveDescription:
      "Türkiye'nin büyük orman yangınlarının NASA FIRMS uydu arşivinden oynatması: yangın nerede başladı, hangi yöne ilerledi, kaç gün sürdü.",
    archiveFireTitle: "{ad} — uydu kaydı ve ilerleyişi",
    archiveFireDescription:
      "{ad} ({il}): {n} uydu tespiti, {days} gün, en yüksek {mw} MW. NASA FIRMS arşivinden hazırlanan oynatma — yangın nerede başladı, hangi yöne ilerledi.",
    provinceTitle: "{ad} yangın haritası — canlı uydu tespitleri",
    provinceDescription:
      "{ozet} Canlı harita, yangının geldiği yön ve rüzgâra göre olası erişim alanı.",
    provinceFallback:
      "{ad} ve çevresindeki orman yangınlarını NASA FIRMS uydu tespitleriyle canlı izleyin.",
    embedTitle: "Algow Yangın — gömülebilir harita",
  },
};

/**
 * Sözlüğün şekli. `as const` BİLEREK yok: olsaydı her metin kendi literal
 * tipi olurdu ve `en: Dict` "Wildfire ≠ Yangın" diye derlenmezdi. Şekil
 * kontrolü yeterli — eksik/yanlış adlı anahtar yine derleme hatası verir.
 */
export type Dict = typeof tr;
