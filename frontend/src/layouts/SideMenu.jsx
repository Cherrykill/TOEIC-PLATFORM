import { useState, useEffect } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { useAuth } from '@components/auth/AuthContext.jsx';

const menuItems = [
    { label: 'Hồ sơ', icon: 'fa-user', screen: 'profile-screen' },
    { label: 'Nhiệm vụ', icon: 'fa-tasks', screen: 'quest-screen' },
    { label: 'Bảng xếp hạng', icon: 'fa-trophy', screen: 'leaderboard-screen' },
    { label: 'Thành tích', icon: 'fa-medal', screen: 'achievements-screen' },
    { label: 'Thống kê', icon: 'fa-chart-bar', screen: 'statistics-screen' },
    { label: 'Cửa hàng', icon: 'fa-shopping-cart', screen: 'shop-screen' },
    { label: 'Luyện tập TOEIC', icon: 'fa-graduation-cap', screen: 'toeic-screen' },
    { label: 'Cài đặt', icon: 'fa-cog', screen: 'settings-screen' },
];

export default function SideMenu() {
    const { menuOpen, setMenuOpen, showScreen, currentScreen } = useGame();
    const { isLoggedIn, setAuthModal, logout } = useAuth();
    const [reverseMode, setReverseMode] = useState(false);

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
                    {menuItems.map(item => (
                        <button
                            key={item.screen}
                            className={`menu-item${currentScreen === item.screen ? ' active' : ''}`}
                            data-screen={item.screen}
                            onClick={() => handleNav(item.screen)}
                        >
                            <i className={`fas ${item.icon}`}></i>
                            <span>{item.label}</span>
                        </button>
                    ))}

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
