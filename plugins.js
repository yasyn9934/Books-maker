/**
 * محرك الكتب الملكي - ملف الإضافات المركزي (plugins.js)
 * الإصدار: الماسي المعتمد (2026)
 */

const RoyalFeatures = {



    // 2. ميزة الاقتباسات الموثقة (نسخة الإصلاح التقني)
    advancedQuotes: {
        css: `
        .royal-quote-box { 
            margin: 0 auto 25px auto; /* ألغينا الهامش العلوي لضبط الارتفاع */
            padding: 20px 25px; 
            border: 1px solid rgba(184, 134, 11, 0.2);
            border-right: 8px solid #b8860b; 
            border-radius: 12px; 
            background-color: #fcfcfc;
            display: flex; 
            flex-direction: column; 
            gap: 15px; 
            max-width: 98%; 
            break-inside: avoid; /* تنبيه للمتصفح بعدم كسر الكتلة عند الطباعة */
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
            box-sizing: border-box;
        }
        .royal-quote-text { 
            font-size: 1.35em; 
            line-height: 1.8; 
            font-weight: bold; 
            font-family: 'Amiri', serif; 
            width: 100%;
            text-align: justify;
            color: #2c3e50;
        }
        .royal-quote-footer { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            border-top: 2.5px solid #b8860b;
            padding-top: 12px; 
            margin-top: 5px;
        }
        .royal-quote-source { 
            font-family: 'Aref Ruqaa', serif; 
            color: #4a3f35; 
            font-size: 1.1em;
            flex: 1;
            padding-left: 15px;
        }
        .royal-quote-qr-cell {
            border-right: 2.5px solid #b8860b;
            padding-right: 15px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .royal-quote-qr { width: 85px; height: 85px; background: #fff; padding: 4px; border-radius: 4px; }
        `,
        execute: function(text) {
            if (!text) return "";
            return text.replace(/\[«([\s\S]+?)»\]\{([\s\S]*?)\}\[اقتباس:\s*([\s\S]*?)\]/g, (match, quote, source, options) => {
                let bgColor = "#fcfcfc"; let qrHtml = "";
                let cleanOptions = options.replace(/<br>/gi, ' ');
                let cleanSource = source.replace(/<br>/gi, ' ');

                let docMatch = cleanOptions.match(/\(وثيقة\)\s*([^,\]]+)/);
                if (docMatch) {
                    let url = docMatch[1].trim();
                    if (url && !url.startsWith('http')) url = 'https://' + url;
                    let qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
                    qrHtml = `<div class="royal-quote-qr-cell"><img src="${qrUrl}" class="royal-quote-qr" /><span style="font-size:0.7em; color:#b8860b; font-weight:bold; margin-top:5px;">وثيقة الاقتباس</span></div>`;
                }

                return `<div class="royal-quote-box"><div class="royal-quote-text">&#171; ${quote} &#187;</div><div class="royal-quote-footer"><div class="royal-quote-source"><b>المصدر:</b><br>${cleanSource}</div>${qrHtml}</div></div>`;
            });
        }
    },




    // 3. ميزة التنسيق المخصص للنصوص
    advancedFormatting: {
        css: "",
        execute: function(text) {
            if (!text) return "";
            return text.replace(/\{([^}]+)\}\[تنسيق:\s*([^\]]+)\]/g, (match, content, formats) => {
                let styles = [];
                let fontMatch = formats.match(/\(خط\)\s*([^,]+)/);
                if (fontMatch) styles.push(`font-family: '${fontMatch[1].trim()}', serif`);

                let colorMatch = formats.match(/\(لون\)\s*([a-zA-Z0-9#]+)/);
                if (colorMatch) {
                    let colorVal = colorMatch[1].trim();
                    if (!colorVal.startsWith('#')) colorVal = '#' + colorVal;
                    styles.push(`color: ${colorVal}`);
                }

                let decoMatch = formats.match(/\(تمييز النص\)\s*([^,\]]+)/);
                if (decoMatch) {
                    let decos = decoMatch[1].split('+');
                    let textDecoration = [];
                    decos.forEach(d => {
                        let t = d.trim();
                        if (t === 'سميك') styles.push('font-weight: bold');
                        if (t === 'مائل') styles.push('font-style: italic');
                        if (t === 'خط أسفل') textDecoration.push('underline');
                        if (t === 'مشطوب') textDecoration.push('line-through');
                        if (t === 'خط أعلى') textDecoration.push('overline');
                    });
                    if (textDecoration.length > 0) styles.push(`text-decoration: ${textDecoration.join(' ')}`);
                }

                return `<span style="${styles.join('; ')}">${content}</span>`;
            });
        }
    },

    // 4. ميزة الزخارف والأنماط (Page Themes)
    themes: {
        css: `
        .style-islamic { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="353" viewBox="0 0 250 353"><rect x="15" y="15" width="220" height="323" fill="none" stroke="%23b8860b" stroke-width="1.5" opacity="0.5"/><path d="M15,40 L40,15 M235,40 L210,15 M15,313 L40,338 M235,313 L210,338" stroke="%23b8860b" stroke-width="1.5" opacity="0.5"/></svg>'); background-size: 100% 100%; }
        .style-classic { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="353" viewBox="0 0 250 353"><rect x="10" y="10" width="230" height="333" fill="none" stroke="%234a3f35" stroke-width="1" opacity="0.6"/><rect x="15" y="15" width="220" height="323" fill="none" stroke="%234a3f35" stroke-width="0.5" opacity="0.6"/><circle cx="15" cy="15" r="2.5" fill="%234a3f35" opacity="0.6"/><circle cx="235" cy="15" r="2.5" fill="%234a3f35" opacity="0.6"/><circle cx="15" cy="338" r="2.5" fill="%234a3f35" opacity="0.6"/><circle cx="235" cy="338" r="2.5" fill="%234a3f35" opacity="0.6"/></svg>'); background-size: 100% 100%; }
        .style-floral { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="353" viewBox="0 0 250 353"><g fill="none" stroke="%236B8E23" stroke-width="0.8" opacity="0.4"><path d="M20,40 Q20,20 40,20 T80,20 M20,40 Q20,60 20,80" /><path d="M230,40 Q230,20 210,20 T170,20 M230,40 Q230,60 230,80" /><path d="M20,313 Q20,333 40,333 T80,333 M20,313 Q20,293 20,273" /><path d="M230,313 Q230,333 210,333 T170,333 M230,313 Q230,293 230,273" /></g></svg>'); background-size: 100% 100%; }
        .style-royal { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="353" viewBox="0 0 250 353"><rect x="10" y="10" width="230" height="333" rx="2" stroke="%23b8860b" stroke-width="1" fill="none" opacity="0.3"/><rect x="15" y="15" width="220" height="323" rx="1" stroke="%23b8860b" stroke-width="0.5" fill="none" opacity="0.2"/></svg>'); background-size: 100% 100%; }
        .style-minimal { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="353" viewBox="0 0 250 353"><g fill="%236B8E23" opacity="0.2"><circle cx="15" cy="176" r="2"/><circle cx="235" cy="176" r="2"/></g></svg>'); background-size: 100% 100%; }
        .style-clean { background-image: none !important; }
        `,
        execute: function(text) { return text; } 
    },

    // 5. ميزة الفهرس والحواشي السفلية
    tocAndFootnotes: {
        css: `
        .toc-title { font-family: 'Aref Ruqaa'; font-size: 40pt; text-align: center; color: #b8860b; margin-bottom: 40px; padding-bottom: 15px; border-bottom: 2px solid #b8860b; }
        .toc-item { font-size: 18pt; margin-bottom: 18px; display: flex; justify-content: space-between; position: relative; }
        .toc-item::after { content: "............................................................................................................................................"; position: absolute; left: 0; right: 0; bottom: 5px; z-index: -1; color: #aaa; overflow: hidden; white-space: nowrap; }
        .toc-text { background: var(--global-page-bg); padding-right: 15px; color: #2c3e50; font-weight: bold; }
        .toc-page { background: var(--global-page-bg); padding-left: 15px; font-weight: bold; color: #6B8E23; }
        .footnote-ref { color: #8a1414; font-size: 0.78em; vertical-align: super; font-weight: bold; line-height: 0; }
        `,
        // [ميزة الحواشي الاحترافية] لم يعد يُدرَج رقم نهائي هنا — فرقم/مصير الحاشية (قد تُرحَّل
        // لصفحة أخرى أو تُقسَّم) لا يُحسم إلا لاحقاً عبر محرك الصفحات في editor.html. هنا فقط
        // نُنشئ معرّفاً فريداً ورابط علامة قابلة للنقر (تُملأ برقمها ⑴⑵⑶... لاحقاً)، وندفع
        // كائن {id, text} (وليس نصاً خاماً) إلى footnoteList.
        execute: function(text, footnoteList) {
            if (!text) return "";
            if (!footnoteList) return text;
            return text.replace(/\(\((.*?)\)\)/g, (match, content) => {
                const uid = 'fn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                footnoteList.push({ id: uid, text: content });
                return `<sup class="footnote-ref"><a href="#fnbody-${uid}" id="fnref-${uid}" class="footnote-marker-link" data-fn-pending="${uid}" onclick="return jumpToFootnote(event,'fnbody-${uid}')"></a></sup>`;
            });
        }
    },

    // 6. ميزة الرموز الإسلامية
    islamicSymbols: {
        css: ".islamic-symbol { font-family: 'Aref Ruqaa'; color: #b8860b; font-size: 1.2em; }",
        execute: function(text) {
            if (!text) return "";
            let res = text.replace(/\(صل\)/g, '<span class="islamic-symbol">ﷺ</span>');
            res = res.replace(/\(جل\)/g, '<span class="islamic-symbol">ﷻ</span>');
            res = res.replace(/\(رض\)/g, '<span style="font-size: 0.8em; color: #555;">رضي الله عنه</span>');
            res = res.replace(/\(رح\)/g, '<span style="font-size: 0.8em; color: #555;">رحمه الله</span>');
            return res;
        }
    },

    // 7. ميزة الأقواس المقدسة والتنصيص
    brackets: {
        css: `
        .gold-bracket { color: #b8860b; font-weight: bold; }
        .quran-text { color: #2c5e2e; font-weight: bold; }
        .quote-text { color: #0077be; font-weight: bold; }
        `,
        execute: function(text) {
            if (!text) return "";
            let res = text.replace(/(﴿)(.*?)(﴾)/g, '<span class="gold-bracket">$1</span><span class="quran-text">$2</span><span class="gold-bracket">$3</span>');
            res = res.replace(/(«)(.*?)(»)/g, '<span class="gold-bracket">$1</span><span class="quote-text">$2</span><span class="gold-bracket">$3</span>');
            return res;
        }
    },

    // 8. ميزة الفواصل الذهبية
    dividers: {
        css: ".gold-divider { color: #b8860b; font-weight: bold; display: block; text-align: center; margin: 10px 0; }",
        execute: function(text) {
            if (!text) return "";
            return text.replace(/([•]*[ـ]{3,}[•]*)/g, '<span class="gold-divider">$1</span>');
        }
    },

    // 9. ميزة الوسائط الذكية
    smartMedia: {
        css: ".smart-link { color: #1E90FF; text-decoration: none; }", 
        execute: function(text) {
            if (!text) return "";
            let res = text.replace(/\{([^}]+)\}\[حجم:\s*(\d+)\]/g, '<span style="font-size: $2pt">$1</span>');
            res = res.replace(/\{([^}]+)\}\[رابط:\s*([^\]]+)\]/g, (match, content, url) => {
                let link = url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim();
                return `<a href="${link}" target="_blank" class="smart-link">${content}</a>`;
            });
            res = res.replace(/\{(\d+)\}\[صورة:\s*([^\]]+)\]/g, '<img src="$2" style="width: $1px; max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 15px auto;" />');
            return res;
        }
    },

    // 10. ميزة العناوين الداخلية الملكية
    inlineHeaders: {
        css: ".inline-header { font-family: 'Aref Ruqaa'; font-size: 34pt; color: #4a3f35; display: block; text-align: center; margin: 20px 0; line-height: 1.2; }",
        execute: function(text) {
            if (!text) return "";
            let res = text.replace(/\+\-(.*?)\-\+/g, '<span class="inline-header">$1</span>');
            res = res.replace(/\+(.*?)\+/g, '<span class="inline-header">$1</span>');
            return res;
        }
    },

    // 11. ميزة الألوان الشاملة والخلفيات
    colorsAndBackgrounds: {
        css: ".color-box { padding: 2px 5px; border-radius: 4px; }",
        execute: function(text) {
            if (!text) return "";
            const colorMap = { '🟢': '#2c5e2e', '🔴': '#d32f2f', '🟠': '#ef6c00', '🟡': '#fbc02d', '🔵': '#1976d2', '🟣': '#7b1fa2', '🟤': '#5d4037', '⚫': '#000000', '⚪': '#ffffff' };
            const bgMap = { '🟩': '#c8e6c9', '🟥': '#ffcdd2', '🟧': '#ffe0b2', '🟨': '#fff9c4', '🟦': '#bbdefb', '🟪': '#e1bee7', '🟫': '#d7ccc8', '⬛': '#333333', '⬜': '#ffffff' };
            let res = text;
            Object.keys(colorMap).forEach(e => { res = res.replace(new RegExp(`${e}(.*?)${e}`, 'g'), `<span style="color:${colorMap[e]}">$1</span>`); });
            Object.keys(bgMap).forEach(e => { res = res.replace(new RegExp(`${e}(.*?)${e}`, 'g'), `<span class="color-box" style="background-color:${bgMap[e]}">$1</span>`); });
            return res;
        }
    }
};
