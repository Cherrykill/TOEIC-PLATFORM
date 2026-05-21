import { useState, useEffect } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { useAuth } from '@components/auth/AuthContext.jsx';
import { Quest } from '@components/quest/quest.js';
import { calculateProgress } from '@components/achievements/AchievementsScreen.jsx';
import { authHeaders } from '@/auth/token.js';
import { CheckinAPI } from '@api/checkin.js';

const menuItems = [
    { label: 'Hồ sơ',          icon: 'fa-user',             screen: 'profile-screen' },
    { label: 'Nhiệm vụ',       icon: 'fa-tasks',            screen: 'quest-screen',        badgeKey: 'quest' },
    { label: 'Bảng xếp hạng',  icon: 'fa-trophy',           screen: 'leaderboard-screen',  badgeKey: 'online',       badgeStyle: 'info' },
    { label: 'Thành tích',     icon: 'fa-medal',            screen: 'achievements-screen', badgeKey: 'achievement' },
    { label: 'Thống kê',       icon: 'fa-chart-bar',        screen: 'statistics-screen' },
    { label: 'Cửa hàng',       icon: 'fa-shopping-cart',    screen: 'shop-screen',         badgeKey: 'shopDiscount', badgeStyle: 'sale' },
    { label: 'Luyện tập TOEIC',icon: 'fa-graduation-cap',   screen: 'toeic-screen' },
    { label: 'Cài đặt',        icon: 'fa-cog',              screen: 'settings-screen' },
];

// Đếm quest đã hoàn thành nhưng chưa claim trên tất cả 4 loại quest hiện cache.
function countUnclaimedQuests() {
    let n = 0;
    for (const type of ['daily', 'weekly', 'monthly', 'special']) {
        const list = Quest.getQuests?.(type) || [];
        for (const q of list) if (q.completed && !q.claimedAt && !q.claimed) n++;
    }
    return n;
}

// Đếm thành tích claimable: chưa unlock + đã đạt target (theo evaluator FE).
function countClaimableAchievements() {
    const all = window.GameState?.state?.achievements || [];
    let n = 0;
    for (const ach of all) {
        if (ach.unlocked) continue;
        const { current } = calculateProgress(ach);
        if (current >= (ach.conditionValue || 1)) n++;
    }
    return n;
}

export default function SideMenu() {
    const { menuOpen, setMenuOpen, showScreen, currentScreen } = useGame();
    const { isLoggedIn, setAuthModal, logout } = useAuth();
    const [reverseMode, setReverseMode] = useState(false);
    const [badges, setBadges] = useState({ quest: 0, achievement: 0, online: 0, shopDiscount: 0 });

    // Mỗi lần mở menu (hoặc login state đổi): tính lại badge. Local data
    // (quest/achievement) lấy ngay từ cache; số online + shop discount gọi
    // API nhẹ. Đóng menu thì không fetch.
    useEffect(() => {
        if (!menuOpen) return;
        let cancelled = false;

        const unclaimedQuests = countUnclaimedQuests();
        setBadges(b => ({
            ...b,
            quest: unclaimedQuests,
            achievement: countClaimableAchievements(),
        }));

        if (!isLoggedIn) return;

        // Checkin due today?
        CheckinAPI.get().then(res => {
            if (cancelled || !res.success) return;
            const { currentDay, claimedDays } = res.data || {};
            const due = currentDay > 0 && !(claimedDays || []).includes(currentDay);
            if (due) setBadges(b => ({ ...b, quest: b.quest + 1 }));
        }).catch(() => {});

        // Online users
        fetch('/api/leaderboard/online-count', { headers: authHeaders() })
            .then(r => r.json())
            .then(res => { if (!cancelled && res?.success) setBadges(b => ({ ...b, online: res.count || 0 })); })
            .catch(() => {});

        // Shop discounted item count
        fetch('/api/shop/items', { headers: authHeaders() })
            .then(r => r.json())
            .then(res => {
                if (cancelled) return;
                const items = res?.items || res?.data || [];
                const n = items.filter(it => (it.discountPercent || 0) > 0).length;
                setBadges(b => ({ ...b, shopDiscount: n }));
            })
            .catch(() => {});

        return () => { cancelled = true; };
    }, [menuOpen, isLoggedIn]);

    useEffect(() => {
        const saved = window.GameState?.state?.settings?.reverseMode || false;
        setReverseMode(saved);
        window._reactSetReverseMode = setReverseMode;
        return () => { delete window._reactSetReverseMode; };
    }, []);

    const handleReverseMode = () => {
        const next = !reverseMode;
        setReverseMode(next);
        if (window.GameState) {
            window.GameState.state.settings.reverseMode = next;
            window.GameState.save?.();
        }
        window.Notification?.info?.('Đảo chiều', next ? 'VN → EN' : 'EN → VN');
    };

    const handleNav = (screen) => {
        showScreen(screen);
        setMenuOpen(false);
    };

    return (
        <>
            {/* Overlay — uses class "overlay" matching CSS */}
            <div
                id="menu-overlay"
                className={`overlay ${menuOpen ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
            />

            <aside id="side-menu" className={`side-menu ${menuOpen ? 'active' : ''}`}>
                <div className="menu-header">
                    <h3>Menu</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button id="reverse-mode-btn" className="icon-btn icon-btn--labeled" title="Đảo chiều EN ↔ VN" onClick={handleReverseMode}>
                            <i className="fas fa-right-left"></i>
                            <span className="icon-btn-label" id="reverse-mode-label">{reverseMode ? 'VN→EN' : 'EN→VN'}</span>
                        </button>
                        <button id="close-menu-btn" className="icon-btn" onClick={() => setMenuOpen(false)}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                {/* Nav — matches .menu-nav in CSS */}
                <nav className="menu-nav">
                    {menuItems.map(item => {
                        const n = item.badgeKey ? badges[item.badgeKey] : 0;
                        return (
                            <button
                                key={item.screen}
                                className={`menu-item${currentScreen === item.screen ? ' active' : ''}`}
                                data-screen={item.screen}
                                onClick={() => handleNav(item.screen)}
                            >
                                <i className={`fas ${item.icon}`}></i>
                                <span>{item.label}</span>
                                {n > 0 && (
                                    <span className={`menu-item-badge ${item.badgeStyle || 'reward'}`}>
                                        {n > 99 ? '99+' : n}
                                    </span>
                                )}
                            </button>
                        );
                    })}

                    <hr style={{ border: '1px solid var(--border-color)', margin: 'var(--spacing-md) 0' }} />

                    {!isLoggedIn ? (
                        <>
                            <button id="login-menu-btn" className="menu-item" onClick={() => { setAuthModal('login'); setMenuOpen(false); }}>
                                <i className="fas fa-sign-in-alt"></i>
                                <span>Đăng nhập</span>
                            </button>
                            <button id="register-menu-btn" className="menu-item" onClick={() => { setAuthModal('register'); setMenuOpen(false); }}>
                                <i className="fas fa-user-plus"></i>
                                <span>Đăng ký</span>
                            </button>
                        </>
                    ) : (
                        <button id="logout-menu-btn" className="menu-item" style={{ color: 'var(--error-color)' }} onClick={logout}>
                            <i className="fas fa-sign-out-alt"></i>
                            <span>Đăng xuất</span>
                        </button>
                    )}
                </nav>
            </aside>
        </>
    );
}
