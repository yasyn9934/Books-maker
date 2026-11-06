/**
 * royal-progress.js — تقدّم القراءة في صفحات قراءة الكتب المشاركة
 * شريط رفيع أعلى الصفحة يبيّن نسبة القراءة، ويُحفظ الموضع لكل مشاركة، ويُعرض خيار «متابعة من حيث توقفت».
 */
(function (g) {
  'use strict';
  var KEY = 'royal_read_progress';
  function store() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function scroller(el) {
    var n = el;
    while (n && n !== document.body && n !== document.documentElement) {
      var cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 4) return n;
      n = n.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }
  function init(o) {
    var key = o && o.key; if (!key) return;
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;z-index:2147482000;pointer-events:none;background:rgba(127,127,127,.15)';
    var fill = document.createElement('i'); fill.style.cssText = 'display:block;height:100%;width:0;margin-left:auto;background:linear-gradient(90deg,#7fa855,#c9a227);transition:width .15s';
    bar.appendChild(fill); document.body.appendChild(bar);
    var sc = null, tm;
    function pct() {
      if (!sc) return 0;
      var isDoc = sc === document.scrollingElement || sc === document.documentElement;
      var max = sc.scrollHeight - (isDoc ? window.innerHeight : sc.clientHeight);
      return max > 0 ? Math.min(100, Math.max(0, Math.round(100 * sc.scrollTop / max))) : 0;
    }
    function onScroll() {
      var p = pct(); fill.style.width = p + '%';
      clearTimeout(tm); tm = setTimeout(function () {
        var s = store(); s[key] = { pct: p, t: Date.now() };
        var ks = Object.keys(s); if (ks.length > 60) { ks.sort(function (a, b) { return s[a].t - s[b].t; }); delete s[ks[0]]; }
        try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
      }, 600);
    }
    var tries = 0, iv = setInterval(function () {            // ننتظر اكتمال رسم الكتاب ثم نربط التمرير
      var bc = document.querySelector(o.container || '#book-container');
      if (bc && bc.children.length && bc.scrollHeight > window.innerHeight * 1.3) {
        clearInterval(iv);
        sc = scroller(bc); (sc === document.scrollingElement || sc === document.documentElement ? window : sc).addEventListener('scroll', onScroll, { passive: true });
        var saved = store()[key];
        if (saved && saved.pct >= 4 && saved.pct <= 96) offer(saved.pct);
      } else if (++tries > 60) clearInterval(iv);
    }, 500);
    function offer(p) {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;bottom:14px;left:10px;right:10px;z-index:2147482500;display:flex;gap:8px;align-items:center;justify-content:space-between;direction:rtl;background:#1f1d16;color:#f3ecd2;border:1px solid #c9a227;border-radius:14px;padding:10px 12px;font:15px Amiri,serif;box-shadow:0 10px 30px rgba(0,0,0,.5)';
      d.innerHTML = '<span>📖 توقفتَ عند ' + p + '%</span>';
      var go = document.createElement('button'), top = document.createElement('button');
      [go, top].forEach(function (b) { b.style.cssText = 'border-radius:10px;padding:6px 12px;font:inherit;cursor:pointer;border:1px solid #c9a227'; });
      go.textContent = 'متابعة'; go.style.background = '#c9a227'; go.style.color = '#1a1405'; go.style.fontWeight = '700';
      top.textContent = 'من البداية'; top.style.background = 'transparent'; top.style.color = 'inherit';
      go.onclick = function () {
        var isDoc = sc === document.scrollingElement || sc === document.documentElement, max = sc.scrollHeight - (isDoc ? window.innerHeight : sc.clientHeight);
        sc.scrollTo({ top: max * p / 100, behavior: 'smooth' }); d.remove();
      };
      top.onclick = function () { d.remove(); };
      d.appendChild(go); d.appendChild(top); document.body.appendChild(d); setTimeout(function () { d.remove(); }, 12000);
    }
  }
  g.RoyalProgress = { init: init };
})(window);
