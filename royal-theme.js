/**
 * royal-theme.js — محرك المظهر (يعمل داخل التطبيق فقط؛ في المتصفح العادي لا يغيّر شيئاً)
 * الإعدادات تُحفظ في localStorage['royal_app_theme'] = { mode:'auto|light|dark', accent:'<id>', view:'phone|desktop' }
 * - 60 لوناً = 20 درجة × 3 تدرجات (داكن / عادي / فاتح).
 * - الصفحات الداكنة أصلاً (index/editor): الوضع عبر تفضيلها الأصلي dayMode، واللون عبر متغيرات تعلو متغيراتها.
 * - صفحات القراءة (share, s/index): الوضع عبر body.dark-mode.
 * - الصفحات الفاتحة (profile, login, admin, edit-account, comments): قيم ليلية محدَّدة لرموز الأسطح والنصوص (بلا قلب ألوان).
 * - صفحات التطبيق (app*.html): كل المتغيرات.
 */
(function (g) {
  'use strict';
  var KEY = 'royal_app_theme', PREFS = 'royal_editor_prefs';
  var DEF = { mode: 'dark', accent: '16-1', view: 'phone' };

  // ───────── 60 لوناً ─────────
  var HUES = [['أحمر', 0], ['قرمزي', 345], ['وردي', 330], ['فوشيا', 312], ['أرجواني', 290], ['بنفسجي', 265], ['نيلي', 240],
    ['أزرق', 218], ['سماوي', 200], ['تركوازي', 184], ['زمردي', 164], ['أخضر', 140], ['عشبي', 108], ['زيتوني', 78],
    ['ليموني', 60], ['أصفر', 48], ['ذهبي', 42], ['عنبري', 33], ['برتقالي', 23], ['مرجاني', 11]];
  var TONES = [['داكن', 62, 36], ['', 68, 48], ['فاتح', 74, 62]];
  var PALETTE = [];
  HUES.forEach(function (h, hi) {
    TONES.forEach(function (t, ti) {
      PALETTE.push({ id: hi + '-' + ti, name: h[0] + (t[0] ? ' ' + t[0] : ''), h: h[1], s: t[1], l: t[2] });
    });
  });

  // ───────── ألوان ─────────
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, gg = 0, b = 0;
    if (h < 60) { r = c; gg = x; } else if (h < 120) { r = x; gg = c; } else if (h < 180) { gg = c; b = x; }
    else if (h < 240) { gg = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((gg + m) * 255), Math.round((b + m) * 255)];
  }
  function rgbStr(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function hex(c) { return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); }
  function lum(c) { return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }

  // ───────── الإعدادات ─────────
  function get() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
    return { mode: s.mode || DEF.mode, accent: s.accent || DEF.accent, view: s.view || DEF.view };
  }
  function findAccent(id) { for (var i = 0; i < PALETTE.length; i++) if (PALETTE[i].id === id) return PALETTE[i]; return PALETTE[16 * 3 + 1]; }
  function isDark(mode) {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    try { return g.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return true; }
  }

  // ───────── الرموز اللونية ─────────
  function tokens(acc, dark) {
    var h = acc.h, aL = dark ? Math.max(acc.l, 46) : Math.min(acc.l, 40);
    // اللون الثانوي: نفس الدرجة بإضاءة مختلفة (تناسق لوني)، لا درجة مغايرة
    var A = hsl2rgb(h, acc.s, aL), A2 = hsl2rgb(h, Math.max(acc.s - 8, 40), dark ? Math.min(aL + 12, 70) : Math.max(aL - 8, 24));
    var AL = hsl2rgb(h, acc.s, Math.min(aL + 14, 74));
    var AD = hsl2rgb(h, acc.s, Math.max(aL - 12, 16));
    var t = { A: A, A2: A2, AD: AD, AL: AL, ink: lum(A) > 0.55 ? '#1a1405' : '#ffffff' };
    if (dark) {
      t.bg = hsl2rgb(h, 22, 6); t.s1 = hsl2rgb(h, 20, 9); t.s2 = hsl2rgb(h, 18, 12); t.s3 = hsl2rgb(h, 16, 16); t.line = hsl2rgb(h, 14, 24);
      t.text = hsl2rgb(h, 28, 90); t.dim = hsl2rgb(h, 14, 66); t.muted = hsl2rgb(h, 10, 48);
    } else {
      t.bg = hsl2rgb(h, 30, 96); t.s1 = [255, 255, 255]; t.s2 = hsl2rgb(h, 26, 93); t.s3 = hsl2rgb(h, 22, 88); t.line = hsl2rgb(h, 18, 84);
      t.text = hsl2rgb(h, 35, 14); t.dim = hsl2rgb(h, 16, 34); t.muted = hsl2rgb(h, 10, 48);
    }
    return t;
  }

  // ───────── نوع الصفحة ─────────
  function kindOf(doc) {
    var p = (doc.location && doc.location.pathname || '').replace(/^.*\/Books-maker\//, '/');
    var f = p.split('/').pop() || 'index.html';
    if (/^app(-[a-z]+)?\.html$/.test(f)) return 'app';
    if (f === 'index.html' && !/\/s\/$/.test(p) && p.indexOf('/s/') < 0) return 'dark';
    if (f === 'editor.html') return 'dark';
    if (f === 'share.html' || (f === 'index.html' && p.indexOf('/s/') >= 0)) return 'reader';
    if (/^(profile|login|admin|edit-account|comments)\.html$/.test(f)) return 'light';
    return 'none';
  }

  function build(kind, T, dark) {
    var A = T.A, v = [];
    var accentVars = '--rt-rgb:' + A.join(',') + ';--rt-a-light:' + rgbStr(T.AL) + ';--rt-a1:' + rgbStr(A) + ';--rt-a1d:' + rgbStr(T.AD) + ';--rt-a2:' + rgbStr(T.A2) + ';--rt-ink:' + T.ink + ';';
    if (kind === 'dark') {
      var surf = '';
      if (dark) {   // في الليلي نوحّد الأسطح مع درجة اللون؛ وفي النهاري تتولاها صفحتا index/editor بوضعهما النهاري الأصلي
        surf = '--bg-color:' + rgbStr(T.bg) + ' !important;--bg:' + rgbStr(T.bg) + ' !important;--card-bg:' + rgbStr(T.s1) + ' !important;--surf1:' + rgbStr(T.s1) +
          ' !important;--surf2:' + rgbStr(T.s2) + ' !important;--surf3:' + rgbStr(T.s3) + ' !important;--text-color:' + rgbStr(T.text) + ' !important;--text:' + rgbStr(T.text) +
          ' !important;--text-dim:' + rgbStr(T.dim) + ' !important;--text-muted:' + rgbStr(T.muted) + ' !important;';
      }
      v.push(':root{' + accentVars + surf + '--royal-gold:' + rgbStr(A) + ' !important;--gold:' + rgbStr(A) + ' !important;--royal-green:' + rgbStr(T.A2) +
        ' !important;--green:' + rgbStr(T.A2) + ' !important;--gold-dim:' + rgba(A, 0.16) + ' !important;--gold-line:' + rgba(A, 0.3) + ' !important;}');
    } else if (kind === 'app') {
      v.push(':root{' + accentVars + 'color-scheme:' + (dark ? 'dark' : 'light') + ';--gold:' + rgbStr(A) + ' !important;--green:' + rgbStr(T.A2) +
        ' !important;--gold-dim:' + rgba(A, 0.16) + ' !important;--gold-line:' + rgba(A, 0.3) + ' !important;--bg:' + rgbStr(T.bg) + ' !important;--text:' + rgbStr(T.text) +
        ' !important;--card:' + rgbStr(T.s1) + ' !important;--surf2:' + rgbStr(T.s2) + ' !important;--surf3:' + rgbStr(T.s3) + ' !important;--dim:' + rgbStr(T.dim) +
        ' !important;--muted:' + rgbStr(T.muted) + ' !important;}html,body{background:var(--bg) !important;color:var(--text)}' +
        '#topbar,#tabbar{background:' + rgbStr(T.s1) + ' !important}' +
        (dark ? '' : '.t-act,#permBtn,.btn:not(.sec){color:var(--rt-ink) !important}.toast{background:' + rgbStr(T.s1) + ' !important}#notifSheet{background:' + rgbStr(T.s1) + ' !important}'));
    } else if (kind === 'reader') {
      v.push(':root{' + accentVars + '--royal-green:' + rgbStr(A) + ' !important;--royal-gold:' + rgbStr(T.A2) + ' !important;}');
    } else if (kind === 'light') {
      // الصفحات الفاتحة أصلاً: لا قلب للألوان. في الليلي نعرّف قيماً ليلية محدَّدة لرموز الأسطح والنصوص
      // التي حُوِّلت إليها ألوان هذه الصفحات (--rt-*) ولمتغيراتها الأصلية، فلا يتأثر ما لا يجب أن يتأثر (إيموجي، صور، بطاقات…).
      v.push(':root{' + accentVars + '--green:' + rgbStr(A) + ' !important;--gold:' + rgbStr(T.A2) + ' !important;' +
        '--gold-light:' + rgba(T.A2, 0.12) + ' !important;--gold-mid:' + rgba(T.A2, 0.25) + ' !important;}');
      if (dark) {
        v.push(':root{color-scheme:dark;' +
          '--rt-s1:' + rgbStr(T.s1) + ';--rt-s2:' + rgbStr(T.s2) + ';--rt-s3:' + rgbStr(T.s3) + ';--rt-line:' + rgbStr(T.line) +
          ';--rt-text:' + rgbStr(T.text) + ';--rt-dim:' + rgbStr(T.dim) + ';--rt-muted:' + rgbStr(T.muted) +
          ';--rt-s1-rgb:' + T.s1.join(',') + ';--rt-text-rgb:' + T.text.join(',') + ';' +
          '--bg:' + rgbStr(T.s2) + ' !important;--card:' + rgbStr(T.s1) + ' !important;--white:' + rgbStr(T.s1) + ' !important;--text:' + rgbStr(T.text) +
          ' !important;--border:' + rgbStr(T.line) + ' !important;--muted:' + rgbStr(T.dim) + ' !important;--input-bg:' + rgbStr(T.s3) +
          ' !important;--danger-light:rgba(231,76,60,.14) !important;}' +
          'html,body{background:' + rgbStr(T.s2) + ' !important;color:' + rgbStr(T.text) + ';}');
      }
    }
    return v.join('\n');
  }

  function apply(doc) {
    doc = doc || document;
    var kind = kindOf(doc);
    if (kind === 'none') return;
    var s = get(), dark = isDark(s.mode), acc = findAccent(s.accent), T = tokens(acc, dark);
    var st = doc.getElementById('royal-theme-style');
    if (!st) { st = doc.createElement('style'); st.id = 'royal-theme-style'; (doc.head || doc.documentElement).appendChild(st); }
    var css = build(kind, T, dark);
    if (st.textContent !== css) st.textContent = css;
    doc.documentElement.setAttribute('data-rt-mode', dark ? 'dark' : 'light');
    if (kind === 'reader') {
      var setCls = function () { if (doc.body) doc.body.classList.toggle('dark-mode', dark); };
      if (doc.body) setCls(); else doc.addEventListener('DOMContentLoaded', setCls);
    }
  }

  // الصفحات الداكنة أصلاً تقرأ dayMode من تفضيل المحرر المشترك
  function syncEditorPrefs(dark) {
    try {
      var p = JSON.parse(localStorage.getItem(PREFS) || '{}');
      if (p.dayMode !== !dark) { p.dayMode = !dark; localStorage.setItem(PREFS, JSON.stringify(p)); }
    } catch (e) {}
  }

  function set(patch) {
    var s = Object.assign(get(), patch || {});
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    syncEditorPrefs(isDark(s.mode));
    apply(document);
    return s;
  }

  g.RoyalTheme = { PALETTE: PALETTE, get: get, set: set, apply: apply, isDark: isDark, findAccent: findAccent, hex: function (acc) { return hex(hsl2rgb(acc.h, acc.s, acc.l)); }, syncEditorPrefs: syncEditorPrefs };

  // تفاعل حيّ: تغيّر الإعداد من الإطار الأب، أو تغيّر مظهر النظام (في الوضع التلقائي)
  g.addEventListener('storage', function (e) { if (g.ROYAL_IN_APP && e.key === KEY) { var s = get(); syncEditorPrefs(isDark(s.mode)); apply(document); } });
  try {
    var mq = g.matchMedia('(prefers-color-scheme: dark)');
    var onMq = function () { if (g.ROYAL_IN_APP && get().mode === 'auto') { syncEditorPrefs(isDark('auto')); apply(document); } };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
  } catch (e) {}
})(window);
