// ===================================
// STATISTICS UI MODULE
// ===================================

const StatisticsUI = {

    currentRange: 'week',
    practiceChart: null,

    /**
     * Initialize Statistics UI
     */
    init() {
        this._initStatsTabs();
        this.attachListeners();
        this.loadStatistics();
    },

    _initStatsTabs() {
        document.querySelectorAll('.stats-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.statsTab;
                document.querySelectorAll('.stats-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.stats-tab-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const panel = document.getElementById(`stats-tab-${tab}`);
                if (panel) panel.classList.add('active');
            });
        });
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        // Time range buttons
        document.querySelectorAll('.time-range-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const range = e.target.dataset.range;
                this.switchTimeRange(range);
            });
        });
    },

    /**
     * Switch time range
     */
    switchTimeRange(range) {
        this.currentRange = range;

        // Update active button
        document.querySelectorAll('.time-range-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.range === range) {
                btn.classList.add('active');
            }
        });

        this.loadStatistics();
    },

    /**
     * Load and display statistics
     */
    loadStatistics() {
        const state = GameState.state;

        // Update overview stats
        this.updateOverviewStats(state);

        // 📊 Update practice history chart
        this.updatePracticeChart(state);

        // Update mode accuracy
        this.updateModeAccuracy(state);

        // Update vocabulary progress
        this.updateVocabularyProgress(state);

        // Update detailed stats table
        this.updateDetailedStats(state);
    },

    /**
     * Update overview statistics
     */
    updateOverviewStats(state) {
        // Total practice time - use real data from practiceHistory
        let totalSeconds = 0;
        if (state.practiceHistory && Array.isArray(state.practiceHistory)) {
            totalSeconds = state.practiceHistory.reduce((sum, entry) => sum + (entry.timeSpent || 0), 0);
        }
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        document.getElementById('total-practice-time').textContent = `${hours}h ${minutes}m`;

        // Total words studied
        document.getElementById('total-words-studied').textContent =
            state.progress.wordsLearned.length;

        // Overall accuracy
        const total = state.progress.totalCorrectAnswers + state.progress.totalWrongAnswers;
        const accuracy = total > 0
            ? Math.round((state.progress.totalCorrectAnswers / total) * 100)
            : 0;
        document.getElementById('overall-accuracy').textContent = accuracy + '%';

        // Total achievements
        document.getElementById('total-achievements').textContent =
            state.achievements.length;
    },

    /**
     * Update practice history chart
     */
    updatePracticeChart(state) {
        const canvas = document.getElementById('practiceCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart if any
        if (this.practiceChart) {
            this.practiceChart.destroy();
        }

        // Get practice history data
        const practiceHistory = state.practiceHistory || [];

        if (practiceHistory.length === 0) {
            // Show empty state
            const container = document.getElementById('practice-chart');
            container.innerHTML = `
                <div class="empty-state-small" style="padding: 40px; text-align: center;">
                    <i class="fas fa-chart-line" style="font-size: 48px; color: #ccc; margin-bottom: 10px;"></i>
                    <p style="color: #999;">Chưa có dữ liệu lịch sử luyện tập</p>
                    <p style="color: #666; font-size: 0.9em;">Hoàn thành một bài luyện tập để xem biểu đồ</p>
                </div>
            `;
            return;
        }

        // Make sure canvas is visible
        const container = document.getElementById('practice-chart');
        if (container.querySelector('.empty-state-small')) {
            container.innerHTML = '<canvas id="practiceCanvas" width="400" height="200"></canvas>';
        }

        // Filter data based on time range
        const filteredData = this.filterHistoryByRange(practiceHistory, this.currentRange);

        // Prepare chart data
        const labels = filteredData.map(entry => {
            const date = new Date(entry.date);
            return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
        });

        const sessionsData = filteredData.map(entry => entry.sessionsCompleted || 0);
        const xpData = filteredData.map(entry => entry.totalXpEarned || 0);
        const accuracyData = filteredData.map(entry => {
            const total = entry.questionsAnswered || 0;
            const correct = entry.correctAnswers || 0;
            return total > 0 ? Math.round((correct / total) * 100) : 0;
        });

        // ✅ Detect dark mode
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDarkMode ? '#cbd5e1' : '#666';
        const gridColor = isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(0, 0, 0, 0.1)';

        // Create chart
        this.practiceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Phiên luyện tập',
                        data: sessionsData,
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        yAxisID: 'y',
                        tension: 0.4
                    },
                    {
                        label: 'XP nhận được',
                        data: xpData,
                        borderColor: 'rgb(255, 205, 86)',
                        backgroundColor: 'rgba(255, 205, 86, 0.2)',
                        yAxisID: 'y1',
                        tension: 0.4
                    },
                    {
                        label: 'Độ chính xác (%)',
                        data: accuracyData,
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        yAxisID: 'y2',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: textColor
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    if (context.datasetIndex === 2) {
                                        label += context.parsed.y + '%';
                                    } else {
                                        label += context.parsed.y;
                                    }
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Phiên luyện tập',
                            color: textColor
                        },
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'XP',
                            color: textColor
                        },
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            drawOnChartArea: false,
                            color: gridColor
                        },
                    },
                    y2: {
                        type: 'linear',
                        display: false,
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    },

    /**
     * Filter history data by time range
     */
    filterHistoryByRange(history, range) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Helper function to convert Date to local YYYY-MM-DD string
        const toLocalDateString = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        console.log('🔍 DEBUG filterHistoryByRange:');
        console.log('  - Hôm nay (local):', toLocalDateString(today));
        console.log('  - Range:', range);
        console.log('  - History data:', history);

        let daysToShow;
        switch(range) {
            case 'week':
                daysToShow = 7;
                break;
            case 'month':
                daysToShow = 30;
                break;
            case 'all':
                daysToShow = 90;
                break;
            default:
                daysToShow = 7;
        }

        const cutoffDate = new Date(today);
        cutoffDate.setDate(cutoffDate.getDate() - (daysToShow - 1));

        console.log('  - Cutoff date:', toLocalDateString(cutoffDate));
        console.log('  - Days to show:', daysToShow);

        // Filter and sort
        const filtered = history
            .filter(entry => new Date(entry.date) >= cutoffDate)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Fill in missing days with zero data
        const filledData = [];
        for (let i = 0; i < daysToShow; i++) {
            const date = new Date(cutoffDate);
            date.setDate(date.getDate() + i);
            const dateStr = toLocalDateString(date);

            const existingEntry = filtered.find(e => e.date === dateStr);
            if (existingEntry) {
                filledData.push(existingEntry);
            } else {
                filledData.push({
                    date: dateStr,
                    sessionsCompleted: 0,
                    questionsAnswered: 0,
                    correctAnswers: 0,
                    totalXpEarned: 0,
                    totalCoinsEarned: 0,
                    timeSpent: 0
                });
            }
        }

        console.log('  - Filled data:', filledData.map(d => `${d.date} (${d.sessionsCompleted} sessions)`));
        return filledData;
    },

    /**
     * Update mode accuracy display
     */
    updateModeAccuracy(state) {
        const container = document.getElementById('mode-accuracy');

        // ✅ REAL DATA: Get actual mode stats from GameState
        const modeStats = state.progress.modeStats || {};

        const modeNames = {
            'multiple-choice': 'Trắc nghiệm',
            'fill-blank': 'Điền từ',
            'listening': 'Nghe và chọn',
            'matching': 'Nối từ',
            'word-scramble': 'Xếp chữ',
            'speed-quiz': 'Tốc độ',
            'flashcard': 'Thẻ từ vựng'
        };

        const modeData = Object.entries(modeNames).map(([modeKey, modeName]) => {
            const stats = modeStats[modeKey] || { correct: 0, total: 0 };
            const accuracy = stats.total > 0
                ? Math.round((stats.correct / stats.total) * 100)
                : 0;

            return { name: modeName, accuracy };
        }).filter(mode => mode.accuracy > 0); // Only show modes with data

        if (modeData.length === 0) {
            container.innerHTML = `
                <div class="empty-state-small">
                    <p>Chưa có dữ liệu luyện tập</p>
                </div>
            `;
            return;
        }

        container.innerHTML = modeData.map(mode => `
            <div class="mode-accuracy-item">
                <span class="mode-name">${mode.name}</span>
                <div class="accuracy-bar-container">
                    <div class="accuracy-bar" style="width: ${mode.accuracy}%"></div>
                </div>
                <span class="accuracy-value">${mode.accuracy}%</span>
            </div>
        `).join('');
    },

    /**
     * Update vocabulary progress by TOEIC parts
     */
    updateVocabularyProgress(state) {
        const container = document.getElementById('part-progress');

        // ✅ ĐÚNG - Dùng GameLogic
        const vocab = GameLogic.vocabularyData || [];
        const learned = state.progress.wordsLearned;

        // Count by parts
        const partCounts = {};
        vocab.forEach(word => {
            if (!partCounts[word.part]) {
                partCounts[word.part] = { total: 0, learned: 0 };
            }
            partCounts[word.part].total++;
            if (learned.includes(word.en)) {
                partCounts[word.part].learned++;
            }
        });

        // Display
        container.innerHTML = Object.entries(partCounts)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([part, data]) => {
                const pct = data.total > 0 ? Math.round(data.learned / data.total * 100) : 0;
                const barColor = pct >= 70 ? 'var(--success-color)' : pct >= 40 ? 'var(--warning-color)' : 'var(--error-color)';
                return `
                <div class="part-item">
                    <div class="part-item-header">
                        <span class="part-item-name">${part}</span>
                        <span class="part-item-score">${data.learned}/${data.total}</span>
                    </div>
                    <div class="part-item-bar-track">
                        <div class="part-item-bar-fill" style="width:${pct}%;background:${barColor}"></div>
                    </div>
                    <span class="part-item-pct" style="color:${barColor}">${pct}%</span>
                </div>`;
            }).join('');
    },

    /**
     * Update detailed stats table
     */
    updateDetailedStats(state) {
        const tbody = document.getElementById('detailed-stats-body');

        // ✅ REAL DATA: Get actual mode stats from GameState
        const modeStatsData = state.progress.modeStats || {};

        const modeConfigs = [
            { key: 'multiple-choice', icon: 'fa-list-check', name: 'Trắc nghiệm' },
            { key: 'fill-blank', icon: 'fa-pen', name: 'Điền từ' },
            { key: 'listening', icon: 'fa-headphones', name: 'Nghe và chọn' },
            { key: 'matching', icon: 'fa-link', name: 'Nối từ' },
            { key: 'word-scramble', icon: 'fa-shuffle', name: 'Xếp chữ' },
            { key: 'speed-quiz', icon: 'fa-clock', name: 'Tốc độ' },
            { key: 'flashcard', icon: 'fa-layer-group', name: 'Thẻ từ vựng' },
        ];

        const modeStats = modeConfigs.map(config => {
            const stats = modeStatsData[config.key] || { played: 0, correct: 0, total: 0, score: 0 };
            const accuracy = stats.total > 0
                ? Utils.roundTo((stats.correct / stats.total) * 100, 1)
                : 0;
            const avgScore = stats.played > 0
                ? Math.round(stats.score / stats.played)
                : 0;

            return {
                icon: config.icon,
                name: config.name,
                played: stats.played,
                correct: stats.correct,
                total: stats.total,
                accuracy: accuracy,
                avgScore: avgScore
            };
        }).filter(stat => stat.played > 0); // Only show modes that have been played

        if (modeStats.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 20px;">
                        Chưa có dữ liệu luyện tập
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = modeStats.map(stat => `
            <tr>
                <td><i class="fas ${stat.icon}"></i> ${stat.name}</td>
                <td>${stat.played}</td>
                <td>${stat.correct}/${stat.total}</td>
                <td><span class="badge-success">${stat.accuracy}%</span></td>
                <td>${stat.avgScore}</td>
            </tr>
        `).join('');
    },
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatisticsUI;
}