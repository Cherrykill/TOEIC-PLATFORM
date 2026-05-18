// ===================================
// UTILITY FUNCTIONS
// ===================================

import { Config } from '@game/config.js';

export const Utils = {

    /**
     * Format số với dấu phẩy (1000 -> 1,000)
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    /**
     * Làm tròn số đến n chữ số thập phân
     */
    roundTo(num, decimals = 2) {
        return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    },

    /**
     * Random số nguyên từ min đến max (inclusive)
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Random phần tử từ array
     */
    randomElement(array) {
        return array[Math.floor(Math.random() * array.length)];
    },

    /**
     * Random phần tử từ array (alias của randomElement - để tương thích)
     */
    randomChoice(array) {
        return this.randomElement(array);
    },

    /**
     * Shuffle array (Fisher-Yates algorithm)
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    /**
     * Lấy n phần tử random từ array
     */
    randomSample(array, n) {
        const shuffled = this.shuffleArray(array);
        return shuffled.slice(0, Math.min(n, array.length));
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function
     */
    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Format thời gian (seconds -> MM:SS hoặc HH:MM:SS)
     */
    formatTime(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * Parse thời gian MM:SS hoặc HH:MM:SS -> seconds
     */
    parseTime(timeString) {
        const parts = timeString.split(':').map(Number);
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        return 0;
    },

    /**
     * Tính thời gian còn lại đến hết ngày (reset daily)
     */
    getTimeUntilMidnight() {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        return Math.floor((midnight - now) / 1000);
    },

    /**
     * Check xem 2 timestamp có cùng ngày không
     */
    isSameDay(timestamp1, timestamp2) {
        const d1 = new Date(timestamp1);
        const d2 = new Date(timestamp2);
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    },

    /**
     * Lấy timestamp đầu ngày (00:00:00)
     */
    getStartOfDay(date = new Date()) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    },

    /**
     * Deep clone object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Merge objects deeply
     */
    deepMerge(target, source) {
        const output = { ...target };
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    },

    /**
     * Check if value is object
     */
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    },

    /**
     * Capitalize first letter
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    /**
     * Truncate text
     */
    truncate(str, maxLength) {
        if (str.length <= maxLength) return str;
        return str.slice(0, maxLength - 3) + '...';
    },

    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Sleep/delay function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Clamp number between min and max
     */
    clamp(num, min, max) {
        return Math.min(Math.max(num, min), max);
    },

    /**
     * Linear interpolation
     */
    lerp(start, end, t) {
        return start + (end - start) * t;
    },

    /**
     * Map value from one range to another
     */
    map(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    },

    /**
     * Calculate percentage
     */
    percentage(value, total) {
        if (total === 0) return 0;
        return Math.round((value / total) * 100);
    },

    /**
     * Get query parameters from URL
     */
    getQueryParams() {
        const params = {};
        const queryString = window.location.search.substring(1);
        const regex = /([^&=]+)=([^&]*)/g;
        let m;
        while (m = regex.exec(queryString)) {
            params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
        }
        return params;
    },

    /**
     * Validate email
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    },

    /**
     * Check if element is in viewport
     */
    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    },

    /**
     * Smooth scroll to element
     */
    scrollToElement(element, offset = 0) {
        const top = element.getBoundingClientRect().top + window.pageYOffset + offset;
        window.scrollTo({
            top: top,
            behavior: 'smooth'
        });
    },

    // Array to track all playing audio instances
    activeSounds: [],

    // Cache of preloaded Audio objects
    _audioCache: {},

    /**
     * Preload sound files into cache to eliminate playback delay
     */
    preloadSounds(urls) {
        urls.forEach(url => {
            if (!this._audioCache[url]) {
                const audio = new Audio(url);
                audio.preload = 'auto';
                this._audioCache[url] = audio;
            }
        });
    },

    /**
     * Play sound effect
     */
    playSound(soundUrl, volume = 1.0, { ignoreSettings = false } = {}) {
        try {
            // Kiểm tra setting âm thanh luyện tập
            if (!ignoreSettings) {
                const inPractice = typeof PracticeManager !== 'undefined' && PracticeManager.currentSession;
                if (inPractice) {
                    const enabled = localStorage.getItem('practiceSoundEnabled');
                    const isFeedbackSound = soundUrl && (
                        soundUrl.includes('correct') || soundUrl.includes('wrong') || soundUrl.includes('complete')
                    );
                    if (enabled === 'false' && !isFeedbackSound) return;
                }
            }

            // Use cached audio clone to avoid fetch/decode delay
            let audio;
            if (this._audioCache[soundUrl]) {
                audio = this._audioCache[soundUrl].cloneNode();
            } else {
                audio = new Audio(soundUrl);
            }
            audio.volume = volume;

            this.activeSounds.push(audio);
            audio.addEventListener('ended', () => {
                const index = this.activeSounds.indexOf(audio);
                if (index > -1) this.activeSounds.splice(index, 1);
            });

            audio.play().catch(err => {
                console.warn('Sound play failed:', err);
            });
        } catch (err) {
            console.warn('Sound creation failed:', err);
        }
    },

    stopAllSounds() {
        this.activeSounds.forEach(audio => {
            try { audio.pause(); audio.currentTime = 0; } catch (_) {}
        });
        this.activeSounds = [];
        if (window.speechSynthesis) window.speechSynthesis.cancel();
    },

    /**
     * Stop all currently playing sounds
     */
    stopAllSounds() {
        try {
            this.activeSounds.forEach(audio => {
                audio.pause();
                audio.currentTime = 0;
            });
            this.activeSounds = [];
            console.log('All sounds stopped');
        } catch (err) {
            console.warn('Failed to stop sounds:', err);
        }
    },

    /**
     * Vibrate device (mobile)
     */
    vibrate(pattern = 100) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    },

    /**
     * Calculate XP needed for level
     * Progressive formula: higher levels need exponentially more XP
     * Level 1: 100 XP, Level 10: ~630 XP, Level 50: ~7,900 XP, Level 100: ~25,000 XP
     */
    getXpForLevel(level) {
        const maxLevel = Config?.game?.maxLevel || 100;

        // If at max level, return 0 (no more XP needed)
        if (level >= maxLevel) {
            return 0;
        }

        // Progressive formula: XP = baseXP * level^1.6
        // This creates a nice curve where early levels are achievable
        // but higher levels require significantly more effort
        const baseXP = 100;
        const exponent = 1.6;
        return Math.floor(baseXP * Math.pow(level, exponent));
    },

    /**
     * Get level from total XP
     * Respects max level cap from Config
     */
    getLevelFromXp(totalXp) {
        const maxLevel = Config?.game?.maxLevel || 100;
        let level = 1;
        let xpForNextLevel = this.getXpForLevel(level);
        let accumulatedXp = 0;

        while (accumulatedXp + xpForNextLevel <= totalXp && level < maxLevel) {
            accumulatedXp += xpForNextLevel;
            level++;
            xpForNextLevel = this.getXpForLevel(level);
        }

        // If at max level
        if (level >= maxLevel) {
            return {
                level: maxLevel,
                currentXp: totalXp - accumulatedXp,
                neededXp: 0, // No more XP needed at max level
                isMaxLevel: true
            };
        }

        return {
            level: level,
            currentXp: totalXp - accumulatedXp,
            neededXp: xpForNextLevel,
            isMaxLevel: false
        };
    },

    /**
     * Calculate score based on accuracy and time
     */
    calculateScore(correctAnswers, totalQuestions, timeSpent, timeLimit) {
        const accuracy = correctAnswers / totalQuestions;
        const timeBonus = Math.max(0, 1 - (timeSpent / timeLimit));
        const baseScore = correctAnswers * 100;
        const accuracyBonus = Math.floor(accuracy * 500);
        const speedBonus = Math.floor(timeBonus * 300);

        return baseScore + accuracyBonus + speedBonus;
    }


};

