// ===================================
// SETTINGS UI MODULE - FIXED WITH SERVER SYNC
// ===================================

const SettingsUI = {

    COLOR_PRESETS: [
        { name: 'Hồng đỏ',   primary: '#E11D48', secondary: '#F97316' },
        { name: 'Tím hồng',  primary: '#7C3AED', secondary: '#EC4899' },
        { name: 'Xanh biển', primary: '#0EA5E9', secondary: '#6366F1' },
        { name: 'Xanh lá',   primary: '#16A34A', secondary: '#0D9488' },
        { name: 'Cam vàng',  primary: '#F97316', secondary: '#EAB308' },
        { name: 'Tím đậm',   primary: '#9333EA', secondary: '#C026D3' },
        { name: 'Ngọc lam',  primary: '#0D9488', secondary: '#06B6D4' },
        { name: 'Đêm xanh',  primary: '#1D4ED8', secondary: '#7C3AED' },
    ],

    /**
     * Initialize Settings UI
     */
    async init() {
        this.loadSettings();
        this.attachListeners();
        await this.initTheme();
        this.initColorTheme();
        this._initChangePassword();
        this._initPasswordToggles();
        this._initSettingsNav();
        this._initReportForm();
    },

    _initSettingsNav() {
        const navItems = document.querySelectorAll('.settings-nav-item');
        const panels   = document.querySelectorAll('.settings-panel');
        if (!navItems.length) return;

        navItems.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;

                navItems.forEach(b => b.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));

                btn.classList.add('active');
                const target = document.getElementById(`settings-tab-${tab}`);
                if (target) target.classList.add('active');

                // Close drawer on mobile after selecting a tab
                if (window.innerWidth <= 640) {
                    UI.closeSettingsNav();
                }
            });
        });
    },

    /**
     * Initialize theme
     */
    async initTheme() {
        const savedTheme = (await Storage.get('theme')) || 'light';
        console.log('🎨 Loading saved theme:', savedTheme);
        this.applyTheme(savedTheme);
    },

    /**
     * Load current settings
     */
    loadSettings() {
        const state = GameState.state;
        let settings = state.settings;

        // ✅ FIX: Merge settings từ localStorage backup (ưu tiên localStorage nếu có)
        try {
            const localSettings = JSON.parse(localStorage.getItem('userSettings') || '{}');
            if (Object.keys(localSettings).length > 0) {
                console.log('%c💾 Found localStorage settings backup:', 'color: lime', localSettings);
                // Merge localStorage vào settings (localStorage ưu tiên)
                settings = { ...settings, ...localSettings };
                // Cập nhật lại GameState
                Object.assign(GameState.state.settings, localSettings);
            }
        } catch (e) {
            console.warn('Failed to load settings from localStorage:', e);
        }

        console.log('%c📖 Loading settings (merged):', 'color: cyan', settings);

        // Sound effects
        const soundToggle = document.getElementById('sound-effects-toggle');
        if (soundToggle) {
            soundToggle.checked = settings.soundEnabled !== false;
        }

        // Volume
        const volumeSlider = document.getElementById('volume-slider');
        const volumeValue = document.querySelector('.volume-value');
        if (volumeSlider && volumeValue) {
            volumeSlider.value = settings.volume || 70;
            volumeValue.textContent = (settings.volume || 70) + '%';
        }

        // Auto pronunciation
        const autoPronToggle = document.getElementById('auto-pronunciation-toggle');
        if (autoPronToggle) {
            autoPronToggle.checked = settings.autoPronunciation || false;
        }

        // Practice sound - ĐỌC TỪ LOCALSTORAGE (không từ server)
        const practiceSoundToggle = document.getElementById('practice-sound-toggle');
        if (practiceSoundToggle) {
            const savedValue = localStorage.getItem('practiceSoundEnabled');
            let isEnabled = true; // Default to true

            if (savedValue !== null) {
                isEnabled = JSON.parse(savedValue);
            }

            // Cập nhật cả GameState (in memory) và UI
            GameState.state.settings.practiceSoundEnabled = isEnabled;
            practiceSoundToggle.checked = isEnabled;
            console.log('🔊 Practice sound toggle loaded from localStorage:', isEnabled);
        }

        // Reverse mode EN↔VN
        const reverseToggle = document.getElementById('reverse-mode-toggle');
        if (reverseToggle) {
            reverseToggle.checked = localStorage.getItem('reverseMode') === 'true';
        }
        this._updateReverseModeBtn();

        // Questions per session
        const questionsInput = document.getElementById('questions-per-session');
        if (questionsInput) {
            questionsInput.value = settings.questionsPerSession || Config.practice?.questionsPerSession || 10;
        }

        // Sync với quick questions selector trên navbar
        const quickQuestionsSelect = document.getElementById('quick-questions-select');
        if (quickQuestionsSelect) {
            quickQuestionsSelect.value = settings.questionsPerSession || Config.practice?.questionsPerSession || 10;
        }

        // Time limit enabled toggle
        const timeLimitToggle = document.getElementById('time-limit-enabled-toggle');
        if (timeLimitToggle) {
            timeLimitToggle.checked = settings.timeLimitEnabled !== false; // Default: true
        }

        // Time per question
        const timeInput = document.getElementById('time-per-question');
        if (timeInput) {
            timeInput.value = settings.timePerQuestion || Config.practice?.timePerQuestion || 30;
        }

        // Difficulty
        const difficultySelect = document.getElementById('difficulty-level');
        if (difficultySelect) {
            // ✅ FIX: Khôi phục difficulty từ saved state
            // Nếu difficulty không có, kiểm tra levelFilter để suy ra difficulty
            let difficulty = settings.difficulty;

            // Nếu không có difficulty nhưng có levelFilter, suy ra từ levelFilter
            if (!difficulty && settings.levelFilter !== undefined) {
                if (settings.levelFilter === null) {
                    difficulty = 'adaptive';
                } else if (Array.isArray(settings.levelFilter)) {
                    if (settings.levelFilter.includes('A1')) difficulty = 'easy';
                    else if (settings.levelFilter.includes('B1')) difficulty = 'medium';
                    else if (settings.levelFilter.includes('C1')) difficulty = 'hard';
                }
            }

            // Fallback về adaptive nếu vẫn không xác định được
            difficulty = difficulty || 'adaptive';

            console.log(`🎯 Restoring difficulty: "${difficulty}", levelFilter:`, settings.levelFilter);

            // Set dropdown value
            difficultySelect.value = difficulty;

            // ✅ Đồng bộ levelFilter dựa trên difficulty
            let levelFilter = null;
            switch(difficulty) {
                case 'easy':
                    levelFilter = ['A1', 'A2'];
                    break;
                case 'medium':
                    levelFilter = ['B1', 'B2'];
                    break;
                case 'hard':
                    levelFilter = ['C1', 'C2'];
                    break;
                case 'adaptive':
                    levelFilter = null;
                    break;
            }

            // Cập nhật cả difficulty và levelFilter vào GameState
            GameState.state.settings.difficulty = difficulty;
            GameState.state.settings.levelFilter = levelFilter;

            console.log(`✅ Settings synchronized: difficulty="${difficulty}", levelFilter:`, levelFilter);

            // ✅ Sync với quick difficulty selector trên navbar
            const quickSelect = document.getElementById('quick-difficulty-select');
            if (quickSelect) {
                quickSelect.value = difficulty;
                console.log(`✅ Quick selector synced: "${difficulty}"`);
            }
        }

        // Auto sync
        const autoSyncToggle = document.getElementById('auto-sync-toggle');
        if (autoSyncToggle) {
            autoSyncToggle.checked = settings.autoSync !== false;
        }

        // Theme
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            const savedTheme = Storage.get('theme') || 'light';
            themeSelect.value = savedTheme;
        }
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        // Custom color apply button
        const applyColorBtn = document.getElementById('apply-custom-color-btn');
        if (applyColorBtn) {
            applyColorBtn.addEventListener('click', () => {
                const primary = document.getElementById('custom-primary-color')?.value || '#E11D48';
                const secondary = document.getElementById('custom-secondary-color')?.value || '#F97316';
                this.applyColorTheme(primary, secondary);

                // Bỏ active tất cả preset khi dùng custom
                document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
            });
        }



        // Sound effects toggle
        const soundToggle = document.getElementById('sound-effects-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('change', async (e) => {
                await this.updateSetting('soundEnabled', e.target.checked);
            });
        }

        // Volume slider
        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', async (e) => {
                const value = e.target.value;
                const volumeValue = document.querySelector('.volume-value');
                if (volumeValue) {
                    volumeValue.textContent = value + '%';
                }
                await this.updateSetting('volume', parseInt(value));
            });
        }

        // Auto pronunciation
        const autoPronToggle = document.getElementById('auto-pronunciation-toggle');
        if (autoPronToggle) {
            autoPronToggle.addEventListener('change', async (e) => {
                await this.updateSetting('autoPronunciation', e.target.checked);
            });
        }

        // Practice sound toggle - LƯU LOCALSTORAGE THÔI, KHÔNG LÊN SERVER
        const practiceSoundToggle = document.getElementById('practice-sound-toggle');
        if (practiceSoundToggle) {
            practiceSoundToggle.addEventListener('change', async (e) => {
                const newValue = e.target.checked;
                console.log(`🔊 Saving practiceSoundEnabled to localStorage: ${newValue}`);

                // Lưu vào GameState (in memory)
                GameState.state.settings.practiceSoundEnabled = newValue;

                // Lưu riêng vào localStorage (không qua server)
                localStorage.setItem('practiceSoundEnabled', JSON.stringify(newValue));

                Notification.show({
                    type: 'success',
                    title: 'Đã lưu',
                    message: newValue ?
                        'Âm thanh luyện tập đã bật' :
                        'Âm thanh luyện tập đã tắt',
                });
            });
        }

        // Reverse mode EN↔VN
        const reverseModeToggle = document.getElementById('reverse-mode-toggle');
        if (reverseModeToggle) {
            reverseModeToggle.addEventListener('change', (e) => {
                this._applyReverseMode(e.target.checked);
            });
        }

        // Nav reverse button
        const reverseModeBtn = document.getElementById('reverse-mode-btn');
        if (reverseModeBtn) {
            this._updateReverseModeBtn();
            reverseModeBtn.addEventListener('click', () => {
                const current = localStorage.getItem('reverseMode') === 'true';
                this._applyReverseMode(!current);
            });
        }

        // Questions per session
        const questionsInput = document.getElementById('questions-per-session');
        if (questionsInput) {
            questionsInput.addEventListener('change', async (e) => {
                const raw = e.target.value;
                const value = raw === 'auto' ? 'auto' : parseInt(raw);
                await this.updateSetting('questionsPerSession', value);
                if (typeof Config !== 'undefined' && Config.practice) {
                    Config.practice.questionsPerSession = value;
                }
                if (typeof PartSelector !== 'undefined') PartSelector.updateSessionBadge();
                // Sync với quick questions selector trên navbar
                const quickSelect = document.getElementById('quick-questions-select');
                if (quickSelect && quickSelect.value !== raw) {
                    quickSelect.value = raw;
                }
            });
        }

        // Quick Questions Selector trên Navbar
        const quickQuestionsSelect = document.getElementById('quick-questions-select');
        if (quickQuestionsSelect) {
            quickQuestionsSelect.addEventListener('change', async (e) => {
                const raw = e.target.value;
                const value = raw === 'auto' ? 'auto' : parseInt(raw);

                await this.updateSetting('questionsPerSession', value);
                if (typeof Config !== 'undefined' && Config.practice) {
                    Config.practice.questionsPerSession = value;
                }

                // Sync với settings dropdown
                const settingsSelect = document.getElementById('questions-per-session');
                if (settingsSelect && settingsSelect.value !== raw) {
                    settingsSelect.value = raw;
                }

                Notification.show({
                    type: 'success',
                    title: 'Số câu hỏi',
                    message: raw === 'auto' ? 'Toàn bộ: dùng toàn bộ từ khả dụng' : `Đã chọn: ${value} câu/lượt`,
                });
            });
        }

        // Time limit enabled toggle
        const timeLimitToggle = document.getElementById('time-limit-enabled-toggle');
        if (timeLimitToggle) {
            timeLimitToggle.addEventListener('change', async (e) => {
                await this.updateSetting('timeLimitEnabled', e.target.checked, { silent: true });
                Notification.show({
                    type: 'success',
                    title: 'Đã lưu',
                    message: e.target.checked ?
                        'Đã bật giới hạn thời gian' :
                        'Đã tắt giới hạn thời gian',
                });
            });
        }

        // Time per question
        const timeInput = document.getElementById('time-per-question');
        if (timeInput) {
            timeInput.addEventListener('change', async (e) => {
                const value = parseInt(e.target.value);
                await this.updateSetting('timePerQuestion', value);
                if (typeof Config !== 'undefined' && Config.practice) {
                    Config.practice.timePerQuestion = value;
                }
            });
        }

        // Difficulty
        const difficultySelect = document.getElementById('difficulty-level');
        if (difficultySelect) {
            difficultySelect.addEventListener('change', async (e) => {
                const value = e.target.value;

                // Map difficulty to CEFR levels
                let levelFilter = null;
                switch(value) {
                    case 'easy':
                        levelFilter = ['A1', 'A2'];
                        break;
                    case 'medium':
                        levelFilter = ['B1', 'B2'];
                        break;
                    case 'hard':
                        levelFilter = ['C1', 'C2'];
                        break;
                    case 'adaptive':
                        levelFilter = null; // Tất cả levels
                        break;
                }

                console.log(`⚙️ Difficulty changed to "${value}", levelFilter:`, levelFilter);

                // Lưu cả 2 settings với silent=true để không hiện notification trùng
                await this.updateSetting('difficulty', value, { silent: true });
                await this.updateSetting('levelFilter', levelFilter, { silent: true });

                // Verify settings were saved
                console.log('✅ Settings after save:', {
                    difficulty: GameState.state.settings.difficulty,
                    levelFilter: GameState.state.settings.levelFilter
                });

                if (typeof Config !== 'undefined' && Config.practice) {
                    Config.practice.difficulty = value;
                    Config.practice.levelFilter = levelFilter;
                }

                // Chỉ hiện 1 notification duy nhất
                Notification.show({
                    type: 'success',
                    title: 'Đã lưu',
                    message: `Độ khó: ${e.target.options[e.target.selectedIndex].text}`,
                });

                // ✅ Sync với quick difficulty selector trên navbar
                const quickSelect = document.getElementById('quick-difficulty-select');
                if (quickSelect && quickSelect.value !== value) {
                    quickSelect.value = value;
                }
            });
        }

        // ✅ Quick Difficulty Selector trên Navbar
        const quickDifficultySelect = document.getElementById('quick-difficulty-select');
        if (quickDifficultySelect) {
            quickDifficultySelect.addEventListener('change', async (e) => {
                const value = e.target.value;

                // Map difficulty to CEFR levels
                let levelFilter = null;
                switch(value) {
                    case 'easy':
                        levelFilter = ['A1', 'A2'];
                        break;
                    case 'medium':
                        levelFilter = ['B1', 'B2'];
                        break;
                    case 'hard':
                        levelFilter = ['C1', 'C2'];
                        break;
                    case 'adaptive':
                        levelFilter = null;
                        break;
                }

                console.log(`⚡ Quick difficulty changed to "${value}"`);

                // Lưu settings
                await this.updateSetting('difficulty', value, { silent: true });
                await this.updateSetting('levelFilter', levelFilter, { silent: true });

                if (typeof Config !== 'undefined' && Config.practice) {
                    Config.practice.difficulty = value;
                    Config.practice.levelFilter = levelFilter;
                }

                // Sync với settings dropdown
                const settingsSelect = document.getElementById('difficulty-level');
                if (settingsSelect && settingsSelect.value !== value) {
                    settingsSelect.value = value;
                }

                // Notification
                Notification.show({
                    type: 'success',
                    title: 'Độ khó',
                    message: `Đã chọn: ${e.target.options[e.target.selectedIndex].text}`,
                });
            });
        }

        // Auto sync
        const autoSyncToggle = document.getElementById('auto-sync-toggle');
        if (autoSyncToggle) {
            autoSyncToggle.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                await this.updateSetting('autoSync', enabled);
                Notification.show({
                    type: enabled ? 'success' : 'info',
                    title: enabled ? 'Đồng bộ đã bật' : 'Đồng bộ đã tắt',
                    message: enabled
                        ? 'Tiến độ sẽ tự động lưu lên cloud sau mỗi phiên chơi'
                        : 'Chỉ lưu trên thiết bị này. Dùng "Sao lưu dữ liệu" để lưu thủ công',
                });
            });
        }

        // Backup data
        const backupBtn = document.getElementById('backup-data-btn');
        if (backupBtn) {
            backupBtn.addEventListener('click', () => {
                this.backupData();
            });
        }

        // Restore data
        const restoreBtn = document.getElementById('restore-data-btn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                this.restoreData();
            });
        }

        // Reset progress
        const resetBtn = document.getElementById('reset-progress-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetProgress();
            });
        }

        // Language select
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            langSelect.addEventListener('change', (e) => {
                this.changeLanguage(e.target.value);
            });
        }

        // Theme select
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.changeTheme(e.target.value);
            });
        }

        // Voice select - populate with available voices
        this.initVoiceSelector();

        // Test voice button
        document.getElementById('voice-test-btn')?.addEventListener('click', () => {
            GameLogic.speakWord('Hello, this is a voice test.');
        });

        // Speech rate slider
        const speechRateSlider = document.getElementById('speech-rate-slider');
        if (speechRateSlider) {
            const savedRate = localStorage.getItem('toeic_speech_rate') || '80';
            speechRateSlider.value = savedRate;
            const rateLabel = document.querySelector('.speech-rate-value');
            if (rateLabel) rateLabel.textContent = (parseInt(savedRate) / 100).toFixed(1) + 'x';

            speechRateSlider.addEventListener('input', (e) => {
                const val = e.target.value;
                localStorage.setItem('toeic_speech_rate', val);
                if (rateLabel) rateLabel.textContent = (parseInt(val) / 100).toFixed(1) + 'x';
            });

            // Test voice on release
            speechRateSlider.addEventListener('change', () => {
                if (window.GameLogic) window.GameLogic.speakWord('hello');
            });
        }
    },

    /**
     * Initialize voice selector dropdown
     */
    initVoiceSelector() {
        const voiceSelect = document.getElementById('voice-select');
        if (!voiceSelect) return;

        // Known female/male voice names for labeling
        const femaleNames = ['zira', 'hazel', 'susan', 'samantha', 'karen', 'moira', 'tessa', 'fiona', 'victoria', 'allison', 'ava', 'aria', 'jenny', 'sara', 'natasha', 'linda', 'catherine', 'emily', 'sonia', 'libby', 'ana', 'michelle', 'female'];
        const maleNames = ['david', 'mark', 'daniel', 'james', 'alex', 'tom', 'fred', 'ralph', 'george', 'ryan', 'guy', 'rishi', 'liam', 'william', 'male'];

        const getGender = (name) => {
            const lower = name.toLowerCase();
            if (femaleNames.some(f => lower.includes(f))) return 'Nu';
            if (maleNames.some(m => lower.includes(m))) return 'Nam';
            return '';
        };

        const populateVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            const enVoices = voices.filter(v => v.lang.startsWith('en'));

            if (enVoices.length === 0) return;

            // Sort: female first, then male, then unknown
            enVoices.sort((a, b) => {
                const gA = getGender(a.name);
                const gB = getGender(b.name);
                if (gA === 'Nu' && gB !== 'Nu') return -1;
                if (gA !== 'Nu' && gB === 'Nu') return 1;
                return a.name.localeCompare(b.name);
            });

            voiceSelect.innerHTML = '';

            // Neural TTS voices - 4 TOEIC accents
            const neuralVoices = [
                { value: '__gtts_random__', label: 'TOEIC Tu dong (Random 4 giong)' },
                { value: '__gtts_us__', label: 'Aria - American (My)' },
                { value: '__gtts_uk__', label: 'Sonia - British (Anh)' },
                { value: '__gtts_au__', label: 'Natasha - Australian (Uc)' },
                { value: '__gtts_ca__', label: 'Clara - Canadian (Canada)' },
            ];

            const gttsGroup = document.createElement('optgroup');
            gttsGroup.label = 'Giong Neural TOEIC (Khuyen dung)';
            neuralVoices.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.value;
                opt.textContent = v.label;
                gttsGroup.appendChild(opt);
            });
            voiceSelect.appendChild(gttsGroup);

            // Browser voices group
            const browserGroup = document.createElement('optgroup');
            browserGroup.label = 'Giong trinh duyet';

            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = 'Mac dinh (browser)';
            browserGroup.appendChild(defaultOpt);

            const randomOpt = document.createElement('option');
            randomOpt.value = '__random__';
            randomOpt.textContent = 'Random trinh duyet (US/UK/AU/CA)';
            browserGroup.appendChild(randomOpt);

            enVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                const flag = voice.lang.includes('GB') ? 'GB' : voice.lang.includes('AU') ? 'AU' : voice.lang.includes('IN') ? 'IN' : voice.lang.includes('CA') ? 'CA' : 'US';
                const gender = getGender(voice.name);
                const genderLabel = gender ? ` (${gender})` : '';
                option.textContent = `${voice.name} [${flag}]${genderLabel}`;
                browserGroup.appendChild(option);
            });
            voiceSelect.appendChild(browserGroup);

            // Restore saved voice
            const savedVoice = localStorage.getItem('toeic_voice');
            if (savedVoice) voiceSelect.value = savedVoice;
        };

        // Voices may load async
        populateVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = populateVoices;
        }

        voiceSelect.addEventListener('change', (e) => {
            const voiceName = e.target.value;
            if (voiceName) {
                localStorage.setItem('toeic_voice', voiceName);
            } else {
                localStorage.removeItem('toeic_voice');
            }
            // Test the selected voice
            GameLogic.speakWord('vocabulary');
        });
    },

    /**
     * ✅ FIXED: Update a setting - LƯU VÀO GAMESTATE VÀ SYNC SERVER
     */
    async updateSetting(key, value, options = {}) {
        const { silent = false } = options;
        console.log(`%c⚙️ Updating setting: ${key} = ${value}`, 'color: yellow; font-weight: bold');

        // 1. Cập nhật GameState
        GameState.state.settings[key] = value;

        // ✅ FIX: Lưu settings quan trọng vào localStorage riêng (backup)
        // Để không bị mất khi GameState.save() bị block
        const criticalSettings = ['difficulty', 'levelFilter', 'questionsPerSession', 'timePerQuestion', 'timeLimitEnabled'];
        if (criticalSettings.includes(key)) {
            try {
                const savedSettings = JSON.parse(localStorage.getItem('userSettings') || '{}');
                savedSettings[key] = value;
                localStorage.setItem('userSettings', JSON.stringify(savedSettings));
                console.log(`💾 Setting "${key}" backed up to localStorage`);
            } catch (e) {
                console.warn('Failed to backup setting to localStorage:', e);
            }
        }

        // 2. Lưu GameState. `GameState.save()` sẽ tự động xử lý việc đồng bộ server.
        const saved = await GameState.save();

        // 3. Hiện notification (trừ khi silent=true)
        if (!silent) {
            Notification.show({
                type: 'success',
                title: 'Đã lưu',
                message: 'Cài đặt đã được cập nhật',
            });
        }

        return saved;
    },

    /**
     * Backup user data
     */
    backupData() {
        try {
            const state = GameState.state;
            const backup = {
                version: '2.0.0',
                timestamp: new Date().toISOString(),
                data: state,
            };

            const json = JSON.stringify(backup, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `toeic-game-backup-${Date.now()}.json`;
            a.click();

            URL.revokeObjectURL(url);

            Notification.show({
                type: 'success',
                title: 'Sao lưu thành công',
                message: 'Dữ liệu đã được tải xuống',
            });

        } catch (error) {
            console.error('Backup error:', error);
            Notification.show({
                type: 'error',
                title: 'Lỗi sao lưu',
                message: 'Không thể sao lưu dữ liệu',
            });
        }
    },

    /**
     * Restore user data
     */
    restoreData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const backup = JSON.parse(event.target.result);

                    if (!backup.version || !backup.data) {
                        throw new Error('Invalid backup file');
                    }

                    // Restore data
                    GameState.state = backup.data;
                    await GameState.save();

                    // Reload page
                    location.reload();

                } catch (error) {
                    console.error('Restore error:', error);
                    Notification.show({
                        type: 'error',
                        title: 'Lỗi khôi phục',
                        message: 'File sao lưu không hợp lệ',
                    });
                }
            };

            reader.readAsText(file);
        };

        input.click();
    },

    /**
     * Reset all progress
     */
    resetProgress() {
        Modal.show({
            title: '⚠️ Xác nhận xóa',
            content: `
                <p>Bạn có chắc chắn muốn xóa <strong>toàn bộ tiến độ</strong>?</p>
                <p>Hành động này <strong>không thể hoàn tác</strong>!</p>
                <p style="margin-top: 15px; color: #ef4444;">
                    ⚠️ Tất cả dữ liệu sẽ bị xóa:
                </p>
                <ul style="margin-top: 10px; padding-left: 20px;">
                    <li>Từ vựng đã học</li>
                    <li>Điểm số và thành tích</li>
                    <li>Coins và Gems</li>
                    <li>Streak và nhiệm vụ</li>
                </ul>
            `,
            buttons: [
                {
                    text: 'Hủy',
                    className: 'btn-secondary',
                    onClick: () => Modal.close(),
                },
                {
                    text: 'Xóa tất cả',
                    className: 'btn-danger',
                    onClick: async () => {
                        // Reset state
                        await GameState.reset();
                        Modal.close();

                        // Reload page
                        setTimeout(() => {
                            location.reload();
                        }, 500);
                    },
                },
            ],
        });
    },

    /**
     * Change language
     */
    changeLanguage(_lang) {
        Notification.show({
            type: 'info',
            title: 'Tính năng đang phát triển',
            message: 'Đa ngôn ngữ sẽ có trong phiên bản tới',
        });
    },

    /**
     * Change theme
     */
    changeTheme(theme) {
        // Save to storage (theme không cần sync server, chỉ lưu local)
        Storage.set('theme', theme);

        // Apply theme
        this.applyTheme(theme);

        // Show notification
        const themeNames = {
            light: '☀️ Chế độ sáng',
            dark: '🌙 Chế độ tối',
            auto: '🌓 Tự động theo hệ thống'
        };

        Notification.show({
            type: 'success',
            title: 'Đã thay đổi giao diện',
            message: themeNames[theme] || 'Giao diện đã được cập nhật',
        });

        // Sync navbar theme toggle icon
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            btn.querySelector('i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
            btn.title = isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối';
        }
    },

    /**
     * Key lưu màu theo user
     */
    _applyReverseMode(enabled) {
        localStorage.setItem('reverseMode', enabled);
        const toggle = document.getElementById('reverse-mode-toggle');
        if (toggle) toggle.checked = enabled;
        this._updateReverseModeBtn();
        Notification.show({
            type: 'success',
            title: 'Đã lưu',
            message: enabled ? 'Chế độ VN → EN đã bật' : 'Chế độ EN → VN đã bật',
        });
    },

    _updateReverseModeBtn() {
        const btn = document.getElementById('reverse-mode-btn');
        const label = document.getElementById('reverse-mode-label');
        if (!btn) return;
        const enabled = localStorage.getItem('reverseMode') === 'true';
        btn.title = enabled ? 'Đảo chiều: VN → EN (đang bật)' : 'Đảo chiều: EN → VN';
        btn.style.color = enabled ? 'var(--primary-color)' : '';
        btn.style.background = enabled ? 'rgba(var(--primary-rgb, 225,29,72), 0.12)' : '';
        if (label) label.textContent = enabled ? 'VN→EN' : 'EN→VN';
    },

    _colorKey() {
        const uid = GameState?.getUser?.()?.id || GameState?.state?.user?.id || 'guest';
        return `colorTheme_${uid}`;
    },

    /**
     * Khởi tạo color theme: build preset grid + restore saved colors
     */
    initColorTheme() {
        this.buildColorPresets();

        const saved = JSON.parse(localStorage.getItem(this._colorKey()) || 'null');
        const primary = saved?.primary || '#E11D48';
        const secondary = saved?.secondary || '#F97316';

        this.applyColorTheme(primary, secondary, false);

        const primaryPicker = document.getElementById('custom-primary-color');
        const secondaryPicker = document.getElementById('custom-secondary-color');
        if (primaryPicker) primaryPicker.value = primary;
        if (secondaryPicker) secondaryPicker.value = secondary;
    },

    /**
     * Build preset color swatches
     */
    buildColorPresets() {
        const grid = document.getElementById('color-presets-grid');
        if (!grid) return;

        const saved = JSON.parse(localStorage.getItem(this._colorKey()) || 'null');

        grid.innerHTML = this.COLOR_PRESETS.map((preset, i) => {
            const isActive = saved
                ? saved.primary === preset.primary && saved.secondary === preset.secondary
                : i === 0;
            return `
                <button class="color-swatch ${isActive ? 'active' : ''}"
                    data-primary="${preset.primary}"
                    data-secondary="${preset.secondary}"
                    title="${preset.name}"
                    style="background: linear-gradient(135deg, ${preset.primary}, ${preset.secondary})">
                </button>
            `;
        }).join('');

        grid.querySelectorAll('.color-swatch').forEach(btn => {
            btn.addEventListener('click', () => {
                const primary = btn.dataset.primary;
                const secondary = btn.dataset.secondary;
                this.applyColorTheme(primary, secondary);

                // Sync custom pickers
                const pp = document.getElementById('custom-primary-color');
                const sp = document.getElementById('custom-secondary-color');
                if (pp) pp.value = primary;
                if (sp) sp.value = secondary;

                // Mark active
                grid.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    },

    /**
     * Áp dụng màu lên CSS variables
     */
    hexToRgb(hex) {
        const num = parseInt(hex.replace('#', ''), 16);
        return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
    },

    applyColorTheme(primary, secondary, notify = true) {
        const root = document.documentElement;
        root.style.setProperty('--primary-color', primary);
        root.style.setProperty('--primary', primary);
        root.style.setProperty('--primary-dark', this.adjustColor(primary, -30));
        root.style.setProperty('--primary-light', this.adjustColor(primary, 40));
        root.style.setProperty('--primary-rgb', this.hexToRgb(primary));
        root.style.setProperty('--secondary-color', secondary);
        root.style.setProperty('--secondary-dark', this.adjustColor(secondary, -30));
        root.style.setProperty('--secondary-light', this.adjustColor(secondary, 60));
        root.style.setProperty('--secondary-rgb', this.hexToRgb(secondary));

        localStorage.setItem(this._colorKey(), JSON.stringify({ primary, secondary }));

        if (notify) {
            Notification.show({
                type: 'success',
                title: '🎨 Màu sắc đã thay đổi',
                message: `${primary} → ${secondary}`,
                duration: 2000,
            });
        }
    },

    /**
     * Làm sáng/tối màu hex
     */
    adjustColor(hex, amount) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + amount));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
        const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    },

    // ===================================
    // CHANGE PASSWORD (settings screen)
    // ===================================
    _initChangePassword() {
        // Show section only when logged in
        EventBus.on(GameEvents.USER_LOGIN, () => {
            const section = document.getElementById('change-password-section');
            if (section) section.style.display = '';
        });
        // Also check on init
        if (typeof Auth !== 'undefined' && Auth.isLoggedIn) {
            const section = document.getElementById('change-password-section');
            if (section) section.style.display = '';
        }

        document.getElementById('save-change-password-btn')?.addEventListener('click', () => this._handleChangePassword());
    },

    async _handleChangePassword() {
        const current = document.getElementById('cp-current')?.value;
        const newPw = document.getElementById('cp-new')?.value;
        const confirm = document.getElementById('cp-confirm')?.value;
        const errEl = document.getElementById('cp-error');

        const setErr = (msg) => {
            if (!errEl) return;
            errEl.textContent = msg;
            errEl.classList.toggle('visible', !!msg);
        };

        setErr('');

        if (!current || !newPw || !confirm) return setErr('Vui lòng điền đầy đủ');
        if (newPw.length < 6) return setErr('Mật khẩu mới phải ít nhất 6 ký tự');
        if (newPw !== confirm) return setErr('Mật khẩu không khớp');

        const btn = document.getElementById('save-change-password-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

        try {
            const response = await API.auth.changePassword({ currentPassword: current, newPassword: newPw });
            if (!response.success) throw new Error(response.error || 'Đổi mật khẩu thất bại');

            document.getElementById('cp-current').value = '';
            document.getElementById('cp-new').value = '';
            document.getElementById('cp-confirm').value = '';
            Notification.show({ type: 'success', message: 'Đổi mật khẩu thành công!' });
        } catch (err) {
            const msg = err.message || '';
            if (msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('current')) {
                setErr('Mật khẩu hiện tại không đúng');
            } else {
                setErr(msg || 'Đổi mật khẩu thất bại');
            }
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Lưu mật khẩu mới'; }
        }
    },

    // Show/hide password toggles in settings
    _initPasswordToggles() {
        document.querySelectorAll('.btn-toggle-password[data-target]').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.dataset.target);
                const icon = btn.querySelector('i');
                if (!input) return;
                const isHidden = input.type === 'password';
                input.type = isHidden ? 'text' : 'password';
                icon?.classList.toggle('fa-eye', !isHidden);
                icon?.classList.toggle('fa-eye-slash', isHidden);
            });
        });
    },

    /**
     * Apply theme to DOM
     */
    applyTheme(theme) {
        const html = document.documentElement;

        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            html.setAttribute('data-theme', theme);
        }

        console.log(`🎨 Theme applied: ${theme}`);

        // ✅ QUAN TRỌNG: Trả về theme để tránh Promise
        return theme;
    },

    // ===================================
    // REPORT FORM (settings → Báo cáo tab)
    // ===================================
    _initReportForm() {
        const content   = document.getElementById('report-content');
        const charCount = document.getElementById('report-char-count');
        const imgInput  = document.getElementById('report-image-input');
        const imgName   = document.getElementById('report-image-name');
        const imgPrev   = document.getElementById('report-image-preview');
        const removeBtn = document.getElementById('report-remove-img');
        const submitBtn = document.getElementById('btn-submit-report');
        if (!content || !submitBtn) {
            console.warn('Report form elements not found');
            return;
        }

        // Character counter
        content.addEventListener('input', () => {
            if (charCount) charCount.textContent = content.value.length;
        });

        // Image preview
        imgInput?.addEventListener('change', () => {
            const file = imgInput.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                Notification.show({ type: 'error', title: 'Ảnh quá lớn', message: 'Tối đa 5MB.' });
                imgInput.value = '';
                return;
            }
            if (imgName) imgName.textContent = file.name;
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgSrc = document.getElementById('report-preview-img');
                if (imgSrc) imgSrc.src = e.target.result;
                if (imgPrev) imgPrev.style.display = 'block';
            };
            reader.readAsDataURL(file);
        });

        removeBtn?.addEventListener('click', () => {
            if (imgInput) imgInput.value = '';
            if (imgName) imgName.textContent = 'Nhấn để chọn ảnh...';
            if (imgPrev) imgPrev.style.display = 'none';
        });

        submitBtn.addEventListener('click', async () => {
            const text = content.value.trim();
            if (text.length < 5) {
                Notification.show({ type: 'warning', title: 'Nội dung quá ngắn', message: 'Vui lòng nhập ít nhất 5 ký tự.' });
                content.focus();
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';

            try {
                const formData = new FormData();
                formData.append('content', text);
                if (imgInput?.files[0]) formData.append('image', imgInput.files[0]);

                // Resolve auth token
                let token = null;
                try {
                    const raw = localStorage.getItem('authToken');
                    if (raw) token = JSON.parse(raw)?.token || null;
                } catch (_) {}

                let res, data;
                if (token) {
                    res  = await fetch('/api/reports', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                    });
                    // Token hết hạn hoặc không hợp lệ → thử lại dưới dạng khách
                    if (res.status === 401 || res.status === 403) {
                        const guestForm = new FormData();
                        guestForm.append('content', text);
                        if (imgInput?.files[0]) guestForm.append('image', imgInput.files[0]);
                        res = await fetch('/api/reports/guest', { method: 'POST', body: guestForm });
                    }
                } else {
                    res = await fetch('/api/reports/guest', { method: 'POST', body: formData });
                }
                data = await res.json();

                if (data.success) {
                    Notification.show({ type: 'success', title: 'Đã gửi báo cáo', message: 'Cảm ơn bạn! Chúng tôi sẽ xem xét sớm nhất.' });
                    content.value = '';
                    if (charCount) charCount.textContent = '0';
                    if (imgInput) imgInput.value = '';
                    if (imgName) imgName.textContent = 'Nhấn để chọn ảnh...';
                    if (imgPrev) imgPrev.style.display = 'none';
                } else {
                    Notification.show({ type: 'error', title: 'Gửi thất bại', message: data.message || 'Vui lòng thử lại.' });
                }
            } catch (err) {
                console.error('Report submit error:', err);
                Notification.show({ type: 'error', title: 'Lỗi kết nối', message: 'Không thể gửi báo cáo. Vui lòng thử lại.' });
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi báo cáo';
            }
        });

        console.log('✅ Report form initialized');
    },
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsUI;
}