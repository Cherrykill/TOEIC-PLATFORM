// ===================================
// NOTIFICATION CENTER
// ===================================

const NotificationCenter = {
    _open: false,
    _pollTimer: null,
    _currentTab: 'all',

    init() {
        const btn   = document.getElementById('notif-btn');
        const panel = document.getElementById('notif-panel');
        if (!btn || !panel) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._open ? this._close() : this._open_();
        });

        document.getElementById('notif-read-all')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._markAllRead();
        });

        document.addEventListener('click', (e) => {
            if (this._open && !panel.contains(e.target) && e.target !== btn) {
                this._close();
            }
        });

        // Tab click handlers
        panel.querySelectorAll('.notif-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._currentTab = btn.dataset.tab;
                panel.querySelectorAll('.notif-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._loadList();
            });
        });

        // Fetch unread count mỗi 60 giây
        this._refreshBadge();
        this._pollTimer = setInterval(() => this._refreshBadge(), 60_000);
    },

    async _open_() {
        this._open = true;
        document.getElementById('notif-panel').style.display = 'block';
        await this._loadList();
    },

    _close() {
        this._open = false;
        document.getElementById('notif-panel').style.display = 'none';
    },

    async _refreshBadge() {
        const token = this._token();
        if (!token) return;
        try {
            const res  = await fetch('/api/notifications/unread-count', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            const count = data?.data?.count || 0;
            const badge = document.getElementById('notif-badge');
            if (!badge) return;
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (_) {}
    },

    async _loadList() {
        const token = this._token();
        if (!token) { this._renderEmpty(); return; }
        try {
            const url = this._currentTab === 'all'
                ? '/api/notifications'
                : `/api/notifications?tab=${this._currentTab}`;
            const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            this._render(data?.data || []);
            this._updateTabBadges(data?.counts || {});
        } catch (_) {
            this._renderEmpty();
        }
    },

    _updateTabBadges(counts) {
        const tabs = ['all', 'system', 'account', 'violation'];
        tabs.forEach(tab => {
            const el = document.getElementById(`ntab-badge-${tab}`);
            if (!el) return;
            const n = counts[tab] || 0;
            if (n > 0) { el.textContent = n > 99 ? '99+' : n; el.style.display = 'inline-flex'; }
            else el.style.display = 'none';
        });
    },

    _render(items) {
        const list = document.getElementById('notif-list');
        if (!list) return;
        if (!items.length) { this._renderEmpty(); return; }

        list.innerHTML = items.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n._id}">
                <div class="notif-item-icon notif-icon-${n.type}">
                    <i class="fas ${this._icon(n.type)}"></i>
                </div>
                <div class="notif-item-body">
                    <div class="notif-item-title">${this._esc(n.title)}</div>
                    ${n.body ? `<div class="notif-item-body-text">${this._esc(n.body)}</div>` : ''}
                </div>
                <div class="notif-item-time">${this._ago(n.createdAt)}</div>
            </div>
        `).join('');

        list.querySelectorAll('.notif-item[data-id]').forEach(el => {
            el.addEventListener('click', () => this._markRead(el.dataset.id, el));
        });
    },

    _renderEmpty() {
        const list = document.getElementById('notif-list');
        if (list) list.innerHTML = '<div class="notif-empty">Không có thông báo nào</div>';
    },

    async _markRead(id, el) {
        if (!el.classList.contains('unread')) return;
        el.classList.remove('unread');
        const token = this._token();
        if (!token) return;
        try {
            await fetch(`/api/notifications/${id}/read`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` },
            });
            this._refreshBadge();
        } catch (_) {}
    },

    async _markAllRead() {
        const token = this._token();
        if (!token) return;
        try {
            await fetch('/api/notifications/read-all', {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` },
            });
            document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
            const badge = document.getElementById('notif-badge');
            if (badge) badge.style.display = 'none';
        } catch (_) {}
    },

    _icon(type) {
        const map = {
            achievement: 'fa-trophy',
            quest:       'fa-tasks',
            level_up:    'fa-arrow-up',
            test_result: 'fa-graduation-cap',
            system:      'fa-info-circle',
            reminder:    'fa-clock',
            violation:   'fa-exclamation-triangle',
        };
        return map[type] || 'fa-bell';
    },

    _ago(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const m = Math.floor(diff / 60_000);
        if (m < 1)  return 'Vừa xong';
        if (m < 60) return `${m} phút`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h} giờ`;
        return `${Math.floor(h / 24)} ngày`;
    },

    _esc(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    },

    _token() {
        try {
            const raw = localStorage.getItem('authToken');
            return raw ? JSON.parse(raw)?.token || null : null;
        } catch (_) { return null; }
    },
};
