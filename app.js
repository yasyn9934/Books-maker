/* app.js — واجهة تطبيق صانع الكتب (تعمل داخل الغلاف الأصلي أو أي متصفح) */
(function () {
  'use strict';
  const CFG = window.ROYAL_APP_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jget = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); if (window.RoyalFiles && RoyalFiles.tracked(k)) RoyalFiles.schedule(); } catch (e) {} };
  const native = () => window.RoyalNative || null;

  /* ═══════════════ الإعدادات ═══════════════ */
  const settings = Object.assign({ autoUpdate: true, sound: true, autoSync: true }, jget('royal_app_settings', {}));
  const touchPrefs = () => { localStorage.setItem('royal_app_prefs_at', String(Date.now())); localStorage.setItem('royal_app_prefs_dirty', '1'); };
  const saveSettings = () => { jset('royal_app_settings', settings); touchPrefs(); };

  /* ═══════════════ المستخدم ═══════════════ */
  function getUser() { return jget('royal_user', null) || { role: 'guest', id: 'guest_tmp', username: 'زائر' }; }
  const isMember = () => getUser().role === 'member';
  function refreshUser() {
    const u = getUser(), inner = $('avatarInner');
    if (isMember() && u.profilePhoto && /^(https?:|data:image\/)/i.test(u.profilePhoto)) {
      inner.innerHTML = ''; const im = document.createElement('img'); im.src = u.profilePhoto; im.alt = ''; inner.appendChild(im);
    } else inner.textContent = isMember() ? (String(u.username || '👤').trim().charAt(0) || '👤') : '👤';
    $('adminTab').hidden = !(isMember() && u.tier === 'admin');
    updateAvatarState(); updatePill();
  }

  /* ═══════════════ التبويبات والإطارات ═══════════════ */
  const SLOTS = {
    home:    { title: 'الرئيسية',            root: 'index.html' },
    editor:  { title: 'المحرر',              root: null },
    shares:  { title: 'المشاركات',           root: 'app-shares.html' },
    updates: { title: 'التحميل والتحديثات',  root: 'app-updates.html' },
    settings:{ title: 'الإعدادات',           root: 'app-settings.html' },
    notifications: { title: 'الإشعارات',     root: 'app-notifications.html' },
    admin:   { title: 'الإدارة',             root: 'admin.html' },
    account: { title: 'الحساب',              root: null }
  };
  let active = 'home';
  const frames = {};
  // مكدّس الرجوع: الصفحات التي لا تبويب أساسياً لها (بروفايل، معاينة مشاركة، إشعارات…) تعيد المستخدم لآخر صفحة كان فيها
  const navStack = [];
  let suppressPush = false;
  const staleFrames = {};        // صفحات تغيّرت بياناتها بعد مزامنة: تُحدَّث عند الدخول إليها
  function curUrl(slot) { try { return frames[slot].contentWindow.location.href; } catch (e) { return ''; } }
  function pushNav(slot, url) {
    if (suppressPush || !slot || slot === 'editor' || !url || url === 'about:blank') return;
    const top = navStack[navStack.length - 1];
    if (top && top.slot === slot && top.url === url) return;
    navStack.push({ slot: slot, url: url });
    if (navStack.length > 30) navStack.shift();
  }
  function hostNavigating() { suppressPush = true; setTimeout(() => { suppressPush = false; }, 450); }

  function ensureFrame(slot, url) {
    if (frames[slot]) return frames[slot];
    const f = document.createElement('iframe');
    f.className = 'frame'; f.name = slot; f.setAttribute('allow', 'clipboard-write; fullscreen');
    f.addEventListener('load', () => onFrameLoad(slot));
    $('frames').appendChild(f);
    frames[slot] = f;
    if (url) f.src = url; else if (SLOTS[slot].root) f.src = SLOTS[slot].root;
    return f;
  }
  function navigateFrame(slot, url) {
    hostNavigating();
    const f = ensureFrame(slot);
    try { if (f.contentWindow && f.contentWindow.location.href !== 'about:blank') { f.contentWindow.location.replace(url); return; } } catch (e) {}
    f.src = url;
  }
  function frameBase(slot) {
    try { const l = frames[slot].contentWindow.location; return { path: l.pathname.split('/').pop(), search: l.search }; } catch (e) { return { path: '', search: '' }; }
  }
  function activate(slot) {
    if (!SLOTS[slot]) return;
    active = slot;
    ensureFrame(slot);
    if (staleFrames[slot] && frames[slot] && frames[slot].getAttribute('src') && curUrl(slot) !== 'about:blank') { delete staleFrames[slot]; try { frames[slot].contentWindow.location.reload(); } catch (e) {} }
    Object.keys(frames).forEach(k => frames[k].classList.toggle('active', k === slot));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.slot === slot));
    $('tbTitle').textContent = SLOTS[slot].title;
    closeNotifs(); updateAvatarState(); updateEditDot(); updateBack(); applyView();
  }
  /* ───── وضع العرض: طبيعي (للهاتف) أو كحاسوب (إطار بعرض 1100px مصغَّر ليناسب الشاشة) ───── */
  function applyView() {
    const desktop = window.RoyalTheme && RoyalTheme.get().view === 'desktop';
    const box = $('frames'), W = box.clientWidth, H = box.clientHeight, DW = 1100;
    const k = desktop ? Math.min(1, W / DW) : 1;
    Object.keys(frames).forEach(s => {
      const f = frames[s].style;
      if (desktop && k < 1) {
        f.width = DW + 'px'; f.height = (H / k) + 'px'; f.left = 'auto'; f.right = '0'; f.top = '0'; f.bottom = 'auto';
        f.transformOrigin = 'top right'; f.transform = 'scale(' + k + ')';
      } else { f.width = ''; f.height = ''; f.left = ''; f.right = ''; f.top = ''; f.bottom = ''; f.transformOrigin = ''; f.transform = ''; }
    });
  }
  /* ───── زر الرجوع: يظهر حين يكون الإطار النشط داخل صفحة فرعية ───── */
  function isAtRoot(slot) {
    const r = SLOTS[slot].root; if (!r) return true;
    const b = frameBase(slot); return b.path === r && !b.search;
  }
  function updateBack() {
    const show = active !== 'editor' && (navStack.length > 0 || (active !== 'account' && active !== 'notifications' && !isAtRoot(active)));
    $('backBtn').hidden = !show;
  }
  function goBack() {
    const e = navStack.pop();
    if (e) {
      hostNavigating();
      if (e.slot !== active) activate(e.slot);
      if (curUrl(e.slot) !== e.url) navigateFrame(e.slot, e.url);
      updateBack(); return;
    }
    try { const w = frames[active].contentWindow; if (w.history.length > 1) { w.history.back(); return; } } catch (er) {}
    if (SLOTS[active].root) navigateFrame(active, SLOTS[active].root);
  }
  function updateAvatarState() {
    // لا يُنقَر زر الحساب وأنت في الملف الشخصي أو صفحة الدخول
    $('avatarBtn').disabled = (active === 'account');
  }
  const isEditing = () => !!localStorage.getItem('bookData');
  function updateEditDot() { $('editDot').hidden = !isEditing(); }

  /* ═══════════════ الموجّه ═══════════════ */
  function relPath(u) {
    const base = new URL('.', location.href).pathname; let p = u.pathname;
    p = p.startsWith(base) ? p.slice(base.length) : p.replace(/^\/+/, '');
    return p || 'index.html';
  }
  function classify(u, from) {
    const p = relPath(u), q = u.searchParams;
    if (p === 'index.html') return q.get('v') ? 'shares' : 'home';
    if (p === 'editor.html') return 'editor';
    if (p === 'profile.html') return (from === 'shares' || from === 'notifications') ? from : 'account';   // بروفايل صاحب الكتاب/المُرسِل يبقى داخل صفحته
    if (p === 'login.html' || p === 'edit-account.html') return 'account';
    if (p === 'admin.html') return 'admin';
    if (p === 's/' || p === 's/index.html' || p === 's/comments.html' || p === 'share.html' || p === 'app-shares.html') return 'shares';
    if (p === 'app-updates.html') return 'updates';
    if (p === 'app-settings.html') return 'settings';
    if (p === 'app-notifications.html') return 'notifications';
    return null;                                                                  // صفحة غير مخصّصة: تبقى في مكانها
  }
  function clearEditingState() { ['bookData', 'bookData_cover', 'bookData_frameMedia'].forEach(k => localStorage.removeItem(k)); updateEditDot(); }

  function openEditor(href) { navigateFrame('editor', href || 'editor.html'); activate('editor'); }
  function closeEditor() {
    clearEditingState();
    if (frames.editor) { try { frames.editor.contentWindow.location.replace('about:blank'); } catch (e) { frames.editor.src = 'about:blank'; } }
    navigateFrame('home', 'index.html'); activate('home');      // تحديث الرئيسية لتعكس تعديلات الكتاب
    if (settings.autoSync) Sync.schedule(2500);                   // دفع تعديلات الكتاب إلى درايف تلقائياً
  }
  function route(href, from) {
    let u; try { u = new URL(href); } catch (e) { return false; }
    const target = classify(u, from);
    const p = relPath(u);
    if (from && from !== 'editor' && curUrl(from) !== href && !(target === 'home' && from === 'account') && !(target === 'home' && p === 'index.html' && !u.search)) pushNav(from, curUrl(from));
    if (!target || target === from) { updateBack(); return false; }
    if (target === 'editor' || (target === 'home' && from === 'editor')) navStack.length = 0;
    if (target === 'editor') { openEditor(href); return true; }
    if (target === 'home' && from === 'editor') { closeEditor(); return true; }
    if (target === 'home' && from === 'account') {                                // بعد الدخول/الخروج: رئيسية محدَّثة
      navStack.length = 0; navigateFrame('account', 'about:blank'); navigateFrame('home', href); refreshUser(); activate('home'); return true;
    }
    if (target === 'home' && p === 'index.html' && !u.search) { navStack.length = 0; activate('home'); return true; }
    navigateFrame(target, href); activate(target); return true;
  }
  function openAccount() {
    if (active === 'account') return;
    pushNav(active, curUrl(active));
    const want = isMember() ? 'profile.html' : 'login.html';
    const cur = frameBase('account');
    if (!frames.account || cur.path !== want) navigateFrame('account', want);
    activate('account');
  }

  /* ═══════════════ الصوت والتنبيه العلوي ═══════════════ */
  let actx = null;
  function beep(kind) {
    if (!settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = kind === 'warn' ? [330, 262] : [660, 880];
      notes.forEach((hz, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.13;
        o.type = 'sine'; o.frequency.value = hz; g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.25);
      });
    } catch (e) {}
  }
  function toast(o) {
    o = o || {};
    const el = document.createElement('div');
    el.className = 'toast ' + (o.type || '');
    el.innerHTML = '<div class="t-ico">' + esc(o.icon || '🔔') + '</div><div class="t-body"><div class="t-title">' + esc(o.title || '') +
      '</div><div class="t-msg">' + esc(o.msg || '') + '</div></div>' +
      (o.actionLabel ? '<button class="t-act">' + esc(o.actionLabel) + '</button>' : '') + '<button class="t-x" aria-label="إغلاق">×</button>';
    $('toastHost').appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 380); };
    el.querySelector('.t-x').onclick = close;
    const act = el.querySelector('.t-act'); if (act) act.onclick = () => { close(); o.onAction && o.onAction(); };
    if (o.sound !== false) beep(o.type === 'warn' || o.type === 'error' ? 'warn' : 'ok');
    setTimeout(close, o.duration || 6500);
    return close;
  }

  /* ═══════════════ الإشعارات ═══════════════ */
  const TYPE_ICON = { comment_reply: '💬', comment: '💬', reply: '💬', share: '🔗', follow: '👤', site: '🏛️', like: '❤️' };
  const TYPE_LABEL = { comment_reply: 'تعليق / رد', comment: 'تعليق', reply: 'رد', share: 'مشاركة', follow: 'متابعة', site: 'إشعار من الموقع' };
  let notifs = jget('royal_notifications', []);
  let knownIds = new Set(notifs.map(n => n.id));
  let firstPoll = true;

  const timeAgo = (ts) => {
    if (!ts) return ''; const s = Math.max(1, (Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return 'الآن'; if (s < 3600) return 'قبل ' + Math.floor(s / 60) + ' د';
    if (s < 86400) return 'قبل ' + Math.floor(s / 3600) + ' س'; return 'قبل ' + Math.floor(s / 86400) + ' يوم';
  };
  function unreadCount() { return notifs.filter(n => !n.read).length + (Updater.state.status === 'available' ? 1 : 0); }
  function renderBell() {
    const c = unreadCount(), b = $('bellBadge');
    b.hidden = c === 0; b.textContent = c > 99 ? '99+' : c;
    $('bellBtn').classList.toggle('ring', c > 0);
    $('updDot').hidden = Updater.state.status !== 'available';
  }
  function persistNotifs() { jset('royal_notifications', notifs.slice(0, 200)); }
  function closeNotifs() {}
  function openNotifs() {
    if (active === 'notifications') return;
    pushNav(active, curUrl(active));
    navigateFrame('notifications', 'app-notifications.html'); activate('notifications');
  }
  function sysNotify(title, body) {
    try {
      if (native() && native().notify) { native().notify(title, body); return; }
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: 'logo.png' });
    } catch (e) {}
  }
  async function pollNotifs() {
    const u = getUser();
    if (!isMember() || !navigator.onLine || !window.AUTH_SCRIPT_URL) return;
    try {
      const readIds = notifs.filter(n => n.read).map(n => n.id);
      const res = await fetch(window.AUTH_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'get_notifications', token: u.token, userId: u.id, readIds }) });
      const data = await res.json();
      if (!data || !data.success || !Array.isArray(data.notifications)) return;
      const localRead = new Set(readIds);
      const fresh = data.notifications.map(n => Object.assign({}, n, { read: !!n.read || localRead.has(n.id) }));
      const added = fresh.filter(n => !knownIds.has(n.id) && !n.read);
      notifs = fresh; knownIds = new Set(fresh.map(n => n.id)); persistNotifs();
      if (!firstPoll && added.length) {
        const n = added[0];
        toast({ icon: TYPE_ICON[n.type] || '🔔', title: added.length > 1 ? 'لديك ' + added.length + ' إشعارات جديدة' : (n.title || TYPE_LABEL[n.type] || 'إشعار جديد'),
          msg: added.length > 1 ? '' : (n.message || ''), actionLabel: 'عرض', onAction: openNotifs });
        sysNotify('صانع الكتب', added.length > 1 ? added.length + ' إشعارات جديدة' : (n.message || n.title || 'إشعار جديد'));
      }
      firstPoll = false; renderBell(); broadcast('royal-notifs-changed');
    } catch (e) {}
  }
  function markRead(id) { notifs.forEach(n => { if (id === 'all' || n.id === id) n.read = true; }); persistNotifs(); renderBell(); pollNotifs(); }
  function broadcast(name) { Object.keys(frames).forEach(k => { try { frames[k].contentWindow.dispatchEvent(new Event(name)); } catch (e) {} }); }

  /* ═══════════════ المحدِّث ═══════════════ */
  const b64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const getInstalled = () => {
    const n = native();                                  // في التطبيق: الغلاف هو مصدر الحقيقة
    if (n && n.getInstalled) { try { const v = JSON.parse(n.getInstalled()); return v && v.build ? v : null; } catch (e) {} }
    return jget('royal_app_installed', null);
  };
  const Updater = {
    state: { status: 'idle', release: null, installed: getInstalled(), signed: null, progress: { done: 0, total: 0 }, error: null, lastCheck: Number(localStorage.getItem('royal_app_last_check') || 0) },
    _l: new Set(),
    on(fn) { this._l.add(fn); return () => this._l.delete(fn); },
    emit() { this._l.forEach(f => { try { f(this.state); } catch (e) {} }); renderBell(); },
    set(p) { Object.assign(this.state, p); this.emit(); },

    async verify(wrapper) {
      if (!wrapper || typeof wrapper.payload !== 'string') throw new Error('ملف الإصدار غير صالح');
      if (!CFG.UPDATE_PUBKEY) return { signed: false };
      if (!wrapper.signature) throw new Error('الإصدار غير موقَّع');
      const key = await crypto.subtle.importKey('spki', b64(CFG.UPDATE_PUBKEY), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64(wrapper.signature), new TextEncoder().encode(wrapper.payload));
      if (!ok) throw new Error('توقيع الإصدار غير صالح — تم رفض التحديث');
      return { signed: true };
    },
    validate(rel) {
      if (!rel || !Number.isInteger(rel.build) || typeof rel.version !== 'string' || !Array.isArray(rel.files)) throw new Error('بنية الإصدار غير صالحة');
      rel.files.forEach(f => {
        if (typeof f.path !== 'string' || /^\/|\.\.|^[a-z]+:/i.test(f.path) || !/^[a-f0-9]{64}$/.test(f.sha256 || '')) throw new Error('ملف غير صالح في الإصدار: ' + f.path);
      });
    },
    async check(opts) {
      opts = opts || {};
      if (this.state.status === 'downloading') return this.state.release;
      if (!opts.silent) this.set({ status: 'checking', error: null });
      try {
        // في التطبيق الملفات المحلية قديمة بطبيعتها، فنفحص النسخة المنشورة على الموقع نفسه
        const vurl = native() ? new URL(CFG.VERSION_URL || 'version.json', CFG.SITE_BASE).href : new URL(CFG.VERSION_URL || 'version.json', location.href).href;
        const res = await fetch(vurl + '?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('تعذّر جلب معلومات الإصدار (' + res.status + ')');
        const wrapper = await res.json();
        const v = await this.verify(wrapper);
        const rel = JSON.parse(wrapper.payload); this.validate(rel);
        const installed = getInstalled();
        const available = !installed || rel.build > installed.build;
        localStorage.setItem('royal_app_last_check', String(Date.now()));
        this.set({ release: rel, signed: v.signed, installed, lastCheck: Date.now(), status: available ? 'available' : 'uptodate', error: null });
        return rel;
      } catch (e) {
        this.set({ status: this.state.release && this.state.status === 'available' ? 'available' : 'error', error: e.message || String(e) });
        throw e;
      }
    },
    async apply() {
      const rel = this.state.release; if (!rel) throw new Error('لا يوجد إصدار للتحميل');
      this.set({ status: 'downloading', progress: { done: 0, total: rel.files.length }, error: null });
      try {
        if (native() && native().downloadUpdate) {            // الغلاف الأصلي يحمّل ويتحقق ويستبدل بنفسه
          native().downloadUpdate(JSON.stringify({ build: rel.build }));
          return;                                              // النتيجة تصل عبر window.onRoyalNative
        }
        await this.webApply(rel);
      } catch (e) { this.set({ status: 'error', error: e.message || String(e) }); throw e; }
    },
    async webApply(rel) {            // مسار المتصفح/‏PWA: نحفظ الملفات في Cache API بعد التحقق من كل بصمة
      if (!('caches' in window)) throw new Error('المتصفح لا يدعم التخزين المؤقت');
      const name = 'royal-app-files-b' + rel.build, cache = await caches.open(name);
      let done = 0, idx = 0;
      const worker = async () => {
        while (idx < rel.files.length) {
          const f = rel.files[idx++];
          const url = new URL(f.path, location.href).href;
          const r = await fetch(url + '?b=' + rel.build, { cache: 'reload' });
          if (!r.ok) throw new Error('فشل تحميل ' + f.path + ' (' + r.status + ')');
          const buf = await r.clone().arrayBuffer();
          const h = hex(await crypto.subtle.digest('SHA-256', buf));
          if (h !== f.sha256) throw new Error('بصمة الملف غير مطابقة: ' + f.path);
          await cache.put(url, r);
          this.set({ progress: { done: ++done, total: rel.files.length } });
        }
      };
      try { await Promise.all([worker(), worker(), worker(), worker()]); }
      catch (e) { await caches.delete(name); throw e; }          // فشل = نُبقي النسخة القديمة كما هي
      (await caches.keys()).filter(k => k.startsWith('royal-app-files-') && k !== name).forEach(k => caches.delete(k));
      const inst = { version: rel.version, build: rel.build, installedAt: Date.now() };
      jset('royal_app_installed', inst);
      this.set({ status: 'installed', installed: inst });
    },
    nativeEvent(ev) {
      if (!ev) return;
      if (ev.type === 'progress') this.set({ status: 'downloading', progress: { done: ev.done, total: ev.total } });
      else if (ev.type === 'done') {
        const inst = { version: ev.version, build: ev.build, installedAt: Date.now() }; jset('royal_app_installed', inst);
        this.set({ status: 'installed', installed: inst });
        toast({ icon: '✅', type: 'ok', title: 'تم تحديث الملفات إلى ' + ev.version, msg: 'أعد تحميل الواجهة لتفعيل التغييرات', actionLabel: 'إعادة التحميل', onAction: () => location.reload(), duration: 12000 });
      }
      else if (ev.type === 'error') this.set({ status: 'error', error: ev.message || 'خطأ في التحديث' });
    }
  };
  window.onRoyalNative = (ev) => Updater.nativeEvent(typeof ev === 'string' ? JSON.parse(ev) : ev);

  async function backgroundUpdateCheck() {
    if (!navigator.onLine) return;
    let rel;
    try { rel = await Updater.check({ silent: true }); } catch (e) { return; }
    if (Updater.state.status !== 'available') return;
    const first = !getInstalled();
    if (Number(localStorage.getItem('royal_app_notified_build') || 0) !== rel.build && !first) {
      localStorage.setItem('royal_app_notified_build', String(rel.build));
      toast({ icon: '⬇️', title: 'تحديث جديد — الإصدار ' + rel.version, msg: rel.summary || rel.title || '', actionLabel: 'التفاصيل', type: 'ok', onAction: () => activate('updates'), duration: 9000 });
      sysNotify('تحديث جديد لصانع الكتب', 'الإصدار ' + rel.version + (rel.summary ? ' — ' + rel.summary : ''));
    }
    if (settings.autoUpdate && !isEditing()) {                 // تحديث تلقائي؛ فإن فشل نُبقي التنبيه اليدوي
      try {
        await Updater.apply();
        if (Updater.state.status === 'installed')
          toast({ icon: '✅', title: first ? 'تم تجهيز الملفات للعمل دون إنترنت' : 'تم تحديث التطبيق إلى ' + rel.version, msg: first ? '' : 'أعد تشغيل التطبيق لتفعيل التغييرات', type: 'ok' });
      } catch (e) {
        if (!first) toast({ icon: '⚠️', title: 'تعذّر التحديث التلقائي', msg: 'يمكنك التحديث يدوياً من صفحة التحميل', type: 'warn', actionLabel: 'تحديث', onAction: () => activate('updates') });
        Updater.set({ status: 'available' });
      }
    }
  }

  /* ═══════════════ المزامنة ═══════════════ */
  /* ═══════════════ المزامنة الشاملة ═══════════════
     نطاقها: كل بيانات التطبيق لا الصفحة المفتوحة فقط، لأن بياناتها مشتركة (المكتبة والتصنيفات والحساب والإشعارات والمنشورات).
     تلقائية: عند الفتح، وعودة الاتصال، والعودة للتطبيق، وبعد إغلاق المحرر، ودورياً. ويدوية: زر المزامنة في الشريط العلوي. */
  const HEAVY_KEYS = ['text', 't', 'cover', 'coverImg', 'cardImage', 'frames', 'customBgs', 'chapterFmt'];
  function prepareBooks(books) {            // الكتب المتغيرة كاملة، والباقي "ظلّ" خفيف
    const last = Number(localStorage.getItem('royal_last_sync') || 0);
    return (books || []).map(b => {
      const t = b.updatedAt || 0, hasText = typeof b.text === 'string' || typeof b.t === 'string';
      if (hasText && (!t || t > last - 60000)) return b;
      const stub = Object.assign({}, b); HEAVY_KEYS.forEach(k => delete stub[k]); stub._light = true; return stub;
    });
  }
  function keepLocalFull(serverBooks) {     // لا تستبدل نسخة محلية كاملة وليست أقدم بنسخة خفيفة من الخادم
    const byId = {}; jget('royal_books_list', []).forEach(b => { if (b && b.id) byId[b.id] = b; });
    return (serverBooks || []).map(sb => {
      const lb = byId[sb.id], hasText = lb && (typeof lb.text === 'string' || typeof lb.t === 'string');
      if (hasText && (lb.updatedAt || 0) >= (sb.updatedAt || 0)) { const m = Object.assign({}, sb, lb); delete m._light; return m; }
      return sb;
    });
  }
  const Sync = {
    state: 'idle', error: null, running: false, last: Number(localStorage.getItem('royal_last_full_sync') || 0),
    pending() { return !!(localStorage.getItem('pending_sync_book') || localStorage.getItem('pending_sync_categories')); },
    render() {
      const b = $('syncBtn'), d = $('syncDot'); if (!b) return;
      const off = !navigator.onLine;
      b.classList.toggle('spin', this.state === 'syncing'); b.classList.toggle('off', off);
      let dot = '', title = 'مزامنة';
      if (!isMember()) { title = 'سجّل الدخول لتفعيل المزامنة'; }
      else if (off) { title = 'لا يوجد اتصال — ستُزامَن البيانات تلقائياً عند عودته'; dot = this.pending() ? '' : ''; }
      else if (this.state === 'error') { dot = 'err'; title = 'فشلت آخر مزامنة: ' + (this.error || ''); }
      else if (this.pending()) { dot = ''; title = 'توجد تغييرات لم تُزامَن بعد'; }
      else if (this.last) { dot = 'ok'; title = 'آخر مزامنة ' + timeAgo(this.last); }
      d.hidden = !(dot || this.pending() || off && this.pending()); d.className = dot || ''; b.title = title;
      if (this.pending() && !dot) { d.hidden = false; d.className = ''; }
    },
    async call(body) {
      const u = getUser();
      const res = await fetch(window.AUTH_SCRIPT_URL, { method: 'POST', body: JSON.stringify(Object.assign({ userId: u.id, userName: u.username, token: u.token }, body)) });
      return res.json();
    },
    async run(opts) {
      opts = opts || {};
      if (this.running) return;
      if (!isMember()) { if (opts.manual) toast({ icon: '🔑', type: 'warn', title: 'سجّل الدخول أولاً', msg: 'المزامنة مع درايف تتطلب حساباً.', actionLabel: 'دخول', onAction: openAccount }); return; }
      if (!navigator.onLine) { this.render(); if (opts.manual) toast({ icon: '📴', type: 'warn', title: 'لا يوجد اتصال بالإنترنت', msg: 'ستُزامَن بياناتك تلقائياً حين يعود الاتصال.' }); return; }
      if (!window.AUTH_SCRIPT_URL) { await loadScriptUrl(); if (!window.AUTH_SCRIPT_URL) return; }
      this.running = true; this.state = 'syncing'; this.error = null; this.render();
      const t0 = Date.now(); let failed = null;
      try {
        // 1) المكتبة والتصنيفات (الكتب + الأغلفة تُرفع للمتغيّر منها فقط)
        const r = await this.call({ action: 'sync_library', localBooks: prepareBooks(jget('royal_books_list', [])), localCategories: jget('royal_categories_list', []) });
        if (!r.success) throw new Error(r.message || 'رفض الخادم المزامنة');
        if (Array.isArray(r.mergedBooks)) jset('royal_books_list', keepLocalFull(r.mergedBooks));
        if (Array.isArray(r.mergedCategories)) jset('royal_categories_list', r.mergedCategories);
        ['pending_sync_book', 'pending_sync_categories'].forEach(k => localStorage.removeItem(k));
        localStorage.setItem('royal_last_sync', String(t0));
        // 2) الحساب والإشعارات والمنشورات والوثائق والمشاركات المشاهَدة (دوال auth.js في الإطار الرئيسي)
        const w = frames.home && frames.home.contentWindow;
        if (w && typeof w._syncProfileData === 'function') {
          try { await w._syncProfileData(); } catch (e) {}
          try { await w._syncNotificationsFromCloud(); } catch (e) {}
          try { await w._syncUserContent(); } catch (e) {}
        }
        // 3) إعدادات التطبيق (المظهر واللون وخيارات التطبيق) تُحفظ مع إعدادات المحرر في درايف وتُطبَّق على كل أجهزتك
        try {
          const rs = await this.call({ action: 'fetch_editor_settings' });
          const cloud = rs && rs.success && rs.settings && rs.settings.appPrefs;
          const at = Number(localStorage.getItem('royal_app_prefs_at') || 0);
          if (cloud && (cloud.at || 0) > at) {
            if (cloud.theme) { jset('royal_app_theme', cloud.theme); RoyalTheme.syncEditorPrefs(RoyalTheme.isDark(RoyalTheme.get().mode)); RoyalTheme.apply(document); }
            if (cloud.app) { Object.assign(settings, cloud.app); jset('royal_app_settings', settings); }
            localStorage.setItem('royal_app_prefs_at', String(cloud.at)); localStorage.removeItem('royal_app_prefs_dirty'); applyView();
          } else if (localStorage.getItem('royal_app_prefs_dirty') === '1' || (!cloud && rs && rs.success !== undefined)) {
            const mine = { theme: jget('royal_app_theme', null), app: settings, at: at || Date.now() };
            const sv = await this.call({ action: 'save_editor_settings', settings: Object.assign({}, (rs && rs.settings) || {}, { appPrefs: mine }) });
            if (sv && sv.success) localStorage.removeItem('royal_app_prefs_dirty');
          }
        } catch (e) {}
        await pollNotifs();
        Object.keys(frames).forEach(k => { if (k !== 'home' && k !== 'editor' && k !== active) staleFrames[k] = true; });
        this.last = Date.now(); localStorage.setItem('royal_last_full_sync', String(this.last)); this.state = 'idle';
        refreshUser(); notifs = jget('royal_notifications', notifs); renderBell();
        broadcast('royal-sync-done');
        if (window.RoyalFiles) RoyalFiles.schedule(800);
        if (opts.manual) toast({ icon: '✅', type: 'ok', title: 'تمت المزامنة', msg: 'كل بياناتك محدَّثة مع درايف.', sound: false });
      } catch (e) {
        failed = e; this.state = 'error'; this.error = e && e.message ? e.message : String(e);
        if (opts.manual) toast({ icon: '⚠️', type: 'error', title: 'تعذّرت المزامنة', msg: this.error, actionLabel: 'إعادة', onAction: () => Sync.run({ manual: true }) });
      } finally { this.running = false; this.render(); }
    },
    schedule(ms) { clearTimeout(this._t); this._t = setTimeout(() => this.run({}), ms || 4000); }
  };
  function loadScriptUrl() {
    return fetch('auth.js').then(r => r.text()).then(t => { const m = t.match(/SCRIPT_URL:\s*"([^"]+)"/); if (m) window.AUTH_SCRIPT_URL = m[1]; }).catch(() => {});
  }
  function updatePill() { Sync.render(); }
  function onPillClick() { Sync.run({ manual: true }); }

  /* ═══════════════ الأحداث العامة ═══════════════ */
  function onFrameLoad(slot) {
    if (slot === 'shares') {                                   // سجلّ المشاركات الأخيرة لصفحة بدء المشاركات
      try {
        const l = frames.shares.contentWindow.location, p = l.pathname.split('/').pop();
        if ((p === 'index.html' && (l.search.includes('id=') || l.search.includes('v='))) ) {
          const title = (frames.shares.contentWindow.document.title || '').trim();
          const rec = jget('royal_app_recent_shares', []).filter(x => x.url !== l.href);
          rec.unshift({ url: l.pathname.replace(new URL('.', location.href).pathname, '') + l.search, title, time: Date.now() });
          jset('royal_app_recent_shares', rec.slice(0, 15));
        }
      } catch (e) {}
    }
    updateAvatarState(); refreshUser(); updateBack(); applyView();
  }
  function wire() {
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      const slot = t.dataset.slot;
      navStack.length = 0;
      if (slot === 'editor') {
        if (!isEditing()) {
          toast({ icon: '✍️', type: 'warn', title: 'لا يمكن فتح المحرر الآن', msg: 'اختر كتاباً من الرئيسية أو أنشئ كتاباً جديداً أولاً.', actionLabel: 'الرئيسية', onAction: () => activate('home') });
          return;
        }
        const f = ensureFrame('editor'); if (!f.getAttribute('src') || f.src.endsWith('about:blank')) navigateFrame('editor', 'editor.html');
        activate('editor'); return;
      }
      if (slot === active && SLOTS[slot].root) { navigateFrame(slot, SLOTS[slot].root); return; }   // النقر على التبويب النشط يعيده لصفحته الأصلية
      activate(slot);
    }));
    $('avatarBtn').addEventListener('click', openAccount);
    $('backBtn').addEventListener('click', goBack);
    window.addEventListener('resize', applyView);
    $('bellBtn').addEventListener('click', openNotifs);
    $('syncBtn').addEventListener('click', onPillClick);
    window.addEventListener('storage', (e) => {
      if (window.RoyalFiles && (!e.key || RoyalFiles.tracked(e.key))) RoyalFiles.schedule();
      if (!e.key || e.key === 'royal_user') { refreshUser(); applyBackground(); }
      if (!e.key || e.key === 'bookData') updateEditDot();
      if (!e.key || e.key.startsWith('pending_sync')) Sync.render();
      if (e.key === 'royal_notifications') { notifs = jget('royal_notifications', []); renderBell(); }
    });
    window.addEventListener('online', () => { Sync.render(); pollNotifs(); backgroundUpdateCheck(); if (settings.autoSync) Sync.schedule(1500); });
    window.addEventListener('offline', updatePill);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (Date.now() - Updater.state.lastCheck > 30 * 60 * 1000) backgroundUpdateCheck();
      if (settings.autoSync && Date.now() - Sync.last > 2 * 60 * 1000) Sync.schedule(1500);
    });
    // زر الرجوع في أندرويد: يغلق اللوحة أولاً ثم يعود داخل الإطار النشط
    window.RoyalAppBack = function () {
      try { const w = frames[active].contentWindow; if (w.history.length > 1) { w.history.back(); return true; } } catch (e) {}
      if (active !== 'home') { activate('home'); return true; }
      return false;
    };
  }

  /* ═══════════════ تسجيل الخروج ═══════════════ */
  function logout() {
    const pend = !!localStorage.getItem('pending_sync_book');
    if (!confirm(pend ? 'تنبيه: لديك تغييرات لم تُحفظ في السحابة بعد. هل تريد الخروج وفقدانها؟' : 'هل أنت متأكد من تسجيل الخروج؟')) return;
    const u = getUser();
    try { if (window.RoyalFiles) { RoyalFiles.mirrorAll(); RoyalFiles.archiveForLogout(u.id); } } catch (e) {}
    try { if (window.AUTH_SCRIPT_URL && u.token) fetch(window.AUTH_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'logout', userId: u.id, token: u.token }) }).catch(() => {}); } catch (e) {}
    ['royal_user', 'royal_books_list', 'royal_categories_list', 'royal_notifications', 'royal_viewed_shares', 'royal_following', 'royal_posts', 'royal_docs',
     'royal_deleted_books', 'royal_pending_profile_sync', 'royal_pending_posts_sync', 'pending_sync_book', 'pending_sync_categories', 'hideSyncPrompt', 'royal_last_sync'
    ].forEach(k => localStorage.removeItem(k));
    notifs = []; knownIds = new Set(); clearEditingState();
    ['editor', 'account', 'admin', 'shares'].forEach(s => { if (frames[s]) { try { frames[s].contentWindow.location.replace('about:blank'); } catch (e) {} } });
    navigateFrame('home', 'index.html'); refreshUser(); renderBell(); activate('home');
    try { const n = native(); if (n && n.setBackground) n.setBackground(false, 0, '', '', ''); } catch (e) {}
  }
  function applyBackground() {
    const n = native(); if (!n || !n.setBackground) return;
    const c = jget('royal_bg', {}), u = getUser();
    try { n.setBackground(!!(c.on && u.role === 'member'), c.every || 180, u.id || '', u.token || '', window.AUTH_SCRIPT_URL || ''); } catch (e) {}
  }
  function setTheme(patch) { const s = RoyalTheme.set(patch); touchPrefs(); applyView(); if (window.RoyalFiles) RoyalFiles.schedule(); return s; }

  /* ═══════════════ الواجهة البرمجية ═══════════════ */
  window.RoyalApp = { route, toast, refreshUser, openEditor, closeEditor, activate, Updater, settings, saveSettings, isEditing, logout, setTheme, getUser, applyView, Sync, markRead, openNotifs, goBack, pollNotifs, Files: window.RoyalFiles,
                      get active() { return active; }, notifs: () => notifs };

  /* ═══════════════ الإقلاع ═══════════════ */
  function boot() {
    // الملفات مخزن دائم: استعد منها قبل أن تُحمَّل أي صفحة إن كانت بيانات المتصفح مفقودة
    try { if (window.RoyalFiles && RoyalFiles.available) { const r = RoyalFiles.restore(); RoyalFiles.schedule(1500); if (r.books) setTimeout(() => toast({ icon: '📂', type: 'ok', title: 'استُعيدت كتبك من ملفات الجهاز', msg: r.books + ' كتاب', sound: false }), 1500); } } catch (e) {}
    RoyalTheme.apply(document); RoyalTheme.syncEditorPrefs(RoyalTheme.isDark(RoyalTheme.get().mode));
    // شبكة أمان: أي انتقال للصفحة العليا نفسها (مثل window.top.location) لا يستبدل التطبيق؛ يُوجَّه إلى تبويبه
    if (window.navigation && navigation.addEventListener) {
      navigation.addEventListener('navigate', function (e) {
        try {
          if (!e.cancelable || e.hashChange || e.downloadRequest || e.navigationType === 'reload' || e.navigationType === 'traverse') return;
          const u = new URL(e.destination.url);
          if (u.origin !== location.origin || relPath(u) === 'app.html') return;
          e.preventDefault(); if (!route(u.href, '')) navigateFrame(active, u.href);
        } catch (err) {}
      });
    }
    // نعرّف رابط الخادم من auth.js دون تحميله في هذه الصفحة
    loadScriptUrl().then(() => { pollNotifs(); applyBackground(); });
    wire(); refreshUser();
    ensureFrame('home'); activate('home'); applyView();
    renderBell(); updateEditDot(); Sync.render();
    setTimeout(() => { if (settings.autoSync) Sync.run({}); }, 6000);
    setInterval(() => { if (settings.autoSync && !document.hidden) Sync.run({}); }, 5 * 60 * 1000);
    setTimeout(backgroundUpdateCheck, 2500);
    setInterval(backgroundUpdateCheck, CFG.CHECK_INTERVAL_MS || 21600000);
    setInterval(pollNotifs, CFG.NOTIF_POLL_MS || 120000);
    setInterval(() => Sync.render(), 15000);
  }
  boot();
})();
