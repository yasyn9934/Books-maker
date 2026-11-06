/**
 * royal-find.js — بحث داخل نص الكتاب مع تظليل كل النتائج والتنقل بينها
 * ------------------------------------------------------------------
 * - يتجاهل التشكيل والتطويل وفروق الألف/الياء/التاء المربوطة (بحث عربي متسامح)، ويدعم "مطابقة تامة" اختيارية.
 * - يظلّل عبر CSS Custom Highlight API (لا يعدّل DOM الكتاب أبداً)، وإن لم تتوفر يعمل بلا تظليل مع التنقل.
 * - الاستعمال:  RoyalFind.open({ root: element|selector, textarea: element? })
 *   إن مُرّر textarea (المحرر) يبحث أيضاً في نص الإدخال ويحدّد النتيجة فيه، ويتيح الاستبدال.
 */
(function (g) {
  'use strict';
  var DIAC = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
  function norm(s) {
    return String(s).replace(DIAC, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();
  }
  // نبني نصاً مطبَّعاً مع خريطة تعيد كل حرف مطبَّع إلى موضعه الأصلي
  function normMap(s) {
    var out = '', map = [];
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (DIAC.test(c)) { DIAC.lastIndex = 0; continue; }
      DIAC.lastIndex = 0;
      out += norm(c); map.push(i);
    }
    return { text: out, map: map };
  }

  var bar, state = { opts: null, ranges: [], idx: -1, hl: null };
  var HAS_HL = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';

  function ensureStyle() {
    if (document.getElementById('rf-style')) return;
    var st = document.createElement('style'); st.id = 'rf-style';
    st.textContent =
      '::highlight(rf-all){background:rgba(255,213,0,.45);color:inherit}::highlight(rf-cur){background:#ff9800;color:#000}' +
      '#rf-bar{position:fixed;top:8px;left:8px;right:8px;z-index:2147483000;display:flex;gap:6px;align-items:center;flex-wrap:wrap;direction:rtl;' +
      'background:#1f1d16;color:#f3ecd2;border:1px solid #c9a227;border-radius:14px;padding:8px 10px;box-shadow:0 10px 30px rgba(0,0,0,.5);font:14px Amiri,serif}' +
      '#rf-bar input[type=text]{flex:1;min-width:120px;background:#2b281c;color:inherit;border:1px solid #5c5230;border-radius:9px;padding:7px 10px;font:inherit}' +
      '#rf-bar button{background:#2b281c;color:inherit;border:1px solid #5c5230;border-radius:9px;padding:6px 10px;font:inherit;cursor:pointer}' +
      '#rf-bar button.pri{background:#c9a227;color:#1a1405;border-color:#c9a227;font-weight:700}' +
      '#rf-bar .rf-cnt{min-width:64px;text-align:center;color:#d8c98f}#rf-bar label{display:flex;gap:4px;align-items:center;font-size:13px}';
    document.head.appendChild(st);
  }

  function clearHL() { if (HAS_HL) { CSS.highlights.delete('rf-all'); CSS.highlights.delete('rf-cur'); } state.ranges = []; state.idx = -1; }

  function textNodes(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode; if (!p) return NodeFilter.FILTER_REJECT;
        var t = p.nodeName; if (t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var a = []; while (w.nextNode()) a.push(w.currentNode); return a;
  }

  function search(q, whole) {
    clearHL();
    var root = typeof state.opts.root === 'string' ? document.querySelector(state.opts.root) : state.opts.root;
    var nq = norm(q).trim();
    if (!nq || !root) return update();
    var ranges = [];
    textNodes(root).forEach(function (node) {
      var nm = normMap(node.nodeValue), t = nm.text, from = 0, pos;
      while ((pos = t.indexOf(nq, from)) >= 0) {
        var end = pos + nq.length;
        if (whole) {
          var before = t[pos - 1], after = t[end];
          if ((before && /[\u0621-\u064A\w]/.test(before)) || (after && /[\u0621-\u064A\w]/.test(after))) { from = pos + 1; continue; }
        }
        var r = document.createRange();
        r.setStart(node, nm.map[pos]); r.setEnd(node, nm.map[end - 1] + 1);
        ranges.push(r); from = end;
      }
    });
    state.ranges = ranges;
    if (HAS_HL && ranges.length) CSS.highlights.set('rf-all', new Highlight(...ranges));
    state.idx = ranges.length ? 0 : -1;
    goTo(0);
  }

  function goTo(i) {
    var n = state.ranges.length; if (!n) return update();
    state.idx = ((i % n) + n) % n;
    var r = state.ranges[state.idx];
    if (HAS_HL) CSS.highlights.set('rf-cur', new Highlight(r));
    var el = r.startContainer.parentElement; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    update();
  }

  // بحث في نص الإدخال (textarea) في المحرر
  function taIndexes(q, whole) {
    var ta = state.opts.textarea; if (!ta) return [];
    var nm = normMap(ta.value), nq = norm(q).trim(), res = [], from = 0, pos;
    if (!nq) return res;
    while ((pos = nm.text.indexOf(nq, from)) >= 0) {
      var end = pos + nq.length;
      if (whole) { var b = nm.text[pos - 1], a = nm.text[end]; if ((b && /[\u0621-\u064A\w]/.test(b)) || (a && /[\u0621-\u064A\w]/.test(a))) { from = pos + 1; continue; } }
      res.push([nm.map[pos], nm.map[end - 1] + 1]); from = end;
    }
    return res;
  }
  var taIdx = -1, taList = [];
  function taGo(step) {
    if (!taList.length) return;
    taIdx = ((taIdx + step) % taList.length + taList.length) % taList.length;
    var ta = state.opts.textarea, p = taList[taIdx];
    ta.focus(); ta.setSelectionRange(p[0], p[1]);
    var lh = parseFloat(getComputedStyle(ta).lineHeight) || 22, line = ta.value.slice(0, p[0]).split('\n').length;
    ta.scrollTop = Math.max(0, (line - 3) * lh);
    update();
  }

  function update() {
    if (!bar) return;
    var cnt = bar.querySelector('.rf-cnt'), n = state.ranges.length;
    var tn = taList.length;
    cnt.textContent = state.opts.textarea ? (tn ? (taIdx + 1) + '/' + tn + ' نص' : (n ? (state.idx + 1) + '/' + n : '0')) : (n ? (state.idx + 1) + '/' + n : '0');
  }

  function open(opts) {
    state.opts = opts; ensureStyle();
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'rf-bar';
      bar.innerHTML = '<input type="text" id="rf-q" placeholder="ابحث في الكتاب…" autocomplete="off">' +
        '<span class="rf-cnt">0</span><button id="rf-prev" title="السابق">▲</button><button id="rf-next" class="pri" title="التالي">▼</button>' +
        '<label><input type="checkbox" id="rf-whole"> كلمة تامة</label>' +
        '<span id="rf-rep-wrap" style="display:none;gap:6px;align-items:center;flex-wrap:wrap;flex:1 1 100%"><input type="text" id="rf-rep" placeholder="استبدال بـ…" style="flex:1;min-width:120px">' +
        '<button id="rf-rep1">استبدال</button><button id="rf-repall" class="pri">استبدال الكل</button></span>' +
        '<button id="rf-close" title="إغلاق">✕</button>';
      document.body.appendChild(bar);
      var q = bar.querySelector('#rf-q'), whole = bar.querySelector('#rf-whole');
      var run = function () {
        search(q.value, whole.checked);
        if (state.opts.textarea) { taList = taIndexes(q.value, whole.checked); taIdx = -1; if (taList.length) taGo(1); else update(); }
      };
      var tm; q.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(run, 180); });
      whole.addEventListener('change', run);
      q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); next(e.shiftKey ? -1 : 1); } });
      bar.querySelector('#rf-next').onclick = function () { next(1); };
      bar.querySelector('#rf-prev').onclick = function () { next(-1); };
      bar.querySelector('#rf-close').onclick = close;
      bar.querySelector('#rf-rep1').onclick = function () { replace(false); };
      bar.querySelector('#rf-repall').onclick = function () { replace(true); };
    }
    bar.style.display = 'flex';
    bar.querySelector('#rf-rep-wrap').style.display = opts.textarea ? 'flex' : 'none';
    var inp = bar.querySelector('#rf-q'); inp.focus(); inp.select();
  }
  function next(step) { if (state.opts.textarea && taList.length) { taGo(step); if (state.ranges.length) goTo(state.idx + step); } else goTo(state.idx + step); }

  function replace(all) {
    var ta = state.opts.textarea; if (!ta) return;
    var q = bar.querySelector('#rf-q').value, rep = bar.querySelector('#rf-rep').value, whole = bar.querySelector('#rf-whole').checked;
    var list = taIndexes(q, whole); if (!list.length) return;
    var v = ta.value, out = '', last = 0;
    var todo = all ? list : [list[Math.max(0, taIdx)] || list[0]];
    todo.forEach(function (p) { out += v.slice(last, p[0]) + rep; last = p[1]; });
    out += v.slice(last); ta.value = out;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(function () { bar.querySelector('#rf-q').dispatchEvent(new Event('input')); }, 900);   // أعد البحث بعد إعادة بناء المعاينة
  }
  function close() { if (bar) bar.style.display = 'none'; clearHL(); taList = []; taIdx = -1; }

  g.RoyalFind = { open: open, close: close, norm: norm };
})(window);
