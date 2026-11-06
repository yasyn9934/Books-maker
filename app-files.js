/**
 * app-files.js — حفظ بيانات التطبيق كملفات حقيقية على الجهاز (داخل الغلاف الأصلي فقط)
 * ------------------------------------------------------------------------------
 * <مجلد التطبيق>/RoyalBooks/
 *   books/<معرّف الكتاب>.json   ← لكل كتاب ملف خاص به (نص + غلاف + إطارات + كل بياناته)
 *   books/_index.json           ← بصمة كل كتاب (لتجنّب إعادة كتابة ما لم يتغيّر)
 *   user/<اسم البيانات>.json    ← بيانات المستخدم: التصنيفات، الإشعارات، المنشورات، الوثائق، المتابَعون، الإعدادات…
 *   user/profile.json           ← بيانات الحساب بلا رمز الجلسة (الرمز لا يُكتب في ملف أبداً)
 *   trash/ , archive/<مستخدم>/  ← كتب حُذفت من المكتبة / كتب حساب سُجّل خروجه (لا نحذف شيئاً نهائياً)
 *
 * الملفات هي المخزن الدائم، وتخزين صفحات الموقع (localStorage) نسخة عمل سريعة تُكتب منها الملفات فور كل تغيير،
 * وتُستعاد منها تلقائياً إن مُسحت بيانات المتصفح. في المتصفح العادي لا تفعل هذه الوحدة شيئاً.
 */
(function (g) {
  'use strict';
  var USER_KEYS = ['royal_categories_list', 'royal_notifications', 'royal_posts', 'royal_docs', 'royal_following', 'royal_viewed_shares',
    'royal_deleted_books', 'royal_editor_prefs', 'royal_app_theme', 'royal_app_settings', 'royal_bg', 'royal_last_sync', 'royal_last_full_sync',
    'royal_pending_profile_sync', 'royal_pending_posts_sync', 'pending_sync_categories', 'royal_app_recent_shares', 'royal_writing_stats', 'royal_writing_goal'];
  var N = function () { return g.RoyalNative && g.RoyalNative.fsWrite ? g.RoyalNative : null; };
  var jget = function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  var lastStr = {};          // آخر نص كُتب لكل مفتاح (لتجنّب الكتابة المكرّرة)
  var index = null;          // بصمات الكتب
  var timer = null;
  var state = { last: 0, error: null, books: 0 };

  function safe(id) { return String(id).replace(/[^A-Za-z0-9_-]/g, '_'); }
  function wr(path, str) { var n = N(); return !!n && n.fsWrite(path, str); }
  function rd(path) { var n = N(); if (!n) return null; var s = n.fsRead(path); if (!s) return null; try { return JSON.parse(s); } catch (e) { return null; } }
  function ls(dir) { var n = N(); if (!n) return []; try { return JSON.parse(n.fsList(dir)); } catch (e) { return []; } }
  function user() { return jget('royal_user', null) || {}; }
  function sig(b) { return [b.id, b.updatedAt || 0, (b.text || b.t || '').length, (b.cover || '').length, (b.title || '').length].join('|'); }
  function hasText(b) { return typeof b.text === 'string' || typeof b.t === 'string'; }
  function loadIndex() { if (!index) index = rd('books/_index.json') || {}; return index; }

  /** كل كتاب كامل في المكتبة → ملفه الخاص (الكتب الخفيفة بلا نص لا تُكتب فوق ملف كامل أبداً) */
  function mirrorBooks() {
    var list = jget('royal_books_list', []), idx = loadIndex(), changed = false, ids = {};
    list.forEach(function (b) {
      if (!b || !b.id) return;
      ids[b.id] = 1;
      if (!hasText(b)) return;
      var s = sig(b);
      if (idx[b.id] !== s && wr('books/' + safe(b.id) + '.json', JSON.stringify(b))) { idx[b.id] = s; changed = true; }
    });
    if (list.length) {      // لا نُنقل شيئاً للمحذوفات إن كانت القائمة فارغة (قد تكون قراءة فاشلة لا حذفاً حقيقياً)
      Object.keys(idx).forEach(function (id) {
        if (ids[id]) return;
        var f = rd('books/' + safe(id) + '.json');
        if (f) wr('trash/' + safe(id) + '.json', JSON.stringify(f));
        var n = N(); if (n) n.fsDelete('books/' + safe(id) + '.json');
        delete idx[id]; changed = true;
      });
    }
    if (changed) wr('books/_index.json', JSON.stringify(idx));
    state.books = Object.keys(idx).length;
  }

  /** بيانات المستخدم → ملفات (الحساب بلا الرمز) */
  function mirrorUser() {
    var u = user();
    if (u && u.role === 'member') {
      var pub = Object.assign({}, u); delete pub.token; delete pub.sessionToken;
      var ps = JSON.stringify(pub);
      if (lastStr['__profile'] !== ps && wr('user/profile.json', ps)) lastStr['__profile'] = ps;
      var meta = JSON.stringify({ userId: u.id });
      if (lastStr['__meta'] !== meta && wr('user/meta.json', meta)) lastStr['__meta'] = meta;
    }
    USER_KEYS.forEach(function (k) {
      var s = localStorage.getItem(k);
      if (s == null || lastStr[k] === s) return;
      if (wr('user/' + k + '.json', s)) lastStr[k] = s;
    });
  }

  function mirrorAll() {
    if (!N()) return;
    try { mirrorBooks(); mirrorUser(); state.last = Date.now(); state.error = null; }
    catch (e) { state.error = e && e.message || String(e); }
  }
  function schedule(ms) { if (!N()) return; clearTimeout(timer); timer = setTimeout(mirrorAll, ms || 2500); }

  /** عند الإقلاع: إن كانت المكتبة فارغة (بيانات المتصفح مُسحت) استعدها من ملفات الكتب، وكذلك بيانات المستخدم الناقصة */
  function restore() {
    if (!N()) return { books: 0, keys: 0 };
    var meta = rd('user/meta.json'), u = user();
    var sameUser = !(meta && meta.userId && u.role === 'member' && meta.userId !== u.id);
    var out = { books: 0, keys: 0 };
    if (!sameUser) return out;
    var list = jget('royal_books_list', null);
    if (!list || !list.length) {
      var arr = [];
      ls('books').forEach(function (f) {
        if (!/\.json$/.test(f) || f === '_index.json') return;
        var b = rd('books/' + f); if (b && b.id) arr.push(b);
      });
      if (arr.length) { try { localStorage.setItem('royal_books_list', JSON.stringify(arr)); out.books = arr.length; } catch (e) {} }
    }
    USER_KEYS.forEach(function (k) {
      if (localStorage.getItem(k) != null) return;
      var s = N().fsRead('user/' + k + '.json');
      if (!s) return;
      try { JSON.parse(s); localStorage.setItem(k, s); out.keys++; } catch (e) {}
    });
    return out;
  }

  /** تسجيل الخروج: كتب هذا الحساب تُؤرشف (لا تُحذف) كي لا تُستعاد داخل حساب آخر */
  function archiveForLogout(userId) {
    var n = N(); if (!n) return;
    var dir = 'archive/' + safe(userId || 'unknown') + '/';
    ls('books').forEach(function (f) {
      var s = n.fsRead('books/' + f); if (s) { n.fsWrite(dir + f, s); n.fsDelete('books/' + f); }
    });
    n.fsDelete('user/meta.json'); n.fsDelete('user/profile.json');
    index = {}; lastStr = {}; state.books = 0;
  }

  function info() {
    var n = N(); if (!n) return null;
    try { var i = JSON.parse(n.fsInfo()); i.books = loadIndex() ? Object.keys(loadIndex()).length : 0; i.last = state.last; i.error = state.error; return i; } catch (e) { return null; }
  }

  g.RoyalFiles = {
    get available() { return !!N(); }, USER_KEYS: USER_KEYS,
    mirrorAll: mirrorAll, schedule: schedule, restore: restore, archiveForLogout: archiveForLogout, info: info,
    tracked: function (k) { return k === 'royal_books_list' || k === 'royal_user' || USER_KEYS.indexOf(k) >= 0; }
  };
})(window);
