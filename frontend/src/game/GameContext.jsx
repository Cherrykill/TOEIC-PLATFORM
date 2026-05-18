import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GameState } from '@game/state.js';
import { EventBus, GameEvents } from '@game/eventBus.js';
import { Config } from '@game/config.js';
import { Utils } from '@lib/utils.js';
import { Storage } from '@lib/storage.js';
import { API, Http } from '@api/http.js';
import { VocabularyAPI } from '@api/vocabulary.js';
import { GameLogic } from '@game/gameLogic.js';
import { GameLoop, EnergySystem, DailyQuestTimer, BoostChecker, AutoSave, GameSystems } from '@game/gameLoop.js';
import { Energy } from '@game/energy.js';
import { Quest } from '@components/quest/quest.js';
import { WrongWordsManager } from '@components/vocab/wrongWords/wrongWordsManager.js';
import { SessionService } from '@components/practice/sessionService.js';
import { PracticeManager } from '@components/practice/practiceManager.js';

const GameContext = createContext(null);

export function GameProvider({ children }) {
    const [initialized, setInitialized] = useState(false);
    const [user, setUser] = useState(null);
    const [resources, setResources] = useState({ energy: 100, maxEnergy: 100, coins: 0, gems: 0, hints: 0, shields: 0, timeFreezes: 0 });
    const [streak, setStreak] = useState({ current: 0, longest: 0 });
    const [settings, setSettings] = useState({});
    const [currentScreen, setCurrentScreen] = useState('home-screen');
    const [menuOpen, setMenuOpen] = useState(false);

    const syncFromState = useCallback(() => {
        const s = GameState.state;
        setUser({ ...s.user });
        setResources({ ...s.resources });
        setStreak({ ...s.streak });
        setSettings({ ...s.settings });
    }, []);

    useEffect(() => {
        // Expose core ES modules as window globals for vanilla JS compatibility
        window.GameState = GameState;
        window.Config = Config;
        window.Utils = Utils;
        window.EventBus = EventBus;
        window.GameEvents = GameEvents;
        window.Storage = Storage;
        window.API = API;
        window.Http = Http;
        window.PracticeManager = PracticeManager;
        window.UI = {
            showScreen: (screenId) => window._reactShowScreen?.(screenId),
            closeMenu: () => window._reactSetMenuOpen?.(false),
            toggleMenu: () => window._reactSetMenuOpen?.(open => !open),
        };

        GameState.init().then(() => {
            syncFromState();
            setInitialized(true);
        });

        const unsubs = [
            EventBus.on(GameEvents.USER_LEVEL_UP, syncFromState),
            EventBus.on(GameEvents.USER_XP_GAINED, syncFromState),
            EventBus.on(GameEvents.ENERGY_CHANGED, syncFromState),
            EventBus.on(GameEvents.COINS_CHANGED, syncFromState),
            EventBus.on(GameEvents.GEMS_CHANGED, syncFromState),
            EventBus.on(GameEvents.STREAK_UPDATED, syncFromState),
            EventBus.on(GameEvents.GAME_INITIALIZED, syncFromState),
            EventBus.on(GameEvents.USER_LOGIN, syncFromState),
            EventBus.on(GameEvents.USER_LOGOUT, syncFromState),
            // Canonical signal — new code uses GameState.commit() instead of
            // calling syncFromState() by hand.
            EventBus.on(GameEvents.STATE_CHANGED, syncFromState),
        ];

        return () => unsubs.forEach(fn => fn());
    }, [syncFromState]);

    const showScreen = useCallback((screenId) => {
        setCurrentScreen(screenId);
        setMenuOpen(false);
        EventBus.emit(GameEvents.SCREEN_CHANGED, { screen: screenId });
    }, []);

    // Keep window.UI in sync with React functions
    useEffect(() => {
        window._reactShowScreen = showScreen;
        window._reactSetMenuOpen = setMenuOpen;
        window._reactMenuOpen = menuOpen;
    }, [showScreen, setMenuOpen, menuOpen]);

    const value = {
        initialized,
        user,
        resources,
        streak,
        settings,
        currentScreen,
        menuOpen,
        setMenuOpen,
        showScreen,
        syncFromState,
        gameState: GameState,
    };

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
    const ctx = useContext(GameContext);
    if (!ctx) throw new Error('useGame must be used inside GameProvider');
    return ctx;
}
