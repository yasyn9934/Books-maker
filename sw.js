// sw.js — الإصدار v6

const CACHE_NAME = 'royal-book-v14';

const urlsToCache = [
  'index.html',
  'editor.html',
  'login.html',
  'offline-setup.html',
  'profile.html',
  'edit-account.html',
  'royal-features-interactive-fixed.html',
  'plugins.js',
  'sanitize.js',
  'app-bridge.js',
  'royal-theme.js',
  'app-settings.html',
  'app-notifications.html',
  'app-files.js',
  'royal-find.js',
  'royal-editions.js',
  'editor-editions.js',
  'editions.html',
  'royal-progress.js',
  'royal-export.js',
  'app-config.js',
  'app.html',
  'app.css',
  'app.js',
  'app-shares.html',
  'app-updates.html',
  'auth.js',
  'logo.png',
  'logo-512.png',
  'fonts/Amiri-Regular.ttf',
  'fonts/Amiri-Bold.ttf',
  'fonts/ArefRuqaa-Regular.ttf',
  'fonts/ArefRuqaa-Bold.ttf'
];

// ─── التثبيت: حفظ كل الملفات في الكاش ───────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('⏳ جاري تأمين ملفات النظام أوف لاين...');
      return Promise.all(
        urlsToCache.map(url =>
          cache.add(url).catch(() => {
            console.warn('⚠️ تعذّر حفظ الملف:', url);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── التفعيل: حذف الكاش القديم وتسليم السيطرة فوراً ─────────────────────────
self.addEventListener('activate', event => {
  console.log('🚀 النظام الملكي v6 جاهز للعمل!');
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)   // كل كاش قديم غير الحالي
          .map(name => {
            console.log('🗑️ حذف كاش قديم:', name);
            return caches.delete(name);
          })
      )
    ).then(() => clients.claim())   // تسليم السيطرة لكل التبويبات المفتوحة فوراً
  );
});

// ─── استراتيجية الجلب: شبكة أولاً + تحديث الكاش + فالباك أوف لاين ──────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // [FIX] تجاهل طلبات Google Apps Script — لا تُخزَّن أبداً في الكاش
  if (url.includes('script.google.com')) return;

  // [FIX] تجاهل طلبات chrome-extension أو غيرها من البروتوكولات غير http
  if (!url.startsWith('http')) return;

  // [FIX] شبكة أولاً مع مهلة 4 ثوانٍ: إن كان للملف نسخة في الكاش والشبكة بطيئة/ضعيفة نخدم الكاش فوراً
  // بدل أن ينتظر المستخدم طويلاً. وإن لم تكن له نسخة ننتظر الشبكة كالمعتاد.
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    const net = fetch(event.request).then(networkResponse => {
      if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache).catch(() => {})).catch(() => {});
      }
      return networkResponse;
    });
    net.catch(() => {}); // لا نترك رفضاً غير معالج إن خسر السباق
    try {
      if (!cached) return await net;
      return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
    } catch (err) {
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const home = await caches.match('index.html');
        if (home) return home;
      }
      return new Response('', { status: 204 });
    }
  })());
});
