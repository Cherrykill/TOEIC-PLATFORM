// ===================================
// UI INIT MODULE
// initMainTabs + TOEIC/practice history DOMContentLoaded event listeners
// ===================================

function initMainTabs() {
    const TAB_TITLES = {
        overview:          'Dashboard',
        topics:            'Quản lý Đề',
        vocabulary:        'TOEIC Vocabulary',
        users:             'User Management',
        'toeic-questions': 'TOEIC Questions',
        'toeic-tests':     'TOEIC Tests',
        'practice-history':'Practice History',
        reports:           'Báo cáo người dùng',
        monitor:           'System Monitor',
        achievements:      'Quản lý Thành tích',
        quests:            'Quản lý Nhiệm vụ',
        shop:              'Quản lý Cửa hàng',
        'user-stats':        'Thống kê người dùng',
        'user-achievements': 'Thành tích người dùng',
        broadcast:           'Gửi thông báo hệ thống',
        'toeic-history':     'Lịch sử luyện thi TOEIC',
    };

    const sidebarLinks = document.querySelectorAll('.sidebar-link[data-main-tab]');

    function activateTab(tab) {
        sidebarLinks.forEach(l => l.classList.remove('active'));
        const activeLink = document.querySelector(`.sidebar-link[data-main-tab="${tab}"]`);
        if (activeLink) activeLink.classList.add('active');

        document.querySelectorAll('.main-tab-content').forEach(t => t.classList.remove('active'));
        const panel = document.getElementById(`main-tab-${tab}`);
        if (panel) panel.classList.add('active');

        const titleEl = document.getElementById('topbar-title');
        if (titleEl) titleEl.textContent = TAB_TITLES[tab] || tab;

        if (tab === 'topics') {
            loadTopicsTab();
        } else if (tab === 'vocabulary') {
            loadAvailableFiles();
        } else if (tab === 'users') {
            loadUsersInTab();
        } else if (tab === 'toeic-questions') {
            loadToeicStats();
            loadQuestions();
        } else if (tab === 'toeic-tests') {
            loadToeicStats();
            loadTests();
        } else if (tab === 'practice-history') {
            loadPracticeHistory12();
        } else if (tab === 'toeic-history') {
            loadUsersListForHistory();
            loadPracticeHistory();
        } else if (tab === 'reports') {
            loadReports();
            loadReportStats();
        } else if (tab === 'achievements') {
            loadAchievements();
        } else if (tab === 'quests') {
            loadQuests();
        } else if (tab === 'shop') {
            loadShopItems();
        } else if (tab === 'monitor') {
            startMetricsPolling();
            initApiReference();
        } else if (tab === 'upload-management') {
            initUploadManagement();
        } else if (tab === 'token-management') {
            loadTokenStats();
        } else if (tab === 'user-stats') {
            loadUserStats();
        } else if (tab === 'user-achievements') {
            initUserAchievementsTab();
        } else if (tab === 'broadcast') {
            loadNotifHistory();
        } else {
            stopMetricsPolling();
        }

        if (tab !== 'monitor') stopMetricsPolling();

        if (window.innerWidth <= 900) {
            collapseSidebar();
        }
    }

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            activateTab(link.dataset.mainTab);
        });
    });

    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar   = document.getElementById('admin-sidebar');
    const overlay   = document.getElementById('sidebar-overlay');

    function collapseSidebar() {
        sidebar.classList.add('collapsed');
        if (overlay) overlay.classList.remove('visible');
    }
    function expandSidebar() {
        sidebar.classList.remove('collapsed');
        if (overlay && window.innerWidth <= 900) overlay.classList.add('visible');
    }

    // Expose collapseSidebar so activateTab can call it
    window.collapseSidebar = collapseSidebar;

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            if (sidebar.classList.contains('collapsed')) {
                expandSidebar();
            } else {
                collapseSidebar();
            }
        });
    }

    if (overlay) {
        overlay.addEventListener('click', collapseSidebar);
    }

    if (window.innerWidth > 900) {
        expandSidebar();
    }
}

// DOMContentLoaded: TOEIC events + practice history events
// (user/vocab/quick-delete events are registered in users.js)
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-refresh")?.addEventListener("click", refreshData);

    // --- TOEIC QUESTION EVENTS ---
    document.getElementById('filter-part')?.addEventListener('change', (e) => {
        loadQuestions(e.target.value, 1);
    });

    document.getElementById('btn-ai-generate-questions')?.addEventListener('click', openAIGenerateModal);

    document.getElementById('btn-add-question')?.addEventListener('click', () => {
        openQuestionModal();
    });

    document.getElementById('btn-view-statistics')?.addEventListener('click', openStatisticsModal);
    document.getElementById('btn-delete-all-questions')?.addEventListener('click', deleteAllQuestions);
    document.getElementById('btn-close-statistics-modal')?.addEventListener('click', closeStatisticsModal);
    document.getElementById('btn-refresh-statistics')?.addEventListener('click', loadStatistics);
    document.getElementById('btn-close-question-modal')?.addEventListener('click', closeQuestionModal);

    document.getElementById('question-form')?.addEventListener('submit', handleQuestionSubmit);
    document.getElementById('question-part')?.addEventListener('change', updatePartVisibility);

    document.getElementById('question-image-file')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleImageUpload(file);
    });

    document.getElementById('question-audio-file')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleAudioUpload(file);
    });

    // --- TOEIC TEST EVENTS ---
    document.getElementById('btn-create-test')?.addEventListener('click', () => openTestModal());
    document.getElementById('btn-generate-test')?.addEventListener('click', generateTest);
    document.getElementById('btn-delete-all-tests')?.addEventListener('click', deleteAllTests);
    document.getElementById('btn-close-test-modal')?.addEventListener('click', closeTestModal);
    document.getElementById('test-form')?.addEventListener('submit', handleTestSubmit);

    // --- PRACTICE HISTORY (TOEIC) EVENTS ---
    document.getElementById("btn-refresh-history")?.addEventListener("click", () => {
        const filters = getHistoryFilters();
        loadPracticeHistory(1, filters.userId, filters.search);
    });

    document.getElementById("history-filter-user")?.addEventListener("change", () => {
        const filters = getHistoryFilters();
        loadPracticeHistory(1, filters.userId, filters.search);

        const deleteBtn = document.getElementById('btn-delete-user-history');
        if (deleteBtn) {
            deleteBtn.style.display = filters.userId ? 'inline-block' : 'none';
        }
    });

    document.getElementById("history-search")?.addEventListener("input", () => {
        const filters = getHistoryFilters();
        clearTimeout(window.historySearchTimeout);
        window.historySearchTimeout = setTimeout(() => {
            loadPracticeHistory(1, filters.userId, filters.search);
        }, 500);
    });

    document.getElementById("btn-delete-user-history")?.addEventListener("click", deleteAllUserHistory);
    document.getElementById("btn-delete-all-history")?.addEventListener("click", deleteAllHistory);

    // --- IMAGE PATH GENERATOR ---
    document.getElementById("btn-gen-image-path")?.addEventListener("click", () => {
        const en = document.getElementById("word-en")?.value.trim();
        const part = document.getElementById("word-part")?.value.trim().toUpperCase();
        if (!en || !part) {
            alert("Vui lòng nhập từ tiếng Anh và Part trước.");
            return;
        }
        const safeFileName = en.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        document.getElementById("word-image").value = `images/pages/${part}/${safeFileName}.jpg`;
    });
});
