/**
 * TOEIC UI Manager
 * Handles all TOEIC screen UI logic
 */

const ToeicUI = {
    currentTab: 'full-test',
    tests: [],
    currentAttempt: null,
    currentTest: null,
    questions: [],
    currentQuestionIndex: 0,
    answers: {},
    markedQuestions: new Set(),
    startTime: null,
    timerInterval: null,
    currentSection: null, // 'listening' or 'reading'
    sectionTransitioned: false, // Track if already transitioned from listening to reading

    // Fill-in-blank (Đục lỗ) mode properties
    fillInBlankMode: false,
    keywordAnswers: {}, // Store user's keyword answers

    /**
     * Initialize TOEIC UI
     */
    init() {
        this.setupEventListeners();
        this.loadTests();
        this.checkInProgressAttempt();
    },

    /**
     * Check if user has an in-progress attempt and offer to resume
     */
    async checkInProgressAttempt() {
        try {
            const res = await ToeicAPI.getInProgressAttempt();
            if (!res?.data) return;

            const attempt = res.data;

            // Nếu user đã bỏ qua attempt này trước đó thì không hiện lại
            const dismissedKey = `toeic_dismissed_attempt_${attempt._id}`;
            if (localStorage.getItem(dismissedKey)) return;

            const testTitle = attempt.testId?.title || 'Bài thi TOEIC';
            const answeredCount = Object.keys(attempt.answers || {}).length;
            const totalQ = attempt.testId?.totalQuestions || '?';

            Modal.show({
                title: '📋 Bạn có bài luyện tập đang dở',
                content: `
                    <p>Bài thi <strong>${testTitle}</strong> chưa hoàn thành.</p>
                    <p>Đã trả lời: <strong>${answeredCount}/${totalQ}</strong> câu</p>
                    <p>Bạn có muốn tiếp tục không?</p>
                `,
                buttons: [
                    {
                        text: 'Tiếp tục làm bài',
                        className: 'btn-primary',
                        stayOpen: true,
                        onClick: async () => {
                            Modal.close();
                            await this.resumeAttemptById(attempt._id, attempt);
                        }
                    },
                    {
                        text: 'Bỏ qua',
                        className: 'btn-secondary',
                        onClick: () => {
                            localStorage.setItem(dismissedKey, '1');
                            Modal.close();
                        }
                    }
                ]
            });
        } catch (err) {
            // Silently fail — don't block normal flow
        }
    },

    /**
     * Resume an existing attempt by ID
     */
    async resumeAttemptById(attemptId, attemptData) {
        try {
            // Chuyển sang màn hình TOEIC ngay lập tức
            UI.showScreen('toeic-screen');

            // Restore attempt state
            this.answers = attemptData.answers || {};
            this.markedQuestions = new Set(attemptData.markedQuestions || []);

            // Start test với resumeAttemptId → bỏ qua modal chọn thời gian
            const testId = attemptData.testId?._id || attemptData.testId;
            if (testId) {
                await this.startTest(testId, { resumeAttemptId: attemptId, savedAnswers: this.answers });
            }
        } catch (err) {
            Notification.show({ type: 'error', message: 'Không thể tiếp tục bài thi. Vui lòng thử lại.' });
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.toeic-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Back button
        const backBtn = document.querySelector('#toeic-screen .back-btn-screen');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (this.currentAttempt) {
                    this.confirmExit();
                } else {
                    UI.showScreen('home-screen');
                }
            });
        }
    },

    /**
     * Switch tab
     */
    switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.toeic-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Load tab content
        switch (tabName) {
            case 'full-test':
                this.loadFullTests();
                break;
            case 'mini-test':
                this.loadMiniTests();
                break;
            case 'fill-blank':
                this.loadFillInBlankTests();
                break;
            case 'my-history':
                this.loadHistory();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    },

    /**
     * Load all tests
     */
    async loadTests() {
        try {
            const response = await ToeicAPI.getTests();

            // Http client wraps response, so unwrap it
            const apiData = response.data || response;

            if (apiData.success && apiData.data) {
                this.tests = Array.isArray(apiData.data) ? apiData.data : [];
            } else {
                this.tests = [];
            }

            this.loadFullTests(); // Load default tab
        } catch (error) {
            console.error('Error loading tests:', error);
            this.tests = [];
            Notification.show({
                type: 'error',
                message: 'Không thể tải danh sách bài thi'
            });
        }
    },

    /**
     * Load full tests tab
     */
    loadFullTests() {
        const fullTests = this.tests.filter(t => t.testType === 'full-test');
        const container = document.getElementById('toeic-tab-content');

        if (fullTests.length === 0) {
            container.innerHTML = this.renderEmptyState(
                'Chưa có bài thi Full Test',
                'Hệ thống đang cập nhật các bài thi mới'
            );
            return;
        }

        container.innerHTML = `
            <div class="toeic-tests-grid">
                ${fullTests.map(test => this.renderTestCard(test)).join('')}
            </div>
        `;

        // Add event listeners
        this.attachTestCardListeners();
    },

    /**
     * Load mini tests tab - Display list of all mini tests
     */
    loadMiniTests() {
        const container = document.getElementById('toeic-tab-content');

        // Filter to get only Mini Tests (not Full Tests)
        const miniTests = this.tests.filter(test =>
            test.testType.startsWith('mini-part') && test.isPublished === true
        );

        if (miniTests.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem;">
                    <i class="fas fa-inbox" style="font-size: 4rem; color: var(--text-tertiary); margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary); font-size: 1.1rem;">Chưa có Mini Test nào được xuất bản</p>
                    <p style="color: var(--text-tertiary); margin-top: 0.5rem;">Admin cần tạo và xuất bản Mini Test trước</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="toeic-tests-grid">
                ${miniTests.map(test => this.renderTestCard(test)).join('')}
            </div>
        `;

        // Add event listeners
        this.attachTestCardListeners();
    },

    /**
     * Load fill-in-blank (Đục lỗ) tests tab
     * Shows Mini Tests that have questions with keywords defined
     */
    async loadFillInBlankTests() {
        const container = document.getElementById('toeic-tab-content');

        // Filter mini tests for listening parts (1-4) that may have fill-in-blank questions
        const fillBlankTests = this.tests.filter(test =>
            test.testType.startsWith('mini-part') &&
            test.isPublished === true &&
            ['mini-part1', 'mini-part2', 'mini-part3', 'mini-part4'].includes(test.testType)
        );

        if (fillBlankTests.length === 0) {
            container.innerHTML = `
                <div class="toeic-empty-state">
                    <div class="toeic-empty-icon">
                        <i class="fas fa-pen-square"></i>
                    </div>
                    <h3 class="toeic-empty-title">Chưa có bài thi Đục lỗ</h3>
                    <p class="toeic-empty-text">Chế độ này áp dụng cho các Mini Test Part 1-4 (Listening) có định nghĩa keyword.</p>
                    <p class="toeic-empty-text" style="margin-top: 10px; font-size: 0.9rem; color: var(--text-tertiary);">
                        Admin cần thêm keyword cho các câu hỏi trong Dashboard để sử dụng chế độ này.
                    </p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="margin-bottom: 20px; padding: 15px; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); border-radius: 12px; color: white;">
                <h4 style="margin: 0 0 10px 0;"><i class="fas fa-pen-square"></i> Chế độ Đục lỗ (Fill-in-blank)</h4>
                <p style="margin: 0; opacity: 0.9; font-size: 0.95rem;">
                    Trong chế độ này, các từ khóa trong câu hỏi và đáp án đúng sẽ bị ẩn.
                    Bạn cần điền đúng từ để hoàn thành bài thi.
                </p>
            </div>
            <div class="toeic-tests-grid">
                ${fillBlankTests.map(test => this.renderFillBlankTestCard(test)).join('')}
            </div>
        `;

        // Add event listeners for fill-blank test cards
        container.querySelectorAll('.toeic-test-card[data-fill-blank="true"]').forEach(card => {
            card.addEventListener('click', () => {
                const testId = card.dataset.testId;
                this.startFillBlankTest(testId);
            });
        });
    },

    /**
     * Render fill-blank test card
     */
    renderFillBlankTestCard(test) {
        const partNumber = test.testType.replace('mini-part', '');

        return `
            <div class="toeic-test-card" data-test-id="${test._id}" data-fill-blank="true">
                <div class="toeic-test-header">
                    <div class="toeic-test-icon" style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));">
                        <i class="fas fa-pen-square"></i>
                    </div>
                    <div>
                        <span class="toeic-test-badge mini">Part ${partNumber}</span>
                        <span class="toeic-test-badge" style="background: var(--primary-light, #f0e6ff); color: var(--primary-color);">Đục lỗ</span>
                    </div>
                </div>

                <h3 class="toeic-test-title">${test.testName}</h3>
                <p class="toeic-test-description">Điền từ còn thiếu vào chỗ trống trong câu hỏi và đáp án</p>

                <div class="toeic-test-stats">
                    <div class="toeic-stat">
                        <span class="toeic-stat-value">${test.totalQuestions}</span>
                        <span class="toeic-stat-label">Câu hỏi</span>
                    </div>
                    <div class="toeic-stat">
                        <span class="toeic-stat-value">${Math.floor(test.totalTime / 60)}</span>
                        <span class="toeic-stat-label">Phút</span>
                    </div>
                    <div class="toeic-stat">
                        <span class="toeic-stat-value"><i class="fas fa-pen"></i></span>
                        <span class="toeic-stat-label">Điền từ</span>
                    </div>
                </div>

                <div class="toeic-test-footer">
                    <span class="toeic-test-attempts">
                        <i class="fas fa-headphones"></i> Listening Part ${partNumber}
                    </span>
                    <button class="toeic-start-btn">
                        <i class="fas fa-play"></i> Bắt đầu
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Start fill-in-blank test
     */
    async startFillBlankTest(testId) {
        const test = this.tests.find(t => t._id === testId);
        if (!test) {
            Notification.show({ type: 'error', message: 'Không tìm thấy bài thi' });
            return;
        }

        this.fillInBlankMode = true;
        this.keywordAnswers = {};

        // Use normal startTest but with fillInBlankMode flag set
        await this.startTest(testId);
    },

    /**
     * Process keyword blank - Replace keyword with input field
     * @param {string} text - Original text
     * @param {string} keyword - Keyword to blank out
     * @param {string} inputId - Unique ID for the input field
     * @returns {string} - Text with keyword replaced by input field
     */
    processKeywordBlank(text, keyword, inputId) {
        if (!text || !keyword) return text;

        // Case-insensitive replacement
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');

        return text.replace(regex, (match) => {
            const savedValue = this.keywordAnswers[inputId] || '';
            return `<input type="text"
                class="keyword-blank-input"
                id="${inputId}"
                data-correct="${match}"
                value="${savedValue}"
                placeholder="..."
                autocomplete="off"
                style="width: ${Math.max(match.length * 12, 80)}px;">`;
        });
    },

    /**
     * Check keyword answers and show results
     */
    checkKeywordAnswers() {
        const inputs = document.querySelectorAll('.keyword-blank-input');
        let correct = 0;
        let total = inputs.length;

        inputs.forEach(input => {
            const userAnswer = input.value.trim().toLowerCase();
            const correctAnswer = input.dataset.correct.toLowerCase();

            // Save user's answer
            this.keywordAnswers[input.id] = input.value;

            if (userAnswer === correctAnswer) {
                input.classList.remove('keyword-wrong');
                input.classList.add('keyword-correct');
                correct++;
            } else {
                input.classList.remove('keyword-correct');
                input.classList.add('keyword-wrong');
            }
        });

        // Play sound based on result
        if (correct === total) {
            Utils.playSound(Config.sounds.correct, 0.5);
        } else {
            Utils.playSound(Config.sounds.wrong, 0.5);
        }

        return { correct, total };
    },

    /**
     * Load history tab
     */
    async loadHistory(page = 1) {
        const container = document.getElementById('toeic-tab-content');
        const limit = 10; // 10 items per page

        try {
            const response = await ToeicAPI.getMyAttempts({ limit, skip: (page - 1) * limit });
            const apiData = response.data || response;

            if (apiData.success && apiData.data && apiData.data.length > 0) {
                const totalPages = Math.ceil((apiData.total || apiData.data.length) / limit);

                container.innerHTML = `
                    <div class="toeic-history-list">
                        ${apiData.data.map(attempt => this.renderHistoryItem(attempt)).join('')}
                    </div>
                    ${totalPages > 1 ? this.renderPagination(page, totalPages) : ''}
                `;

                // Add event listeners for view result buttons
                const viewButtons = container.querySelectorAll('.view-result-btn');
                viewButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const attemptId = btn.getAttribute('data-attempt-id');
                        this.viewResults(attemptId);
                    });
                });

                // Add event listeners for pagination buttons
                const pageButtons = container.querySelectorAll('.history-page-btn');
                pageButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const targetPage = parseInt(btn.getAttribute('data-page'));
                        this.loadHistory(targetPage);
                    });
                });
            } else {
                container.innerHTML = this.renderEmptyState(
                    'Chưa có lịch sử thi',
                    'Bắt đầu làm bài thi đầu tiên của bạn!'
                );
            }
        } catch (error) {
            container.innerHTML = this.renderEmptyState(
                'Lỗi tải lịch sử',
                'Vui lòng thử lại sau'
            );
        }
    },

    renderPagination(currentPage, totalPages) {
        let pages = '';
        for (let i = 1; i <= totalPages; i++) {
            const isActive = i === currentPage ? 'active' : '';
            pages += `<button class="history-page-btn ${isActive}" data-page="${i}">${i}</button>`;
        }

        return `
            <div class="toeic-history-pagination" style="display: flex; justify-content: center; gap: 10px; margin-top: 20px; padding: 20px;">
                <button class="history-page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i> Trước
                </button>
                ${pages}
                <button class="history-page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
                    Sau <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
    },

    /**
     * Load analytics tab
     */
    async loadAnalytics() {
        const container = document.getElementById('toeic-tab-content');

        try {
            const [overview, progress, parts] = await Promise.all([
                ToeicAPI.getAnalyticsOverview(),
                ToeicAPI.getScoreProgress(10),
                ToeicAPI.getPartAnalysis()
            ]);

            // Unwrap responses
            const overviewData = (overview.data?.data || overview.data || overview);
            const progressData = (progress.data?.data || progress.data || progress);
            const partsData = (parts.data?.data || parts.data || parts);

            container.innerHTML = this.renderAnalytics(overviewData, progressData, partsData);
        } catch (error) {
            container.innerHTML = this.renderEmptyState(
                'Chưa có dữ liệu thống kê',
                'Làm một vài bài thi để xem phân tích chi tiết!'
            );
        }
    },

    /**
     * Render test card
     */
    renderTestCard(test) {
        const badge = test.testType === 'full-test' ? 'full' : 'mini';
        const difficultyBadge = test.difficulty || 'medium';

        return `
            <div class="toeic-test-card" data-test-id="${test._id}">
                <div class="toeic-test-header">
                    <div class="toeic-test-icon">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <div>
                        <span class="toeic-test-badge ${badge}">${badge === 'full' ? 'Full Test' : 'Mini Test'}</span>
                        <span class="toeic-test-badge ${difficultyBadge}">${difficultyBadge}</span>
                    </div>
                </div>

                <h3 class="toeic-test-title">${test.testName}</h3>
                <p class="toeic-test-description">${test.description || 'Bài thi TOEIC chuẩn quốc tế'}</p>

                <div class="toeic-test-stats">
                    <div class="toeic-stat">
                        <span class="toeic-stat-value">${test.totalQuestions}</span>
                        <span class="toeic-stat-label">Câu hỏi</span>
                    </div>
                    <div class="toeic-stat">
                        <span class="toeic-stat-value">${Math.floor(test.totalTime / 60)}</span>
                        <span class="toeic-stat-label">Phút</span>
                    </div>
                    <div class="toeic-stat">
                        <span class="toeic-stat-value">${test.averageScore || '-'}</span>
                        <span class="toeic-stat-label">Trung bình</span>
                    </div>
                </div>

                <div class="toeic-test-footer">
                    <span class="toeic-test-attempts">
                        <i class="fas fa-users"></i>
                        ${test.timesAttempted || 0} lượt thi
                    </span>
                    <button class="toeic-start-btn" ${!test.canAccess ? 'disabled' : ''}>
                        ${test.canAccess ? 'Bắt đầu' : 'Locked'}
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Render part card
     */
    renderPartCard(part) {
        return `
            <div class="toeic-part-card" data-part="${part.number}">
                <div class="toeic-part-number">Part ${part.number}</div>
                <div class="toeic-part-name">${part.name}</div>
                <div class="toeic-part-type">${part.type}</div>
                <div class="toeic-part-questions">
                    ${part.questions} câu | ${part.time}
                </div>
                <button class="toeic-start-btn">Luyện tập</button>
            </div>
        `;
    },

    /**
     * Render history item
     */
    renderHistoryItem(attempt) {
        const date = new Date(attempt.completedAt).toLocaleDateString('vi-VN');
        const levelClass = attempt.totalScore >= 700 ? 'success' : attempt.totalScore >= 400 ? 'warning' : 'error';

        return `
            <div class="toeic-history-item" data-attempt-id="${attempt._id}">
                <div class="history-left">
                    <h4>${attempt.testName}</h4>
                    <p>${date}</p>
                </div>
                <div class="history-right">
                    <div class="history-score ${levelClass}">
                        <span class="score-value">${attempt.totalScore}</span>
                        <span class="score-label">/ 990</span>
                    </div>
                    <button class="toeic-action-btn view-result-btn" data-attempt-id="${attempt._id}">
                        <i class="fas fa-eye"></i> Xem
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Render analytics
     */
    renderAnalytics(overview, progress, parts) {
        const html = `
            <div class="toeic-analytics-container">
                <div class="analytics-overview">
                    <h3><i class="fas fa-chart-bar"></i> Tổng quan</h3>
                    <div class="analytics-grid">
                        <div class="analytics-card">
                            <div class="analytics-value">${overview.totalAttempts || 0}</div>
                            <div class="analytics-label">Lần thi</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-value">${overview.averageScore || 0}</div>
                            <div class="analytics-label">Điểm TB</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-value">${overview.bestScore || 0}</div>
                            <div class="analytics-label">Điểm cao nhất</div>
                        </div>
                    </div>
                </div>

                <div class="analytics-charts-row">
                    <div class="analytics-chart-card">
                        <h3><i class="fas fa-chart-line"></i> Tiến độ điểm số</h3>
                        <canvas id="progress-chart-canvas"></canvas>
                    </div>

                    <div class="analytics-chart-card">
                        <h3><i class="fas fa-chart-pie"></i> Listening vs Reading</h3>
                        <canvas id="listening-reading-chart"></canvas>
                    </div>
                </div>

                <div class="analytics-chart-card full-width">
                    <h3><i class="fas fa-layer-group"></i> Phân tích theo Part</h3>
                    <canvas id="parts-chart-canvas"></canvas>
                </div>
            </div>
        `;

        // Render charts after DOM update
        setTimeout(() => {
            this.createProgressChart(progress);
            this.createListeningReadingChart(overview);
            this.createPartsChart(parts);
        }, 100);

        return html;
    },

    /**
     * Create progress line chart with Chart.js
     */
    createProgressChart(data) {
        const canvas = document.getElementById('progress-chart-canvas');
        if (!canvas || !data || data.length === 0) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart if any
        if (this.progressChart) {
            this.progressChart.destroy();
        }

        const labels = data.map((d, i) => `Lần ${i + 1}`);
        const scores = data.map(d => d.totalScore);
        const listeningScores = data.map(d => d.listeningScore);
        const readingScores = data.map(d => d.readingScore);

        this.progressChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Tổng điểm',
                        data: scores,
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Listening',
                        data: listeningScores,
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: 'Reading',
                        data: readingScores,
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.4,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 990
                    }
                }
            }
        });
    },

    /**
     * Create Listening vs Reading doughnut chart
     */
    createListeningReadingChart(overview) {
        const canvas = document.getElementById('listening-reading-chart');
        if (!canvas || !overview) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart if any
        if (this.listeningReadingChart) {
            this.listeningReadingChart.destroy();
        }

        this.listeningReadingChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Listening', 'Reading'],
                datasets: [{
                    data: [
                        overview.averageListening || 0,
                        overview.averageReading || 0
                    ],
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 99, 132, 0.8)'
                    ],
                    borderColor: [
                        'rgb(54, 162, 235)',
                        'rgb(255, 99, 132)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1.5,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + ' / 495';
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Create parts bar chart
     */
    createPartsChart(data) {
        const canvas = document.getElementById('parts-chart-canvas');
        if (!canvas || !data || data.length === 0) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart if any
        if (this.partsChart) {
            this.partsChart.destroy();
        }

        const labels = data.map(part => `Part ${part.partNumber}`);
        const accuracies = data.map(part => part.avgAccuracy || 0);
        const attempts = data.map(part => part.attempts || 0);

        this.partsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Độ chính xác (%)',
                        data: accuracies,
                        backgroundColor: 'rgba(75, 192, 192, 0.8)',
                        borderColor: 'rgb(75, 192, 192)',
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Số lần thử',
                        data: attempts,
                        backgroundColor: 'rgba(153, 102, 255, 0.8)',
                        borderColor: 'rgb(153, 102, 255)',
                        borderWidth: 2,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.5,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Độ chính xác (%)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        grid: {
                            drawOnChartArea: false
                        },
                        title: {
                            display: true,
                            text: 'Số lần thử'
                        }
                    }
                }
            }
        });
    },

    /**
     * Render empty state
     */
    renderEmptyState(title, text) {
        return `
            <div class="toeic-empty-state">
                <div class="toeic-empty-icon">
                    <i class="fas fa-inbox"></i>
                </div>
                <h3 class="toeic-empty-title">${title}</h3>
                <p class="toeic-empty-text">${text}</p>
            </div>
        `;
    },

    /**
     * Attach test card listeners
     */
    attachTestCardListeners() {
        document.querySelectorAll('.toeic-test-card .toeic-start-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = e.target.closest('.toeic-test-card');
                const testId = card.dataset.testId;
                // Reset fill-blank mode for normal tests
                this.fillInBlankMode = false;
                this.keywordAnswers = {};
                this.startTest(testId);
            });
        });
    },

    /**
     * Attach part card listeners
     */
    attachPartCardListeners() {
        document.querySelectorAll('.toeic-part-card .toeic-start-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.toeic-part-card');
                const partNumber = card.dataset.part;
                this.startPartTest(partNumber);
            });
        });
    },

    /**
     * Start test
     */
    async startTest(testId, options = {}) {
        try {
            // If resuming an existing attempt, skip the time selection modal
            if (options.resumeAttemptId) {
                const apiData = await ToeicAPI.resumeAttempt(options.resumeAttemptId);
                // Reload questions for this attempt
                const reviewRes = await Http.get(`/api/toeic/attempts/${options.resumeAttemptId}/review`);
                const reviewData = reviewRes?.data || reviewRes;
                if (reviewData?.success && reviewData?.data) {
                    this.currentAttempt = { attemptId: options.resumeAttemptId };
                    this.answers = options.savedAnswers || {};
                    this.questions = reviewData.data.questions || [];
                    this.renderTestScreen(reviewData.data);
                    this.startTimer();
                }
                return;
            }

            // Find test info to show time options
            const test = this.tests.find(t => t._id === testId);

            // Show time selection modal
            Modal.show({
                title: 'Chọn thời gian làm bài',
                content: `
                    <div style="padding: 20px;">
                        <p style="margin-bottom: 20px; color: var(--text-secondary);">
                            Bài thi: <strong>${test?.testName || 'TOEIC Test'}</strong><br>
                            Số câu hỏi: <strong>${test?.totalQuestions || 200}</strong> câu
                        </p>

                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                                <i class="fas fa-clock"></i> Chọn thời gian:
                            </label>
                            <select id="time-selection" style="
                                width: 100%;
                                padding: 12px;
                                border: 2px solid var(--border-color);
                                border-radius: 8px;
                                font-size: 16px;
                                background: var(--bg-secondary);
                                color: var(--text-primary);
                                cursor: pointer;
                            ">
                                <option value="default" selected>⭐ Mặc định (120 phút)</option>
                                <optgroup label="⚡ Luyện nhanh">
                                    <option value="3">3 phút</option>
                                    <option value="5">5 phút</option>
                                    <option value="10">10 phút</option>
                                    <option value="15">15 phút</option>
                                    <option value="20">20 phút</option>
                                    <option value="25">25 phút</option>
                                    <option value="30">30 phút</option>
                                </optgroup>
                                <optgroup label="📚 Luyện trung bình">
                                    <option value="40">40 phút</option>
                                    <option value="45">45 phút</option>
                                    <option value="50">50 phút</option>
                                    <option value="60">60 phút (1 giờ)</option>
                                    <option value="75">75 phút (1 giờ 15 phút)</option>
                                    <option value="90">90 phút (1.5 giờ)</option>
                                </optgroup>
                                <optgroup label="🎯 Thi thật TOEIC">
                                    <option value="45">45 phút (Listening)</option>
                                    <option value="75">75 phút (Reading)</option>
                                    <option value="120">120 phút (2 giờ - Full Test)</option>
                                </optgroup>
                                <optgroup label="🔥 Luyện dài hạn">
                                    <option value="135">135 phút (2 giờ 15 phút)</option>
                                    <option value="150">150 phút (2.5 giờ)</option>
                                    <option value="180">180 phút (3 giờ)</option>
                                    <option value="210">210 phút (3.5 giờ)</option>
                                    <option value="240">240 phút (4 giờ)</option>
                                    <option value="300">300 phút (5 giờ)</option>
                                </optgroup>
                                <optgroup label="♾️ Tùy chỉnh">
                                    <option value="custom">⚙️ Tùy chỉnh thời gian...</option>
                                    <option value="unlimited">∞ Không giới hạn thời gian</option>
                                </optgroup>
                            </select>
                        </div>

                        <!-- Custom time input (hidden by default) -->
                        <div id="custom-time-input" style="display: none; margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                                <i class="fas fa-edit"></i> Nhập thời gian tùy chỉnh (phút):
                            </label>
                            <input
                                type="number"
                                id="custom-time-value"
                                min="1"
                                max="600"
                                value="120"
                                style="
                                    width: 100%;
                                    padding: 12px;
                                    border: 2px solid var(--border-color);
                                    border-radius: 8px;
                                    font-size: 16px;
                                    background: var(--bg-secondary);
                                    color: var(--text-primary);
                                "
                                placeholder="Nhập số phút (1-600)"
                            />
                            <p style="font-size: 0.85em; color: var(--text-tertiary); margin-top: 5px;">
                                Tối thiểu 1 phút, tối đa 600 phút (10 giờ)
                            </p>
                        </div>

                        <p style="font-size: 0.9em; color: var(--text-tertiary); margin-top: 15px;">
                            <i class="fas fa-info-circle"></i> Chọn "Không giới hạn" nếu bạn muốn làm bài không giới hạn thời gian
                        </p>
                    </div>
                `,
                buttons: [
                    {
                        text: 'Hủy',
                        className: 'btn-secondary',
                        onClick: () => {
                            Modal.close();
                        }
                    },
                    {
                        text: 'Bắt đầu',
                        className: 'btn-primary',
                        onClick: async () => {
                            const timeSelect = document.getElementById('time-selection');
                            let selectedTime = timeSelect.value;

                            // If custom time is selected, get the custom value
                            if (selectedTime === 'custom') {
                                const customTimeInput = document.getElementById('custom-time-value');
                                const customValue = parseInt(customTimeInput.value);

                                // Validate custom time
                                if (isNaN(customValue) || customValue < 1 || customValue > 600) {
                                    Notification.show({
                                        type: 'error',
                                        message: 'Vui lòng nhập thời gian từ 1 đến 600 phút'
                                    });
                                    return;
                                }

                                selectedTime = customValue.toString();
                            }

                            Modal.close();

                            // Show loading
                            Modal.show({
                                title: 'Đang chuẩn bị bài thi...',
                                content: '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin" style="font-size: 48px; color: var(--primary-color);"></i></div>'
                            });

                            // Start attempt (pass fillBlankMode flag for fill-in-blank tests)
                            const response = await ToeicAPI.startAttempt(testId, this.fillInBlankMode);

                            // Unwrap Http client response
                            const apiData = response.data || response;

                            if (apiData.success && apiData.data) {
                                this.currentAttempt = apiData.data;
                                this.currentTest = apiData.data.test;
                                this.questions = apiData.data.questions;
                                this.currentQuestionIndex = 0;
                                this.answers = {};
                                this.markedQuestions = new Set();
                                this.startTime = Date.now();
                                this.sectionTransitioned = false; // Reset section transition flag
                                this.shownPartTransitions = new Set(); // Reset part transition tracking

                                // Store selected time
                                if (selectedTime === 'unlimited') {
                                    this.customTimeLimit = null; // No time limit
                                } else if (selectedTime === 'default') {
                                    this.customTimeLimit = this.currentTest.totalTime; // Use default
                                } else {
                                    this.customTimeLimit = parseInt(selectedTime) * 60; // Convert minutes to seconds
                                }

                                // Hide selector, show test interface
                                document.getElementById('toeic-selector').style.display = 'none';
                                document.getElementById('toeic-test-interface').style.display = 'block';

                                // Render test interface
                                this.renderTestInterface();

                                // Start timer
                                this.startTimer();

                                Modal.close();
                            }
                        }
                    }
                ]
            });

            // Add event listener for time selection change (show/hide custom input)
            setTimeout(() => {
                const timeSelect = document.getElementById('time-selection');
                const customTimeDiv = document.getElementById('custom-time-input');

                if (timeSelect && customTimeDiv) {
                    timeSelect.addEventListener('change', (e) => {
                        if (e.target.value === 'custom') {
                            customTimeDiv.style.display = 'block';
                            document.getElementById('custom-time-value')?.focus();
                        } else {
                            customTimeDiv.style.display = 'none';
                        }
                    });
                }
            }, 100);
        } catch (error) {
            Modal.close();
            Notification.show({
                type: 'error',
                message: error.message || 'Không thể bắt đầu bài thi'
            });
        }
    },

    /**
     * Start part test
     */
    async startPartTest(partNumber) {
        // Find mini test for this part
        const miniTest = this.tests.find(t => t.testType === `mini-part${partNumber}`);

        if (miniTest) {
            this.startTest(miniTest._id);
        } else {
            Notification.show({
                type: 'warning',
                message: `Bài thi Part ${partNumber} chưa có sẵn`
            });
        }
    },

    /**
     * Render test interface
     */
    renderTestInterface() {
        const container = document.getElementById('toeic-test-interface');

        container.innerHTML = `
            <div class="toeic-test-header-bar">
                <button class="toeic-back-btn" id="toeic-back-btn" title="Quay lại">
                    <i class="fas fa-arrow-left"></i>
                </button>

                <div class="toeic-test-info">
                    <div class="toeic-test-name">${this.currentTest.testName}</div>
                    <div class="toeic-progress-info">
                        Câu <span id="current-question-num">${this.currentQuestionIndex + 1}</span>/${this.currentTest.totalQuestions}
                    </div>
                </div>

                <div class="toeic-timer-group">
                    <div class="toeic-timer" id="toeic-timer">
                        <i class="fas fa-clock"></i>
                        <span id="timer-display">00:00</span>
                    </div>
                    <button class="toeic-nav-toggle-btn" id="toeic-nav-toggle-btn" title="Điều hướng câu hỏi">
                        <i class="fas fa-th"></i>
                        <span>Câu hỏi</span>
                    </button>
                </div>

                <div class="toeic-test-actions">
                    <button class="toeic-action-btn" id="mark-review-btn">
                        <i class="fas fa-bookmark"></i> Đánh dấu
                    </button>
                    <button class="toeic-action-btn" id="pause-btn">
                        <i class="fas fa-pause"></i> Tạm dừng
                    </button>
                    <button class="toeic-action-btn primary" id="submit-test-btn">
                        <i class="fas fa-check"></i> Nộp bài
                    </button>
                </div>
            </div>

            <div class="toeic-question-container" id="question-container">
                <!-- Question will be rendered here -->
            </div>


            <!-- Popup điều hướng -->
            <div class="toeic-nav-popup" id="toeic-nav-popup" style="display:none;">
                <div class="toeic-nav-popup-inner">
                    <div class="toeic-nav-popup-header">
                        <span class="toeic-nav-title"><i class="fas fa-list"></i> Điều hướng câu hỏi</span>
                        <button class="toeic-nav-popup-close" id="toeic-nav-popup-close"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="toeic-nav-legend">
                        <span class="toeic-legend-item"><span class="toeic-legend-dot current"></span>Hiện tại</span>
                        <span class="toeic-legend-item"><span class="toeic-legend-dot answered"></span>Đã trả lời</span>
                        <span class="toeic-legend-item"><span class="toeic-legend-dot marked"></span>Đánh dấu</span>
                    </div>
                    <div class="toeic-nav-grid" id="question-nav-grid"></div>
                </div>
            </div>
        `;

        // Render navigation
        this.renderQuestionNav();

        // Render first question
        this.renderQuestion();

        // Setup listeners
        this.setupTestListeners();

        // Auto-play audio câu đầu tiên
        this.autoPlayAudio();
    },

    /**
     * Render question navigation
     */
    renderQuestionNav() {
        const navGrid = document.getElementById('question-nav-grid');

        navGrid.innerHTML = this.questions.map((q, i) => {
            const classes = [];
            if (i === this.currentQuestionIndex) classes.push('current');
            if (this.answers[i] !== undefined) classes.push('answered');
            if (this.markedQuestions.has(i)) classes.push('marked');

            return `
                <button class="toeic-nav-btn ${classes.join(' ')}" data-index="${i}">
                    ${i + 1}
                </button>
            `;
        }).join('');

        // Add listeners
        navGrid.querySelectorAll('.toeic-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.goToQuestion(index);
                // Đóng popup sau khi chọn
                const popup = document.getElementById('toeic-nav-popup');
                if (popup) popup.style.display = 'none';
            });
        });

        // Toggle popup listeners (chỉ gắn 1 lần)
        if (!this._navPopupListenerAttached) {
            this._navPopupListenerAttached = true;
            document.addEventListener('click', (e) => {
                const popup = document.getElementById('toeic-nav-popup');
                const toggleBtn = document.getElementById('toeic-nav-toggle-btn');
                const closeBtn = document.getElementById('toeic-nav-popup-close');
                if (!popup) return;
                if (closeBtn && closeBtn.contains(e.target)) {
                    popup.style.display = 'none';
                } else if (toggleBtn && toggleBtn.contains(e.target)) {
                    popup.style.display = popup.style.display === 'none' ? 'flex' : 'none';
                } else if (popup.style.display !== 'none' && !popup.contains(e.target)) {
                    popup.style.display = 'none';
                }
            });
        }
    },

    /**
     * Render current question
     */
    renderQuestion() {
        const question = this.questions[this.currentQuestionIndex];
        const container = document.getElementById('question-container');

        if (!question) return;

        let html = '';
        const isTwoCols = question.part <= 4;

        // Part-specific rendering
        if (isTwoCols) {
            // Listening: layout 2 cột — left panel chứa audio/image
            const leftContent = this.renderListeningQuestion(question);
            html += `
                <div class="toeic-two-col-layout">
                    <div class="toeic-left-panel">
                        <div class="toeic-question-number">Câu ${this.currentQuestionIndex + 1}</div>
                        ${leftContent}
                    </div>
                    <div class="toeic-right-panel">
                        <div class="toeic-right-header">Chọn đáp án</div>
            `;
        } else {
            // Reading: layout 1 cột
            html += `<div class="toeic-question-number">Câu ${this.currentQuestionIndex + 1}</div>`;
            html += this.renderReadingQuestion(question);
        }

        // FILL-IN-BLANK MODE: Hiển thị tất cả đáp án A,B,C,D (không cho chọn, chỉ hiển thị)
        if (this.fillInBlankMode) {
            html += `
                <div class="toeic-options-display">
                    ${question.options.map(opt => {
                        let optionText = opt.text;
                        const isCorrectAnswer = opt.label === question.correctAnswer;

                        // Blank the answerKeyword ONLY in the correct answer (Part 1-2)
                        if (question.part <= 2 && question.answerKeyword && isCorrectAnswer) {
                            const inputId = `answer-keyword-${this.currentQuestionIndex}-${opt.label}`;
                            optionText = this.processKeywordBlank(opt.text, question.answerKeyword, inputId);
                        }

                        return `
                            <div class="toeic-option-row ${isCorrectAnswer ? 'correct-answer' : ''}">
                                <span class="toeic-option-label">(${opt.label})</span>
                                <span class="toeic-option-text">${optionText}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            // Add check button
            if (question.questionKeyword || question.answerKeyword || question.audioKeyword) {
                html += `
                    <div class="fill-blank-actions" style="margin-top: 15px; text-align: center;">
                        <button id="check-keywords-btn" class="toeic-action-btn primary" style="padding: 10px 25px;">
                            <i class="fas fa-check"></i> Kiểm tra từ điền
                        </button>
                    </div>
                `;
            }
        } else {
            // NORMAL MODE: Options có thể click chọn
            // Part 1-2: Chỉ hiển thị label (A, B, C, D) - giống thi thật TOEIC
            // Part 3-7: Hiển thị đầy đủ label + text
            const showOptionText = question.part >= 3;
            const useListeningLayout = question.part <= 2;

            html += `
                <div class="toeic-options ${useListeningLayout ? 'toeic-options-listening' : ''}">
                    ${question.options.map(opt => {
                        return `
                            <div class="toeic-option ${useListeningLayout ? 'toeic-option-label-only' : ''} ${this.answers[this.currentQuestionIndex] === opt.label ? 'selected' : ''}"
                                 data-answer="${opt.label}">
                                <span class="toeic-option-label">${opt.label}</span>
                                ${showOptionText ? `<span class="toeic-option-text">${opt.text}</span>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        // Đóng right-panel và two-col-layout nếu là listening
        if (isTwoCols) html += `</div></div>`;

        container.innerHTML = html;

        // Add option click listeners (ONLY in normal mode, NOT fill-blank mode)
        if (!this.fillInBlankMode) {
            container.querySelectorAll('.toeic-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    const answer = opt.dataset.answer;
                    this.selectAnswer(answer);
                });
            });
        }

        // Add audio player listener for listening parts
        if (question.part <= 4 && (question.audioText || question.audioUrl)) {
            const playBtn = document.getElementById('play-audio-btn');
            if (playBtn) {
                playBtn.addEventListener('click', () => {
                    // If audioUrl exists, play real audio file
                    // Otherwise, use Text-to-Speech with audioText
                    console.log('🎵 Play button clicked. audioUrl:', question.audioUrl, 'audioText:', question.audioText);
                    if (question.audioUrl) {
                        console.log('▶️ Playing real audio file:', question.audioUrl);
                        this.playRealAudio(question.audioUrl);
                    } else {
                        console.log('🔊 Using Text-to-Speech:', question.audioText);
                        this.playAudio(question.audioText);
                    }
                });
            }
        }

        // Add fill-in-blank check button listener
        if (this.fillInBlankMode) {
            const checkBtn = document.getElementById('check-keywords-btn');
            if (checkBtn) {
                checkBtn.addEventListener('click', () => {
                    const result = this.checkKeywordAnswers();
                    Notification.show({
                        type: result.correct === result.total ? 'success' : 'warning',
                        message: `Đúng ${result.correct}/${result.total} từ điền`
                    });
                });
            }

            // Save keyword answers when input changes
            container.querySelectorAll('.keyword-blank-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    this.keywordAnswers[e.target.id] = e.target.value;
                });
                // Check keywords when pressing Enter
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const result = this.checkKeywordAnswers();
                        Notification.show({
                            type: result.correct === result.total ? 'success' : 'warning',
                            message: `Đúng ${result.correct}/${result.total} từ điền`
                        });
                    }
                });
                // Prevent click from propagating to option selection
                input.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            });
        }
    },

    /**
     * Render listening question (Part 1-4)
     * Part 1-2: Chỉ hiển thị audio player, ẩn question text (giống thi thật)
     * Part 3-4: Hiển thị question text, ẩn audio text (chỉ phát audio)
     */
    renderListeningQuestion(question) {
        let html = '';

        // Part 1: Hiển thị hình ảnh (nếu có)
        if (question.part === 1 && question.imageUrl) {
            html += `<img src="${question.imageUrl}" class="toeic-question-image" alt="Question image">`;
        }

        // Audio player cho tất cả listening parts
        if (question.audioText || question.audioUrl) {
            html += `
                <div class="toeic-audio-player">
                    <button class="toeic-action-btn primary" id="play-audio-btn">
                        <i class="fas fa-play"></i> Phát audio
                    </button>
                    <p style="margin-top: 1rem; color: var(--text-secondary);">
                        <i class="fas fa-info-circle"></i> ${question.part <= 2 ? 'Bấm để nghe câu hỏi và đáp án' : 'Bấm để nghe đoạn hội thoại'}
                    </p>
                </div>
            `;
        }

        // FILL-IN-BLANK MODE: Part 2 - Hiển thị question text với đục lỗ
        if (this.fillInBlankMode && question.part === 2) {
            // Dùng questionText nếu có, không thì dùng audioText làm câu hỏi
            const questionSource = question.questionText || question.audioText || '';

            if (questionSource) {
                let questionTextDisplay = questionSource;

                // Blank questionKeyword trong question text
                if (question.questionKeyword) {
                    const inputId = `question-keyword-${this.currentQuestionIndex}`;
                    questionTextDisplay = this.processKeywordBlank(questionTextDisplay, question.questionKeyword, inputId);
                }

                html += `
                    <div class="toeic-fill-blank-text" style="padding: 1rem; background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%); border-radius: 12px; margin-top: 1rem; border-left: 4px solid #43a047;">
                        <p style="font-size: 13px; color: #43a047; margin-bottom: 10px; font-weight: 600;">
                            <i class="fas fa-question-circle"></i> Câu hỏi${question.questionKeyword ? ' - Điền từ còn thiếu:' : ':'}
                        </p>
                        <p style="font-size: 1.05rem; line-height: 1.8; color: var(--text-primary);">${questionTextDisplay}</p>
                    </div>
                `;
            }
        }

        // FILL-IN-BLANK MODE: Part 3-4 - Hiển thị audio text với đục lỗ (dùng audioKeyword)
        if (this.fillInBlankMode && (question.part === 3 || question.part === 4) && question.audioText) {
            let audioTextDisplay = question.audioText;

            // Blank audioKeyword trong audio text
            if (question.audioKeyword) {
                const inputId = `audio-keyword-${this.currentQuestionIndex}`;
                audioTextDisplay = this.processKeywordBlank(audioTextDisplay, question.audioKeyword, inputId);
            }

            html += `
                <div class="toeic-fill-blank-text" style="padding: 1rem; background: linear-gradient(135deg, #f5f0ff 0%, #fff0f5 100%); border-radius: 12px; margin-top: 1rem; border-left: 4px solid var(--primary-color);">
                    <p style="font-size: 13px; color: var(--primary-color); margin-bottom: 10px; font-weight: 600;">
                        <i class="fas fa-pen-square"></i> Transcript - Điền từ còn thiếu:
                    </p>
                    <p style="font-size: 1.05rem; line-height: 1.8; color: var(--text-primary); white-space: pre-wrap;">${audioTextDisplay}</p>
                </div>
            `;
        }

        // Part 3-4: Hiển thị question text (câu hỏi) - không áp dụng đục lỗ cho question text Part 3-4
        if (question.part >= 3 && question.questionText) {
            html += `<div class="toeic-question-text">${question.questionText}</div>`;
        }

        // Part 1-2: Thông báo cho thí sinh (chỉ hiển thị khi KHÔNG ở fill-blank mode)
        if (question.part <= 2 && !this.fillInBlankMode) {
            html += `
                <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: 8px; margin-top: 1rem;">
                    <p style="color: var(--text-secondary); margin: 0; text-align: center;">
                        <i class="fas fa-headphones"></i> Nghe audio và chọn đáp án phù hợp
                    </p>
                </div>
            `;
        }

        return html;
    },

    /**
     * Render reading question
     */
    renderReadingQuestion(question) {
        let html = '';

        // Part 6-7: Hiển thị hình ảnh (nếu có)
        if ((question.part === 6 || question.part === 7) && question.imageUrl) {
            html += `<img src="${question.imageUrl}" class="toeic-question-image" alt="Question image" style="max-width: 100%; margin-bottom: 1rem;">`;
        }

        if (question.passage) {
            html += `<div class="toeic-passage">${question.passage}</div>`;
        }

        if (question.questionText) {
            html += `<div class="toeic-question-text">${question.questionText}</div>`;
        }

        return html;
    },

    /**
     * Select answer
     */
    async selectAnswer(answer) {
        this.answers[this.currentQuestionIndex] = answer;

        // Update UI
        document.querySelectorAll('.toeic-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.answer === answer);
        });

        // Update navigation
        this.renderQuestionNav();

        // Submit to server
        try {
            await ToeicAPI.submitAnswer(this.currentAttempt.attemptId, {
                questionId: this.questions[this.currentQuestionIndex]._id,
                userAnswer: answer,
                timeSpent: Date.now() - this.startTime
            });
        } catch (error) {
            console.error('Error submitting answer:', error);
        }

        // Check if transitioning to a new Part - show popup for Full Test
        const currentQuestion = this.questions[this.currentQuestionIndex];
        const nextIndex = this.currentQuestionIndex + 1;

        // Check if there's a next question and if we're changing Parts
        if (nextIndex < this.questions.length) {
            const nextQuestion = this.questions[nextIndex];
            const isPartTransition = currentQuestion.part !== nextQuestion.part;

            // Show popup only for Full Test when changing Parts
            const isFullTest = this.currentTest?.testType === 'full' ||
                              this.currentTest?.testType === 'full-test';

            if (isPartTransition && isFullTest) {
                // Track which parts we've already shown popup for
                if (!this.shownPartTransitions) {
                    this.shownPartTransitions = new Set();
                }

                const transitionKey = `${currentQuestion.part}-${nextQuestion.part}`;

                // Only show popup once for each Part transition
                if (!this.shownPartTransitions.has(transitionKey)) {
                    this.shownPartTransitions.add(transitionKey);

                    // Show popup after 1 second delay
                    setTimeout(() => {
                        this.showPartTransitionPopup(currentQuestion.part, nextQuestion.part, () => {
                            this.goToQuestion(nextIndex);
                        });
                    }, 1000);
                    return; // Important: prevent normal auto-advance below
                }
            }
        }

        // Auto-advance logic depends on question type
        const isListening = currentQuestion && currentQuestion.part <= 4;
        if (isListening) {
            // For listening: only advance when audio is also done
            this._tryAutoAdvance();
        } else {
            // For reading: advance immediately after answer
            if (this.currentQuestionIndex < this.questions.length - 1) {
                setTimeout(() => this.nextQuestion(), 1000);
            }
        }
    },

    /**
     * Go to specific question
     */
    goToQuestion(index) {
        this.currentQuestionIndex = index;
        this.audioFinished = false;
        this.renderQuestion();
        this.renderQuestionNav();
        document.getElementById('current-question-num').textContent = index + 1;
        this.autoPlayAudio();
    },

    /**
     * Auto-advance only when both audio finished AND answer selected (for listening parts)
     */
    _tryAutoAdvance() {
        const question = this.questions[this.currentQuestionIndex];
        if (!question || question.part > 4) return;
        // Advance as soon as audio is done, regardless of whether answer was selected
        if (this.audioFinished) {
            setTimeout(() => {
                if (this.currentQuestionIndex < this.questions.length - 1) {
                    this.nextQuestion();
                }
            }, 600);
        }
    },

    autoPlayAudio() {
        const question = this.questions[this.currentQuestionIndex];
        if (!question || question.part > 4) return;
        setTimeout(() => {
            if (question.audioUrl) {
                this.playRealAudio(question.audioUrl);
            } else if (question.audioText) {
                this.playAudio(question.audioText);
            }
        }, 300);
    },

    /**
     * Next question
     */
    nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            // Just go to next question
            // Transition popup is handled in selectAnswer() when answering question 100
            this.goToQuestion(this.currentQuestionIndex + 1);
        }
    },

    /**
     * Previous question
     */
    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.goToQuestion(this.currentQuestionIndex - 1);
        }
    },

    /**
     * Setup test listeners
     */
    setupTestListeners() {
        // Mark for review
        const markBtn = document.getElementById('mark-review-btn');
        if (markBtn) {
            markBtn.addEventListener('click', () => {
                if (this.markedQuestions.has(this.currentQuestionIndex)) {
                    this.markedQuestions.delete(this.currentQuestionIndex);
                } else {
                    this.markedQuestions.add(this.currentQuestionIndex);
                }
                this.renderQuestionNav();

                // Update button text
                const icon = this.markedQuestions.has(this.currentQuestionIndex)
                    ? 'fa-bookmark'
                    : 'fa-bookmark-o';
                markBtn.innerHTML = `<i class="fas ${icon}"></i> Đánh dấu`;
            });
        }

        // Back button
        const backBtn = document.getElementById('toeic-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.confirmExit();
            });
        }

        // Pause
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.pauseTest();
            });
        }

        // Submit
        const submitBtn = document.getElementById('submit-test-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this.confirmSubmit();
            });
        }
    },

    /**
     * Start timer
     */
    startTimer() {
        // Use custom time limit if set, otherwise use default from test
        const totalSeconds = this.customTimeLimit !== undefined ? this.customTimeLimit : this.currentTest.totalTime;

        // If unlimited time (null), show count-up timer instead
        if (totalSeconds === null) {
            let elapsed = 0;

            this.timerInterval = setInterval(() => {
                elapsed++;

                // Update display - count up instead of down
                const hours = Math.floor(elapsed / 3600);
                const minutes = Math.floor((elapsed % 3600) / 60);
                const seconds = elapsed % 60;

                let display;
                if (hours > 0) {
                    display = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                } else {
                    display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }

                const timerDisplay = document.getElementById('timer-display');
                if (timerDisplay) {
                    timerDisplay.textContent = display;
                    timerDisplay.parentElement.style.color = 'var(--success-color)'; // Green color for unlimited
                }
            }, 1000);

            return;
        }

        // Normal countdown timer
        let elapsed = 0;

        this.timerInterval = setInterval(() => {
            elapsed++;
            const remaining = totalSeconds - elapsed;

            if (remaining <= 0) {
                this.timeUp();
                return;
            }

            // Update display
            const hours = Math.floor(remaining / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            const seconds = remaining % 60;

            let display;
            if (hours > 0) {
                display = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }

            document.getElementById('timer-display').textContent = display;

            // Warning at 5 minutes
            if (remaining <= 300) {
                document.getElementById('toeic-timer')?.classList.add('warning');
            }
        }, 1000);
    },

    /**
     * Pause test
     */
    async pauseTest() {
        clearInterval(this.timerInterval);

        try {
            await ToeicAPI.pauseAttempt(this.currentAttempt.attemptId);

            Modal.show({
                title: 'Bài thi đã tạm dừng',
                content: '<p>Bạn có muốn tiếp tục làm bài không?</p>',
                buttons: [
                    {
                        text: 'Tiếp tục',
                        className: 'btn-primary',
                        onClick: () => {
                            this.resumeTest();
                        }
                    },
                    {
                        text: 'Thoát',
                        className: 'btn-secondary',
                        onClick: () => {
                            this.exitTest();
                        }
                    }
                ]
            });
        } catch (error) {
            Notification.show({ type: 'error', message: 'Lỗi tạm dừng bài thi' });
        }
    },

    /**
     * Resume test
     */
    async resumeTest() {
        try {
            await ToeicAPI.resumeAttempt(this.currentAttempt.attemptId);
            this.startTimer();
            Modal.close();
        } catch (error) {
            Notification.show({ type: 'error', message: 'Lỗi tiếp tục bài thi' });
        }
    },

    /**
     * Confirm submit
     */
    confirmSubmit() {
        const unanswered = this.questions.length - Object.keys(this.answers).length;

        Modal.show({
            title: 'Nộp bài thi?',
            content: `<p>Bạn còn <strong>${unanswered}</strong> câu chưa trả lời.</p><p>Xác nhận nộp bài?</p>`,
            buttons: [
                {
                    text: 'Nộp bài',
                    className: 'btn-primary',
                    stayOpen: true,
                    onClick: () => {
                        this.submitTest();
                    }
                },
                {
                    text: 'Hủy',
                    className: 'btn-secondary',
                    onClick: () => {
                        // Just close modal
                    }
                }
            ]
        });
    },

    /**
     * Submit test
     */
    async submitTest() {
        clearInterval(this.timerInterval);

        try {
            Modal.show({
                title: 'Đang chấm bài...',
                content: '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin" style="font-size: 48px; color: var(--primary-color);"></i></div>'
            });

            const duration = Math.floor((Date.now() - this.startTime) / 1000);

            const response = await ToeicAPI.submitAttempt(this.currentAttempt.attemptId, duration);

            // Unwrap Http client response
            const apiData = response.data || response;

            if (apiData.success) {
                Modal.close();
                this.showResults(apiData.data);
            } else {
                Modal.close();
                Notification.show({ type: 'error', message: apiData.message || 'Lỗi nộp bài thi' });
            }
        } catch (error) {
            Modal.close();
            Notification.show({ type: 'error', message: 'Lỗi nộp bài thi' });
        }
    },

    /**
     * Time up
     */
    timeUp() {
        clearInterval(this.timerInterval);
        Notification.show({ type: 'warning', message: 'Hết giờ! Tự động nộp bài...' });
        setTimeout(() => this.submitTest(), 2000);
    },

    /**
     * Confirm exit
     */
    confirmExit() {
        Modal.show({
            title: 'Thoát bài thi?',
            content: '<p>Bài làm của bạn sẽ được lưu lại. Bạn có chắc muốn thoát?</p>',
            buttons: [
                {
                    text: 'Thoát',
                    className: 'btn-danger',
                    onClick: () => {
                        this.exitTest();
                    }
                },
                {
                    text: 'Ở lại',
                    className: 'btn-primary',
                    onClick: () => {
                        // Just close modal
                    }
                }
            ]
        });
    },

    /**
     * Exit test
     */
    exitTest() {
        clearInterval(this.timerInterval);
        this.currentAttempt = null;
        this.currentTest = null;
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.answers = {};
        this.markedQuestions.clear();

        // Reset fill-in-blank mode
        this.fillInBlankMode = false;
        this.keywordAnswers = {};

        document.getElementById('toeic-test-interface').style.display = 'none';
        document.getElementById('toeic-selector').style.display = 'block';

        UI.showScreen('toeic-screen');
    },

    /**
     * Show results
     */
    showResults(data) {
        console.log('showResults received data:', data);
        console.log('data.scores:', data.scores);
        console.log('data.stats:', data.stats);
        console.log('data.questions:', data.questions);

        if (!data || !data.scores || !data.stats) {
            console.error('Invalid data structure:', { data, hasScores: !!data?.scores, hasStats: !!data?.stats });
            Notification.show({ type: 'error', message: 'Dữ liệu kết quả không hợp lệ' });
            return;
        }

        // Show results in a modal popup
        this.showResultsModal(data);
    },

    showResultsModal(data) {
        // Render detailed questions review
        const questionsHTML = data.questions ? data.questions.map((q, index) => {
            const isCorrect = q.userAnswer === q.correctAnswer;
            const statusClass = isCorrect ? 'correct' : 'wrong';
            const statusIcon = isCorrect ? 'fa-check-circle' : 'fa-times-circle';

            return `
                <div class="review-question-item ${statusClass}" data-question-index="${index}">
                    <div class="review-question-header" data-toggle-index="${index}">
                        <div class="review-question-number">
                            <i class="fas ${statusIcon}"></i>
                            <span>Câu ${index + 1}</span>
                        </div>
                        <div class="review-answers">
                            <span class="answer-label">Đáp án đúng:</span>
                            <span class="answer-value correct-answer">${q.correctAnswer || '-'}</span>
                            <span class="answer-separator">|</span>
                            <span class="answer-label">Của bạn:</span>
                            <span class="answer-value user-answer ${isCorrect ? 'correct' : 'wrong'}">${q.userAnswer || '(Bỏ qua)'}</span>
                        </div>
                        <i class="fas fa-chevron-down toggle-icon"></i>
                    </div>
                    <div class="review-question-detail" id="review-detail-${index}" style="display: none;">
                        ${q.imageUrl ? `<img src="${q.imageUrl}" alt="Question image" style="max-width: 300px; margin: 10px 0;">` : ''}
                        ${q.questionText ? `<p class="question-text"><strong>Câu hỏi:</strong> ${q.questionText}</p>` : ''}
                        ${q.passage ? `<div class="question-passage"><strong>Đoạn văn:</strong><br>${q.passage.replace(/\n/g, '<br>')}</div>` : ''}
                        <div class="question-options">
                            ${q.options ? q.options.map(opt => {
                                let optClass = '';
                                if (opt.label === q.correctAnswer) optClass = 'option-correct';
                                if (opt.label === q.userAnswer && !isCorrect) optClass = 'option-wrong';
                                return `<div class="option-item ${optClass}">
                                    <span class="option-label">${opt.label}.</span>
                                    <span class="option-text">${opt.text}</span>
                                </div>`;
                            }).join('') : ''}
                        </div>
                        ${q.explanation ? `<div class="question-explanation"><strong>Giải thích:</strong> ${q.explanation}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('') : '<p>Không có dữ liệu câu hỏi</p>';

        const modalContent = `
            <div style="width: 100%; max-height: 70vh; overflow-y: auto; overflow-x: hidden;">
                <div class="toeic-results-header">
                    <h2><i class="fas fa-check-circle"></i> Kết quả bài thi</h2>
                </div>

                <div class="toeic-score-card">
                    <div class="main-score">
                        <div class="score-label">Tổng điểm TOEIC</div>
                        <div class="score-value">${data.scores.total || 0}</div>
                        <div class="score-max">/ 990</div>
                    </div>

                    <div class="sub-scores">
                        <div class="sub-score">
                            <div class="sub-score-label">Listening</div>
                            <div class="sub-score-value">${data.scores.listening || 0}</div>
                            <div class="sub-score-max">/ 495</div>
                        </div>
                        <div class="sub-score">
                            <div class="sub-score-label">Reading</div>
                            <div class="sub-score-value">${data.scores.reading || 0}</div>
                            <div class="sub-score-max">/ 495</div>
                        </div>
                    </div>
                </div>

                <div class="toeic-stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-check"></i></div>
                        <div class="stat-value">${data.stats.correctAnswers || 0}</div>
                        <div class="stat-label">Đúng</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-times"></i></div>
                        <div class="stat-value">${data.stats.wrongAnswers || 0}</div>
                        <div class="stat-label">Sai</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-percentage"></i></div>
                        <div class="stat-value">${Math.round(data.scores.accuracy || 0)}%</div>
                        <div class="stat-label">Độ chính xác</div>
                    </div>
                </div>

                <div class="review-questions-section">
                    <h3><i class="fas fa-list"></i> Chi tiết các câu hỏi</h3>
                    <div class="review-questions-list">
                        ${questionsHTML}
                    </div>
                </div>
            </div>
        `;

        // Add custom CSS for wide modal
        const styleId = 'toeic-results-modal-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .toeic-results-modal.modal {
                    max-width: 1200px !important;
                    width: 95vw !important;
                }
                .toeic-results-modal .modal-body {
                    max-height: 75vh !important;
                    overflow-y: auto !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Show modal with custom configuration
        let exited = false;
        const doExit = () => { if (!exited) { exited = true; this.exitTest(); } };

        Modal.show({
            title: 'Kết quả chi tiết',
            content: modalContent,
            className: 'toeic-results-modal',
            onClose: doExit,
            buttons: [
                {
                    text: 'Về trang chủ TOEIC',
                    className: 'btn-primary',
                    onClick: () => { Modal.close(); doExit(); }
                }
            ]
        });

        // Add custom class to modal and event listeners after modal is shown
        setTimeout(() => {
            // Add custom class and inline styles to modal for styling
            const modalElement = document.querySelector('.modal');
            if (modalElement) {
                modalElement.classList.add('toeic-results-modal');
                // Apply inline styles directly to ensure they work
                modalElement.style.maxWidth = '1200px';
                modalElement.style.width = '95vw';
            }

            // Add event listeners for question toggle headers
            const headers = document.querySelectorAll('.review-question-header');
            console.log('Found headers:', headers.length);
            headers.forEach(header => {
                header.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Prevent event bubbling
                    const index = parseInt(header.getAttribute('data-toggle-index'));
                    console.log('Toggling question:', index);
                    this.toggleQuestionDetail(index);
                });
            });
        }, 100);
    },

    /**
     * Toggle question detail in review
     */
    toggleQuestionDetail(index) {
        const detail = document.getElementById(`review-detail-${index}`);

        if (!detail) {
            console.error('Detail element not found for index:', index);
            return;
        }

        const header = detail.previousElementSibling;
        const icon = header ? header.querySelector('.toggle-icon') : null;

        if (!icon) {
            console.error('Icon not found for index:', index);
            return;
        }

        const isCurrentlyOpen = detail.style.display === 'block';

        // Close all other details first
        const allDetails = document.querySelectorAll('.review-question-detail');
        const allIcons = document.querySelectorAll('.toggle-icon');

        allDetails.forEach(d => {
            d.style.display = 'none';
        });

        allIcons.forEach(i => {
            i.classList.remove('fa-chevron-up');
            i.classList.add('fa-chevron-down');
        });

        // If it was closed, open it. If it was open, leave it closed (accordion behavior)
        if (!isCurrentlyOpen) {
            detail.style.display = 'block';
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }
    },

    /**
     * Show popup when transitioning between Parts
     */
    showPartTransitionPopup(fromPart, toPart, onContinue) {
        const partNames = {
            1: 'Part 1: Photographs',
            2: 'Part 2: Question-Response',
            3: 'Part 3: Conversations',
            4: 'Part 4: Talks',
            5: 'Part 5: Incomplete Sentences',
            6: 'Part 6: Text Completion',
            7: 'Part 7: Reading Comprehension'
        };

        // Special message for Listening → Reading transition
        const isListeningToReading = fromPart === 4 && toPart === 5;
        const title = isListeningToReading
            ? 'Hoàn thành phần Listening!'
            : `Hoàn thành ${partNames[fromPart]}!`;

        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;

        popup.innerHTML = `
            <div style="
                background: var(--bg-primary);
                border-radius: var(--border-radius-large);
                padding: var(--spacing-xxl);
                max-width: 500px;
                text-align: center;
                box-shadow: var(--shadow-xl);
                animation: slideUp 0.3s ease;
            ">
                <div style="
                    width: 80px;
                    height: 80px;
                    margin: 0 auto var(--spacing-lg);
                    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <i class="fas fa-check" style="font-size: 40px; color: white;"></i>
                </div>

                <h2 style="
                    font-size: 1.8rem;
                    margin-bottom: var(--spacing-md);
                    color: var(--text-primary);
                ">
                    ${title}
                </h2>

                ${isListeningToReading ? `
                    <p style="
                        font-size: 1.1rem;
                        color: var(--text-secondary);
                        margin-bottom: var(--spacing-xl);
                        line-height: 1.6;
                    ">
                        Chuẩn bị chuyển sang phần <strong style="color: var(--success-color);">Reading</strong>
                    </p>
                ` : `
                    <p style="
                        font-size: 1.1rem;
                        color: var(--text-secondary);
                        margin-bottom: var(--spacing-xl);
                        line-height: 1.6;
                    ">
                        Chuyển sang <strong style="color: var(--primary-color);">${partNames[toPart]}</strong>
                    </p>
                `}

                <div style="
                    padding: var(--spacing-lg);
                    background: var(--bg-secondary);
                    border-radius: var(--border-radius-medium);
                    margin-bottom: var(--spacing-xl);
                ">
                    <p style="
                        font-size: 0.95rem;
                        color: var(--text-secondary);
                        margin: 0;
                        line-height: 1.5;
                    ">
                        <i class="fas fa-info-circle" style="color: var(--info-color);"></i>
                        ${isListeningToReading ? 'Bạn có thể tạm dừng để nghỉ ngơi hoặc tiếp tục làm bài' : 'Sẵn sàng tiếp tục?'}
                    </p>
                </div>

                <div style="display: flex; gap: var(--spacing-md); justify-content: center;">
                    ${isListeningToReading ? `
                        <button id="pause-for-break" class="toeic-action-btn" style="
                            padding: var(--spacing-md) var(--spacing-xl);
                            font-size: 1rem;
                        ">
                            <i class="fas fa-pause"></i> Tạm dừng nghỉ
                        </button>
                    ` : ''}
                    <button id="continue-next-part" class="toeic-action-btn primary" style="
                        padding: var(--spacing-md) var(--spacing-xl);
                        font-size: 1rem;
                    ">
                        <i class="fas fa-arrow-right"></i> Tiếp tục
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Continue button
        const continueBtn = popup.querySelector('#continue-next-part');
        continueBtn.addEventListener('click', () => {
            popup.remove();
            if (onContinue) onContinue();
        });

        // Pause button (only for Listening → Reading)
        if (isListeningToReading) {
            const pauseBtn = popup.querySelector('#pause-for-break');
            if (pauseBtn) {
                pauseBtn.addEventListener('click', () => {
                    popup.remove();
                    this.pauseTest();
                });
            }
        }

        // Add CSS animations if not already added
        if (!document.querySelector('#toeic-transition-animations')) {
            const style = document.createElement('style');
            style.id = 'toeic-transition-animations';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from {
                        transform: translateY(30px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    },

    /**
     * Show popup when transitioning from Listening to Reading section
     */
    showSectionTransitionPopup(onContinue) {
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;

        popup.innerHTML = `
            <div style="
                background: var(--bg-primary);
                border-radius: var(--border-radius-large);
                padding: var(--spacing-xxl);
                max-width: 500px;
                text-align: center;
                box-shadow: var(--shadow-xl);
                animation: slideUp 0.3s ease;
            ">
                <div style="
                    width: 80px;
                    height: 80px;
                    margin: 0 auto var(--spacing-lg);
                    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <i class="fas fa-check" style="font-size: 40px; color: white;"></i>
                </div>

                <h2 style="
                    font-size: 1.8rem;
                    margin-bottom: var(--spacing-md);
                    color: var(--text-primary);
                ">
                    Hoàn thành phần Listening!
                </h2>

                <p style="
                    font-size: 1.1rem;
                    color: var(--text-secondary);
                    margin-bottom: var(--spacing-sm);
                    line-height: 1.6;
                ">
                    Bạn đã hoàn thành <strong style="color: var(--primary-color);">100 câu Listening</strong>
                </p>

                <p style="
                    font-size: 1.1rem;
                    color: var(--text-secondary);
                    margin-bottom: var(--spacing-xl);
                    line-height: 1.6;
                ">
                    Chuẩn bị chuyển sang phần <strong style="color: var(--success-color);">Reading</strong> (100 câu)
                </p>

                <div style="
                    padding: var(--spacing-lg);
                    background: var(--bg-secondary);
                    border-radius: var(--border-radius-medium);
                    margin-bottom: var(--spacing-xl);
                ">
                    <p style="
                        font-size: 0.95rem;
                        color: var(--text-secondary);
                        margin: 0;
                        line-height: 1.5;
                    ">
                        <i class="fas fa-info-circle" style="color: var(--info-color);"></i>
                        Bạn có thể tạm dừng để nghỉ ngơi hoặc tiếp tục làm bài
                    </p>
                </div>

                <div style="display: flex; gap: var(--spacing-md); justify-content: center;">
                    <button id="pause-for-break" class="toeic-action-btn" style="
                        padding: var(--spacing-md) var(--spacing-xl);
                        font-size: 1rem;
                    ">
                        <i class="fas fa-pause"></i> Tạm dừng nghỉ
                    </button>
                    <button id="continue-to-reading" class="toeic-action-btn primary" style="
                        padding: var(--spacing-md) var(--spacing-xl);
                        font-size: 1rem;
                    ">
                        <i class="fas fa-arrow-right"></i> Tiếp tục Reading
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Continue button
        const continueBtn = popup.querySelector('#continue-to-reading');
        continueBtn.addEventListener('click', () => {
            popup.remove();
            if (onContinue) onContinue();
        });

        // Pause button
        const pauseBtn = popup.querySelector('#pause-for-break');
        pauseBtn.addEventListener('click', () => {
            popup.remove();
            this.pauseTest();
        });

        // Add CSS animations if not already added
        if (!document.querySelector('#toeic-transition-animations')) {
            const style = document.createElement('style');
            style.id = 'toeic-transition-animations';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from {
                        transform: translateY(30px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    },

    /**
     * View results detail
     */
    async viewResults(attemptId) {
        try {
            Modal.show({
                title: 'Đang tải...',
                content: '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin" style="font-size: 48px; color: var(--primary-color);"></i></div>'
            });

            const response = await ToeicAPI.getAttemptReview(attemptId);

            // Unwrap Http client response
            const apiData = response.data || response;

            console.log('Review data:', apiData); // Debug log

            if (apiData.success && apiData.data) {
                // Close loading modal and wait a bit before showing results
                Modal.close();
                setTimeout(() => {
                    this.showResults(apiData.data);
                }, 200);
            } else {
                Modal.close();
                Notification.show({ type: 'error', message: 'Dữ liệu kết quả không hợp lệ' });
            }
        } catch (error) {
            console.error('Error loading review:', error);
            Modal.close();
            Notification.show({ type: 'error', message: 'Lỗi tải kết quả: ' + (error.message || 'Unknown error') });
        }
    },

    /**
     * View review
     */
    viewReview(attemptId) {
        // TODO: Implement detailed review screen
        Notification.show({ type: 'info', message: 'Chức năng xem chi tiết đang được phát triển' });
    },

    /**
     * Back to selector
     */
    backToSelector() {
        document.getElementById('toeic-results').style.display = 'none';
        document.getElementById('toeic-selector').style.display = 'block';
        this.loadTests();
    },

    /**
     * Play audio using Web Speech API - Enhanced for realistic TOEIC experience
     */
    playAudio(text) {
        // Stop any currently playing audio
        if (this.currentSpeech) {
            window.speechSynthesis.cancel();
        }

        // Check if Web Speech API is supported
        if (!('speechSynthesis' in window)) {
            Notification.show({
                type: 'error',
                message: 'Trình duyệt không hỗ trợ phát âm thanh'
            });
            return;
        }

        const currentQuestion = this.questions[this.currentQuestionIndex];
        const part = currentQuestion?.part || 1;

        // Get available voices
        const voices = window.speechSynthesis.getVoices();

        // Separate male and female English voices
        const maleVoices = voices.filter(voice =>
            voice.lang.startsWith('en-') &&
            (voice.name.includes('Male') || voice.name.includes('David') ||
             voice.name.includes('James') || voice.name.includes('Mark'))
        );

        const femaleVoices = voices.filter(voice =>
            voice.lang.startsWith('en-') &&
            (voice.name.includes('Female') || voice.name.includes('Samantha') ||
             voice.name.includes('Susan') || voice.name.includes('Karen') ||
             voice.name.includes('Zira'))
        );

        // Fallback to any English voice if specific gender not found
        const allEnglishVoices = voices.filter(voice => voice.lang.startsWith('en-'));

        // Add Part-specific instructions (like real TOEIC)
        let fullText = text;
        let shouldAddInstruction = false;

        // Only add instruction for first question of each part
        if (this.currentQuestionIndex === 0 ||
            (this.currentQuestionIndex > 0 &&
             this.questions[this.currentQuestionIndex - 1].part !== part)) {
            shouldAddInstruction = true;
        }

        if (shouldAddInstruction) {
            const instructions = {
                1: 'Part 1: Photographs. Directions: For each question, you will see a photograph. You will hear four statements about the photograph. Select the statement that best describes what you see in the photograph. The statements are not printed and will only be spoken one time. ',
                2: 'Part 2: Question-Response. Directions: You will hear a question or statement followed by three responses. Select the best response. The questions and responses are not printed and will only be spoken one time. ',
                3: 'Part 3: Conversations. Directions: You will hear conversations between two or more people. You will be asked to answer questions about what the speakers say. Select the best response to each question. ',
                4: 'Part 4: Talks. Directions: You will hear short talks given by a single speaker. You will be asked to answer questions about what the speaker says. Select the best response to each question. '
            };

            if (instructions[part]) {
                fullText = instructions[part] + ' Now listen to the audio. ' + text;
            }
        }

        // Create speech utterance
        const utterance = new SpeechSynthesisUtterance(fullText);

        // Configure voice settings based on Part for realistic TOEIC
        utterance.lang = 'en-US';

        // Vary speech rate by part (like real TOEIC), scaled by user setting
        const userRate = localStorage.getItem('toeic_speech_rate')
            ? parseInt(localStorage.getItem('toeic_speech_rate')) / 100
            : 1.0;
        const partBaseRate = { 1: 0.85, 2: 0.9, 3: 0.95, 4: 0.9 };
        utterance.rate = Math.min(2.0, (partBaseRate[part] || 0.9) * userRate);

        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Randomly select voice for variety (like real TOEIC with multiple speakers)
        let selectedVoice = null;

        // Random between male and female (TOEIC has both)
        const useFemalVoice = Math.random() > 0.5;

        if (useFemalVoice && femaleVoices.length > 0) {
            selectedVoice = femaleVoices[Math.floor(Math.random() * femaleVoices.length)];
        } else if (!useFemalVoice && maleVoices.length > 0) {
            selectedVoice = maleVoices[Math.floor(Math.random() * maleVoices.length)];
        } else if (allEnglishVoices.length > 0) {
            // Fallback to any English voice
            selectedVoice = allEnglishVoices[Math.floor(Math.random() * allEnglishVoices.length)];
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
            console.log(`🎤 Using voice: ${selectedVoice.name} (${selectedVoice.lang})`);
        }

        // Event handlers
        utterance.onstart = () => {
            const btn = document.getElementById('play-audio-btn');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-volume-up"></i> Đang phát...';
                btn.disabled = true;
                btn.style.opacity = '0.7';
            }
        };

        utterance.onend = () => {
            const btn = document.getElementById('play-audio-btn');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-play"></i> Phát audio';
                btn.disabled = false;
                btn.style.opacity = '1';
            }
            this.currentSpeech = null;
            this.audioFinished = true;
            this._tryAutoAdvance();
        };

        utterance.onerror = (event) => {
            console.error('Speech error:', event);
            const btn = document.getElementById('play-audio-btn');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-play"></i> Phát audio';
                btn.disabled = false;
                btn.style.opacity = '1';
            }
            this.currentSpeech = null;

            Notification.show({
                type: 'error',
                message: 'Không thể phát âm thanh. Vui lòng thử lại.'
            });
        };

        // Store reference and speak
        this.currentSpeech = utterance;
        window.speechSynthesis.speak(utterance);
    },

    /**
     * Play real audio file (uploaded MP3/WAV/etc.)
     */
    playRealAudio(audioUrl) {
        console.log('🎵 playRealAudio() called with audioUrl:', audioUrl);
        console.log('   - Type:', typeof audioUrl);
        console.log('   - Full URL will be:', new URL(audioUrl, window.location.origin).href);

        // Stop any Text-to-Speech audio
        if (this.currentSpeech) {
            window.speechSynthesis.cancel();
            this.currentSpeech = null;
        }

        // Stop any currently playing real audio
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
        }

        const btn = document.getElementById('play-audio-btn');

        try {
            // Create Audio element
            const audio = new Audio();
            audio.preload = 'auto'; // Preload the entire audio file
            audio.src = audioUrl;
            console.log('✅ Audio element created successfully');

            // Debug events
            audio.onloadstart = () => console.log('🔄 Loading audio...');
            audio.onloadedmetadata = () => console.log('📊 Metadata loaded, duration:', audio.duration);
            audio.onloadeddata = () => console.log('✅ Audio data loaded');
            audio.oncanplay = () => console.log('▶️ Can start playing');
            audio.oncanplaythrough = () => console.log('✅ Can play through without buffering');

            // Update button on play start
            audio.onplay = () => {
                console.log('▶️ Audio started playing');
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-volume-up"></i> Đang phát...';
                    btn.disabled = true;
                    btn.style.opacity = '0.7';
                }
            };

            // Track playback
            audio.onpause = () => console.log('⏸️ Audio paused at:', audio.currentTime);
            audio.onstalled = () => console.warn('⚠️ Audio stalled at:', audio.currentTime);
            audio.onsuspend = () => console.warn('⚠️ Audio suspended at:', audio.currentTime);
            audio.onwaiting = () => console.warn('⏳ Audio waiting/buffering at:', audio.currentTime);

            // Update button on audio end
            audio.onended = () => {
                console.log('✅ Audio ended normally');
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-play"></i> Phát audio';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
                this.currentAudio = null;
                this.audioFinished = true;
                this._tryAutoAdvance();
            };

            // Handle errors
            audio.onerror = (e) => {
                console.error('❌ Audio playback error:', e);
                console.error('   - Error code:', audio.error?.code);
                console.error('   - Error message:', audio.error?.message);
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-play"></i> Phát audio';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
                this.currentAudio = null;

                Notification.show({
                    type: 'error',
                    message: 'Không thể phát file audio. Vui lòng kiểm tra file.'
                });
            };

            // Store reference and play
            this.currentAudio = audio;

            // Load and play
            audio.load();
            audio.play().catch(err => {
                console.error('❌ Play failed:', err);
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-play"></i> Phát audio';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            });

        } catch (error) {
            console.error('Error playing audio:', error);
            if (btn) {
                btn.innerHTML = '<i class="fas fa-play"></i> Phát audio';
                btn.disabled = false;
                btn.style.opacity = '1';
            }

            Notification.show({
                type: 'error',
                message: 'Không thể phát audio. Vui lòng thử lại.'
            });
        }
    }
};
