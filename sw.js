// sw.js — الإصدار v5 (المُصحَّح والمحسَّن)

const CACHE_NAME = 'royal-book-v5';

const urlsToCache = [
  'index.html',
  'editor.html',
  'login.html',
  'offline-setup.html',
  'royal-features-interactive-fixed.html',
  'plugins.js',
  'auth.js',
  'PDFs/royal-assets.js',
  'PDFs/royal-parser.js',
  'PDFs/royal-renderer.js',
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
  console.log('🚀 النظام الملكي v5 جاهز للعمل!');
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

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // [FIX] إذا نجح الطلب من الشبكة، حدِّث الكاش بالنسخة الجديدة
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // الشبكة فشلت → ابحث في الكاش
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;

          // [FIX] إذا كان طلب تنقل (صفحة HTML) وليس في الكاش → أرجع الصفحة الرئيسية
          if (event.request.mode === 'navigate') {
            return caches.match('index.html');
          }

          // لا يوجد شيء — أرجع استجابة فارغة بدل الخطأ
          return new Response('', { status: 204 });
        });
      })
  );
});
