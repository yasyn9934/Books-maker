/**
 * app-bridge.js — طبقة التكيّف مع التطبيق (تُحمَّل في كل الصفحات)
 * ------------------------------------------------------------------
 * - في المتصفح العادي: لا تفعل شيئاً إطلاقاً (الموقع يبقى كما هو).
 * - داخل التطبيق (صفحة داخل إطار app.html، أو غلاف أندرويد): تُخفي شريط الحساب والإشعارات
 *   المكرَّرة، وتحوّل كل تنقّل بين الصفحات المخصّصة لها أزرار إلى تبويبها دون تكرار فتحها.
 */
(function () {
  'use strict';
  var host = null;
  try { if (window.parent !== window && window.parent.RoyalApp) host = window.parent.RoyalApp; } catch (e) {}
  var flagged = false;
  try {
    if (new URLSearchParams(location.search).get('inapp') === '1') sessionStorage.setItem('royal_inapp', '1');
    flagged = sessionStorage.getItem('royal_inapp') === '1';
  } catch (e) {}
  var inApp = !!host || !!window.RoyalNative || /RoyalBooksApp/i.test(navigator.userAgent) || flagged;
  window.ROYAL_IN_APP = inApp;

  // تنقّل آمن: في المتصفح = انتقال عادي، وفي التطبيق = يمرّ عبر موجّه التبويبات
  window.royalNavigate = function (url) {
    if (inApp && host) {
      try { if (host.route(new URL(url, location.href).href, window.name || '')) return; } catch (e) {}
    }
    location.href = url;
  };
  if (!inApp) return;

  var root = document.documentElement;
  root.classList.add('in-app');

  // إخفاء ما يخصّ المتصفح: شريط الحساب/الدخول، أزرار الرئيسية/الدخول في عارض المشاركة، جرس الإشعارات في الملف الشخصي
  var st = document.createElement('style');
  st.textContent =
    '.in-app #userCard,.in-app #authStatusArea,.in-app .notif-bell-wrap,' +
    '.in-app .shared-top-bar-right,.in-app .top-bar-right{display:none!important}' +
    '.in-app #mainHeader{justify-content:space-between}';
  (document.head || root).appendChild(st);

  // اعتراض كل انتقال (روابط، location.href …) وتمريره للموجّه إن كان لتبويب آخر
  if (host && window.navigation && typeof navigation.addEventListener === 'function') {
    navigation.addEventListener('navigate', function (e) {
      try {
        if (!e.cancelable || e.hashChange || e.downloadRequest || e.formData) return;
        if (e.navigationType === 'reload' || e.navigationType === 'traverse') return;
        var u = new URL(e.destination.url);
        if (u.origin !== location.origin) return;
        if (host.route(u.href, window.name || '')) e.preventDefault();
      } catch (err) {}
    });
  }

  // واجهة مساعدة للصفحات
  window.RoyalAppHost = host;
})();
