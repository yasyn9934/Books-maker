/**
 * sanitize.js — تعقيم HTML لنص الكتاب (قائمة سماح)
 * ------------------------------------------------------------------
 * الهدف: السماح بوسوم HTML الآمنة داخل نص الكتاب (تنسيق، جداول، صور، روابط…)
 * وتطبيقها فعلاً في الكتاب والمعاينة والمعاينة المصغرة والمشاركة،
 * مع منع أي كود قابل للتنفيذ أو أي تأثير خارج حاوية الكتاب:
 *   - لا <script> ولا <style> ولا <iframe> ولا svg ولا نماذج.
 *   - لا خصائص on* (إلا ثلاثة معالجات يولّدها التطبيق نفسه وبصيغة صارمة جداً).
 *   - لا javascript: ولا data:text/html في الروابط والصور.
 *   - تصفية style: لا url() خارجي، ولا position ثابت/مطلق، ولا z-index، ولا expression.
 *
 * يُستخدم هكذا:  element.innerHTML = royalSanitize(html);
 * كما يوفّر: royalEscapeHtml(str) و royalEscapeAttr(str) للقيم النصية الخالصة،
 * و ROYAL_SANITIZER_SRC (نص المكتبة) لتضمينها في ملفات HTML المُصدَّرة.
 */
(function (root) {
  'use strict';

  function factory(g) {
    var TAGS = {};
    ('a abbr b bdi bdo big blockquote br button caption center cite code col colgroup dd del details dfn div dl dt em ' +
     'figcaption figure font h1 h2 h3 h4 h5 h6 hr i img ins kbd li mark ol p pre q rp rt ruby s samp small span ' +
     'strike strong sub summary sup table tbody td tfoot th thead tr tt u ul var wbr audio video source')
      .split(' ').forEach(function (t) { TAGS[t] = 1; });

    // وسوم تُحذف مع كل محتواها
    var DROP = {};
    ('script style iframe frame frameset object embed applet link meta base form input textarea select option ' +
     'optgroup svg math noscript template title head xml xmp plaintext listing marquee canvas dialog portal')
      .split(' ').forEach(function (t) { DROP[t] = 1; });

    var ATTRS = {};
    ('class dir lang title align valign width height colspan rowspan border cellpadding cellspacing ' +
     'color size face alt start open controls loop muted preload nowrap span reversed')
      .split(' ').forEach(function (a) { ATTRS[a] = 1; });

    // معالجات onclick الوحيدة المسموحة (يولّدها plugins.js وملفات العرض نفسها) — بصيغ صارمة
    var SAFE_HANDLERS = [
      /^return jumpToFootnote\(event,\s*'fnbody-[A-Za-z0-9_-]{1,64}'\)$/,
      /^goToChapterInBook\(event,\s*'chapter-[A-Za-z0-9_-]{1,32}'\)$/,
      /^playMedia\('[A-Za-z0-9_\u0600-\u06FF .\-]{1,80}'\)$/
    ];

    function cleanUrl(u) {
      return String(u).replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]+/g, '');
    }
    function safeHref(u) {
      var c = cleanUrl(u);
      if (!c) return false;
      if (c.charAt(0) === '#') return true;
      return /^(https?:|mailto:|tel:)/i.test(c);
    }
    function safeSrc(u, tag) {
      var c = cleanUrl(u);
      if (/^https?:/i.test(c)) return true;
      if (tag === 'img') return /^data:image\/(png|jpe?g|gif|webp|bmp);base64,[A-Za-z0-9+\/=]+$/i.test(c);
      if (tag === 'audio' || tag === 'video' || tag === 'source')
        return /^data:(audio|video)\/[a-z0-9.+-]+;base64,[A-Za-z0-9+\/=]+$/i.test(c);
      return false;
    }

    var BAD_PROPS = /^(position|z-index|behavior|-moz-binding|pointer-events|content|filter|backdrop-filter|mix-blend-mode|will-change|animation.*|transition.*|inset.*)$/;
    function cleanStyle(s) {
      s = String(s).replace(/\/\*[\s\S]*?\*\//g, '');
      var out = [];
      s.split(/;(?![^(]*\))/).forEach(function (d) {
        d = d.trim();
        var i = d.indexOf(':');
        if (i < 1) return;
        var p = d.slice(0, i).trim().toLowerCase();
        var v = d.slice(i + 1).trim();
        var vv = v.toLowerCase().replace(/\\([0-9a-f]{1,6}\s?|.)/gi, function (m, x) {
          var n = parseInt(x, 16); return isNaN(n) ? x : String.fromCharCode(n);
        });
        if (BAD_PROPS.test(p)) return;
        if (/expression|javascript:|vbscript:|@import|behavior|binding|image-set|-webkit-image|\bsrc\s*\(|attr\s*\(/.test(vv)) return;
        var ok = true;
        vv.replace(/url\(\s*(['"]?)([\s\S]*?)\1\s*\)/g, function (m, q, inner) {
          if (!/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+\/=]+$/i.test(cleanUrl(inner))) ok = false;
          return m;
        });
        if (!ok) return;
        if (/(^|[^a-z])(fixed|sticky)([^a-z]|$)/.test(vv) && /position/.test(p)) return;
        out.push(p + ':' + v);
      });
      return out.join(';');
    }

    function cleanElement(el, tag) {
      var attrs = Array.prototype.slice.call(el.attributes);
      for (var i = 0; i < attrs.length; i++) {
        var a = attrs[i], n = a.name.toLowerCase(), v = a.value;
        var keep = false;
        if (ATTRS[n]) keep = true;
        else if (n === 'style') { v = cleanStyle(v); keep = !!v; }
        else if (n === 'href' && tag === 'a') keep = safeHref(v);
        else if (n === 'src' && (tag === 'img' || tag === 'audio' || tag === 'video' || tag === 'source')) keep = safeSrc(v, tag);
        else if (n === 'id') keep = /^(fnref|fnbody|chapter|ch)-[A-Za-z0-9_-]{1,64}$/.test(v);
        else if (n.indexOf('data-') === 0) keep = /^data-fn-pending$/.test(n) && /^[A-Za-z0-9_-]{1,64}$/.test(v);
        else if (n === 'onclick') keep = SAFE_HANDLERS.some(function (r) { return r.test(v.trim()); });
        else if (n === 'target' && tag === 'a') keep = (v === '_blank');
        else if (n === 'type' && tag === 'button') keep = false; // نفرضه أدناه
        if (!keep) el.removeAttribute(a.name);
        else if (v !== a.value) el.setAttribute(a.name, v);
      }
      if (tag === 'a') {
        if (el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer');
      }
      if (tag === 'button') el.setAttribute('type', 'button');
      if (tag === 'img') { el.setAttribute('loading', 'lazy'); el.setAttribute('referrerpolicy', 'no-referrer'); }
      if (tag === 'audio' || tag === 'video') el.setAttribute('referrerpolicy', 'no-referrer');
    }

    function walk(node) {
      var child = node.firstChild;
      while (child) {
        var next = child.nextSibling;
        if (child.nodeType === 1) {
          var tag = child.nodeName.toLowerCase();
          if (DROP[tag]) {
            node.removeChild(child);
          } else if (!TAGS[tag]) {
            walk(child);                       // وسم غير معروف: نفكّ الغلاف ونُبقي أبناءه المعقّمين
            while (child.firstChild) node.insertBefore(child.firstChild, child);
            node.removeChild(child);
          } else {
            cleanElement(child, tag);
            walk(child);
          }
        } else if (child.nodeType !== 3) {
          node.removeChild(child);             // تعليقات / تعليمات معالجة …
        }
        child = next;
      }
    }

    var tpl = null;
    function sanitize(html) {
      if (html == null) return '';
      html = String(html);
      if (html.indexOf('<') < 0) return html;  // نص بلا وسوم: لا حاجة للتحليل
      if (!tpl) tpl = g.document.createElement('template');
      tpl.innerHTML = html;                    // محتوى <template> خامل: لا يُنفَّذ ولا يُحمَّل منه شيء
      walk(tpl.content);
      var out = tpl.innerHTML;
      tpl.innerHTML = '';
      return out;
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"'`]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c];
      });
    }

    g.royalSanitize = sanitize;
    g.royalEscapeHtml = escapeHtml;
    g.royalEscapeAttr = escapeHtml;
    /** يحوّل قيمة إلى literal آمن داخل <script> (يمنع إغلاق الوسم وسلاسل القوالب) */
    g.royalJsLiteral = function (v) {
      return JSON.stringify(v == null ? '' : v)
        .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    };
  }

  factory(root);
  // نص المكتبة نفسه، لتضمينه في ملفات HTML المُصدَّرة/المشاركة المستقلة
  root.ROYAL_SANITIZER_SRC = '(' + factory.toString() + ')(window);';
})(typeof window !== 'undefined' ? window : this);
