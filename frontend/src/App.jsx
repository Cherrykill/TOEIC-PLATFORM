import { useEffect, lazy, Suspense } from 'react';
import { GameProvider, useGame } from '@game/GameContext.jsx';
import { AuthProvider, useAuth } from '@components/auth/AuthContext.jsx';
import { applyUiTheme, applySavedColorTheme } from '@/services/theme.js';
import { STORAGE_KEYS } from '@/constants/storageKeys.js';
import './assets/styles/index.css';

import LoadingScreen from '@ui/LoadingScreen.jsx';
import TopNav from '@layouts/TopNav.jsx';
import StatusBar from '@layouts/StatusBar.jsx';
import SideMenu from '@layouts/SideMenu.jsx';
import Modal from '@ui/Modal.jsx';
import Toaster from '@ui/Toaster.jsx';
import SearchResults from '@components/search/SearchResults.jsx';
import AuthModal from '@components/auth/AuthModal.jsx';
import ExpiryNotice from '@components/vocab/upload/ExpiryNotice.jsx';

// Eager: Home (mặc định) + Practice (engine vanilla inject vào #practice-content,
// phải mount thường trực — không được unmount giữa chừng).
import HomeScreen from '@components/home/HomeScreen.jsx';
import PracticeScreen from '@components/practice/PracticeScreen.jsx';

// Lazy: các màn còn lại tách chunk riêng, chỉ tải khi mở. Chúng tự nạp lại dữ
// liệu khi mount (useEffect theo `active`) nên unmount khi rời màn là an toàn.
const ShopScreen         = lazy(() => import('@components/shop/ShopScreen.jsx'));
const QuestScreen        = lazy(() => import('@components/quest/QuestScreen.jsx'));
const LeaderboardScreen  = lazy(() => import('@components/leaderboard/LeaderboardScreen.jsx'));
const ProfileScreen      = lazy(() => import('@components/profile/ProfileScreen.jsx'));
const AchievementsScreen = lazy(() => import('@components/achievements/AchievementsScreen.jsx'));
const StatisticsScreen   = lazy(() => import('@components/statistics/StatisticsScreen.jsx'));
const SettingsScreen     = lazy(() => import('@components/settings/SettingsScreen.jsx'));
const ToeicScreen        = lazy(() => import('@components/toeic/ToeicScreen.jsx'));

// Bản đồ màn lazy → render có điều kiện (chỉ mount màn đang mở).
const LAZY_SCREENS = {
    'shop-screen': ShopScreen,
    'quest-screen': QuestScreen,
    'leaderboard-screen': LeaderboardScreen,
    'profile-screen': ProfileScreen,
    'achievements-screen': AchievementsScreen,
    'statistics-screen': StatisticsScreen,
    'settings-screen': SettingsScreen,
    'toeic-screen': ToeicScreen,
};

function ScreenFallback() {
    return (
        <div className="loading-state" style={{ textAlign: 'center', padding: 60 }}>
            <i className="fas fa-spinner fa-spin fa-2x"></i>
        </div>
    );
}

function AppInner() {
    const { initialized, currentScreen } = useGame();
    const { validateToken, isServerSynced } = useAuth();

    useEffect(() => {
        const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
        applyUiTheme(savedTheme);
        applySavedColorTheme();
    }, []);

    useEffect(() => {
        if (initialized) {
            validateToken();
            // User id is known after init — re-apply in case the saved
            // theme is stored under the per-user key.
            applySavedColorTheme();
        }
    }, [initialized, validateToken]);

    if (!initialized || !isServerSynced) {
        return <LoadingScreen />;
    }

    return (
        <div id="game-container" className="game-container">
            <TopNav />
            <StatusBar />

            <main id="main-content" className="main-content">
                {/* Luôn mount: Home + Practice */}
                <HomeScreen active={currentScreen === 'home-screen'} />
                <PracticeScreen active={currentScreen === 'practice-screen'} />
                {/* Lazy: chỉ mount màn đang mở */}
                {LAZY_SCREENS[currentScreen] && (
                    <Suspense fallback={<ScreenFallback />}>
                        {(() => {
                            const ActiveScreen = LAZY_SCREENS[currentScreen];
                            return <ActiveScreen active={true} />;
                        })()}
                    </Suspense>
                )}
            </main>

            <SideMenu />
            <Modal />
            <Toaster />
            <SearchResults />
            <AuthModal />
            <ExpiryNotice />
        </div>
    );
}

export default function App() {
    return (
        <GameProvider>
            <AuthProvider>
                <AppInner />
            </AuthProvider>
        </GameProvider>
    );
}
