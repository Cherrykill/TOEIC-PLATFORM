import { useState, useEffect, useMemo } from 'react';
import { useNotifications } from './useNotifications.js';

const TABS = [
    { key: 'all', label: 'Tất cả', icon: 'fa-list' },
    { key: 'system', label: 'Hệ thống', icon: 'fa-cog' },
    { key: 'account', label: 'Tài khoản', icon: 'fa-user' },
    { key: 'violation', label: 'Vi phạm', icon: 'fa-shield-alt' },
];

function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return '';
    return d.toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit',
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}

export default function NotificationPanel({ isLoggedIn }) {
    const { badge, items, tab, loading, fetchItems, changeTab, markAllRead, deleteAll, setBadge } = useNotifications(isLoggedIn);
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(null);

    // ESC để đóng
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    // Tự chọn item đầu tiên khi mở/đổi tab
    useEffect(() => {
        if (!open || items.length === 0) return;
        const stillExists = items.some(n => (n._id || n.id) === selectedId);
        if (!stillExists) setSelectedId(items[0]._id || items[0].id);
    }, [open, items, selectedId]);

    async function handleBellClick() {
        if (!open) {
            await fetchItems(tab);
            setBadge(0);
        }
        setOpen(o => !o);
    }

    const selected = useMemo(
        () => items.find(n => (n._id || n.id) === selectedId),
        [items, selectedId],
    );

    return (
        <>
            <button id="notif-btn" className="icon-btn" title="Thông báo" onClick={handleBellClick}>
                <i className="fas fa-bell"></i>
                {badge > 0 && <span id="notif-badge" className="notif-badge">{badge}</span>}
            </button>

            {open && (
                <div
                    className="notif-overlay"
                    onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
                >
                    <div className="notif-modal" role="dialog" aria-label="Thông báo">
                        <div className="notif-modal-header">
                            <h3><i className="fas fa-envelope-open-text"></i> Thông báo</h3>
                            <button className="notif-modal-close" onClick={() => setOpen(false)} title="Đóng (Esc)">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="notif-modal-body">
                            {/* LEFT — Detail */}
                            <div className="notif-detail">
                                {selected ? (
                                    <>
                                        <div className="notif-detail-header">
                                            <h4>{selected.title || '(Không có tiêu đề)'}</h4>
                                            <span className="notif-detail-time">{fmtTime(selected.createdAt)}</span>
                                        </div>
                                        {selected.type && (
                                            <span className={`notif-type-badge type-${selected.type}`}>
                                                {selected.type}
                                            </span>
                                        )}
                                        <div className="notif-detail-body">
                                            {selected.message || selected.body || '(Không có nội dung)'}
                                        </div>
                                    </>
                                ) : (
                                    <div className="notif-empty-detail">
                                        <i className="fas fa-inbox"></i>
                                        <p>Chọn một thông báo bên phải để xem chi tiết</p>
                                    </div>
                                )}
                            </div>

                            {/* MIDDLE — List */}
                            <div className="notif-list-col">
                                {loading ? (
                                    <div className="notif-loading">
                                        <i className="fas fa-spinner fa-spin"></i> Đang tải...
                                    </div>
                                ) : items.length === 0 ? (
                                    <div className="notif-empty">Không có thông báo nào</div>
                                ) : (
                                    items.map((n, i) => {
                                        const id = n._id || n.id || i;
                                        const isSel = id === selectedId;
                                        return (
                                            <div
                                                key={id}
                                                className={`notif-card ${n.read ? 'read' : 'unread'} ${isSel ? 'selected' : ''}`}
                                                onClick={() => setSelectedId(id)}
                                            >
                                                <div className="notif-card-row">
                                                    <span className="notif-card-title">{n.title}</span>
                                                    {!n.read && <span className="notif-card-dot" />}
                                                </div>
                                                <div className="notif-card-time">{fmtTime(n.createdAt)}</div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* RIGHT — Sidebar categories */}
                            <div className="notif-sidebar">
                                {TABS.map(t => (
                                    <button
                                        key={t.key}
                                        className={`notif-side-tab ${tab === t.key ? 'active' : ''}`}
                                        onClick={() => changeTab(t.key)}
                                    >
                                        <i className={`fas ${t.icon}`}></i>
                                        <span>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="notif-modal-footer">
                            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
                                Đóng
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={async () => {
                                    if (!window.confirm('Xoá toàn bộ thông báo? Không thể hoàn tác.')) return;
                                    await deleteAll();
                                    setSelectedId(null);
                                }}
                                disabled={items.length === 0}
                            >
                                <i className="fas fa-trash"></i> Xoá tất cả
                            </button>
                            <button className="btn btn-primary" onClick={markAllRead}>
                                <i className="fas fa-check-double"></i> Đánh dấu đã đọc tất cả
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
