const GameLogic = {

    vocabularyData: [],

    async init() {
        await this.loadVocabulary();
    },

    async loadVocabulary() {
        const result = await Http.loadVocabulary();

        if (!result || !result.success || !Array.isArray(result.data)) {
            console.error("Vocabulary load failed or invalid. Using empty array.");
            this.vocabularyData = [];
            return false;
        }

        this.vocabularyData = result.data.slice();
        console.log(`Loaded ${this.vocabularyData.length} vocabulary words`);
        return true;
    },

    async loadVocabularyBySource(source) {
        console.log(`🔄 GameLogic: Loading vocabulary for source "${source}"...`);
        try {
            const words = await VocabularyAPI.getWordsBySource(source);
            if (!Array.isArray(words) || words.length === 0) {
                console.error(`❌ No words found for source: ${source}`);
                return false;
            }
            this.vocabularyData = words;
            console.log(`✅ GameLogic: Loaded ${this.vocabularyData.length} words (source: ${source})`);
            return true;
        } catch (err) {
            console.error(`❌ Failed to load source "${source}":`, err);
            return false;
        }
    },

    async loadVocabularyFromFile(filePath) {
        console.log(`🔄 GameLogic: Loading vocabulary from ${filePath}...`);

        const result = await Http.loadJSON(filePath);

        if (!result || !result.success || !Array.isArray(result.data)) {
            console.error("❌ Invalid vocabulary file:", filePath, result);
            return false;
        }

        // Clear old data and set new data
        this.vocabularyData = [];
        this.vocabularyData = result.data.slice();

        console.log(`✅ GameLogic: Loaded ${this.vocabularyData.length} words from ${filePath}`);

        // Debug: Log first 3 words to verify correct file loaded
        if (this.vocabularyData.length > 0) {
            console.log('📋 Sample words:', this.vocabularyData.slice(0, 3).map(w => w.en));
        }

        return true;
    },

    getVocabulary() {
        return [...this.vocabularyData];
    },

    getRandomWords(count) {
        // ✅ Retry mode: trả về danh sách câu sai từ session trước
        if (typeof PartSelector !== 'undefined' && PartSelector.retryWords && PartSelector.retryWords.length > 0) {
            const words = [...PartSelector.retryWords];
            PartSelector.retryWords = null;
            console.log(`🔁 Retry mode (getRandomWords): returning ${words.length} wrong words`);
            return words;
        }

        // Get level filter from settings
        const settings = GameState.state?.settings || {};
        const levelFilter = settings.levelFilter;

        console.log('🔍 getRandomWords DEBUG:', {
            difficulty: settings.difficulty,
            levelFilter: levelFilter,
            totalVocab: this.vocabularyData.length
        });

        let filteredData = this.vocabularyData;

        // Apply level filter if exists
        if (levelFilter && Array.isArray(levelFilter) && levelFilter.length > 0) {
            filteredData = this.vocabularyData.filter(word => {
                return word.level && levelFilter.includes(word.level);
            });

            console.log(`🎯 Filtered vocabulary by levels [${levelFilter.join(', ')}]: ${filteredData.length} words`);

            // Log first 3 filtered words to verify
            if (filteredData.length > 0) {
                console.log('📋 Sample filtered words:', filteredData.slice(0, 3).map(w => `${w.en} (${w.level})`));
            }

            // Fallback to all words if filter returns empty
            if (filteredData.length === 0) {
                console.warn('⚠️ No words found with selected levels, using all vocabulary');
                if (typeof Notification !== 'undefined') {
                    Notification.show({
                        type: 'warning',
                        title: 'Không tìm thấy từ vựng',
                        message: `Không có từ vựng nào ở level ${levelFilter.join(', ')}. Sử dụng tất cả từ vựng.`,
                        duration: 4000
                    });
                }
                filteredData = this.vocabularyData;
            }
            // Warning if not enough words
            else if (filteredData.length < count) {
                console.warn(`⚠️ Not enough words (${filteredData.length}/${count}), using all available words at this level`);
                if (typeof Notification !== 'undefined') {
                    Notification.show({
                        type: 'info',
                        title: 'Số từ vựng hạn chế',
                        message: `Chỉ có ${filteredData.length} từ ở level ${levelFilter.join(', ')}. Sẽ lấy tất cả.`,
                        duration: 4000
                    });
                }
            }
        } else {
            console.log('ℹ️ No level filter applied (adaptive mode or not set)');
        }

        return Utils.randomSample(filteredData, count);
    },

    getWord(id) {
        return this.vocabularyData.find(word => word.en === id) || this.vocabularyData[id];
    },

    getWordsByPart(part) {
        // Get level filter from settings
        const settings = GameState.state?.settings || {};
        const levelFilter = settings.levelFilter;

        console.log(`🔍 getWordsByPart("${part}") DEBUG:`, {
            difficulty: settings.difficulty,
            levelFilter: levelFilter
        });

        let words = this.vocabularyData.filter(word => word.part === part);
        console.log(`📚 Total words in ${part}: ${words.length}`);

        // Apply level filter if exists
        if (levelFilter && Array.isArray(levelFilter) && levelFilter.length > 0) {
            const beforeFilter = words.length;
            words = words.filter(word => {
                return word.level && levelFilter.includes(word.level);
            });

            console.log(`🎯 Filtered ${part} by levels [${levelFilter.join(', ')}]: ${beforeFilter} → ${words.length} words`);

            // Warning if no words found
            if (words.length === 0) {
                console.warn(`⚠️ No words found in ${part} with levels ${levelFilter.join(', ')}`);
                if (typeof Notification !== 'undefined') {
                    Notification.show({
                        type: 'warning',
                        title: 'Không tìm thấy từ vựng',
                        message: `${part} không có từ vựng nào ở level ${levelFilter.join(', ')}.`,
                        duration: 4000
                    });
                }
            }
            // Log first 3 filtered words
            else if (words.length > 0) {
                console.log('📋 Sample words:', words.slice(0, 3).map(w => `${w.en} (${w.level})`));
            }
        } else {
            console.log('ℹ️ No level filter applied to Part');
        }

        return words;
    },

    searchWords(query) {
        const lowerQuery = query.toLowerCase();
        return this.vocabularyData.filter(word =>
            word.en.toLowerCase().includes(lowerQuery) ||
            word.vn.toLowerCase().includes(lowerQuery)
        );
    },

    isReversed() {
        return localStorage.getItem('reverseMode') === 'true';
    },

    generateMultipleChoice(word, optionsCount = 4) {
        const reversed = this.isReversed();
        const correctAnswer = reversed ? word.en : word.vn;
        const otherWords = this.vocabularyData.filter(w => w.en !== word.en);
        const wrongAnswers = Utils.randomSample(otherWords, optionsCount - 1).map(w => reversed ? w.en : w.vn);
        const options = Utils.shuffleArray([correctAnswer, ...wrongAnswers]);

        return {
            word,
            question: reversed ? word.vn : word.en,
            options,
            correctAnswer,
            correctIndex: options.indexOf(correctAnswer),
            reversed
        };
    },

    checkMultipleChoice(selectedAnswer, correctAnswer) {
        return selectedAnswer === correctAnswer;
    },

    generateFillBlank(word) {
        const reversed = this.isReversed();
        if (reversed) {
            return {
                word,
                displayWord: word.en,
                prompt: `Nghĩa tiếng Việt của từ trên là:`,
                placeholder: 'Nhập nghĩa tiếng Việt',
                correctAnswer: word.vn,
                acceptableAnswers: [word.vn.toLowerCase()],
                reversed: true
            };
        }
        return {
            word,
            displayWord: word.vn,
            prompt: `Từ tiếng Anh của từ trên là:`,
            placeholder: 'Nhập từ tiếng Anh',
            correctAnswer: word.en,
            acceptableAnswers: [word.en.toLowerCase()],
            reversed: false
        };
    },

    checkFillBlank(userAnswer, correctAnswer) {
        const normalized = userAnswer.toLowerCase().trim();
        const correct = correctAnswer.toLowerCase().trim();

        if (normalized === correct) {
            return { correct: true, similarity: 100 };
        }

        const similarity = this.calculateSimilarity(normalized, correct);

        if (similarity >= 80) {
            return { correct: true, similarity };
        }

        return { correct: false, similarity };
    },

    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) {
            return 100;
        }

        const distance = this.levenshteinDistance(longer, shorter);
        return Math.round((longer.length - distance) / longer.length * 100);
    },

    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
        for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    },

    generateListening(word, optionsCount = 4) {
        return this.generateMultipleChoice(word, optionsCount);
    },

    // Current Google TTS audio element
    _gttsAudio: null,

    // Callback để replay âm thanh vừa phát (Ctrl shortcut)
    _replayCallback: null,

    /**
     * Replay âm thanh vừa phát gần nhất
     */
    replayLast() {
        if (this._replayCallback) this._replayCallback();
    },

    speakWord(text, lang = 'en-US', onEnd = null) {
        const savedVoiceName = localStorage.getItem('toeic_voice') || '';

        // Track for Ctrl replay
        this._replayCallback = () => this.speakWord(text, lang);

        // Google TTS natural voices
        if (savedVoiceName.startsWith('__gtts_')) {
            this._speakGoogleTTS(text, savedVoiceName, onEnd);
            return;
        }

        // Browser speech synthesis
        if (!('speechSynthesis' in window)) {
            if (onEnd) onEnd();
            return;
        }
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;

        // Speech rate
        const savedRate = localStorage.getItem('toeic_speech_rate');
        utterance.rate = savedRate ? parseInt(savedRate) / 100 : 0.8;

        // Callback when speech ends
        if (onEnd) {
            utterance.onend = onEnd;
            utterance.onerror = onEnd;
        }

        // Voice selection
        const voices = window.speechSynthesis.getVoices();

        if (savedVoiceName === '__random__' && voices.length > 0) {
            const toeicAccents = ['en-US', 'en-GB', 'en-AU', 'en-CA'];
            const toeicVoices = voices.filter(v => toeicAccents.some(a => v.lang.startsWith(a)));
            const pool = toeicVoices.length > 0 ? toeicVoices : voices.filter(v => v.lang.startsWith('en'));
            if (pool.length > 0) {
                const picked = pool[Math.floor(Math.random() * pool.length)];
                utterance.voice = picked;
            }
        } else if (savedVoiceName) {
            const selectedVoice = voices.find(v => v.name === savedVoiceName);
            if (selectedVoice) utterance.voice = selectedVoice;
        }

        window.speechSynthesis.speak(utterance);
    },

    /**
     * Speak using Google TTS via backend API (natural voice)
     */
    async _speakGoogleTTS(text, voiceKey, onEnd = null) {
        // Stop previous audio
        if (this._gttsAudio) {
            this._gttsAudio.pause();
            this._gttsAudio = null;
        }
        window.speechSynthesis.cancel();

        // Track for Ctrl replay
        this._replayCallback = () => this._speakGoogleTTS(text, voiceKey, null);

        // 4 TOEIC accents
        const accentMap = {
            '__gtts_us__': 'en-us',
            '__gtts_uk__': 'en-gb',
            '__gtts_au__': 'en-au',
            '__gtts_ca__': 'en-ca',
        };

        let lang = 'en-us';
        if (voiceKey === '__gtts_random__') {
            const accents = ['en-us', 'en-gb', 'en-au', 'en-ca'];
            lang = accents[Math.floor(Math.random() * accents.length)];
        } else {
            lang = accentMap[voiceKey] || 'en-us';
        }

        const savedRate = localStorage.getItem('toeic_speech_rate');
        const rate = savedRate ? parseInt(savedRate) / 100 : 0.8;
        const slow = rate < 0.7;

        try {
            const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&lang=${lang}&slow=${slow}`);
            const data = await res.json();

            if (data.url) {
                const audio = new Audio(data.url);
                this._gttsAudio = audio;
                if (onEnd) {
                    audio.onended = onEnd;
                    audio.onerror = onEnd;
                }
                await audio.play();
            } else if (data.urls) {
                for (let i = 0; i < data.urls.length; i++) {
                    const isLast = i === data.urls.length - 1;
                    await new Promise((resolve) => {
                        const audio = new Audio(data.urls[i]);
                        this._gttsAudio = audio;
                        audio.onended = () => { if (isLast && onEnd) onEnd(); resolve(); };
                        audio.onerror = () => { if (isLast && onEnd) onEnd(); resolve(); };
                        audio.play().catch(() => { if (isLast && onEnd) onEnd(); resolve(); });
                    });
                }
            } else {
                if (onEnd) onEnd();
            }
        } catch (err) {
            console.warn('Google TTS API failed, falling back to browser:', err);
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = rate;
            if (onEnd) {
                utterance.onend = onEnd;
                utterance.onerror = onEnd;
            }
            window.speechSynthesis.speak(utterance);
        }
    },

    generateMatching(pairsCount = 8, wordsPool = null) {
        const words = wordsPool
            ? Utils.randomSample(wordsPool, Math.min(pairsCount, wordsPool.length))
            : this.getRandomWords(pairsCount);

        const leftColumn = words.map(w => ({
            id: Utils.generateId(),
            text: w.en,
            wordData: w
        }));

        const rightColumn = Utils.shuffleArray(words.map(w => ({
            id: Utils.generateId(),
            text: w.vn,
            wordData: w
        })));

        return {
            leftColumn,
            rightColumn,
            pairs: words.length
        };
    },

    checkMatching(leftItem, rightItem) {
        return leftItem.wordData.en === rightItem.wordData.en;
    },

    generateWordScramble(word) {
        const letters = word.en.split('');
        const scrambled = Utils.shuffleArray(letters);
        let attempts = 0;

        while (scrambled.join('') === word.en && attempts < 10) {
            Utils.shuffleArray(scrambled);
            attempts++;
        }

        return {
            word,
            scrambledLetters: scrambled,
            correctAnswer: word.en,
            hint: word.vn
        };
    },

    checkWordScramble(userAnswer, correctAnswer) {
        return userAnswer.toLowerCase() === correctAnswer.toLowerCase();
    },

    generateSpeedQuiz(word, optionsCount = 2) {
        const isCorrect = Math.random() > 0.5;

        if (isCorrect) {
            return {
                word,
                question: word.en,
                shownAnswer: word.vn,
                isCorrect: true,
                correctAnswer: word.vn
            };
        } else {
            const otherWords = this.vocabularyData.filter(w => w.en !== word.en);
            const wrongWord = Utils.randomElement(otherWords);
            return {
                word,
                question: word.en,
                shownAnswer: wrongWord.vn,
                isCorrect: false,
                correctAnswer: word.vn
            };
        }
    },

    checkSpeedQuiz(userSaidCorrect, actuallyCorrect) {
        return userSaidCorrect === actuallyCorrect;
    },

    calculateScore(correctAnswers, totalQuestions, timeSpent, timeLimit, mode) {
        const modeConfig = (Config.practice && Config.practice[mode]) || {};
        const basePoints = modeConfig.pointsPerCorrect || 100;
        if (!totalQuestions || totalQuestions === 0) {
            return { totalScore: 0, baseScore: 0, accuracyBonus: 0, speedBonus: 0, perfectBonus: 0 };
        }
        let score = correctAnswers * basePoints;
        const accuracy = correctAnswers / totalQuestions;
        const accuracyBonus = Math.floor(accuracy * 500);
        score += accuracyBonus;

        if (timeSpent < timeLimit) {
            const timeRatio = 1 - timeSpent / timeLimit;
            const speedBonus = Math.floor(timeRatio * 300);
            score += speedBonus;
        }

        if (correctAnswers === totalQuestions) score += 500;

        return {
            totalScore: score,
            baseScore: correctAnswers * basePoints,
            accuracyBonus,
            speedBonus: timeSpent < timeLimit ? Math.floor((1 - timeSpent / timeLimit) * 300) : 0,
            perfectBonus: correctAnswers === totalQuestions ? 500 : 0
        };
    },

    calculateXpReward(correctAnswers, totalQuestions, isPerfect) {
        let xp = correctAnswers * Config.xpRewards.correctAnswer;
        if (isPerfect) xp += Config.xpRewards.perfectRound;
        return xp;
    },

    calculateCoinsReward(correctAnswers, totalQuestions, isPerfect) {
        let coins = correctAnswers * Config.coinsRewards.correctAnswer;
        if (isPerfect) coins += Config.coinsRewards.perfectRound;
        return coins;
    },

    getPerformanceRating(correctAnswers, totalQuestions) {
        const a = (correctAnswers / totalQuestions) * 100;
        if (a === 100) return { rating: 'PERFECT', stars: 3, message: 'Hoàn hảo!' };
        if (a >= 90) return { rating: 'EXCELLENT', stars: 3, message: 'Xuất sắc!' };
        if (a >= 80) return { rating: 'GREAT', stars: 2, message: 'Rất tốt!' };
        if (a >= 70) return { rating: 'GOOD', stars: 2, message: 'Tốt!' };
        if (a >= 60) return { rating: 'PASS', stars: 1, message: 'Đạt!' };
        return { rating: 'FAIL', stars: 0, message: 'Cần cố gắng thêm!' };
    },

    getHint(word, hintLevel = 1) {
        switch (hintLevel) {
            case 1: return `Loại từ: ${word.type}`;
            case 2: return `Gợi ý: ${word.vn.charAt(0)}...`;
            case 3: return word.synonyms ? `Từ đồng nghĩa: ${word.synonyms}` : 'Không có gợi ý thêm';
            default: return word.type;
        }
    },

    getHintCost() {
        return 50;
    },

    adjustDifficulty(userLevel, accuracy) {
        if (accuracy >= 90) return 1.2;
        if (accuracy < 60) return 0.8;
        return 1.0;
    },

    getRecommendedWords(learnedWords, count = 10) {
        const unlearned = this.vocabularyData.filter(w => !learnedWords.includes(w.en));
        if (unlearned.length === 0) return this.getRandomWords(count);
        return Utils.randomSample(unlearned, count);
    },

    // ===================================
    // SYNONYM CHECK MODE
    // ===================================
    generateSynonymCheck(word, optionsCount = 4) {
        // Cần có cả synonyms (EN) và synonyms_vn (VN) để chơi
        if (!word.synonyms || !word.synonyms_vn) {
            return this.generateMultipleChoice(word, optionsCount);
        }

        const correctAnswer = word.synonyms_vn;

        // Lấy các từ khác có đủ synonyms_vn để làm đáp án sai
        const otherWords = this.vocabularyData.filter(w =>
            w.en !== word.en && w.synonyms_vn && w.synonyms_vn.trim() !== ''
        );

        const wrongPool = otherWords.length >= optionsCount - 1
            ? otherWords
            : this.vocabularyData.filter(w => w.en !== word.en);

        const wrongAnswers = Utils.randomSample(wrongPool, optionsCount - 1)
            .map(w => w.synonyms_vn || w.vn);

        const options = Utils.shuffleArray([correctAnswer, ...wrongAnswers]);

        return {
            word,
            question: `Nghĩa tiếng Việt của các từ đồng nghĩa trên là gì?`,
            options,
            correctAnswer,
            correctIndex: options.indexOf(correctAnswer)
        };
    },

    checkSynonymCheck(selectedAnswer, correctAnswer) {
        return selectedAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    },

    // ===================================
    // WORD TYPE CHECK MODE
    // ===================================
    generateWordTypeCheck(word, optionsCount = 6) {
        const correctAnswer = word.type || 'unknown';

        // All possible word types
        const allTypes = ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction'];

        // Remove correct answer from all types
        const wrongTypes = allTypes.filter(t => t.toLowerCase() !== correctAnswer.toLowerCase());

        // Randomly select wrong options
        const selectedWrongTypes = Utils.randomSample(wrongTypes, Math.min(optionsCount - 1, wrongTypes.length));

        // Combine correct and wrong answers, then shuffle
        const options = Utils.shuffleArray([correctAnswer, ...selectedWrongTypes]);

        return {
            word,
            question: `Từ loại của "${word.en}" là gì?`,
            options,
            correctAnswer,
            correctIndex: options.indexOf(correctAnswer)
        };
    },

    checkWordTypeCheck(selectedAnswer, correctAnswer) {
        return selectedAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameLogic;
}
