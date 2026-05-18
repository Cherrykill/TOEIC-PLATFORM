import { useState, useEffect, useRef } from 'react';
import { useNotifications } from './useNotifications.js';

const TABS = [
    { key: 'all', label: 'Tất cả' },
    { key: 'system', label: 'Hệ thống' },
    { key: 'account', label: 'Tài khoản' },
    { key: 'violation', label: 'Vi phạm' },
];

export default function NotificationPanel({ isLoggedIn }) {
    const { badge, items, tab, loading, fetchItems, changeTab, markAllRead, setBadge } = useNotifications(isLoggedIn);
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handleClick = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    async function handleBellClick() {
        if (!open) {
            await fetchItems(tab);
            setBadge(0);
        }
        setOpen(o => !o);
    }

    return (
        <div className="notif-wrapper" ref={wrapperRef}>
            <button id="notif-btn" className="icon-btn" title="Thông báo" onClick={handleBellClick}>
                <i className="fas fa-bell"></i>
                {badge > 0 && <span id="notif-badge" className="notif-badge">{badge}</span>}
            </button>
            {open && (
                <div id="notif-panel" className="notif-panel">
                    <div className="notif-panel-header">
                        <span>Thông báo</span>
                        <button className="notif-read-all-btn" onClick={markAllRead}>
                            Đánh dấu đã đọc
                        </button>
                    </div>
                    <div className="notif-tabs">
                        {TABS.map(t => (
                            <button
                                key={t.key}
                                className={`notif-tab ${tab === t.key ? 'active' : ''}`}
                                data-tab={t.key}
                                onClick={() => changeTab(t.key)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div id="notif-list" className="notif-list">
                        {loading ? (
                            <div className="notif-loading"><i className="fas fa-spinner fa-spin"></i> Đang tải...</div>
                        ) : items.length === 0 ? (
                            <div className="notif-empty">Không có thông báo nào</div>
                        ) : items.map((n, i) => (
                            <div key={n._id || i} className={`notif-item ${n.read ? 'read' : 'unread'}`}>
                                <span>{n.title}</span>
                                <p>{n.message}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
