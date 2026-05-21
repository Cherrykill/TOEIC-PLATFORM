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

/** Số ngày còn lại đến lúc auto-xoá (TTL). null nếu không có expiresAt
 * hoặc đã quá hạn. */
function daysLeft(ts) {
    if (!ts) return null;
    const ms = new Date(ts).getTime() - Date.now();
    if (!isFinite(ms) || ms <= 0) return null;
    return Math.ceil(ms / 86400000);
}

export default function NotificationPanel({ isLoggedIn }) {
    const { badge, items, tab, loading, unreadByTab, seenIds, fetchItems, changeTab, markAllRead, deleteAll, deleteOne, markRead, setBadge } = useNotifications(isLoggedIn);
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
            // Mở panel → refresh list nhưng KHÔNG xoá badge ngay — badge giờ
            // bám unreadByTab.all, chỉ giảm khi user thực sự click vào card
            // (markRead) hoặc bấm "đánh dấu đã đọc tất cả".
            await fetchItems(tab);
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
                            {/* Đếm notif CÁ NHÂN (không gồm broadcast hệ thống).
                                Cap = 50 newest theo backend limit. Đặt sát X. */}
                            <span className="notif-count">
                                {items.filter(n => !n.isGlobal).length}/50
                            </span>
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
                                        <div className="notif-detail-actions">
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={async () => {
                                                    if (!window.confirm('Xoá thông báo này?')) return;
                                                    await deleteOne(selected._id || selected.id);
                                                    setSelectedId(null);
                                                }}
                                            >
                                                <i className="fas fa-trash"></i> Xoá
                                            </button>
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
                                        const sid = String(id);
                                        const isSel = id === selectedId;
                                        // Broadcast (isGlobal) đọc track qua localStorage seenIds;
                                        // personal đọc theo n.read trên server.
                                        const isUnread = n.isGlobal ? !seenIds.has(sid) : !n.read;
                                        return (
                                            <div
                                                key={id}
                                                className={`notif-card ${isUnread ? 'unread' : 'read'} ${isSel ? 'selected' : ''}`}
                                                onClick={() => { setSelectedId(id); if (isUnread) markRead(id); }}
                                            >
                                                {/* Chấm đỏ ở GÓC TRÊN PHẢI báo chưa đọc — kiểu game */}
                                                {isUnread && <span className="notif-card-unread-pip" />}
                                                <div className="notif-card-row">
                                                    <span className="notif-card-title">{n.title}</span>
                                                </div>
                                                <div className="notif-card-time">
                                                    {fmtTime(n.createdAt)}
                                                    {(() => {
                                                        const d = daysLeft(n.expiresAt);
                                                        return d != null ? <span className="notif-card-ttl"> · còn {d} ngày</span> : null;
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* RIGHT — Sidebar categories */}
                            <div className="notif-sidebar">
                                {TABS.map(t => {
                                    const n = unreadByTab?.[t.key] || 0;
                                    return (
                                        <button
                                            key={t.key}
                                            className={`notif-side-tab ${tab === t.key ? 'active' : ''}`}
                                            onClick={() => changeTab(t.key)}
                                        >
                                            <i className={`fas ${t.icon}`}></i>
                                            <span>{t.label}</span>
                                            {n > 0 && <span className="notif-side-pip" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="notif-modal-footer">
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
