// dashboard.js - Full Code with Dynamic Part Filtering, Pagination, and User Management
// Updated: 2026-01-07 - Added row highlighting feature

// ===================================
// 0. DARK MODE
// ===================================
function initDarkMode() {
    const savedTheme = localStorage.getItem('admin-theme') || 'light';
    const htmlElement = document.documentElement;
    const themeToggle = document.getElementById('theme-toggle');
    const themeText = document.getElementById('theme-text');
    const themeIcon = themeToggle?.querySelector('i');

    // Apply saved theme
    if (savedTheme === 'dark') {
        htmlElement.setAttribute('data-theme', 'dark');
        if (themeIcon) themeIcon.className = 'fas fa-sun';
        if (themeText) themeText.textContent = 'Light';
    }

    // Toggle theme
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('admin-theme', newTheme);

            if (newTheme === 'dark') {
                if (themeIcon) themeIcon.className = 'fas fa-sun';
                if (themeText) themeText.textContent = 'Light';
            } else {
                if (themeIcon) themeIcon.className = 'fas fa-moon';
                if (themeText) themeText.textContent = 'Dark';
            }
        });
    }
}

// ===================================
// 1. AUTHENTICATION
// ===================================
let currentUser = null;
let authToken = null;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize dark mode
    initDarkMode();

    // Check if we have a token
    const token = getToken();
    if (token) {
        // Validate token with server
        const isValid = await validateToken(token);
        if (isValid) {
            // Token valid, show dashboard
            showDashboard();
            await initDashboard();
        } else {
            // Token invalid, show login
            showLoginModal();
        }
    } else {
        // No token, show login
        showLoginModal();
    }

    // Setup login form handler
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Setup logout button
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    const errorDiv = document.getElementById('login-error');

    try {
        const response = await fetch(`${API_URL}/auth/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success && data.token) {
            // Check if user is admin (role is in data.user.user.role)
            const userRole = data.user?.user?.role || data.user?.role;
            if (userRole !== 'admin') {
                errorDiv.textContent = 'Access denied: Admin role required';
                errorDiv.style.display = 'block';
                return;
            }

            // Save token (using separate key for admin)
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('adminAuthToken', JSON.stringify({ token: data.token }));

            // Update UI
            const username = data.user?.user?.username || data.user?.username || 'Admin';
            setAdminName(username);

            // Hide login, show dashboard
            showDashboard();
            await initDashboard();
        } else {
            errorDiv.textContent = data.message || 'Login failed';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    }
}

async function validateToken(token) {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        // Check role from correct path (data.data.user.role or data.data.role)
        const userRole = data.data?.user?.role || data.data?.role;
        if (data.success && userRole === 'admin') {
            authToken = token;
            currentUser = data.data;
            const username = data.data?.user?.username || data.data?.username || 'Admin';
            setAdminName(username);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Token validation error:', error);
        return false;
    }
}

function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('adminAuthToken');
    showLoginModal();
}

function showLoginModal() {
    document.getElementById('admin-login-modal').style.display = 'flex';
    document.getElementById('main-dashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('admin-login-modal').style.display = 'none';
    document.getElementById('main-dashboard').style.display = 'flex';
}

// ===================================
// 1. GLOBAL CONFIG & STATE
// ===================================
const API_URL = 'http://localhost:5000/api';

// User State (Nếu cần)
let isEditMode = false;

// Vocabulary State
let vocabCurrentPage = 1;
const vocabCurrentLimit = 50;
let vocabCurrentPart = '';
let vocabCurrentSource = '';
let vocabSearchTerm = '';

// ===================================
// 1.5 OFFLINE/FALLBACK MODE
// ===================================
let isOfflineMode = false;
let localVocabularyData = []; // Cache for local JSON data
let currentLocalFile = 'vocabulary.json';
let dashboardInitialized = false; // Guard to prevent multiple initializations

// ===================================
// 1.6 SIMPLE SEARCH SYSTEM
// ===================================
/**
 * Simple unified search - works with local data
 */
function initSimpleSearch() {
    let searchInput = document.getElementById('vocab-search');
    if (!searchInput) {
        console.warn('❌ Search input not found');
        return;
    }

    // Remove ALL existing listeners by replacing element
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);

    // Get the new element from DOM (important!)
    searchInput = document.getElementById('vocab-search');

    // Single simple handler for search
    searchInput.addEventListener('input', debounce((e) => {
        vocabSearchTerm = e.target.value.trim();
        console.log(`🔍 Search: "${vocabSearchTerm}" in ${currentLocalFile} (${localVocabularyData.length} words)`);

        if (localVocabularyData.length > 0) {
            displayLocalVocabulary();
        } else {
            console.warn('⚠️ No local data to search');
        }
    }, 300));

    // Focus/blur styling (CSP-safe - no inline handlers)
    searchInput.addEventListener('focus', function() {
        this.style.borderColor = '#667eea';
        this.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
    });
    searchInput.addEventListener('blur', function() {
        this.style.borderColor = '#e0e0e0';
        this.style.boxShadow = 'none';
    });
    // Prevent form submission on Enter
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') e.preventDefault();
    });

    // Clear filters button (CSP-safe)
    let clearFiltersBtn = document.getElementById('clear-vocab-filters');
    if (clearFiltersBtn) {
        // Remove old listeners by cloning
        const newBtn = clearFiltersBtn.cloneNode(true);
        clearFiltersBtn.parentNode.replaceChild(newBtn, clearFiltersBtn);
        // Get new button from DOM
        clearFiltersBtn = document.getElementById('clear-vocab-filters');
        clearFiltersBtn.addEventListener('click', clearVocabFilters);
    }

    console.log('✅ Simple search initialized');
}

// LOCAL_VOCAB_FILES removed — file list is now dynamically fetched from /api/vocabulary/files

/**
 * Check if API is available
 */
async function checkApiAvailability() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(`${API_URL}/vocabulary/stats`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        return res.ok;
    } catch (error) {
        console.warn('⚠️ API không khả dụng, chuyển sang chế độ offline');
        return false;
    }
}

/**
 * Load vocabulary from local JSON file
 */
async function loadLocalVocabulary(filename) {
    try {
        const cacheBuster = `?_t=${Date.now()}`;
        const res = await fetch(`../data/${filename}${cacheBuster}`);

        if (!res.ok) throw new Error(`Cannot load ${filename}`);

        const data = await res.json();
        localVocabularyData = Array.isArray(data) ? data : [];
        currentLocalFile = filename;

        console.log(`✅ Loaded ${localVocabularyData.length} words from local file: ${filename}`);
        return localVocabularyData;
    } catch (error) {
        console.error(`❌ Error loading local file ${filename}:`, error);
        return [];
    }
}

/**
 * Search and filter local vocabulary
 */
function searchLocalVocabulary(searchTerm = '', part = '') {
    let filtered = [...localVocabularyData];

    // Filter by part
    if (part) {
        filtered = filtered.filter(w => w.part === part);
    }

    // Filter by search term
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(w =>
            (w.en && w.en.toLowerCase().includes(term)) ||
            (w.vn && w.vn.toLowerCase().includes(term)) ||
            (w.zh && w.zh.toLowerCase().includes(term)) ||
            (w.pinyin && w.pinyin.toLowerCase().includes(term))
        );
    }

    return filtered;
}

/**
 * Initialize offline mode UI
 */
function initOfflineMode() {
    // Show offline banner
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        const banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.innerHTML = `
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 12px 20px;
                        border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
                <i class="fas fa-wifi" style="font-size: 20px; opacity: 0.9;"></i>
                <div>
                    <strong>Chế độ Offline</strong> - Server không khả dụng. Đang xem từ file JSON local.
                    <br><small>Một số tính năng (thêm/sửa/xóa) sẽ không hoạt động.</small>
                </div>
            </div>
        `;
        mainContent.insertBefore(banner, mainContent.firstChild);
    }

    // Setup local file selector
    setupLocalFileSelector();
}

/**
 * Setup file selector — always fetches from API, even in offline/degraded mode
 */
async function setupLocalFileSelector() {
    // Delegate to the same dynamic loader
    await loadAvailableFiles();
}

/**
 * Handle file change in offline mode
 */
async function handleOfflineFileChange(e) {
    const filename = e.target.value;
    if (!filename) return;

    console.log(`📂 Switching to offline file: ${filename}`);

    const selector = e.target;
    selector.disabled = true;

    // Reset search and filter when switching files
    vocabSearchTerm = '';
    vocabCurrentPart = '';

    // Clear search input
    const searchInput = document.getElementById('vocab-search');
    if (searchInput) searchInput.value = '';

    // Reset part filter
    const partFilter = document.getElementById('vocab-part-filter');
    if (partFilter) partFilter.value = '';

    try {
        await loadLocalVocabulary(filename);

        // Update selector option text to reflect loaded word count
        const selectedOption = selector.querySelector(`option[value="${filename}"]`);
        if (selectedOption) {
            // Preserve display name already set by loadAvailableFiles, just update count
            const currentText = selectedOption.textContent.replace(/\s*\(\d+ từ\)$/, '').trim();
            selectedOption.textContent = `${currentText}  (${localVocabularyData.length} từ)`;
        }

        displayLocalVocabulary();
        updateLocalStats();
        updateLocalPartFilter();

        console.log(`✅ Switched to ${filename}: ${localVocabularyData.length} words`);
    } catch (error) {
        console.error('Error switching file:', error);
        alert('❌ Không thể load file: ' + filename);
    } finally {
        selector.disabled = false;
    }
}

/**
 * Display vocabulary in offline mode
 */
function displayLocalVocabulary() {
    const tbody = document.querySelector("#vocabulary-table tbody");
    if (!tbody) return;

    console.log(`📋 Offline search: term="${vocabSearchTerm}", part="${vocabCurrentPart}", file="${currentLocalFile}"`);

    const filtered = searchLocalVocabulary(vocabSearchTerm, vocabCurrentPart);

    console.log(`✅ Found ${filtered.length} results from ${localVocabularyData.length} total words`);

    // Update total vocabulary count
    document.getElementById("total-vocabulary").textContent = localVocabularyData.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #999; padding: 40px;">
            Không tìm thấy từ vựng nào với từ khóa "${vocabSearchTerm}".
        </td></tr>`;

        // Update count display
        updateLocalCountDisplay(0, localVocabularyData.length);
        return;
    }

    tbody.innerHTML = filtered.map(word => `
        <tr>
            <td><strong>${word.en || ''}</strong> ${word.phonetic || ''}</td>
            <td>${word.vn || ''}</td>
            <td><span class="badge info">${word.type || '-'}</span></td>
            <td><span class="badge warning">${word.part || '-'}</span></td>
            <td>
                <button class="btn btn-warning btn-sm btn-edit-word" data-word='${JSON.stringify(word).replace(/'/g, "&#39;")}' title="Sửa từ vựng">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-sm btn-delete-word" data-en="${word.en || ''}" title="Xóa từ vựng">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Attach event handlers for edit/delete buttons
    tbody.querySelectorAll('.btn-edit-word').forEach(btn => {
        btn.addEventListener('click', () => {
            const word = JSON.parse(btn.dataset.word);
            openEditWordModal(word);
        });
    });

    tbody.querySelectorAll('.btn-delete-word').forEach(btn => {
        btn.addEventListener('click', () => {
            const en = btn.dataset.en;
            if (confirm(`Bạn có chắc muốn xóa từ "${en}"?`)) {
                deleteWord(en);
            }
        });
    });

    // Update count display
    updateLocalCountDisplay(filtered.length, localVocabularyData.length);
}

/**
 * Update count display for offline mode
 */
function updateLocalCountDisplay(displayCount, total) {
    // Try to find and update any count container
    const hasFilter = vocabCurrentPart || vocabSearchTerm;

    // Update vocabulary pagination info bar specifically
    const paginationContainer = document.getElementById('vocabulary-pagination-controls');
    if (paginationContainer) {
        if (hasFilter) {
            paginationContainer.innerHTML = `<i class="fas fa-info-circle"></i> Hiển thị <strong>${displayCount}</strong> / <strong>${total}</strong> từ vựng`;
        } else {
            paginationContainer.innerHTML = `<i class="fas fa-list"></i> Tổng cộng: <strong>${total}</strong> từ vựng`;
        }
    }
}

/**
 * Update statistics in offline mode
 */
function updateLocalStats() {
    const container = document.getElementById('vocab-stats-container');
    if (!container) return;

    // Calculate stats from local data
    const totalWords = localVocabularyData.length;
    const parts = [...new Set(localVocabularyData.map(w => w.part).filter(Boolean))];
    const types = [...new Set(localVocabularyData.map(w => w.type).filter(Boolean))];

    container.innerHTML = `
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px;">
            <div class="stat-item" style="text-align: center; padding: 15px; background: var(--card-bg); border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: var(--primary);">${totalWords}</div>
                <div style="color: var(--text-secondary); font-size: 12px;">Tổng từ vựng</div>
            </div>
            <div class="stat-item" style="text-align: center; padding: 15px; background: var(--card-bg); border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: var(--success);">${parts.length}</div>
                <div style="color: var(--text-secondary); font-size: 12px;">Số Parts</div>
            </div>
            <div class="stat-item" style="text-align: center; padding: 15px; background: var(--card-bg); border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: var(--warning);">${types.length}</div>
                <div style="color: var(--text-secondary); font-size: 12px;">Loại từ</div>
            </div>
            <div class="stat-item" style="text-align: center; padding: 15px; background: var(--card-bg); border-radius: 8px;">
                <div style="font-size: 14px; font-weight: bold; color: var(--info);">${currentLocalFile}</div>
                <div style="color: var(--text-secondary); font-size: 12px;">File hiện tại</div>
            </div>
        </div>
    `;
}

/**
 * Update part filter dropdown in offline mode
 */
function updateLocalPartFilter(vocabData) {
    const select = document.getElementById('vocab-part-filter');
    const pills  = document.getElementById('part-filter-pills');
    if (!select && !pills) return;

    const source = vocabData || window._lastVocabData || [];
    const parts = [...new Set(source.map(w => w.part).filter(Boolean))].sort();
    const currentVal = vocabCurrentPart || '';

    // Keep hidden select in sync
    if (select) {
        select.innerHTML = '<option value="">-- Tất cả Parts --</option>';
        parts.forEach(part => {
            const opt = document.createElement('option');
            opt.value = part;
            opt.textContent = part;
            select.appendChild(opt);
        });
        select.value = currentVal;
    }

    // Render pill buttons
    if (pills) {
        pills.innerHTML = '';

        const allPill = document.createElement('button');
        allPill.type = 'button';
        allPill.textContent = 'Tất cả';
        allPill.dataset.part = '';
        allPill.className = 'part-pill' + (!currentVal ? ' part-pill--active' : '');
        pills.appendChild(allPill);

        parts.forEach(part => {
            const count = localVocabularyData.filter(w => w.part === part).length;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.part = part;
            btn.className = 'part-pill' + (currentVal === part ? ' part-pill--active' : '');
            btn.innerHTML = `${part} <span style="opacity:.55;font-size:10px;">${count}</span>`;
            pills.appendChild(btn);
        });

        pills.querySelectorAll('.part-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.part;
                document.getElementById('part-filter-label').textContent = val || 'Tất cả Part';
                document.getElementById('part-filter-dropdown').style.display = 'none';
                pills.querySelectorAll('.part-pill').forEach(b => b.classList.remove('part-pill--active'));
                btn.classList.add('part-pill--active');
                loadVocabulary(1, val, vocabCurrentSource);
            });
        });
    }
}

function initPartFilterDropdown() {
    const btn      = document.getElementById('part-filter-btn');
    const dropdown = document.getElementById('part-filter-dropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display !== 'none';
        dropdown.style.display = isOpen ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
        if (!document.getElementById('part-filter-wrapper')?.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// ===================================
// 2. UTILITY FUNCTIONS
// ===================================

const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

/**
 * Truncate string to specified length
 */
function truncate(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
}

/**
 * Chuẩn hóa object từ vựng theo 9 keys bắt buộc
 */
function normalizeVocabularyObject(item) {
    const REQUIRED_KEYS = ['en', 'vn', 'phonetic', 'part', 'synonyms', 'type', 'image'];
    const normalized = {};

    for (const key of REQUIRED_KEYS) {
        if (key in item && item[key] !== undefined && item[key] !== '') {
            normalized[key] = item[key];
        } else {
            // Giá trị mặc định cho các keys thiếu
            normalized[key] = null;
        }
    }

    return normalized;
}

/**
 * [PHẦN QUÉT DỮ LIỆU ĐỘNG]
 * Lấy danh sách duy nhất các Part có trong database/file vocabulary.json.
 * Yêu cầu API backend phải có endpoint /api/vocabulary/parts trả về mảng chuỗi ['N', 'V', 'ADJ', 'E2XA-P1', ...].
 */
async function fetchUniqueVocabParts() {
    try {
        // Gọi API để quét toàn bộ data và chỉ trả về danh sách các Part duy nhất
        const res = await fetch(`${API_URL}/vocabulary/parts`); 
        const data = await res.json();
        
        if (data.success && Array.isArray(data.data)) {
            return data.data.sort((a, b) => a.localeCompare(b)); 
        }
    } catch (error) {
        console.error("Lỗi khi quét danh sách Parts duy nhất từ API:", error);
    }
    // Fallback: Trả về một danh sách Parts tiêu chuẩn nếu API bị lỗi.
    return ['N', 'V', 'ADJ', 'ADV', 'PHR', 'OTHERS', 'E2XA-P1', 'E2XA-P2']; 
}

// Hàm xử lý sự kiện change cho Filter Part
function handleVocabFilterChange(e) {
    const newPart = e.target.value;
    vocabCurrentPart = newPart;

    console.log(`🏷️ Part filter changed: "${newPart}", localData=${localVocabularyData.length}`);

    // Use local filter if we have local data loaded
    if (localVocabularyData && localVocabularyData.length > 0) {
        console.log(`📋 Using LOCAL filter`);
        displayLocalVocabulary();
    } else {
        console.log(`🌐 Using API filter`);
        // Reset về trang 1 và gọi hàm loadVocabulary để thực hiện LỌC
        loadVocabulary(1, newPart);
    }
}


// ===================================
// 3. CORE DASHBOARD FUNCTIONS
// ===================================

async function initDashboard() {
    if (dashboardInitialized) return;
    dashboardInitialized = true;
    await loadDashboard();
    initMainTabs();
    loadRecentUsers();
    loadGrowthChart(30);
    loadReportStats(); // load badge count on startup
    // Poll for new reports every 60s so the badge stays current
    setInterval(loadReportStats, 60_000);

    // Topics tab buttons
    document.getElementById('btn-add-topic')?.addEventListener('click', openAddTopicModal);
    document.getElementById('btn-sync-all-topics')?.addEventListener('click', async () => {
        try {
            const res = await fetch(`${API_URL}/topics/sync-all`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}` },
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            showToast('Đã sync wordCount cho tất cả đề', 'success');
            loadTopicsTab();
        } catch (err) {
            showToast(`Lỗi: ${err.message}`, 'error');
        }
    });

    // "Xem tất cả" in Recent Users → switch to Users tab
    document.getElementById('action-btn-view-users')?.addEventListener('click', () => {
        document.querySelector('.sidebar-link[data-main-tab="users"]')?.click();
    });

    // Growth chart period selector
    document.getElementById('growth-period')?.addEventListener('change', (e) => {
        loadGrowthChart(parseInt(e.target.value) || 30);
    });

    // Reports filter
    document.getElementById('rpt-filter-status')?.addEventListener('change', () => loadReports(1));
    document.getElementById('btn-refresh-reports')?.addEventListener('click', () => {
        loadReports(reportsPage);
        loadReportStats();
    });

    document.getElementById('btn-delete-all-reports')?.addEventListener('click', async () => {
        if (!confirm('Xóa toàn bộ báo cáo? Hành động này không thể hoàn tác.')) return;
        try {
            const res  = await fetch(`${API_URL}/reports/all`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` },
            });
            const data = await res.json();
            if (data.success) {
                loadReports(1);
                loadReportStats();
            } else {
                alert('❌ ' + (data.message || 'Xóa thất bại'));
            }
        } catch (err) {
            alert('❌ Lỗi kết nối: ' + err.message);
        }
    });

    // Quick action links (data-main-tab-link)
    document.querySelectorAll('[data-main-tab-link]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.mainTabLink;
            document.querySelector(`.sidebar-link[data-main-tab="${tab}"]`)?.click();
        });
    });
}

async function loadDashboard() {
    console.log('🚀 Initializing dashboard...');

    try {
        // Check API availability first
        const apiAvailable = await checkApiAvailability();

        if (!apiAvailable) {
            // Switch to offline mode
            console.log('🔌 Switching to offline mode...');
            isOfflineMode = true;
            initOfflineMode();

            // Load local vocabulary
            await loadLocalVocabulary('vocabulary.json');
            displayLocalVocabulary();
            updateLocalStats();
            updateLocalPartFilter();

            // Setup simple search
            initSimpleSearch();

            // Update server info to show offline
            document.getElementById("total-users").textContent = '-';
            document.getElementById("total-vocabulary").textContent = localVocabularyData.length;
            document.getElementById("server-uptime").textContent = 'Offline';
            document.getElementById("total-sessions").textContent = '-';
            document.getElementById("toeic-tests-count").textContent = '-';
            // Mark topbar status dot as offline
            const dotEl = document.getElementById('topbar-server-status');
            if (dotEl) { dotEl.textContent = 'Offline'; dotEl.className = 'status-dot offline'; }
            const mongoEl = document.getElementById('server-mongo-status');
            if (mongoEl) { mongoEl.textContent = '-'; mongoEl.style.color = 'var(--danger)'; }

            return;
        }

        // Online mode - original code
        const healthRes = await fetch("http://localhost:5000/health");
        const health = await healthRes.json();

        document.getElementById("total-users").textContent = health.usersCount || 1;
        document.getElementById("total-vocabulary").textContent =
            health.vocabularyCount || 0;

        // Format uptime thân thiện hơn
        const uptime = Math.floor(health.uptime);
        let uptimeText = '';
        if (uptime < 60) {
            uptimeText = uptime + 's';
        } else if (uptime < 3600) {
            uptimeText = Math.floor(uptime / 60) + 'm ' + (uptime % 60) + 's';
        } else if (uptime < 86400) {
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            uptimeText = hours + 'h ' + minutes + 'm';
        } else {
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            uptimeText = days + 'd ' + hours + 'h';
        }
        document.getElementById("server-uptime").textContent = uptimeText;

        document.getElementById("total-sessions").textContent = '-';
        // toeic-tests-count is populated by loadToeicStats() called separately

        // Update topbar status dot & compact server info
        const dotEl = document.getElementById('topbar-server-status');
        if (dotEl) { dotEl.textContent = 'Online'; dotEl.className = 'status-dot online'; }

        const mongoEl = document.getElementById('server-mongo-status');
        if (mongoEl) {
            const isOk = health.mongodb === 'connected';
            mongoEl.textContent = health.mongodb || '-';
            mongoEl.style.color = isOk ? 'var(--success)' : 'var(--danger)';
        }

        // Load TOEIC tests count for the stat card
        await loadToeicStats();

        // 1. Tải danh sách file JSON có sẵn
        await loadAvailableFiles();
        // 2. Khởi tạo bộ lọc (Quét Part)
        await initializeVocabFilters();
        // 3. Tải dữ liệu từ vựng ban đầu (Lọc Part theo mặc định là Tất cả)
        await loadVocabulary();

        await loadUsers();

        // 3. Load statistics and info for right panel
        await loadVocabularyStats();
        await loadRecentActivities();
    } catch (error) {
        console.error("Error loading dashboard:", error);

        // Fallback to offline mode on error
        if (!isOfflineMode) {
            console.log('🔌 Error connecting, switching to offline mode...');
            isOfflineMode = true;
            initOfflineMode();
            await loadLocalVocabulary('vocabulary.json');
            displayLocalVocabulary();
            updateLocalStats();
            updateLocalPartFilter();
            initSimpleSearch();
        }
    }
}

/**
 * Setup search handler for offline mode
 */
function setupOfflineSearchHandler() {
    // Guard to prevent multiple registrations
    if (searchHandlerRegistered) {
        console.log('⚠️ Search handler already registered, skipping...');
        return;
    }
    searchHandlerRegistered = true;
    console.log('🔧 Setting up offline search handler...');

    // Search input - ID is "vocab-search" (not "vocab-search-input")
    const searchInput = document.getElementById('vocab-search');
    const partFilter = document.getElementById('vocab-part-filter');

    if (searchInput) {
        console.log('✅ Found search input, attaching offline handler');

        // Remove old listeners by cloning
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        newSearchInput.addEventListener('input', debounce((e) => {
            vocabSearchTerm = e.target.value.trim();
            console.log(`🔍 Offline search: "${vocabSearchTerm}" in ${currentLocalFile}`);
            displayLocalVocabulary();
        }, 300));
    } else {
        console.warn('⚠️ Search input not found');
    }

    if (partFilter) {
        console.log('✅ Found part filter, attaching offline handler');

        // Remove old listeners by cloning
        const newPartFilter = partFilter.cloneNode(true);
        partFilter.parentNode.replaceChild(newPartFilter, partFilter);

        newPartFilter.addEventListener('change', (e) => {
            vocabCurrentPart = e.target.value;
            console.log(`🏷️ Offline filter by part: "${vocabCurrentPart}"`);
            displayLocalVocabulary();
        });

        // Re-populate options
        updateLocalPartFilter();
    } else {
        console.warn('⚠️ Part filter not found');
    }

    console.log('✅ Offline search handler ready');
}

function refreshData() {
    // Allow re-initialization on explicit refresh
    dashboardInitialized = false;
    loadDashboard();
}

// ===================================
// 4. VOCABULARY MANAGEMENT FUNCTIONS (UPDATED)
// ===================================

/**
 * [PHẦN LỌC DỮ LIỆU]
 * Tải danh sách từ vựng từ API, có hỗ trợ phân trang và lọc Part.
 */
async function loadVocabulary(page = vocabCurrentPage, part = vocabCurrentPart, source = vocabCurrentSource) {
    const tbody = document.querySelector("#vocabulary-table tbody");
    const paginationControls = document.getElementById('vocabulary-pagination-controls');

    vocabCurrentPage = page;
    vocabCurrentPart = part;
    vocabCurrentSource = source;

    tbody.innerHTML = `<tr><td colspan="6" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải từ vựng...</td></tr>`;
    if (paginationControls) paginationControls.innerHTML = '';

    try {
        const url = `${API_URL}/vocabulary?limit=${vocabCurrentLimit}&page=${page}&part=${part || ''}&source=${source || ''}&search=${encodeURIComponent(vocabSearchTerm)}`;
        const res = await fetch(url); // <-- API call to filter
        const data = await res.json();

        if (data.success) {
            window._lastVocabData = data.data;
            displayVocabulary(data.data);
            updateLocalPartFilter(data.data);
            if (paginationControls) {
                renderVocabularyPagination(data.page, data.limit, data.total, data.count);
            }
        } else {
            const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim();
            tbody.innerHTML = `<tr><td colspan="6" class="loading" style="color: ${dangerColor}">Lỗi tải dữ liệu: ${data.message}</td></tr>`;
        }
    } catch (err) {
        console.error("Lỗi tải từ vựng:", err);
        const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim();
        tbody.innerHTML = `<tr><td colspan="6" class="loading" style="color: ${dangerColor}">Không thể kết nối đến API từ vựng.</td></tr>`;
    }
}

/**
 * Hiển thị danh sách từ vựng lên bảng
 */
function displayVocabulary(words) {
    const tbody = document.querySelector("#vocabulary-table tbody");
    tbody.innerHTML = ''; 

    if (words.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #999; padding: 40px;">Không có từ vựng nào được tìm thấy.</td></tr>`;
        return;
    }

    tbody.innerHTML = words
        .map((word) => {
            const sources = Array.isArray(word.sources) && word.sources.length
                ? word.sources.map(s => `<span class="badge" style="background:#1e3a5f;color:#60a5fa;font-size:10px;">${s}</span>`).join(' ')
                : (word.source ? `<span class="badge" style="background:#1e3a5f;color:#60a5fa;font-size:10px;">${word.source}</span>` : '<span style="color:#666;font-size:11px;">—</span>');
            return `
        <tr>
            <td><strong>${word.en}</strong> <span style="color:#888;font-size:12px;">${word.phonetic || ''}</span></td>
            <td>${word.vn}</td>
            <td><span class="badge info">${word.type}</span></td>
            <td><span class="badge warning">${word.part}</span></td>
            <td style="white-space:nowrap;">${sources}</td>
            <td>
                <button class="btn btn-primary btn-sm btn-edit-word"
                    data-word='${JSON.stringify(word).replace(/'/g, "&apos;")}'>
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-sm btn-delete-word"
                    data-word-en="${word.en}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>`;
        })
        .join("");

    attachEditWordListeners();
    attachDeleteWordListeners();
}

/**
 * Khởi tạo dropdown lọc Part bằng danh sách Part đã quét (fetch) được.
 */
async function initializeVocabFilters() {
    const filterSelect = document.getElementById('vocab-part-filter');
    
    if (!filterSelect) return; 

    // 1. Fetch parts dynamically (Quét Part)
    const uniqueParts = await fetchUniqueVocabParts(); 

    // 2. Clear and set default option
    filterSelect.innerHTML = '<option value="">-- Tất cả Part --</option>';

    // 3. Populate Options
    if (uniqueParts.length > 0) {
        uniqueParts.forEach(part => {
            const option = document.createElement('option');
            option.value = part;
            option.textContent = part; // Giá trị hiển thị là tên Part (vd: E2XA-P1)
            filterSelect.appendChild(option);
        });
    }

    // Giữ nguyên giá trị đang được chọn sau khi tải lại Options
    filterSelect.value = vocabCurrentPart;

    // 4. Re-attach Event Listener
    filterSelect.removeEventListener('change', handleVocabFilterChange);
    filterSelect.addEventListener('change', handleVocabFilterChange);
}


/**
 * Render thông tin số lượng từ vựng (giống TOEIC Questions tab)
 */
function renderVocabularyPagination(_currentPage, _limit, total, filteredCount) {
    const container = document.getElementById('vocabulary-pagination-controls');
    const clearBtn = document.getElementById('clear-vocab-filters');
    if (!container) return;

    const displayCount = filteredCount !== undefined ? filteredCount : total;
    const totalPages = Math.ceil(total / vocabCurrentLimit);
    const hasFilter = vocabCurrentPart || vocabSearchTerm || vocabCurrentSource;

    if (total === 0) {
        container.innerHTML = `<span style="color:#999;">Không có từ vựng nào.</span>`;
        if (clearBtn) clearBtn.style.display = hasFilter ? 'inline-block' : 'none';
        return;
    }

    if (clearBtn) clearBtn.style.display = hasFilter ? 'inline-block' : 'none';

    const from = (_currentPage - 1) * vocabCurrentLimit + 1;
    const to = Math.min(_currentPage * vocabCurrentLimit, total);

    if (totalPages <= 1) {
        container.innerHTML = `<span style="color:#94a3b8;font-size:13px;">${from}–${to} / <strong style="color:#e2e8f0;">${total}</strong> từ</span>`;
        return;
    }

    const maxBtns = 5;
    let startPage = Math.max(1, _currentPage - Math.floor(maxBtns / 2));
    let endPage = Math.min(totalPages, startPage + maxBtns - 1);
    if (endPage - startPage < maxBtns - 1) startPage = Math.max(1, endPage - maxBtns + 1);

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:4px;flex-wrap:wrap;';

    const info = document.createElement('span');
    info.style.cssText = 'color:#94a3b8;font-size:13px;margin-right:6px;';
    info.innerHTML = `${from}–${to} / <strong style="color:#e2e8f0;">${total}</strong> từ`;
    wrap.appendChild(info);

    function makeBtn(label, page, disabled, active) {
        const btn = document.createElement('button');
        btn.innerHTML = label;
        btn.style.cssText = `padding:4px ${active ? '10' : '8'}px;border-radius:6px;border:1px solid ${active ? '#3b82f6' : '#334155'};background:${active ? '#3b82f6' : '#1e293b'};color:${active ? '#fff' : '#94a3b8'};cursor:pointer;font-size:12px;font-weight:${active ? '600' : '400'};${disabled ? 'opacity:.4;pointer-events:none;' : ''}`;
        if (!disabled) btn.addEventListener('click', () => loadVocabulary(page, vocabCurrentPart, vocabCurrentSource));
        return btn;
    }

    wrap.appendChild(makeBtn('&laquo;', _currentPage - 1, _currentPage <= 1, false));
    for (let p = startPage; p <= endPage; p++) {
        wrap.appendChild(makeBtn(p, p, false, p === _currentPage));
    }
    wrap.appendChild(makeBtn('&raquo;', _currentPage + 1, _currentPage >= totalPages, false));

    container.innerHTML = '';
    container.appendChild(wrap);
}

/**
 * Xóa tất cả bộ lọc từ vựng
 */
function clearVocabFilters() {
    vocabCurrentPart = '';
    vocabCurrentSource = '';
    vocabSearchTerm = '';

    const partFilter = document.getElementById('vocab-part-filter');
    const searchInput = document.getElementById('vocab-search');
    const pickerLabel = document.getElementById('vocab-file-picker-label');

    if (partFilter) partFilter.value = '';
    if (searchInput) searchInput.value = '';
    if (pickerLabel) pickerLabel.textContent = 'Tất cả';

    // Reset active card
    document.querySelectorAll('.vocab-picker-card').forEach(c => c.classList.remove('active'));
    const allCard = document.querySelector('.vocab-picker-card[data-source=""]');
    if (allCard) allCard.classList.add('active');

    loadVocabulary(1, '', '');
}
// Expose to window for HTML onclick
window.clearVocabFilters = clearVocabFilters;


/* =========================================================
    OLD WORD EDIT LOGIC
========================================================= */

function attachEditWordListeners() {
    document.querySelectorAll(".btn-edit-word").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const wordData = JSON.parse(e.target.closest("button").dataset.word.replace(/&apos;/g, "'"));
            openEditWordModal(wordData);
        });
    });
}

function attachDeleteWordListeners() {
    document.querySelectorAll(".btn-delete-word").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            const button = e.target.closest("button");
            const wordEn = button.dataset.wordEn;
            const row = button.closest("tr"); // Lấy dòng chứa nút xóa

            if (!confirm(`Bạn có chắc chắn muốn XÓA từ vựng "${wordEn}"?`)) return;

            try {
                const res = await fetch(`${API_URL}/vocabulary/${encodeURIComponent(wordEn)}`, {
                    method: "DELETE",
                });

                const data = await res.json();

                if (data.success) {
                    // ✅ Xóa dòng khỏi DOM thay vì reload toàn bộ bảng
                    if (row) {
                        row.style.transition = 'opacity 0.3s, transform 0.3s';
                        row.style.opacity = '0';
                        row.style.transform = 'translateX(-20px)';

                        setTimeout(() => {
                            row.remove();

                            // Cập nhật số lượng hiển thị
                            updateVocabCountAfterDelete();
                        }, 300);
                    }

                    // Reload stats và activities ở background (không ảnh hưởng scroll)
                    loadVocabularyStats();
                    loadRecentActivities();

                    // Thông báo nhẹ nhàng hơn (không dùng alert)
                    showToast(`✅ Đã xóa "${wordEn}"`, 'success');
                } else {
                    alert("❌ Lỗi: " + (data.message || "Không thể xóa từ vựng."));
                }
            } catch (error) {
                console.error("Error deleting word:", error);
                alert("❌ Lỗi kết nối: Không thể xóa từ vựng.");
            }
        });
    });
}

/**
 * Cập nhật số lượng từ vựng sau khi xóa (không reload)
 */
function updateVocabCountAfterDelete() {
    const container = document.getElementById('vocabulary-pagination-controls');
    if (!container) return;

    // Đếm số dòng còn lại trong bảng
    const tbody = document.querySelector("#vocabulary-table tbody");
    const rowCount = tbody ? tbody.querySelectorAll('tr').length : 0;

    // Cập nhật hiển thị
    const hasFilter = vocabCurrentPart || vocabSearchTerm;
    if (hasFilter) {
        container.innerHTML = `<i class="fas fa-info-circle"></i> Hiển thị <strong>${rowCount}</strong> từ vựng`;
    } else {
        container.innerHTML = `<i class="fas fa-list"></i> Tổng cộng: <strong>${rowCount}</strong> từ vựng`;
    }
}

/**
 * Xóa từ vựng theo từ tiếng Anh
 */
async function deleteWord(wordEn) {
    try {
        const res = await fetch(`${API_URL}/vocabulary/${encodeURIComponent(wordEn)}`, {
            method: "DELETE",
        });

        const data = await res.json();

        if (data.success) {
            // Xóa khỏi local data
            localVocabularyData = localVocabularyData.filter(w => w.en !== wordEn);

            // Refresh display
            displayLocalVocabulary();

            showToast(`✅ Đã xóa "${wordEn}"`, 'success');
        } else {
            alert("❌ Lỗi: " + (data.message || "Không thể xóa từ vựng."));
        }
    } catch (error) {
        console.error("Error deleting word:", error);
        alert("❌ Lỗi kết nối: Không thể xóa từ vựng.");
    }
}

// ===================================
// DUPLICATE VOCABULARY MANAGEMENT
// ===================================

/**
 * Tìm các từ vựng trùng lặp (cùng en + vn + part)
 */
function findDuplicateVocabulary() {
    if (!localVocabularyData || localVocabularyData.length === 0) {
        alert('⚠️ Chưa có dữ liệu từ vựng. Vui lòng chọn file JSON trước.');
        return [];
    }

    const seen = new Map();
    const duplicates = [];

    localVocabularyData.forEach((word, index) => {
        // Tạo key từ en + vn + part
        const key = `${(word.en || '').toLowerCase().trim()}|${(word.vn || '').toLowerCase().trim()}|${(word.part || '').toLowerCase().trim()}`;

        if (seen.has(key)) {
            // Đã thấy từ này trước đó -> trùng lặp
            const original = seen.get(key);
            duplicates.push({
                key,
                original: original,
                duplicate: { ...word, _index: index }
            });
        } else {
            seen.set(key, { ...word, _index: index });
        }
    });

    console.log(`🔍 Found ${duplicates.length} duplicate entries`);
    return duplicates;
}

/**
 * Quét và hiển thị danh sách từ trùng lặp
 */
function scanDuplicates() {
    const duplicates = findDuplicateVocabulary();

    if (duplicates.length === 0) {
        alert(`✅ Không tìm thấy từ vựng trùng lặp trong file ${currentLocalFile}!`);
        return;
    }

    // Tạo modal hiển thị kết quả
    showDuplicateModal(duplicates);
}

/**
 * Hiển thị modal danh sách từ trùng lặp
 */
function showDuplicateModal(duplicates) {
    // Xóa modal cũ nếu có
    const existingModal = document.getElementById('duplicate-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'duplicate-modal';
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: #1e1e2e; border-radius: 12px; max-width: 900px; width: 95%; max-height: 80vh; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                <div style="padding: 20px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: #fff;">
                        <i class="fas fa-copy"></i> Từ vựng trùng lặp trong ${currentLocalFile}
                    </h3>
                    <span style="background: #e74c3c; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold;">
                        ${duplicates.length} từ trùng
                    </span>
                </div>

                <div style="max-height: 50vh; overflow-y: auto; padding: 15px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="background: #2d2d3d; color: #aaa;">
                                <th style="padding: 10px; text-align: left;">#</th>
                                <th style="padding: 10px; text-align: left;">English</th>
                                <th style="padding: 10px; text-align: left;">Vietnamese</th>
                                <th style="padding: 10px; text-align: left;">Part</th>
                                <th style="padding: 10px; text-align: left;">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${duplicates.map((dup, i) => `
                                <tr style="border-bottom: 1px solid #333;">
                                    <td style="padding: 10px; color: #888;">${i + 1}</td>
                                    <td style="padding: 10px; color: #fff;"><strong>${dup.original.en || '-'}</strong></td>
                                    <td style="padding: 10px; color: #ccc;">${dup.original.vn || '-'}</td>
                                    <td style="padding: 10px;"><span style="background: #f39c12; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${dup.original.part || '-'}</span></td>
                                    <td style="padding: 10px; color: #e74c3c;"><i class="fas fa-exclamation-triangle"></i> Trùng lặp</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="padding: 20px; border-top: 1px solid #333; display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
                    <button id="btn-close-duplicate-modal" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        <i class="fas fa-times"></i> Đóng
                    </button>
                    <button id="btn-delete-duplicates-local" style="padding: 10px 20px; background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-trash"></i> Xóa vĩnh viễn ${duplicates.length} từ trùng
                    </button>
                    <button id="btn-export-clean-json" style="padding: 10px 20px; background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-download"></i> Xuất file đã làm sạch
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    document.getElementById('btn-close-duplicate-modal').addEventListener('click', () => modal.remove());

    // Xóa trùng lặp và lưu vào file JSON thực sự
    document.getElementById('btn-delete-duplicates-local').addEventListener('click', async () => {
        if (confirm(`Bạn có chắc muốn xóa ${duplicates.length} từ vựng trùng lặp?\n\n⚠️ Thao tác này sẽ XÓA VĨNH VIỄN các từ trùng lặp trong file "${currentLocalFile}"!`)) {
            try {
                // Gọi API để xóa duplicates trong file JSON thực sự
                const response = await fetch(`/api/vocabulary/remove-duplicates/${encodeURIComponent(currentLocalFile)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                const result = await response.json();

                if (result.success) {
                    // Reload dữ liệu từ file đã được làm sạch
                    await loadLocalVocabulary(currentLocalFile);
                    modal.remove();
                    showToast(`✅ ${result.message}`, 'success');
                } else {
                    showToast(`❌ Lỗi: ${result.message}`, 'error');
                }
            } catch (error) {
                console.error('Error removing duplicates:', error);
                showToast(`❌ Lỗi kết nối server: ${error.message}`, 'error');
            }
        }
    });

    // Xuất file JSON đã làm sạch
    document.getElementById('btn-export-clean-json').addEventListener('click', () => {
        // Tạo bản sao và xóa trùng
        const cleanData = removeDuplicatesFromArray([...localVocabularyData]);

        // Xuất file
        const blob = new Blob([JSON.stringify(cleanData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentLocalFile.replace('.json', '')}-clean-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`✅ Đã xuất file! Từ ${localVocabularyData.length} → ${cleanData.length} từ (xóa ${duplicates.length} trùng)`, 'success');
    });

    // Click outside to close
    modal.querySelector('div').addEventListener('click', (e) => {
        if (e.target === modal.querySelector('div')) modal.remove();
    });
}

/**
 * Xóa trùng lặp từ một mảng (trả về mảng mới)
 */
function removeDuplicatesFromArray(arr) {
    const seen = new Map();
    const result = [];

    arr.forEach(word => {
        const key = `${(word.en || '').toLowerCase().trim()}|${(word.vn || '').toLowerCase().trim()}|${(word.part || '').toLowerCase().trim()}`;
        if (!seen.has(key)) {
            seen.set(key, true);
            result.push(word);
        }
    });

    return result;
}

/**
 * Xóa các từ vựng trùng lặp (giữ lại bản gốc)
 */
async function removeDuplicates(duplicates) {
    if (!duplicates || duplicates.length === 0) {
        alert('Không có từ trùng lặp để xóa.');
        return;
    }

    let deletedCount = 0;
    let errorCount = 0;

    // Tạo progress indicator
    const progressDiv = document.createElement('div');
    progressDiv.id = 'delete-progress';
    progressDiv.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10001; display: flex; align-items: center; justify-content: center;">
            <div style="background: #1e1e2e; padding: 30px; border-radius: 12px; text-align: center; min-width: 300px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 40px; color: #667eea; margin-bottom: 15px;"></i>
                <h3 style="color: #fff; margin: 0 0 10px 0;">Đang xóa từ trùng lặp...</h3>
                <p id="delete-progress-text" style="color: #aaa; margin: 0;">0 / ${duplicates.length}</p>
            </div>
        </div>
    `;
    document.body.appendChild(progressDiv);

    // Xóa từng từ trùng
    for (let i = 0; i < duplicates.length; i++) {
        const dup = duplicates[i];
        document.getElementById('delete-progress-text').textContent = `${i + 1} / ${duplicates.length}`;

        try {
            const res = await fetch(`${API_URL}/vocabulary/${encodeURIComponent(dup.duplicate.en)}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (data.success) {
                deletedCount++;
                // Xóa khỏi local data
                localVocabularyData = localVocabularyData.filter((_w, idx) => idx !== dup.duplicate._index);
            } else {
                errorCount++;
            }
        } catch (error) {
            console.error('Error deleting duplicate:', error);
            errorCount++;
        }

        // Delay nhỏ để tránh quá tải server
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Xóa progress
    progressDiv.remove();

    // Reload local data và hiển thị
    await loadLocalVocabulary(currentLocalFile);
    displayLocalVocabulary();

    // Thông báo kết quả
    if (errorCount === 0) {
        showToast(`✅ Đã xóa ${deletedCount} từ trùng lặp thành công!`, 'success');
    } else {
        alert(`⚠️ Đã xóa ${deletedCount} từ.\n❌ Lỗi: ${errorCount} từ không xóa được (có thể do API offline).`);
    }
}

/**
 * Xóa trùng lặp trực tiếp trong local data (không cần API)
 */
function removeDuplicatesLocal() {
    const duplicates = findDuplicateVocabulary();

    if (duplicates.length === 0) {
        alert(`✅ Không tìm thấy từ vựng trùng lặp trong file ${currentLocalFile}!`);
        return;
    }

    if (!confirm(`Tìm thấy ${duplicates.length} từ trùng lặp.\n\nBạn có muốn xóa chúng khỏi danh sách hiển thị?\n\n(Lưu ý: Chỉ xóa trong bộ nhớ, không ảnh hưởng file gốc)`)) {
        return;
    }

    // Lấy danh sách index cần xóa (từ cao xuống thấp để không ảnh hưởng index)
    const indexesToRemove = duplicates.map(d => d.duplicate._index).sort((a, b) => b - a);

    // Xóa từ local data
    indexesToRemove.forEach(idx => {
        localVocabularyData.splice(idx, 1);
    });

    // Refresh display
    displayLocalVocabulary();

    showToast(`✅ Đã xóa ${duplicates.length} từ trùng lặp khỏi danh sách!`, 'success');
}

/**
 * Hiển thị toast notification nhẹ
 */
function showToast(message, type = 'info') {
    // Tạo toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Tự động xóa sau 3 giây
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function openEditWordModal(wordData) {
    const modal = document.getElementById("add-word-modal");
    const modalTitle = modal.querySelector("h3");
    const submitBtn = modal.querySelector('button[type="submit"]');

    // Thay đổi tiêu đề modal
    modalTitle.innerHTML = '✏️ Edit Word';
    submitBtn.textContent = 'Update Word';

    // Điền dữ liệu vào form
    document.getElementById("word-en").value = wordData.en || '';
    document.getElementById("word-vn").value = wordData.vn || '';
    document.getElementById("word-phonetic").value = wordData.phonetic || '';
    document.getElementById("word-part").value = wordData.part || '';
    document.getElementById("word-type").value = wordData.type || '';
    document.getElementById("word-synonyms").value = wordData.synonyms || '';
    // Fix đường dẫn ảnh cũ sang format mới
    const rawImage = wordData.image || '';
    const fixedImage = rawImage.replace(/^assets\/images\/pages\//, 'images/pages/');
    document.getElementById("word-image").value = fixedImage;
    document.getElementById("word-example").value = wordData.example || '';
    const sourcesField = document.getElementById("word-sources");
    if (sourcesField) sourcesField.value = wordData.source || '';

    // Lưu trạng thái edit mode
    modal.dataset.editMode = 'true';
    modal.dataset.originalEn = wordData.en;

    // Hiển thị modal
    modal.style.display = "flex";
}


// ===================================
// 5. USER MANAGEMENT FUNCTIONS
// (Giữ nguyên logic cũ cho người dùng)
// ===================================

// Ẩn modal người dùng
function hideUsersModal() {
    document.getElementById("manage-users-modal").style.display = "none";
}

// Ẩn modal form người dùng
function hideUserFormModal() {
    document.getElementById("user-form-modal").style.display = "none";
}

// Mở modal form người dùng
function openUserFormModal(title, mode, userData = {}) {
    const userFormModal = document.getElementById("user-form-modal");
    const userModalTitle = userFormModal.querySelector("h3");
    const passwordInput = document.getElementById("user-password");
    
    userModalTitle.textContent = title;
    isEditMode = mode === 'edit';

    // Thiết lập giá trị cho form
    document.getElementById("edit-user-id").value = userData.id || '';
    document.getElementById("user-username").value = userData.username || '';
    document.getElementById("user-email").value = userData.email || '';
    document.getElementById("user-role").value = userData.role || 'user';
    document.getElementById("user-lock-status").value = userData.isLocked ? 'true' : 'false';
    // Chỉ hiện lock row khi edit (không phải add mới)
    document.getElementById("user-lock-row").style.display = isEditMode ? '' : 'none';
    passwordInput.value = ''; // Luôn xóa mật khẩu khi mở

    // Ẩn/hiện trường mật khẩu
    const passwordLabel = passwordInput.closest("div").querySelector("label");
    if (isEditMode) {
        passwordLabel.innerHTML = 'Mật khẩu <small>(để trống nếu không đổi)</small>';
        passwordInput.required = false;
    } else {
        passwordLabel.innerHTML = 'Mật khẩu *';
        passwordInput.required = true;
    }
    
    userFormModal.style.display = "flex";
}

// Tải tất cả người dùng
async function loadUsers() {
    const tbody = document.querySelector("#users-table tbody");
    tbody.innerHTML = `<tr><td colspan="8" class="loading"><i class="fas fa-spinner"></i> Đang tải danh sách tài khoản...</td></tr>`;

    try {
        const res = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();

        if (data.success) {
            allUsers = data.data || [];
            displayUsers();
        } else {
             const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim();
             tbody.innerHTML = `<tr><td colspan="7" class="loading" style="color: ${dangerColor}">Lỗi tải dữ liệu: ${data.message}</td></tr>`;
        }
    } catch (err) {
        console.error("Error loading users:", err);
         const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim();
        tbody.innerHTML = `<tr><td colspan="7" class="loading" style="color: ${dangerColor}">Lỗi kết nối API: Không thể tải danh sách tài khoản</td></tr>`;
    }
}

// Hiển thị người dùng
function displayUsers() {
    const tbody = document.querySelector("#users-table tbody");

    // Calculate pagination
    usersPagination.total = allUsers.length;
    usersPagination.totalPages = Math.ceil(allUsers.length / usersPagination.limit);

    // Ensure current page is valid
    if (usersPagination.currentPage > usersPagination.totalPages) {
        usersPagination.currentPage = 1;
    }

    // Calculate start and end indices for current page
    const start = (usersPagination.currentPage - 1) * usersPagination.limit;
    const end = start + usersPagination.limit;

    // Get paginated users
    const paginatedUsers = allUsers.slice(start, end);

    if (!paginatedUsers || !paginatedUsers.length) {
        tbody.innerHTML =
            '<tr><td colspan="8" style="text-align:center;padding:30px;">Không tìm thấy tài khoản nào</td></tr>';
        renderPagination('users-pagination', usersPagination, (page) => {
            usersPagination.currentPage = page;
            displayUsers();
            document.querySelector('#users-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 'users');
        return;
    }

    tbody.innerHTML = paginatedUsers
        .map((u) => {
            // Support both MongoDB (_id) and JSON (id)
            const userId = u._id || u.id;
            const createdAt = new Date(u.createdAt).toLocaleDateString('vi-VN');
            const lockInfo = u.lockUntil && new Date(u.lockUntil) > new Date()
                ? ` <small style="font-size:10px;opacity:0.8">đến ${new Date(u.lockUntil).toLocaleTimeString('vi-VN')}</small>`
                : '';
            const statusBadge = u.isLocked
                ? `<span class="badge danger" title="Bị khóa bởi admin">🔒 Locked (Admin)</span>`
                : (u.lockUntil && new Date(u.lockUntil) > new Date())
                    ? `<span class="badge warning" title="Khóa tạm thời do nhập sai">⏳ Locked (Tạm thời)${lockInfo}</span>`
                    : u.isActive
                        ? `<span class="badge success">✅ Active</span>`
                        : `<span class="badge danger">Inactive</span>`;
            const roleBadge = u.role === 'admin'
                ? `<span class="badge danger">${u.role.toUpperCase()}</span>`
                : `<span class="badge info">${u.role.toUpperCase()}</span>`;

            const isTempLocked = u.lockUntil && new Date(u.lockUntil) > new Date();
            const lockBadge = u.isLocked
                ? `<span class="badge danger">🔒 Locked (Admin)</span>`
                : isTempLocked
                    ? `<span class="badge warning">⏳ Locked (Tạm thời)</span>`
                    : `<span class="badge success">🔓 Unlock</span>`;

            return `
              <tr>
                <td>${userId}</td>
                <td><strong>${u.username}</strong></td>
                <td>${u.email || "-"}</td>
                <td>${roleBadge}</td>
                <td>${createdAt}</td>
                <td>${statusBadge}</td>
                <td>${lockBadge}</td>
                <td>
                    <button class="btn btn-primary btn-sm btn-user-edit" data-id="${userId}" data-username="${u.username}" data-email="${u.email}" data-role="${u.role}" data-locked="${u.isLocked ? 'true' : 'false'}" title="Sửa thông tin">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-user-togglelock ${u.isLocked ? 'btn-success' : 'btn-warning'}"
                        data-id="${userId}" data-username="${u.username}" data-locked="${u.isLocked ? 'true' : 'false'}"
                        title="${u.isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}">
                        <i class="fas ${u.isLocked ? 'fa-lock-open' : 'fa-lock'}"></i>
                    </button>
                    <button class="btn btn-danger btn-sm btn-user-delete" data-id="${userId}" data-username="${u.username}" title="Xóa tài khoản">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
              </tr>
            `;
        })
        .join("");

    attachUserListeners();
    renderPagination('users-pagination', usersPagination, (page) => {
        usersPagination.currentPage = page;
        displayUsers();
        document.querySelector('#users-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 'users');
}

// Gắn sự kiện cho các nút Sửa/Xóa người dùng
function attachUserListeners() {
    // --- Edit User ---
    document.querySelectorAll(".btn-user-edit").forEach((btn) => {
        btn.addEventListener("click", () => {
            openUserFormModal("Sửa thông tin tài khoản", "edit", {
                id: btn.dataset.id,
                username: btn.dataset.username,
                email: btn.dataset.email,
                role: btn.dataset.role,
                isLocked: btn.dataset.locked === 'true',
            });
        });
    });

    // --- Quick Lock/Unlock ---
    document.querySelectorAll(".btn-user-togglelock").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const username = btn.dataset.username;
            const currentlyLocked = btn.dataset.locked === 'true';
            const action = currentlyLocked ? 'mở khóa' : 'khóa';

            if (!confirm(`Bạn có chắc muốn ${action} tài khoản "${username}"?`)) return;

            btn.disabled = true;
            try {
                const res = await fetch(`${API_URL}/users/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", 'Authorization': `Bearer ${getToken()}` },
                    body: JSON.stringify({ isLocked: !currentlyLocked }),
                });
                const data = await res.json();
                if (data.success) {
                    await loadUsers();
                } else {
                    alert("❌ Lỗi: " + (data.message || "Không thể thực hiện."));
                }
            } catch {
                alert("Lỗi kết nối.");
            } finally {
                btn.disabled = false;
            }
        });
    });

    // --- Delete User ---
    document.querySelectorAll(".btn-user-delete").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const username = btn.dataset.username;
            if (!confirm(`Bạn có chắc chắn muốn XÓA tài khoản "${username}" (ID: ${id})?`)) return;

            try {
                const res = await fetch(`${API_URL}/users/${id}`, {
                    method: "DELETE",
                    headers: { 'Authorization': `Bearer ${getToken()}` },
                });

                const data = await res.json();

                if (data.success) {
                    // Delay để đảm bảo file đã được lưu TRƯỚC KHI hiển thị alert
                    setTimeout(async () => {
                        await loadUsers();
                        await loadRecentActivities(); // Reload activities

                        // Hiển thị thông báo SAU KHI đã reload xong
                        alert("✅ Tài khoản đã được xóa thành công!");
                    }, 200);
                } else {
                    alert("❌ Lỗi: " + (data.message || "Không thể xóa tài khoản."));
                }
            } catch (error) {
                alert("Lỗi kết nối: Không thể thực hiện thao tác xóa.");
            }
        });
    });
}

// Sự kiện Submit Form người dùng (Thêm/Sửa)
document.getElementById("user-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("edit-user-id").value;
    const password = document.getElementById("user-password").value;
    
    const payload = {
        username: document.getElementById("user-username").value,
        email: document.getElementById("user-email").value,
        role: document.getElementById("user-role").value,
    };

    if (isEditMode) {
        payload.isLocked = document.getElementById("user-lock-status").value === 'true';
    }

    if (password) {
        payload.password = password;
    } else if (!isEditMode) {
        alert("Vui lòng nhập mật khẩu cho tài khoản mới.");
        return;
    }

    const method = id ? "PUT" : "POST";
    const url = id ? `${API_URL}/users/${id}` : `${API_URL}/users`;

    try {
        const res = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (data.success) {
            hideUserFormModal();
            // Delay để đảm bảo file đã được lưu TRƯỚC KHI hiển thị alert
            setTimeout(async () => {
                await Promise.all([
                    loadUsers(),
                    loadUsersInTab(),
                    loadRecentActivities(),
                ]);

                // Hiển thị thông báo SAU KHI đã reload xong
                alert(id ? "✅ Thông tin tài khoản đã được lưu thành công!" : "✅ Đã thêm tài khoản mới thành công!");
            }, 200);
        } else {
            alert("❌ Lỗi: " + (data.message || "Không thể thực hiện thao tác."));
        }
    } catch (error) {
        alert("Lỗi kết nối: Không thể gửi dữ liệu người dùng.");
    }
});


// ===================================
// 6. INITIALIZATION & EVENT LISTENERS
// ===================================

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-refresh")?.addEventListener("click", refreshData);

    const usersModal = document.getElementById("manage-users-modal");

    // --- USER MANAGEMENT MODAL EVENTS ---
    document.getElementById("btn-manage-users")?.addEventListener("click", () => {
        if (usersModal) {
            usersModal.style.display = "flex";
            loadUsers(); // Đảm bảo tải lại danh sách mỗi khi mở
        }
    });
    
    document.getElementById("close-users-modal")?.addEventListener("click", hideUsersModal);
    
    document.getElementById("btn-add-user")?.addEventListener("click", () => {
        openUserFormModal("Thêm tài khoản mới", "add");
    });
    
    document.getElementById("cancel-user-form")?.addEventListener("click", hideUserFormModal);
    
    // --- VOCABULARY MODAL EVENTS ---
    document.getElementById("btn-add-vocabulary")?.addEventListener("click", () => {
        const modal = document.getElementById("add-word-modal");
        if (modal) {
            document.getElementById("add-word-form").reset();
            delete modal.dataset.editMode;
            delete modal.dataset.originalEn;
            modal.querySelector("h3").innerHTML = '➕ Add New Word';
            modal.querySelector('button[type="submit"]').textContent = 'Add Word';
            switchWordModalTab('manual');
            modal.style.display = "flex";
        }
    });

    // --- DUPLICATE SCAN BUTTON ---
    document.getElementById("btn-scan-duplicates")?.addEventListener("click", () => {
        scanDuplicates();
    });

    document.getElementById("btn-close-modal")?.addEventListener("click", closeWordModal);
    document.getElementById("btn-close-modal-json")?.addEventListener("click", closeWordModal);
    document.getElementById("btn-submit-json")?.addEventListener("click", submitJsonImport);

    document.getElementById("tab-manual")?.addEventListener("click", () => switchWordModalTab('manual'));
    document.getElementById("tab-json")?.addEventListener("click",   () => switchWordModalTab('json'));

    // --- PART FILTER DROPDOWN ---
    initPartFilterDropdown();

    // --- AI FILL BUTTON ---
    document.getElementById("btn-ai-fill")?.addEventListener("click", async () => {
        const wordInput = document.getElementById("word-en");
        const word = wordInput?.value.trim();

        if (!word) {
            showToast('⚠️ Vui lòng nhập từ tiếng Anh trước!', 'warning');
            wordInput?.focus();
            return;
        }

        const btn = document.getElementById("btn-ai-fill");
        const originalText = btn.innerHTML;

        try {
            // Show loading state
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tra...';
            btn.disabled = true;

            const response = await fetch(`${API_URL}/ai/lookup-word`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ word })
            });

            const result = await response.json();

            if (result.success && result.data) {
                const data = result.data;

                // Fill form fields
                if (data.vn) document.getElementById("word-vn").value = data.vn;
                if (data.phonetic) document.getElementById("word-phonetic").value = data.phonetic;
                if (data.synonyms) document.getElementById("word-synonyms").value = data.synonyms;
                if (data.example) document.getElementById("word-example").value = data.example;

                // Set type - normalize to match select option values
                if (data.type) {
                    const typeSelect = document.getElementById("word-type");
                    const normalizedType = data.type.toLowerCase().trim();
                    // Check if the value exists in the select options
                    const optionExists = Array.from(typeSelect.options).some(opt => opt.value === normalizedType);
                    if (optionExists) {
                        typeSelect.value = normalizedType;
                    } else {
                        console.warn(`AI returned unknown type: "${data.type}", defaulting to "noun"`);
                        typeSelect.value = 'noun';
                    }
                }

                showToast(`Da dien thong tin cho "${word}" bang AI!`, 'success');
            } else {
                showToast(`❌ ${result.message || 'Không thể tra cứu từ này'}`, 'error');
            }
        } catch (error) {
            console.error('AI lookup error:', error);
            showToast(`❌ Lỗi kết nối: ${error.message}`, 'error');
        } finally {
            // Restore button
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // --- ADD/EDIT WORD FORM SUBMIT ---
    document.getElementById("add-word-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const modal = document.getElementById("add-word-modal");
        const isEditMode = modal.dataset.editMode === 'true';
        const originalEn = modal.dataset.originalEn;

        const wordData = {
            en: document.getElementById("word-en").value.trim(),
            vn: document.getElementById("word-vn").value.trim(),
            phonetic: document.getElementById("word-phonetic").value.trim(),
            part: document.getElementById("word-part").value.trim().toUpperCase(),
            type: document.getElementById("word-type").value,
            synonyms: document.getElementById("word-synonyms").value.trim(),
            image: document.getElementById("word-image").value.trim(),
            example: document.getElementById("word-example").value.trim(),
            source: (document.getElementById("word-sources")?.value.trim() || 'custom').toLowerCase(),
        };

        // Client-side validation with clear error messages
        if (!wordData.en) { showToast('Vui long nhap tu tieng Anh (English)', 'error'); return; }
        if (!wordData.vn) { showToast('Vui long nhap nghia tieng Viet (Vietnamese)', 'error'); return; }
        if (!wordData.part) { showToast('Vui long nhap Part (vd: E2XA-P1)', 'error'); return; }
        if (!wordData.type) { showToast('Vui long chon Type (Noun, Verb...)', 'error'); return; }

        console.log('📝 Submitting word data:', JSON.stringify(wordData));
        console.log(`📂 Target file: ${currentLocalFile || 'vocabulary.json (default)'}`);

        try {
            let res, data;

            // IMPORTANT: First, tell backend which file to save to
            if (currentLocalFile) {
                console.log(`📂 Switching backend to: ${currentLocalFile}`);
                const switchRes = await fetch(`${API_URL}/vocabulary/switch/${encodeURIComponent(currentLocalFile)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const switchData = await switchRes.json();
                if (!switchData.success) {
                    showToast(`Loi switch file: ${switchData.message}`, 'error');
                    return;
                }
                console.log(`✅ Backend switched to: ${currentLocalFile}`);
            }

            if (isEditMode) {
                // Cập nhật từ vựng
                res = await fetch(`${API_URL}/vocabulary/${encodeURIComponent(originalEn)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(wordData),
                });
            } else {
                // Thêm từ vựng mới
                res = await fetch(`${API_URL}/vocabulary`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(wordData),
                });
            }

            data = await res.json();
            console.log('📨 Server response:', data);

            if (data.success) {
                // Đóng modal và reset form ngay lập tức
                modal.style.display = "none";
                document.getElementById("add-word-form").reset();

                // Reset modal về trạng thái Add
                delete modal.dataset.editMode;
                delete modal.dataset.originalEn;
                modal.querySelector("h3").innerHTML = '➕ Add New Word';
                modal.querySelector('button[type="submit"]').textContent = 'Add Word';

                // Reload local data và hiển thị
                await loadLocalVocabulary(currentLocalFile);
                displayLocalVocabulary();
                updateLocalPartFilter();

                showToast(isEditMode
                    ? `Da cap nhat tu "${wordData.en}" trong ${currentLocalFile}!`
                    : `Da them tu "${wordData.en}" vao ${currentLocalFile}!`, 'success');
            } else {
                showToast(`Loi: ${data.message || 'Khong the them tu vung'}`, 'error');
            }
        } catch (error) {
            console.error(`Error ${isEditMode ? 'updating' : 'adding'} word:`, error);
            showToast(`Loi ket noi: ${error.message}`, 'error');
        }
    });

    // --- VOCABULARY SEARCH --- (Handled by setupSearchHandler, skip duplicate registration)

    // --- VOCABULARY FILE SWITCHER --- (moved to event listener section below)
    // Old import JSON code removed - now using dropdown file selector

    // --- QUICK ACTIONS ---
    document.getElementById("action-btn-export-vocab")?.addEventListener("click", async () => {
        try {
            const res = await fetch(`${API_URL}/vocabulary?limit=10000`);
            const data = await res.json();

            if (data.success) {
                const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `vocabulary-export-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                alert("✅ Đã xuất file vocabulary thành công!");
            }
        } catch (error) {
            alert("❌ Lỗi khi xuất file: " + error.message);
        }
    });

    document.getElementById("action-btn-backup-db")?.addEventListener("click", async () => {
        try {
            const vocabRes = await fetch(`${API_URL}/vocabulary?limit=10000`);
            const vocabData = await vocabRes.json();

            const usersRes = await fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
            const usersData = await usersRes.json();

            const backup = {
                timestamp: new Date().toISOString(),
                vocabulary: vocabData.data || [],
                users: usersData.data || []
            };

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert("✅ Đã backup database thành công!");
        } catch (error) {
            alert("❌ Lỗi khi backup: " + error.message);
        }
    });

    document.getElementById("action-btn-view-users")?.addEventListener("click", () => {
        document.getElementById("btn-manage-users")?.click();
    });

    document.getElementById("action-btn-reload-cache")?.addEventListener("click", async () => {
        if (confirm("Bạn có chắc muốn tải lại dữ liệu từ file?\n\nLưu ý: Điều này sẽ làm mới cache trong memory.")) {
            try {
                // Reload by calling health endpoint (which reloads cache on startup)
                await fetch("http://localhost:5000/health");
                alert("✅ Đã reload cache thành công!");
                loadDashboard();
            } catch (error) {
                alert("❌ Lỗi khi reload cache: " + error.message);
            }
        }
    });

    // --- QUICK DELETE FUNCTIONALITY ---
    document.getElementById("action-btn-quick-delete")?.addEventListener("click", async () => {
        if (!confirm("Bạn có muốn bắt đầu quét và xóa nhanh từ vựng?\n\nLưu ý: Hệ thống sẽ hiển thị từng từ vựng để bạn quyết định Giữ hoặc Xóa.")) {
            return;
        }
        await startQuickDelete();
    });

    document.getElementById("btn-quick-delete-close")?.addEventListener("click", () => {
        stopQuickDelete();
    });
});

// ===================================
// 9. QUICK DELETE FUNCTIONALITY
// ===================================

let quickDeleteData = {
    allWords: [],
    currentIndex: 0,
    isRunning: false,
    deletedCount: 0,
};

/**
 * Bắt đầu quá trình xóa nhanh
 */
async function startQuickDelete() {
    const modal = document.getElementById("quick-delete-modal");
    const card = document.getElementById("quick-delete-card");
    const progress = document.getElementById("quick-delete-progress");

    // Reset state
    quickDeleteData.allWords = [];
    quickDeleteData.currentIndex = 0;
    quickDeleteData.isRunning = true;
    quickDeleteData.deletedCount = 0;

    // Show modal
    modal.style.display = "flex";
    card.innerHTML = `
        <div style="text-align: center;">
            <i class="fas fa-spinner fa-spin" style="font-size: 48px; margin-bottom: 20px;"></i>
            <p style="font-size: 16px; opacity: 0.9;">Đang tải toàn bộ dữ liệu từ vựng...</p>
        </div>
    `;

    try {
        // Fetch ALL vocabulary (không giới hạn)
        const res = await fetch(`${API_URL}/vocabulary?limit=100000`);
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
            quickDeleteData.allWords = data.data;

            if (quickDeleteData.allWords.length === 0) {
                alert("Không có từ vựng nào để xóa!");
                stopQuickDelete();
                return;
            }

            progress.textContent = `0/${quickDeleteData.allWords.length}`;
            showNextWord();
        } else {
            alert("Lỗi khi tải dữ liệu từ vựng!");
            stopQuickDelete();
        }
    } catch (error) {
        console.error("Error loading vocabulary for quick delete:", error);
        alert("Lỗi kết nối: Không thể tải dữ liệu từ vựng!");
        stopQuickDelete();
    }
}

/**
 * Hiển thị từ vựng tiếp theo
 */
function showNextWord() {
    const { allWords, currentIndex } = quickDeleteData;
    const card = document.getElementById("quick-delete-card");
    const progress = document.getElementById("quick-delete-progress");
    const btnKeep = document.getElementById("btn-quick-delete-keep");
    const btnRemove = document.getElementById("btn-quick-delete-remove");

    // Kiểm tra đã hết từ chưa
    if (currentIndex >= allWords.length) {
        finishQuickDelete();
        return;
    }

    const word = allWords[currentIndex];
    progress.textContent = `${currentIndex + 1}/${allWords.length}`;

    // Hiển thị thông tin từ vựng
    card.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 48px; font-weight: bold; margin-bottom: 15px; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                ${word.en || '-'}
            </div>
            ${word.phonetic ? `<div style="font-size: 18px; opacity: 0.9; margin-bottom: 20px;">/${word.phonetic}/</div>` : ''}
            <div style="background: rgba(255,255,255,0.2); border-radius: 12px; padding: 20px; margin-top: 20px;">
                <div style="font-size: 20px; margin-bottom: 10px;">
                    <strong>Vietnamese:</strong> ${word.vn || '-'}
                </div>
            </div>
            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                ${word.type ? `<span style="background: rgba(255,255,255,0.3); padding: 6px 12px; border-radius: 20px; font-size: 12px;">${word.type}</span>` : ''}
                ${word.part ? `<span style="background: rgba(255,255,255,0.3); padding: 6px 12px; border-radius: 20px; font-size: 12px;">${word.part}</span>` : ''}
            </div>
        </div>
    `;

    // Gắn sự kiện cho các nút
    btnKeep.onclick = () => handleQuickDeleteKeep();
    btnRemove.onclick = () => handleQuickDeleteRemove(word.en);
}

/**
 * Xử lý khi nhấn nút "Giữ"
 */
function handleQuickDeleteKeep() {
    quickDeleteData.currentIndex++;
    showNextWord();
}

/**
 * Xử lý khi nhấn nút "Xóa" - XÓA NGAY LẬP TỨC
 */
async function handleQuickDeleteRemove(wordEn) {
    const card = document.getElementById("quick-delete-card");

    // Hiển thị trạng thái đang xóa
    card.innerHTML = `
        <div style="text-align: center;">
            <i class="fas fa-spinner fa-spin" style="font-size: 48px; margin-bottom: 20px;"></i>
            <p style="font-size: 16px; opacity: 0.9;">Đang xóa từ <strong>${wordEn}</strong>...</p>
        </div>
    `;

    try {
        const res = await fetch(`${API_URL}/vocabulary/${encodeURIComponent(wordEn)}`, {
            method: "DELETE",
        });

        const data = await res.json();

        if (data.success) {
            quickDeleteData.deletedCount++;
            // Xóa từ khỏi mảng
            quickDeleteData.allWords.splice(quickDeleteData.currentIndex, 1);
            // Không tăng currentIndex vì đã xóa phần tử
            showNextWord();
        } else {
            alert(`Lỗi khi xóa từ "${wordEn}": ${data.message || 'Unknown error'}`);
            quickDeleteData.currentIndex++;
            showNextWord();
        }
    } catch (error) {
        console.error("Error deleting word:", error);
        alert(`Lỗi kết nối khi xóa từ "${wordEn}"`);
        quickDeleteData.currentIndex++;
        showNextWord();
    }
}

/**
 * Kết thúc quá trình xóa nhanh
 */
function finishQuickDelete() {
    const card = document.getElementById("quick-delete-card");
    const { deletedCount } = quickDeleteData;

    card.innerHTML = `
        <div style="text-align: center;">
            <i class="fas fa-check-circle" style="font-size: 64px; margin-bottom: 20px; color: #10b981;"></i>
            <h3 style="font-size: 24px; margin-bottom: 10px;">Hoàn thành!</h3>
            <p style="font-size: 16px; opacity: 0.9;">
                Đã xóa <strong>${deletedCount}</strong> từ vựng
            </p>
            <button id="qd-done-btn"
                style="
                    margin-top: 20px;
                    padding: 12px 30px;
                    background: white;
                    color: #667eea;
                    border: none;
                    border-radius: 10px;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 14px;
                "
            >
                <i class="fas fa-sync"></i> Tải lại Dashboard
            </button>
        </div>
    `;

    document.getElementById('qd-done-btn')?.addEventListener('click', () => { stopQuickDelete(); loadDashboard(); });
    quickDeleteData.isRunning = false;
}

/**
 * Dừng quá trình xóa nhanh
 */
function stopQuickDelete() {
    const modal = document.getElementById("quick-delete-modal");
    modal.style.display = "none";
    quickDeleteData.isRunning = false;

    // Reload nếu đã xóa ít nhất 1 từ
    if (quickDeleteData.deletedCount > 0) {
        setTimeout(() => {
            loadVocabulary(vocabCurrentPage, vocabCurrentPart);
            loadVocabularyStats();
            loadRecentActivities();
        }, 100);
    }
}

// ===================================
// 7. VOCABULARY STATISTICS FUNCTIONS
// ===================================

/**
 * Load và hiển thị thống kê từ vựng theo Part
 */
async function loadVocabularyStats() { /* removed */ }

// ===================================
// 7.5 VOCABULARY FILE SWITCHER
// ===================================

let currentVocabFile = 'vocabulary.json';

/**
 * Load danh sách các file JSON có sẵn trong folder data (dynamic, from server)
 */
async function loadAvailableFiles() {
    // Update the hidden <select> for backward-compat code paths
    const selector = document.getElementById('vocab-file-selector');
    const pickerBtn   = document.getElementById('vocab-file-picker-btn');
    const pickerLabel = document.getElementById('vocab-file-picker-label');
    const pickerCards = document.getElementById('vocab-picker-cards');

    if (pickerCards) {
        pickerCards.innerHTML = '<div class="vocab-picker-loading"><i class="fas fa-spinner fa-spin"></i> Đang quét thư mục...</div>';
    }
    if (pickerBtn) pickerBtn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/vocabulary/files`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!data.success || !data.data?.length) {
            if (pickerCards) pickerCards.innerHTML = '<div class="vocab-picker-loading">Không tìm thấy file nào</div>';
            return;
        }

        // Render picker cards
        if (pickerCards) {
            pickerCards.innerHTML = '';
            // "Tất cả" card
            const allCard = document.createElement('div');
            allCard.className = `vocab-picker-card${!vocabCurrentSource ? ' active' : ''}`;
            allCard.dataset.source = '';
            allCard.innerHTML = `
                <div class="vocab-picker-card-left">
                    <div class="vocab-picker-card-name">Tất cả</div>
                    <div class="vocab-picker-card-count"><i class="fas fa-book-open" style="font-size:10px;margin-right:3px;"></i>Toàn bộ database</div>
                </div>
                <div class="vocab-picker-card-check"><i class="fas fa-check"></i></div>`;
            allCard.addEventListener('click', () => switchVocabSource('', 'Tất cả', allCard, pickerCards, pickerLabel));
            pickerCards.appendChild(allCard);

            data.data.forEach(file => {
                if (!file.source) return;
                const isActive = file.source === vocabCurrentSource;
                if (isActive && pickerLabel) pickerLabel.textContent = file.displayName || file.source;

                const card = document.createElement('div');
                card.className = `vocab-picker-card${isActive ? ' active' : ''}`;
                card.dataset.source = file.source;
                card.innerHTML = `
                    <div class="vocab-picker-card-left">
                        <div class="vocab-picker-card-name">${file.displayName || file.source}</div>
                        <div class="vocab-picker-card-count"><i class="fas fa-book-open" style="font-size:10px;margin-right:3px;"></i>${file.wordCount.toLocaleString()} từ</div>
                    </div>
                    <div class="vocab-picker-card-check"><i class="fas fa-check"></i></div>`;
                card.addEventListener('click', () => switchVocabSource(file.source, file.displayName || file.source, card, pickerCards, pickerLabel));
                pickerCards.appendChild(card);
            });

            // Set label for "Tất cả" if no source selected
            if (!vocabCurrentSource && pickerLabel) pickerLabel.textContent = 'Tất cả';
        }
    } catch (err) {
        console.error('Error loading available files:', err);
        if (pickerCards) pickerCards.innerHTML = '<div class="vocab-picker-loading">⚠ Không thể tải danh sách file</div>';
    } finally {
        if (pickerBtn) pickerBtn.disabled = false;
    }
}

/**
 * Switch vocab source filter
 */
async function switchVocabSource(source, label, clickedCard, pickerCards, pickerLabel) {
    const dropdown = document.getElementById('vocab-file-picker-dropdown');
    if (dropdown) dropdown.style.display = 'none';

    pickerCards.querySelectorAll('.vocab-picker-card').forEach(c => c.classList.remove('active'));
    clickedCard.classList.add('active');
    if (pickerLabel) pickerLabel.textContent = label;

    vocabCurrentSource = source;
    vocabCurrentPart = '';
    vocabCurrentPage = 1;
    vocabSearchTerm = '';

    const searchInput = document.getElementById('vocab-search');
    if (searchInput) searchInput.value = '';

    await loadVocabulary(1, '', source);
    await loadVocabularyStats();
    updateLocalPartFilter();
}

/**
 * Chuyển đổi sang file từ vựng khác (chỉ xem, không ghi đè)
 */
async function switchVocabularyFile(filename) {
    if (!filename || filename === currentVocabFile) return;

    const selector = document.getElementById('vocab-file-selector');

    try {
        // Show loading
        selector.disabled = true;

        // ✅ ALWAYS load local JSON file for search functionality
        console.log(`📂 Loading local file: ${filename}`);
        await loadLocalVocabulary(filename);

        // ✅ ALWAYS setup simple search
        initSimpleSearch();

        // Update display immediately with local data
        currentVocabFile = filename;
        currentLocalFile = filename;
        displayLocalVocabulary();

        // Try API if available
        try {
            const res = await fetch(`${API_URL}/vocabulary/switch/${encodeURIComponent(filename)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();

            if (data.success) {
                currentVocabFile = filename;
                currentLocalFile = filename;
                updateCurrentFileDisplay();

                // Reload vocabulary data from API
                await loadVocabulary(1, '');
                await loadVocabularyStats();
                await initializeVocabFilters();
            }
        } catch (apiError) {
            console.warn('API not available, using local data:', apiError.message);
            // API failed - use local data instead
            isOfflineMode = true;
            currentVocabFile = filename;
            currentLocalFile = filename;
            updateCurrentFileDisplay();
            displayLocalVocabulary();
            updateLocalStats();
            updateLocalPartFilter();
        }
    } catch (error) {
        console.error('Error switching file:', error);
        alert(`❌ Lỗi: ${error.message}`);
        selector.value = currentVocabFile;
    } finally {
        selector.disabled = false;
    }
}

/**
 * Cập nhật hiển thị file hiện tại trong Server Info
 */
function updateCurrentFileDisplay() {
    const display = document.getElementById('current-vocab-file');
    if (display) {
        display.textContent = currentVocabFile;
    }
}

// ===================================
// 8. ACTIVITY LOG FUNCTIONS
// ===================================

/**
 * Load và hiển thị hoạt động gần đây
 */
async function loadRecentActivities() {
    const container = document.getElementById('recent-activity-container');

    try {
        const res = await fetch(`${API_URL}/activities?limit=15`);
        const data = await res.json();

        if (data.success && data.data && data.data.length > 0) {
            displayRecentActivities(data.data);
        } else {
            container.innerHTML = `
                <div style="text-align: center; color: #999; padding: 20px; font-size: 13px;">
                    <i class="fas fa-info-circle"></i> Chưa có hoạt động nào được ghi nhận
                </div>
            `;
        }
    } catch (error) {
        console.error("Error loading recent activities:", error);
        if (container) container.innerHTML = `
            <div style="text-align: center; color: #e74c3c; padding: 20px; font-size: 13px;">
                <i class="fas fa-exclamation-triangle"></i> Không thể tải lịch sử hoạt động
            </div>
        `;
    }
}

/**
 * Hiển thị danh sách hoạt động gần đây
 */
function displayRecentActivities(activities) {
    const container = document.getElementById('recent-activity-container');
    if (!container) return;

    const getActivityIcon = (type, action) => {
        if (type === 'vocabulary') {
            if (action === 'add') return { icon: 'fa-plus-circle', color: '#10b981' };
            if (action === 'update') return { icon: 'fa-edit', color: '#3b82f6' };
            if (action === 'delete') return { icon: 'fa-trash', color: '#ef4444' };
        } else if (type === 'user') {
            if (action === 'add') return { icon: 'fa-user-plus', color: '#10b981' };
            if (action === 'update') return { icon: 'fa-user-edit', color: '#3b82f6' };
            if (action === 'delete') return { icon: 'fa-user-minus', color: '#ef4444' };
        }
        return { icon: 'fa-info-circle', color: '#999' };
    };

    const getActionText = (type, action, data) => {
        if (type === 'vocabulary') {
            const word = data.word || 'từ vựng';
            const part = data.part ? ` (${data.part})` : '';
            if (action === 'add') return `Thêm từ <strong>${word}</strong>${part}`;
            if (action === 'update') return `Cập nhật từ <strong>${word}</strong>${part}`;
            if (action === 'delete') return `Xóa từ <strong>${word}</strong>${part}`;
        } else if (type === 'user') {
            const username = data.username || 'người dùng';
            const role = data.role ? ` (${data.role})` : '';
            if (action === 'add') return `Thêm tài khoản <strong>${username}</strong>${role}`;
            if (action === 'update') return `Cập nhật tài khoản <strong>${username}</strong>${role}`;
            if (action === 'delete') return `Xóa tài khoản <strong>${username}</strong>${role}`;
        }
        return 'Hoạt động không xác định';
    };

    const getTimeAgo = (timestamp) => {
        const now = new Date();
        const then = new Date(timestamp);
        const seconds = Math.floor((now - then) / 1000);

        if (seconds < 60) return 'vừa xong';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
        return `${Math.floor(seconds / 86400)} ngày trước`;
    };

    let html = '<div style="font-size: 13px;">';

    activities.forEach((activity, index) => {
        const { icon, color } = getActivityIcon(activity.type, activity.action);
        const actionText = getActionText(activity.type, activity.action, activity.data);
        const timeAgo = getTimeAgo(activity.timestamp);

        html += `
            <div style="
                padding: 10px 12px;
                border-bottom: 1px solid #f0f0f0;
                transition: background 0.2s;
                ${index === activities.length - 1 ? 'border-bottom: none;' : ''}
            "
            onmouseover="this.style.background='#f8f9fa'"
            onmouseout="this.style.background='transparent'">
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <div style="flex-shrink: 0; margin-top: 2px;">
                        <i class="fas ${icon}" style="color: ${color}; font-size: 16px;"></i>
                    </div>
                    <div style="flex: 1;">
                        <div style="color: #333; line-height: 1.4; margin-bottom: 3px;">
                            ${actionText}
                        </div>
                        <div style="color: #999; font-size: 11px; display: flex; align-items: center; gap: 8px;">
                            <span><i class="fas fa-clock" style="font-size: 10px;"></i> ${timeAgo}</span>
                            ${activity.admin ? `<span><i class="fas fa-user-shield" style="font-size: 10px;"></i> ${activity.admin}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// ===================================
// 10. TOEIC ADMIN FUNCTIONS
// ===================================

const TOEIC_API_BASE = '/api/toeic';
let currentQuestions = [];
let allQuestions = []; // Store all questions for filtering
let currentTests = [];
let allTests = []; // Store all tests for filtering
let currentUsers = [];
let allUsers = []; // Store all users for filtering
let lastSelectedPart = null; // Remember last selected part for quick adding

// Highlight state tracking
let highlightedQuestionId = null; // Currently highlighted question
let previouslyViewedQuestionIds = new Set(); // Previously viewed questions

// Search & Filter state
let searchFilters = {
    searchText: '',
    part: '',
    sortBy: 'newest'
};

let userFilters = {
    searchText: '',
    role: '',
    status: ''
};

let testFilters = {
    searchText: '',
    type: '',
    sortBy: 'newest'
};

/**
 * Initialize main tab navigation (sidebar links)
 */
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
        // Update sidebar active state
        sidebarLinks.forEach(l => l.classList.remove('active'));
        const activeLink = document.querySelector(`.sidebar-link[data-main-tab="${tab}"]`);
        if (activeLink) activeLink.classList.add('active');

        // Update tab content
        document.querySelectorAll('.main-tab-content').forEach(t => t.classList.remove('active'));
        const panel = document.getElementById(`main-tab-${tab}`);
        if (panel) panel.classList.add('active');

        // Update topbar title
        const titleEl = document.getElementById('topbar-title');
        if (titleEl) titleEl.textContent = TAB_TITLES[tab] || tab;

        // Load data for the tab
        if (tab === 'topics') {
            loadTopicsTab();
        } else if (tab === 'vocabulary') {
            loadAvailableFiles(); // re-scan folder each time tab is opened
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

        // Stop polling when leaving monitor tab
        if (tab !== 'monitor') stopMetricsPolling();

        // Auto-close sidebar on mobile after selection
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

    // Sidebar toggle button (topbar)
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

    // Open sidebar by default on desktop
    if (window.innerWidth > 900) {
        expandSidebar();
    }
}

/**
 * Load TOEIC statistics for the stats cards
 */
async function loadToeicStats() {
    try {
        const [testsRes, questionsRes] = await Promise.all([
            fetch(`${TOEIC_API_BASE}/tests`,     { headers: { 'Authorization': `Bearer ${getToken()}` } }),
            fetch(`${TOEIC_API_BASE}/questions`, { headers: { 'Authorization': `Bearer ${getToken()}` } }),
        ]);

        const testsData = await testsRes.json();
        await questionsRes.json(); // fetched for future use

        // Update overview stat card
        const testsEl = document.getElementById('toeic-tests-count');
        if (testsEl) {
            testsEl.textContent = testsData.data?.length ?? testsData.count ?? '-';
        }
    } catch (error) {
        console.error('Error loading TOEIC stats:', error);
    }
}

function getToken() {
    // Use separate key for admin authentication
    const tokenObj = localStorage.getItem('adminAuthToken');
    if (tokenObj) {
        try {
            const parsed = JSON.parse(tokenObj);
            return parsed.token || '';
        } catch (e) {
            // If not JSON, treat as plain string
            return tokenObj || '';
        }
    }
    return '';
}

// Pagination state
let questionsPagination = {
    currentPage: 1,
    totalPages: 1,
    limit: 15,
    total: 0,
    filterPart: ''
};

let testsPagination = {
    currentPage: 1,
    totalPages: 1,
    limit: 15,
    total: 0
};

let usersPagination = {
    currentPage: 1,
    totalPages: 1,
    limit: 15,
    total: 0
};

/**
 * Universal Pagination Renderer
 * @param {string} containerId - ID of the pagination container
 * @param {object} paginationState - Pagination state object {currentPage, totalPages, total}
 * @param {function} onPageChange - Callback function when page changes
 * @param {string} itemName - Name of items (e.g., "questions", "tests", "users")
 */
function renderPagination(containerId, paginationState, onPageChange, itemName = 'items') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { currentPage, totalPages, total } = paginationState;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    const startItem = (currentPage - 1) * paginationState.limit + 1;
    const endItem = Math.min(currentPage * paginationState.limit, total);

    // Generate page numbers with smart ellipsis
    let pageNumbers = '';
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages + 2) {
        // Show all pages if total is small
        for (let i = 1; i <= totalPages; i++) {
            pageNumbers += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-secondary'} pagination-page" data-page="${i}">${i}</button>`;
        }
    } else {
        // Always show first page
        pageNumbers += `<button class="btn btn-sm ${1 === currentPage ? 'btn-primary' : 'btn-secondary'} pagination-page" data-page="1">1</button>`;

        // Calculate range around current page
        let start = Math.max(2, currentPage - 1);
        let end = Math.min(totalPages - 1, currentPage + 1);

        // Adjust if near start or end
        if (currentPage <= 3) {
            end = Math.min(4, totalPages - 1);
        } else if (currentPage >= totalPages - 2) {
            start = Math.max(totalPages - 3, 2);
        }

        // Add ellipsis before middle pages if needed
        if (start > 2) {
            pageNumbers += `<span style="padding: 0 8px; color: #999;">...</span>`;
        }

        // Add middle pages
        for (let i = start; i <= end; i++) {
            pageNumbers += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-secondary'} pagination-page" data-page="${i}">${i}</button>`;
        }

        // Add ellipsis after middle pages if needed
        if (end < totalPages - 1) {
            pageNumbers += `<span style="padding: 0 8px; color: #999;">...</span>`;
        }

        // Always show last page
        pageNumbers += `<button class="btn btn-sm ${totalPages === currentPage ? 'btn-primary' : 'btn-secondary'} pagination-page" data-page="${totalPages}">${totalPages}</button>`;
    }

    let paginationHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; flex-wrap: wrap;">
            <div style="color: #666; font-size: 14px;">
                Showing ${startItem} to ${endItem} of ${total} ${itemName}
            </div>
            <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
                <button class="btn btn-sm btn-secondary pagination-first" ${currentPage === 1 ? 'disabled' : ''} title="First Page">
                    <i class="fas fa-angle-double-left"></i>
                </button>
                <button class="btn btn-sm btn-secondary pagination-prev" ${currentPage === 1 ? 'disabled' : ''} title="Previous">
                    <i class="fas fa-chevron-left"></i>
                </button>
                ${pageNumbers}
                <button class="btn btn-sm btn-secondary pagination-next" ${currentPage === totalPages ? 'disabled' : ''} title="Next">
                    <i class="fas fa-chevron-right"></i>
                </button>
                <button class="btn btn-sm btn-secondary pagination-last" ${currentPage === totalPages ? 'disabled' : ''} title="Last Page">
                    <i class="fas fa-angle-double-right"></i>
                </button>
            </div>
        </div>
    `;

    container.innerHTML = paginationHTML;

    // Add event listeners
    const firstBtn = container.querySelector('.pagination-first');
    const prevBtn = container.querySelector('.pagination-prev');
    const nextBtn = container.querySelector('.pagination-next');
    const lastBtn = container.querySelector('.pagination-last');

    if (firstBtn && !firstBtn.disabled) {
        firstBtn.addEventListener('click', () => onPageChange(1));
    }

    if (prevBtn && !prevBtn.disabled) {
        prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
    }

    if (nextBtn && !nextBtn.disabled) {
        nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
    }

    if (lastBtn && !lastBtn.disabled) {
        lastBtn.addEventListener('click', () => onPageChange(totalPages));
    }

    // Add event listeners for page number buttons
    container.querySelectorAll('.pagination-page').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page !== currentPage) {
                onPageChange(page);
            }
        });
    });
}

/**
 * Load TOEIC Questions
 */
async function loadQuestions(filterPart = '', _page = 1) {
    try {
        questionsPagination.filterPart = filterPart;

        // Load ALL questions for client-side filtering (remove pagination for now)
        let url = `${TOEIC_API_BASE}/questions?limit=1000`; // Get all questions

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to load questions');
        }

        allQuestions = data.data || [];
        currentQuestions = [...allQuestions];

        // Initialize search/filter controls (only once)
        if (!window.searchFiltersInitialized) {
            initSearchAndFilters();
            window.searchFiltersInitialized = true;
        }

        // Apply current filters and sort
        applyFiltersAndSort();

    } catch (error) {
        console.error('Error loading questions:', error);
        const tbody = document.querySelector('#questions-table tbody');
        tbody.innerHTML = `
            <tr><td colspan="7" class="loading" style="color: red;">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading questions</p>
            </td></tr>
        `;
    }
}

/**
 * Render Questions Table
 */
function renderQuestionsTable() {
    const tbody = document.querySelector('#questions-table tbody');

    if (currentQuestions.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="9" class="loading">
                <i class="fas fa-inbox"></i>
                <p>No questions found</p>
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = currentQuestions.map(q => {
        // Format image URL display
        let imageDisplay = '-';
        if (q.imageUrl) {
            const imagePath = q.imageUrl.replace('/assets/images/', '');
            imageDisplay = `<span style="color: #3498db; font-size: 0.85em; font-family: monospace;" title="${q.imageUrl}">${truncate(imagePath, 20)}</span>`;
        }

        // Format audio URL display
        let audioDisplay = '-';
        if (q.audioUrl) {
            const audioPath = q.audioUrl.replace('/assets/audio/', '');
            audioDisplay = `<span style="color: #e67e22; font-size: 0.85em; font-family: monospace;" title="${q.audioUrl}">${truncate(audioPath, 20)}</span>`;
        }

        // Format keywords display
        let keywordsDisplay = '-';
        let keywordsTitle = '';
        if (q.questionKeyword || q.answerKeyword || q.audioKeyword) {
            const keywords = [];
            const keywordsTitleParts = [];
            // Part 1-2: questionKeyword + answerKeyword
            if (q.questionKeyword) {
                keywords.push(`<span style="color: #667eea;">Q: ${truncate(q.questionKeyword, 10)}</span>`);
                keywordsTitleParts.push(`Question: ${q.questionKeyword}`);
            }
            if (q.answerKeyword) {
                keywords.push(`<span style="color: #10b981;">A: ${truncate(q.answerKeyword, 10)}</span>`);
                keywordsTitleParts.push(`Answer: ${q.answerKeyword}`);
            }
            // Part 3-4: audioKeyword
            if (q.audioKeyword) {
                keywords.push(`<span style="color: #764ba2;">Au: ${truncate(q.audioKeyword, 10)}</span>`);
                keywordsTitleParts.push(`Audio: ${q.audioKeyword}`);
            }
            keywordsDisplay = keywords.join('<br>');
            keywordsTitle = keywordsTitleParts.join(' | ');
        }

        // Full text for title tooltip
        const questionTextFull = q.questionText || 'N/A';

        return `
            <tr>
                <td><span class="part-badge">Part ${q.part}</span></td>
                <td title="${questionTextFull.replace(/"/g, '&quot;')}">${truncate(questionTextFull, 50)}</td>
                <td style="text-align: center; font-weight: 600; color: #667eea;">${q.correctAnswer}</td>
                <td style="text-align: center; font-size: 0.85em;" title="${keywordsTitle}">${keywordsDisplay}</td>
                <td style="text-align: center;" title="${q.imageUrl || ''}">${imageDisplay}</td>
                <td style="text-align: center;" title="${q.audioUrl || ''}">${audioDisplay}</td>
                <td style="text-align: center;">${q.timesUsed || 0}</td>
                <td style="text-align: center; font-size: 0.85em; color: #666;">${q.createdAt ? new Date(q.createdAt).toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                <td>
                    <button class="btn btn-info btn-sm btn-preview-question" data-question-id="${q._id}" title="Preview">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-primary btn-sm btn-edit-question" data-question-id="${q._id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm btn-delete-question" data-question-id="${q._id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Attach event listeners after rendering
    tbody.querySelectorAll('.btn-preview-question').forEach(btn => {
        btn.addEventListener('click', () => {
            const questionId = btn.getAttribute('data-question-id');
            // Highlight the row
            highlightQuestionRow(btn);
            previewQuestion(questionId);
        });
    });

    tbody.querySelectorAll('.btn-edit-question').forEach(btn => {
        btn.addEventListener('click', () => {
            const questionId = btn.getAttribute('data-question-id');
            // Highlight the row
            highlightQuestionRow(btn);
            editQuestion(questionId);
        });
    });

    tbody.querySelectorAll('.btn-delete-question').forEach(btn => {
        btn.addEventListener('click', () => {
            const questionId = btn.getAttribute('data-question-id');
            deleteQuestion(questionId);
        });
    });

    // Restore highlights after rendering
    restoreHighlights();
}

/**
 * Highlight question row when viewing/editing
 */
function highlightQuestionRow(button) {
    const questionId = button.getAttribute('data-question-id');
    console.log('🎯 Highlight clicked:', questionId);

    // Move previous highlighted to "previously viewed" (blue)
    if (highlightedQuestionId && highlightedQuestionId !== questionId) {
        previouslyViewedQuestionIds.add(highlightedQuestionId);
        console.log('➕ Added to previously viewed:', highlightedQuestionId);
    }

    // Set new highlighted question (orange)
    highlightedQuestionId = questionId;
    console.log('✨ New highlighted:', highlightedQuestionId);
    console.log('📋 Previously viewed:', Array.from(previouslyViewedQuestionIds));

    // Apply visual highlights
    restoreHighlights();
}

/**
 * Restore highlights after table re-render
 */
function restoreHighlights() {
    console.log('🔄 Restoring highlights...');

    // Remove all highlights first
    document.querySelectorAll('#questions-tbody tr').forEach(row => {
        row.classList.remove('row-highlighted', 'row-previously-viewed');
    });

    // Restore previously viewed (blue)
    previouslyViewedQuestionIds.forEach(id => {
        const button = document.querySelector(`[data-question-id="${id}"]`);
        const row = button?.closest('tr');
        if (row) {
            row.classList.add('row-previously-viewed');
            console.log('💙 Added blue to:', id);
        } else {
            console.log('❌ Row not found for:', id);
        }
    });

    // Restore current highlight (orange) - on top of previously viewed
    if (highlightedQuestionId) {
        const button = document.querySelector(`[data-question-id="${highlightedQuestionId}"]`);
        const row = button?.closest('tr');
        if (row) {
            row.classList.remove('row-previously-viewed');
            row.classList.add('row-highlighted');
            console.log('🧡 Added orange to:', highlightedQuestionId, row);
        } else {
            console.log('❌ Row not found for highlighted:', highlightedQuestionId);
        }
    }
}

/**
 * Initialize Search & Filter Controls
 */
function initSearchAndFilters() {
    const searchInput = document.getElementById('question-search');
    const filterPart = document.getElementById('filter-part');
    const sortBy = document.getElementById('sort-by');
    const clearFiltersBtn = document.getElementById('clear-filters');

    // Search input with debounce
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchFilters.searchText = e.target.value.toLowerCase();
                applyFiltersAndSort();
            }, 300);
        });
    }

    // Part filter
    if (filterPart) {
        filterPart.addEventListener('change', (e) => {
            searchFilters.part = e.target.value;
            applyFiltersAndSort();
        });
    }

    // Sort by
    if (sortBy) {
        sortBy.addEventListener('change', (e) => {
            searchFilters.sortBy = e.target.value;
            applyFiltersAndSort();
        });
    }

    // Clear filters button
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            searchFilters = {
                searchText: '',
                part: '',
                sortBy: 'newest'
            };
            if (searchInput) searchInput.value = '';
            if (filterPart) filterPart.value = '';
            if (sortBy) sortBy.value = 'newest';
            applyFiltersAndSort();
        });
    }
}

/**
 * Apply filters and sort to questions
 */
function applyFiltersAndSort() {
    let filtered = [...allQuestions];

    // Apply search filter
    if (searchFilters.searchText) {
        filtered = filtered.filter(q => {
            const searchText = searchFilters.searchText;
            return (
                (q.questionText && q.questionText.toLowerCase().includes(searchText)) ||
                (q.passage && q.passage.toLowerCase().includes(searchText)) ||
                (q.explanation && q.explanation.toLowerCase().includes(searchText)) ||
                (q.options && q.options.some(opt => opt.toLowerCase().includes(searchText)))
            );
        });
    }

    // Apply part filter
    if (searchFilters.part) {
        filtered = filtered.filter(q => q.part === parseInt(searchFilters.part));
    }

    // Apply sorting
    switch (searchFilters.sortBy) {
        case 'newest':
            filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            break;
        case 'oldest':
            filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
            break;
        case 'most-used':
            filtered.sort((a, b) => (b.timesUsed || 0) - (a.timesUsed || 0));
            break;
        case 'least-used':
            filtered.sort((a, b) => (a.timesUsed || 0) - (b.timesUsed || 0));
            break;
        case 'part-asc':
            filtered.sort((a, b) => a.part - b.part);
            break;
        case 'part-desc':
            filtered.sort((a, b) => b.part - a.part);
            break;
    }

    // Update pagination info
    questionsPagination.total = filtered.length;
    questionsPagination.totalPages = Math.ceil(filtered.length / questionsPagination.limit);

    // Ensure current page is valid
    if (questionsPagination.currentPage > questionsPagination.totalPages) {
        questionsPagination.currentPage = 1;
    }

    // Calculate start and end indices for current page
    const start = (questionsPagination.currentPage - 1) * questionsPagination.limit;
    const end = start + questionsPagination.limit;

    // Update current questions with paginated results
    currentQuestions = filtered.slice(start, end);

    // Render table and pagination
    renderQuestionsTable();
    renderPagination('questions-pagination', questionsPagination, (page) => {
        questionsPagination.currentPage = page;
        applyFiltersAndSort();
        document.querySelector('#questions-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 'questions');
    updateFilterResults();
}

/**
 * Update filter results info
 */
function updateFilterResults() {
    const filteredCount = document.getElementById('filtered-count');
    const totalCount = document.getElementById('total-count');

    if (filteredCount) filteredCount.textContent = currentQuestions.length;
    if (totalCount) totalCount.textContent = allQuestions.length;
}

/**
 * Initialize Users Search & Filter Controls
 */
function initUserSearchAndFilters() {
    const searchInput = document.getElementById('user-search');
    const filterRole = document.getElementById('filter-user-role');
    const filterStatus = document.getElementById('filter-user-status');
    const clearFiltersBtn = document.getElementById('clear-user-filters');

    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                userFilters.searchText = e.target.value.toLowerCase();
                applyUserFilters();
            }, 300);
        });
    }

    if (filterRole) {
        filterRole.addEventListener('change', (e) => {
            userFilters.role = e.target.value;
            applyUserFilters();
        });
    }

    if (filterStatus) {
        filterStatus.addEventListener('change', (e) => {
            userFilters.status = e.target.value;
            applyUserFilters();
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            userFilters = { searchText: '', role: '', status: '' };
            if (searchInput) searchInput.value = '';
            if (filterRole) filterRole.value = '';
            if (filterStatus) filterStatus.value = '';
            applyUserFilters();
        });
    }
}

/**
 * Apply user filters
 */
function applyUserFilters() {
    let filtered = [...allUsers];

    // Apply search filter
    if (userFilters.searchText) {
        filtered = filtered.filter(u => {
            const searchText = userFilters.searchText;
            return (
                (u.username && u.username.toLowerCase().includes(searchText)) ||
                (u.email && u.email.toLowerCase().includes(searchText))
            );
        });
    }

    // Apply role filter
    if (userFilters.role) {
        filtered = filtered.filter(u => u.role === userFilters.role);
    }

    // Apply status filter
    if (userFilters.status) {
        const isActive = userFilters.status === 'active';
        filtered = filtered.filter(u => u.isActive === isActive);
    }

    currentUsers = filtered;
    displayUsersInTab(currentUsers);
    updateUserFilterResults();
}

/**
 * Update user filter results info
 */
function updateUserFilterResults() {
    const filteredCount = document.getElementById('user-filtered-count');
    const totalCount = document.getElementById('user-total-count');

    if (filteredCount) filteredCount.textContent = currentUsers.length;
    if (totalCount) totalCount.textContent = allUsers.length;
}

/**
 * Initialize Tests Search & Filter Controls
 */
function initTestSearchAndFilters() {
    const searchInput = document.getElementById('test-search');
    const filterType = document.getElementById('filter-test-type');
    const sortBy = document.getElementById('test-sort-by');
    const clearFiltersBtn = document.getElementById('clear-test-filters');

    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                testFilters.searchText = e.target.value.toLowerCase();
                applyTestFilters();
            }, 300);
        });
    }

    if (filterType) {
        filterType.addEventListener('change', (e) => {
            testFilters.type = e.target.value;
            applyTestFilters();
        });
    }

    if (sortBy) {
        sortBy.addEventListener('change', (e) => {
            testFilters.sortBy = e.target.value;
            applyTestFilters();
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            testFilters = { searchText: '', type: '', sortBy: 'newest' };
            if (searchInput) searchInput.value = '';
            if (filterType) filterType.value = '';
            if (sortBy) sortBy.value = 'newest';
            applyTestFilters();
        });
    }
}

/**
 * Apply test filters and sort
 */
function applyTestFilters() {
    let filtered = [...allTests];

    // Apply search filter
    if (testFilters.searchText) {
        filtered = filtered.filter(t => {
            const searchText = testFilters.searchText;
            return t.testName && t.testName.toLowerCase().includes(searchText);
        });
    }

    // Apply type filter
    if (testFilters.type) {
        filtered = filtered.filter(t => t.type === testFilters.type);
    }

    // Apply sorting
    switch (testFilters.sortBy) {
        case 'newest':
            filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            break;
        case 'oldest':
            filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
            break;
        case 'most-attempts':
            filtered.sort((a, b) => (b.attempts || 0) - (a.attempts || 0));
            break;
        case 'highest-score':
            filtered.sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));
            break;
        case 'lowest-score':
            filtered.sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0));
            break;
    }

    // Update pagination info
    testsPagination.total = filtered.length;
    testsPagination.totalPages = Math.ceil(filtered.length / testsPagination.limit);

    // Ensure current page is valid
    if (testsPagination.currentPage > testsPagination.totalPages) {
        testsPagination.currentPage = 1;
    }

    // Calculate start and end indices for current page
    const start = (testsPagination.currentPage - 1) * testsPagination.limit;
    const end = start + testsPagination.limit;

    // Update current tests with paginated results
    currentTests = filtered.slice(start, end);

    // Render table and pagination
    renderTestsTable();
    renderPagination('tests-pagination', testsPagination, (page) => {
        testsPagination.currentPage = page;
        applyTestFilters();
        document.querySelector('#tests-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 'tests');
    updateTestFilterResults();
}

/**
 * Update test filter results info
 */
function updateTestFilterResults() {
    const filteredCount = document.getElementById('test-filtered-count');
    const totalCount = document.getElementById('test-total-count');

    if (filteredCount) filteredCount.textContent = currentTests.length;
    if (totalCount) totalCount.textContent = allTests.length;
}

/**
 * Load TOEIC Tests
 */
async function loadTests() {
    try {
        const res = await fetch(`${TOEIC_API_BASE}/tests`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to load tests');
        }

        allTests = data.data || [];
        currentTests = [...allTests];

        // Initialize search/filter controls (only once)
        if (!window.testFiltersInitialized) {
            initTestSearchAndFilters();
            window.testFiltersInitialized = true;
        }

        applyTestFilters();
    } catch (error) {
        console.error('Error loading tests:', error);
        const tbody = document.querySelector('#tests-table tbody');
        tbody.innerHTML = `
            <tr><td colspan="7" class="loading" style="color: red;">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading tests</p>
            </td></tr>
        `;
    }
}

/**
 * Render Tests Table
 */
function renderTestsTable() {
    const tbody = document.querySelector('#tests-table tbody');

    if (currentTests.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" class="loading">
                <i class="fas fa-inbox"></i>
                <p>No tests found</p>
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = currentTests.map(t => {
        const isPublished = t.isPublished;
        const hasQuestions = t.totalQuestions > 0;
        const statusBadge = isPublished
            ? '<span class="badge success">Published</span>'
            : '<span class="badge" style="background: #ffc107; color: #000;">Draft</span>';
        const questionWarning = !hasQuestions
            ? '<span style="color: #ff6b6b; font-size: 11px;"><i class="fas fa-exclamation-triangle"></i> No questions</span>'
            : '';

        return `
        <tr>
            <td>
                ${t.testName}
                <br>${statusBadge} ${questionWarning}
            </td>
            <td><span class="badge">${formatTestType(t.testType)}</span></td>
            <td style="text-align: center;">
                <strong>${t.randomQuestionCount || t.totalQuestions}</strong>
                ${hasQuestions ? '' : '<br><small style="color: #ff6b6b;">Empty</small>'}
            </td>
            <td style="text-align: center;">${Math.round(t.totalTime / 60)}</td>
            <td style="text-align: center;">${t.attemptCount || 0}</td>
            <td style="text-align: center;">${t.averageScore ? Math.round(t.averageScore) : '-'}</td>
            <td>
                <button class="btn btn-primary btn-sm btn-edit-test" data-test-id="${t._id}" title="Edit Test" style="margin-right: 5px;">
                    <i class="fas fa-edit"></i> Edit
                </button>
                ${!isPublished && hasQuestions ? `
                    <button class="btn btn-success btn-sm btn-publish-test" data-test-id="${t._id}" data-action="publish" title="Publish Test" style="margin-right: 5px;">
                        <i class="fas fa-check-circle"></i> Publish
                    </button>
                ` : ''}
                ${isPublished ? `
                    <button class="btn btn-warning btn-sm btn-unpublish-test" data-test-id="${t._id}" data-action="unpublish" title="Unpublish Test" style="margin-right: 5px;">
                        <i class="fas fa-eye-slash"></i> Unpublish
                    </button>
                ` : ''}
                <button class="btn btn-danger btn-sm btn-delete-test" data-test-id="${t._id}" title="Delete Test">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </td>
        </tr>
        `;
    }).join('');

    // Attach event listeners after rendering
    tbody.querySelectorAll('.btn-edit-test').forEach(btn => {
        btn.addEventListener('click', () => {
            const testId = btn.getAttribute('data-test-id');
            editTest(testId);
        });
    });

    tbody.querySelectorAll('.btn-publish-test').forEach(btn => {
        btn.addEventListener('click', () => {
            const testId = btn.getAttribute('data-test-id');
            publishTest(testId, true);
        });
    });

    tbody.querySelectorAll('.btn-unpublish-test').forEach(btn => {
        btn.addEventListener('click', () => {
            const testId = btn.getAttribute('data-test-id');
            publishTest(testId, false);
        });
    });

    tbody.querySelectorAll('.btn-delete-test').forEach(btn => {
        btn.addEventListener('click', () => {
            const testId = btn.getAttribute('data-test-id');
            deleteTest(testId);
        });
    });
}

function formatTestType(type) {
    const types = {
        'full-test': 'Full Test',
        'mini-part1': 'Part 1 Mini',
        'mini-part2': 'Part 2 Mini',
        'mini-part3': 'Part 3 Mini',
        'mini-part4': 'Part 4 Mini',
        'mini-part5': 'Part 5 Mini',
        'mini-part6': 'Part 6 Mini',
        'mini-part7': 'Part 7 Mini',
    };
    return types[type] || type;
}

/**
 * Update Part Visibility in Question Form
 */
function updatePartVisibility() {
    const part = parseInt(document.getElementById('question-part').value);

    // Question Text field - Show for Part 2-7 (Part 1 is photo description, doesn't need question text)
    const questionTextField = document.getElementById('question-text-field');
    if (part >= 2) {
        questionTextField.style.display = 'block';
    } else {
        questionTextField.style.display = 'none';
    }

    // Audio text - Only for Part 3-4 (Part 1-2 only need audio file, no text)
    const audioField = document.getElementById('audio-text-field');
    if (part === 3 || part === 4) {
        audioField.style.display = 'block';
    } else {
        audioField.style.display = 'none';
    }

    // Audio file upload - For all listening parts (1-4)
    const audioFileField = document.getElementById('audio-file-field');
    if (part >= 1 && part <= 4) {
        audioFileField.style.display = 'block';
    } else {
        audioFileField.style.display = 'none';
    }

    // Passage for reading parts (6-7)
    const passageField = document.getElementById('passage-field');
    if (part === 6 || part === 7) {
        passageField.style.display = 'block';
    } else {
        passageField.style.display = 'none';
    }

    // Image upload for Part 1 only
    const imageField = document.getElementById('image-url-field');
    if (part === 1) {
        imageField.style.display = 'block';
    } else {
        imageField.style.display = 'none';
    }

    // Keyword fields for fill-in-blank
    // Part 1-2: questionKeyword + answerKeyword (blank in displayed text)
    // Part 3-4: audioKeyword (blank in audio transcript)
    const keywordFieldPart12 = document.getElementById('keyword-field-part12');
    const keywordFieldPart34 = document.getElementById('keyword-field-part34');

    if (keywordFieldPart12) {
        keywordFieldPart12.style.display = (part === 1 || part === 2) ? 'block' : 'none';
    }
    if (keywordFieldPart34) {
        keywordFieldPart34.style.display = (part === 3 || part === 4) ? 'block' : 'none';
    }
}

/**
 * Open Question Modal
 */
function openQuestionModal(questionId = null) {
    const modal = document.getElementById('question-modal');
    const form = document.getElementById('question-form');
    const title = document.getElementById('question-modal-title');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const audioPreview = document.getElementById('audio-preview');
    const previewAudio = document.getElementById('preview-audio');

    // Reset form
    form.reset();
    document.getElementById('question-id').value = '';

    // Reset image preview
    imagePreview.style.display = 'none';
    previewImg.src = '';

    // Reset audio preview
    audioPreview.style.display = 'none';
    previewAudio.src = '';

    if (questionId) {
        // Edit mode
        title.textContent = 'Edit Question';
        const question = currentQuestions.find(q => q._id === questionId);
        if (question) {
            document.getElementById('question-id').value = question._id;
            document.getElementById('question-part').value = question.part;
            document.getElementById('question-text').value = question.questionText || '';
            document.getElementById('question-audio-text').value = question.audioText || '';
            document.getElementById('question-passage').value = question.passage || '';
            document.getElementById('question-image-url').value = question.imageUrl || '';
            document.getElementById('question-audio-url').value = question.audioUrl || '';
            document.getElementById('question-explanation').value = question.explanation || '';

            // Set keyword fields for Part 1-2
            document.getElementById('question-keyword').value = question.questionKeyword || '';
            document.getElementById('answer-keyword').value = question.answerKeyword || '';

            // Set keyword field for Part 3-4
            const audioKeywordInput = document.getElementById('audio-keyword');
            if (audioKeywordInput) {
                audioKeywordInput.value = question.audioKeyword || '';
            }

            // Show existing image if available
            if (question.imageUrl) {
                previewImg.src = question.imageUrl;
                imagePreview.style.display = 'block';
            }

            // Show existing audio if available
            if (question.audioUrl) {
                previewAudio.src = question.audioUrl;
                audioPreview.style.display = 'block';
            }

            // Set options
            question.options.forEach((opt, idx) => {
                const label = String.fromCharCode(65 + idx); // A, B, C, D
                document.getElementById(`option-${label}`).value = opt.text;
                if (opt.label === question.correctAnswer) {
                    document.getElementById(`correct-${label}`).checked = true;
                }
            });

            updatePartVisibility();
        }
    } else {
        // Add mode
        title.textContent = 'Add Question';

        // Restore last selected part if available
        if (lastSelectedPart !== null) {
            document.getElementById('question-part').value = lastSelectedPart;
            updatePartVisibility();
        }
    }

    modal.style.display = 'flex';
}

function closeQuestionModal() {
    document.getElementById('question-modal').style.display = 'none';
    // Keep highlight when closing modal (don't clear)
}

/**
 * Preview Question (show as user would see it)
 */
function previewQuestion(questionId) {
    const question = currentQuestions.find(q => q._id === questionId);
    if (!question) {
        alert('Question not found!');
        return;
    }

    // Create preview modal if it doesn't exist
    let modal = document.getElementById('preview-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'preview-modal';
        modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 2000; align-items: center; justify-content: center;';
        document.body.appendChild(modal);
    }

    // Build preview HTML
    let html = `
        <div style="background: white; border-radius: 15px; padding: 30px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; position: relative;">
            <button id="close-preview-btn" style="position: absolute; top: 15px; right: 15px; background: #e0e0e0; border: none; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; font-size: 20px;">×</button>

            <h3 style="margin-bottom: 20px; color: #667eea;">
                <i class="fas fa-eye"></i> Preview - Part ${question.part}
            </h3>
    `;

    // Image (Part 1)
    if (question.part === 1 && question.imageUrl) {
        html += `<img src="${question.imageUrl}" style="width: 100%; max-width: 500px; margin: 0 auto 20px; display: block; border-radius: 8px;">`;
    }

    // Audio player (Parts 1-4)
    if (question.part <= 4 && (question.audioUrl || question.audioText)) {
        html += `
            <div style="background: #f5f7fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <button id="preview-audio-btn" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    <i class="fas fa-play"></i> Phát audio
                </button>
            </div>
        `;
    }

    // Question text (Parts 3-7)
    if (question.questionText && question.part >= 3) {
        html += `<p style="font-size: 16px; margin-bottom: 20px;"><strong>Question:</strong> ${question.questionText}</p>`;
    }

    // Passage (Parts 6-7)
    if (question.passage) {
        html += `<div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; white-space: pre-wrap;">${question.passage}</div>`;
    }

    // Options
    html += `<div style="margin-bottom: 20px;">`;
    question.options.forEach(opt => {
        const isCorrect = opt.label === question.correctAnswer;
        html += `
            <div style="padding: 12px; margin-bottom: 10px; border: 2px solid ${isCorrect ? '#10b981' : '#e0e0e0'}; background: ${isCorrect ? '#ecfdf5' : 'white'}; border-radius: 8px;">
                <strong>${opt.label}.</strong> ${opt.text}
                ${isCorrect ? '<span style="color: #10b981; margin-left: 10px;"><i class="fas fa-check-circle"></i> Correct</span>' : ''}
            </div>
        `;
    });
    html += `</div>`;

    // Explanation
    if (question.explanation) {
        html += `
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <strong style="color: #f59e0b;"><i class="fas fa-lightbulb"></i> Explanation:</strong>
                <p style="margin-top: 10px;">${question.explanation}</p>
            </div>
        `;
    }

    // Keywords for fill-in-blank
    if (question.questionKeyword || question.answerKeyword || question.audioKeyword) {
        html += `
            <div style="background: #f0f4ff; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; margin-top: 15px;">
                <strong style="color: #667eea;"><i class="fas fa-key"></i> Keywords (Đục lỗ):</strong>
                <div style="margin-top: 10px; display: flex; gap: 20px; flex-wrap: wrap;">
                    ${question.questionKeyword ? `<span style="background: #667eea; color: white; padding: 5px 12px; border-radius: 15px;"><strong>Q:</strong> ${question.questionKeyword}</span>` : ''}
                    ${question.answerKeyword ? `<span style="background: #10b981; color: white; padding: 5px 12px; border-radius: 15px;"><strong>A:</strong> ${question.answerKeyword}</span>` : ''}
                    ${question.audioKeyword ? `<span style="background: #764ba2; color: white; padding: 5px 12px; border-radius: 15px;"><strong>Audio:</strong> ${question.audioKeyword}</span>` : ''}
                </div>
            </div>
        `;
    }

    html += `</div>`;

    modal.innerHTML = html;
    modal.style.display = 'flex';

    // Add close button event listener
    setTimeout(() => {
        const closeBtn = document.getElementById('close-preview-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                // Keep highlight when closing preview (don't clear)
            });
        }

        // Add audio player functionality
        if (question.part <= 4 && (question.audioUrl || question.audioText)) {
            const audioBtn = document.getElementById('preview-audio-btn');
            if (audioBtn) {
                audioBtn.addEventListener('click', () => {
                    if (question.audioUrl) {
                        const audio = new Audio(question.audioUrl);
                        audioBtn.disabled = true;
                        audioBtn.innerHTML = '<i class="fas fa-volume-up"></i> Đang phát...';
                        audio.play();
                        audio.onended = () => {
                            audioBtn.disabled = false;
                            audioBtn.innerHTML = '<i class="fas fa-play"></i> Phát audio';
                        };
                    } else if (question.audioText) {
                        const utterance = new SpeechSynthesisUtterance(question.audioText);
                        utterance.lang = 'en-US';
                        window.speechSynthesis.speak(utterance);
                    }
                });
            }
        }
    }, 100);
}

/**
 * Handle Part 1 Image Upload (Auto-upload on file select)
 */
async function handleImageUpload(file) {
    const uploadStatus = document.getElementById('image-upload-status');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const hiddenUrlInput = document.getElementById('question-image-url');
    const fileInput = document.getElementById('question-image-file');

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        alert('Only image files (JPEG, PNG, GIF, WEBP) are allowed!');
        fileInput.value = '';
        return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB!');
        fileInput.value = '';
        return;
    }

    // Hide preview, show uploading status
    imagePreview.style.display = 'none';
    uploadStatus.style.display = 'block';

    try {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch(`${TOEIC_API_BASE}/upload/part1-image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            },
            body: formData
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || 'Upload failed');
        }

        // Success - set the imageUrl in hidden input
        hiddenUrlInput.value = data.imageUrl;

        // Show preview
        previewImg.src = data.imageUrl;
        uploadStatus.style.display = 'none';
        imagePreview.style.display = 'block';

        console.log('✅ Image uploaded successfully:', data.imageUrl);
    } catch (error) {
        console.error('Error uploading image:', error);
        alert('Failed to upload image: ' + error.message);
        uploadStatus.style.display = 'none';
        fileInput.value = '';
    }
}

/**
 * Handle Audio Upload (Auto-upload on file select)
 */
async function handleAudioUpload(file) {
    const uploadStatus = document.getElementById('audio-upload-status');
    const audioPreview = document.getElementById('audio-preview');
    const previewAudio = document.getElementById('preview-audio');
    const hiddenUrlInput = document.getElementById('question-audio-url');
    const fileInput = document.getElementById('question-audio-file');

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac', 'audio/x-m4a'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
        alert('Only audio files (MP3, WAV, OGG, M4A, AAC) are allowed!');
        fileInput.value = '';
        return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB!');
        fileInput.value = '';
        return;
    }

    // Hide preview, show uploading status
    audioPreview.style.display = 'none';
    uploadStatus.style.display = 'block';

    try {
        const formData = new FormData();
        formData.append('audio', file);

        const res = await fetch(`${TOEIC_API_BASE}/upload/audio`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            },
            body: formData
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || 'Upload failed');
        }

        // Success - set the audioUrl in hidden input
        hiddenUrlInput.value = data.audioUrl;

        // Show preview
        previewAudio.src = data.audioUrl;
        uploadStatus.style.display = 'none';
        audioPreview.style.display = 'block';

        console.log('✅ Audio uploaded successfully:', data.audioUrl);
    } catch (error) {
        console.error('Error uploading audio:', error);
        alert('Failed to upload audio: ' + error.message);
        uploadStatus.style.display = 'none';
        fileInput.value = '';
    }
}

/**
 * Handle Question Form Submit
 */
async function handleQuestionSubmit(e) {
    e.preventDefault();

    const questionId = document.getElementById('question-id').value;
    const part = parseInt(document.getElementById('question-part').value);
    const questionText = document.getElementById('question-text').value.trim();
    const audioText = document.getElementById('question-audio-text').value.trim();
    const passage = document.getElementById('question-passage').value.trim();
    const imageUrl = document.getElementById('question-image-url').value.trim();
    const audioUrl = document.getElementById('question-audio-url').value.trim();
    const explanation = document.getElementById('question-explanation').value.trim();

    console.log('📋 Question Submit Data:');
    console.log('   - questionId:', questionId);
    console.log('   - imageUrl:', imageUrl);
    console.log('   - audioUrl:', audioUrl);

    // Get correct answer
    const correctAnswer = document.querySelector('input[name="correct-answer"]:checked')?.value;
    if (!correctAnswer) {
        alert('Please select the correct answer!');
        return;
    }

    // Get options
    const options = ['A', 'B', 'C', 'D'].map(label => ({
        label,
        text: document.getElementById(`option-${label}`).value.trim()
    })).filter(opt => opt.text);

    if (options.length < 3) {
        alert('Vui lòng điền vào ít nhất 3 đáp án!');
        return;
    }

    // Validation for Part 1: Must have image or audio URL
    if (part === 1) {
        if (!imageUrl && !audioUrl) {
            alert('Part 1 requires either an image or audio file! Please select a file (it will auto-upload).');
            return;
        }
    }

    // Validation for Part 2-4: Must have audio URL or audio text
    if (part >= 2 && part <= 4) {
        if (!audioText && !audioUrl) {
            alert(`Part ${part} requires audio! Please upload an audio file or provide audio text.`);
            return;
        }
    }

    const questionData = {
        part,
        correctAnswer,
        options,
    };

    // Add optional fields
    // Part 1: Don't need questionText (only image + audio)
    // Part 2-7: Need questionText
    if (questionText && part >= 2) questionData.questionText = questionText;

    // Part 3-4: Can have audioText (for TTS fallback)
    if (audioText) questionData.audioText = audioText;

    if (passage) questionData.passage = passage;
    if (imageUrl) questionData.imageUrl = imageUrl;
    if (audioUrl) questionData.audioUrl = audioUrl;
    if (explanation) questionData.explanation = explanation;

    // Add keyword fields for fill-in-blank mode
    // Part 1-2: questionKeyword + answerKeyword
    const questionKeyword = document.getElementById('question-keyword')?.value.trim();
    const answerKeyword = document.getElementById('answer-keyword')?.value.trim();
    if (questionKeyword) questionData.questionKeyword = questionKeyword;
    if (answerKeyword) questionData.answerKeyword = answerKeyword;

    // Part 3-4: audioKeyword
    const audioKeyword = document.getElementById('audio-keyword')?.value.trim();
    if (audioKeyword) questionData.audioKeyword = audioKeyword;

    try {
        const url = questionId ? `${TOEIC_API_BASE}/questions/${questionId}` : `${TOEIC_API_BASE}/questions`;
        const method = questionId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(questionData)
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to save question');
        }

        const isEditMode = !!questionId;

        if (isEditMode) {
            // Edit mode: Close modal and reload
            alert('✅ Question updated successfully!');
            closeQuestionModal();
            loadQuestions();
        } else {
            // Add mode: Keep modal open, save Part, and reset form for next question
            alert('✅ Question created successfully! Form is ready for next question.');

            // Save the selected part
            lastSelectedPart = part;

            // Clear form but keep Part selection
            const form = document.getElementById('question-form');
            const currentPart = document.getElementById('question-part').value;

            form.reset();

            // Restore Part
            document.getElementById('question-part').value = currentPart;
            updatePartVisibility();

            // Reset image/audio previews
            document.getElementById('image-preview').style.display = 'none';
            document.getElementById('preview-img').src = '';
            document.getElementById('audio-preview').style.display = 'none';
            document.getElementById('preview-audio').src = '';
            document.getElementById('question-image-url').value = '';
            document.getElementById('question-audio-url').value = '';

            // Focus on first input field for quick entry
            const firstInput = document.getElementById('question-text');
            if (firstInput && firstInput.offsetParent !== null) {
                firstInput.focus();
            } else {
                // If question-text is hidden (Part 1-2), focus on first option
                document.getElementById('option-A')?.focus();
            }

            // Reload questions list to show the new question
            loadQuestions();
        }
    } catch (error) {
        console.error('Error saving question:', error);
        alert('❌ Failed to save question: ' + error.message);
    }
}

/**
 * Delete Question
 */
async function deleteQuestion(questionId) {
    if (!confirm('Are you sure you want to delete this question?')) {
        return;
    }

    try {
        const res = await fetch(`${TOEIC_API_BASE}/questions/${questionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to delete question');
        }

        alert('✅ Question deleted successfully!');
        loadQuestions();
    } catch (error) {
        console.error('Error deleting question:', error);
        alert('❌ Failed to delete question: ' + error.message);
    }
}

/**
 * Delete All Questions
 */
async function deleteAllQuestions() {
    // First confirmation
    const confirmed1 = confirm('⚠️ WARNING: Bạn sắp xóa TẤT CẢ câu hỏi TOEIC!\n\nHành động này KHÔNG THỂ HOÀN TÁC!\n\nBạn có chắc chắn muốn tiếp tục?');

    if (!confirmed1) {
        return;
    }

    // Second confirmation with typing requirement
    const typeConfirm = prompt('Để xác nhận xóa TẤT CẢ câu hỏi, vui lòng nhập chữ "DELETE ALL" (viết hoa):');

    if (typeConfirm !== 'DELETE ALL') {
        alert('❌ Xác nhận không đúng. Hủy thao tác xóa.');
        return;
    }

    try {
        // Show loading message
        const loadingMsg = document.createElement('div');
        loadingMsg.id = 'delete-all-loading';
        loadingMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10000;
            text-align: center;
        `;
        loadingMsg.innerHTML = `
            <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #ff6b6b; margin-bottom: 20px;"></i>
            <h3 style="margin: 0; color: #333;">Đang xóa tất cả câu hỏi...</h3>
            <p style="color: #666; margin-top: 10px;">Vui lòng chờ, đừng tắt trang này.</p>
        `;
        document.body.appendChild(loadingMsg);

        const res = await fetch(`${TOEIC_API_BASE}/questions/delete-all`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await res.json();

        // Remove loading message
        document.getElementById('delete-all-loading')?.remove();

        if (!data.success) {
            throw new Error(data.message || 'Failed to delete all questions');
        }

        alert(`✅ Đã xóa thành công ${data.deletedCount || 'tất cả'} câu hỏi TOEIC!`);
        loadQuestions(); // Reload the questions list
    } catch (error) {
        // Remove loading message if error occurs
        document.getElementById('delete-all-loading')?.remove();

        console.error('Error deleting all questions:', error);
        alert('❌ Lỗi khi xóa câu hỏi: ' + error.message);
    }
}

/**
 * AI Generate Questions
 */
function openAIGenerateModal() {
    const part = prompt('Enter Part number (1-7) to generate questions for:');
    if (!part || part < 1 || part > 7) {
        alert('Invalid part number. Must be between 1 and 7.');
        return;
    }

    const count = prompt('How many questions to generate? (1-50):', '5');
    if (!count || count < 1 || count > 50) {
        alert('Invalid count. Must be between 1 and 50.');
        return;
    }

    handleAIGenerate(parseInt(part), parseInt(count));
}

async function handleAIGenerate(part, count) {
    if (!confirm(`Generate ${count} AI questions for Part ${part}?\n\nThis will use OpenAI API and may take a moment.`)) {
        return;
    }

    console.log(`🤖 Generating ${count} questions for Part ${part}...`);

    try {
        const res = await fetch(`${TOEIC_API_BASE}/questions/ai-generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                part,
                count,
                autoSave: true
            })
        });

        if (!res.ok) {
            const text = await res.text();
            console.error('Server response:', text);
            throw new Error(`Server error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to generate questions');
        }

        alert(`✅ Successfully generated ${data.metadata.count} questions!\n\n` +
              `Part: ${data.metadata.part}\n` +
              `Auto-saved: ${data.metadata.autoSaved ? 'Yes' : 'No'}\n` +
              `Needs review: ${data.metadata.needsReview ? 'Yes (unpublished)' : 'No'}\n\n` +
              `Questions have been saved as UNPUBLISHED. Please review and publish them.`);

        loadQuestions();
    } catch (error) {
        console.error('AI Generation error:', error);
        alert('❌ Failed to generate questions: ' + error.message);
    }
}

window.editQuestion = (questionId) => {
    console.log('Edit question clicked:', questionId);
    console.log('Current questions:', currentQuestions);
    openQuestionModal(questionId);
};

window.deleteQuestion = deleteQuestion;

/**
 * Open Test Modal
 */
function openTestModal(testId = null) {
    console.log('🔵 openTestModal called with testId:', testId);

    const modal = document.getElementById('test-modal');
    const form = document.getElementById('test-form');
    const modalTitle = modal.querySelector('h3');
    const submitBtn = form.querySelector('button[type="submit"]');

    // ALWAYS reset first
    form.reset();
    document.getElementById('test-name').value = '';
    document.getElementById('test-type').value = 'full-test';
    document.getElementById('test-duration').value = '';
    document.getElementById('test-description').value = '';
    document.getElementById('random-question-count').value = '';
    const reuseCheckbox = document.getElementById('reuse-questions-checkbox');
    if (reuseCheckbox) {
        reuseCheckbox.checked = false;
    }

    // Store testId in modal dataset for later use
    modal.dataset.testId = testId || '';
    modal.dataset.editMode = testId ? 'true' : 'false';

    // Update modal title and button text
    if (testId) {
        console.log('🟡 Opening in EDIT mode');
        modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Test';
        submitBtn.textContent = 'Update Test';
    } else {
        console.log('🟢 Opening in CREATE mode');
        modalTitle.innerHTML = '<i class="fas fa-file-alt"></i> Create New Test';
        submitBtn.textContent = 'Create Test';
    }

    modal.style.display = 'flex';

    // Add event listener for test type change
    const testTypeSelect = document.getElementById('test-type');
    const randomQuestionsField = document.getElementById('random-questions-field');

    testTypeSelect.addEventListener('change', function() {
        const isFullTest = this.value === 'full-test';
        // Show random questions field only for Mini Tests (NOT Full Test)
        randomQuestionsField.style.display = isFullTest ? 'none' : 'block';

        // Clear random count when switching to Full Test
        if (isFullTest) {
            document.getElementById('random-question-count').value = '';
        }
    });

    // Initially hide the field
    randomQuestionsField.style.display = 'none';
}

function closeTestModal() {
    console.log('🔴 Closing modal and resetting form');
    const modal = document.getElementById('test-modal');
    const form = document.getElementById('test-form');

    modal.style.display = 'none';

    // Reset everything when closing
    form.reset();
    document.getElementById('test-name').value = '';
    document.getElementById('test-type').value = 'full-test';
    document.getElementById('test-duration').value = '';
    document.getElementById('test-description').value = '';
    document.getElementById('random-question-count').value = '';
    const reuseCheckbox = document.getElementById('reuse-questions-checkbox');
    if (reuseCheckbox) {
        reuseCheckbox.checked = false;
    }

    // Clear modal dataset
    modal.dataset.testId = '';
    modal.dataset.editMode = 'false';
}

/**
 * Edit Test - Load test data into modal
 */
async function editTest(testId) {
    try {
        // Fetch test details
        const res = await fetch(`${TOEIC_API_BASE}/tests/${testId}`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        const data = await res.json();

        if (!data.success) {
            alert('Failed to load test details: ' + data.message);
            return;
        }

        const test = data.data;

        // Check if test is published
        if (test.isPublished) {
            alert('⚠️ Cannot Edit Published Test\n\nThis test is currently published. Please unpublish it first before making any changes.');
            return;
        }

        // Open modal in edit mode
        openTestModal(testId);

        // Populate form fields
        document.getElementById('test-name').value = test.testName || '';
        document.getElementById('test-type').value = test.testType || '';
        document.getElementById('test-description').value = test.description || '';
        document.getElementById('test-duration').value = Math.round(test.totalTime / 60) || '';

        // Handle random question count and show field for Mini Tests
        const randomQuestionsField = document.getElementById('random-questions-field');
        if (test.testType !== 'full-test') {
            randomQuestionsField.style.display = 'block';
            document.getElementById('random-question-count').value = test.randomQuestionCount || '';
        } else {
            randomQuestionsField.style.display = 'none';
            document.getElementById('random-question-count').value = '';
        }

        // Set reuse questions checkbox
        const reuseCheckbox = document.getElementById('reuse-questions-checkbox');
        if (reuseCheckbox) {
            reuseCheckbox.checked = test.allowReuseQuestions || false;
        }

    } catch (error) {
        console.error('Error loading test:', error);
        alert('Error loading test details. Please try again.');
    }
}

/**
 * Handle Test Form Submit
 */
async function handleTestSubmit(e) {
    e.preventDefault();

    const modal = document.getElementById('test-modal');
    const isEditMode = modal.dataset.editMode === 'true';
    const testId = modal.dataset.testId;

    const testName = document.getElementById('test-name').value.trim();
    const testType = document.getElementById('test-type').value;
    const description = document.getElementById('test-description').value.trim();
    const duration = parseInt(document.getElementById('test-duration').value);

    if (!testName || !testType || !duration) {
        alert('Please fill in all required fields!');
        return;
    }

    if (duration < 1) {
        alert('Duration must be at least 1 minute!');
        return;
    }

    const testData = {
        testName,
        testType,
        description,
        totalTime: duration * 60 // Convert minutes to seconds
    };

    // Add random question count if specified
    const randomCount = parseInt(document.getElementById('random-question-count').value);
    if (!isNaN(randomCount) && randomCount > 0) {
        testData.randomQuestionCount = randomCount;
        console.log('🎲 Random question count:', randomCount);
    }

    // Add reuse questions setting
    const reuseQuestions = document.getElementById('reuse-questions-checkbox')?.checked || false;
    testData.allowReuseQuestions = reuseQuestions;
    console.log('♻️ Allow reuse questions:', reuseQuestions);

    console.log(isEditMode ? '📤 Updating test with data:' : '📤 Creating test with data:', testData);

    try {
        const url = isEditMode ? `${TOEIC_API_BASE}/tests/${testId}` : `${TOEIC_API_BASE}/tests`;
        const method = isEditMode ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(testData)
        });

        const data = await res.json();

        console.log('📥 Server response:', data);

        if (!data.success) {
            // Check if error contains detailed validation info
            if (data.insufficientParts && data.insufficientParts.length > 0) {
                let errorMsg = '⚠️ Cannot Create Test: Insufficient Questions\n\n';
                errorMsg += 'The following parts do not have enough questions:\n\n';

                data.insufficientParts.forEach(p => {
                    errorMsg += `• Part ${p.part}:\n`;
                    errorMsg += `  Required: ${p.required} | Available: ${p.available} | Missing: ${p.missing}\n\n`;
                });

                errorMsg += '💡 Please add more questions to these parts using:\n';
                errorMsg += '   - "Add Question" button\n';
                errorMsg += '   - "AI Generate" feature';

                alert(errorMsg);
            } else {
                throw new Error(data.message || 'Failed to create test');
            }
            return; // Don't close modal or reload if validation failed
        }

        alert(data.message || (isEditMode ? '✅ Test updated successfully!' : '✅ Test created successfully!'));
        closeTestModal();
        loadTests();
    } catch (error) {
        console.error(isEditMode ? 'Error updating test:' : 'Error creating test:', error);
        const errorMsg = error.message || (isEditMode ? 'Failed to update test' : 'Failed to create test');
        alert('❌ Error:\n\n' + errorMsg);
    }
}

/**
 * Generate Full Test
 */
async function generateTest() {
    if (!confirm('Generate a full TOEIC test automatically? This will create a 200-question test with random questions from all parts.')) {
        return;
    }

    try {
        // Generate auto test name with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const testNumber = Math.floor(Math.random() * 1000);

        const testData = {
            testName: `Auto-Generated Test #${testNumber}`,
            description: `Automatically generated full TOEIC test on ${timestamp}`
        };

        const res = await fetch(`${TOEIC_API_BASE}/tests/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(testData)
        });

        // Check response status first
        if (!res.ok) {
            const text = await res.text();
            console.error('Server response:', text);
            throw new Error(`Server error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        if (!data.success) {
            // Check if error contains detailed validation info
            if (data.insufficientParts && data.insufficientParts.length > 0) {
                let errorMsg = '⚠️ Cannot Generate Full Test: Insufficient Questions\n\n';
                errorMsg += 'The following parts do not have enough questions:\n\n';

                data.insufficientParts.forEach(p => {
                    errorMsg += `• Part ${p.part} (${p.partName}):\n`;
                    errorMsg += `  Required: ${p.required} | Available: ${p.available} | Missing: ${p.missing}\n\n`;
                });

                errorMsg += '💡 Please add more questions to these parts using:\n';
                errorMsg += '   - "Add Question" button\n';
                errorMsg += '   - "AI Generate" feature';

                alert(errorMsg);
            } else {
                throw new Error(data.message || 'Failed to generate test');
            }
            return; // Don't reload tests if validation failed
        }

        alert('✅ Test generated successfully!');
        loadTests();
    } catch (error) {
        console.error('Error generating test:', error);
        // Format multi-line error messages properly
        const errorMsg = error.message || 'Failed to generate test';
        alert('❌ Error:\n\n' + errorMsg);
    }
}

/**
 * Delete Test
 */
/**
 * Publish/Unpublish Test
 */
async function publishTest(testId, shouldPublish) {
    const action = shouldPublish ? 'publish' : 'unpublish';
    if (!confirm(`Are you sure you want to ${action} this test?`)) {
        return;
    }

    try {
        const res = await fetch(`${TOEIC_API_BASE}/tests/${testId}/publish`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ isPublished: shouldPublish })
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || `Failed to ${action} test`);
        }

        alert(`✅ Test ${action}ed successfully!`);
        loadTests();
    } catch (error) {
        console.error(`Error ${action}ing test:`, error);
        alert(`❌ Failed to ${action} test: ` + error.message);
    }
}

async function deleteTest(testId) {
    if (!confirm('Are you sure you want to delete this test? All associated attempts will remain but the test will be unavailable.')) {
        return;
    }

    try {
        const res = await fetch(`${TOEIC_API_BASE}/tests/${testId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to delete test');
        }

        alert('✅ Test deleted successfully!');
        loadTests();
    } catch (error) {
        console.error('Error deleting test:', error);
        alert('❌ Failed to delete test: ' + error.message);
    }
}

window.publishTest = publishTest;
window.deleteTest = deleteTest;

/**
 * Delete all TOEIC tests
 */
async function deleteAllTests() {
    const confirmText = prompt('⚠️ CẢNH BÁO: Hành động này sẽ xóa TẤT CẢ bài test!\n\nNhập "XOA TAT CA" để xác nhận:');

    if (confirmText !== 'XOA TAT CA') {
        alert('Đã hủy. Nhập đúng "XOA TAT CA" để xác nhận xóa.');
        return;
    }

    try {
        const res = await fetch(`${TOEIC_API_BASE}/tests/delete-all`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to delete all tests');
        }

        alert(`✅ Đã xóa ${data.deletedCount || 'tất cả'} bài test!`);
        loadTests();
    } catch (error) {
        console.error('Error deleting all tests:', error);
        alert('❌ Lỗi khi xóa: ' + error.message);
    }
}

// ===================================
// TOEIC STATISTICS
// ===================================

/**
 * Open Statistics Modal
 */
function openStatisticsModal() {
    document.getElementById('statistics-modal').style.display = 'flex';
    loadStatistics();
}

/**
 * Close Statistics Modal
 */
function closeStatisticsModal() {
    document.getElementById('statistics-modal').style.display = 'none';
}

/**
 * Load Statistics Data
 */
async function loadStatistics() {
    try {
        const res = await fetch(`${TOEIC_API_BASE}/questions/statistics`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to load statistics');
        }

        displayStatistics(data.data);
    } catch (error) {
        console.error('Error loading statistics:', error);
        alert('❌ Failed to load statistics: ' + error.message);
    }
}

/**
 * Display Statistics in Modal
 */
function displayStatistics(data) {
    const { parts, summary, sections } = data;

    // Update summary cards
    document.getElementById('stat-total-available').textContent = summary.totalAvailable;
    document.getElementById('stat-progress').textContent = summary.progress + '%';
    document.getElementById('stat-missing').textContent = summary.missing;

    const fullTestStatus = document.getElementById('stat-full-test-status');
    const fullTestCard = document.getElementById('stat-full-test-card');

    if (summary.canCreateFullTest) {
        fullTestStatus.textContent = '✅ Ready';
        fullTestCard.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
    } else {
        fullTestStatus.textContent = '❌ Not Ready';
        fullTestCard.style.background = 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)';
    }

    // Update sections
    document.getElementById('stat-listening-count').textContent = sections.listening.count;
    document.getElementById('stat-listening-progress').textContent =
        `${((sections.listening.count / sections.listening.required) * 100).toFixed(1)}% complete`;

    document.getElementById('stat-reading-count').textContent = sections.reading.count;
    document.getElementById('stat-reading-progress').textContent =
        `${((sections.reading.count / sections.reading.required) * 100).toFixed(1)}% complete`;

    // Update parts table
    const tbody = document.getElementById('statistics-tbody');
    tbody.innerHTML = parts.map(part => {
        const statusIcon = part.canCreate ? '✅' : '❌';
        const statusText = part.canCreate ? 'Can Create' : `Need ${part.missing}`;
        const rowColor = part.canCreate ? '#f0fff4' : '#fff5f5';

        return `
            <tr style="background: ${rowColor}; border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px; font-weight: bold;">${part.part}</td>
                <td style="padding: 12px;">${part.partName}</td>
                <td style="padding: 12px; text-align: center; font-weight: bold; color: #667eea;">${part.available}</td>
                <td style="padding: 12px; text-align: center;">${part.required}</td>
                <td style="padding: 12px; text-align: center; color: ${part.missing > 0 ? '#f5576c' : '#38ef7d'}; font-weight: bold;">
                    ${part.missing}
                </td>
                <td style="padding: 12px; text-align: center;">${part.breakdown.easy}</td>
                <td style="padding: 12px; text-align: center;">${part.breakdown.medium}</td>
                <td style="padding: 12px; text-align: center;">${part.breakdown.hard}</td>
                <td style="padding: 12px; text-align: center;">
                    <span style="padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;
                                 background: ${part.canCreate ? '#38ef7d' : '#f5576c'}; color: white;">
                        ${statusIcon} ${statusText}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Load users in the Users tab (separate from modal)
 */
async function loadUsersInTab() {
    const tbody = document.querySelector("#users-table-tab tbody");
    tbody.innerHTML = `<tr><td colspan="8" class="loading"><i class="fas fa-spinner"></i> Đang tải danh sách tài khoản...</td></tr>`;

    try {
        const res = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();

        if (data.success) {
            allUsers = data.data || [];
            currentUsers = [...allUsers];

            // Initialize search/filter controls (only once)
            if (!window.userFiltersInitialized) {
                initUserSearchAndFilters();
                window.userFiltersInitialized = true;
            }

            applyUserFilters();
        } else {
            const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim();
            tbody.innerHTML = `<tr><td colspan="7" class="loading" style="color: ${dangerColor}">Lỗi tải dữ liệu: ${data.message}</td></tr>`;
        }
    } catch (err) {
        console.error("Error loading users:", err);
        const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim();
        tbody.innerHTML = `<tr><td colspan="7" class="loading" style="color: ${dangerColor}">Lỗi kết nối API: Không thể tải danh sách tài khoản</td></tr>`;
    }
}

function displayUsersInTab(users) {
    const tbody = document.querySelector("#users-table-tab tbody");

    if (!users || !users.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">Không tìm thấy tài khoản nào</td></tr>';
        return;
    }

    tbody.innerHTML = users.map((u) => {
        const userId = u._id || u.id;
        const createdAt = new Date(u.createdAt).toLocaleDateString('vi-VN');
        const statusBadge = u.isActive
            ? `<span class="badge success">Active</span>`
            : `<span class="badge danger">Inactive</span>`;
        const roleBadge = u.role === 'admin'
            ? `<span class="badge danger">${u.role.toUpperCase()}</span>`
            : `<span class="badge info">${u.role.toUpperCase()}</span>`;
        const isTempLocked = u.lockUntil && new Date(u.lockUntil) > new Date();
        const lockBadge = u.isLocked
            ? `<span class="badge danger">🔒 Locked (Admin)</span>`
            : isTempLocked
                ? `<span class="badge warning">⏳ Locked (Tạm thời)</span>`
                : `<span class="badge success">🔓 Unlock</span>`;

        const shortId = userId ? userId.toString().slice(-8) : '?';
        return `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:5px;" title="${userId}">
                <span style="font-size:12px;font-family:monospace;color:var(--text-secondary);">…${shortId}</span>
                <button class="btn-copy-user-id" data-copy-id="${userId}" title="Copy full ID"
                  style="background:none;border:none;cursor:pointer;color:#aaa;font-size:11px;padding:2px 4px;border-radius:4px;flex-shrink:0;">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </td>
            <td><strong>${u.username}</strong></td>
            <td>${u.email || "-"}</td>
            <td>${lockBadge}</td>
            <td>${roleBadge}</td>
            <td>${createdAt}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-primary btn-sm btn-user-edit-tab" data-id="${userId}" data-username="${u.username}" data-email="${u.email}" data-role="${u.role}" data-locked="${u.isLocked ? 'true' : 'false'}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-sm btn-user-delete-tab" data-id="${userId}" data-username="${u.username}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
          </tr>
        `;
    }).join("");

    attachUserTabListeners();
}

function attachUserTabListeners() {
    // Edit User
    document.querySelectorAll(".btn-user-edit-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
            openUserFormModal("Sửa thông tin tài khoản", "edit", {
                id: btn.dataset.id,
                username: btn.dataset.username,
                email: btn.dataset.email,
                role: btn.dataset.role,
                isLocked: btn.dataset.locked === 'true',
            });
        });
    });

    // Copy user ID
    document.querySelectorAll(".btn-copy-user-id").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.copyId;
            navigator.clipboard.writeText(id).then(() => {
                btn.innerHTML = '<i class="fas fa-check"></i>';
                btn.style.color = '#27ae60';
                setTimeout(() => {
                    btn.innerHTML = '<i class="fas fa-copy"></i>';
                    btn.style.color = '#aaa';
                }, 1200);
            });
        });
    });

    // Toggle password visibility
    document.querySelectorAll(".btn-toggle-pwd").forEach((btn) => {
        btn.addEventListener("click", () => {
            const target = document.getElementById(btn.dataset.target);
            const icon = btn.querySelector("i");
            if (!target) return;
            if (target.textContent.startsWith('•')) {
                target.textContent = btn.dataset.pwd;
                icon.className = "fas fa-eye-slash";
            } else {
                target.textContent = "••••••••";
                icon.className = "fas fa-eye";
            }
        });
    });

    // Delete User
    document.querySelectorAll(".btn-user-delete-tab").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const username = btn.dataset.username;
            if (!confirm(`Bạn có chắc chắn muốn XÓA tài khoản "${username}" (ID: ${id})?`)) return;

            try {
                const res = await fetch(`${API_URL}/users/${id}`, {
                    method: "DELETE",
                    headers: { 'Authorization': `Bearer ${getToken()}` },
                });

                const data = await res.json();

                if (data.success) {
                    setTimeout(async () => {
                        await loadUsersInTab();
                        await loadRecentActivities();
                        alert("✅ Tài khoản đã được xóa thành công!");
                    }, 200);
                } else {
                    alert("❌ Lỗi: " + (data.message || "Không thể xóa tài khoản."));
                }
            } catch (error) {
                alert("Lỗi kết nối: Không thể thực hiện thao tác xóa.");
            }
        });
    });
}

// ===================================
// 10. PRACTICE HISTORY MANAGEMENT
// ===================================

let practiceHistoryData = [];
let practiceHistoryPage = 1;
const practiceHistoryLimit = 20;

/**
 * Load practice history data
 */
async function loadPracticeHistory(page = 1, userId = '', search = '') {
    try {
        practiceHistoryPage = page;
        const params = new URLSearchParams({
            page,
            limit: practiceHistoryLimit,
        });

        if (userId) params.append('userId', userId);
        if (search) params.append('search', search);

        const response = await fetch(`${API_URL}/toeic/admin/practice-history?${params}`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        const result = await response.json();

        if (result.success) {
            practiceHistoryData = result.data;
            renderPracticeHistoryTable(result.data);
            renderPagination('history-pagination', {
                currentPage: result.page,
                totalPages: result.pages,
                total: result.total || result.data.length,
                limit: practiceHistoryLimit
            }, (page) => {
                const filters = getHistoryFilters();
                loadPracticeHistory(page, filters.userId, filters.search);
                document.querySelector('#history-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 'history records');
        } else {
            console.error('Failed to load practice history:', result.message);
            document.getElementById('history-table-body').innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 20px; color: var(--danger);">
                        Failed to load practice history: ${result.message || 'Unknown error'}
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error loading practice history:', error);
        document.getElementById('history-table-body').innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 20px; color: var(--danger);">
                    Error loading practice history. Please try again.
                </td>
            </tr>
        `;
    }
}

/**
 * Render practice history table
 */
function renderPracticeHistoryTable(data) {
    const tbody = document.getElementById('history-table-body');

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 20px;">
                    No practice history found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map((attempt, index) => {
        const num = (practiceHistoryPage - 1) * practiceHistoryLimit + index + 1;
        const completedDate = new Date(attempt.completedAt);
        const formattedDate = completedDate.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        const durationMinutes = Math.floor(attempt.duration / 60);
        const durationSeconds = attempt.duration % 60;
        const formattedDuration = `${durationMinutes}m ${durationSeconds}s`;

        return `
            <tr>
                <td>${num}</td>
                <td>
                    <div style="font-weight: 600;">${attempt.user.username}</div>
                    <div style="font-size: 0.85em; color: var(--text-light);">${attempt.user.email}</div>
                </td>
                <td>
                    <span class="badge badge-${attempt.test.type === 'full' ? 'primary' : 'info'}">
                        ${attempt.test.type === 'full' ? 'Full Test' : 'Practice'}
                    </span>
                </td>
                <td style="font-weight: 600; color: var(--primary);">${attempt.totalScore}</td>
                <td>${attempt.listeningScore}</td>
                <td>${attempt.readingScore}</td>
                <td>
                    <span class="badge badge-${attempt.accuracy >= 80 ? 'success' : attempt.accuracy >= 60 ? 'warning' : 'danger'}">
                        ${attempt.accuracy}%
                    </span>
                </td>
                <td>${formattedDate}</td>
                <td>${formattedDuration}</td>
                <td>
                    <button class="btn-icon history-view-btn" data-attempt-id="${attempt._id}" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon history-delete-btn" data-attempt-id="${attempt._id}" title="Delete" style="color: var(--danger);">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Add event delegation for view and delete buttons
    setTimeout(() => {
        document.querySelectorAll('.history-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const attemptId = btn.getAttribute('data-attempt-id');
                viewPracticeDetails(attemptId);
            });
        });

        document.querySelectorAll('.history-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const attemptId = btn.getAttribute('data-attempt-id');
                deleteSingleHistory(attemptId);
            });
        });
    }, 0);
}

/**
 * Get current history filters
 */
function getHistoryFilters() {
    return {
        userId: document.getElementById('history-filter-user')?.value || '',
        search: document.getElementById('history-search')?.value || ''
    };
}

/**
 * View practice details
 */
async function viewPracticeDetails(attemptId) {
    try {
        const response = await fetch(`${API_URL}/toeic/attempts/${attemptId}/review`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        const result = await response.json();

        if (result.success) {
            showPracticeDetailsModal(result.data);
        } else {
            alert('Failed to load practice details: ' + result.message);
        }
    } catch (error) {
        console.error('Error loading practice details:', error);
        alert('Error loading practice details. Please try again.');
    }
}

/**
 * Show practice details modal
 */
function showPracticeDetailsModal(data) {
    const modal = document.createElement('div');
    modal.id = 'practice-details-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    const modalContent = `
        <div style="background: var(--bg-primary); border-radius: 12px; padding: 30px; max-width: 900px; max-height: 80vh; overflow-y: auto; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">Practice Details</h2>
                <button id="close-practice-modal-btn" style="background: none; border: none; font-size: 24px; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px;">
                <div class="stat-card">
                    <div class="stat-label">Total Score</div>
                    <div class="stat-value" style="color: var(--primary);">${data.scores.total}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Accuracy</div>
                    <div class="stat-value">${data.stats ? ((data.stats.correct / data.stats.total) * 100).toFixed(1) : 0}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Listening Score</div>
                    <div class="stat-value">${data.scores.listening}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Reading Score</div>
                    <div class="stat-value">${data.scores.reading}</div>
                </div>
            </div>

            <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px;">
                <h3 style="margin-top: 0;">Statistics</h3>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                    <div>
                        <strong>Total Questions:</strong> ${data.stats.total}
                    </div>
                    <div style="color: var(--success);">
                        <strong>Correct:</strong> ${data.stats.correct}
                    </div>
                    <div style="color: var(--danger);">
                        <strong>Incorrect:</strong> ${data.stats.incorrect}
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.innerHTML = modalContent;
    document.body.appendChild(modal);
    document.getElementById('close-practice-modal-btn')?.addEventListener('click', closePracticeDetailsModal);
}

/**
 * Close practice details modal
 */
function closePracticeDetailsModal() {
    const modal = document.getElementById('practice-details-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Load users list for filter dropdown
 */
async function loadUsersListForHistory() {
    try {
        const response = await fetch(`${API_URL}/toeic/admin/users-list`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        const result = await response.json();

        if (result.success) {
            const select = document.getElementById('history-filter-user');
            if (select) {
                select.innerHTML = '<option value="">-- All Users --</option>' +
                    result.data.map(user => `
                        <option value="${user._id}">${user.username} (${user.email})</option>
                    `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading users list:', error);
    }
}

/**
 * Delete a single practice history entry
 */
async function deleteSingleHistory(attemptId) {
    if (!confirm('Are you sure you want to delete this practice history entry?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/toeic/admin/practice-history/${attemptId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        const result = await response.json();

        if (result.success) {
            alert('Practice history deleted successfully!');
            // Reload the current page
            const filters = getHistoryFilters();
            loadPracticeHistory(practiceHistoryPage, filters.userId, filters.search);
        } else {
            alert('Failed to delete practice history: ' + result.message);
        }
    } catch (error) {
        console.error('Error deleting practice history:', error);
        alert('Error deleting practice history. Please try again.');
    }
}

/**
 * Delete all practice history for a specific user
 */
async function deleteAllUserHistory() {
    const userId = document.getElementById('history-filter-user')?.value;

    if (!userId) {
        alert('Please select a user first!');
        return;
    }

    const userSelect = document.getElementById('history-filter-user');
    const selectedOption = userSelect.options[userSelect.selectedIndex];
    const username = selectedOption.text;

    if (!confirm(`Are you sure you want to delete ALL practice history for ${username}?\n\nThis action cannot be undone!`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/toeic/admin/practice-history/user/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        const result = await response.json();

        if (result.success) {
            alert(result.message);
            // Reload history
            loadPracticeHistory(1, '', '');
            // Reset filter
            document.getElementById('history-filter-user').value = '';
            document.getElementById('btn-delete-user-history').style.display = 'none';
        } else {
            alert('Failed to delete user history: ' + result.message);
        }
    } catch (error) {
        console.error('Error deleting user history:', error);
        alert('Error deleting user history. Please try again.');
    }
}

/**
 * Delete all practice history
 */
async function deleteAllHistory() {
    if (!confirm('⚠️ WARNING: Are you sure you want to delete ALL practice history from ALL users?\n\nThis will permanently delete EVERYTHING and CANNOT be undone!')) {
        return;
    }

    // Double confirmation
    if (!confirm('⚠️ FINAL WARNING: This will delete ALL practice history entries from the database.\n\nType confirmation: Click OK to proceed with deletion.')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/toeic/admin/practice-history/all`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        const result = await response.json();

        if (result.success) {
            alert(`✅ ${result.message}`);
            // Reload history
            loadPracticeHistory(1, '', '');
            // Reset filter
            document.getElementById('history-filter-user').value = '';
            document.getElementById('btn-delete-user-history').style.display = 'none';
        } else {
            alert('❌ Failed to delete all history: ' + result.message);
        }
    } catch (error) {
        console.error('Error deleting all history:', error);
        alert('❌ Error deleting all history. Please try again.');
    }
}

// ===================================
// 11. ENHANCED INITIALIZATION
// ===================================

// Update the DOMContentLoaded event listener to include TOEIC functionality
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-refresh")?.addEventListener("click", refreshData);

    const usersModal = document.getElementById("manage-users-modal");

    // --- USER MANAGEMENT MODAL EVENTS ---
    document.getElementById("btn-manage-users")?.addEventListener("click", () => {
        if (usersModal) {
            usersModal.style.display = "flex";
            loadUsers();
        }
    });

    document.getElementById("close-users-modal")?.addEventListener("click", hideUsersModal);

    document.getElementById("btn-add-user")?.addEventListener("click", () => {
        openUserFormModal("Thêm tài khoản mới", "add");
    });

    document.getElementById("btn-add-user-tab")?.addEventListener("click", () => {
        openUserFormModal("Thêm tài khoản mới", "add");
    });

    document.getElementById("cancel-user-form")?.addEventListener("click", hideUserFormModal);

    // --- VOCABULARY MODAL EVENTS ---
    document.getElementById("btn-add-vocabulary")?.addEventListener("click", () => {
        const modal = document.getElementById("add-word-modal");
        if (modal) {
            document.getElementById("add-word-form").reset();
            delete modal.dataset.editMode;
            delete modal.dataset.originalEn;
            modal.querySelector("h3").innerHTML = '➕ Add New Word';
            modal.querySelector('button[type="submit"]').textContent = 'Add Word';
            modal.style.display = "flex";
        }
    });

    document.getElementById("btn-close-modal")?.addEventListener("click", () => {
        const modal = document.getElementById("add-word-modal");
        if (modal) {
            modal.style.display = "none";
            document.getElementById("add-word-form").reset();
            delete modal.dataset.editMode;
            delete modal.dataset.originalEn;
            modal.querySelector("h3").innerHTML = '➕ Add New Word';
            modal.querySelector('button[type="submit"]').textContent = 'Add Word';
        }
    });

    // --- TOEIC QUESTION EVENTS ---
    document.getElementById('filter-part')?.addEventListener('change', (e) => {
        loadQuestions(e.target.value, 1); // Reset to page 1 when filter changes
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

    // NOTE: Removed click-outside-to-close behavior to prevent accidental form closure

    document.getElementById('question-form')?.addEventListener('submit', handleQuestionSubmit);

    document.getElementById('question-part')?.addEventListener('change', updatePartVisibility);

    // Auto-upload image when file is selected
    document.getElementById('question-image-file')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageUpload(file);
        }
    });

    // Auto-upload audio when file is selected
    document.getElementById('question-audio-file')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            handleAudioUpload(file);
        }
    });

    // --- TOEIC TEST EVENTS ---
    document.getElementById('btn-create-test')?.addEventListener('click', () => openTestModal());

    document.getElementById('btn-generate-test')?.addEventListener('click', generateTest);

    document.getElementById('btn-delete-all-tests')?.addEventListener('click', deleteAllTests);

    document.getElementById('btn-close-test-modal')?.addEventListener('click', closeTestModal);

    document.getElementById('test-form')?.addEventListener('submit', handleTestSubmit);

    // --- ADD/EDIT WORD FORM SUBMIT ---
    document.getElementById("add-word-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const modal = document.getElementById("add-word-modal");
        const isEditMode = modal.dataset.editMode === 'true';
        const originalEn = modal.dataset.originalEn;

        const wordData = {
            en: document.getElementById("word-en").value.trim(),
            vn: document.getElementById("word-vn").value.trim(),
            phonetic: document.getElementById("word-phonetic").value.trim(),
            part: document.getElementById("word-part").value.trim().toUpperCase(),
            type: document.getElementById("word-type").value,
            synonyms: document.getElementById("word-synonyms").value.trim(),
            image: document.getElementById("word-image").value.trim(),
            example: document.getElementById("word-example").value.trim(),
            source: (document.getElementById("word-sources")?.value.trim() || 'custom').toLowerCase(),
        };

        try {
            let res, data;

            if (isEditMode) {
                res = await fetch(`${API_URL}/vocabulary/${encodeURIComponent(originalEn)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(wordData),
                });
            } else {
                res = await fetch(`${API_URL}/vocabulary`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(wordData),
                });
            }

            data = await res.json();

            if (data.success) {
                modal.style.display = "none";
                document.getElementById("add-word-form").reset();

                delete modal.dataset.editMode;
                delete modal.dataset.originalEn;
                modal.querySelector("h3").innerHTML = '➕ Add New Word';
                modal.querySelector('button[type="submit"]').textContent = 'Add Word';

                setTimeout(async () => {
                    if (isEditMode) {
                        await loadVocabulary(vocabCurrentPage, vocabCurrentPart);
                    } else {
                        vocabCurrentPage = 1;
                        vocabCurrentPart = '';
                        const filterSelect = document.getElementById('vocab-part-filter');
                        if (filterSelect) filterSelect.value = '';
                        await loadVocabulary(1, '');
                    }
                    await loadVocabularyStats();
                    await loadRecentActivities();

                    alert(isEditMode ? "✅ Từ vựng đã được cập nhật thành công!" : "✅ Từ vựng đã được thêm thành công!");
                }, 200);
            } else {
                alert("❌ Lỗi: " + (data.message || `Không thể ${isEditMode ? 'cập nhật' : 'thêm'} từ vựng.`));
            }
        } catch (error) {
            console.error(`Error ${isEditMode ? 'updating' : 'adding'} word:`, error);
            alert(`❌ Lỗi kết nối: Không thể ${isEditMode ? 'cập nhật' : 'thêm'} từ vựng.`);
        }
    });

    // --- VOCAB FILE PICKER TOGGLE ---
    const vocabPickerBtn = document.getElementById('vocab-file-picker-btn');
    const vocabPickerDropdown = document.getElementById('vocab-file-picker-dropdown');
    if (vocabPickerBtn && vocabPickerDropdown) {
        vocabPickerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = vocabPickerDropdown.style.display === 'block';
            vocabPickerDropdown.style.display = isOpen ? 'none' : 'block';
        });
        document.addEventListener('click', (e) => {
            if (!vocabPickerBtn.contains(e.target) && !vocabPickerDropdown.contains(e.target)) {
                vocabPickerDropdown.style.display = 'none';
            }
        });
    }

    // --- VOCABULARY FILE SWITCHER --- (Simplified, hidden select kept for compat)
    document.getElementById("vocab-file-selector")?.addEventListener("change", async (e) => {
        const selectedFile = e.target.value;
        if (!selectedFile) return;

        console.log(`📂 File changed to: ${selectedFile}`);

        // Always load local file first for search
        await loadLocalVocabulary(selectedFile);
        currentVocabFile = selectedFile;
        currentLocalFile = selectedFile;

        // Setup search and display
        initSimpleSearch();
        displayLocalVocabulary();
        updateLocalPartFilter();

        console.log(`✅ Switched to ${selectedFile}: ${localVocabularyData.length} words`);
    });

    // --- QUICK ACTIONS --- (Import JSON handlers moved to line ~999)
    document.getElementById("action-btn-export-vocab")?.addEventListener("click", async () => {
        try {
            const res = await fetch(`${API_URL}/vocabulary?limit=10000`);
            const data = await res.json();

            if (data.success) {
                const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `vocabulary-export-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                alert("✅ Đã xuất file vocabulary thành công!");
            }
        } catch (error) {
            alert("❌ Lỗi khi xuất file: " + error.message);
        }
    });

    document.getElementById("action-btn-backup-db")?.addEventListener("click", async () => {
        try {
            const vocabRes = await fetch(`${API_URL}/vocabulary?limit=10000`);
            const vocabData = await vocabRes.json();

            const usersRes = await fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
            const usersData = await usersRes.json();

            const backup = {
                timestamp: new Date().toISOString(),
                vocabulary: vocabData.data || [],
                users: usersData.data || []
            };

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert("✅ Đã backup database thành công!");
        } catch (error) {
            alert("❌ Lỗi khi backup: " + error.message);
        }
    });

    document.getElementById("action-btn-view-users")?.addEventListener("click", () => {
        document.getElementById("btn-manage-users")?.click();
    });

    document.getElementById("action-btn-reload-cache")?.addEventListener("click", async () => {
        if (confirm("Bạn có chắc muốn tải lại dữ liệu từ file?\n\nLưu ý: Điều này sẽ làm mới cache trong memory.")) {
            try {
                await fetch("http://localhost:5000/health");
                alert("✅ Đã reload cache thành công!");
                loadDashboard();
            } catch (error) {
                alert("❌ Lỗi khi reload cache: " + error.message);
            }
        }
    });

    // --- QUICK DELETE FUNCTIONALITY ---
    document.getElementById("action-btn-quick-delete")?.addEventListener("click", async () => {
        if (!confirm("Bạn có muốn bắt đầu quét và xóa nhanh từ vựng?\n\nLưu ý: Hệ thống sẽ hiển thị từng từ vựng để bạn quyết định Giữ hoặc Xóa.")) {
            return;
        }
        await startQuickDelete();
    });

    document.getElementById("btn-quick-delete-close")?.addEventListener("click", () => {
        stopQuickDelete();
    });

    // --- PRACTICE HISTORY EVENTS ---
    document.getElementById("btn-refresh-history")?.addEventListener("click", () => {
        const filters = getHistoryFilters();
        loadPracticeHistory(1, filters.userId, filters.search);
    });

    document.getElementById("history-filter-user")?.addEventListener("change", () => {
        const filters = getHistoryFilters();
        loadPracticeHistory(1, filters.userId, filters.search);

        // Show/hide delete all button based on user selection
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

    // Tự sinh đường dẫn ảnh đúng format
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

    // Avatar dropdown toggle
    initAvatarDropdown();
});

// ===================================
// 12. UI HELPERS
// ===================================

/**
 * Set admin name across all UI elements (topbar, sidebar, avatar)
 */
function setAdminName(username) {
    const initials = username.slice(0, 2).toUpperCase();

    const el = document.getElementById('current-admin-name');
    if (el) el.textContent = username;

    const topbarName = document.getElementById('admin-name-topbar');
    if (topbarName) topbarName.textContent = username;

    const dropdownName = document.getElementById('avatar-dropdown-name');
    if (dropdownName) dropdownName.textContent = username;

    const topbarInitials = document.getElementById('topbar-avatar-initials');
    if (topbarInitials) topbarInitials.textContent = initials;

    const sidebarInitials = document.getElementById('sidebar-avatar-initials');
    if (sidebarInitials) sidebarInitials.textContent = initials;
}

/**
 * Avatar dropdown toggle & close-on-outside-click
 */
function initAvatarDropdown() {
    const btn      = document.getElementById('avatar-btn');
    const dropdown = document.getElementById('avatar-dropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        dropdown.classList.toggle('open', !isOpen);
        btn.classList.toggle('open', !isOpen);
    });

    document.addEventListener('click', () => {
        dropdown.classList.remove('open');
        btn.classList.remove('open');
    });

    dropdown.addEventListener('click', (e) => e.stopPropagation());
}

// ===================================
// 13. SYSTEM MONITOR
// ===================================

let metricsPollingTimer = null;

function startMetricsPolling() {
    loadSystemMetrics();
    if (!metricsPollingTimer) {
        metricsPollingTimer = setInterval(loadSystemMetrics, 10000);
    }
}

function stopMetricsPolling() {
    if (metricsPollingTimer) {
        clearInterval(metricsPollingTimer);
        metricsPollingTimer = null;
    }
}

// Wire manual refresh button
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-refresh-metrics')?.addEventListener('click', loadSystemMetrics);
    document.getElementById('btn-seed-achievements')?.addEventListener('click', seedAchievements);
    document.getElementById('btn-seed-quests')?.addEventListener('click', seedQuests);

    // Broadcast tab
    document.getElementById('bc-send-btn')?.addEventListener('click', sendBroadcast);
    document.getElementById('bc-history-refresh-btn')?.addEventListener('click', loadNotifHistory);
    document.getElementById('bc-type')?.addEventListener('change', _onBcTypeChange);
    _initBcEmailSearch();

    // User Stats tab
    document.getElementById('us-search-btn')?.addEventListener('click', () => loadUserStats(1));
    document.getElementById('us-reset-btn')?.addEventListener('click', () => loadUserStats(1, ''));
    document.getElementById('us-search')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadUserStats(1); });

    // User Achievements tab — init is deferred to tab click (initUserAchievementsTab)

    // Practice History tab
    document.getElementById('ph-search-btn')?.addEventListener('click', () => loadPracticeHistory12());
    document.getElementById('ph-reset-btn')?.addEventListener('click', () => loadPracticeHistory12(1, '', ''));
    document.getElementById('ph-search')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadPracticeHistory12(); });
});

async function loadSystemMetrics() {
    try {
        const res = await fetch('/api/admin/metrics', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        renderMetrics(d);
    } catch (err) {
        console.error('Metrics fetch error:', err);
    }
}

function renderMetrics(d) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    // ---- KPI cards ----
    set('m-avg-latency', d.latency.avg + ' ms');
    set('m-p95',  d.latency.p95 + ' ms');
    set('m-p99',  d.latency.p99 + ' ms');
    set('m-rpm',  d.requests.rpm);
    set('m-total-req', d.requests.total.toLocaleString());
    set('m-error-rate', d.errorRate + '%');
    set('m-4xx', d.statusCodes['4xx']);
    set('m-5xx', d.statusCodes['5xx']);
    set('m-uptime', formatUptime(d.uptime));
    set('m-cpu', d.cpu + '%');

    // Error rate colour
    const errEl = document.getElementById('m-error-rate');
    if (errEl) {
        errEl.style.color = d.errorRate > 5
            ? 'var(--danger)'
            : d.errorRate > 1 ? 'var(--warning)' : 'var(--success)';
    }

    // ---- Resource bars ----
    set('m-cpu-bar-val', d.cpu + '%');
    setBarWidth('m-cpu-bar', d.cpu);

    const heapPct = d.memory.heapTotal > 0
        ? Math.round((d.memory.heapUsed / d.memory.heapTotal) * 100)
        : 0;
    set('m-heap-used',  d.memory.heapUsed);
    set('m-heap-total', d.memory.heapTotal);
    setBarWidth('m-heap-bar', heapPct);

    // RSS relative to 512 MB ceiling for display
    const rssPct = Math.min(100, Math.round((d.memory.rss / 512) * 100));
    set('m-rss', d.memory.rss);
    setBarWidth('m-rss-bar', rssPct);

    // ---- Status codes ----
    set('m-2xx',     d.statusCodes['2xx'].toLocaleString());
    set('m-4xx-big', d.statusCodes['4xx'].toLocaleString());
    set('m-5xx-big', d.statusCodes['5xx'].toLocaleString());

    // ---- Sparkline ----
    renderSparkline(d.requests.timeline);

    // ---- Top routes ----
    renderTopRoutes(d.topRoutes);

    // ---- Slow requests ----
    renderSlowRequests(d.slowRequests);

    // ---- Last updated ----
    set('m-last-updated', new Date().toLocaleTimeString('vi-VN'));
}

function setBarWidth(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.min(100, Math.max(0, pct)) + '%';
}

function formatUptime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function renderSparkline(timeline) {
    const line = document.getElementById('m-sparkline-line');
    const fill = document.getElementById('m-sparkline-fill');
    if (!line || !fill || !timeline?.length) return;

    const W = 300, H = 60;
    const max = Math.max(...timeline, 1);
    const pts = timeline.map((v, i) => {
        const x = (i / (timeline.length - 1)) * W;
        const y = H - (v / max) * (H - 6);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    line.setAttribute('points', pts.join(' '));

    // Fill area (closed polygon)
    const fillPts = [
        `0,${H}`,
        ...pts,
        `${W},${H}`,
    ];
    fill.setAttribute('points', fillPts.join(' '));
}

function renderTopRoutes(routes) {
    const el = document.getElementById('m-top-routes');
    if (!el) return;

    if (!routes?.length) {
        el.innerHTML = `<div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>Chưa có request nào</p>
        </div>`;
        return;
    }

    const maxCount = routes[0].count || 1;
    el.innerHTML = routes.map(r => {
        const [method, ...pathParts] = r.route.split(' ');
        const path = pathParts.join(' ');
        const msClass = r.avgMs < 100 ? 'ms-fast' : r.avgMs < 400 ? 'ms-medium' : 'ms-slow';
        const barW = Math.round((r.count / maxCount) * 100);
        return `
        <div class="monitor-route-row">
          <span class="monitor-route-method method-${method}">${method}</span>
          <div style="flex:1; min-width:0;">
            <div class="monitor-route-path">${path}</div>
            <div class="monitor-bar-track" style="height:3px; margin-top:4px;">
              <div class="monitor-bar-fill cpu" style="width:${barW}%; transition: width 0.4s;"></div>
            </div>
          </div>
          <div class="monitor-route-stats">
            <span class="monitor-route-count">${r.count}</span>
            <span class="monitor-route-ms ${msClass}">${r.avgMs}ms</span>
          </div>
        </div>`;
    }).join('');
}

function renderSlowRequests(slow) {
    const el = document.getElementById('m-slow-requests');
    if (!el) return;

    if (!slow?.length) {
        el.innerHTML = `<div class="empty-state">
            <i class="fas fa-check-circle" style="color: var(--success); opacity: 0.6;"></i>
            <div class="empty-state-title">No slow requests</div>
            <p>Tất cả requests đều nhanh</p>
        </div>`;
        return;
    }

    el.innerHTML = slow.map(r => {
        const timeStr = new Date(r.ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const statusClass = r.status >= 500 ? 'danger' : r.status >= 400 ? 'warning' : 'success';
        return `
        <div class="monitor-slow-row">
          <span class="monitor-route-method method-${r.method}">${r.method}</span>
          <span class="badge ${statusClass}" style="flex-shrink:0;">${r.status}</span>
          <span class="monitor-slow-path">${r.path}</span>
          <span class="monitor-slow-ms">${r.ms}ms</span>
          <span class="monitor-slow-time">${timeStr}</span>
        </div>`;
    }).join('');
}

/**
 * Load recent users for Overview tab
 */
async function loadRecentUsers() {
    const container = document.getElementById('recent-users-container');
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}/admin/users-stats?limit=8`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        const users = data.users || data.data || [];

        if (!users.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>Chưa có người dùng nào</p>
                </div>`;
            return;
        }

        container.innerHTML = users.map(u => {
            const name    = u.username || u.email || 'Unknown';
            const initials = name.slice(0, 2).toUpperCase();
            const date    = u.createdAt
                ? new Date(u.createdAt).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })
                : '-';
            const role    = u.role === 'admin' ? 'Admin' : 'User';
            const isAdmin = u.role === 'admin';
            return `
                <div class="recent-user-item">
                    <div class="recent-user-avatar" style="${isAdmin ? 'background: linear-gradient(135deg,#E11D48,#F97316)' : ''}">
                        ${initials}
                    </div>
                    <div class="recent-user-info">
                        <div class="recent-user-name">${name}</div>
                        <div class="recent-user-date">${date}</div>
                    </div>
                    <span class="recent-user-badge ${isAdmin ? 'badge danger' : ''}">${role}</span>
                </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Không thể tải dữ liệu</p>
            </div>`;
    }
}

// ===================================
// REPORTS TAB
// ===================================
let reportsPage = 1;
const reportsLimit = 20;

async function loadReportStats() {
    try {
        const res = await fetch(`${API_URL}/reports/stats`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        if (!data.success) return;
        const s = data.data;
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? '–'; };
        setText('rpt-pending',  s.pending);
        setText('rpt-reviewed', s.reviewed);
        setText('rpt-resolved', s.resolved);
        setText('rpt-total',    s.total);

        // Update sidebar badge
        const badge = document.getElementById('sidebar-report-badge');
        if (badge) {
            if (s.pending > 0) {
                badge.textContent = s.pending > 99 ? '99+' : s.pending;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (_) {}
}

async function loadReports(page = 1) {
    reportsPage = page;
    const tbody = document.getElementById('reports-table-body');
    const statusFilter = document.getElementById('rpt-filter-status')?.value || '';
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>`;

    try {
        const params = new URLSearchParams({ page, limit: reportsLimit });
        if (statusFilter) params.set('status', statusFilter);
        const res  = await fetch(`${API_URL}/reports?${params}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        const reports = data.data;
        if (!reports.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-secondary);">Không có báo cáo nào</td></tr>`;
            document.getElementById('reports-pagination').innerHTML = '';
            return;
        }

        const STATUS_LABELS = {
            pending:   ['Chờ xử lý',    'pending'],
            reviewed:  ['Đã xem',        'reviewed'],
            resolved:  ['Đã giải quyết', 'resolved'],
            dismissed: ['Bỏ qua',        'dismissed'],
        };

        tbody.innerHTML = reports.map(r => {
            const [label, cls] = STATUS_LABELS[r.status] || [r.status, ''];
            const date = new Date(r.createdAt).toLocaleString('vi-VN', {
                day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
            });
            const imgHtml = r.imageUrl
                ? `<img class="rpt-image-thumb" src="${r.imageUrl}" alt="ảnh" data-lightbox="${r.imageUrl}" style="cursor:zoom-in;" />`
                : '<span style="color:var(--text-secondary);font-size:12px;">–</span>';
            const shortContent = r.content.length > 120 ? r.content.slice(0, 120) + '…' : r.content;
            return `<tr data-report-id="${r._id}">
                <td><span style="font-weight:600;">${r.username}</span></td>
                <td title="${r.content.replace(/"/g, '&quot;')}" style="max-width:280px;white-space:normal;word-break:break-word;font-size:13px;">${shortContent}</td>
                <td>${imgHtml}</td>
                <td><span class="rpt-badge ${cls}">${label}</span></td>
                <td style="font-size:12px;color:var(--text-secondary);">${date}</td>
                <td>
                    <select class="filter-select rpt-status-select" data-id="${r._id}" style="width:auto;font-size:11px;padding:3px 6px;">
                        <option value="pending"   ${r.status==='pending'   ? 'selected':''}>Chờ xử lý</option>
                        <option value="reviewed"  ${r.status==='reviewed'  ? 'selected':''}>Đã xem</option>
                        <option value="resolved"  ${r.status==='resolved'  ? 'selected':''}>Giải quyết</option>
                        <option value="dismissed" ${r.status==='dismissed' ? 'selected':''}>Bỏ qua</option>
                    </select>
                    <button class="btn btn-danger btn-sm rpt-delete-btn" data-id="${r._id}" style="margin-top:4px;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

        // Event delegation on tbody (avoids inline handlers blocked by CSP)
        tbody.querySelectorAll('[data-lightbox]').forEach(img => {
            img.addEventListener('click', () => openRptLightbox(img.dataset.lightbox));
        });
        tbody.querySelectorAll('.rpt-status-select').forEach(sel => {
            sel.addEventListener('change', () => updateReportStatus(sel.dataset.id, sel.value));
        });
        tbody.querySelectorAll('.rpt-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteReport(btn.dataset.id));
        });

        // Pagination
        const { total, pages } = data.pagination;
        renderReportsPagination(page, pages, total);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--danger);">❌ ${err.message}</td></tr>`;
    }
}

function renderReportsPagination(current, total, count) {
    const pag = document.getElementById('reports-pagination');
    if (!pag) return;
    if (total <= 1) { pag.innerHTML = ''; return; }
    pag.innerHTML = `<span class="filter-results-text"><strong>${count}</strong> báo cáo</span><div style="display:flex;gap:4px;"></div>`;
    const btnWrap = pag.querySelector('div');
    for (let i = 1; i <= total; i++) {
        const btn = document.createElement('button');
        btn.className = `btn btn-ghost btn-sm${i === current ? ' btn-primary' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => loadReports(i));
        btnWrap.appendChild(btn);
    }
}

async function updateReportStatus(id, status) {
    try {
        await fetch(`${API_URL}/reports/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ status }),
        });
        await loadReportStats();
    } catch (_) {}
}

async function deleteReport(id) {
    if (!confirm('Xóa báo cáo này?')) return;
    try {
        await fetch(`${API_URL}/reports/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` },
        });
        loadReports(reportsPage);
        loadReportStats();
    } catch (_) {}
}

function openRptLightbox(src) {
    // Remove any existing lightbox first
    document.getElementById('rpt-lightbox')?.remove();

    const lb = document.createElement('div');
    lb.id = 'rpt-lightbox';
    lb.innerHTML = `<img src="${src}" alt="Report image" />`;
    lb.addEventListener('click', () => lb.remove());
    document.body.appendChild(lb);
}

// ===================================
// USER GROWTH CHART
// ===================================
async function loadGrowthChart(days = 30) {
    const wrap  = document.getElementById('growth-chart-inner');
    const empty = document.getElementById('growth-chart-empty');
    const bars  = document.getElementById('growth-chart-bars');
    if (!wrap || !bars) return;

    if (empty) { empty.style.display = 'flex'; wrap.style.display = 'none'; }

    try {
        const res  = await fetch(`${API_URL}/admin/stats/growth?days=${days}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        if (!data.success || !data.data?.length) throw new Error('no data');

        const pts     = data.data;
        const max     = Math.max(...pts.map(p => p.count), 1);
        const total   = pts.reduce((s, p) => s + p.count, 0);

        bars.innerHTML = pts.map(p => {
            const pct = Math.round((p.count / max) * 100);
            const label = new Date(p.date).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' });
            return `<div class="growth-bar-wrap" title="${label}: ${p.count} người dùng">
                <div class="growth-tooltip">${label}: <strong>${p.count}</strong></div>
                <div class="growth-bar" style="height:${Math.max(pct, p.count>0?4:1)}px;"></div>
            </div>`;
        }).join('');

        const first = new Date(pts[0].date).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit'});
        const last  = new Date(pts[pts.length-1].date).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit'});
        document.getElementById('growth-label-start') && (document.getElementById('growth-label-start').textContent = first);
        document.getElementById('growth-label-end')   && (document.getElementById('growth-label-end').textContent   = last);
        document.getElementById('growth-label-total') && (document.getElementById('growth-label-total').textContent = `+${total} tài khoản mới`);

        if (empty) empty.style.display = 'none';
        wrap.style.display = 'block';
    } catch (err) {
        if (empty) {
            empty.innerHTML = '<i class="fas fa-chart-bar" style="opacity:0.3;"></i><p>Chưa có dữ liệu</p>';
            empty.style.display = 'flex';
        }
    }
}

// ===================================
// WORD MODAL — TAB & JSON IMPORT
// ===================================

function closeWordModal() {
    const modal = document.getElementById("add-word-modal");
    if (!modal) return;
    modal.style.display = "none";
    document.getElementById("add-word-form")?.reset();
    delete modal.dataset.editMode;
    delete modal.dataset.originalEn;
    modal.querySelector("h3").innerHTML = '➕ Add New Word';
    modal.querySelector('button[type="submit"]').textContent = 'Add Word';
    document.getElementById("word-json-input").value = '';
    document.getElementById("word-json-result").style.display = 'none';
    switchWordModalTab('manual');
}

function switchWordModalTab(tab) {
    const manualForm = document.getElementById("add-word-form");
    const jsonPanel  = document.getElementById("word-json-panel");
    const tabManual  = document.getElementById("tab-manual");
    const tabJson    = document.getElementById("tab-json");

    const activeStyle   = { background: 'var(--primary)', color: '#fff' };
    const inactiveStyle = { background: '#f5f5f5', color: '#666' };

    if (tab === 'json') {
        manualForm.style.display = 'none';
        jsonPanel.style.display  = 'block';
        Object.assign(tabJson.style,   activeStyle);
        Object.assign(tabManual.style, inactiveStyle);
    } else {
        manualForm.style.display = 'block';
        jsonPanel.style.display  = 'none';
        Object.assign(tabManual.style, activeStyle);
        Object.assign(tabJson.style,   inactiveStyle);
    }
}

async function submitJsonImport() {
    const raw = document.getElementById("word-json-input").value.trim();
    const resultDiv = document.getElementById("word-json-result");

    if (!raw) { showToast('Vui lòng nhập JSON', 'error'); return; }

    let words;
    try {
        const parsed = JSON.parse(raw);
        words = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
        showToast('JSON không hợp lệ: ' + e.message, 'error');
        return;
    }

    if (words.length === 0) { showToast('Không có từ nào trong JSON', 'error'); return; }

    const btn = document.getElementById("btn-submit-json");
    btn.disabled = true;
    btn.textContent = 'Đang import...';
    resultDiv.style.display = 'none';

    let inserted = 0, updated = 0, errors = [];

    try {
        const res = await fetch(`${API_URL}/vocabulary/upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(words),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Server error');
        inserted = data.inserted || 0;
        updated  = data.updated  || 0;
        errors   = (data.errors  || []).map(e => `"${e.en}": ${e.message}`);
    } catch (e) {
        showToast('Lỗi import: ' + e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Import JSON';
        return;
    }

    btn.disabled = false;
    btn.textContent = 'Import JSON';

    const total = words.length;
    const ok = inserted + updated;
    resultDiv.style.display = 'block';
    resultDiv.style.background = errors.length === total ? '#fef2f2' : ok === total ? '#f0fdf4' : '#fffbeb';
    resultDiv.style.border = `1px solid ${errors.length === total ? '#fca5a5' : ok === total ? '#86efac' : '#fcd34d'}`;
    resultDiv.innerHTML = `
        <b>${total} từ</b> — ✅ ${inserted} thêm mới · 🔄 ${updated} cập nhật · ❌ ${errors.length} lỗi
        ${errors.length ? '<ul style="margin:8px 0 0;padding-left:18px;color:#dc2626">' + errors.map(e => `<li>${e}</li>`).join('') + '</ul>' : ''}
    `;

    if (ok > 0) {
        await loadLocalVocabulary(currentLocalFile);
        displayLocalVocabulary();
        updateLocalPartFilter();
    }
}

// ===================================
// TOPICS TAB
// ===================================

async function loadTopicsTab() {
    const tbody = document.getElementById('topics-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>`;

    try {
        const res = await fetch(`${API_URL}/topics/all`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        renderTopicsTable(data.data);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:#ef4444;text-align:center;padding:20px;">${err.message}</td></tr>`;
    }
}

function renderTopicsTable(topics) {
    const tbody = document.getElementById('topics-tbody');
    if (!topics.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b;padding:30px;">Chưa có đề nào. Nhấn "+ Thêm đề" để tạo.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    topics.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size:20px;text-align:center;">${t.icon || '📚'}</td>
            <td>
                <strong>${t.displayName}</strong>
                ${t.description ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${t.description}</div>` : ''}
            </td>
            <td><span class="badge info" style="font-family:monospace;">${(t.sourceKeys || []).join(', ')}</span></td>
            <td><strong>${t.wordCount.toLocaleString()}</strong> từ</td>
            <td style="text-align:center;">${t.order}</td>
            <td style="text-align:center;">
                <span class="badge ${t.isPublic ? 'success' : ''}" style="${!t.isPublic ? 'background:#374151;color:#9ca3af;' : ''}">
                    ${t.isPublic ? 'Hiện' : 'Ẩn'}
                </span>
            </td>
            <td>
                <button class="btn btn-ghost btn-sm topic-btn-sync" title="Sync wordCount"><i class="fas fa-sync"></i></button>
                <button class="btn btn-primary btn-sm topic-btn-edit"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm topic-btn-delete"><i class="fas fa-trash"></i></button>
            </td>`;

        tr.querySelector('.topic-btn-sync').addEventListener('click', () => syncTopicCount(t._id));
        tr.querySelector('.topic-btn-edit').addEventListener('click', () => showTopicModal(t));
        tr.querySelector('.topic-btn-delete').addEventListener('click', () => deleteTopicConfirm(t._id, t.displayName));
        tbody.appendChild(tr);
    });
}

function openAddTopicModal() {
    showTopicModal(null);
}

function openEditTopicModal(topic) {
    showTopicModal(topic);
}

function showTopicModal(topic) {
    const isEdit = !!topic;
    const existing = document.getElementById('topic-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'topic-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
        <div style="background:#1e293b;border:1px solid #334155;border-radius:14px;width:480px;max-width:95vw;padding:28px;">
            <h3 style="margin:0 0 20px;font-size:17px;">${isEdit ? 'Sửa đề' : 'Thêm đề mới'}</h3>
            <div style="display:grid;gap:14px;">
                <div>
                    <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">SOURCE KEYS <span style="color:#ef4444">*</span></label>
                    <input id="ti-sourceKey" value="${(topic?.sourceKeys || []).join(', ')}"
                        placeholder="vd: ets2024, 600words" style="width:100%;padding:9px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-family:monospace;">
                    <div style="font-size:11px;color:#64748b;margin-top:4px;">Nhiều giá trị cách nhau bằng dấu phẩy. Phải khớp với sources trong vocabulary.</div>
                </div>
                <div>
                    <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">TÊN HIỂN THỊ <span style="color:#ef4444">*</span></label>
                    <input id="ti-displayName" value="${topic?.displayName || ''}" placeholder="vd: ETS 2024"
                        style="width:100%;padding:9px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div>
                        <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">ICON (emoji)</label>
                        <input id="ti-icon" value="${topic?.icon || '📚'}" style="width:100%;padding:9px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:18px;">
                    </div>
                    <div>
                        <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">MÀU</label>
                        <input type="color" id="ti-color" value="${topic?.color || '#3b82f6'}" style="width:100%;height:38px;padding:2px;background:#0f172a;border:1px solid #334155;border-radius:8px;cursor:pointer;">
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div>
                        <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">THỨ TỰ</label>
                        <input type="number" id="ti-order" value="${topic?.order ?? 0}" style="width:100%;padding:9px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;">
                    </div>
                    <div style="display:flex;align-items:flex-end;padding-bottom:2px;">
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#e2e8f0;">
                            <input type="checkbox" id="ti-isPublic" ${topic?.isPublic !== false ? 'checked' : ''}
                                style="width:16px;height:16px;accent-color:#3b82f6;"> Hiển thị cho người dùng
                        </label>
                    </div>
                </div>
                <div>
                    <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">MÔ TẢ</label>
                    <input id="ti-description" value="${topic?.description || ''}" placeholder="Mô tả ngắn về đề này..."
                        style="width:100%;padding:9px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;">
                </div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;">
                <button id="ti-btn-cancel" class="btn btn-ghost">Hủy</button>
                <button id="ti-btn-save" class="btn btn-success">
                    <i class="fas fa-save"></i> ${isEdit ? 'Lưu' : 'Tạo'}
                </button>
            </div>
        </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#ti-btn-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#ti-btn-save').addEventListener('click', () => saveTopicModal(topic?._id || '', modal));
}

async function saveTopicModal(id, modal) {
    const body = {
        sourceKeys: document.getElementById('ti-sourceKey')?.value.trim(),
        displayName: document.getElementById('ti-displayName')?.value.trim(),
        icon: document.getElementById('ti-icon')?.value.trim(),
        color: document.getElementById('ti-color')?.value,
        order: parseInt(document.getElementById('ti-order')?.value) || 0,
        isPublic: document.getElementById('ti-isPublic')?.checked,
        description: document.getElementById('ti-description')?.value.trim(),
    };

    if (!body.displayName) return showToast('Vui lòng nhập tên hiển thị', 'warning');
    if (!id && !body.sourceKeys) return showToast('Vui lòng nhập sourceKeys', 'warning');

    const isEdit = !!id;
    const url = isEdit ? `${API_URL}/topics/${id}` : `${API_URL}/topics`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        (modal || document.getElementById('topic-modal'))?.remove();
        showToast(isEdit ? 'Đã cập nhật đề' : 'Đã tạo đề mới', 'success');
        loadTopicsTab();
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
    }
}

async function syncTopicCount(id) {
    try {
        const res = await fetch(`${API_URL}/topics/${id}/sync-count`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` },
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        showToast(`Đã sync: ${data.data.wordCount} từ`, 'success');
        loadTopicsTab();
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
    }
}

async function deleteTopicConfirm(id, name) {
    if (!confirm(`Xóa đề "${name}"?\nTừ vựng trong DB không bị xóa.`)) return;
    try {
        const res = await fetch(`${API_URL}/topics/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` },
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        showToast('Đã xóa đề', 'success');
        loadTopicsTab();
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
    }
}

// ===================================
// UPLOAD MANAGEMENT TAB (Monitoring)
// ===================================

function initUploadManagement() {
    const refreshBtn = document.getElementById('btn-refresh-uploads');
    refreshBtn?.addEventListener('click', () => loadUploadMonitoring());
    loadUploadMonitoring();
}

async function loadUploadMonitoring() {
    const tbody = document.getElementById('upload-monitoring-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="padding: 30px; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin"></i> Đang tải dữ liệu...
            </td>
        </tr>
    `;

    try {
        const response = await fetch('/api/upload/admin/monitoring', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        const uploads = result.data || [];
        document.getElementById('upload-total-count').textContent = uploads.length;

        if (uploads.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                        <i class="fas fa-inbox" style="font-size: 32px; opacity: 0.3; display: block; margin-bottom: 10px;"></i>
                        Chưa có upload nào
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = uploads.map(u => {
            const statusColor = u.status === 'active' ? '#10b981' : '#ef4444';
            const statusLabel = u.status === 'active' ? '✓ Allowed' : '✗ Blocked';
            const statusBg = u.status === 'active' ? '#dcfce7' : '#fee2e2';
            const preview = (u.contentPreview || []).slice(0, 3).join(', ');
            const more = u.wordCount > 3 ? ` +${u.wordCount - 3}` : '';

            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px; font-weight: 500;">${u.email}</td>
                    <td style="padding: 12px; font-size: 13px;">
                        <code style="background: var(--bg-tertiary); padding: 2px 8px; border-radius: 4px; font-size: 12px;">${u.source}</code>
                    </td>
                    <td style="padding: 12px; font-size: 13px; color: var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis;">
                        <span title="${(u.contentPreview || []).join(', ')}">${preview}${more}</span>
                    </td>
                    <td style="padding: 12px; text-align: right; font-family: monospace; font-weight: 600;">${u.wordCount}</td>
                    <td style="padding: 12px; text-align: center;">
                        <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ${statusBg}; color: ${statusColor};">
                            ${statusLabel}
                        </span>
                    </td>
                    <td style="padding: 12px; text-align: center; font-size: 12px; color: var(--text-secondary);">
                        ${new Date(u.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Error loading uploads:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="padding: 20px; text-align: center; color: #ef4444;">
                    Lỗi tải dữ liệu: ${err.message}
                </td>
            </tr>
        `;
    }
}

// ===================================
// TOKEN MANAGEMENT TAB
// ===================================

async function loadTokenStats() {
    try {
        const response = await fetch('/api/upload/admin/stats', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        const stats = result.data;
        const totalEl = document.getElementById('token-total');
        const monthEl = document.getElementById('token-month');
        const uploadsEl = document.getElementById('token-uploads');
        if (totalEl) totalEl.textContent = (stats.totalWords || 0).toLocaleString();
        if (monthEl) monthEl.textContent = (stats.totalUsers || 0).toLocaleString();
        if (uploadsEl) uploadsEl.textContent = (stats.totalSources || 0).toLocaleString();

        const tbody = document.getElementById('token-history-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="padding: 20px; text-align: center; color: var(--text-secondary);">
                        Xem chi tiết ở tab Upload Management
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error('Error loading stats:', err);
        showToast(`Lỗi tải stats: ${err.message}`, 'error');
    }
}

// ===================================
// USER STATS TAB
// ===================================

let usPage = 1;
let usSearch = '';

async function loadUserStats(page = 1, search = null) {
    usPage = page;
    if (search !== null) usSearch = search;
    else usSearch = document.getElementById('us-search')?.value.trim() || '';
    const tbody = document.getElementById('us-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:20px">Đang tải...</td></tr>`;

    try {
        const params = new URLSearchParams({ page, limit: 30, search });
        const res = await fetch(`/api/admin/users-stats?${params}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        const { data, pagination } = result;
        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--text-secondary)">Không có dữ liệu</td></tr>`;
            document.getElementById('us-pagination')?.replaceChildren();
            return;
        }

        const totalEl = document.getElementById('us-total');
        if (totalEl) totalEl.textContent = `Tổng: ${pagination.total} người dùng`;

        tbody.innerHTML = data.map(u => `
            <tr>
                <td>${u.email}</td>
                <td>${u.username || '-'}</td>
                <td style="text-align:center">${u.level}</td>
                <td style="text-align:right">${(u.xp||0).toLocaleString()}</td>
                <td style="text-align:right">${(u.coins||0).toLocaleString()}</td>
                <td style="text-align:right">${(u.gems||0).toLocaleString()}</td>
                <td style="text-align:center">${u.streakCurrent}</td>
                <td style="text-align:center">${u.totalSessions}</td>
                <td style="text-align:center">${u.totalCorrect}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-success'}">${u.role}</span></td>
                <td style="font-size:12px;color:var(--text-secondary)">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline us-ach-btn"
                        data-uid="${u._id}" data-email="${u.email.replace(/"/g,'&quot;')}">
                        <i class="fas fa-trophy"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.us-ach-btn').forEach(btn => {
            btn.addEventListener('click', () => openUserAchievementsFor(btn.dataset.uid, btn.dataset.email));
        });

        renderUsPagination(pagination);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--danger-color)">Lỗi: ${err.message}</td></tr>`;
    }
}

function renderUsPagination(pg) {
    const wrap = document.getElementById('us-pagination');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (pg.pages <= 1) return;

    const makeBtn = (label, p, disabled = false) => {
        const b = document.createElement('button');
        b.className = 'btn btn-sm ' + (p === pg.page ? 'btn-primary' : 'btn-outline');
        b.textContent = label;
        b.disabled = disabled;
        if (!disabled) b.onclick = () => loadUserStats(p, usSearch);
        return b;
    };

    wrap.appendChild(makeBtn('«', 1, pg.page === 1));
    wrap.appendChild(makeBtn('‹', pg.page - 1, pg.page === 1));

    const start = Math.max(1, pg.page - 2);
    const end   = Math.min(pg.pages, pg.page + 2);
    for (let i = start; i <= end; i++) wrap.appendChild(makeBtn(i, i));

    wrap.appendChild(makeBtn('›', pg.page + 1, pg.page === pg.pages));
    wrap.appendChild(makeBtn('»', pg.pages, pg.page === pg.pages));
}

// ===================================
// USER ACHIEVEMENTS TAB
// ===================================

let _uaPage = 1;
let _uaSearch = '';
let _uaSearchTimer = null;
let _uaAutoExpandId = null;

function initUserAchievementsTab() {
    const input = document.getElementById('ua-search-input');
    if (!input || input.dataset.uaInited) return;
    input.dataset.uaInited = '1';

    input.addEventListener('input', () => {
        clearTimeout(_uaSearchTimer);
        _uaSearchTimer = setTimeout(() => loadUaUsers(1, input.value.trim()), 280);
    });

    loadUaUsers(1);
}

async function loadUaUsers(page = 1, search = null) {
    _uaPage = page;
    if (search !== null) _uaSearch = search;
    const tbody = document.getElementById('ua-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>`;

    try {
        const params = new URLSearchParams({ page: _uaPage, limit: 20, search: _uaSearch });
        const res = await fetch(`/api/admin/users-stats?${params}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        const { data, pagination } = result;
        const totalEl = document.getElementById('ua-total');
        if (totalEl) totalEl.textContent = `${pagination.total} người dùng`;

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:32px 0">Không tìm thấy người dùng nào.</td></tr>`;
            renderUaPagination(pagination);
            return;
        }

        const offset = (_uaPage - 1) * 20;
        tbody.innerHTML = data.map((u, idx) => `
            <tr class="ua-user-row" data-uid="${u._id}" style="cursor:pointer">
                <td style="color:var(--text-secondary)">${offset + idx + 1}</td>
                <td style="font-weight:600">${u.username || '—'}</td>
                <td>${u.email}</td>
                <td style="font-size:13px;color:var(--text-secondary)">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                <td style="text-align:center"><i class="fas fa-chevron-down ua-chevron" style="transition:transform .2s;color:var(--text-secondary)"></i></td>
            </tr>
            <tr class="ua-expand-row" data-for="${u._id}" style="display:none">
                <td colspan="5" style="padding:0;background:var(--bg-secondary)">
                    <div class="ua-ach-panel" style="padding:12px 24px 16px">
                        <p style="color:var(--text-secondary);font-size:13px;margin:0"><i class="fas fa-spinner fa-spin"></i> Đang tải...</p>
                    </div>
                </td>
            </tr>
        `).join('');

        // Gắn listener trực tiếp vào từng row (đáng tin cậy hơn delegation)
        tbody.querySelectorAll('.ua-user-row').forEach(row => {
            row.addEventListener('click', () => _toggleUaRow(row));
        });

        renderUaPagination(pagination);

        if (_uaAutoExpandId) {
            const targetRow = document.querySelector(`.ua-user-row[data-uid="${_uaAutoExpandId}"]`);
            if (targetRow) {
                _uaAutoExpandId = null;
                targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                _toggleUaRow(targetRow);
            }
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger-color);padding:24px">Lỗi: ${err.message}</td></tr>`;
    }
}

function _toggleUaRow(row) {
    const uid = row.dataset.uid;
    const expandRow = row.nextElementSibling;
    if (!expandRow || !expandRow.classList.contains('ua-expand-row')) return;
    const chevron = row.querySelector('.ua-chevron');

    const isOpen = expandRow.style.display === 'table-row';
    if (isOpen) {
        expandRow.style.display = 'none';
        if (chevron) chevron.style.transform = '';
    } else {
        expandRow.style.display = 'table-row';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        if (!row.dataset.loaded) {
            row.dataset.loaded = '1';
            _loadUaAchievements(uid, expandRow.querySelector('.ua-ach-panel'));
        }
    }
}

async function _loadUaAchievements(uid, panel) {
    if (!panel) return;
    try {
        const res = await fetch(`/api/admin/user-achievements?userId=${uid}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        if (!result.data.length) {
            panel.innerHTML = `<p style="color:var(--text-secondary);font-size:13px;margin:0">Chưa có thành tích nào.</p>`;
            return;
        }

        panel.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead>
                    <tr style="border-bottom:1px solid var(--border-color)">
                        <th style="padding:6px 8px;text-align:left;color:var(--text-secondary);font-weight:600;width:32px">#</th>
                        <th style="padding:6px 8px;width:40px"></th>
                        <th style="padding:6px 8px;text-align:left;color:var(--text-secondary);font-weight:600">Tên thành tích</th>
                        <th style="padding:6px 8px;text-align:left;color:var(--text-secondary);font-weight:600">Mô tả</th>
                        <th style="padding:6px 8px;text-align:left;color:var(--text-secondary);font-weight:600;width:110px">Ngày đạt</th>
                        <th style="padding:6px 8px;text-align:left;color:var(--text-secondary);font-weight:600;width:190px">Phần thưởng</th>
                    </tr>
                </thead>
                <tbody>
                    ${result.data.map((a, i) => {
                        const rewards = [];
                        if (a.rewardXp)    rewards.push(`<span class="badge info">+${a.rewardXp} XP</span>`);
                        if (a.rewardCoins) rewards.push(`<span class="badge warning">+${a.rewardCoins} coins</span>`);
                        if (a.rewardGems)  rewards.push(`<span class="badge success">+${a.rewardGems} gems</span>`);
                        return `<tr style="border-bottom:1px solid var(--border-color)">
                            <td style="padding:8px">${i + 1}</td>
                            <td style="padding:8px;font-size:18px;text-align:center">${a.icon || '🏆'}</td>
                            <td style="padding:8px;font-weight:600">${a.name || '—'}</td>
                            <td style="padding:8px;color:var(--text-secondary)">${a.description || ''}</td>
                            <td style="padding:8px">${new Date(a.unlockedAt).toLocaleDateString('vi-VN')}</td>
                            <td style="padding:8px">${rewards.length ? rewards.join(' ') : '<span style="color:var(--text-secondary)">—</span>'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
    } catch (err) {
        panel.innerHTML = `<p style="color:var(--danger-color);font-size:13px;margin:0">Lỗi: ${err.message}</p>`;
    }
}

function renderUaPagination(pagination) {
    const container = document.getElementById('ua-pagination');
    if (!container) return;
    if (!pagination || pagination.pages <= 1) { container.innerHTML = ''; return; }
    const { page, pages } = pagination;
    let html = '';
    if (page > 1) html += `<button class="btn btn-sm btn-ghost" onclick="loadUaUsers(${page - 1})">‹</button>`;
    for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) {
        html += `<button class="btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}" onclick="loadUaUsers(${p})">${p}</button>`;
    }
    if (page < pages) html += `<button class="btn btn-sm btn-ghost" onclick="loadUaUsers(${page + 1})">›</button>`;
    container.innerHTML = html;
}

function openUserAchievementsFor(userId, email) {
    _uaAutoExpandId = userId;
    document.querySelector('.sidebar-link[data-main-tab="user-achievements"]')?.click();
    setTimeout(() => {
        const input = document.getElementById('ua-search-input');
        if (input) input.value = email;
        loadUaUsers(1, email);
    }, 50);
}

// ===================================
// BROADCAST TAB
// ===================================

function toggleBcUser(val) {
    const row = document.getElementById('bc-user-row');
    if (row) row.style.display = (val === 'one') ? '' : 'none';
}

function _onBcTypeChange() {
    const type = document.getElementById('bc-type')?.value;
    const emailInput = document.getElementById('bc-user-email');
    if (type === 'violation') {
        if (emailInput) emailInput.placeholder = 'Bắt buộc nhập email người vi phạm...';
    } else {
        if (emailInput) emailInput.placeholder = 'Để trống = gửi tất cả. Nhập email để gửi 1 người...';
        // Clear selection if switching away from violation
    }
}

let _bcSearchTimer = null;

function _initBcEmailSearch() {
    const input = document.getElementById('bc-user-email');
    const suggestions = document.getElementById('bc-user-suggestions');
    const hiddenId = document.getElementById('bc-user-id');
    const selectedLabel = document.getElementById('bc-user-selected');
    if (!input) return;

    input.addEventListener('input', () => {
        // Clear selection when user types
        if (hiddenId) hiddenId.value = '';
        if (selectedLabel) selectedLabel.style.display = 'none';

        clearTimeout(_bcSearchTimer);
        const q = input.value.trim();
        if (q.length < 2) { if (suggestions) suggestions.style.display = 'none'; return; }
        _bcSearchTimer = setTimeout(() => _bcSearchUsers(q), 300);
    });

    input.addEventListener('blur', () => {
        setTimeout(() => { if (suggestions) suggestions.style.display = 'none'; }, 200);
    });
}

async function _bcSearchUsers(q) {
    const suggestions = document.getElementById('bc-user-suggestions');
    if (!suggestions) return;
    try {
        const res = await fetch(`/api/admin/users-stats?search=${encodeURIComponent(q)}&limit=6`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        const users = result.data || [];
        if (!users.length) { suggestions.style.display = 'none'; return; }

        suggestions.innerHTML = users.map(u => `
            <div class="bc-suggest-item" data-id="${u._id}" data-email="${u.email}"
              style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border-color);">
              <div style="font-weight:600;color:var(--text-primary)">${u.email}</div>
              ${u.displayName || u.username ? `<div style="font-size:11px;color:var(--text-secondary)">${u.displayName || u.username}</div>` : ''}
            </div>
        `).join('');
        suggestions.style.display = 'block';

        suggestions.querySelectorAll('.bc-suggest-item').forEach(item => {
            item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-secondary)'; });
            item.addEventListener('mouseleave', () => { item.style.background = ''; });
            item.addEventListener('mousedown', () => {
                const id = item.dataset.id;
                const email = item.dataset.email;
                document.getElementById('bc-user-id').value = id;
                document.getElementById('bc-user-email').value = email;
                const label = document.getElementById('bc-user-selected');
                if (label) { label.textContent = `✓ Đã chọn: ${email}`; label.style.display = 'block'; }
                suggestions.style.display = 'none';
            });
        });
    } catch (_) { suggestions.style.display = 'none'; }
}

async function sendBroadcast() {
    const title  = document.getElementById('bc-title')?.value.trim();
    const body   = document.getElementById('bc-body')?.value.trim();
    const type   = document.getElementById('bc-type')?.value || 'system';
    const userId = document.getElementById('bc-user-id')?.value || '';
    const userEmail = document.getElementById('bc-user-email')?.value.trim() || '';
    const btn    = document.getElementById('bc-send-btn');

    if (!title) { showToast('Tiêu đề không được trống', 'error'); return; }
    if (type === 'violation' && !userEmail) { showToast('Vi phạm phải chọn người dùng cụ thể', 'error'); return; }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...'; }

    try {
        const payload = { title, body, type };
        if (userId)    payload.userId    = userId;
        if (userEmail) payload.userEmail = userEmail;

        const res = await fetch('/api/admin/notifications/broadcast', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        showToast(`Đã gửi thành công cho ${result.sent} người dùng`, 'success');
        document.getElementById('bc-title').value = '';
        document.getElementById('bc-body').value  = '';
        document.getElementById('bc-user-email').value = '';
        document.getElementById('bc-user-id').value = '';
        const lbl = document.getElementById('bc-user-selected');
        if (lbl) lbl.style.display = 'none';
        loadNotifHistory();
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi thông báo'; }
    }
}

const NOTIF_TYPE_META = {
    system:      { label: 'Hệ thống',  color: '#3b82f6', bg: '#eff6ff' },
    reminder:    { label: 'Nhắc nhở',  color: '#f59e0b', bg: '#fffbeb' },
    achievement: { label: 'Thành tích',color: '#8b5cf6', bg: '#f5f3ff' },
    quest:       { label: 'Nhiệm vụ',  color: '#10b981', bg: '#ecfdf5' },
    level_up:    { label: 'Lên cấp',   color: '#06b6d4', bg: '#ecfeff' },
    test_result: { label: 'Kết quả thi',color:'#6366f1', bg: '#eef2ff' },
    violation:   { label: 'Vi phạm',   color: '#ef4444', bg: '#fef2f2' },
};

async function loadNotifHistory() {
    const list = document.getElementById('bc-history');
    if (!list) return;
    list.innerHTML = '<p style="color:var(--text-secondary)">Đang tải...</p>';

    try {
        const res = await fetch('/api/admin/notifications?limit=30', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        if (!result.data.length) {
            list.innerHTML = '<p style="color:var(--text-secondary);font-size:13px">Chưa có thông báo nào.</p>';
            return;
        }

        list.innerHTML = result.data.map(n => {
            const meta = NOTIF_TYPE_META[n.type] || { label: n.type, color: '#6b7280', bg: '#f3f4f6' };
            return `
            <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:12px" id="nhi-${n._id}">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;background:${meta.bg};color:${meta.color};border:1px solid ${meta.color}33">${meta.label}</span>
                    <span style="color:var(--text-secondary);font-size:12px">${new Date(n.createdAt).toLocaleString('vi-VN')}</span>
                    <button class="btn btn-sm nhi-del-btn" data-id="${n._id}" style="margin-left:auto;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;padding:2px 8px;font-size:11px;border-radius:6px">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div style="font-weight:600;margin-top:6px">${n.title}</div>
                ${n.body ? `<div style="color:var(--text-secondary);font-size:13px;margin-top:2px">${n.body}</div>` : ''}
                <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">
                    Gửi tới: <b>${n.userId?.email || 'N/A'}</b> · ${n.read ? '<span style="color:#10b981">✓ Đã đọc</span>' : '<span style="color:#f59e0b">Chưa đọc</span>'}
                </div>
            </div>`;
        }).join('');

        list.querySelectorAll('.nhi-del-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteNotif(btn.dataset.id, btn));
        });
    } catch (err) {
        list.innerHTML = `<p style="color:var(--danger-color)">Lỗi: ${err.message}</p>`;
    }
}

async function deleteNotif(id, btn) {
    if (!confirm('Xóa thông báo này?')) return;
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(`/api/admin/notifications/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        document.getElementById(`nhi-${id}`)?.remove();
        showToast('Đã xóa', 'success');
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
        if (btn) btn.disabled = false;
    }
}

// ===================================
// PRACTICE HISTORY (12 MODES) TAB
// ===================================

const MODE_LABELS = {
    'multiple-choice': 'Multiple Choice',
    'fill-blank':      'Fill Blank',
    'listening':       'Listening',
    'matching':        'Matching',
    'speed-quiz':      'Speed Quiz',
    'flashcard':       'Flashcard',
    'synonym-check':   'Synonym Check',
    'word-type-check': 'Word Type',
    'word-scramble':   'Word Scramble',
};

let phPage = 1;

async function loadPracticeHistory12(page = 1, search = null, mode = null) {
    phPage = page;
    if (search === null) search = document.getElementById('ph-search')?.value.trim() || '';
    if (mode === null)   mode   = document.getElementById('ph-mode')?.value || '';

    const tbody = document.getElementById('ph-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px">Đang tải...</td></tr>`;

    try {
        const params = new URLSearchParams({ page, limit: 20, search, mode });
        const res = await fetch(`/api/practice/admin/history?${params}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        const { data, pagination } = result;
        const totalEl = document.getElementById('ph-total');
        if (totalEl) totalEl.textContent = `Tổng: ${pagination.total} phiên`;

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text-secondary)">Không có dữ liệu</td></tr>`;
            document.getElementById('ph-pagination')?.replaceChildren();
            return;
        }

        tbody.innerHTML = data.map(s => {
            const dur = s.duration ? `${Math.floor(s.duration/60)}p${s.duration%60}s` : '-';
            const date = s.completedAt ? new Date(s.completedAt).toLocaleDateString('vi-VN') : '-';
            const acc  = s.questionsCount > 0 ? Math.round((s.correctAnswers/s.questionsCount)*100) : 0;
            return `<tr>
                <td>${s.user?.email || '-'}</td>
                <td><span class="badge badge-info">${MODE_LABELS[s.mode] || s.mode}</span></td>
                <td style="text-align:right">${s.score || 0}</td>
                <td style="text-align:center;color:var(--success-color)">${s.correctAnswers || 0}</td>
                <td style="text-align:center;color:var(--danger-color)">${s.wrongAnswers || 0}</td>
                <td style="text-align:right">${s.xpEarned || 0}</td>
                <td style="text-align:right">${s.coinsEarned || 0}</td>
                <td>${dur}</td>
                <td style="font-size:12px;color:var(--text-secondary)">${date}</td>
                <td>
                    <button class="btn btn-sm btn-danger ph-del-btn" data-id="${s._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.ph-del-btn').forEach(btn => {
            btn.addEventListener('click', () => deletePracticeSession12(btn.dataset.id, btn));
        });

        renderPhPagination(pagination);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--danger-color)">Lỗi: ${err.message}</td></tr>`;
    }
}

function renderPhPagination(pg) {
    const wrap = document.getElementById('ph-pagination');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (pg.pages <= 1) return;

    const makeBtn = (label, p, disabled = false) => {
        const b = document.createElement('button');
        b.className = 'btn btn-sm ' + (p === pg.page ? 'btn-primary' : 'btn-outline');
        b.textContent = label;
        b.disabled = disabled;
        if (!disabled) b.onclick = () => loadPracticeHistory12(p);
        return b;
    };

    wrap.appendChild(makeBtn('«', 1, pg.page === 1));
    wrap.appendChild(makeBtn('‹', pg.page - 1, pg.page === 1));
    const start = Math.max(1, pg.page - 2);
    const end   = Math.min(pg.pages, pg.page + 2);
    for (let i = start; i <= end; i++) wrap.appendChild(makeBtn(i, i));
    wrap.appendChild(makeBtn('›', pg.page + 1, pg.page === pg.pages));
    wrap.appendChild(makeBtn('»', pg.pages, pg.page === pg.pages));
}

async function deletePracticeSession12(id, btn) {
    if (!confirm('Xóa phiên luyện tập này?')) return;
    btn.disabled = true;
    try {
        const res = await fetch(`/api/practice/admin/session/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        btn.closest('tr').remove();
        showToast('Đã xóa', 'success');
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
        btn.disabled = false;
    }
}

async function seedAchievements() {
    if (!confirm('Seed dữ liệu thành tích mặc định vào DB? Sẽ bỏ qua những cái đã có.')) return;
    try {
        const res = await fetch('/api/admin/seed-achievements', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        showToast(result.message, 'success');
        loadAchievements();
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
    }
}

async function seedQuests() {
    if (!confirm('Seed dữ liệu nhiệm vụ mặc định vào DB? Sẽ bỏ qua những cái đã có.')) return;
    try {
        const res = await fetch('/api/admin/seed-quests', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        showToast(result.message, 'success');
        loadQuests();
    } catch (err) {
        showToast(`Lỗi: ${err.message}`, 'error');
    }
}

