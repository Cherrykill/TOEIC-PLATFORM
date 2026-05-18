import { useEffect } from 'react';
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

import HomeScreen from '@components/home/HomeScreen.jsx';
import PracticeScreen from '@components/practice/PracticeScreen.jsx';
import ShopScreen from '@components/shop/ShopScreen.jsx';
import QuestScreen from '@components/quest/QuestScreen.jsx';
import LeaderboardScreen from '@components/leaderboard/LeaderboardScreen.jsx';
import ProfileScreen from '@components/profile/ProfileScreen.jsx';
import AchievementsScreen from '@components/achievements/AchievementsScreen.jsx';
import StatisticsScreen from '@components/statistics/StatisticsScreen.jsx';
import SettingsScreen from '@components/settings/SettingsScreen.jsx';
import ToeicScreen from '@components/toeic/ToeicScreen.jsx';

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
                <HomeScreen active={currentScreen === 'home-screen'} />
                <PracticeScreen active={currentScreen === 'practice-screen'} />
                <ShopScreen active={currentScreen === 'shop-screen'} />
                <QuestScreen active={currentScreen === 'quest-screen'} />
                <LeaderboardScreen active={currentScreen === 'leaderboard-screen'} />
                <ProfileScreen active={currentScreen === 'profile-screen'} />
                <AchievementsScreen active={currentScreen === 'achievements-screen'} />
                <StatisticsScreen active={currentScreen === 'statistics-screen'} />
                <SettingsScreen active={currentScreen === 'settings-screen'} />
                <ToeicScreen active={currentScreen === 'toeic-screen'} />
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
