import { useState, useCallback, useEffect } from 'react';

let _notify = null;

export const Notification = {
    show({ type = 'info', title, message, duration = 3000 }) {
        _notify?.({ type, title, message, duration });
    },
    success(message, title = 'Thành công') { this.show({ type: 'success', title, message }); },
    error(message, title = 'Lỗi') { this.show({ type: 'error', title, message }); },
    warning(message, title = 'Cảnh báo') { this.show({ type: 'warning', title, message }); },
    info(message, title = 'Thông tin') { this.show({ type: 'info', title, message }); },
};

export default function NotificationContainer() {
    const [notifications, setNotifications] = useState([]);

    const addNotification = useCallback((notif) => {
        const id = Date.now();
        setNotifications(prev => [...prev, { ...notif, id }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, notif.duration || 3000);
    }, []);

    useEffect(() => {
        _notify = addNotification;
        // Expose to vanilla JS via window bridge
        window._reactNotification = Notification;
        return () => { _notify = null; };
    }, [addNotification]);

    const iconMap = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };

    return (
        <div id="notification-container" className="notification-container">
            {notifications.map(n => (
                <div key={n.id} className={`notification ${n.type}`}>
                    <i className={`fas ${iconMap[n.type] || iconMap.info}`}></i>
                    <div className="notification-content">
                        {n.title && <strong>{n.title}</strong>}
                        {n.message && <p>{n.message}</p>}
                    </div>
                </div>
            ))}
        </div>
    );
}
