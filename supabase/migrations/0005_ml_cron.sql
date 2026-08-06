-- ═══════════════════════════════════════════════════════════════════════
-- ZAMANLAMA GITHUB ACTIONS'TAN pg_cron'A TAŞINIYOR (cone + verify)
--
-- NEDEN — ÖLÇÜLDÜ (2026-08-06). `ml-cron.yml` beklenen günlük 144 tetiklemenin
-- yalnız ~20'sini teslim ediyordu:
--     Tahmin günlüğü  `*/15`        beklenen 96 → gerçekleşen  8  (~%11)
--     Tahmin doğrulama `7 * * * *`  beklenen 24 → gerçekleşen  5  (~%28)
--     Sağlık denetimi  `37 * * * *` beklenen 24 → gerçekleşen  7  (~%38)
-- GitHub, ücretsiz/private depolarda zamanlanmış işleri ağır şekilde düşürüyor;
-- `*/15` yazmak 15 dakikada bir çalışacağı anlamına gelmiyor. Ayrıca runner
-- havuzu işi hiç almayabiliyor (`The job was not acquired by Runner of type
-- hosted`) — bu, koşuyu "başarısız" gösterip yanlış alarm maili üretiyordu.
--
-- pg_cron bu projede ZATEN kanıtlı: `mtg-ingest` (*/10) aynı deseni kullanıyor
-- ve kaçırmıyor. GitHub Actions'ın seçilme gerekçesi ("Vercel cron özel başlık
-- gönderemiyor, Hobby'de günde 1 kez") pg_net için geçerli değil — başlık
-- gönderilebiliyor.
--
-- ⚠️ `saglik` işi BİLEREK GitHub'da KALIYOR. Tek amacı arıza olunca İNSANA
-- haber vermek ve pg_cron'un e-posta kanalı yok. Saatte bir tetiklenip ~%38
-- teslim etmesi (≈2,5 saatte bir denetim) bir alarm için kabul edilebilir;
-- üstelik depodaki tetikleme sayısı 144→24'e düştüğü için teslim oranının
-- iyileşmesi beklenir (ölçülmedi, iddia edilmiyor).
--
-- ⚠️ pg_net ATEŞLE-UNUT. `net.http_get` isteği kuyruğa alıp id döner; yanıt
-- `net._http_response`'a düşer, cron işi HTTP durumunu görmez. Yani bu iki uç
-- sessizce düşerse cron log'u yine yeşil görünür. Kör nokta DEĞİL, çünkü
-- `/api/saglik` ikisini de çıktılarından denetliyor:
--     cone   → `cone_forecast` tazeliği (eşik 6 sa)
--     verify → doğrulama kuyruğu birikiyor mu (0005 ile eklendi)
-- Sessiz arıza yakalama sözleşmesi böylece korunuyor.
--
-- ⚠️ MEVCUT ÜÇ İŞE (`mtg-ingest`, `mtg-label`, `mtg-enrich`) DOKUNULMUYOR.
-- Elle kurulmuşlar ve bu depoda karşılıkları yok; komutlarını okuyamadan
-- `cron.schedule` ile yeniden tanımlamak çalışan bir zamanlamayı sessizce
-- değiştirmek olurdu. Onları da sürüm kontrolüne almak ayrı bir iş:
--     select jobname, schedule, command from cron.job order by jobname;
-- çıktısı alınıp 0006 olarak yazılmalı.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── ML ucunu çağıran yardımcı ──────────────────────────────────────────
-- Sır neden burada okunuyor: `cron.job.command` düz metin olarak saklanır ve
-- veritabanına okuma yetkisi olan herkes görür. `mtg-ingest` de aynı sebeple
-- vault kullanıyor — sır cron tanımına DÜZ METİN YAZILMAZ.
create or replace function public.yangin_ml_cagir(yol text)
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  sir      text;
  istek_id bigint;
begin
  select decrypted_secret into sir
    from vault.decrypted_secrets
   where name = 'ml_ingest_secret'
   limit 1;

  -- Sır yoksa SESSİZCE 401 almaktansa patla: cron log'unda görünür bir hata,
  -- sonsuza kadar yetkisiz istek atmaktan iyidir.
  if sir is null or length(sir) = 0 then
    raise exception 'ml_ingest_secret vault''ta bulunamadı — cron çağrısı iptal';
  end if;

  -- Zaman aşımı cömert: cone ucu 14 olaya kadar nokta meteorolojisi çekiyor
  -- ve istekleri BİLEREK sıraya alıp aralarında bekliyor (Open-Meteo dakikalık
  -- limiti paralel istekte 14 noktanın hepsini 503'e düşürmüştü). pg_net erken
  -- kopatırsa bağlantı düşer ve tur yarıda kalır.
  select net.http_get(
           url                  := 'https://yangin.algow.net' || yol,
           headers              := jsonb_build_object('x-ingest-secret', sir),
           timeout_milliseconds := 120000
         )
    into istek_id;

  return istek_id;
end;
$$;

revoke all on function public.yangin_ml_cagir(text) from public, anon, authenticated;

-- ── Zamanlamalar ───────────────────────────────────────────────────────
-- `cron.schedule` ada göre upsert eder → migration yeniden koşturulabilir.
--
-- Takvimler `ml-cron.yml`'de BEYAN EDİLENLERLE aynı; değişen tek şey artık
-- gerçekten çalışacak olmaları.
--
-- Open-Meteo kotası kontrol edildi: cone'un */15 koşması upstream yükü
-- orantılı artırmıyor, çünkü çağrılar TTL ile cache'li (grid 20 dk, point ve
-- forecast 30 dk). Bağlayıcı sınır dakikalık ~600 lokasyon ve o bir PATLAMA
-- sorunu — ızgara tazelemesi nokta istekleriyle aynı dakikaya düşerse.
-- Uç bunu zaten kaldırıyor (sıralı istek + 400 ms aralık + tek tekrar) ve
-- kodun kendi varsayımı ~10 dakikalık ritim.
select cron.schedule(
  'ml-cone',
  '*/15 * * * *',
  $$select public.yangin_ml_cagir('/api/ml/cone')$$
);

-- Doğrulama saat başı :07'de. Sık koşmanın anlamı yok: koniler en az 10 saat
-- yaşlanmadan bakılmıyor (FIRMS NRT gecikmesi ölçüldü, 1-8 saat).
-- :07 ve :37 ayrı dakikalarda — iki uç aynı anda üst kaynak kotası yemesin.
select cron.schedule(
  'ml-verify',
  '7 * * * *',
  $$select public.yangin_ml_cagir('/api/ml/verify')$$
);
