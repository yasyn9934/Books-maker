/**
 * royal-export.js — تصدير الكتب (EPUB / DOCX) والنسخة الاحتياطية الكاملة واستعادتها، دون أي مكتبة خارجية.
 * ملاحظة: التصدير نصّي منسَّق (عناوين فصول + فقرات + غلاف)؛ الأكواد الخاصة بتنسيقات الموقع {…} تُحوَّل إلى نصها العادي.
 * للحصول على PDF بنفس تنسيق صفحات الكتاب استعمل زر الطباعة (حفظ بصيغة PDF).
 */
(function (g) {
  'use strict';
  var enc = new TextEncoder(), dec = new TextDecoder('utf-8');

  // ───────── ZIP (بلا ضغط) ─────────
  var CRC = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function u16(n) { return [n & 255, (n >>> 8) & 255]; }
  function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
  function toU8(d) { return typeof d === 'string' ? enc.encode(d) : (d instanceof Uint8Array ? d : new Uint8Array(d)); }
  /** files: [{name, data(string|Uint8Array)}] → Uint8Array (zip بطريقة التخزين 0) */
  function zip(files) {
    var parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = toU8(f.data), crc = crc32(data);
      var head = [0x50, 0x4B, 3, 4].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(head), name, data);
      central.push({ name: name, crc: crc, size: data.length, off: offset });
      offset += head.length + name.length + data.length;
    });
    var cstart = offset, cparts = [];
    central.forEach(function (c) {
      var h = [0x50, 0x4B, 1, 2].concat(u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c.crc), u32(c.size), u32(c.size), u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.off));
      cparts.push(new Uint8Array(h), c.name); offset += h.length + c.name.length;
    });
    var end = [0x50, 0x4B, 5, 6].concat(u16(0), u16(0), u16(central.length), u16(central.length), u32(offset - cstart), u32(cstart), u16(0));
    var all = parts.concat(cparts, [new Uint8Array(end)]), total = 0; all.forEach(function (p) { total += p.length; });
    var out = new Uint8Array(total), pos = 0; all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }
  /** قراءة ملفات zip المخزَّنة (بلا ضغط) — صيغة نسخنا الاحتياطية */
  function unzip(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), out = {}, i = 0;
    while (i + 30 < u8.length && dv.getUint32(i, true) === 0x04034b50) {
      var method = dv.getUint16(i + 8, true), csize = dv.getUint32(i + 18, true), nlen = dv.getUint16(i + 26, true), elen = dv.getUint16(i + 28, true);
      var name = dec.decode(u8.subarray(i + 30, i + 30 + nlen)), start = i + 30 + nlen + elen;
      if (method !== 0) throw new Error('هذا الملف مضغوط بصيغة غير مدعومة؛ استعمل نسخة احتياطية أُنشئت من التطبيق.');
      out[name] = u8.subarray(start, start + csize); i = start + csize;
    }
    return out;
  }

  // ───────── تنظيف نص الكتاب ─────────
  function plain(s) {
    return String(s || '')
      .replace(/\{[^{}|:]+:[^{}|]*\|([^{}]*)\}/g, '$1')      // {ميزة:خيار|نص} → نص
      .replace(/\{[^{}]*\}/g, '')                              // أي وسم متبقٍ
      .replace(/<[^>]*>/g, '');                                // وسوم HTML
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  /** ينقسم النص إلى فصول: [{title, paras:[…]}] */
  function chapters(book) {
    var chs = [], cur = { title: '', paras: [] };
    String(book.text || '').split('\n').forEach(function (line) {
      var m = line.match(/^(#{1,2})\s+(.*)$/);
      if (m && m[1].length === 1) { if (cur.title || cur.paras.length) chs.push(cur); cur = { title: plain(m[2]).trim(), paras: [] }; }
      else if (m) cur.paras.push({ h2: plain(m[2]).trim() });
      else if (line.trim()) cur.paras.push({ p: plain(line).trim() });
    });
    if (cur.title || cur.paras.length) chs.push(cur);
    if (!chs.length) chs.push({ title: book.title || 'الكتاب', paras: [] });
    return chs;
  }
  function dataUrlBytes(u) {
    var m = /^data:(image\/(?:png|jpe?g|gif|webp));base64,(.+)$/i.exec(u || ''); if (!m) return null;
    var bin = atob(m[2]), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return { mime: m[1].toLowerCase().replace('jpg', 'jpeg'), bytes: a, ext: m[1].split('/')[1].replace('jpeg', 'jpg') };
  }

  // ───────── EPUB ─────────
  function buildEpub(book) {
    var chs = chapters(book), id = 'urn:uuid:' + (book.id || Date.now()), title = esc(book.title || 'كتاب'), author = esc(book.author || '');
    var cover = dataUrlBytes(book.cover), files = [];
    files.push({ name: 'mimetype', data: 'application/epub+zip' });
    files.push({ name: 'META-INF/container.xml', data: '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' });
    files.push({ name: 'OEBPS/style.css', data: 'body{direction:rtl;text-align:justify;font-family:serif;line-height:1.9}h1{text-align:center;margin:1.2em 0}h2{margin:1em 0 .4em}p{margin:.4em 0;text-indent:1em}' });
    var manifest = '<item id="css" href="style.css" media-type="text/css"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>', spine = '', nav = '';
    if (cover) { manifest += '<item id="cover-img" href="cover.' + cover.ext + '" media-type="' + cover.mime + '" properties="cover-image"/>'; files.push({ name: 'OEBPS/cover.' + cover.ext, data: cover.bytes }); }
    chs.forEach(function (c, i) {
      var f = 'c' + (i + 1) + '.xhtml', body = (c.title ? '<h1>' + esc(c.title) + '</h1>' : '') +
        c.paras.map(function (p) { return p.h2 ? '<h2>' + esc(p.h2) + '</h2>' : '<p>' + esc(p.p) + '</p>'; }).join('');
      files.push({ name: 'OEBPS/' + f, data: '<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" dir="rtl" xml:lang="ar" lang="ar"><head><title>' + esc(c.title || book.title || '') + '</title><link rel="stylesheet" href="style.css"/></head><body>' + body + '</body></html>' });
      manifest += '<item id="c' + (i + 1) + '" href="' + f + '" media-type="application/xhtml+xml"/>'; spine += '<itemref idref="c' + (i + 1) + '"/>';
      nav += '<li><a href="' + f + '">' + esc(c.title || ('الفصل ' + (i + 1))) + '</a></li>';
    });
    files.push({ name: 'OEBPS/nav.xhtml', data: '<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" dir="rtl"><head><title>الفهرس</title></head><body><nav epub:type="toc"><h1>الفهرس</h1><ol>' + nav + '</ol></nav></body></html>' });
    files.push({ name: 'OEBPS/content.opf', data: '<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bid" dir="rtl"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bid">' + esc(id) + '</dc:identifier><dc:title>' + title + '</dc:title>' + (author ? '<dc:creator>' + author + '</dc:creator>' : '') + '<dc:language>ar</dc:language><meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</meta></metadata><manifest>' + manifest + '</manifest><spine page-progression-direction="rtl">' + spine + '</spine></package>' });
    return new Blob([zip(files)], { type: 'application/epub+zip' });
  }

  // ───────── DOCX ─────────
  function wp(text, style, extra) {
    return '<w:p><w:pPr>' + (style ? '<w:pStyle w:val="' + style + '"/>' : '') + '<w:bidi/>' + (extra || '<w:jc w:val="both"/>') + '</w:pPr><w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">' + esc(text) + '</w:t></w:r></w:p>';
  }
  function buildDocx(book) {
    var body = wp(book.title || 'كتاب', 'Title', '<w:jc w:val="center"/>') + (book.author ? wp(book.author, '', '<w:jc w:val="center"/>') : '');
    chapters(book).forEach(function (c, i) {
      if (c.title) body += (i ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : '') + wp(c.title, 'Heading1', '<w:jc w:val="center"/>');
      c.paras.forEach(function (p) { body += p.h2 ? wp(p.h2, 'Heading2', '<w:jc w:val="right"/>') : wp(p.p, ''); });
    });
    var ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    var style = function (id, name, sz, bold) { return '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:pPr><w:bidi/><w:spacing w:before="200" w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Amiri" w:hAnsi="Amiri" w:cs="Amiri"/>' + (bold ? '<w:b/><w:bCs/>' : '') + '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr></w:style>'; };
    return new Blob([zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'word/styles.xml', data: '<?xml version="1.0" encoding="UTF-8"?><w:styles ' + ns + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Amiri" w:hAnsi="Amiri" w:cs="Amiri"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:bidi="ar-SA"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:bidi/><w:spacing w:line="360" w:lineRule="auto"/></w:pPr></w:style>' + style('Title', 'Title', 56, true) + style('Heading1', 'heading 1', 40, true) + style('Heading2', 'heading 2', 32, true) + '</w:styles>' },
      { name: 'word/document.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + ns + '><w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>' }
    ])], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // ───────── نسخة احتياطية ─────────
  var USER_KEYS = ['royal_categories_list', 'royal_notifications', 'royal_posts', 'royal_docs', 'royal_following', 'royal_viewed_shares', 'royal_deleted_books', 'royal_editor_prefs', 'royal_app_theme', 'royal_app_settings', 'royal_writing_stats', 'royal_writing_goal'];
  function jget(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function backup() {
    var files = [], books = jget('royal_books_list', []), n = 0, light = 0;
    books.forEach(function (b) { if (b && b.id && (typeof b.text === 'string' || typeof b.t === 'string')) { files.push({ name: 'books/' + String(b.id).replace(/[^\w-]/g, '_') + '.json', data: JSON.stringify(b) }); n++; } else light++; });
    USER_KEYS.forEach(function (k) { var s = localStorage.getItem(k); if (s != null) files.push({ name: 'user/' + k + '.json', data: s }); });
    var u = jget('royal_user', null); if (u && u.role === 'member') { delete u.token; delete u.sessionToken; files.push({ name: 'user/profile.json', data: JSON.stringify(u) }); }
    files.push({ name: 'manifest.json', data: JSON.stringify({ app: 'RoyalBooks', version: 1, created: new Date().toISOString(), books: n, lightBooksSkipped: light }) });
    return { blob: new Blob([zip(files)], { type: 'application/zip' }), books: n, skipped: light };
  }
  /** استعادة: تُدمج الكتب (الأحدث يفوز) وتُضاف بيانات المستخدم الناقصة؛ لا يُمسّ حساب الدخول */
  function restore(buf) {
    var f = unzip(buf), man = f['manifest.json'] ? JSON.parse(dec.decode(f['manifest.json'])) : null;
    if (!man || man.app !== 'RoyalBooks') throw new Error('هذا ليس ملف نسخة احتياطية صالحاً.');
    var list = jget('royal_books_list', []), byId = {}; list.forEach(function (b) { byId[b.id] = b; });
    var added = 0, updated = 0;
    Object.keys(f).forEach(function (name) {
      if (!/^books\/.+\.json$/.test(name)) return;
      var b = JSON.parse(dec.decode(f[name])); if (!b || !b.id) return;
      var cur = byId[b.id], curFull = cur && (typeof cur.text === 'string' || typeof cur.t === 'string');
      if (!cur) { byId[b.id] = b; added++; } else if (!curFull || (b.updatedAt || 0) > (cur.updatedAt || 0)) { byId[b.id] = b; updated++; }
    });
    localStorage.setItem('royal_books_list', JSON.stringify(Object.keys(byId).map(function (k) { return byId[k]; })));
    USER_KEYS.forEach(function (k) { var e = f['user/' + k + '.json']; if (e && localStorage.getItem(k) == null) localStorage.setItem(k, dec.decode(e)); });
    return { added: added, updated: updated };
  }

  // ───────── تنزيل + قائمة تصدير ─────────
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function fname(b, ext) { return (String(b.title || 'book').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || 'book') + '.' + ext; }
  function menu(book) {
    var old = document.getElementById('rx-menu'); if (old) { old.remove(); return; }
    var d = document.createElement('div'); d.id = 'rx-menu';
    d.style.cssText = 'position:fixed;top:56px;left:8px;z-index:2147483000;background:#1f1d16;color:#f3ecd2;border:1px solid #c9a227;border-radius:14px;padding:8px;box-shadow:0 10px 30px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:6px;direction:rtl;font:15px Amiri,serif';
    [['📗 تصدير EPUB (كتاب إلكتروني)', function () { download(buildEpub(book), fname(book, 'epub')); }],
     ['📘 تصدير DOCX (وورد)', function () { download(buildDocx(book), fname(book, 'docx')); }],
     ['🖨️ طباعة / حفظ PDF', function () { window.print(); }],
     ['💾 نسخة الكتاب (JSON)', function () { download(new Blob([JSON.stringify(book)], { type: 'application/json' }), fname(book, 'json')); }]
    ].forEach(function (x) {
      var b = document.createElement('button'); b.textContent = x[0];
      b.style.cssText = 'background:#2b281c;color:inherit;border:1px solid #5c5230;border-radius:9px;padding:9px 12px;font:inherit;cursor:pointer;text-align:right';
      b.onclick = function () { d.remove(); try { x[1](); } catch (e) { alert('تعذّر التصدير: ' + e.message); } }; d.appendChild(b);
    });
    document.body.appendChild(d);
    setTimeout(function () { document.addEventListener('click', function h(e) { if (!d.contains(e.target)) { d.remove(); document.removeEventListener('click', h); } }); }, 50);
  }

  g.RoyalExport = { menu: menu, buildEpub: buildEpub, buildDocx: buildDocx, backup: backup, restore: restore, download: download, zip: zip, unzip: unzip, chapters: chapters };
})(window);
