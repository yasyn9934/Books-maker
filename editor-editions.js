/**
 * editor-editions.js — لوحة «من الطبعة السابقة» داخل المحرر (الاعتماد الجزئي) + حساب خريطة الصفحات
 * تُنقل كلمات أو عبارات أو أسطر أو فصول كاملة أو نص محدد من الطبعة السابقة إلى موضع تحدده في الطبعة الجديدة، ولا يُنقل غير ما تحدده.
 */
(function (g) {
  'use strict';
  var E = g.RoyalEditions, $ = function (id) { return document.getElementById(id); };
  var meta = {};            // حقول الطبعة المحفوظة مع الكتاب (حتى لا تضيع عند الحفظ التلقائي)
  var KEYS = ['editionGroup', 'editionNumber', 'prevEditionId', 'editionMode', 'editionCreatedAt'];
  g._preservedMeta = meta;
  g._captureEditionMeta = function (s) {
    KEYS.forEach(function (k) { if (s && s[k] != null) meta[k] = s[k]; else delete meta[k]; });
    var b = $('editionBtn'); if (b) b.style.display = meta.prevEditionId ? '' : 'none';
    var chip = $('edChip'); if (chip) { chip.style.display = meta.editionNumber > 1 ? '' : 'none'; chip.textContent = '📚 ' + E.editionLabel(meta.editionNumber || 1); }
    if (s && s.pageMap) g._pageMap = s.pageMap;
  };

  // ───── خريطة الصفحات (تُحدَّث بعد كل بناء للمعاينة) ─────
  function computePageMap() {
    try {
      var pages = Array.prototype.slice.call(document.querySelectorAll('#book-container .page-wrapper')).filter(function (p) { return !p.classList.contains('cover-page') && !p.querySelector('.cover-page'); });
      var starts = pages.map(function (p) { var b = p.querySelector('.content-body') || p; var f = b.firstElementChild; return f ? f.innerText : ''; });
      g._pageMap = E.computePageMap($('mainText').value, starts);
    } catch (e) {}
  }
  var _origBuild = g.buildBook;
  if (typeof _origBuild === 'function') {
    g.buildBook = function () { var r = _origBuild.apply(this, arguments); clearTimeout(g._pmT); g._pmT = setTimeout(computePageMap, 450); return r; };
  }

  // ───── لوحة النقل ─────
  var base = null, panel = null, lastCaret = null, TAB = 'chapters';
  function lib() { try { return JSON.parse(localStorage.getItem('royal_books_list') || '[]'); } catch (e) { return []; } }
  async function loadBase() {
    if (base) return base;
    var b = lib().filter(function (x) { return x.id === meta.prevEditionId; })[0];
    if (b && typeof b.text === 'string') return (base = b);
    if (typeof currentUser !== 'undefined' && currentUser.role === 'member' && navigator.onLine) {
      var r = await fetch(AUTH_CONFIG.SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'fetch_book', userId: currentUser.id, token: currentUser.token, userName: currentUser.username, bookId: meta.prevEditionId }) });
      var d = await r.json(); if (d.success && d.book && typeof d.book.text === 'string') return (base = d.book);
    }
    throw new Error('تعذّر تحميل الطبعة السابقة (غير موجودة على هذا الجهاز).');
  }
  var ta = function () { return $('mainText'); };
  function toast(m) { try { var t = $('edPickToast'); t.textContent = m; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(function () { t.style.display = 'none'; }, 2500); } catch (e) {} }

  function destAnchor() {
    var t = $('epDest').value, v = $('epTarget') ? $('epTarget').value : '';
    if (t === 'cursor') return null;
    if (t === 'start' || t === 'end') return { a: { type: t }, pos: 'before' };
    var m = t.split('-'), type = m[0], pos = m[1];
    if (type === 'phrase') return { a: { type: 'phrase', value: v }, pos: pos };
    return { a: { type: type, index: Number(v) }, pos: pos };
  }
  function transfer(content) {
    if (!String(content || '').trim()) return toast('لا يوجد ما يُنقل');
    var el = ta(), d = destAnchor();
    try {
      if (!d) {                                    // عند المؤشر (آخر موضع فيه)
        var pos = lastCaret != null ? lastCaret : el.value.length;
        el.value = el.value.slice(0, pos) + content + el.value.slice(pos); lastCaret = pos + content.length;
      } else el.value = E.insertAt(el.value, content, d.a, d.pos, g._pageMap);
    } catch (e) { return toast(e.message); }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    toast('✓ نُقل إلى الطبعة الجديدة');
  }

  function fillTarget() {
    var t = $('epDest').value, w = $('epTargetWrap'); w.innerHTML = '';
    if (t === 'cursor' || t === 'start' || t === 'end') return;
    var type = t.split('-')[0], cur = ta().value;
    if (type === 'phrase') { var i = document.createElement('input'); i.type = 'text'; i.id = 'epTarget'; i.placeholder = 'العبارة في الطبعة الجديدة'; w.appendChild(i); return; }
    var s = document.createElement('select'); s.id = 'epTarget';
    var H = type === 'chapter' ? E.chapters(cur) : E.subChapters(cur);
    if (!H.length) { var o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'لا يوجد في الطبعة الجديدة بعد'; s.appendChild(o0); }
    H.forEach(function (h, i) { var o = document.createElement('option'); o.value = i; o.textContent = h.title || ('عنصر ' + (i + 1)); s.appendChild(o); });
    w.appendChild(s);
  }

  function renderTab() {
    var box = $('epBody'); box.innerHTML = '';
    document.querySelectorAll('#edPicker .ept button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === TAB); });
    if (TAB === 'chapters') {
      var secs = E.chapterSections(base.text);
      if (!secs.length) { box.textContent = 'لا فصول في الطبعة السابقة.'; return; }
      secs.forEach(function (s, i) {
        var r = document.createElement('div'); r.className = 'epr';
        var cb = document.createElement('input'); cb.type = 'checkbox'; cb.dataset.i = i;
        var t = document.createElement('span'); t.className = 'ept2'; t.textContent = s.title + ' — ' + E.words(s.text) + ' كلمة';
        var b = document.createElement('button'); b.textContent = 'نقل'; b.onclick = function () { transfer(s.text); };
        r.append(cb, t, b); box.appendChild(r);
      });
      var all = document.createElement('button'); all.className = 'epgo'; all.textContent = 'نقل الفصول المحدَّدة';
      all.onclick = function () { var pick = [].slice.call(box.querySelectorAll('input:checked')).map(function (c) { return secs[Number(c.dataset.i)].text; }); transfer(pick.join('\n\n')); };
      box.appendChild(all);
    } else if (TAB === 'search') {
      var inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = 'ابحث عن كلمة أو عبارة في الطبعة السابقة…'; inp.id = 'epQ'; box.appendChild(inp);
      var res = document.createElement('div'); box.appendChild(res);
      var run = function () {
        res.innerHTML = ''; var q = E.norm(inp.value).trim(); if (q.length < 2) return;
        var n = 0;
        base.text.split('\n').forEach(function (line, idx) {
          if (n >= 60 || !line.trim()) return; var nl = E.norm(E.plain(line)), p = nl.indexOf(q); if (p < 0) return; n++;
          var r = document.createElement('div'); r.className = 'epr col';
          var t = document.createElement('div'); t.className = 'ept2'; var plainL = E.plain(line); t.textContent = plainL.length > 160 ? plainL.slice(0, 160) + '…' : plainL;
          var bs = document.createElement('div'); bs.className = 'epb';
          var b1 = document.createElement('button'); b1.textContent = 'أخذ العبارة فقط'; b1.onclick = function () { transfer(inp.value.trim()); };
          var b2 = document.createElement('button'); b2.textContent = 'أخذ السطر كاملاً'; b2.onclick = function () { transfer(line); };
          bs.append(b1, b2); r.append(t, bs); res.appendChild(r);
        });
        if (!n) res.textContent = 'لا نتائج.';
      };
      inp.oninput = function () { clearTimeout(inp._t); inp._t = setTimeout(run, 200); }; inp.focus();
    } else {
      var t = document.createElement('textarea'); t.readOnly = true; t.id = 'epSel'; t.value = base.text; box.appendChild(t);
      var go = document.createElement('button'); go.className = 'epgo'; go.textContent = 'نقل النص المحدَّد أعلاه';
      go.onclick = function () { var s = t.selectionStart, e = t.selectionEnd; if (s === e) return toast('حدّد جزءاً من النص أولاً'); transfer(t.value.slice(s, e)); };
      var note = document.createElement('div'); note.className = 'epn'; note.textContent = 'حدّد بإصبعك أي جزء (كلمة أو جملة أو فقرات) ثم اضغط «نقل».'; box.append(note, go);
    }
  }

  async function open() {
    if (!meta.prevEditionId) return;
    ta().addEventListener('blur', function () { lastCaret = ta().selectionStart; });
    if (!panel) {
      var st = document.createElement('style'); st.textContent =
        '#edPicker{position:fixed;left:0;right:0;bottom:0;z-index:2147482800;max-height:64vh;display:none;flex-direction:column;background:#1b1810;color:#f3ecd2;border-top:2px solid #c9a227;border-radius:18px 18px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.5);direction:rtl;font:15px Amiri,serif}' +
        '#edPicker.open{display:flex}#edPicker .eph{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #4a4020}#edPicker .eph b{flex:1;color:#c9a227}' +
        '#edPicker button{background:#2b281c;color:inherit;border:1px solid #5c5230;border-radius:9px;padding:6px 10px;font:inherit;cursor:pointer}' +
        '#edPicker .ept{display:flex;gap:6px;padding:8px 12px}#edPicker .ept button.on{background:#c9a227;color:#1a1405;font-weight:700}' +
        '#edPicker .epd{display:flex;gap:6px;padding:0 12px 8px;flex-wrap:wrap}#edPicker select,#edPicker input[type=text],#edPicker textarea{background:#2b281c;color:inherit;border:1px solid #5c5230;border-radius:9px;padding:7px;font:inherit;min-width:0}' +
        '#edPicker .epd select{flex:1}#edPicker #epBody{overflow-y:auto;padding:0 12px 14px}#edPicker .epr{display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:1px dashed #4a4020}' +
        '#edPicker .epr.col{flex-direction:column;align-items:stretch}#edPicker .ept2{flex:1;min-width:0;line-height:1.7}#edPicker .epb{display:flex;gap:6px}#edPicker .epb button{flex:1}' +
        '#edPicker .epgo{width:100%;margin-top:10px;background:#c9a227;color:#1a1405;font-weight:700;padding:10px}#edPicker textarea#epSel{width:100%;height:30vh}#edPicker .epn{color:#a89b7c;font-size:13.5px;margin:6px 0}' +
        '#edPickToast{position:fixed;left:12px;right:12px;bottom:70px;z-index:2147483100;background:#25220f;border:1px solid #c9a227;color:#f3ecd2;border-radius:12px;padding:9px 12px;display:none;font:15px Amiri,serif;direction:rtl}';
      document.head.appendChild(st);
      panel = document.createElement('div'); panel.id = 'edPicker';
      panel.innerHTML = '<div class="eph"><b>📥 من الطبعة السابقة</b><button id="epClose">✕</button></div>' +
        '<div class="ept"><button data-t="chapters">فصول</button><button data-t="search">بحث</button><button data-t="select">تحديد</button></div>' +
        '<div class="epd"><select id="epDest"><option value="cursor">إلى: عند المؤشر</option><option value="end">إلى: نهاية الكتاب</option><option value="start">إلى: بداية الكتاب</option>' +
        '<option value="chapter-before">قبل فصل</option><option value="chapter-after">بعد فصل</option><option value="sub-before">قبل فصل جانبي</option><option value="sub-after">بعد فصل جانبي</option>' +
        '<option value="phrase-before">قبل عبارة</option><option value="phrase-after">بعد عبارة</option></select><span id="epTargetWrap" style="flex:1;display:flex"></span></div><div id="epBody"></div>';
      document.body.appendChild(panel);
      var tt = document.createElement('div'); tt.id = 'edPickToast'; document.body.appendChild(tt);
      $('epClose').onclick = function () { panel.classList.remove('open'); };
      $('epDest').onchange = fillTarget;
      panel.querySelector('.ept').onclick = function (e) { var b = e.target.closest('button'); if (b) { TAB = b.dataset.t; renderTab(); } };
    }
    try { await loadBase(); } catch (e) { return alert(e.message); }
    panel.classList.add('open'); fillTarget(); renderTab();
  }
  g.RoyalEditionPicker = { open: open, meta: meta, computePageMap: computePageMap };
})(window);
