/**
 * auth.js — نظام إدارة المستخدمين والمزامنة
 * الإصدار المُصحَّح: v2
 * الإصلاحات:
 *   - [FIX] ختم updatedAt عند كل حفظ محلي للكتب والتصنيفات
 *   - [FIX] مزامنة تلقائية عند فتح الصفحة (إذا كان متصلاً وعضواً)
 *   - [FIX] منع تكرار المزامنة في نفس الجلسة
 *   - [FIX] تحديث localStorage بالبيانات المدمجة الكاملة من السيرفر
 */

const AUTH_CONFIG = {
    SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzVIL8_9oYVEfAIvIlzcQjz9SV1SR2Fni0k2Euo__92mtERHfiPJHnoxQKSkvYM5lB6/exec",
    GUEST_LIMIT: 1
};

// قراءة حالة المستخدم من الذاكرة المحلية
let currentUser = JSON.parse(localStorage.getItem('royal_user')) || {
    role: 'guest',
    id: 'guest_tmp',
    username: 'زائر'
};

// ─── [FIX] علم لمنع تكرار المزامنة في نفس الجلسة ─────────────────────────────
let _syncInProgress = false;
let _syncedThisSession = false;


// ══════════════════════════════════════════════════════
//  دوال الحفظ المحلي — تضمن دائماً وجود updatedAt
// ══════════════════════════════════════════════════════

/**
 * [FIX] احفظ كتاباً في localStorage مع ختم updatedAt تلقائياً.
 * استخدم هذه الدالة في كل مكان تحفظ فيه كتاباً محلياً.
 */
function saveBookLocally(book) {
    book.updatedAt = Date.now();   // ختم الوقت دائماً
    const books = JSON.parse(localStorage.getItem('royal_books_list') || '[]');
    const idx = books.findIndex(b => b.id === book.id);
    if (idx > -1) books[idx] = book;
    else books.push(book);
    localStorage.setItem('royal_books_list', JSON.stringify(books));
    return book;
}

/**
 * [FIX] احفظ تصنيفاً في localStorage مع ختم updatedAt تلقائياً.
 */
function saveCategoryLocally(category) {
    category.updatedAt = Date.now();
    const cats = JSON.parse(localStorage.getItem('royal_categories_list') || '[]');
    const idx = cats.findIndex(c => c.id === category.id);
    if (idx > -1) cats[idx] = category;
    else cats.push(category);
    localStorage.setItem('royal_categories_list', JSON.stringify(cats));
    return category;
}

/**
 * [FIX] احذف كتاباً من localStorage.
 */
function deleteBookLocally(bookId) {
    const books = JSON.parse(localStorage.getItem('royal_books_list') || '[]');
    localStorage.setItem('royal_books_list', JSON.stringify(books.filter(b => b.id !== bookId)));
}


// ══════════════════════════════════════════════════════
//  التحقق من الصلاحيات
// ══════════════════════════════════════════════════════

function canAddMoreBooks() {
    const booksCount = JSON.parse(localStorage.getItem('royal_books_list') || '[]').length;
    if (currentUser.role === 'guest') {
        return booksCount < AUTH_CONFIG.GUEST_LIMIT;
    }
    return true;
}


// ══════════════════════════════════════════════════════
//  تسجيل الخروج
// ══════════════════════════════════════════════════════

function logoutUser() {
    const hasPending = !!localStorage.getItem('pending_sync_book');
    const msg = hasPending
        ? "تنبيه: لديك تغييرات لم تُحفظ في السحابة بعد. هل تريد الخروج وفقدانها؟"
        : "هل أنت متأكد من تسجيل الخروج؟";

    if (confirm(msg)) {
        // مسح كل البيانات الشخصية عند الخروج
        const keysToRemove = [
            'royal_user', 'royal_books_list', 'royal_categories_list',
            'royal_notifications', 'royal_viewed_shares', 'royal_following',
            'royal_posts', 'royal_docs', 'royal_deleted_books',
            'royal_pending_profile_sync', 'royal_pending_posts_sync',
            'pending_sync_book', 'pending_sync_categories', 'hideSyncPrompt'
        ];
        keysToRemove.forEach(k => localStorage.removeItem(k));
        _syncedThisSession = false;
        window.location.href = 'index.html';
    }
}


// ══════════════════════════════════════════════════════
//  تحديث الواجهة
// ══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    // تحديث عناصر الواجهة
    const userDisplay = document.getElementById('userDisplayName');
    const authBtn     = document.getElementById('authActionBtn');

    if (userDisplay && authBtn) {
        if (currentUser.role === 'member') {
            userDisplay.innerText = `مرحباً، ${currentUser.username}`;
            authBtn.innerText  = "تسجيل الخروج";
            authBtn.onclick    = logoutUser;
        } else {
            userDisplay.innerText = "أنت تتصفح كزائر";
            authBtn.innerText  = "تسجيل الدخول / فتح حساب";
            authBtn.onclick    = () => window.location.href = 'login.html';
        }
    }

    // [FIX] مزامنة تلقائية صامتة عند فتح الصفحة إذا كان العضو متصلاً
    if (currentUser.role === 'member' && navigator.onLine && !_syncedThisSession) {
        await autoSyncSilently();
    }
});


// ══════════════════════════════════════════════════════
//  [FIX] مزامنة صامتة تلقائية (بدون نوافذ منبثقة)
// ══════════════════════════════════════════════════════

async function autoSyncSilently() {
    if (_syncInProgress || _syncedThisSession) return;
    _syncInProgress = true;

    const localBooks      = JSON.parse(localStorage.getItem('royal_books_list')      || '[]');
    const localCategories = JSON.parse(localStorage.getItem('royal_categories_list') || '[]');

    try {
        const response = await fetch(AUTH_CONFIG.SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action:          "sync_library",
                userId:          currentUser.id,
                userName:        currentUser.username,
                localBooks:      localBooks,
                localCategories: localCategories
            })
        });
        const result = await response.json();

        if (result.success) {
            // [FIX] حفظ البيانات المدمجة القادمة من السيرفر (تشمل ما في السحابة فقط)
            if (Array.isArray(result.mergedBooks)) {
                localStorage.setItem('royal_books_list', JSON.stringify(result.mergedBooks));
            }
            if (Array.isArray(result.mergedCategories)) {
                localStorage.setItem('royal_categories_list', JSON.stringify(result.mergedCategories));
            }
            localStorage.removeItem('pending_sync_book');
            localStorage.removeItem('pending_sync_categories');
            _syncedThisSession = true;
            console.log('✅ تمت المزامنة التلقائية بنجاح');
            if (typeof renderBooks === 'function') renderBooks();
        }

        // مزامنة بيانات الملف الشخصي
        await _syncProfileData();

        // مزامنة الإشعارات
        await _syncNotificationsFromCloud();

    } catch (error) {
        console.warn('⚠️ فشلت المزامنة التلقائية:', error);
    } finally {
        _syncInProgress = false;
    }
}

// مزامنة بيانات الحساب من السحابة
async function _syncProfileData() {
    try {
        const res  = await fetch(AUTH_CONFIG.SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login_refresh', userId: currentUser.id })
        });
        const data = await res.json();
        if (data.success && data.user) {
            // حفظ البيانات المحدَّثة مع الحفاظ على session
            const updated = Object.assign({}, currentUser, data.user);
            localStorage.setItem('royal_user', JSON.stringify(updated));
            currentUser = updated;
            // تحديث بطاقة المستخدم إن وُجدت
            if (typeof updateUserCard === 'function') updateUserCard();
        }
    } catch(_) {}
}

// جلب الإشعارات الجديدة من السحابة ودمجها
async function _syncNotificationsFromCloud() {
    try {
        const res  = await fetch(AUTH_CONFIG.SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_notifications', userId: currentUser.id })
        });
        const data = await res.json();
        if (!data.success) return;
        const local    = JSON.parse(localStorage.getItem('royal_notifications') || '[]');
        const localIds = new Set(local.map(n => n.id));
        const fresh    = (data.notifications || []).filter(n => !localIds.has(n.id));
        if (fresh.length) {
            const merged = [...fresh, ...local].slice(0, 200);
            localStorage.setItem('royal_notifications', JSON.stringify(merged));
            if (typeof renderNotifBadge === 'function') renderNotifBadge();
        }
    } catch(_) {}
}


// ══════════════════════════════════════════════════════
//  مراقبة حالة الإنترنت
// ══════════════════════════════════════════════════════

window.addEventListener('online', () => {
    if (currentUser.role !== 'member') return;

    // [FIX] إذا لم تحصل مزامنة في هذه الجلسة بعد → مزامنة صامتة أولاً
    if (!_syncedThisSession) {
        autoSyncSilently().then(() => {
            // بعد المزامنة الصامتة، اسأل عن المزامنة الكاملة
            showSyncPrompt();
        });
    } else {
        showSyncPrompt();
    }
});

window.addEventListener('offline', () => {
    console.log('📴 انقطع الاتصال — الموقع يعمل أوف لاين');
});


// ══════════════════════════════════════════════════════
//  نافذة المزامنة (يدوية)
// ══════════════════════════════════════════════════════

function showSyncPrompt() {
    if (localStorage.getItem('hideSyncPrompt') === 'true') return;
    if (document.getElementById('syncNotice')) return;   // لا تكرار

    const syncDiv = document.createElement('div');
    syncDiv.id = 'syncNotice';
    syncDiv.style.cssText = [
        "position:fixed", "bottom:20px", "left:20px",
        "background:white", "padding:20px", "border-radius:10px",
        "box-shadow:0 5px 15px rgba(0,0,0,0.3)", "z-index:10001",
        "border-right:5px solid #b8860b", "direction:rtl",
        "max-width:320px", "font-family:Amiri,serif"
    ].join(';');

    syncDiv.innerHTML = `
        <p style="margin:0 0 12px">أنت الآن متصل بالإنترنت، هل تريد مزامنة بياناتك مع السحابة؟</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="startSyncProcess()"
                style="background:#6B8E23;color:white;border:none;padding:6px 16px;border-radius:6px;cursor:pointer">
                نعم، زامن الآن
            </button>
            <button onclick="document.getElementById('syncNotice').remove()"
                style="background:#eee;border:none;padding:6px 16px;border-radius:6px;cursor:pointer">
                ليس الآن
            </button>
        </div>
        <label style="display:block;margin-top:12px;font-size:12px;color:#888;cursor:pointer">
            <input type="checkbox" id="noShowAgain"> لا تظهر هذه الرسالة مجدداً
        </label>
        <button onclick="saveSyncPreference()"
            style="margin-top:6px;font-size:11px;background:none;border:1px solid #ddd;border-radius:4px;padding:3px 10px;cursor:pointer">
            حفظ التفضيل
        </button>
    `;
    document.body.appendChild(syncDiv);
}

function saveSyncPreference() {
    if (document.getElementById('noShowAgain').checked) {
        localStorage.setItem('hideSyncPrompt', 'true');
    }
    document.getElementById('syncNotice')?.remove();
}


// ══════════════════════════════════════════════════════
//  [FIX] دالة المزامنة الكاملة (يدوية أو تلقائية)
// ══════════════════════════════════════════════════════

async function startSyncProcess() {
    if (_syncInProgress) return;
    _syncInProgress = true;

    const notice = document.getElementById('syncNotice');
    if (notice) notice.innerHTML = '<p style="margin:0">⏳ جاري المزامنة...</p>';

    const localBooks      = JSON.parse(localStorage.getItem('royal_books_list')      || '[]');
    const localCategories = JSON.parse(localStorage.getItem('royal_categories_list') || '[]');

    try {
        const response = await fetch(AUTH_CONFIG.SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action:          "sync_library",
                userId:          currentUser.id,
                userName:        currentUser.username,
                localBooks:      localBooks,
                localCategories: localCategories
            })
        });
        const result = await response.json();

        if (result.success) {
            // [FIX] حفظ النتيجة المدمجة — تشمل الكتب الموجودة في السحابة فقط أيضاً
            if (Array.isArray(result.mergedBooks)) {
                localStorage.setItem('royal_books_list', JSON.stringify(result.mergedBooks));
            }
            if (Array.isArray(result.mergedCategories)) {
                localStorage.setItem('royal_categories_list', JSON.stringify(result.mergedCategories));
            }
            localStorage.removeItem('pending_sync_book');
            localStorage.removeItem('pending_sync_categories');
            _syncedThisSession = true;

            alert("✅ تمت المزامنة بنجاح! تم تحديث الكتب والتصنيفات.");
            if (typeof renderBooks === 'function') renderBooks();
        } else {
            alert("⚠️ حدث خطأ أثناء المزامنة. حاول مجدداً.");
        }
    } catch (error) {
        console.error("خطأ في المزامنة:", error);
        alert("❌ فشلت المزامنة، تأكد من جودة الاتصال.");
    } finally {
        _syncInProgress = false;
        document.getElementById('syncNotice')?.remove();
    }
}
