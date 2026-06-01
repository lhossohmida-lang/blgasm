const CACHE_NAME = "blgasm-pos-v3";
const RUNTIME_CACHE = `${CACHE_NAME}-runtime`;

const APP_SHELL = [
  "/",
  "/dashboard",
  "/inventory",
  "/products/new",
  "/pos",
  "/credits",
  "/reports",
  "/ai",
  "/manifest.webmanifest",
  "/blgasm-logo.png",
  "/blgasm-intro.mp4",
  "/icon.svg",
  "/storefront.svg",
];

const MEDIA_FILE_PATTERN = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|mp4|webm|woff2?)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        APP_SHELL.map(async (url) => {
          const response = await fetch(new Request(url, { cache: "reload" }));
          if (response.ok) {
            await cache.put(url, response);
          }
        }),
      );
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function shouldHandle(request) {
  const url = new URL(request.url);

  return (
    request.method === "GET" &&
    url.origin === self.location.origin &&
    !url.pathname.startsWith("/api/") &&
    !url.pathname.includes("webpack-hmr") &&
    !url.searchParams.has("__online_check")
  );
}

async function putIfCacheable(cache, request, response) {
  if (!response || !response.ok || response.type === "opaque") {
    return;
  }

  await cache.put(request, response.clone());
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  await putIfCacheable(await caches.open(RUNTIME_CACHE), request, response);
  return response;
}

async function networkFirst(request, fallbackToAppShell = false) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    await putIfCacheable(cache, request, response);
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    const precached = await caches.match(request);
    if (precached) {
      return precached;
    }

    if (fallbackToAppShell) {
      return (await caches.match("/dashboard")) ?? offlineFallback();
    }

    return Response.error();
  }
}

function offlineFallback() {
  return new Response(
    `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>بلقاسم POS</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: system-ui, sans-serif;
        background: #fbfff8;
        color: #17351f;
      }
      main {
        max-width: 360px;
        padding: 24px;
        text-align: center;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 26px;
      }
      p {
        margin: 0;
        line-height: 1.8;
        color: #506053;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>بدون إنترنت</h1>
      <p>افتح التطبيق مرة واحدة وأنت متصل حتى يتم حفظ الصفحات، ثم سيعمل البيع والمخزون من التخزين المحلي.</p>
    </main>
  </body>
</html>`,
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

self.addEventListener("fetch", (event) => {
  if (!shouldHandle(event.request)) {
    return;
  }

  const url = new URL(event.request.url);
  const isMediaAsset = MEDIA_FILE_PATTERN.test(url.pathname);

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, true));
    return;
  }

  event.respondWith(isMediaAsset ? cacheFirst(event.request) : networkFirst(event.request));
});
