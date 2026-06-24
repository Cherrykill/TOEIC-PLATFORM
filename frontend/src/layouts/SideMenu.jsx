import { useEffect } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { useAuth } from '@components/auth/AuthContext.jsx';
import { useMenuBadges } from './useMenuBadges.js';

const MENU_ITEMS = [
    { label: 'Luyện tập TOEIC',icon: 'fa-graduation-cap',   screen: 'toeic-screen',        hot: true },
    { label: 'Hồ sơ',          icon: 'fa-user',             screen: 'profile-screen' },
    { label: 'Nhiệm vụ',       icon: 'fa-tasks',            screen: 'quest-screen',        badgeKey: 'quest' },
    { label: 'Bảng xếp hạng',  icon: 'fa-trophy',           screen: 'leaderboard-screen',  badgeKey: 'online',       badgeStyle: 'info' },
    { label: 'Thành tích',     icon: 'fa-medal',            screen: 'achievements-screen', badgeKey: 'achievement' },
    { label: 'Thống kê',       icon: 'fa-chart-bar',        screen: 'statistics-screen',   badgeKey: 'statsExport',  badgeStyle: 'dot' },
    { label: 'Cửa hàng',       icon: 'fa-shopping-cart',    screen: 'shop-screen',         badgeKey: 'shopDiscount', badgeStyle: 'sale' },
    { label: 'Cài đặt',        icon: 'fa-cog',              screen: 'settings-screen' },
];

export default function SideMenu() {
    const { menuOpen, setMenuOpen, showScreen, currentScreen } = useGame();
    const { isLoggedIn, setAuthModal, logout } = useAuth();
    const { badges, refresh } = useMenuBadges(isLoggedIn);

    // Refresh badges each time the menu opens
    useEffect(() => { if (menuOpen) refresh(); }, [menuOpen, refresh]);

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
                    <div className="menu-header-auth">
                        {!isLoggedIn ? (
                            <>
                                <button
                                    id="login-menu-btn"
                                    className="menu-auth-btn login"
                                    onClick={() => { setAuthModal('login'); setMenuOpen(false); }}
                                >
                                    <i className="fas fa-sign-in-alt"></i> Đăng nhập
                                </button>
                                <button
                                    id="register-menu-btn"
                                    className="menu-auth-btn register"
                                    onClick={() => { setAuthModal('register'); setMenuOpen(false); }}
                                >
                                    <i className="fas fa-user-plus"></i> Đăng ký
                                </button>
                            </>
                        ) : (
                            <button id="logout-menu-btn" className="menu-auth-btn logout" onClick={logout}>
                                <i className="fas fa-sign-out-alt"></i> Đăng xuất
                            </button>
                        )}
                    </div>
                    <button id="close-menu-btn" className="icon-btn" onClick={() => setMenuOpen(false)}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Nav — matches .menu-nav in CSS */}
                <nav className="menu-nav">
                    {MENU_ITEMS.map(item => {
                        const n = item.badgeKey ? badges[item.badgeKey] : 0;
                        return (
                            <button
                                key={item.screen}
                                className={`menu-item${currentScreen === item.screen ? ' active' : ''}`}
                                data-screen={item.screen}
                                onClick={() => handleNav(item.screen)}
                            >
                                {item.hot && <span className="menu-item-hot">hot</span>}
                                <i className={`fas ${item.icon}`}></i>
                                <span>{item.label}</span>
                                {n > 0 && (
                                    item.badgeStyle === 'dot'
                                        ? <span className="menu-item-badge dot" title="Nên xuất báo cáo trước khi sang tháng mới" />
                                        : <span className={`menu-item-badge ${item.badgeStyle || 'reward'}`}>
                                            {n > 99 ? '99+' : n}
                                          </span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
}
