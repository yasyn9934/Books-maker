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
    // شريط الحساب/الدخول، جرس الإشعارات المكرر، أزرار الرئيسية/الدخول في عارض المشاركة
    '.in-app #userCard,.in-app #authStatusArea,.in-app .notif-bell-wrap,' +
    '.in-app .shared-top-bar-right,.in-app .top-bar-right{display:none!important}' +
    // الزر العائم في الصفحة الرئيسية
    '.in-app .royal-fab,.in-app .fab-modal{display:none!important}' +
    // أزرار تبديل المظهر: التحكم الآن من الإعدادات فقط
    '.in-app .day-night-toggle,.in-app #pvDayNightToggle,.in-app #dayNightToggle,.in-app #themeSwatch,' +
    '.in-app .nav-btn[onclick*="toggleDarkMode"]{display:none!important}' +
    '.in-app #mainHeader{justify-content:space-between}';
  (document.head || root).appendChild(st);

  // المظهر (لون + وضع) من إعدادات التطبيق
  try { if (window.RoyalTheme) window.RoyalTheme.apply(document); } catch (e) {}

  // window.open / روابط target=_blank: لا تفتح نافذة جديدة تستبدل التطبيق؛ تمرّ عبر الموجّه
  function openInApp(url) {
    try {
      var abs = new URL(url, location.href);
      if (abs.origin === location.origin) {
        if (!(host && host.route(abs.href, window.name || ''))) location.href = abs.href;
      } else if (window.RoyalNative && window.RoyalNative.openExternal) {
        window.RoyalNative.openExternal(abs.href);
      } else {
        window.__royalRealOpen && window.__royalRealOpen.call(window, abs.href, '_blank', 'noopener');
      }
    } catch (e) {}
    return null;
  }
  window.__royalRealOpen = window.open;
  window.open = function (url) { return url ? openInApp(url) : null; };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var t = (a.getAttribute('target') || '').toLowerCase();
    if (t === '_blank' || t === '_top' || t === '_parent') {
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(javascript|blob|data):/i.test(href) || a.hasAttribute('download')) return;
      e.preventDefault(); openInApp(href);
    }
  }, true);

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
