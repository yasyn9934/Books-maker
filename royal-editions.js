/**
 * royal-editions.js — نواة ميزة «الطبعات»
 * ------------------------------------------------------------------
 * الطبعة = كتاب مستقل (ملفه الخاص) يرتبط بمجموعة طبعات:
 *   editionGroup  معرّف المجموعة (= معرّف الطبعة الأولى)     editionNumber  رقم الطبعة (1، 2، 3…)
 *   prevEditionId الطبعة التي اعتُمد عليها                    editionMode    'full' | 'partial'
 * المواضع (anchors) داخل النص:  فصل (# …)  ·  فصل جانبي (## …)  ·  صفحة (حسب pageMap المحفوظ من المحرر)  ·  عبارة محددة
 * والموضع قبل العنصر أو بعده.
 */
(function (g) {
  'use strict';
  var DIAC = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
  function norm(s) { return String(s || '').replace(DIAC, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase(); }
  function plain(s) { return String(s || '').replace(/\{[^{}|:]+:[^{}|]*\|([^{}]*)\}/g, '$1').replace(/\{[^{}]*\}/g, '').replace(/<[^>]*>/g, ''); }
  function words(s) { var t = plain(s).trim(); return t ? t.split(/\s+/).length : 0; }

  var ORD = ['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة',
    'الحادية عشرة', 'الثانية عشرة', 'الثالثة عشرة', 'الرابعة عشرة', 'الخامسة عشرة', 'السادسة عشرة', 'السابعة عشرة', 'الثامنة عشرة', 'التاسعة عشرة', 'العشرون'];
  function ordinal(n) { return ORD[n] || ('رقم ' + n); }
  function editionLabel(n) { return 'الطبعة ' + ordinal(n); }

  // ───────── البنية ─────────
  /** أسطر النص + فهارس الفصول والفصول الجانبية: [{line, level, title}] */
  function structure(text) {
    var lines = String(text || '').split('\n'), heads = [];
    lines.forEach(function (l, i) {
      var m = l.match(/^(#{1,3})\s+(.*)$/);
      if (m) heads.push({ line: i, level: m[1].length, title: plain(m[2]).trim() });
    });
    return { lines: lines, heads: heads };
  }
  function chapters(text) { return structure(text).heads.filter(function (h) { return h.level === 1; }); }
  function subChapters(text) { return structure(text).heads.filter(function (h) { return h.level === 2; }); }
  /** مقاطع الكتاب: كل فصل بنصه [{title, start, end, text}] (أسطر نصف مفتوحة) */
  function chapterSections(text) {
    var st = structure(text), L = st.lines, out = [], heads = st.heads.filter(function (h) { return h.level === 1; });
    if (heads.length && heads[0].line > 0 && L.slice(0, heads[0].line).join('').trim()) out.push({ title: '(مقدمة بلا عنوان)', start: 0, end: heads[0].line, text: L.slice(0, heads[0].line).join('\n') });
    heads.forEach(function (h, i) {
      var end = i + 1 < heads.length ? heads[i + 1].line : L.length;
      out.push({ title: h.title, start: h.line, end: end, text: L.slice(h.line, end).join('\n') });
    });
    if (!heads.length && String(text || '').trim()) out.push({ title: '(النص كاملاً)', start: 0, end: L.length, text: String(text) });
    return out;
  }

  // ───────── مواضع الإضافة ─────────
  /**
   * يعيد موضع الإدراج بالأسطر: {line, inline?, offset?}  حيث line هو رقم السطر الذي يُدرَج قبله (يمكن أن يساوي عدد الأسطر = النهاية)
   * anchor: {type:'chapter'|'sub'|'page'|'phrase'|'start'|'end', index?, value?}   pos: 'before' | 'after'
   */
  function resolveAnchor(text, anchor, pos, pageMap) {
    var st = structure(text), L = st.lines;
    if (!anchor || anchor.type === 'end') return { line: L.length };
    if (anchor.type === 'start') return { line: 0 };
    if (anchor.type === 'chapter' || anchor.type === 'sub') {
      var lvl = anchor.type === 'chapter' ? 1 : 2;
      var hs = st.heads.filter(function (h) { return h.level === lvl; });
      var h = hs[anchor.index]; if (!h) throw new Error('الموضع المحدد غير موجود في النص');
      if (pos === 'before') return { line: h.line };
      // بعد العنصر = بعد نهاية قسمه (قبل أول عنوان من نفس المستوى أو أعلى)
      var next = st.heads.filter(function (x) { return x.line > h.line && x.level <= lvl; })[0];
      return { line: next ? next.line : L.length };
    }
    if (anchor.type === 'page') {
      if (!pageMap || !pageMap.length) throw new Error('ترقيم الصفحات غير متاح لهذا الكتاب. افتحه في المحرر مرة ليُحسب ثم أعد المحاولة.');
      var n = Number(anchor.index);
      if (!(n >= 1 && n <= pageMap.length)) throw new Error('رقم الصفحة خارج النطاق (1 – ' + pageMap.length + ')');
      return { line: pos === 'before' ? pageMap[n - 1] : (n < pageMap.length ? pageMap[n] : L.length) };
    }
    if (anchor.type === 'phrase') {
      var q = norm(anchor.value || '').trim(); if (!q) throw new Error('اكتب العبارة المحددة');
      var off = 0;
      for (var i = 0; i < L.length; i++) {
        // نبحث في السطر مع تجاهل التشكيل، ونعيد الإزاحة بالنص الأصلي
        var map = [], flat = '';
        for (var j = 0; j < L[i].length; j++) { if (DIAC.test(L[i][j])) { DIAC.lastIndex = 0; continue; } DIAC.lastIndex = 0; flat += norm(L[i][j]); map.push(j); }
        var p = flat.indexOf(q);
        if (p >= 0) {
          var s = map[p], e = map[p + q.length - 1] + 1;
          return { line: i, inline: true, offset: off + (pos === 'before' ? s : e) };
        }
        off += L[i].length + 1;
      }
      throw new Error('لم أجد العبارة «' + anchor.value + '» في النص');
    }
    throw new Error('نوع موضع غير معروف');
  }
  /** يُدرج content في text عند الموضع؛ الكتل (فصول/صفحات) بأسطر مستقلة، والعبارة ضمن السطر نفسه */
  function insertAt(text, content, anchor, pos, pageMap) {
    text = String(text || ''); content = String(content || '');
    var at = resolveAnchor(text, anchor, pos, pageMap);
    if (at.inline) return text.slice(0, at.offset) + content + text.slice(at.offset);
    var L = text.split('\n'), block = content.replace(/\s+$/, '').split('\n');
    var needBlankBefore = at.line > 0 && L[at.line - 1] !== undefined && L[at.line - 1].trim() !== '';
    var ins = (needBlankBefore ? [''] : []).concat(block, at.line < L.length ? [''] : []);
    L.splice.apply(L, [at.line, 0].concat(ins));
    return L.join('\n');
  }

  /** حساب خريطة الصفحات: يُستدعى من المحرر بعد البناء؛ pageStartTexts = نص أول عنصر في كل صفحة (بلا الغلاف) */
  function computePageMap(text, pageStartTexts) {
    var L = String(text || '').split('\n').map(function (l) { return norm(plain(l)).replace(/\s+/g, ' ').trim(); });
    var map = [], from = 0;
    pageStartTexts.forEach(function (t) {
      var snip = norm(String(t || '')).replace(/\s+/g, ' ').trim().slice(0, 24);
      if (!snip) { map.push(Math.min(from, L.length)); return; }
      var found = -1;
      for (var i = from; i < L.length; i++) { if (L[i] && L[i].indexOf(snip) >= 0) { found = i; break; } }
      if (found < 0) found = Math.min(from, L.length);
      map.push(found); from = found;
    });
    return map;
  }

  // ───────── المجموعات ─────────
  function groupOf(b) { return b.editionGroup || b.id; }
  function editionsOf(book, all) {
    var gid = groupOf(book);
    return (all || []).filter(function (x) { return x && groupOf(x) === gid; })
      .sort(function (a, b) { return (a.editionNumber || 1) - (b.editionNumber || 1); });
  }
  function nextNumber(book, all) {
    var max = 1; editionsOf(book, all).forEach(function (x) { if ((x.editionNumber || 1) > max) max = x.editionNumber || 1; }); return max + 1;
  }
  function newId() { return 'book_' + Date.now() + '_' + Math.floor(Math.random() * 1000); }

  /** ينشئ طبعة جديدة من طبعة سابقة.  opts: {mode:'full'|'partial', number, title, author, preface?, additions?:[{text, anchor, pos}] } */
  function createEdition(base, all, opts) {
    var n = opts.number || nextNumber(base, all), text = '';
    var copy = JSON.parse(JSON.stringify(base));
    if (opts.mode === 'full') {
      text = String(base.text || '');
      var adds = (opts.additions || []).filter(function (a) { return a && String(a.text || '').trim(); });
      if (!(opts.preface && String(opts.preface).trim()) && !adds.length)
        throw new Error('الاعتماد الكلي يتطلب إضافة: مقدمة الطبعة، أو نصاً جديداً بموضع محدد.');
      // المقدمة الإلزامية في بداية الكتاب، ثم الإضافات (من الأسفل للأعلى كي لا تتزحزح مواضعها)
      var pm = base.pageMap;
      var ordered = adds.map(function (a, i) { return { a: a, at: resolveAnchor(text, a.anchor, a.pos, pm), i: i }; })
        .sort(function (x, y) { return (y.at.line - x.at.line) || (y.at.offset || 0) - (x.at.offset || 0) || y.i - x.i; });
      ordered.forEach(function (o) { text = insertAt(text, o.a.text, o.a.anchor, o.a.pos, pm); });
      if (opts.preface && String(opts.preface).trim())
        text = '# مقدمة ' + editionLabel(n) + '\n' + String(opts.preface).trim() + '\n\n' + text;
    }
    copy.id = newId(); copy.text = text; copy.title = opts.title != null ? opts.title : base.title; copy.author = opts.author != null ? opts.author : base.author;
    copy.editionGroup = groupOf(base); copy.editionNumber = n; copy.prevEditionId = base.id; copy.editionMode = opts.mode;
    copy.editionCreatedAt = Date.now(); copy.updatedAt = Date.now(); copy.pageMap = [];
    delete copy._light; delete copy.cardImage; delete copy.isFavorite;
    return copy;
  }

  // ───────── المقارنة ─────────
  function lcsDiff(A, B, eq) {
    var n = A.length, m = B.length, dp = [];
    for (var i = 0; i <= n; i++) { dp.push(new Uint32Array(m + 1)); }
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) dp[i][j] = eq(A[i], B[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    var ops = []; i = 0; var j2 = 0;
    while (i < n && j2 < m) {
      if (eq(A[i], B[j2])) { ops.push({ t: '=', a: i, b: j2 }); i++; j2++; }
      else if (dp[i + 1][j2] >= dp[i][j2 + 1]) { ops.push({ t: '-', a: i }); i++; }
      else { ops.push({ t: '+', b: j2 }); j2++; }
    }
    while (i < n) ops.push({ t: '-', a: i++ });
    while (j2 < m) ops.push({ t: '+', b: j2++ });
    return ops;
  }
  /** فرق على مستوى الكلمات بين نصين: [{t:'=|+|-', w}] (مع حدّ للحجم) */
  function wordDiff(a, b) {
    var A = plain(a).split(/\s+/).filter(Boolean), B = plain(b).split(/\s+/).filter(Boolean);
    if (A.length * B.length > 2500000) return [{ t: '-', w: A.join(' ') }, { t: '+', w: B.join(' ') }];
    return lcsDiff(A, B, function (x, y) { return norm(x) === norm(y); }).map(function (o) { return { t: o.t, w: o.t === '+' ? B[o.b] : A[o.a] }; });
  }
  /** مقارنة طبعتين: نتائج على مستوى الفصول والفقرات */
  function compare(a, b) {
    var SA = chapterSections(a.text), SB = chapterSections(b.text), used = {}, res = [];
    var stats = { chaptersAdded: 0, chaptersRemoved: 0, chaptersChanged: 0, chaptersSame: 0, wordsA: words(a.text), wordsB: words(b.text), wordsAdded: 0, wordsRemoved: 0 };
    SA.forEach(function (sa) {
      var idx = -1;
      for (var i = 0; i < SB.length; i++) { if (!used[i] && norm(SB[i].title) === norm(sa.title)) { idx = i; break; } }
      if (idx < 0) { res.push({ status: 'removed', title: sa.title, a: sa.text }); stats.chaptersRemoved++; stats.wordsRemoved += words(sa.text); return; }
      used[idx] = 1; var sb = SB[idx];
      if (norm(plain(sa.text)) === norm(plain(sb.text))) { res.push({ status: 'same', title: sa.title }); stats.chaptersSame++; return; }
      var pa = sa.text.split('\n').filter(function (x) { return x.trim(); }), pb = sb.text.split('\n').filter(function (x) { return x.trim(); });
      var ops = lcsDiff(pa, pb, function (x, y) { return norm(plain(x)) === norm(plain(y)); }), paras = [], k = 0;
      while (k < ops.length) {
        var o = ops[k];
        if (o.t === '=') { k++; continue; }
        if (o.t === '-' && ops[k + 1] && ops[k + 1].t === '+') { var wd = wordDiff(pa[o.a], pb[ops[k + 1].b]); paras.push({ t: '~', diff: wd }); wd.forEach(function (x) { if (x.t === '+') stats.wordsAdded++; if (x.t === '-') stats.wordsRemoved++; }); k += 2; continue; }
        if (o.t === '-') { paras.push({ t: '-', text: pa[o.a] }); stats.wordsRemoved += words(pa[o.a]); } else { paras.push({ t: '+', text: pb[o.b] }); stats.wordsAdded += words(pb[o.b]); }
        k++;
      }
      res.push({ status: 'changed', title: sa.title, paras: paras }); stats.chaptersChanged++;
    });
    SB.forEach(function (sb, i) { if (!used[i]) { res.push({ status: 'added', title: sb.title, b: sb.text }); stats.chaptersAdded++; stats.wordsAdded += words(sb.text); } });
    return { chapters: res, stats: stats };
  }

  // ───────── حزمة الذكاء الاصطناعي ─────────
  function aiPackage(editions, meta) {
    var eds = editions.slice().sort(function (x, y) { return (x.editionNumber || 1) - (y.editionNumber || 1); });
    var title = (meta && meta.title) || eds[eds.length - 1].title || 'كتاب';
    var md = '# ملف طبعات كتاب: ' + title + '\n\n';
    md += '## معلومات عامة\n- عنوان الكتاب: ' + title + '\n- المؤلف: ' + (eds[0].author || 'غير محدد') + '\n- عدد الطبعات في الملف: ' + eds.length + '\n- تاريخ التجهيز: ' + new Date().toISOString().slice(0, 10) + '\n\n';
    md += '## فهرس الطبعات\n';
    eds.forEach(function (e) { md += '- ' + editionLabel(e.editionNumber || 1) + (e.editionMode ? ' (' + (e.editionMode === 'full' ? 'اعتماد كلي على السابقة' : 'اعتماد جزئي') + ')' : '') + ' — عدد الكلمات: ' + words(e.text) + ' — عدد الفصول: ' + chapters(e.text).length + (e.date ? ' — التاريخ: ' + e.date : '') + '\n'; });
    md += '\n(ملاحظة: الأسطر التي تبدأ بـ «# » عناوين فصول، وبـ «## » عناوين فصول جانبية.)\n\n---\n';
    eds.forEach(function (e) {
      md += '\n\n=====================================\n# [' + editionLabel(e.editionNumber || 1).toUpperCase() + '] ' + (e.title || title) + '\n=====================================\n\n' + plain(e.text).replace(/\n{3,}/g, '\n\n') + '\n';
    });
    var prompt = 'أرفقتُ ملفاً واحداً فيه جميع طبعات كتاب «' + title + '» (' + eds.length + ' طبعات) مع معلومات عن كل طبعة.\n\n' +
      'المطلوب: مقارنة شاملة ومفصلة بين الطبعات، تتضمن:\n' +
      '1) ملخصاً عاماً لما تغيّر من طبعة لأخرى (إضافات، حذوف، تعديلات، إعادة ترتيب).\n' +
      '2) مقارنة فصلاً بفصل: الفصول المضافة والمحذوفة والمعدَّلة، مع ذكر الفروق الجوهرية في المعنى لا مجرد الألفاظ.\n' +
      '3) تقييم جودة التعديلات (تحسين الأسلوب، تصحيح أخطاء، تدقيق معلومات، تكرار أو تناقض جديد).\n' +
      '4) فحص اتساق مقدمات الطبعات مع التغييرات الفعلية، وهل ذكرت المقدمة كل ما تغيّر؟\n' +
      '5) توصيات لتحسين الطبعة القادمة.\n' +
      'اعرض النتيجة في أقسام واضحة بعناوين، واذكر اقتباسات قصيرة من النص حين تستدل بها.';
    return { filename: 'طبعات_' + String(title).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) + '.md', content: md, prompt: prompt };
  }

  g.RoyalEditions = {
    norm: norm, plain: plain, words: words, ordinal: ordinal, editionLabel: editionLabel,
    structure: structure, chapters: chapters, subChapters: subChapters, chapterSections: chapterSections,
    resolveAnchor: resolveAnchor, insertAt: insertAt, computePageMap: computePageMap,
    groupOf: groupOf, editionsOf: editionsOf, nextNumber: nextNumber, createEdition: createEdition,
    compare: compare, wordDiff: wordDiff, aiPackage: aiPackage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.RoyalEditions;
})(typeof window !== 'undefined' ? window : globalThis);
