import { useState, useCallback, useEffect, useRef } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { useAuth } from '@components/auth/AuthContext.jsx';
import { EventBus, GameEvents } from '@game/eventBus.js';
import { PartSelector } from '@components/vocab/part/partSelector.js';
import NotificationPanel from '@components/notifications/NotificationPanel.jsx';
import FavoritesModal from '@components/favorites/FavoritesModal.jsx';
import TopicModal from '@components/vocab/topic/TopicModal.jsx';
import { openUploadModal } from '@components/vocab/upload/openUploadModal.js';
import SpinWheelModal from '@components/spin/SpinWheelModal.jsx';

export default function TopNav() {
    const { user, setMenuOpen, showScreen, menuOpen, currentScreen } = useGame();
    // Đang luyện tập (vocab session hoặc đề TOEIC) → khoá thanh tìm kiếm
    // để khỏi vô tình mở search rồi gián đoạn bài.
    const isInPractice = currentScreen === 'practice-screen' || currentScreen === 'toeic-test-screen';
    const { isLoggedIn, setAuthModal } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    // readOnly cho tới khi user tương tác → chặn Edge autofill email lúc load trang
    const [searchReadOnly, setSearchReadOnly] = useState(true);
    const [favOpen, setFavOpen] = useState(false);
    const [topicOpen, setTopicOpen] = useState(false);
    const [spinOpen, setSpinOpen] = useState(false);
    const [spinAvailable, setSpinAvailable] = useState(false);
    const pendingModeRef = useRef(null);
    const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');

    // Mở popup chọn đề khi user click 1 chế độ mà chưa chọn đề
    useEffect(() => {
        const unsub = EventBus.on(GameEvents.TOPIC_MODAL_REQUESTED, ({ pendingMode } = {}) => {
            pendingModeRef.current = pendingMode || null;
            setTopicOpen(true);
        });
        return unsub;
    }, []);

    const handleTopicSelected = useCallback(() => {
        const mode = pendingModeRef.current;
        pendingModeRef.current = null;
        if (mode) {
            // Chọn đề xong → mở Part selector với pendingMode,
            // PartSelector.selectPart() sẽ emit PRACTICE_REQUESTED sau khi user chọn part.
            setTimeout(() => {
                PartSelector.pendingMode = mode;
                PartSelector.showPartSelectionModal();
            }, 200);
        }
    }, []);

    const handleTopicClose = useCallback(() => {
        // Đóng mà không chọn → bỏ pending, không auto-start
        pendingModeRef.current = null;
        setTopicOpen(false);
    }, []);

    const handlePartSelector = useCallback(() => {
        PartSelector.showPartSelectionModal();
    }, []);


    // Expose spin opener globally + check availability
    useEffect(() => {
        window._openSpinWheel = () => { setSpinOpen(true); setSpinAvailable(false); };
        return () => { delete window._openSpinWheel; };
    }, []);

    useEffect(() => {
        const token = user ? localStorage.getItem('authToken') : null;
        if (!token) return;
        const parsed = (() => { try { return JSON.parse(token); } catch { return {}; } })();
        const t = parsed.token || token;
        if (!t) return;
        fetch('/api/spin/status', { headers: { Authorization: `Bearer ${t}` } })
            .then(r => r.json())
            .then(d => { if (d.success) setSpinAvailable(d.canSpin); })
            .catch(() => {});
    }, [user]);

    const avatarSrc = user?.avatar;
    const isAvatarImg = avatarSrc && (avatarSrc.startsWith('data:image') || avatarSrc.startsWith('http') || avatarSrc.startsWith('/'));

    return (
        <>
        <nav className={`top-nav${searchFocused ? ' search-active' : ''}`}>
            <div className="nav-left">
                <button id="menu-btn" className="icon-btn" onClick={() => setMenuOpen(!menuOpen)}>
                    <i className="fas fa-bars"></i>
                </button>
                <button id="home-btn" className="icon-btn nav-home-btn" title="Trang chủ" onClick={() => showScreen('home-screen')}>
                    <i className="fas fa-home"></i>
                </button>

                <NotificationPanel isLoggedIn={isLoggedIn} />

                <div className="user-info" onClick={() => showScreen('home-screen')} style={{ cursor: 'pointer' }}>
                    <div className="avatar-small" id="user-avatar">
                        {isAvatarImg
                            ? <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            : (avatarSrc || user?.username?.charAt(0)?.toUpperCase() || 'P')
                        }
                    </div>
                    <div className="user-details">
                        <span id="username" className="username">{user?.username || 'Player'}</span>
                        <div className="level-badge">
                            <i className="fas fa-star"></i>
                            <span>Level </span>
                            <span id="user-level">{user?.level || 1}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="nav-center">
                <div className={`search-bar ${isInPractice ? 'disabled' : ''}`}>
                    <i className={`fas ${isInPractice ? 'fa-lock' : 'fa-search'}`}></i>
                    <input
                        type="text"
                        id="search-input"
                        placeholder={isInPractice ? 'Đang luyện tập — tạm khoá tìm kiếm' : 'Tìm từ vựng...'}
                        autoComplete="off"
                        readOnly={searchReadOnly || isInPractice}
                        disabled={isInPractice}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onFocus={() => { setSearchReadOnly(false); setSearchFocused(true); }}
                        onMouseDown={() => setSearchReadOnly(false)}
                        onBlur={() => setSearchFocused(false)}
                    />
                    {searchQuery && !isInPractice && (
                        <button id="clear-search-btn" className="clear-search-btn" onClick={() => { setSearchQuery(''); window._reactClearSearch?.(); }}>
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
            </div>

            <div className="nav-right">
                <button id="nav-favorite-btn" className="icon-btn" title="Danh sách từ yêu thích" onClick={() => setFavOpen(true)}>
                    <i className="fas fa-star"></i>
                </button>
                <button id="topic-selector-btn" className="icon-btn" title="Chọn chủ đề từ vựng" onClick={() => setTopicOpen(true)}>
                    <i className="fas fa-book"></i>
                </button>
                <button id="part-selector-btn" className="icon-btn" title="Chọn Part" onClick={handlePartSelector}>
                    <i className="fas fa-layer-group"></i>
                </button>
                <button id="upload-btn" className="icon-btn" title="Tải lên từ vựng" onClick={openUploadModal}>
                    <i className="fas fa-cloud-upload-alt"></i>
                </button>
                <button
                    id="theme-toggle-btn"
                    className="icon-btn"
                    title={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
                    onClick={() => {
                        const newTheme = isDark ? 'light' : 'dark';
                        document.documentElement.setAttribute('data-theme', newTheme);
                        localStorage.setItem('theme', newTheme);
                        setIsDark(!isDark);
                    }}
                >
                    <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'}`}></i>
                </button>
            </div>
        </nav>
        <FavoritesModal open={favOpen} onClose={() => setFavOpen(false)} />
        <TopicModal open={topicOpen} onClose={handleTopicClose} onSelected={handleTopicSelected} />
        <SpinWheelModal open={spinOpen} onClose={() => setSpinOpen(false)} />
        </>
    );
}
