// ===================================
// TABS MODULE
// Topics, Upload, Token, User Stats, Achievements, Broadcast, Practice 12 Modes, Seeds
// ===================================

// Dùng rgba alpha 0.15 cho bg để badge đọc tốt trên cả nền sáng và tối
// (light/dark mode) — tránh tình trạng badge trắng tinh trên nền tối.
const NOTIF_TYPE_META = {
    system:      { label: 'Hệ thống',   color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    reminder:    { label: 'Nhắc nhở',   color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    achievement: { label: 'Thành tích', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
    quest:       { label: 'Nhiệm vụ',   color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    level_up:    { label: 'Lên cấp',    color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
    test_result: { label: 'Kết quả thi',color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
    violation:   { label: 'Vi phạm',    color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

const MODE_LABELS = {
    'multiple-choice':    'Multiple Choice',
    'fill-blank':         'Fill Blank',
    'listening':          'Listening',
    'matching':           'Matching',
    'speed-quiz':         'Speed Quiz',
    'flashcard':          'Flashcard',
    'synonym-check':      'Synonym Check',
    'word-type-check':    'Word Type',
    'word-scramble':      'Word Scramble',
    'example-fill-blank': 'Example Fill',
    'review-mistakes':    'Review Mistakes',
    'sentence-builder':   'Sentence Builder',
    'pronunciation':      'Pronunciation',
    'context-learning':   'Context Learning',
    'dictation':          'Dictation',
    'sentence-listening': 'Sentence Listening',
    'phonetic-quiz':      'Phonetic Quiz',
};

// ---- TOPICS TAB ----

async function loadTopicsTab() {
    const tbody = document.getElementById('topics-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>`;

    try {
        const res = await fetch(`${API_URL}/topics/all`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        renderTopicsTable(data.data);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:#ef4444;text-align:center;padding:20px;">${err.message}</td></tr>`;
    }
}

function renderTopicsTable(topics) {
    const tbody = document.getElementById('topics-tbody');
    if (!topics.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b;padding:30px;">Chưa có đề nào. Nhấn "+ Thêm đề" để tạo.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    topics.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size:20px;text-align:center;">${t.icon || '📚'}</td>
            <td>
                <strong>${t.displayName}</strong>
                ${t.description ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${t.description}</div>` : ''}
            </td>
            <td><span class="badge info" style="font-family:monospace;">${(t.sourceKeys || []).join(', ')}</span></td>
            <td><strong>${t.wordCount.toLocaleString()}</strong> từ</td>
            <td style="text-align:center;">${t.order}</td>
            <td style="text-align:center;">
                <span class="badge ${t.isPublic ? 'success' : ''}" style="${!t.isPublic ? 'background:#374151;color:#9ca3af;' : ''}">
                    ${t.isPublic ? 'Hiện' : 'Ẩn'}
                </span>
            </td>
            <td>
                <button class="btn btn-ghost btn-sm topic-btn-sync" title="Sync wordCount"><i class="fas fa-sync"></i></button>
                <button class="btn btn-primary btn-sm topic-btn-edit"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm topic-btn-delete"><i class="fas fa-trash"></i></button>
            </td>`;

        tr.querySelector('.topic-btn-sync').addEventListener('click', () => syncTopicCount(t._id));
        tr.querySelector('.topic-btn-edit').addEventListener('click', () => showTopicModal(t));
        tr.querySelector('.topic-btn-delete').addEventListener('click', () => deleteTopicConfirm(t._id, t.displayName));
        tbody.appendChild(tr);
    });
}

function showTopicModal(topic) {
    const isEdit = !!topic;
    const existing = document.getElementById('topic-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'topic-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
        <div style="background:#1e293b;border:1px solid #334155;border-radius:14px;width:480px;max-width:95vw;padding:28px;">
            <h3 style="margin:0 0 20px;font-size:17px;">${isEdit ? 'Sửa đề' : 'Thêm đề mới'}</h3>
            <div style="display:grid;gap:14px;">
                <div>
                    <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">SOURCE KEYS <span style="color:#ef4444">*</span></label>
                    <input id="ti-sourceKey" value="${(topic?.sourceKeys || []).join(', ')}"
                        placeholder="vd: ets2024, 600words" style="width:100%;padding:9px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-family:monospace;">
                    <div style="font-size:11px;color:#64748b;margin-top:4px;">Nhiều giá trị cách nhau bằng dấu phẩy. Phải khớp với sources trong vocabulary.</div>
                </div>
                <div>
                    <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">TÊN HIỂN THỊ <span style="color:#ef4444">*</span></label>
                    <input id="ti-displayName" value="${topic?.displayName || ''}" placeholder="vd: ETS 2024"
                        style="width:100%;padding:9px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div>
                        <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">ICON (emoji)</label>
                        <input id="ti-icon" value="${topic?.icon || '📚'}" style="width:100%;padding:9px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:18px;">
                    </div>
                    <div>
                        <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">MÀU</label>
                        <input type="color" id="ti-color" value="${topic?.color || '#3b82f6'}" style="width:100%;height:38px;padding:2px;background:#0f172a;border:1px solid #334155;border-radius:8px;cursor:pointer;">
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div>
                        <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">THỨ TỰ</label>
                        <input type="number" id="ti-order" value="${topic?.order ?? 0}" style="width:100%;padding:9px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;">
                    </div>
                    <div style="display:flex;align-items:flex-end;padding-bottom:2px;">
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#e2e8f0;">
                            <input type="checkbox" id="ti-isPublic" ${topic?.isPublic !== false ? 'checked' : ''}
                                style="width:16px;height:16px;accent-color:#3b82f6;"> Hiển thị cho người dùng
                        </label>
                    </div>
                </div>
                <div>
                    <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">MÔ TẢ</label>
                    <input id="ti-description" value="${topic?.description || ''}" placeholder="Mô tả ngắn về đề này..."
                        style="width:100%;padding:9px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;">
                </div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;">
                <button id="ti-btn-cancel" class="btn btn-ghost">Hủy</button>
                <button id="ti-btn-save" class="btn btn-success">
                    <i class="fas fa-save"></i> ${isEdit ? 'Lưu' : 'Tạo'}
                </button>
            </div>
        </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#ti-btn-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#ti-btn-save').addEventListener('click', () => saveTopicModal(topic?._id || '', modal));
}

async function saveTopicModal(id, modal) {
    const body = {
        sourceKeys: document.getElementById('ti-sourceKey')?.value.trim(),
        displayName: document.getElementById('ti-displayName')?.value.trim(),
        icon: document.getElementById('ti-icon')?.value.trim(),
        color: document.getElementById('ti-color')?.value,
        order: parseInt(document.getElementById('ti-order')?.value) || 0,
        isPublic: document.getElementById('ti-isPublic')?.checked,
        description: document.getElementById('ti-description')?.value.trim(),
    };

    if (!body.displayName) return showToast('Vui lòng nhập tên hiển thị', 'warning');
    if (!id && !body.sourceKeys) return showToast('Vui lòng nhập sourceKeys', 'warning');

    const isEdit = !!id;
    const url = isEdit ? `${API_URL}/topics/${id}` : `${API_URL}/topics`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        (modal || document.getElementById('topic-modal'))?.remove();
        showToast(isEdit ? 'Đã cập nhật đề' : 'Đã tạo đề mới', 'success');
        loadTopicsTab();
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
    }
}

async function syncTopicCount(id) {
    try {
        const res = await fetch(`${API_URL}/topics/${id}/sync-count`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` },
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        showToast(`Đã sync: ${data.data.wordCount} từ`, 'success');
        loadTopicsTab();
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
    }
}

async function deleteTopicConfirm(id, name) {
    if (!confirm(`Xóa đề "${name}"?\nTừ vựng trong DB không bị xóa.`)) return;
    try {
        const res = await fetch(`${API_URL}/topics/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` },
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        showToast('Đã xóa đề', 'success');
        loadTopicsTab();
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
    }
}

// ---- UPLOAD MANAGEMENT TAB ----

function initUploadManagement() {
    const refreshBtn = document.getElementById('btn-refresh-uploads');
    refreshBtn?.addEventListener('click', () => loadUploadMonitoring());
    loadUploadMonitoring();
}

async function loadUploadMonitoring() {
    const tbody = document.getElementById('upload-monitoring-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="padding: 30px; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin"></i> Đang tải dữ liệu...
            </td>
        </tr>
    `;

    try {
        const response = await fetch('/api/upload/admin/monitoring', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        const uploads = result.data || [];
        document.getElementById('upload-total-count').textContent = uploads.length;

        if (uploads.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                        <i class="fas fa-inbox" style="font-size: 32px; opacity: 0.3; display: block; margin-bottom: 10px;"></i>
                        Chưa có upload nào
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = uploads.map(u => {
            const statusColor = u.status === 'active' ? '#10b981' : '#ef4444';
            const statusLabel = u.status === 'active' ? '✓ Allowed' : '✗ Blocked';
            const statusBg = u.status === 'active' ? '#dcfce7' : '#fee2e2';
            const preview = (u.contentPreview || []).slice(0, 3).join(', ');
            const more = u.wordCount > 3 ? ` +${u.wordCount - 3}` : '';

            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px; font-weight: 500;">${u.email}</td>
                    <td style="padding: 12px; font-size: 13px;">
                        <code style="background: var(--bg-tertiary); padding: 2px 8px; border-radius: 4px; font-size: 12px;">${u.source}</code>
                    </td>
                    <td style="padding: 12px; font-size: 13px; color: var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis;">
                        <span title="${(u.contentPreview || []).join(', ')}">${preview}${more}</span>
                    </td>
                    <td style="padding: 12px; text-align: right; font-family: monospace; font-weight: 600;">${u.wordCount}</td>
                    <td style="padding: 12px; text-align: center;">
                        <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ${statusBg}; color: ${statusColor};">
                            ${statusLabel}
                        </span>
                    </td>
                    <td style="padding: 12px; text-align: center; font-size: 12px; color: var(--text-secondary);">
                        ${new Date(u.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Error loading uploads:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="padding: 20px; text-align: center; color: #ef4444;">
                    Lỗi tải dữ liệu: ${err.message}
                </td>
            </tr>
        `;
    }
}

// ---- TOKEN MANAGEMENT TAB ----

// Map nhãn feature → tên hiển thị tiếng Việt. Feature lạ giữ nguyên key.
const AI_FEATURE_LABELS = {
    'vocab-ai-fill':           '✍️ AI Fill từ vựng',
    'explain-word':            '📖 Giải thích từ',
    'word-questions-generate': '❓ Sinh câu hỏi từ vựng',
    'toeic-question-generate': '🎓 AI Generate câu hỏi TOEIC',
    'toeic-reading-generate':  '📚 AI Generate đoạn đọc TOEIC',
    'analyze-mistakes':        '🔍 Phân tích lỗi',
    'study-plan':              '📅 Kế hoạch học',
    'chat-tutor':              '💬 Chat tutor',
    'generate-examples':       '✏️ Sinh câu ví dụ',
    'check-grammar':           '✓ Kiểm tra ngữ pháp',
    'related-words':           '🔗 Từ liên quan',
    'generate-flashcards':     '🎴 Sinh flashcard',
    'translate-sentence':      '🌐 Dịch câu',
    'unknown':                 '❔ Khác / chưa gắn nhãn',
};

async function loadTokenStats() {
    try {
        const days = parseInt(document.getElementById('ai-usage-days')?.value || '7', 10) || 7;
        const response = await fetch('/api/admin/ai-usage?days=' + days, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        const d = result.data;

        // 4 cards
        const fmt = n => Number(n || 0).toLocaleString('vi-VN');
        const usd = n => '$' + (Number(n || 0)).toFixed(4);
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('ai-total-tokens',  fmt(d.totalTokens));
        set('ai-token-split',   `prompt ${fmt(d.promptTokens)} · completion ${fmt(d.completionTokens)}`);
        set('ai-total-cost',    usd(d.totalCost));
        set('ai-cost-all',      'All-time: ' + usd(d.allTime?.totalCost));
        set('ai-total-calls',   fmt(d.calls));
        set('ai-calls-all',     'All-time: ' + fmt(d.allTime?.calls));
        set('ai-total-users',   fmt(d.users));

        // Bảng phân bổ theo feature
        const fTb = document.getElementById('ai-feature-tbody');
        if (fTb) {
            if (!d.byFeature?.length) {
                fTb.innerHTML = '<tr><td colspan="5" style="padding:18px;text-align:center;color:var(--text-secondary)">Chưa có lượt gọi AI nào trong khoảng này.</td></tr>';
            } else {
                const maxTokens = Math.max(...d.byFeature.map(f => f.tokens || 0), 1);
                fTb.innerHTML = d.byFeature.map(f => {
                    const label = AI_FEATURE_LABELS[f._id] || f._id;
                    const pct = Math.round((f.tokens / maxTokens) * 100);
                    return `
                        <tr style="border-bottom:1px solid var(--border-color)">
                            <td style="padding:10px"><b>${label}</b></td>
                            <td style="padding:10px;text-align:right">${fmt(f.calls)}</td>
                            <td style="padding:10px;text-align:right;font-family:monospace">${fmt(f.tokens)}</td>
                            <td style="padding:10px;text-align:right;font-family:monospace">${usd(f.cost)}</td>
                            <td style="padding:10px">
                                <div style="background:var(--bg-tertiary);border-radius:4px;height:8px;overflow:hidden">
                                    <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#667eea,#764ba2)"></div>
                                </div>
                            </td>
                        </tr>`;
                }).join('');
            }
        }

        // Bảng recent calls
        const rTb = document.getElementById('ai-recent-tbody');
        if (rTb) {
            if (!d.recent?.length) {
                rTb.innerHTML = '<tr><td colspan="6" style="padding:18px;text-align:center;color:var(--text-secondary)">Chưa có lịch sử.</td></tr>';
            } else {
                rTb.innerHTML = d.recent.map(r => `
                    <tr style="border-bottom:1px solid var(--border-color)">
                        <td style="padding:8px 10px;font-size:12px;color:var(--text-secondary);white-space:nowrap">${new Date(r.createdAt).toLocaleString('vi-VN')}</td>
                        <td style="padding:8px 10px;font-size:13px">${AI_FEATURE_LABELS[r.feature] || r.feature}</td>
                        <td style="padding:8px 10px;font-family:monospace;font-size:12px;color:var(--text-secondary)">${r.model || '—'}</td>
                        <td style="padding:8px 10px;font-size:12px">${r.email || '—'}</td>
                        <td style="padding:8px 10px;text-align:right;font-family:monospace">${fmt(r.totalTokens)}</td>
                        <td style="padding:8px 10px;text-align:right;font-family:monospace">${usd(r.costUsd)}</td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Error loading AI usage:', err);
        showToast(`Lỗi tải AI usage: ${err.message}`, 'error');
    }
}

// Reload khi đổi khoảng ngày
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ai-usage-days')?.addEventListener('change', loadTokenStats);
});

// ---- USER STATS TAB ----

async function loadUserStats(page = 1, search = null) {
    usPage = page;
    if (search !== null) usSearch = search;
    else usSearch = document.getElementById('us-search')?.value.trim() || '';
    const tbody = document.getElementById('us-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:20px">Đang tải...</td></tr>`;

    try {
        const params = new URLSearchParams({ page, limit: 30, search: usSearch });
        const res = await fetch(`/api/admin/users-stats?${params}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        const { data, pagination } = result;
        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--text-secondary)">Không có dữ liệu</td></tr>`;
            document.getElementById('us-pagination')?.replaceChildren();
            return;
        }

        const totalEl = document.getElementById('us-total');
        if (totalEl) totalEl.textContent = `Tổng: ${pagination.total} người dùng`;

        tbody.innerHTML = data.map(u => `
            <tr>
                <td>${u.email}</td>
                <td>${u.username || '-'}</td>
                <td style="text-align:center">${u.level}</td>
                <td style="text-align:right">${(u.xp||0).toLocaleString()}</td>
                <td style="text-align:right">${(u.coins||0).toLocaleString()}</td>
                <td style="text-align:right">${(u.gems||0).toLocaleString()}</td>
                <td style="text-align:center">${u.streakCurrent}</td>
                <td style="text-align:center">${u.totalSessions}</td>
                <td style="text-align:center">${u.totalCorrect}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-success'}">${u.role}</span></td>
                <td style="font-size:12px;color:var(--text-secondary)">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline us-ach-btn"
                        data-uid="${u._id}" data-email="${u.email.replace(/"/g,'&quot;')}">
                        <i class="fas fa-trophy"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.us-ach-btn').forEach(btn => {
            btn.addEventListener('click', () => openUserAchievementsFor(btn.dataset.uid, btn.dataset.email));
        });

        renderUsPagination(pagination);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--danger-color)">Lỗi: ${err.message}</td></tr>`;
    }
}

function renderUsPagination(pg) {
    const wrap = document.getElementById('us-pagination');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (pg.pages <= 1) return;

    const makeBtn = (label, p, disabled = false) => {
        const b = document.createElement('button');
        b.className = 'btn btn-sm ' + (p === pg.page ? 'btn-primary' : 'btn-outline');
        b.textContent = label;
        b.disabled = disabled;
        if (!disabled) b.onclick = () => loadUserStats(p, usSearch);
        return b;
    };

    wrap.appendChild(makeBtn('«', 1, pg.page === 1));
    wrap.appendChild(makeBtn('‹', pg.page - 1, pg.page === 1));

    const start = Math.max(1, pg.page - 2);
    const end   = Math.min(pg.pages, pg.page + 2);
    for (let i = start; i <= end; i++) wrap.appendChild(makeBtn(i, i));

    wrap.appendChild(makeBtn('›', pg.page + 1, pg.page === pg.pages));
    wrap.appendChild(makeBtn('»', pg.pages, pg.page === pg.pages));
}

// ---- USER ACHIEVEMENTS TAB ----

function initUserAchievementsTab() {
    const input = document.getElementById('ua-search-input');
    if (!input || input.dataset.uaInited) return;
    input.dataset.uaInited = '1';

    input.addEventListener('input', () => {
        clearTimeout(_uaSearchTimer);
        _uaSearchTimer = setTimeout(() => loadUaUsers(1, input.value.trim()), 280);
    });

    loadUaUsers(1);
}

async function loadUaUsers(page = 1, search = null) {
    _uaPage = page;
    if (search !== null) _uaSearch = search;
    const tbody = document.getElementById('ua-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>`;

    try {
        const params = new URLSearchParams({ page: _uaPage, limit: 20, search: _uaSearch });
        const res = await fetch(`/api/admin/users-stats?${params}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        const { data, pagination } = result;
        const totalEl = document.getElementById('ua-total');
        if (totalEl) totalEl.textContent = `${pagination.total} người dùng`;

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:32px 0">Không tìm thấy người dùng nào.</td></tr>`;
            renderUaPagination(pagination);
            return;
        }

        const offset = (_uaPage - 1) * 20;
        tbody.innerHTML = data.map((u, idx) => `
            <tr class="ua-user-row" data-uid="${u._id}" style="cursor:pointer">
                <td style="color:var(--text-secondary)">${offset + idx + 1}</td>
                <td style="font-weight:600">${u.username || '—'}</td>
                <td>${u.email}</td>
                <td style="font-size:13px;color:var(--text-secondary)">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                <td style="text-align:center"><i class="fas fa-chevron-down ua-chevron" style="transition:transform .2s;color:var(--text-secondary)"></i></td>
            </tr>
            <tr class="ua-expand-row" data-for="${u._id}" style="display:none">
                <td colspan="5" style="padding:0;background:var(--bg-secondary)">
                    <div class="ua-ach-panel" style="padding:12px 24px 16px">
                        <p style="color:var(--text-secondary);font-size:13px;margin:0"><i class="fas fa-spinner fa-spin"></i> Đang tải...</p>
                    </div>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.ua-user-row').forEach(row => {
            row.addEventListener('click', () => _toggleUaRow(row));
        });

        renderUaPagination(pagination);

        if (_uaAutoExpandId) {
            const targetRow = document.querySelector(`.ua-user-row[data-uid="${_uaAutoExpandId}"]`);
            if (targetRow) {
                _uaAutoExpandId = null;
                targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                _toggleUaRow(targetRow);
            }
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger-color);padding:24px">Lỗi: ${err.message}</td></tr>`;
    }
}

function _toggleUaRow(row) {
    const uid = row.dataset.uid;
    const expandRow = row.nextElementSibling;
    if (!expandRow || !expandRow.classList.contains('ua-expand-row')) return;
    const chevron = row.querySelector('.ua-chevron');

    const isOpen = expandRow.style.display === 'table-row';
    if (isOpen) {
        expandRow.style.display = 'none';
        if (chevron) chevron.style.transform = '';
    } else {
        expandRow.style.display = 'table-row';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        if (!row.dataset.loaded) {
            row.dataset.loaded = '1';
            _loadUaAchievements(uid, expandRow.querySelector('.ua-ach-panel'));
        }
    }
}

async function _loadUaAchievements(uid, panel) {
    if (!panel) return;
    try {
        const res = await fetch(`/api/admin/user-achievements?userId=${uid}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        if (!result.data.length) {
            panel.innerHTML = `<p style="color:var(--text-secondary);font-size:13px;margin:0">Chưa có thành tích nào.</p>`;
            return;
        }

        panel.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead>
                    <tr style="border-bottom:1px solid var(--border-color)">
                        <th style="padding:6px 8px;text-align:left;color:var(--text-secondary);font-weight:600;width:32px">#</th>
                        <th style="padding:6px 8px;width:40px"></th>
                        <th style="padding:6px 8px;text-align:left;color:var(--text-secondary);font-weight:600">Tên thành tích</th>
                        <th style="padding:6px 8px;text-align:left;color:var(--text-secondary);font-weight:600">Mô tả</th>
                        <th style="padding:6px 8px;text-align:left;color:var(--text-secondary);font-weight:600;width:110px">Ngày đạt</th>
                        <th style="padding:6px 8px;text-align:left;color:var(--text-secondary);font-weight:600;width:190px">Phần thưởng</th>
                    </tr>
                </thead>
                <tbody>
                    ${result.data.map((a, i) => {
                        const rewards = [];
                        if (a.rewardXp)    rewards.push(`<span class="badge info">+${a.rewardXp} XP</span>`);
                        if (a.rewardCoins) rewards.push(`<span class="badge warning">+${a.rewardCoins} coins</span>`);
                        if (a.rewardGems)  rewards.push(`<span class="badge success">+${a.rewardGems} gems</span>`);
                        return `<tr style="border-bottom:1px solid var(--border-color)">
                            <td style="padding:8px">${i + 1}</td>
                            <td style="padding:8px;font-size:18px;text-align:center">${a.icon || '🏆'}</td>
                            <td style="padding:8px;font-weight:600">${a.name || '—'}</td>
                            <td style="padding:8px;color:var(--text-secondary)">${a.description || ''}</td>
                            <td style="padding:8px">${new Date(a.unlockedAt).toLocaleDateString('vi-VN')}</td>
                            <td style="padding:8px">${rewards.length ? rewards.join(' ') : '<span style="color:var(--text-secondary)">—</span>'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
    } catch (err) {
        panel.innerHTML = `<p style="color:var(--danger-color);font-size:13px;margin:0">Lỗi: ${err.message}</p>`;
    }
}

function renderUaPagination(pagination) {
    const container = document.getElementById('ua-pagination');
    if (!container) return;
    if (!pagination || pagination.pages <= 1) { container.innerHTML = ''; return; }
    const { page, pages } = pagination;
    let html = '';
    if (page > 1) html += `<button class="btn btn-sm btn-ghost" onclick="loadUaUsers(${page - 1})">‹</button>`;
    for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) {
        html += `<button class="btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}" onclick="loadUaUsers(${p})">${p}</button>`;
    }
    if (page < pages) html += `<button class="btn btn-sm btn-ghost" onclick="loadUaUsers(${page + 1})">›</button>`;
    container.innerHTML = html;
}

function openUserAchievementsFor(userId, email) {
    _uaAutoExpandId = userId;
    document.querySelector('.sidebar-link[data-main-tab="user-achievements"]')?.click();
    setTimeout(() => {
        const input = document.getElementById('ua-search-input');
        if (input) input.value = email;
        loadUaUsers(1, email);
    }, 50);
}

// ---- BROADCAST TAB ----

function toggleBcUser(val) {
    const row = document.getElementById('bc-user-row');
    if (row) row.style.display = (val === 'one') ? '' : 'none';
}

function _onBcTypeChange() {
    const type = document.getElementById('bc-type')?.value;
    const emailInput = document.getElementById('bc-user-email');
    if (type === 'violation') {
        if (emailInput) emailInput.placeholder = 'Bắt buộc nhập email người vi phạm...';
    } else {
        if (emailInput) emailInput.placeholder = 'Để trống = gửi tất cả. Nhập email để gửi 1 người...';
    }
}

function _initBcEmailSearch() {
    const input = document.getElementById('bc-user-email');
    const suggestions = document.getElementById('bc-user-suggestions');
    const hiddenId = document.getElementById('bc-user-id');
    const selectedLabel = document.getElementById('bc-user-selected');
    if (!input) return;

    input.addEventListener('input', () => {
        if (hiddenId) hiddenId.value = '';
        if (selectedLabel) selectedLabel.style.display = 'none';

        clearTimeout(_bcSearchTimer);
        const q = input.value.trim();
        if (q.length < 2) { if (suggestions) suggestions.style.display = 'none'; return; }
        _bcSearchTimer = setTimeout(() => _bcSearchUsers(q), 300);
    });

    input.addEventListener('blur', () => {
        setTimeout(() => { if (suggestions) suggestions.style.display = 'none'; }, 200);
    });
}

async function _bcSearchUsers(q) {
    const suggestions = document.getElementById('bc-user-suggestions');
    if (!suggestions) return;
    try {
        const res = await fetch(`/api/admin/users-stats?search=${encodeURIComponent(q)}&limit=6`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        const users = result.data || [];
        if (!users.length) { suggestions.style.display = 'none'; return; }

        suggestions.innerHTML = users.map(u => `
            <div class="bc-suggest-item" data-id="${u._id}" data-email="${u.email}"
              style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border-color);">
              <div style="font-weight:600;color:var(--text-primary)">${u.email}</div>
              ${u.displayName || u.username ? `<div style="font-size:11px;color:var(--text-secondary)">${u.displayName || u.username}</div>` : ''}
            </div>
        `).join('');
        suggestions.style.display = 'block';

        suggestions.querySelectorAll('.bc-suggest-item').forEach(item => {
            item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-secondary)'; });
            item.addEventListener('mouseleave', () => { item.style.background = ''; });
            item.addEventListener('mousedown', () => {
                const id = item.dataset.id;
                const email = item.dataset.email;
                document.getElementById('bc-user-id').value = id;
                document.getElementById('bc-user-email').value = email;
                const label = document.getElementById('bc-user-selected');
                if (label) { label.textContent = `✓ Đã chọn: ${email}`; label.style.display = 'block'; }
                suggestions.style.display = 'none';
            });
        });
    } catch (_) { suggestions.style.display = 'none'; }
}

async function sendBroadcast() {
    const title  = document.getElementById('bc-title')?.value.trim();
    const body   = document.getElementById('bc-body')?.value.trim();
    const type   = document.getElementById('bc-type')?.value || 'system';
    const userId = document.getElementById('bc-user-id')?.value || '';
    const userEmail = document.getElementById('bc-user-email')?.value.trim() || '';
    const btn    = document.getElementById('bc-send-btn');

    if (!title) { showToast('Tiêu đề không được trống', 'error'); return; }
    if (type === 'violation' && !userEmail) { showToast('Vi phạm phải chọn người dùng cụ thể', 'error'); return; }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...'; }

    try {
        const giftCoins = parseInt(document.getElementById('bc-gift-coins')?.value) || 0;
        const giftGems  = parseInt(document.getElementById('bc-gift-gems')?.value)  || 0;
        const giftXp    = parseInt(document.getElementById('bc-gift-xp')?.value)    || 0;

        const payload = { title, body, type };
        if (userId)    payload.userId    = userId;
        if (userEmail) payload.userEmail = userEmail;
        if (giftCoins || giftGems || giftXp) payload.gift = { coins: giftCoins, gems: giftGems, xp: giftXp };

        const res = await fetch('/api/admin/notifications/broadcast', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        showToast(`Đã gửi thành công cho ${result.sent} người dùng`, 'success');
        document.getElementById('bc-title').value = '';
        document.getElementById('bc-body').value  = '';
        document.getElementById('bc-user-email').value = '';
        document.getElementById('bc-user-id').value = '';
        if (document.getElementById('bc-gift-coins')) document.getElementById('bc-gift-coins').value = '';
        if (document.getElementById('bc-gift-gems'))  document.getElementById('bc-gift-gems').value  = '';
        if (document.getElementById('bc-gift-xp'))    document.getElementById('bc-gift-xp').value    = '';
        const lbl = document.getElementById('bc-user-selected');
        if (lbl) lbl.style.display = 'none';
        loadNotifHistory();
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi thông báo'; }
    }
}

async function loadNotifHistory() {
    const list = document.getElementById('bc-history');
    if (!list) return;
    list.innerHTML = '<p style="color:var(--text-secondary)">Đang tải...</p>';

    try {
        const res = await fetch('/api/admin/notifications?limit=30', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        if (!result.data.length) {
            list.innerHTML = '<p style="color:var(--text-secondary);font-size:13px">Chưa có thông báo nào.</p>';
            return;
        }

        list.innerHTML = result.data.map(n => {
            const meta = NOTIF_TYPE_META[n.type] || { label: n.type, color: '#6b7280', bg: '#f3f4f6' };
            return `
            <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:12px" id="nhi-${n._id}">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;background:${meta.bg};color:${meta.color};border:1px solid ${meta.color}33">${meta.label}</span>
                    <span style="color:var(--text-secondary);font-size:12px">${new Date(n.createdAt).toLocaleString('vi-VN')}</span>
                    <button class="btn btn-sm nhi-del-btn" data-id="${n._id}" style="margin-left:auto;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.4);padding:2px 8px;font-size:11px;border-radius:6px">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div style="font-weight:600;margin-top:6px">${n.title}</div>
                ${n.body ? `<div style="color:var(--text-secondary);font-size:13px;margin-top:2px">${n.body}</div>` : ''}
                <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">
                    Gửi tới: <b>${n.userId?.email || 'N/A'}</b> · ${n.read ? '<span style="color:#10b981">✓ Đã đọc</span>' : '<span style="color:#f59e0b">Chưa đọc</span>'}
                </div>
            </div>`;
        }).join('');

        list.querySelectorAll('.nhi-del-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteNotif(btn.dataset.id, btn));
        });
    } catch (err) {
        list.innerHTML = `<p style="color:var(--danger-color)">Lỗi: ${err.message}</p>`;
    }
}

async function deleteNotif(id, btn) {
    if (!confirm('Xóa thông báo này?')) return;
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(`/api/admin/notifications/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        document.getElementById(`nhi-${id}`)?.remove();
        showToast('Đã xóa', 'success');
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
        if (btn) btn.disabled = false;
    }
}

// ---- PRACTICE HISTORY 12 MODES TAB ----

async function loadPracticeHistory12(page = 1, search = null, mode = null) {
    phPage = page;
    if (search === null) search = document.getElementById('ph-search')?.value.trim() || '';
    if (mode === null)   mode   = document.getElementById('ph-mode')?.value || '';

    const tbody = document.getElementById('ph-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px">Đang tải...</td></tr>`;

    try {
        const params = new URLSearchParams({ page, limit: 20, search, mode });
        const res = await fetch(`/api/practice/admin/history?${params}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        const { data, pagination } = result;
        const totalEl = document.getElementById('ph-total');
        if (totalEl) totalEl.textContent = `Tổng: ${pagination.total} phiên`;

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text-secondary)">Không có dữ liệu</td></tr>`;
            document.getElementById('ph-pagination')?.replaceChildren();
            return;
        }

        tbody.innerHTML = data.map(s => {
            const dur = s.duration ? `${Math.floor(s.duration/60)}p${s.duration%60}s` : '-';
            const date = s.completedAt ? new Date(s.completedAt).toLocaleDateString('vi-VN') : '-';
            const acc  = s.questionsCount > 0 ? Math.round((s.correctAnswers/s.questionsCount)*100) : 0;
            return `<tr>
                <td>${s.user?.email || '-'}</td>
                <td><span class="badge badge-info">${MODE_LABELS[s.mode] || s.mode}</span></td>
                <td style="text-align:right">${s.score || 0}</td>
                <td style="text-align:center;color:var(--success-color)">${s.correctAnswers || 0}</td>
                <td style="text-align:center;color:var(--danger-color)">${s.wrongAnswers || 0}</td>
                <td style="text-align:right">${s.xpEarned || 0}</td>
                <td style="text-align:right">${s.coinsEarned || 0}</td>
                <td>${dur}</td>
                <td style="font-size:12px;color:var(--text-secondary)">${date}</td>
                <td>
                    <button class="btn btn-sm btn-danger ph-del-btn" data-id="${s._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.ph-del-btn').forEach(btn => {
            btn.addEventListener('click', () => deletePracticeSession12(btn.dataset.id, btn));
        });

        renderPhPagination(pagination);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--danger-color)">Lỗi: ${err.message}</td></tr>`;
    }
}

function renderPhPagination(pg) {
    const wrap = document.getElementById('ph-pagination');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (pg.pages <= 1) return;

    const makeBtn = (label, p, disabled = false) => {
        const b = document.createElement('button');
        b.className = 'btn btn-sm ' + (p === pg.page ? 'btn-primary' : 'btn-outline');
        b.textContent = label;
        b.disabled = disabled;
        if (!disabled) b.onclick = () => loadPracticeHistory12(p);
        return b;
    };

    wrap.appendChild(makeBtn('«', 1, pg.page === 1));
    wrap.appendChild(makeBtn('‹', pg.page - 1, pg.page === 1));
    const start = Math.max(1, pg.page - 2);
    const end   = Math.min(pg.pages, pg.page + 2);
    for (let i = start; i <= end; i++) wrap.appendChild(makeBtn(i, i));
    wrap.appendChild(makeBtn('›', pg.page + 1, pg.page === pg.pages));
    wrap.appendChild(makeBtn('»', pg.pages, pg.page === pg.pages));
}

async function deletePracticeSession12(id, btn) {
    if (!confirm('Xóa phiên luyện tập này?')) return;
    btn.disabled = true;
    try {
        const res = await fetch(`/api/practice/admin/session/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        btn.closest('tr').remove();
        showToast('Đã xóa', 'success');
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
        btn.disabled = false;
    }
}

// ---- SEED FUNCTIONS ----

async function seedAchievements() {
    if (!confirm('Seed dữ liệu thành tích mặc định vào DB? Sẽ bỏ qua những cái đã có.')) return;
    try {
        const res = await fetch('/api/admin/seed-achievements', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        showToast(result.message, 'success');
        loadAchievements();
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
    }
}

async function seedQuests() {
    if (!confirm('Seed dữ liệu nhiệm vụ mặc định vào DB? Sẽ bỏ qua những cái đã có.')) return;
    try {
        const res = await fetch('/api/admin/seed-quests', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        showToast(result.message, 'success');
        loadQuests();
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
    }
}

// Phase B: xoá toàn bộ user_quests để sang period kế tiếp sinh lại với
// startSnapshot mới. Dùng 1 lần sau khi đổi sang source='computed'.
async function resetUserQuests() {
    if (!confirm('XOÁ TOÀN BỘ user_quests của MỌI user?\nMất tiến độ period hiện tại nhưng quest sẽ tự sinh lại sạch (kèm snapshot baseline) ở period kế tiếp.')) return;
    try {
        const res = await fetch('/api/quests/reset-user-quests', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        showToast(result.message, 'success');
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
    }
}

// ---- STUBS for tabs not yet implemented ----

function loadAchievements() { console.warn('loadAchievements: not implemented'); }
function loadQuests() { console.warn('loadQuests: not implemented'); }
function loadShopItems() { console.warn('loadShopItems: not implemented'); }
