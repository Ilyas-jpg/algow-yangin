-- ═══════════════════════════════════════════════════════════════════════
-- Sanayi yakınlığı — MODEL ÖZELLİĞİ (sert etiket değil)
--
-- Uydu alev değil ISI görür. Rafineri, çelik fabrikası, termik santral ve
-- gaz flare'i her gün sıcaktır. OSM'den çekilen 7.771 yanma tesisi
-- (data/industrial-tr.ts) tespitin nereye düştüğünü söylüyor.
--
-- ⚠️ NEDEN ÖZELLİK, ETİKET DEĞİL: "yakınında fabrika var" bir tespiti
-- yangın olmaktan çıkarmaz — rafineriden 2 km ötede gerçek orman yangını
-- çıkabilir ve öyle etiketlemek ilk-alarm katmanının gerçek yangını
-- susturması olurdu. Sert negatif yalnız ölçülmüş kanıttan gelir: aynı
-- hücrede ≥40 ayrı gün sıcak (fixed_source_days).
--
-- `fuel` kolonu zaten vardı ama doldurulmuyordu. Doldurulmadan model
-- "sıcaksa yangındır" ezberler: mevcut `fire` etiketi anız ateşlerini de
-- içeriyor (ölçüm: 260 olayın 90'ı tarım) ve alarm vermek istediğimiz
-- sınıf o değil.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.heat_signal
  add column if not exists industrial_km   double precision,
  add column if not exists industrial_kind text,
  -- Zenginleştirme yapıldı mı? `fuel`/`industrial_km` null OLABİLİR
  -- (CORINE doğuyu kapsamıyor, 50 km'de tesis olmayabilir); o yüzden
  -- "denendi mi" ayrı tutuluyor, yoksa her turda aynı satırlar yeniden
  -- sorgulanır.
  add column if not exists enriched_at     timestamptz;

-- Zenginleştirme kuyruğu. Kısmi indeks: tablonun çoğu er ya da geç
-- zenginleşecek, tam indeks boşuna büyür.
create index if not exists heat_signal_unenriched_idx
  on public.heat_signal (scanned_at)
  where enriched_at is null;

-- ── Toplu zenginleştirme yazımı ────────────────────────────────────────
-- Etiketlemedeki ile aynı gerekçe: PostgREST upsert'i INSERT yolu içerdiği
-- için tablonun NOT NULL kolonlarını istiyor ve 400 dönüyor.
create or replace function public.apply_heat_enrichment(payload jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  update public.heat_signal s
     set fuel            = p.fuel,
         industrial_km   = p.industrial_km,
         industrial_kind = p.industrial_kind,
         enriched_at     = p.enriched_at
    from jsonb_to_recordset(payload) as p(
           id              bigint,
           fuel            text,
           industrial_km   double precision,
           industrial_kind text,
           enriched_at     timestamptz
         )
   where s.id = p.id;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.apply_heat_enrichment(jsonb) from public, anon, authenticated;
