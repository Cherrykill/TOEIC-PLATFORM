// ============================================================
// NAV GROUP TOGGLE (collapsible sidebar sections)
// ============================================================
function initNavGroups() {
    document.querySelectorAll('.nav-group-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const group = toggle.dataset.group;
            const items = document.getElementById('nav-group-' + group);
            const isOpen = toggle.classList.contains('open');
            toggle.classList.toggle('open', !isOpen);
            items.classList.toggle('open', !isOpen);
        });
    });
}

function openGroupForTab(tab) {
    const link = document.querySelector('.sidebar-link[data-main-tab="' + tab + '"]');
    if (!link) return;
    const items = link.closest('.nav-group-items');
    if (!items) return;
    items.classList.add('open');
    const toggle = items.previousElementSibling;
    if (toggle) toggle.classList.add('open');
}

// ============================================================
// ACHIEVEMENT DEFINITIONS CRUD
// ============================================================
async function loadAchievements() {
    const tbody = document.getElementById('achievements-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    try {
        const res = await fetch(API_URL + '/admin/achievements', { headers: { Authorization: 'Bearer ' + getToken() } });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        const defs = data.data || [];
        if (!defs.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-secondary)">Chưa có thành tích nào. Bấm "Thêm thành tích" để bắt đầu.</td></tr>';
            return;
        }
        tbody.innerHTML = defs.map(d =>
            '<tr>' +
            '<td style="font-size:20px;text-align:center">' + (d.icon || '🏆') + '</td>' +
            '<td><strong>' + d.name + '</strong><br><small style="color:var(--text-secondary)">' + d.code + '</small></td>' +
            '<td><span class="badge neutral">' + d.category + '</span></td>' +
            '<td style="font-size:12px">' + d.conditionType + ' &ge; ' + d.conditionValue + (d.conditionMode ? ' [' + d.conditionMode + ']' : '') + '</td>' +
            '<td style="font-size:12px">XP:' + (d.rewardXp||0) + ' 🪙' + (d.rewardCoins||0) + ' 💎' + (d.rewardGems||0) + '</td>' +
            '<td>' + (d.isActive ? '<span class="badge success">Bật</span>' : '<span class="badge neutral">Tắt</span>') + '</td>' +
            '<td>' +
              '<button class="btn btn-ghost btn-sm btn-ach-edit" data-id="' + d._id + '" title="Sửa"><i class="fas fa-edit"></i></button> ' +
              '<button class="btn btn-danger btn-sm btn-ach-delete" data-id="' + d._id + '" data-name="' + d.name + '" title="Xóa"><i class="fas fa-trash"></i></button>' +
            '</td></tr>'
        ).join('');
        attachAchievementListeners();
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--danger)">' + err.message + '</td></tr>';
    }
}

function openAchievementModal(data) {
    data = data || {};
    document.getElementById('ach-id').value = data._id || '';
    document.getElementById('ach-modal-title').textContent = data._id ? 'Sửa thành tích' : 'Thêm thành tích';
    document.getElementById('ach-name').value = data.name || '';
    document.getElementById('ach-code').value = data.code || '';
    document.getElementById('ach-icon').value = data.icon || '';
    document.getElementById('ach-desc').value = data.description || '';
    document.getElementById('ach-category').value = data.category || 'learning';
    document.getElementById('ach-cond-type').value = data.conditionType || '';
    document.getElementById('ach-cond-value').value = data.conditionValue || 0;
    document.getElementById('ach-cond-mode').value = data.conditionMode || '';
    document.getElementById('ach-xp').value = data.rewardXp || 0;
    document.getElementById('ach-coins').value = data.rewardCoins || 0;
    document.getElementById('ach-gems').value = data.rewardGems || 0;
    document.getElementById('ach-order').value = data.order || 0;
    document.getElementById('ach-active').checked = data.isActive !== false;
    document.getElementById('achievement-modal').style.display = 'flex';
}

function attachAchievementListeners() {
    document.querySelectorAll('.btn-ach-edit').forEach(function(btn) {
        btn.onclick = async function() {
            const res = await fetch(API_URL + '/admin/achievements/' + btn.dataset.id, { headers: { Authorization: 'Bearer ' + getToken() } });
            const data = await res.json();
            if (data.success) openAchievementModal(data.data);
        };
    });
    document.querySelectorAll('.btn-ach-delete').forEach(function(btn) {
        btn.onclick = async function() {
            if (!confirm('Xóa thành tích "' + btn.dataset.name + '"?')) return;
            const res = await fetch(API_URL + '/admin/achievements/' + btn.dataset.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + getToken() } });
            const data = await res.json();
            showToast(data.message || 'Đã xóa', data.success ? 'success' : 'error');
            if (data.success) loadAchievements();
        };
    });
}

function initAchievementModal() {
    const btnAdd = document.getElementById('btn-add-achievement');
    if (btnAdd) btnAdd.addEventListener('click', function() { openAchievementModal(); });

    const btnCancel = document.getElementById('btn-ach-cancel');
    if (btnCancel) btnCancel.addEventListener('click', function() { document.getElementById('achievement-modal').style.display = 'none'; });

    const form = document.getElementById('achievement-form');
    if (form) form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const id = document.getElementById('ach-id').value;
        const payload = {
            name: document.getElementById('ach-name').value,
            code: document.getElementById('ach-code').value,
            icon: document.getElementById('ach-icon').value,
            description: document.getElementById('ach-desc').value,
            category: document.getElementById('ach-category').value,
            conditionType: document.getElementById('ach-cond-type').value,
            conditionValue: Number(document.getElementById('ach-cond-value').value),
            conditionMode: document.getElementById('ach-cond-mode').value || undefined,
            rewardXp: Number(document.getElementById('ach-xp').value),
            rewardCoins: Number(document.getElementById('ach-coins').value),
            rewardGems: Number(document.getElementById('ach-gems').value),
            order: Number(document.getElementById('ach-order').value),
            isActive: document.getElementById('ach-active').checked,
        };
        const url = id ? API_URL + '/admin/achievements/' + id : API_URL + '/admin/achievements';
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        showToast(data.message || (id ? 'Đã cập nhật' : 'Đã tạo'), data.success ? 'success' : 'error');
        if (data.success) { document.getElementById('achievement-modal').style.display = 'none'; loadAchievements(); }
    });
}

// ============================================================
// QUEST DEFINITIONS CRUD
// ============================================================
async function loadQuests() {
    const tbody = document.getElementById('quests-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    try {
        const res = await fetch(API_URL + '/admin/quests', { headers: { Authorization: 'Bearer ' + getToken() } });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        const defs = data.data || [];
        if (!defs.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-secondary)">Chưa có nhiệm vụ nào. Bấm "Thêm nhiệm vụ" để bắt đầu.</td></tr>';
            return;
        }
        tbody.innerHTML = defs.map(d =>
            '<tr>' +
            '<td style="font-size:20px;text-align:center">' + (d.icon || '⚔️') + '</td>' +
            '<td><strong>' + d.name + '</strong><br><small style="color:var(--text-secondary)">' + d.code + '</small></td>' +
            '<td><span class="badge ' + (d.type === 'daily' ? 'success' : 'neutral') + '">' + d.type + '</span></td>' +
            '<td>' + (d.mode || 'any') + '</td>' +
            '<td>' + d.target + '</td>' +
            '<td style="font-size:12px">XP:' + (d.rewardXp||0) + ' 🪙' + (d.rewardCoins||0) + '</td>' +
            '<td>' + (d.isActive ? '<span class="badge success">Bật</span>' : '<span class="badge neutral">Tắt</span>') + '</td>' +
            '<td>' +
              '<button class="btn btn-ghost btn-sm btn-quest-edit" data-id="' + d._id + '" title="Sửa"><i class="fas fa-edit"></i></button> ' +
              '<button class="btn btn-danger btn-sm btn-quest-delete" data-id="' + d._id + '" data-name="' + d.name + '" title="Xóa"><i class="fas fa-trash"></i></button>' +
            '</td></tr>'
        ).join('');
        attachQuestListeners();
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--danger)">' + err.message + '</td></tr>';
    }
}

function openQuestModal(data) {
    data = data || {};
    document.getElementById('quest-id').value = data._id || '';
    document.getElementById('quest-modal-title').textContent = data._id ? 'Sửa nhiệm vụ' : 'Thêm nhiệm vụ';
    document.getElementById('quest-name').value = data.name || '';
    document.getElementById('quest-code').value = data.code || '';
    document.getElementById('quest-icon').value = data.icon || '';
    document.getElementById('quest-desc').value = data.description || '';
    document.getElementById('quest-type').value = data.type || 'daily';
    document.getElementById('quest-mode').value = data.mode || 'any';
    document.getElementById('quest-target').value = data.target || 3;
    document.getElementById('quest-weight').value = data.weight || 1;
    document.getElementById('quest-xp').value = data.rewardXp || 0;
    document.getElementById('quest-coins').value = data.rewardCoins || 0;
    document.getElementById('quest-active').checked = data.isActive !== false;
    document.getElementById('quest-modal').style.display = 'flex';
}

function attachQuestListeners() {
    document.querySelectorAll('.btn-quest-edit').forEach(function(btn) {
        btn.onclick = async function() {
            const res = await fetch(API_URL + '/admin/quests/' + btn.dataset.id, { headers: { Authorization: 'Bearer ' + getToken() } });
            const data = await res.json();
            if (data.success) openQuestModal(data.data);
        };
    });
    document.querySelectorAll('.btn-quest-delete').forEach(function(btn) {
        btn.onclick = async function() {
            if (!confirm('Xóa nhiệm vụ "' + btn.dataset.name + '"?')) return;
            const res = await fetch(API_URL + '/admin/quests/' + btn.dataset.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + getToken() } });
            const data = await res.json();
            showToast(data.message || 'Đã xóa', data.success ? 'success' : 'error');
            if (data.success) loadQuests();
        };
    });
}

function initQuestModal() {
    const btnAdd = document.getElementById('btn-add-quest');
    if (btnAdd) btnAdd.addEventListener('click', function() { openQuestModal(); });

    const btnCancel = document.getElementById('btn-quest-cancel');
    if (btnCancel) btnCancel.addEventListener('click', function() { document.getElementById('quest-modal').style.display = 'none'; });

    const form = document.getElementById('quest-form');
    if (form) form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const id = document.getElementById('quest-id').value;
        const payload = {
            name: document.getElementById('quest-name').value,
            code: document.getElementById('quest-code').value,
            icon: document.getElementById('quest-icon').value,
            description: document.getElementById('quest-desc').value,
            type: document.getElementById('quest-type').value,
            mode: document.getElementById('quest-mode').value,
            target: Number(document.getElementById('quest-target').value),
            weight: Number(document.getElementById('quest-weight').value),
            rewardXp: Number(document.getElementById('quest-xp').value),
            rewardCoins: Number(document.getElementById('quest-coins').value),
            isActive: document.getElementById('quest-active').checked,
        };
        const url = id ? API_URL + '/admin/quests/' + id : API_URL + '/admin/quests';
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        showToast(data.message || (id ? 'Đã cập nhật' : 'Đã tạo'), data.success ? 'success' : 'error');
        if (data.success) { document.getElementById('quest-modal').style.display = 'none'; loadQuests(); }
    });
}

// ============================================================
// SHOP ITEMS CRUD
// ============================================================
var SHOP_CAT = { energy:'⚡ Năng lượng', resource:'🎒 Tài nguyên', boost:'🚀 Tăng tốc', exchange:'💱 Đổi gems', bundle:'🎁 Combo', vip:'👑 VIP' };

function _shopPriceHtml(d) {
    var icon = d.currency === 'gems' ? '💎' : '🪙';
    if (d.discountPercent > 0) {
        var sale = Math.floor(d.price * (1 - d.discountPercent / 100));
        return '<s style="color:var(--text-secondary);font-size:11px">' + icon + ' ' + d.price + '</s> ' +
               '<strong style="color:var(--danger)">' + icon + ' ' + sale + '</strong> ' +
               '<span class="badge" style="background:#fee2e2;color:#dc2626;font-size:10px">-' + d.discountPercent + '%</span>';
    }
    return icon + ' ' + d.price;
}

function _shopEffectSummary(effect) {
    if (!effect) return '–';
    try {
        switch (effect.type) {
            case 'energy':    return '⚡ +' + effect.amount + ' năng lượng';
            case 'hints':     return '💡 +' + effect.amount + ' gợi ý';
            case 'shield':    return '🛡️ +' + effect.amount + ' khiên';
            case 'timeFreeze':return '⏸️ +' + effect.amount + ' dừng thời gian';
            case 'coins':     return '🪙 +' + effect.amount + ' coins';
            case 'gems':      return '💎 +' + effect.amount + ' gems';
            case 'boost':     return '🚀 x' + effect.multiplier + ' ' + effect.boostType.toUpperCase() + ' / ' + (effect.duration / 3600) + 'h';
            case 'vip':       return '👑 VIP ' + (effect.duration / 86400) + ' ngày';
            case 'combo':     return '🎁 Combo ' + (effect.items || []).length + ' hiệu ứng';
            default:          return effect.type;
        }
    } catch(e) { return '?'; }
}

async function loadShopItems() {
    var tbody = document.getElementById('shop-tbody');
    tbody.innerHTML = '<tr><td colspan="9" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    try {
        var res = await fetch(API_URL + '/admin/shop-items', { headers: { Authorization: 'Bearer ' + getToken() } });
        var data = await res.json();
        if (!data.success) throw new Error(data.message);
        var items = data.data || [];
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-secondary)">Chưa có item nào.</td></tr>';
            return;
        }
        tbody.innerHTML = items.map(function(d) {
            var icon = d.currency === 'gems' ? '💎' : '🪙';
            var saleTd;
            if (d.discountPercent > 0) {
                var sale = Math.floor(d.price * (1 - d.discountPercent / 100));
                saleTd = '<strong style="color:var(--danger)">' + icon + ' ' + sale + '</strong> ' +
                         '<span class="badge" style="background:#fee2e2;color:#dc2626;font-size:10px">-' + d.discountPercent + '%</span>';
            } else {
                saleTd = '<span style="color:var(--text-secondary)">–</span>';
            }
            return '<tr>' +
                '<td style="font-size:20px;text-align:center">' + (d.icon || '🛒') + '</td>' +
                '<td><strong>' + d.name + '</strong><br><small style="color:var(--text-secondary);font-family:monospace">' + d.itemId + '</small></td>' +
                '<td><span class="badge neutral">' + (SHOP_CAT[d.category] || d.category) + '</span></td>' +
                '<td>' + icon + ' ' + d.price + '</td>' +
                '<td>' + saleTd + '</td>' +
                '<td style="font-size:12px">' + _shopEffectSummary(d.effect) + '</td>' +
                '<td style="text-align:center">' + (d.order || 0) + '</td>' +
                '<td>' + (d.isActive ? '<span class="badge success">Bật</span>' : '<span class="badge neutral">Tắt</span>') + '</td>' +
                '<td>' +
                  '<button class="btn btn-ghost btn-sm btn-shop-edit" data-id="' + d._id + '" title="Sửa"><i class="fas fa-edit"></i></button> ' +
                  '<button class="btn btn-danger btn-sm btn-shop-delete" data-id="' + d._id + '" data-name="' + d.name + '" title="Xóa"><i class="fas fa-trash"></i></button>' +
                '</td></tr>';
        }).join('');
        attachShopListeners();
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--danger)">' + err.message + '</td></tr>';
    }
}

function _shopShowEffectSection(category) {
    document.querySelectorAll('.effect-section').forEach(function(el) { el.style.display = 'none'; });
    var map = { energy:'effect-energy', resource:'effect-resource', boost:'effect-boost', exchange:'effect-exchange', bundle:'effect-bundle', vip:'effect-vip' };
    var target = document.getElementById(map[category]);
    if (target) target.style.display = 'block';
}

function _shopUpdatePricePreview() {
    var price    = Number(document.getElementById('shop-price').value) || 0;
    var discount = Number(document.getElementById('shop-discount').value) || 0;
    var currency = document.getElementById('shop-currency').value;
    var icon     = currency === 'gems' ? '💎' : '🪙';
    var el       = document.getElementById('shop-price-preview');
    if (discount > 0 && discount <= 100) {
        var sale = Math.floor(price * (1 - discount / 100));
        el.innerHTML = 'Giá sau giảm: <s style="color:var(--text-secondary)">' + icon + ' ' + price + '</s> → <strong style="color:var(--danger)">' + icon + ' ' + sale + '</strong> (tiết kiệm ' + icon + ' ' + (price - sale) + ')';
    } else {
        el.textContent = discount === 0 ? '' : 'Giảm giá không hợp lệ (0–100)';
    }
}

function _shopBuildEffect(category) {
    switch (category) {
        case 'energy':
            return { type: 'energy', amount: Number(document.getElementById('eff-energy-amount').value) };
        case 'resource':
            return { type: document.getElementById('eff-res-type').value, amount: Number(document.getElementById('eff-res-amount').value) };
        case 'boost':
            return { type: 'boost', boostType: document.getElementById('eff-boost-type').value,
                     multiplier: Number(document.getElementById('eff-boost-mult').value),
                     duration: Math.round(Number(document.getElementById('eff-boost-hours').value) * 3600) };
        case 'exchange':
            return { type: 'gems', amount: Number(document.getElementById('eff-exchange-amount').value) };
        case 'vip':
            return { type: 'vip', duration: Number(document.getElementById('eff-vip-days').value) * 86400 };
        case 'bundle': {
            var raw = document.getElementById('eff-bundle-json').value.trim();
            try {
                var parsed = JSON.parse(raw);
                document.getElementById('eff-bundle-err').textContent = '';
                return parsed;
            } catch(e) {
                document.getElementById('eff-bundle-err').textContent = 'JSON lỗi: ' + e.message;
                return null;
            }
        }
    }
    return null;
}

function _shopFillEffectFields(category, effect) {
    if (!effect) return;
    switch (category) {
        case 'energy':
            document.getElementById('eff-energy-amount').value = effect.amount || 100;
            break;
        case 'resource':
            document.getElementById('eff-res-type').value   = effect.type || 'hints';
            document.getElementById('eff-res-amount').value = effect.amount || 10;
            break;
        case 'boost':
            document.getElementById('eff-boost-type').value  = effect.boostType || 'xp';
            document.getElementById('eff-boost-mult').value  = effect.multiplier || 2;
            document.getElementById('eff-boost-hours').value = effect.duration ? (effect.duration / 3600) : 3;
            break;
        case 'exchange':
            document.getElementById('eff-exchange-amount').value = effect.amount || 10;
            break;
        case 'vip':
            document.getElementById('eff-vip-days').value = effect.duration ? Math.round(effect.duration / 86400) : 7;
            break;
        case 'bundle':
            document.getElementById('eff-bundle-json').value = JSON.stringify(effect, null, 2);
            break;
    }
}

function openShopModal(data) {
    data = data || {};
    var isEdit = !!data._id;
    document.getElementById('shop-id').value              = data._id || '';
    document.getElementById('shop-modal-title').textContent = isEdit ? 'Sửa item' : 'Thêm item';
    document.getElementById('shop-name').value            = data.name || '';
    document.getElementById('shop-item-id').value         = data.itemId || '';
    document.getElementById('shop-item-id').readOnly      = isEdit;
    document.getElementById('shop-item-id').style.opacity = isEdit ? '0.6' : '1';
    document.getElementById('shop-icon').value            = data.icon || '';
    document.getElementById('shop-desc').value            = data.description || '';
    document.getElementById('shop-currency').value        = data.currency || 'coins';
    document.getElementById('shop-price').value           = data.price || 0;
    document.getElementById('shop-discount').value        = data.discountPercent || 0;
    document.getElementById('shop-order').value           = data.order || 0;
    document.getElementById('shop-active').checked        = data.isActive !== false;

    var category = data.category || 'resource';
    document.getElementById('shop-category').value = category;
    _shopShowEffectSection(category);
    _shopFillEffectFields(category, data.effect || null);
    _shopUpdatePricePreview();

    document.getElementById('shop-modal').style.display = 'flex';
}

function attachShopListeners() {
    document.querySelectorAll('.btn-shop-edit').forEach(function(btn) {
        btn.onclick = async function() {
            var res = await fetch(API_URL + '/admin/shop-items/' + btn.dataset.id, { headers: { Authorization: 'Bearer ' + getToken() } });
            var data = await res.json();
            if (data.success) openShopModal(data.data);
        };
    });
    document.querySelectorAll('.btn-shop-delete').forEach(function(btn) {
        btn.onclick = async function() {
            if (!confirm('Xóa item "' + btn.dataset.name + '"?')) return;
            var res = await fetch(API_URL + '/admin/shop-items/' + btn.dataset.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + getToken() } });
            var data = await res.json();
            showToast(data.message || 'Đã xóa', data.success ? 'success' : 'error');
            if (data.success) loadShopItems();
        };
    });
}

function initShopModal() {
    var btnAdd = document.getElementById('btn-add-shop-item');
    if (btnAdd) btnAdd.addEventListener('click', function() { openShopModal(); });

    var btnCancel = document.getElementById('btn-shop-cancel');
    if (btnCancel) btnCancel.addEventListener('click', function() { document.getElementById('shop-modal').style.display = 'none'; });

    // Dynamic effect section on category change
    var catSel = document.getElementById('shop-category');
    if (catSel) catSel.addEventListener('change', function() { _shopShowEffectSection(this.value); });

    // Real-time price preview
    ['shop-price', 'shop-discount', 'shop-currency'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', _shopUpdatePricePreview);
    });

    var form = document.getElementById('shop-form');
    if (!form) return;
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var id       = document.getElementById('shop-id').value;
        var category = document.getElementById('shop-category').value;
        var effect   = _shopBuildEffect(category);
        if (effect === null) { showToast('Effect không hợp lệ, kiểm tra lại JSON', 'error'); return; }

        var payload = {
            itemId:          document.getElementById('shop-item-id').value.trim(),
            name:            document.getElementById('shop-name').value.trim(),
            description:     document.getElementById('shop-desc').value.trim(),
            icon:            document.getElementById('shop-icon').value.trim(),
            category:        category,
            currency:        document.getElementById('shop-currency').value,
            price:           Number(document.getElementById('shop-price').value),
            discountPercent: Number(document.getElementById('shop-discount').value) || 0,
            order:           Number(document.getElementById('shop-order').value),
            effect:          effect,
            isActive:        document.getElementById('shop-active').checked,
        };
        var url = id ? API_URL + '/admin/shop-items/' + id : API_URL + '/admin/shop-items';
        var res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        var data = await res.json();
        showToast(data.message || (id ? 'Đã cập nhật' : 'Đã tạo'), data.success ? 'success' : 'error');
        if (data.success) { document.getElementById('shop-modal').style.display = 'none'; loadShopItems(); }
    });
}

// ============================================================
// API REFERENCE
// ============================================================
var API_ENDPOINTS = [
    // Auth
    { method:'POST', path:'/api/auth/login',               desc:'Đăng nhập',                         group:'auth', auth:false },
    { method:'POST', path:'/api/auth/register',            desc:'Đăng ký trực tiếp',                  group:'auth', auth:false },
    { method:'POST', path:'/api/auth/send-register-otp',   desc:'Gửi OTP đăng ký',                    group:'auth', auth:false },
    { method:'POST', path:'/api/auth/verify-register-otp', desc:'Xác minh OTP và tạo tài khoản',      group:'auth', auth:false },
    { method:'POST', path:'/api/auth/forgot-password',     desc:'Quên mật khẩu — gửi OTP',            group:'auth', auth:false },
    { method:'POST', path:'/api/auth/reset-password',      desc:'Đặt lại mật khẩu',                   group:'auth', auth:false },
    { method:'POST', path:'/api/auth/check-lock',          desc:'Kiểm tra khóa tài khoản',             group:'auth', auth:false },
    { method:'GET',  path:'/api/auth/me',                  desc:'Lấy thông tin user hiện tại',         group:'auth', auth:true  },
    { method:'PUT',  path:'/api/auth/profile',             desc:'Cập nhật profile',                    group:'auth', auth:true  },
    { method:'PUT',  path:'/api/auth/change-password',     desc:'Đổi mật khẩu',                        group:'auth', auth:true  },
    { method:'POST', path:'/api/auth/logout',              desc:'Đăng xuất',                           group:'auth', auth:true  },
    { method:'POST', path:'/api/auth/sync-progress',       desc:'Đồng bộ tiến trình từ client',        group:'auth', auth:true  },
    // User state
    { method:'GET',  path:'/api/user-state/state',         desc:'Lấy toàn bộ game state',              group:'game', auth:true  },
    { method:'POST', path:'/api/user-state/state',         desc:'Lưu game state',                      group:'game', auth:true  },
    { method:'PATCH',path:'/api/user-state/resources',     desc:'Cập nhật resources',                  group:'game', auth:true  },
    { method:'PATCH',path:'/api/user-state/progress',      desc:'Cập nhật progress',                   group:'game', auth:true  },
    { method:'PATCH',path:'/api/user-state/quests',        desc:'Cập nhật quests hôm nay',             group:'game', auth:true  },
    { method:'POST', path:'/api/user-state/xp',            desc:'Thêm XP',                             group:'game', auth:true  },
    { method:'POST', path:'/api/user-state/achievement',   desc:'Unlock thành tích',                   group:'game', auth:true  },
    { method:'POST', path:'/api/user-state/purchase',      desc:'Mua item shop',                       group:'game', auth:true  },
    { method:'GET',  path:'/api/user-state/shop',          desc:'Danh sách shop items',                group:'game', auth:true  },
    { method:'POST', path:'/api/user-state/heartbeat',     desc:'Cập nhật lastLoginAt (online)',       group:'game', auth:true  },
    // Practice
    { method:'POST', path:'/api/practice/start',           desc:'Bắt đầu session (trừ energy)',        group:'game', auth:true  },
    { method:'POST', path:'/api/practice/submit',          desc:'Nộp kết quả session',                 group:'game', auth:true  },
    { method:'GET',  path:'/api/practice/history',         desc:'Lịch sử luyện tập',                   group:'game', auth:true  },
    { method:'GET',  path:'/api/practice/stats',           desc:'Thống kê tổng hợp',                   group:'game', auth:true  },
    { method:'GET',  path:'/api/practice/recent',          desc:'Sessions gần đây',                    group:'game', auth:true  },
    { method:'GET',  path:'/api/practice/:id',             desc:'Chi tiết 1 session',                  group:'game', auth:true  },
    // TOEIC
    { method:'GET',  path:'/api/toeic/tests',              desc:'Danh sách bài thi',                   group:'toeic', auth:true },
    { method:'GET',  path:'/api/toeic/tests/:id',          desc:'Chi tiết bài thi',                    group:'toeic', auth:true },
    { method:'POST', path:'/api/toeic/attempts/start',     desc:'Bắt đầu lượt thi',                    group:'toeic', auth:true },
    { method:'PUT',  path:'/api/toeic/attempts/:id/save',  desc:'Lưu tiến trình thi',                  group:'toeic', auth:true },
    { method:'POST', path:'/api/toeic/attempts/:id/submit',desc:'Nộp bài thi',                         group:'toeic', auth:true },
    { method:'GET',  path:'/api/toeic/attempts',           desc:'Lịch sử thi của user',                group:'toeic', auth:true },
    { method:'GET',  path:'/api/toeic/attempts/:id',       desc:'Chi tiết lượt thi',                   group:'toeic', auth:true },
    // Vocabulary
    { method:'GET',  path:'/api/vocabulary',               desc:'Danh sách từ vựng',                   group:'vocab', auth:false },
    { method:'POST', path:'/api/vocabulary',               desc:'Thêm từ vựng mới',                    group:'vocab', auth:true  },
    { method:'PUT',  path:'/api/vocabulary/:id',           desc:'Sửa từ vựng',                         group:'vocab', auth:true  },
    { method:'DELETE',path:'/api/vocabulary/:id',          desc:'Xóa từ vựng',                         group:'vocab', auth:true  },
    { method:'GET',  path:'/api/upload/check',             desc:'Kiểm tra quyền upload',               group:'vocab', auth:true  },
    { method:'POST', path:'/api/upload/vocabulary',        desc:'Upload 1 từ vựng private',            group:'vocab', auth:true  },
    { method:'GET',  path:'/api/upload/my-topics',         desc:'Danh sách source của user',           group:'vocab', auth:true  },
    { method:'GET',  path:'/api/upload/my-vocabulary/:src',desc:'Từ vựng private theo source',         group:'vocab', auth:true  },
    // Wrong words
    { method:'GET',  path:'/api/wrong-words',              desc:'Từ sai của user',                     group:'game', auth:true  },
    { method:'POST', path:'/api/wrong-words',              desc:'Thêm từ sai',                         group:'game', auth:true  },
    { method:'DELETE',path:'/api/wrong-words/:id',         desc:'Xóa từ sai',                          group:'game', auth:true  },
    // Leaderboard
    { method:'GET',  path:'/api/leaderboard/:period?',     desc:'Bảng xếp hạng',                       group:'game', auth:false },
    { method:'GET',  path:'/api/leaderboard/rank/:userId', desc:'Xếp hạng của 1 user',                group:'game', auth:false },
    { method:'GET',  path:'/api/leaderboard/stats',        desc:'Thống kê tổng hợp leaderboard',       group:'game', auth:false },
    // Admin — users
    { method:'GET',  path:'/api/users',                    desc:'Danh sách tất cả user',               group:'admin', auth:true },
    { method:'GET',  path:'/api/users/:id',                desc:'Chi tiết 1 user',                     group:'admin', auth:true },
    { method:'POST', path:'/api/users',                    desc:'Tạo user mới',                        group:'admin', auth:true },
    { method:'PUT',  path:'/api/users/:id',                desc:'Cập nhật user',                       group:'admin', auth:true },
    { method:'DELETE',path:'/api/users/:id',               desc:'Xóa user',                            group:'admin', auth:true },
    // Admin — achievements / quests
    { method:'GET',  path:'/api/admin/achievements',       desc:'Danh sách achievement definitions',   group:'admin', auth:true },
    { method:'POST', path:'/api/admin/achievements',       desc:'Tạo achievement definition',          group:'admin', auth:true },
    { method:'GET',  path:'/api/admin/achievements/:id',   desc:'Chi tiết achievement',                group:'admin', auth:true },
    { method:'PUT',  path:'/api/admin/achievements/:id',   desc:'Cập nhật achievement',                group:'admin', auth:true },
    { method:'DELETE',path:'/api/admin/achievements/:id',  desc:'Xóa achievement',                     group:'admin', auth:true },
    { method:'GET',  path:'/api/admin/quests',             desc:'Danh sách quest definitions',         group:'admin', auth:true },
    { method:'POST', path:'/api/admin/quests',             desc:'Tạo quest definition',                group:'admin', auth:true },
    { method:'GET',  path:'/api/admin/quests/:id',         desc:'Chi tiết quest',                      group:'admin', auth:true },
    { method:'PUT',  path:'/api/admin/quests/:id',         desc:'Cập nhật quest',                      group:'admin', auth:true },
    { method:'DELETE',path:'/api/admin/quests/:id',        desc:'Xóa quest',                           group:'admin', auth:true },
    // Admin — toeic
    { method:'GET',  path:'/api/toeic/admin/questions',    desc:'Tất cả câu hỏi TOEIC',               group:'admin', auth:true },
    { method:'POST', path:'/api/toeic/admin/questions',    desc:'Thêm câu hỏi TOEIC',                 group:'admin', auth:true },
    { method:'PUT',  path:'/api/toeic/admin/questions/:id',desc:'Sửa câu hỏi TOEIC',                  group:'admin', auth:true },
    { method:'DELETE',path:'/api/toeic/admin/questions/:id',desc:'Xóa câu hỏi TOEIC',                group:'admin', auth:true },
    { method:'POST', path:'/api/toeic/admin/tests',        desc:'Tạo bài thi TOEIC',                  group:'admin', auth:true },
    { method:'PUT',  path:'/api/toeic/admin/tests/:id/publish',desc:'Publish bài thi',               group:'admin', auth:true },
    { method:'DELETE',path:'/api/toeic/admin/tests/:id',   desc:'Xóa bài thi',                        group:'admin', auth:true },
    { method:'GET',  path:'/api/toeic/admin/practice-history',desc:'Lịch sử thi tất cả user',        group:'admin', auth:true },
    { method:'GET',  path:'/api/toeic/admin/users-list',   desc:'User có lịch sử thi',                group:'admin', auth:true },
    // Admin — upload / reports / topics
    { method:'GET',  path:'/api/admin/upload/monitoring',  desc:'Giám sát uploads',                    group:'admin', auth:true },
    { method:'GET',  path:'/api/admin/upload/stats',       desc:'Thống kê uploads',                    group:'admin', auth:true },
    { method:'POST', path:'/api/reports',                  desc:'Gửi báo cáo',                         group:'user',  auth:false },
    { method:'GET',  path:'/api/reports',                  desc:'Danh sách báo cáo (admin)',            group:'admin', auth:true },
    { method:'GET',  path:'/api/topics',                   desc:'Danh sách chủ đề từ vựng',            group:'vocab', auth:false },
    { method:'POST', path:'/api/topics',                   desc:'Thêm chủ đề',                         group:'vocab', auth:true  },
    { method:'PUT',  path:'/api/topics/:id',               desc:'Sửa chủ đề',                          group:'vocab', auth:true  },
    { method:'DELETE',path:'/api/topics/:id',              desc:'Xóa chủ đề',                          group:'vocab', auth:true  },
];

var _apiRefInited = false;
function initApiReference() {
    if (_apiRefInited) return;
    _apiRefInited = true;

    var countEl = document.getElementById('api-ref-count');
    if (countEl) countEl.textContent = API_ENDPOINTS.length + ' endpoints';

    function render(group) {
        var list = document.getElementById('api-ref-list');
        var items = group === 'all' ? API_ENDPOINTS : API_ENDPOINTS.filter(function(e) { return e.group === group; });
        list.innerHTML = items.map(function(e) {
            return '<div class="api-ref-row">' +
                '<span class="api-method ' + e.method + '">' + e.method + '</span>' +
                '<span class="api-ref-path">' + e.path + '</span>' +
                '<span class="api-ref-desc">' + e.desc + '</span>' +
                (e.auth ? '<span class="api-ref-auth">Auth</span>' : '') +
                '</div>';
        }).join('');
    }

    render('all');

    document.querySelectorAll('.api-filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.api-filter-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            render(btn.dataset.group);
        });
    });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    initNavGroups();
    initAchievementModal();
    initQuestModal();
    initShopModal();

    // Auto-open group for current active tab
    var activeLink = document.querySelector('.sidebar-link.active[data-main-tab]');
    if (activeLink) openGroupForTab(activeLink.dataset.mainTab);
});
