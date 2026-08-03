-- ═══════════════════════════════════════════════════════════════════════
-- Toplu etiket yazımı.
--
-- NEDEN FONKSİYON: PostgREST'te upsert her zaman bir INSERT yolu içeriyor
-- ve tablonun NOT NULL kolonlarını (scanned_at, lon, lat, frp) istiyor.
-- Etiketleme yalnız 5 kolonu güncelliyor; upsert'e o yüzden 400 dönüyordu.
-- Satır satır PATCH atmak 500 istek demekti. Tek deyimle toplu UPDATE
-- doğrusu.
--
-- `security definer` KULLANILMIYOR: bu fonksiyonu yalnız service_role
-- çağırıyor ve o zaten RLS'i bypass ediyor; tanımlayıcı yetkisiyle
-- çalıştırmak gereksiz bir yetki genişlemesi olurdu.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.apply_heat_labels(payload jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  update public.heat_signal s
     set label              = p.label,
         label_source       = p.label_source,
         labeled_at         = p.labeled_at,
         viirs_confirmed_at = p.viirs_confirmed_at,
         viirs_km           = p.viirs_km
    from jsonb_to_recordset(payload) as p(
           id                 bigint,
           label              text,
           label_source       text,
           labeled_at         timestamptz,
           viirs_confirmed_at timestamptz,
           viirs_km           double precision
         )
   where s.id = p.id;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- Repo public; anon anahtarı tarayıcıya iniyor. Etiket yazımı yalnız
-- sunucunun işi.
revoke all on function public.apply_heat_labels(jsonb) from public, anon, authenticated;
