import { useState, useEffect, useCallback } from 'react';
import { NotificationsAPI } from '@api/notifications.js';

export function useNotifications(isLoggedIn) {
    const [badge, setBadge] = useState(0);
    const [items, setItems] = useState([]);
    const [tab, setTab] = useState('all');
    const [loading, setLoading] = useState(false);

    const loadBadge = useCallback(async () => {
        if (!isLoggedIn) { setBadge(0); return; }
        const res = await NotificationsAPI.unreadCount();
        setBadge(res.success ? (res.data?.count ?? 0) : 0);
    }, [isLoggedIn]);

    const fetchItems = useCallback(async (forTab) => {
        setLoading(true);
        const res = await NotificationsAPI.list(forTab);
        if (res.success) setItems(res.data || []);
        setLoading(false);
    }, []);

    const changeTab = useCallback(async (nextTab) => {
        setTab(nextTab);
        await fetchItems(nextTab);
    }, [fetchItems]);

    const markAllRead = useCallback(async () => {
        await NotificationsAPI.markAllRead();
        setBadge(0);
        setItems(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const deleteAll = useCallback(async () => {
        const res = await NotificationsAPI.deleteAll();
        if (res.success) {
            setItems([]);
            setBadge(0);
        }
        return res;
    }, []);

    useEffect(() => { loadBadge(); }, [loadBadge]);

    return { badge, items, tab, loading, loadBadge, fetchItems, changeTab, markAllRead, deleteAll, setBadge };
}
