-- ═══════════════════════════════════════════════════════════════════════
-- Yangın arşivi + tahmin günlüğü — yön/ilerleme modelinin eğitim seti
--
-- NEDEN: `heat_signal` yalnız TEK bir soruyu cevaplayan veriyi tutuyor —
-- "bu jeostasyoner ısı gerçek yangın mı?". Yönelim konisinin sorduğu soru
-- başka: "bu yangın SONRA nereye gidecek, ne kadar ilerleyecek?" ve o soru
-- için tuttuğumuz hiçbir kalıcı veri yoktu. Koninin çapaları (ROS, yarım
-- açı, erişim şekli) 2026-08-02'de indirilen 6 sezonluk FIRMS arşivinden
-- ad hoc ölçüldü; o indirme saklanmadı, ölçüm scripti de. Yani bugün
-- "koni ne kadar isabetli" sorusunu sormak için her şeyi baştan indirmek
-- gerekiyor ve ölçüm tekrarlanabilir değil.
--
-- ÖLÇÜLDÜ (2026-08-03, scratchpad/yon-dogrulama.mjs, arşivdeki 5 yangının
-- 45 geçişi, ERA5 rüzgârıyla geriye oynatma):
--   yön hatası ortalama 78°, ortanca 69°  ·  ±45° içinde kalma %29
--   (rastgele tahminde beklenen: 90° / %25 — yani elimizdeki beceri ZAYIF)
-- Bu tablolar o ölçümü sürekli ve tekrarlanabilir kılmak, sonra da fizik
-- sezgisi yerine VERİDEN öğrenilmiş bir yön modeli eğitebilmek için.
--
-- TASARIM KURALI (heat_signal'den devralındı): özellikler tespit ANINDA
-- dondurulur. Rüzgâr tahmini revize edilir, FWI serisi yeniden hesaplanır,
-- ama "o an neye bakarak o koniyi çizdik" sorusunun cevabı yeniden
-- üretilemez. Uydu pikseli de üretilemez. Yeniden üretilebilen (ERA5
-- yeniden-analizi) eğitim anında toplu doldurulabilir; onun için
-- `weather_source` kolonu var.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Olay: kümelenmiş bir yangın ─────────────────────────────────────────
create table if not exists public.fire_event (
  id bigint generated always as identity primary key,

  -- cluster.ts'in ürettiği kimlik (ilk geçişe bağlı: "lon:lat:saat").
  -- Canlı olay her tazelemede aynı anahtarı üretir, upsert bu yüzden çalışır.
  event_key text not null unique,
  origin    text not null check (origin in ('archive', 'live')),

  -- Arşiv kaydıysa hangi statik dosyadan geldiği (public/arsiv/<slug>.json)
  slug  text,
  name  text,
  place text,
  il    text,
  abroad boolean not null default false,

  lon double precision not null,
  lat double precision not null,

  first_seen timestamptz not null,
  last_seen  timestamptz not null,
  detections integer not null default 0,
  frp_max    double precision,
  sats       text[],

  -- Arazi olay ömrü boyunca değişmez; geçiş başına tekrar yazmak boşuna.
  elev_m      double precision,
  slope_pct   double precision,
  upslope_deg double precision,
  fuel        text,

  fixed_source_days integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fire_event_last_seen_idx on public.fire_event (last_seen desc);
create index if not exists fire_event_il_idx        on public.fire_event (il);

-- ── Geçiş: bir uydu geçişinde görülen hâli + O ANIN koşulları ───────────
-- Modelin bir eğitim satırı = bir geçiş. Özellikler geçiş anından,
-- ETİKET bir sonraki geçişten geliyor.
create table if not exists public.fire_pass (
  id       bigint generated always as identity primary key,
  event_id bigint not null references public.fire_event (id) on delete cascade,
  pass_no  integer not null,

  -- t = temsili (medyan) an, t0 = gruptaki ilk tespit. İkisi jeostasyoner
  -- veride saatlerce ayrışabiliyor (bkz. types.ts PassGroup yorumu).
  t  timestamptz not null,
  t0 timestamptz not null,

  lon         double precision not null,
  lat         double precision not null,
  frp         double precision,
  pixel_count integer not null,

  -- ── ÖZELLİKLER (girdi) ────────────────────────────────────────────────
  wind_kmh      double precision,
  wind_from_deg double precision,
  gust_kmh      double precision,
  temp_c        double precision,
  humidity      double precision,
  vpd_kpa       double precision,
  -- Basınç: gradyan rüzgârın habercisi. 10 m rüzgâr yerel ve ölçüm anına
  -- bağlı; yüzey basıncı ve eğilimi hava kütlesinin nereye gittiğini söyler.
  pressure_hpa  double precision,
  precip_mm     double precision,

  ffmc double precision,
  dmc  double precision,
  dc   double precision,
  isi  double precision,
  bui  double precision,
  fwi  double precision,

  -- 'era5' = yeniden-analiz (arşiv doldurması), 'live' = o an ölçülen tahmin
  -- verisi. Model eğitiminde ikisini karıştırmak sızıntı olur: ERA5 geçmişi
  -- bilir, canlı tahmin bilmez.
  weather_source text check (weather_source in ('era5', 'live')),

  -- ── ETİKET (çıktı) — sonraki geçiş gelince doldurulur ─────────────────
  next_pass_at timestamptz,
  span_hours   double precision,

  -- Ayak izinden EN UZAĞA taşan yeni piksel: yangının gerçek başı.
  -- Yön, o pikselin en yakın yanmış piksele göre yönüdür — tek bir tepe
  -- noktasından ölçmek büyük yangında karşı kanadı seçip hatayı sistematik
  -- olarak 90°'nin üstüne itiyor (ölçüldü: aynı veride 78° yerine 109°).
  head_bearing_deg double precision,
  head_growth_km   double precision,
  -- Tüm yeni piksellerin dairesel ortalaması — tek piksel gürültüsüne dayanıklı
  front_bearing_deg double precision,
  new_pixels        integer,
  -- Centroid kayması: uygulamanın "sürüklenme" rozetiyle aynı ölçüt
  centroid_bearing_deg double precision,
  centroid_km          double precision,

  labeled_at timestamptz,

  constraint fire_pass_uniq unique (event_id, pass_no)
);

create index if not exists fire_pass_t_idx on public.fire_pass (t desc);
-- Etiketlenmeyi bekleyen geçişler; tablonun çoğu er geç etiketlenecek,
-- tam indeks boşuna büyür.
create index if not exists fire_pass_unlabeled_idx
  on public.fire_pass (t) where labeled_at is null;

-- ── Ham piksel ──────────────────────────────────────────────────────────
-- Etiketler bunlardan türetildi. Türetimi (yeni-piksel eşiği, kümeleme
-- yarıçapı) sonra değiştirirsek geometriyi yeniden hesaplayabilmek için
-- ham veri duruyor — aksi halde her yöntem değişikliği FIRMS'ten yeniden
-- indirme demek ve arşiv indirmesi geri gelmeyebilir (SP verisi kotalı).
create table if not exists public.fire_detection (
  event_id bigint not null references public.fire_event (id) on delete cascade,
  pass_no  integer not null,
  dt  timestamptz not null,
  lon double precision not null,
  lat double precision not null,
  frp double precision,
  sat text,
  dn  char(1),
  constraint fire_detection_uniq unique (event_id, dt, lon, lat)
);

create index if not exists fire_detection_event_idx on public.fire_detection (event_id, pass_no);

-- ── Tahmin günlüğü ──────────────────────────────────────────────────────
-- ⚠️ EKSİK OLAN PARÇA BUYDU. Bugüne kadar çizdiğimiz hiçbir koni
-- kaydedilmedi; "canlı tahminimiz tuttu mu" sorusunun cevabı yok, elimizdeki
-- bütün isabet rakamları geriye dönük OYNATMADAN geliyor. Oynatma iyimser:
-- ERA5 o saatin gerçekleşmiş rüzgârını bilir, canlı koni ise tahmin
-- rüzgârıyla çizilir.
create table if not exists public.cone_forecast (
  id bigint generated always as identity primary key,

  event_key text not null,
  event_id  bigint references public.fire_event (id) on delete set null,
  issued_at timestamptz not null default now(),
  -- Çapalar değiştikçe eski tahminler yeni modele mal edilmesin
  model_version text not null default 'ros-2026-08-02',

  apex_lon       double precision not null,
  apex_lat       double precision not null,
  spread_deg     double precision not null,
  wind_only_deg  double precision,
  wind_kmh       double precision,
  half_angle_deg double precision,
  slope_share    double precision,
  is_disc        boolean,
  ring_1h_km     double precision,
  ring_3h_km     double precision,
  ring_6h_km     double precision,

  -- Tahmin anının koşulları (koninin girdileri)
  temp_c       double precision,
  humidity     double precision,
  vpd_kpa      double precision,
  pressure_hpa double precision,
  gust_kmh     double precision,
  fwi          double precision,
  slope_pct    double precision,
  upslope_deg  double precision,
  fuel         text,

  -- ── DOĞRULAMA — sonraki geçiş gelince ────────────────────────────────
  verified_at          timestamptz,
  hours_elapsed        double precision,
  observed_bearing_deg double precision,
  observed_growth_km   double precision,
  error_deg            double precision,
  head_inside_shape    boolean,
  new_pixels           integer,
  new_pixels_inside    integer,

  -- Aynı olay için aynı dakikada iki kayıt açılmasın (cron iki kez koşarsa)
  constraint cone_forecast_uniq unique (event_key, issued_at)
);

create index if not exists cone_forecast_issued_idx on public.cone_forecast (issued_at desc);
create index if not exists cone_forecast_unverified_idx
  on public.cone_forecast (issued_at) where verified_at is null;

-- ── Eğitim görünümü ─────────────────────────────────────────────────────
-- Dışa aktarımın tek noktası. Model eğitiminde tabloların şemasını değil
-- bunu okuyoruz ki kolon eklemek eğitim betiğini bozmasın.
create or replace view public.ml_progression as
select
  p.id                as pass_id,
  e.event_key,
  e.origin,
  e.slug,
  e.il,
  e.abroad,
  p.t                 as observed_at,
  extract(hour from p.t at time zone 'UTC')   as hour_utc,
  extract(doy  from p.t at time zone 'UTC')   as day_of_year,
  p.lon, p.lat,
  p.frp, p.pixel_count,
  -- kümülatif olgunluk: yangın kaç saattir yanıyor (genç yangın hızlı büyür)
  extract(epoch from (p.t - e.first_seen)) / 3600.0 as age_hours,
  p.wind_kmh, p.wind_from_deg, p.gust_kmh,
  p.temp_c, p.humidity, p.vpd_kpa, p.pressure_hpa, p.precip_mm,
  p.ffmc, p.isi, p.bui, p.fwi,
  e.slope_pct, e.upslope_deg, e.elev_m, e.fuel,
  p.weather_source,
  -- etiketler
  p.span_hours,
  p.head_bearing_deg,
  p.head_growth_km,
  p.front_bearing_deg,
  p.centroid_bearing_deg,
  p.centroid_km,
  p.new_pixels
from public.fire_pass p
join public.fire_event e on e.id = p.event_id
where p.labeled_at is not null;

-- ═══ Güvenlik ═══════════════════════════════════════════════════════════
-- Repo PUBLIC (AGPL) ve anon anahtarı tarayıcıya iniyor. heat_signal ile
-- aynı duruş: RLS açık, POLİTİKA YOK → yalnız service_role (sunucu) erişir.
-- Arşiv verisi zaten public/arsiv altında herkese açık; tarayıcıya ikinci
-- bir doğrudan yol açmanın kazancı yok, yüzeyi genişletmenin riski var.
alter table public.fire_event     enable row level security;
alter table public.fire_pass      enable row level security;
alter table public.fire_detection enable row level security;
alter table public.cone_forecast  enable row level security;

revoke all on public.fire_event     from anon, authenticated;
revoke all on public.fire_pass      from anon, authenticated;
revoke all on public.fire_detection from anon, authenticated;
revoke all on public.cone_forecast  from anon, authenticated;
revoke all on public.ml_progression from anon, authenticated;

-- ── Toplu etiket yazımı ────────────────────────────────────────────────
-- 0002/0003'teki ile aynı gerekçe: PostgREST upsert'i INSERT yolu içerdiği
-- için NOT NULL kolonları ister ve kısmi güncellemeye 400 döner.
create or replace function public.apply_pass_labels(payload jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  update public.fire_pass s
     set next_pass_at         = p.next_pass_at,
         span_hours           = p.span_hours,
         head_bearing_deg     = p.head_bearing_deg,
         head_growth_km       = p.head_growth_km,
         front_bearing_deg    = p.front_bearing_deg,
         new_pixels           = p.new_pixels,
         centroid_bearing_deg = p.centroid_bearing_deg,
         centroid_km          = p.centroid_km,
         labeled_at           = coalesce(p.labeled_at, now())
    from jsonb_to_recordset(payload) as p(
           id                   bigint,
           next_pass_at         timestamptz,
           span_hours           double precision,
           head_bearing_deg     double precision,
           head_growth_km       double precision,
           front_bearing_deg    double precision,
           new_pixels           integer,
           centroid_bearing_deg double precision,
           centroid_km          double precision,
           labeled_at           timestamptz
         )
   where s.id = p.id;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.apply_pass_labels(jsonb) from public, anon, authenticated;

-- ── Tahmin doğrulama yazımı ────────────────────────────────────────────
create or replace function public.apply_cone_verification(payload jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  update public.cone_forecast c
     set verified_at          = coalesce(p.verified_at, now()),
         hours_elapsed        = p.hours_elapsed,
         observed_bearing_deg = p.observed_bearing_deg,
         observed_growth_km   = p.observed_growth_km,
         error_deg            = p.error_deg,
         head_inside_shape    = p.head_inside_shape,
         new_pixels           = p.new_pixels,
         new_pixels_inside    = p.new_pixels_inside
    from jsonb_to_recordset(payload) as p(
           id                   bigint,
           verified_at          timestamptz,
           hours_elapsed        double precision,
           observed_bearing_deg double precision,
           observed_growth_km   double precision,
           error_deg            double precision,
           head_inside_shape    boolean,
           new_pixels           integer,
           new_pixels_inside    integer
         )
   where c.id = p.id;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.apply_cone_verification(jsonb) from public, anon, authenticated;
