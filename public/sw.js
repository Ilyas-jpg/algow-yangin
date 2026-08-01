/**
 * Algow Yangın — çevrimdışı dayanıklılık.
 * Hedef kullanıcı: kırsalda, zayıf veya kesintili bağlantıdaki saha ekipleri.
 * Bir kez yüklendikten sonra uygulama ve harita karoları cihazda kalır;
 * ikinci açılış ağa hiç çıkmadan görünür, veri gelince tazelenir.
 */
const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const TILES = `tiles-${VERSION}`;
const DATA = `data-${VERSION}`;

const TILE_LIMIT = 600;
const API_TIMEOUT_MS = 4500;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(["/", "/hakkinda"])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.split("-").pop() !== VERSION)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Cache'i belirli sayıda girdiyle sınırla (en eskiyi at). */
async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  for (const key of keys.slice(0, keys.length - limit)) {
    await cache.delete(key);
  }
}

/** Ağı süreli dener, olmazsa cache'e düşer; başarılıysa cache'i tazeler. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const fresh = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (fresh.ok) {
      await cache.put(request, fresh.clone());
      await trim(cacheName, 60);
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      // İstemci bunu görüp "çevrimdışı" bandı gösterebilsin
      const headers = new Headers(cached.headers);
      headers.set("x-algow-offline", "1");
      return new Response(cached.body, {
        status: cached.status,
        headers,
      });
    }
    return new Response(
      JSON.stringify({ error: "Çevrimdışı ve önbellekte veri yok" }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }
}

/** Önce cache: karolar ve değişmeyen varlıklar için — anında açılış. */
async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) {
    cache.put(request, fresh.clone());
    if (limit) trim(cacheName, limit);
  }
  return fresh;
}

// Bildirime tıklanınca uygulamayı öne getir
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow("/");
    })
  );
});

// Uygulama kapalıyken periyodik kontrol (destekleyen cihazlarda).
// Konum istemcide olduğu için burada yalnız veriyi tazeliyoruz; eşleştirmeyi
// uygulama açıldığında sayfa yapıyor.
self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "yangin-kontrol") return;
  event.waitUntil(
    fetch("/api/fires?days=1")
      .then((res) => (res.ok ? caches.open(DATA).then((c) => c.put("/api/fires?days=1", res)) : null))
      .catch(() => null)
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Harita karoları, sprite, glyph (cross-origin) — kalıcı cache.
  // Tam host eşleşmesi: substring testi "cartocdn.com.saldirgan.net" gibi
  // adresleri de kabul edip kalıcı cache zehirlenmesine yol açardı.
  if (
    url.hostname === "server.arcgisonline.com" ||
    url.hostname === "basemaps.cartocdn.com" ||
    /^[a-d]\.basemaps\.cartocdn\.com$/.test(url.hostname) ||
    url.hostname === "tiles.basemaps.cartocdn.com" ||
    /^tiles-[a-d]\.basemaps\.cartocdn\.com$/.test(url.hostname)
  ) {
    event.respondWith(cacheFirst(request, TILES, TILE_LIMIT));
    return;
  }

  // Veri uçları — taze dene, olmazsa son bilinen veri
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, DATA));
    return;
  }

  // Uygulama varlıkları (hash'li, değişmez)
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/")) {
    event.respondWith(cacheFirst(request, SHELL));
    return;
  }

  // Sayfa gezintisi: ağ öncelikli, kopukken kabuğu ver
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(SHELL).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL);
          return (await cache.match(request)) ?? (await cache.match("/"));
        })
    );
    return;
  }

  // Diğer aynı-köken varlıklar (marka görselleri vb.)
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL, 120));
  }
});
