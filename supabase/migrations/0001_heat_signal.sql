-- ═══════════════════════════════════════════════════════════════════════
-- Jeostasyoner ısı sinyalleri — makine öğrenmesi eğitim veri seti
--
-- NEDEN: Platform şu an her 10 dakikada bir MTG tespitlerini ÇÖPE ATIYOR.
-- `/api/meteosat` yalnız son dilimi döndürüyor; yangın sönünce tespit de
-- kayboluyor. 2 Ağustos 2026 Bayramiç yangınını 16:08'de görmüştük ve
-- ertesi gün elimizde tek satır kanıt yoktu — arşivden yeniden indirmek
-- zorunda kaldık.
--
-- MODELİN İŞİ (dikkat, "hava durumundan yangın tahmini" DEĞİL):
-- jeostasyoner bir ısı tespiti geldiğinde bunun gerçek bir bitki örtüsü
-- yangını mı yoksa sanayi bacası / anız / yanlış pozitif mi olduğunu
-- kestirmek. Yangın TEHLİKESİ tahminini FWI zaten yapıyor ve o onlarca
-- yıllık veriyle kalibre; onunla yarışmıyoruz.
--
-- ETİKET KAYNAĞI (LLM'e "haber var mı" diye sormuyoruz — ölçtük, Bayramiç
-- yangınının ilk haberi olaydan 91 dakika sonra çıktı ve küçük yangınların
-- çoğu hiç habere düşmüyor; "haber yok → yangın değil" etiketi modele tam
-- da yakalamak istediğimiz yangınları görmezden gelmeyi öğretirdi):
--   ① VIIRS/MODIS doğrulaması  → kesin POZİTİF
--   ② sabit sanayi kaynağı     → kesin NEGATİF
--   ③ haber eşleşmesi          → ikincil pozitif (deterministik RSS)
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.heat_signal (
  id bigint generated always as identity primary key,

  -- ── Kimlik: aynı tarama + aynı piksel iki kez yazılmasın ──────────────
  -- scanned_at MTG'nin ACQTIME'ı, yani GERÇEK tarama anı — dilim etiketi
  -- değil. Bayramiç'te 13:00 dilimindeki tarama 13:08'de yapılmıştı.
  source      text        not null default 'MTG',
  scanned_at  timestamptz not null,
  lon         double precision not null,
  lat         double precision not null,

  -- ── Ölçüm ─────────────────────────────────────────────────────────────
  frp         double precision not null,
  pixel_km2   double precision,
  confidence  double precision,

  -- ── Bağlam: modelin özellikleri, tespit ANINDA dondurulur ─────────────
  -- Sonradan yeniden çekilemez (hava geçmişi değişir, tahmin revize olur),
  -- bu yüzden sinyalle birlikte yazılıyor.
  wind_speed  double precision,
  wind_dir    double precision,
  gust        double precision,
  temp_c      double precision,
  humidity    double precision,
  vpd         double precision,
  fwi         double precision,
  slope_pct   double precision,
  upslope_deg double precision,
  fuel        text,
  place       text,
  il          text,
  abroad      boolean not null default false,

  -- ── Kesin negatif kanıtı ──────────────────────────────────────────────
  -- Sezonun kaç ayrı gününde bu hücre sıcak görülmüş. null = bilinen sabit
  -- kaynak değil. ≥40 gün = tesis (ölçüt: en uzun yangın Manavgat 16,5 gün).
  fixed_source_days int,

  -- ── Etiket: sonradan doldurulur ───────────────────────────────────────
  viirs_confirmed_at timestamptz,
  viirs_km           double precision,
  news_matched_at    timestamptz,
  news_sources       int,
  label              text check (label in ('fire', 'not_fire', 'unknown')),
  label_source       text check (label_source in ('viirs', 'news', 'fixed_source', 'manual')),
  labeled_at         timestamptz,

  ingested_at timestamptz not null default now(),

  constraint heat_signal_uniq unique (source, scanned_at, lon, lat)
);

-- Eğitim seti dışa aktarımı ve zaman aralığı sorguları
create index if not exists heat_signal_scanned_idx
  on public.heat_signal (scanned_at desc);

-- Etiketleme kuyruğu: kısmi indeks, çünkü tablonun ezici çoğunluğu
-- er ya da geç etiketlenmiş olacak ve tam indeks boşuna büyür.
create index if not exists heat_signal_unlabeled_idx
  on public.heat_signal (scanned_at)
  where label is null;

-- ═══ Güvenlik ═══════════════════════════════════════════════════════════
-- Repo PUBLIC (AGPL, GitHub'da açık) ve anon anahtarı tarayıcıya iniyor.
-- RLS açık, POLİTİKA YOK → anon ve authenticated hiçbir satırı göremez.
-- Yalnız service_role (RLS'i bypass eder, yalnız sunucuda) yazar/okur.
alter table public.heat_signal enable row level security;

revoke all on public.heat_signal from anon, authenticated;
