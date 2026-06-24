// ===================================
// TOEIC ADMIN MODULE
// Questions, Tests, Users Tab, Practice History
// ===================================

async function loadToeicStats() {
    try {
        const [testsRes, questionsRes] = await Promise.all([
            fetch(`${TOEIC_API_BASE}/tests`,     { headers: { 'Authorization': `Bearer ${getToken()}` } }),
            fetch(`${TOEIC_API_BASE}/questions`, { headers: { 'Authorization': `Bearer ${getToken()}` } }),
        ]);

        const testsData = await testsRes.json();
        await questionsRes.json();

        const testsEl = document.getElementById('toeic-tests-count');
        if (testsEl) {
            testsEl.textContent = testsData.data?.length ?? testsData.count ?? '-';
        }
    } catch (error) {
        console.error('Error loading TOEIC stats:', error);
    }
}

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

    let pageNumbers = '';
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages + 2) {
        for (let i = 1; i <= totalPages; i++) {
            pageNumbers += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-secondary'} pagination-page" data-page="${i}">${i}</button>`;
        }
    } else {
        pageNumbers += `<button class="btn btn-sm ${1 === currentPage ? 'btn-primary' : 'btn-secondary'} pagination-page" data-page="1">1</button>`;

        let start = Math.max(2, currentPage - 1);
        let end = Math.min(totalPages - 1, currentPage + 1);

        if (currentPage <= 3) {
            end = Math.min(4, totalPages - 1);
        } else if (currentPage >= totalPages - 2) {
            start = Math.max(totalPages - 3, 2);
        }

        if (start > 2) {
            pageNumbers += `<span style="padding: 0 8px; color: #999;">...</span>`;
        }

        for (let i = start; i <= end; i++) {
            pageNumbers += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-secondary'} pagination-page" data-page="${i}">${i}</button>`;
        }

        if (end < totalPages - 1) {
            pageNumbers += `<span style="padding: 0 8px; color: #999;">...</span>`;
        }

        pageNumbers += `<button class="btn btn-sm ${totalPages === currentPage ? 'btn-primary' : 'btn-secondary'} pagination-page" data-page="${totalPages}">${totalPages}</button>`;
    }

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; flex-wrap: wrap;">
            <div style="color: #666; font-size: 14px;">
                Hiển thị ${startItem}–${endItem} / ${total} ${itemName}
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

    const firstBtn = container.querySelector('.pagination-first');
    const prevBtn = container.querySelector('.pagination-prev');
    const nextBtn = container.querySelector('.pagination-next');
    const lastBtn = container.querySelector('.pagination-last');

    if (firstBtn && !firstBtn.disabled) firstBtn.addEventListener('click', () => onPageChange(1));
    if (prevBtn && !prevBtn.disabled) prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
    if (nextBtn && !nextBtn.disabled) nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
    if (lastBtn && !lastBtn.disabled) lastBtn.addEventListener('click', () => onPageChange(totalPages));

    container.querySelectorAll('.pagination-page').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page !== currentPage) onPageChange(page);
        });
    });
}

async function loadQuestions(filterPart = '', _page = 1) {
    try {
        questionsPagination.filterPart = filterPart;

        const res = await fetch(`${TOEIC_API_BASE}/questions?limit=1000`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to load questions');
        }

        allQuestions = data.data || [];
        currentQuestions = [...allQuestions];

        if (!window.searchFiltersInitialized) {
            initSearchAndFilters();
            window.searchFiltersInitialized = true;
        }

        applyFiltersAndSort();

    } catch (error) {
        console.error('Error loading questions:', error);
        const tbody = document.querySelector('#questions-table tbody');
        if (tbody) tbody.innerHTML = `
            <tr><td colspan="6" class="loading" style="color: red;">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading questions</p>
            </td></tr>
        `;
    }
}

function renderQuestionsTable() {
    const tbody = document.querySelector('#questions-table tbody');

    if (currentQuestions.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="loading">
                <i class="fas fa-inbox"></i>
                <p>No questions found</p>
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = currentQuestions.map(q => {
        let imageDisplay = '-';
        const firstImage = q.imageUrls?.[0];
        if (firstImage) {
            const imagePath = firstImage.replace('/assets/images/', '');
            imageDisplay = `<span style="color: #3498db; font-size: 0.85em; font-family: monospace;" title="${firstImage}">${truncate(imagePath, 20)}</span>`;
        }

        let audioDisplay = '-';
        if (q.audioUrl) {
            const audioPath = q.audioUrl.replace('/assets/audio/', '');
            audioDisplay = `<span style="color: #e67e22; font-size: 0.85em; font-family: monospace;" title="${q.audioUrl}">${truncate(audioPath, 20)}</span>`;
        }

        let keywordsDisplay = '-';
        let keywordsTitle = '';
        if (q.questionKeyword || q.answerKeyword || q.audioKeyword) {
            const keywords = [];
            const keywordsTitleParts = [];
            if (q.questionKeyword) {
                keywords.push(`<span style="color: #667eea;">Q: ${truncate(q.questionKeyword, 10)}</span>`);
                keywordsTitleParts.push(`Question: ${q.questionKeyword}`);
            }
            if (q.answerKeyword) {
                keywords.push(`<span style="color: #10b981;">A: ${truncate(q.answerKeyword, 10)}</span>`);
                keywordsTitleParts.push(`Answer: ${q.answerKeyword}`);
            }
            if (q.audioKeyword) {
                keywords.push(`<span style="color: #764ba2;">Au: ${truncate(q.audioKeyword, 10)}</span>`);
                keywordsTitleParts.push(`Audio: ${q.audioKeyword}`);
            }
            keywordsDisplay = keywords.join('<br>');
            keywordsTitle = keywordsTitleParts.join(' | ');
        }

        const questionTextFull = q.questionText || 'N/A';

        return `
            <tr>
                <td><span class="part-badge">Part ${q.part}</span></td>
                <td title="${questionTextFull.replace(/"/g, '&quot;')}">${truncate(questionTextFull, 50)}</td>
                <td style="text-align: center; font-weight: 600; color: #667eea;">${q.correctAnswer}</td>
                <td style="text-align: center;" title="${firstImage || ''}">${imageDisplay}</td>
                <td style="text-align: center;" title="${q.audioUrl || ''}">${audioDisplay}</td>
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

    tbody.querySelectorAll('.btn-preview-question').forEach(btn => {
        btn.addEventListener('click', () => {
            highlightQuestionRow(btn);
            previewQuestion(btn.getAttribute('data-question-id'));
        });
    });

    tbody.querySelectorAll('.btn-edit-question').forEach(btn => {
        btn.addEventListener('click', () => {
            highlightQuestionRow(btn);
            editQuestion(btn.getAttribute('data-question-id'));
        });
    });

    tbody.querySelectorAll('.btn-delete-question').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteQuestion(btn.getAttribute('data-question-id'));
        });
    });

    restoreHighlights();
}

function highlightQuestionRow(button) {
    const questionId = button.getAttribute('data-question-id');

    if (highlightedQuestionId && highlightedQuestionId !== questionId) {
        previouslyViewedQuestionIds.add(highlightedQuestionId);
    }

    highlightedQuestionId = questionId;
    restoreHighlights();
}

function restoreHighlights() {
    document.querySelectorAll('#questions-tbody tr').forEach(row => {
        row.classList.remove('row-highlighted', 'row-previously-viewed');
    });

    previouslyViewedQuestionIds.forEach(id => {
        const button = document.querySelector(`[data-question-id="${id}"]`);
        const row = button?.closest('tr');
        if (row) row.classList.add('row-previously-viewed');
    });

    if (highlightedQuestionId) {
        const button = document.querySelector(`[data-question-id="${highlightedQuestionId}"]`);
        const row = button?.closest('tr');
        if (row) {
            row.classList.remove('row-previously-viewed');
            row.classList.add('row-highlighted');
        }
    }
}

function initSearchAndFilters() {
    const searchInput = document.getElementById('question-search');
    const filterPart = document.getElementById('filter-part');
    const sortBy = document.getElementById('sort-by');
    const clearFiltersBtn = document.getElementById('clear-filters');

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

    if (filterPart) {
        filterPart.addEventListener('change', (e) => {
            searchFilters.part = e.target.value;
            applyFiltersAndSort();
        });
    }

    if (sortBy) {
        sortBy.addEventListener('change', (e) => {
            searchFilters.sortBy = e.target.value;
            applyFiltersAndSort();
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            searchFilters = { searchText: '', part: '', sortBy: 'newest' };
            if (searchInput) searchInput.value = '';
            if (filterPart) filterPart.value = '';
            if (sortBy) sortBy.value = 'newest';
            applyFiltersAndSort();
        });
    }
}

function applyFiltersAndSort() {
    let filtered = [...allQuestions];

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

    if (searchFilters.part) {
        filtered = filtered.filter(q => q.part === parseInt(searchFilters.part));
    }

    switch (searchFilters.sortBy) {
        case 'newest': filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)); break;
        case 'oldest': filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)); break;
        case 'most-used': filtered.sort((a, b) => (b.timesUsed || 0) - (a.timesUsed || 0)); break;
        case 'least-used': filtered.sort((a, b) => (a.timesUsed || 0) - (b.timesUsed || 0)); break;
        case 'part-asc': filtered.sort((a, b) => a.part - b.part); break;
        case 'part-desc': filtered.sort((a, b) => b.part - a.part); break;
    }

    questionsPagination.total = filtered.length;
    questionsPagination.totalPages = Math.ceil(filtered.length / questionsPagination.limit);

    if (questionsPagination.currentPage > questionsPagination.totalPages) {
        questionsPagination.currentPage = 1;
    }

    const start = (questionsPagination.currentPage - 1) * questionsPagination.limit;
    const end = start + questionsPagination.limit;
    currentQuestions = filtered.slice(start, end);

    renderQuestionsTable();
    renderPagination('questions-pagination', questionsPagination, (page) => {
        questionsPagination.currentPage = page;
        applyFiltersAndSort();
        document.querySelector('#questions-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 'questions');
    updateFilterResults();
}

function updateFilterResults() {
    const filteredCount = document.getElementById('filtered-count');
    const totalCount = document.getElementById('total-count');
    if (filteredCount) filteredCount.textContent = currentQuestions.length;
    if (totalCount) totalCount.textContent = allQuestions.length;
}

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

function applyUserFilters() {
    let filtered = [...allUsers];

    if (userFilters.searchText) {
        filtered = filtered.filter(u => {
            const searchText = userFilters.searchText;
            return (
                (u.username && u.username.toLowerCase().includes(searchText)) ||
                (u.email && u.email.toLowerCase().includes(searchText))
            );
        });
    }

    if (userFilters.role) {
        filtered = filtered.filter(u => u.role === userFilters.role);
    }

    if (userFilters.status) {
        const isActive = userFilters.status === 'active';
        filtered = filtered.filter(u => u.isActive === isActive);
    }

    currentUsers = filtered;
    displayUsersInTab(currentUsers);
    updateUserFilterResults();
}

function updateUserFilterResults() {
    const filteredCount = document.getElementById('user-filtered-count');
    const totalCount = document.getElementById('user-total-count');
    if (filteredCount) filteredCount.textContent = currentUsers.length;
    if (totalCount) totalCount.textContent = allUsers.length;
}

function initTestSearchAndFilters() {
    const searchInput = document.getElementById('test-search');
    const filterType = document.getElementById('filter-test-type');
    const filterLevel = document.getElementById('filter-test-level');
    const sortBy = document.getElementById('test-sort-by');
    const clearFiltersBtn = document.getElementById('clear-test-filters');
    const pageSizeSelect = document.getElementById('test-page-size');

    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            testsPagination.limit = parseInt(e.target.value);
            testsPagination.currentPage = 1;
            applyTestFilters();
        });
    }

    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                testFilters.searchText = e.target.value.toLowerCase();
                testsPagination.currentPage = 1;
                applyTestFilters();
            }, 300);
        });
    }

    if (filterType) {
        filterType.addEventListener('change', (e) => {
            testFilters.type = e.target.value;
            testsPagination.currentPage = 1;
            applyTestFilters();
        });
    }

    if (filterLevel) {
        filterLevel.addEventListener('change', (e) => {
            testFilters.level = e.target.value;
            testsPagination.currentPage = 1;
            applyTestFilters();
        });
    }

    if (sortBy) {
        sortBy.addEventListener('change', (e) => {
            testFilters.sortBy = e.target.value;
            testsPagination.currentPage = 1;
            applyTestFilters();
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            testFilters = { searchText: '', type: '', level: '', sortBy: 'newest' };
            testsPagination.currentPage = 1;
            if (searchInput) searchInput.value = '';
            if (filterType) filterType.value = '';
            if (filterLevel) filterLevel.value = '';
            if (sortBy) sortBy.value = 'newest';
            if (pageSizeSelect) {
                pageSizeSelect.value = '15';
                testsPagination.limit = 15;
            }
            applyTestFilters();
        });
    }
}

function applyTestFilters() {
    let filtered = [...allTests];

    if (testFilters.searchText) {
        filtered = filtered.filter(t =>
            (t.testName && t.testName.toLowerCase().includes(testFilters.searchText)) ||
            (t.source && t.source.toLowerCase().includes(testFilters.searchText))
        );
    }

    if (testFilters.type) {
        if (testFilters.type === 'mini') {
            filtered = filtered.filter(t => t.testType && t.testType.startsWith('mini-'));
        } else {
            filtered = filtered.filter(t => t.testType === testFilters.type);
        }
    }

    if (testFilters.level) {
        filtered = filtered.filter(t => t.level === testFilters.level);
    }

    switch (testFilters.sortBy) {
        case 'newest': filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)); break;
        case 'oldest': filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)); break;
        case 'most-attempts': filtered.sort((a, b) => (b.timesAttempted || 0) - (a.timesAttempted || 0)); break;
        case 'highest-score': filtered.sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0)); break;
        case 'lowest-score': filtered.sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0)); break;
    }

    testsPagination.total = filtered.length;
    testsPagination.totalPages = Math.ceil(filtered.length / testsPagination.limit);

    if (testsPagination.currentPage > testsPagination.totalPages) {
        testsPagination.currentPage = 1;
    }

    const start = (testsPagination.currentPage - 1) * testsPagination.limit;
    const end = start + testsPagination.limit;
    currentTests = filtered.slice(start, end);

    renderTestsTable();
    renderPagination('tests-pagination', testsPagination, (page) => {
        testsPagination.currentPage = page;
        applyTestFilters();
        document.querySelector('#tests-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 'tests');
    updateTestFilterResults();
}

function updateTestFilterResults() {
    const filteredCount = document.getElementById('test-filtered-count');
    const totalCount = document.getElementById('test-total-count');
    const pageInfo = document.getElementById('test-page-info');
    if (filteredCount) filteredCount.textContent = testsPagination.total;
    if (totalCount) totalCount.textContent = allTests.length;
    if (pageInfo) {
        pageInfo.textContent = testsPagination.totalPages > 1
            ? `· trang ${testsPagination.currentPage}/${testsPagination.totalPages}`
            : '';
    }
}

async function loadTests() {
    try {
        const res = await fetch(`${TOEIC_API_BASE}/tests`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.message || 'Failed to load tests');

        allTests = data.data || [];
        currentTests = [...allTests];

        if (!window.testFiltersInitialized) {
            initTestSearchAndFilters();
            window.testFiltersInitialized = true;
        }

        applyTestFilters();
    } catch (error) {
        console.error('Error loading tests:', error);
        const tbody = document.querySelector('#tests-table tbody');
        if (tbody) tbody.innerHTML = `
            <tr><td colspan="7" class="loading" style="color: red;">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading tests</p>
            </td></tr>
        `;
    }
}

function renderTestsTable() {
    const tbody = document.querySelector('#tests-table tbody');

    if (currentTests.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" class="loading">
                <i class="fas fa-inbox"></i>
                <p>Không tìm thấy đề thi nào</p>
            </td></tr>
        `;
        return;
    }

    const levelLabel = { beginner: '🟢 Cơ bản', intermediate: '🟡 Trung cấp', advanced: '🔴 Nâng cao' };

    tbody.innerHTML = currentTests.map(t => {
        const isPublished = t.isPublished;
        const hasQuestions = t.totalQuestions > 0;
        const statusBadge = isPublished
            ? '<span class="badge success">Đã đăng</span>'
            : '<span class="badge" style="background: #ffc107; color: #000;">Nháp</span>';
        const questionWarning = !hasQuestions
            ? '<span style="color: #ff6b6b; font-size: 11px;"><i class="fas fa-exclamation-triangle"></i> Chưa có câu hỏi</span>'
            : '';
        const sourceTag = t.source
            ? `<span style="font-size:11px;color:#6366f1;background:#ede9fe;padding:1px 6px;border-radius:4px;margin-left:4px;">${t.source}</span>`
            : '';
        const lvl = t.level ? `<span style="font-size:11px;color:#555;">${levelLabel[t.level] || t.level}</span>` : '';

        return `
        <tr>
            <td>
                <div style="font-weight:500">${t.testName}${sourceTag}</div>
                <div style="margin-top:3px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    ${statusBadge} ${lvl} ${questionWarning}
                </div>
            </td>
            <td><span class="badge">${formatTestType(t.testType)}</span></td>
            <td style="text-align: center;">
                <strong>${t.randomQuestionCount || t.totalQuestions}</strong>
                ${hasQuestions ? '' : '<br><small style="color: #ff6b6b;">Trống</small>'}
            </td>
            <td style="text-align: center;">${Math.round(t.totalTime / 60)}</td>
            <td style="text-align: center;">${t.timesAttempted || 0}</td>
            <td style="text-align: center;">${t.averageScore ? Math.round(t.averageScore) : '-'}</td>
            <td>
                <button class="btn btn-primary btn-sm btn-edit-test" data-test-id="${t._id}" title="Chỉnh sửa" style="margin-right: 5px;">
                    <i class="fas fa-edit"></i>
                </button>
                ${!isPublished && hasQuestions ? `
                    <button class="btn btn-success btn-sm btn-publish-test" data-test-id="${t._id}" title="Đăng" style="margin-right: 5px;">
                        <i class="fas fa-check-circle"></i>
                    </button>
                ` : ''}
                ${isPublished ? `
                    <button class="btn btn-warning btn-sm btn-unpublish-test" data-test-id="${t._id}" title="Bỏ đăng" style="margin-right: 5px;">
                        <i class="fas fa-eye-slash"></i>
                    </button>
                ` : ''}
                <button class="btn btn-danger btn-sm btn-delete-test" data-test-id="${t._id}" title="Xóa">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.btn-edit-test').forEach(btn => {
        btn.addEventListener('click', () => editTest(btn.getAttribute('data-test-id')));
    });
    tbody.querySelectorAll('.btn-publish-test').forEach(btn => {
        btn.addEventListener('click', () => publishTest(btn.getAttribute('data-test-id'), true));
    });
    tbody.querySelectorAll('.btn-unpublish-test').forEach(btn => {
        btn.addEventListener('click', () => publishTest(btn.getAttribute('data-test-id'), false));
    });
    tbody.querySelectorAll('.btn-delete-test').forEach(btn => {
        btn.addEventListener('click', () => deleteTest(btn.getAttribute('data-test-id')));
    });
}

function formatTestType(type) {
    const types = {
        'full-test': 'Full Test',
        'mini-part1': 'Part 1 Mini', 'mini-part2': 'Part 2 Mini',
        'mini-part3': 'Part 3 Mini', 'mini-part4': 'Part 4 Mini',
        'mini-part5': 'Part 5 Mini', 'mini-part6': 'Part 6 Mini',
        'mini-part7': 'Part 7 Mini',
    };
    return types[type] || type;
}

function updatePartVisibility() {
    const part = parseInt(document.getElementById('question-part').value);

    const questionTextField = document.getElementById('question-text-field');
    if (questionTextField) questionTextField.style.display = part >= 2 ? 'block' : 'none';

    const audioField = document.getElementById('audio-text-field');
    if (audioField) audioField.style.display = (part === 3 || part === 4) ? 'block' : 'none';

    const audioFileField = document.getElementById('audio-file-field');
    if (audioFileField) audioFileField.style.display = (part >= 1 && part <= 4) ? 'block' : 'none';

    const passageField = document.getElementById('passage-field');
    if (passageField) passageField.style.display = (part === 6 || part === 7) ? 'block' : 'none';

    const imageField = document.getElementById('image-url-field');
    if (imageField) imageField.style.display = part === 1 ? 'block' : 'none';

    const keywordFieldPart12 = document.getElementById('keyword-field-part12');
    const keywordFieldPart34 = document.getElementById('keyword-field-part34');
    if (keywordFieldPart12) keywordFieldPart12.style.display = (part === 1 || part === 2) ? 'block' : 'none';
    if (keywordFieldPart34) keywordFieldPart34.style.display = (part === 3 || part === 4) ? 'block' : 'none';
}

function openQuestionModal(questionId = null) {
    const modal = document.getElementById('question-modal');
    const form = document.getElementById('question-form');
    const title = document.getElementById('question-modal-title');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const audioPreview = document.getElementById('audio-preview');
    const previewAudio = document.getElementById('preview-audio');

    form.reset();
    document.getElementById('question-id').value = '';
    imagePreview.style.display = 'none';
    previewImg.src = '';
    audioPreview.style.display = 'none';
    previewAudio.src = '';

    if (questionId) {
        title.textContent = 'Edit Question';
        const question = currentQuestions.find(q => q._id === questionId);
        if (question) {
            document.getElementById('question-id').value = question._id;
            document.getElementById('question-part').value = question.part;
            document.getElementById('question-text').value = question.questionText || '';
            document.getElementById('question-audio-text').value = question.audioText || '';
            document.getElementById('question-passage').value = question.passages?.[0] || '';
            document.getElementById('question-image-url').value = question.imageUrls?.[0] || '';
            document.getElementById('question-audio-url').value = question.audioUrl || '';
            const expVal = typeof question.explanation === 'object'
                ? JSON.stringify(question.explanation, null, 2)
                : (question.explanation || '');
            document.getElementById('question-explanation').value = expVal;
            document.getElementById('question-group-id').value = question.groupId || '';
            document.getElementById('question-index').value = question.questionIndex || '';
            document.getElementById('question-passage-count').value = question.passageCount || '';
            const srcEl = document.getElementById('question-source');
            if (srcEl) srcEl.value = question.source || '';
            document.getElementById('question-audio-translate').value = question.audioTranslate || '';
            document.getElementById('question-text-translate').value = question.questionTranslate || '';

            const firstImg = question.imageUrls?.[0];
            if (firstImg) {
                previewImg.src = firstImg;
                imagePreview.style.display = 'block';
            }

            if (question.audioUrl) {
                previewAudio.src = question.audioUrl;
                audioPreview.style.display = 'block';
            }

            question.options.forEach((opt, idx) => {
                const label = String.fromCharCode(65 + idx);
                document.getElementById(`option-${label}`).value = opt.text;
                if (opt.label === question.correctAnswer) {
                    document.getElementById(`correct-${label}`).checked = true;
                }
            });

            updatePartVisibility();
        }
    } else {
        title.textContent = 'Add Question';
        if (lastSelectedPart !== null) {
            document.getElementById('question-part').value = lastSelectedPart;
            updatePartVisibility();
        }
    }

    // Reset về tab "Nhập tay" mỗi lần mở; xoá JSON cũ
    const qJsonInput = document.getElementById('question-json-input');
    const qJsonResult = document.getElementById('question-json-result');
    if (qJsonInput) qJsonInput.value = '';
    if (qJsonResult) qJsonResult.style.display = 'none';
    switchQuestionModalTab('manual');

    modal.style.display = 'flex';
}

function closeQuestionModal() {
    document.getElementById('question-modal').style.display = 'none';
}

// ===================================
// QUESTION MODAL — JSON IMPORT + COPY PROMPT
// ===================================

function switchQuestionModalTab(tab) {
    const manualForm = document.getElementById('question-form');
    const jsonPanel  = document.getElementById('question-json-panel');
    const tabManual  = document.getElementById('q-tab-manual');
    const tabJson    = document.getElementById('q-tab-json');
    if (!manualForm || !jsonPanel || !tabManual || !tabJson) return;

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

// Quy tắc chung + chỗ dán, nối vào cuối mỗi prompt riêng của từng Part.
const _Q_FOOTER = `

=== QUY TẮC CHUNG ===
- Trả về DUY NHẤT một mảng JSON hợp lệ [ ... ], KHÔNG markdown, KHÔNG bọc trong khối code, KHÔNG giải thích thừa.
- "part" là số nguyên. "correctAnswer" phải khớp đúng 1 "label" trong "options".
- "source" = MÃ ĐỀ/BỘ ĐỀ (vd: official_2024) — RẤT QUAN TRỌNG: hệ thống gom câu hỏi thành đề thi THEO "source". TẤT CẢ câu hỏi cùng một đề PHẢI dùng CÙNG một "source".
- "explanation" viết tiếng Việt; giữ nguyên tiếng Anh ở questionText/options.

Nội dung câu hỏi của tôi:
<<< DÁN NỘI DUNG CÂU HỎI CỦA BẠN VÀO ĐÂY >>>`;

// Prompt RIÊNG, GỌN cho từng Part — chỉ trường + quy tắc + ví dụ của part đó.
const PART_PROMPTS = {
    '1': `Bạn là trợ lý tạo câu hỏi TOEIC PART 1 (Mô tả tranh). Chuyển nội dung của tôi thành MẢNG JSON đúng schema:
{
  "part": 1,
  "source": "<mã đề, vd official_2024 — BẮT BUỘC; câu cùng đề phải CÙNG source>",
  "imageUrls": ["<đường dẫn ảnh, vd /assets/images/ets26t1/ets26t1-01.jpg — để trống nếu admin tự upload>"],
  "audioUrl": "<đường dẫn mp3, vd /assets/audio/ets26t1/ets26t1-01.mp3 — để trống nếu admin tự upload>",
  "options": [
    { "label": "A", "text": "<mô tả A>" },
    { "label": "B", "text": "<mô tả B>" },
    { "label": "C", "text": "<mô tả C>" },
    { "label": "D", "text": "<mô tả D>" }
  ],
  "correctAnswer": "A|B|C|D",
  "explanation": { "A": "...", "B": "...", "C": "...", "D": "..." }
}
=== LƯU Ý PART 1 (câu 1-6, mỗi câu 1 ảnh + 1 audio đơn) ===
- KHÔNG có "questionText", KHÔNG cần "audioText" (phát file audio thật).
- 4 đáp án là 4 câu mô tả tranh.
- "imageUrls" = ảnh /assets/images/{thư mục đề}/{tên file}.jpg ; "audioUrl" = mp3 /assets/audio/{thư mục đề}/{tên file}.mp3 (cùng số thứ tự câu). Để trống nếu admin tự upload.
=== VÍ DỤ ===
[
  { "part": 1, "imageUrls": ["/assets/images/ets26t1/ets26t1-01.jpg"], "audioUrl": "/assets/audio/ets26t1/ets26t1-01.mp3",
    "options": [ {"label":"A","text":"The man is reading a newspaper."}, {"label":"B","text":"The man is typing on a laptop."}, {"label":"C","text":"The man is talking on the phone."}, {"label":"D","text":"The man is drinking coffee."} ],
    "correctAnswer": "B",
    "explanation": { "A": "❌ Không cầm báo.", "B": "✅ Đúng: đang gõ laptop.", "C": "❌ Không gọi điện.", "D": "❌ Không uống cà phê." } }
]` + _Q_FOOTER,

    '2': `Bạn là trợ lý tạo câu hỏi TOEIC PART 2 (Hỏi & đáp). Chuyển nội dung của tôi thành MẢNG JSON đúng schema:
{
  "part": 2,
  "source": "<mã đề, vd official_2024 — BẮT BUỘC; câu cùng đề phải CÙNG source>",
  "audioUrl": "<đường dẫn mp3, vd /assets/audio/ets26t1/ets26t1-07.mp3 — để trống nếu admin tự upload>",
  "questionText": "<câu được nói (câu hỏi gốc) — tùy chọn>",
  "options": [
    { "label": "A", "text": "..." },
    { "label": "B", "text": "..." },
    { "label": "C", "text": "..." }
  ],
  "correctAnswer": "A|B|C",
  "explanation": { "A": "...", "B": "...", "C": "..." }
}
=== LƯU Ý PART 2 (câu 7-31, mỗi câu 1 audio đơn) ===
- CHỈ 3 đáp án A/B/C — KHÔNG có D. Không ảnh, không passage, KHÔNG cần "audioText" (phát file audio thật).
- "audioUrl" = đường dẫn mp3 /assets/audio/{thư mục đề}/{tên file}.mp3 (theo số câu). Để trống nếu chưa có.
=== VÍ DỤ ===
[
  { "part": 2, "audioUrl": "/assets/audio/ets26t1/ets26t1-07.mp3",
    "questionText": "Where can I find the meeting room?",
    "options": [ {"label":"A","text":"It's on the third floor."}, {"label":"B","text":"The meeting was great."}, {"label":"C","text":"At 10 a.m."} ],
    "correctAnswer": "A",
    "explanation": { "A": "✅ Đúng: trả lời nơi chốn.", "B": "❌ Lạc đề.", "C": "❌ Trả lời thời gian, không phải nơi chốn." } }
]` + _Q_FOOTER,

    '3': `Bạn là trợ lý tạo câu hỏi TOEIC PART 3 (Hội thoại — nhiều câu chung 1 đoạn hội thoại). Schema:
{
  "part": 3, "source": "<mã đề, vd official_2024 — BẮT BUỘC; câu cùng đề phải CÙNG source>",
  "groupId": "<vd p3_grp_001 — chung cho các câu cùng đoạn>",
  "questionIndex": "<1, 2, 3...>",
  "audioUrl": "<đường dẫn mp3 theo DẢI SỐ câu của nhóm, vd nhóm câu 32-34 → /assets/audio/ets26t1/ets26t1-32-34.mp3 — CHỈ ở câu 1; để trống nếu admin upload>",
  "imageUrls": ["<đường dẫn ảnh theo DẢI SỐ câu nếu có hình/biểu đồ, vd /assets/images/ets26t1/ets26t1-32-34.jpg — CHỈ ở câu 1; để [] nếu không có>"],
  "questionText": "<câu hỏi>",
  "options": [ {"label":"A","text":"..."}, {"label":"B","text":"..."}, {"label":"C","text":"..."}, {"label":"D","text":"..."} ],
  "correctAnswer": "A|B|C|D",
  "explanation": { "A": "...", "B": "...", "C": "...", "D": "..." }
}
=== LƯU Ý PART 3 (câu 32-70 — 13 nhóm × 3 câu/đoạn hội thoại) ===
- Các câu cùng đoạn dùng CHUNG "groupId"; "questionIndex" tăng dần (thường 3 câu).
- Chỉ câu ĐẦU (questionIndex 1) chứa "audioUrl" và "imageUrls". KHÔNG cần "audioText" (hệ thống phát file audio thật).
- Tên file đặt theo DẢI SỐ câu của nhóm: vd nhóm câu 32-34 → "ets26t1-32-34.mp3" (audio), "ets26t1-32-34.jpg" (ảnh). Để [] / để trống nếu không có.
=== VÍ DỤ (nhóm 2 câu) ===
[
  { "part": 3, "groupId": "p3_grp_001", "questionIndex": 1,
    "audioUrl": "/assets/audio/ets26t1/ets26t1-32-34.mp3",
    "imageUrls": [],
    "questionText": "What is the man doing?",
    "options": [ {"label":"A","text":"Finishing a report"}, {"label":"B","text":"Checking some figures"}, {"label":"C","text":"Sending an email"}, {"label":"D","text":"Attending a meeting"} ],
    "correctAnswer": "B",
    "explanation": { "A": "❌ Gần xong nhưng chưa hoàn thành.", "B": "✅ Đúng: cần kiểm tra số liệu.", "C": "❌ Không đề cập.", "D": "❌ Không đề cập." } },
  { "part": 3, "groupId": "p3_grp_001", "questionIndex": 2,
    "questionText": "When does the manager want the report?",
    "options": [ {"label":"A","text":"By noon"}, {"label":"B","text":"By 3 PM"}, {"label":"C","text":"Tomorrow"}, {"label":"D","text":"Next week"} ],
    "correctAnswer": "A",
    "explanation": { "A": "✅ Đúng: wants it by noon.", "B": "❌ Sai.", "C": "❌ Sai.", "D": "❌ Sai." } }
]` + _Q_FOOTER,

    '4': `Bạn là trợ lý tạo câu hỏi TOEIC PART 4 (Bài nói — nhiều câu chung 1 đoạn độc thoại 1 người). Schema:
{
  "part": 4, "source": "<mã đề, vd official_2024 — BẮT BUỘC; câu cùng đề phải CÙNG source>",
  "groupId": "<vd p4_grp_001>",
  "questionIndex": "<1, 2, 3...>",
  "audioUrl": "<đường dẫn mp3 theo DẢI SỐ câu của nhóm, vd nhóm câu 71-73 → /assets/audio/ets26t1/ets26t1-71-73.mp3 — CHỈ ở câu 1; để trống nếu admin upload>",
  "imageUrls": ["<đường dẫn ảnh theo DẢI SỐ câu nếu có hình/biểu đồ, vd /assets/images/ets26t1/ets26t1-71-73.jpg — CHỈ ở câu 1; để [] nếu không có>"],
  "questionText": "<câu hỏi>",
  "options": [ 4 đáp án A-D ],
  "correctAnswer": "A|B|C|D",
  "explanation": { "A": "...", "B": "...", "C": "...", "D": "..." }
}
=== LƯU Ý PART 4 (câu 71-100 — 10 nhóm × 3 câu/bài nói) ===
- Chung "groupId"; "questionIndex" tăng dần. Chỉ câu ĐẦU chứa "audioUrl" và "imageUrls". KHÔNG cần "audioText" (hệ thống phát file audio thật).
- Tên file đặt theo DẢI SỐ câu của nhóm: vd nhóm câu 71-73 → "ets26t1-71-73.mp3" (audio), "ets26t1-71-73.jpg" (ảnh). Để [] / để trống nếu không có.
=== VÍ DỤ (nhóm 2 câu) ===
[
  { "part": 4, "groupId": "p4_grp_001", "questionIndex": 1,
    "audioUrl": "/assets/audio/ets26t1/ets26t1-71-73.mp3",
    "imageUrls": [],
    "questionText": "What is the announcement about?",
    "options": [ {"label":"A","text":"A store closing soon"}, {"label":"B","text":"A sale event"}, {"label":"C","text":"A lost item"}, {"label":"D","text":"A new product"} ],
    "correctAnswer": "A",
    "explanation": { "A": "✅ Đúng: cửa hàng sắp đóng cửa.", "B": "❌ Không nói khuyến mãi.", "C": "❌ Không đề cập.", "D": "❌ Không đề cập." } },
  { "part": 4, "groupId": "p4_grp_001", "questionIndex": 2,
    "questionText": "What are listeners asked to do?",
    "options": [ {"label":"A","text":"Go to the checkout"}, {"label":"B","text":"Leave immediately"}, {"label":"C","text":"Call a manager"}, {"label":"D","text":"Wait outside"} ],
    "correctAnswer": "A",
    "explanation": { "A": "✅ Đúng: bring items to the checkout.", "B": "❌ Sai.", "C": "❌ Sai.", "D": "❌ Sai." } }
]` + _Q_FOOTER,

    '5': `Bạn là trợ lý tạo câu hỏi TOEIC PART 5 (Hoàn thành câu — ngữ pháp/từ vựng). Schema:
{
  "part": 5,
  "source": "<mã đề, vd official_2024 — BẮT BUỘC; câu cùng đề phải CÙNG source>",
  "questionText": "<câu có chỗ trống _____>",
  "questionTranslate": "<dịch tiếng Việt — tùy chọn>",
  "options": [ {"label":"A","text":"..."}, {"label":"B","text":"..."}, {"label":"C","text":"..."}, {"label":"D","text":"..."} ],
  "correctAnswer": "A|B|C|D",
  "explanation": { "A": "...", "B": "...", "C": "...", "D": "..." }
}
=== LƯU Ý PART 5 (câu 101-130 — không audio/ảnh/passage) ===
- 1 câu có chỗ trống, 4 đáp án A-D. KHÔNG cần audio/passage/group.
=== VÍ DỤ ===
[
  { "part": 5,
    "questionText": "The new policy will _____ next month.",
    "questionTranslate": "Chính sách mới sẽ _____ vào tháng tới.",
    "options": [ {"label":"A","text":"take effect"}, {"label":"B","text":"took effect"}, {"label":"C","text":"taking effect"}, {"label":"D","text":"effected"} ],
    "correctAnswer": "A",
    "explanation": { "A": "✅ Đúng: take effect = có hiệu lực. Will + V nguyên thể.", "B": "❌ took effect là quá khứ, không dùng sau will.", "C": "❌ taking không đứng sau will.", "D": "❌ effected sai nghĩa." } }
]` + _Q_FOOTER,

    '6': `Bạn là trợ lý tạo câu hỏi TOEIC PART 6 (Hoàn thành đoạn — 1 đoạn nhiều chỗ trống). Schema:
{
  "part": 6, "source": "<mã đề, vd official_2024 — BẮT BUỘC; câu cùng đề phải CÙNG source>",
  "groupId": "<vd p6_grp_001>",
  "questionIndex": "<1, 2, 3...>",
  "imageUrls": ["<ẢNH đoạn văn (cách dùng CHÍNH) theo DẢI SỐ câu, vd nhóm câu 131-134 → /assets/images/ets26t1/ets26t1-131-134.jpg — CHỈ ở câu 1; để [] nếu admin upload sau>"],
  "passages": ["<TÙY CHỌN: đoạn văn dạng text nếu không dùng ảnh — CHỈ ở câu 1>"],
  "questionText": "<số chỗ trống tương ứng, vd: (1)>",
  "options": [ 4 đáp án A-D ],
  "correctAnswer": "A|B|C|D",
  "explanation": { "A": "...", "B": "...", "C": "...", "D": "..." }
}
=== LƯU Ý PART 6 (câu 131-146 — 4 nhóm × 4 câu/đoạn) ===
- Chung "groupId"; mỗi câu ứng 1 chỗ trống (Part 6 bắt đầu từ câu 131). Chỉ câu ĐẦU chứa "imageUrls" (ẢNH đoạn văn — cách chính); "passages" text là TÙY CHỌN.
- Tên file ảnh đặt theo DẢI SỐ câu của nhóm: vd nhóm câu 131-134 → "ets26t1-131-134.jpg". Để [] nếu admin upload sau.
=== VÍ DỤ (nhóm 2 câu) ===
[
  { "part": 6, "groupId": "p6_grp_001", "questionIndex": 1,
    "imageUrls": ["/assets/images/ets26t1/ets26t1-131-134.jpg"],
    "questionText": "(1)",
    "options": [ {"label":"A","text":"arrive"}, {"label":"B","text":"arrives"}, {"label":"C","text":"arrived"}, {"label":"D","text":"arriving"} ],
    "correctAnswer": "A",
    "explanation": { "A": "✅ Đúng: will + V nguyên thể.", "B": "❌ Sai chia.", "C": "❌ Quá khứ.", "D": "❌ V-ing." } },
  { "part": 6, "groupId": "p6_grp_001", "questionIndex": 2,
    "questionText": "(2)",
    "options": [ {"label":"A","text":"contact"}, {"label":"B","text":"contacts"}, {"label":"C","text":"contacted"}, {"label":"D","text":"contacting"} ],
    "correctAnswer": "A",
    "explanation": { "A": "✅ Đúng: please + V nguyên thể.", "B": "❌ Sai.", "C": "❌ Sai.", "D": "❌ Sai." } }
]` + _Q_FOOTER,

    '7': `Bạn là trợ lý tạo câu hỏi TOEIC PART 7 (Đọc hiểu — 1-3 đoạn đọc, nhiều câu). Schema:
{
  "part": 7, "source": "<mã đề, vd official_2024 — BẮT BUỘC; câu cùng đề phải CÙNG source>",
  "groupId": "<vd p7_grp_001>",
  "questionIndex": "<1, 2, 3...>",
  "passageCount": "<1 | 2 | 3>",
  "imageUrls": ["<ẢNH đoạn đọc (cách dùng CHÍNH) theo DẢI SỐ câu, vd nhóm câu 147-148 → /assets/images/ets26t1/ets26t1-147-148.jpg — CHỈ ở câu 1; để [] nếu admin upload sau>"],
  "passages": ["<TÙY CHỌN: đoạn đọc dạng text nếu không dùng ảnh — CHỈ ở câu 1>"],
  "questionText": "<câu hỏi>",
  "options": [ 4 đáp án A-D ],
  "correctAnswer": "A|B|C|D",
  "explanation": { "A": "...", "B": "...", "C": "...", "D": "..." }
}
=== LƯU Ý PART 7 (câu 147-200 — nhóm tùy: single/double/triple đoạn, dải số theo nhóm) ===
- Chung "groupId" + "passageCount" (Part 7 bắt đầu từ câu 147). Chỉ câu ĐẦU chứa "imageUrls" (ẢNH đoạn đọc — cách chính); "passages" text là TÙY CHỌN.
- Tên file ảnh đặt theo DẢI SỐ câu của nhóm: vd nhóm câu 147-148 → "ets26t1-147-148.jpg". Để [] nếu admin upload sau.
=== VÍ DỤ ===
[
  { "part": 7, "groupId": "p7_grp_001", "questionIndex": 1, "passageCount": 1,
    "imageUrls": ["/assets/images/ets26t1/ets26t1-147-148.jpg"],
    "questionText": "Why will the library be closed?",
    "options": [ {"label":"A","text":"For a holiday"}, {"label":"B","text":"For repairs"}, {"label":"C","text":"For an event"}, {"label":"D","text":"For cleaning"} ],
    "correctAnswer": "A",
    "explanation": { "A": "✅ Đúng: closed for the national holiday.", "B": "❌ Không đề cập.", "C": "❌ Không đề cập.", "D": "❌ Không đề cập." } }
]` + _Q_FOOTER,
};

// Trích phần "=== VÍ DỤ === [...]" trong prompt của 1 Part để làm placeholder ô JSON.
let _defaultJsonPlaceholder = null;
function partExampleJson(part) {
    const prompt = PART_PROMPTS[part];
    if (!prompt) return null;
    const m = prompt.match(/=== VÍ DỤ[^=]*===\s*([\s\S]*?)\s*\n\n=== QUY TẮC CHUNG/);
    return m ? m[1].trim() : null;
}

// Đổi placeholder ô nhập JSON theo Part đang chọn (Tất cả → mẫu mặc định nhiều part).
function updateQuestionJsonPlaceholder() {
    const ta = document.getElementById('question-json-input');
    const sel = document.getElementById('q-prompt-part');
    if (!ta || !sel) return;
    if (_defaultJsonPlaceholder === null) _defaultJsonPlaceholder = ta.placeholder;
    const ex = sel.value === 'all' ? null : partExampleJson(sel.value);
    ta.placeholder = ex || _defaultJsonPlaceholder;
}

function copyQuestionPrompt() {
    const partSel = document.getElementById('q-prompt-part');
    const part = partSel ? partSel.value : 'all';
    let prompt = `Bạn là trợ lý tạo câu hỏi TOEIC. Hãy chuyển nội dung câu hỏi tôi cung cấp thành MẢNG JSON đúng schema dưới đây để tôi import vào hệ thống.

=== SCHEMA THỐNG NHẤT (áp dụng cho tất cả Part 1-7) ===
{
  "part": <số 1-7, BẮT BUỘC>,
  "source": "<MÃ ĐỀ, vd official_2024 — BẮT BUỘC: hệ thống gom câu hỏi thành đề theo source; câu cùng đề phải CÙNG source>",

  // Nhóm câu hỏi (Part 3, 4, 6, 7 có nhiều câu chung 1 audio/passage)
  "groupId": "<chuỗi định danh nhóm, ví dụ: p3_grp_001 — bắt buộc nếu có nhóm>",
  "questionIndex": <thứ tự trong nhóm bắt đầu từ 1 — bắt buộc nếu có nhóm>,

  // Nội dung câu hỏi
  "questionText": "<câu hỏi tiếng Anh — bắt buộc với Part 2-7, bỏ với Part 1>",
  "questionTranslate": "<bản dịch tiếng Việt của câu hỏi — tùy chọn>",

  // Nghe (Part 1-4) — KHÔNG cần "audioText", hệ thống phát file audio thật theo audioUrl
  "audioUrl": "<mp3: Part 1/2 file đơn vd /assets/audio/ets26t1/ets26t1-01.mp3 ; Part 3/4 file dải số nhóm vd ets26t1-32-34.mp3 (chỉ ở câu đầu) — để trống nếu admin upload>",

  // Đọc (Part 6-7) — dùng ẢNH đoạn văn (imageUrls) là chính; "passages" text TÙY CHỌN
  "passageCount": <1 | 2 | 3 — chỉ Part 7>,
  "passages": ["<TÙY CHỌN: đoạn văn dạng text nếu không dùng ảnh>"],

  // Ảnh (Part 1 = tranh; Part 3/4 = biểu đồ nếu có; Part 6/7 = ảnh đoạn văn)
  "imageUrls": ["<ảnh .jpg: Part 1 file đơn vd ets26t1-01.jpg ; Part 3/4/6/7 file dải số nhóm vd ets26t1-32-34.jpg (chỉ ở câu đầu) — để [] nếu admin upload sau>"],

  // Đáp án
  "options": [
    { "label": "A", "text": "<đáp án A>" },
    { "label": "B", "text": "<đáp án B>" },
    { "label": "C", "text": "<đáp án C>" },
    { "label": "D", "text": "<đáp án D — tùy chọn với Part 2>" }
  ],
  "correctAnswer": "A | B | C | D",

  // Giải thích theo từng đáp án
  "explanation": {
    "A": "✅ Đúng: <lý do> — HOẶC — ❌ Sai: <lý do>",
    "B": "❌ Sai: <lý do>",
    "C": "❌ Sai: <lý do>",
    "D": "❌ Sai: <lý do>"
  }
}

=== QUY TẮC BẮT BUỘC ===
- Trả về DUY NHẤT một mảng JSON hợp lệ [ ... ], KHÔNG kèm giải thích, KHÔNG markdown, KHÔNG \`\`\`.
- "part" là số nguyên, KHÔNG phải chuỗi.
- "source" = MÃ ĐỀ/BỘ ĐỀ (vd: official_2024) — RẤT QUAN TRỌNG: hệ thống gom câu hỏi thành đề thi THEO "source". Câu cùng một đề PHẢI dùng CÙNG một "source".
- Tối thiểu 3 đáp án (A, B, C); D tùy chọn.
- "correctAnswer" phải khớp đúng 1 label trong "options".
- Part 1: bỏ "questionText", để "imageUrls": [] (admin upload sau).
- Part 2: chỉ có A/B/C, không có D.
- Part 3/4: nhiều câu hỏi cùng 1 audio → cùng "groupId", "questionIndex" tăng dần.
- Part 6/7: nhiều câu hỏi cùng 1 đoạn → cùng "groupId", chỉ câu đầu tiên (questionIndex: 1) chứa "imageUrls" (ẢNH đoạn văn — cách chính); "passages" text là TÙY CHỌN.
- ĐẶT TÊN FILE audio/ảnh (RẤT QUAN TRỌNG, đúng từng ký tự):
  • Thư mục theo số đề: "ets26t" + số đề, vd đề 1 → ets26t1, đề 2 → ets26t2 (PHẢI có "26", KHÔNG viết "etst2").
  • Part 1/2 (mỗi câu 1 audio/ảnh) → file ĐƠN theo số câu: /assets/audio/ets26t2/ets26t2-01.mp3
  • Part 3/4/6/7 (nhóm nhiều câu) → file theo DẢI SỐ câu của nhóm: /assets/audio/ets26t2/ets26t2-32-34.mp3 ; ảnh tương tự .jpg. "audioUrl"/"imageUrls" CHỈ đặt ở câu đầu nhóm (questionIndex 1).
- Giải thích trong "explanation" viết tiếng Việt; giữ nguyên tiếng Anh trong "questionText", "options".
- Bỏ qua các trường không liên quan đến part đó (ví dụ: Part 5 không cần audio/ảnh/passages).

=== VÍ DỤ PART 5 ===
[
  {
    "part": 5,
    "questionText": "The new policy will _____ next month.",
    "questionTranslate": "Chính sách mới sẽ _____ vào tháng tới.",
    "options": [
      { "label": "A", "text": "take effect" },
      { "label": "B", "text": "took effect" },
      { "label": "C", "text": "taking effect" },
      { "label": "D", "text": "effected" }
    ],
    "correctAnswer": "A",
    "explanation": {
      "A": "✅ Đúng: take effect = có hiệu lực. Will + V nguyên thể (tương lai đơn).",
      "B": "❌ Sai: took effect là quá khứ đơn, không dùng sau will.",
      "C": "❌ Sai: taking không thể đứng sau will.",
      "D": "❌ Sai: effected không đúng nghĩa ở đây."
    }
  }
]

=== VÍ DỤ PART 3 (nhóm 3 câu) ===
[
  {
    "part": 3, "groupId": "p3_grp_001", "questionIndex": 1,
    "audioUrl": "/assets/audio/ets26t1/ets26t1-32-34.mp3",
    "imageUrls": [],
    "questionText": "What is the man doing?",
    "options": [{ "label": "A", "text": "Finishing a report" }, { "label": "B", "text": "Checking some figures" }, { "label": "C", "text": "Sending an email" }, { "label": "D", "text": "Attending a meeting" }],
    "correctAnswer": "B",
    "explanation": { "A": "❌ Gần xong nhưng chưa hoàn thành.", "B": "✅ Đúng: he needs to check the numbers.", "C": "❌ Không đề cập.", "D": "❌ Không đề cập." }
  },
  {
    "part": 3, "groupId": "p3_grp_001", "questionIndex": 2,
    "questionText": "When does the manager want the report?",
    "options": [{ "label": "A", "text": "By noon" }, { "label": "B", "text": "By 3 PM" }, { "label": "C", "text": "Tomorrow morning" }, { "label": "D", "text": "Next week" }],
    "correctAnswer": "A",
    "explanation": { "A": "✅ Đúng: the manager wants it by noon.", "B": "❌ Sai.", "C": "❌ Sai.", "D": "❌ Sai." }
  }
]

Nội dung câu hỏi của tôi:
<<< DÁN NỘI DUNG CÂU HỎI CỦA BẠN VÀO ĐÂY >>>`;

    // Chọn 1 Part cụ thể → dùng prompt RIÊNG, gọn (không gộp chung 7 part).
    if (part !== 'all' && PART_PROMPTS[part]) prompt = PART_PROMPTS[part];

    const done = () => showToast('Đã copy prompt — dán vào ChatGPT/AI rồi lấy JSON về', 'success');
    const fail = () => showToast('Không copy được, hãy chọn và copy thủ công', 'error');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(prompt).then(done).catch(fail);
    } else {
        const ta = document.createElement('textarea');
        ta.value = prompt;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { fail(); }
        document.body.removeChild(ta);
    }
}

// Kiểm tra ĐỊNH DẠNG 1 câu hỏi import. Trả mảng lỗi (rỗng nếu hợp lệ).
function validateImportedQuestion(q, i) {
    const n = `Câu #${i + 1}`;
    const errs = [];
    if (!q || typeof q !== 'object' || Array.isArray(q)) return [`${n}: phải là một object JSON`];

    const part = parseInt(q.part);
    if (!part || part < 1 || part > 7) return [`${n}: thiếu/sai "part" (phải là số 1-7)`];

    // Đáp án: Part 2 cần 3, các part khác cần 4 — đều phải có nội dung.
    if (!Array.isArray(q.options)) {
        errs.push(`${n}: thiếu "options" (mảng đáp án)`);
    } else {
        const cleaned = q.options.map((o, idx) => ({
            label: (o && o.label) || String.fromCharCode(65 + idx),
            text: (o && o.text != null ? String(o.text) : '').trim(),
        }));
        const withText = cleaned.filter(o => o.text);
        const expected = part === 2 ? 3 : 4;
        if (withText.length !== expected) errs.push(`${n}: Part ${part} cần đúng ${expected} đáp án có nội dung (đang có ${withText.length})`);
        // correctAnswer
        if (!q.correctAnswer || !/^[A-D]$/.test(String(q.correctAnswer))) {
            errs.push(`${n}: "correctAnswer" phải là một chữ A/B/C/D`);
        } else if (!cleaned.some(o => o.label === q.correctAnswer)) {
            errs.push(`${n}: "correctAnswer" (${q.correctAnswer}) không khớp đáp án nào`);
        }
    }

    // source bắt buộc (gom câu thành đề thi)
    if (!q.source || !String(q.source).trim()) errs.push(`${n}: thiếu "source" (mã đề — bắt buộc)`);

    // questionText bắt buộc với Part 3-7
    if (part >= 3 && (!q.questionText || !String(q.questionText).trim())) errs.push(`${n}: Part ${part} cần "questionText"`);

    // Part nhóm: 3,4,6,7 cần groupId + questionIndex. Nội dung (audio/ảnh) đặt ở
    // câu đầu — KHÔNG bắt buộc "audioText"/"passages" (dùng file audio thật + ảnh).
    if ([3, 4, 6, 7].includes(part)) {
        if (!q.groupId || !String(q.groupId).trim()) errs.push(`${n}: Part ${part} cần "groupId"`);
        const idx = parseInt(q.questionIndex);
        if (!idx || idx < 1) errs.push(`${n}: Part ${part} cần "questionIndex" (số ≥ 1)`);
    }

    // Kiểu dữ liệu media nếu có
    if (q.imageUrls != null && !Array.isArray(q.imageUrls) && typeof q.imageUrls !== 'string') errs.push(`${n}: "imageUrls" phải là mảng hoặc chuỗi`);
    if (q.audioUrl != null && typeof q.audioUrl !== 'string') errs.push(`${n}: "audioUrl" phải là chuỗi`);
    if (q.explanation != null && typeof q.explanation !== 'object' && typeof q.explanation !== 'string') errs.push(`${n}: "explanation" phải là object hoặc chuỗi`);

    return errs;
}

async function submitQuestionJsonImport() {
    const raw = document.getElementById('question-json-input').value.trim();
    const resultDiv = document.getElementById('question-json-result');
    if (!raw) { showToast('Vui lòng nhập JSON', 'error'); return; }

    let questions;
    try {
        const parsed = JSON.parse(raw);
        questions = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
        showToast('JSON không hợp lệ: ' + e.message, 'error');
        return;
    }
    if (questions.length === 0) { showToast('Không có câu hỏi nào trong JSON', 'error'); return; }

    // PRE-VALIDATE TOÀN BỘ — sai định dạng thì KHÔNG lưu gì cả (import nguyên khối).
    const preErrors = [];
    questions.forEach((q, i) => { preErrors.push(...validateImportedQuestion(q, i)); });
    if (preErrors.length) {
        resultDiv.style.display = 'block';
        resultDiv.style.background = '#fef2f2';
        resultDiv.style.border = '1px solid #fca5a5';
        resultDiv.style.color = '#1f2937';
        resultDiv.innerHTML = `
            <b>❌ Không lưu — JSON sai định dạng (${preErrors.length} lỗi)</b>
            <ul style="margin:8px 0 0;padding-left:18px;color:#dc2626">${preErrors.map(e => `<li>${e}</li>`).join('')}</ul>
        `;
        showToast('JSON sai định dạng — đã hủy import (không lưu câu nào)', 'error');
        return;
    }

    const btn = document.getElementById('btn-submit-q-json');
    btn.disabled = true;
    btn.textContent = 'Đang import...';
    resultDiv.style.display = 'none';

    let ok = 0;
    const errors = [];

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i] || {};
        try {
            const part = parseInt(q.part);
            if (!part || part < 1 || part > 7) throw new Error('part phải là số 1-7');
            const options = Array.isArray(q.options) ? q.options
                .map((o, idx) => ({
                    label: o.label || String.fromCharCode(65 + idx),
                    text: (o.text != null ? String(o.text) : '').trim(),
                }))
                .filter(o => o.text) : [];
            if (options.length < 3) throw new Error('cần tối thiểu 3 đáp án');
            if (!q.correctAnswer || !options.some(o => o.label === q.correctAnswer)) {
                throw new Error('correctAnswer không khớp đáp án nào');
            }

            const payload = { part, correctAnswer: q.correctAnswer, options };
            if (q.questionText && part >= 2) payload.questionText = String(q.questionText).trim();
            if (q.audioText) payload.audioText = String(q.audioText).trim();
            if (q.passages) payload.passages = Array.isArray(q.passages) ? q.passages : [String(q.passages).trim()];
            else if (q.passage) payload.passages = [String(q.passage).trim()];
            if (q.imageUrls) payload.imageUrls = Array.isArray(q.imageUrls) ? q.imageUrls : [String(q.imageUrls).trim()];
            else if (q.imageUrl) payload.imageUrls = [String(q.imageUrl).trim()];
            if (q.audioUrl) payload.audioUrl = String(q.audioUrl).trim();
            if (q.audioTranslate) payload.audioTranslate = String(q.audioTranslate).trim();
            if (q.questionTranslate) payload.questionTranslate = String(q.questionTranslate).trim();
            if (q.groupId) payload.groupId = String(q.groupId).trim();
            if (q.questionIndex) payload.questionIndex = parseInt(q.questionIndex);
            if (q.passageCount) payload.passageCount = parseInt(q.passageCount);
            if (q.source) payload.source = String(q.source).trim(); // mã đề — gom câu thành đề thi
            if (q.explanation) payload.explanation = typeof q.explanation === 'object' ? q.explanation : { note: String(q.explanation).trim() };

            const res = await fetch(`${TOEIC_API_BASE}/questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`,
                },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Server error');
            ok++;
        } catch (e) {
            errors.push(`Câu #${i + 1}: ${e.message}`);
        }
    }

    btn.disabled = false;
    btn.textContent = 'Import JSON';

    const total = questions.length;
    resultDiv.style.display = 'block';
    resultDiv.style.background = errors.length === total ? '#fef2f2' : errors.length === 0 ? '#f0fdf4' : '#fffbeb';
    resultDiv.style.border = `1px solid ${errors.length === total ? '#fca5a5' : errors.length === 0 ? '#86efac' : '#fcd34d'}`;
    // Light background → pin dark text so the summary stays readable in dark mode.
    resultDiv.style.color = '#1f2937';
    resultDiv.innerHTML = `
        <b>${total} câu</b> — ✅ ${ok} thêm mới · ❌ ${errors.length} lỗi
        ${errors.length ? '<ul style="margin:8px 0 0;padding-left:18px;color:#dc2626">' + errors.map(e => `<li>${e}</li>`).join('') + '</ul>' : ''}
    `;

    if (ok > 0 && typeof loadQuestions === 'function') loadQuestions();

    // Có câu vào được → xóa luôn JSON trong ô nhập (khỏi dính lần sau). Câu lỗi
    // đã liệt kê ở khung kết quả bên dưới rồi.
    if (ok > 0) {
        const ta = document.getElementById('question-json-input');
        if (ta) ta.value = '';
    }
}

function previewQuestion(questionId) {
    const question = currentQuestions.find(q => q._id === questionId);
    if (!question) {
        alert('Question not found!');
        return;
    }

    let modal = document.getElementById('preview-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'preview-modal';
        modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 2000; align-items: center; justify-content: center;';
        document.body.appendChild(modal);
    }

    let html = `
        <div style="background: white; border-radius: 15px; padding: 30px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; position: relative;">
            <button id="close-preview-btn" style="position: absolute; top: 15px; right: 15px; background: #e0e0e0; border: none; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; font-size: 20px;">×</button>
            <h3 style="margin-bottom: 20px; color: #667eea;">
                <i class="fas fa-eye"></i> Preview - Part ${question.part}
            </h3>
    `;

    if (question.imageUrls?.length > 0) {
        question.imageUrls.forEach(url => {
            html += `<img src="${url}" style="width: 100%; max-width: 500px; margin: 0 auto 10px; display: block; border-radius: 8px;">`;
        });
    }

    if (question.part <= 4 && (question.audioUrl || question.audioText)) {
        html += `
            <div style="background: #f5f7fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <button id="preview-audio-btn" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    <i class="fas fa-play"></i> Phát audio
                </button>
            </div>
        `;
    }

    if (question.questionText && question.part >= 3) {
        html += `<p style="font-size: 16px; margin-bottom: 20px;"><strong>Question:</strong> ${question.questionText}</p>`;
    }

    if (question.passages?.length > 0) {
        question.passages.forEach(p => {
            html += `<div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 12px; white-space: pre-wrap;">${p}</div>`;
        });
    }

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

    if (question.explanation && Object.keys(question.explanation).length > 0) {
        const expHtml = Object.entries(question.explanation)
            .map(([k, v]) => `<div style="margin-bottom:6px;"><strong>${k}.</strong> ${v}</div>`)
            .join('');
        html += `
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <strong style="color: #f59e0b;"><i class="fas fa-lightbulb"></i> Explanation:</strong>
                <div style="margin-top: 10px;">${expHtml}</div>
            </div>
        `;
    }

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

    setTimeout(() => {
        document.getElementById('close-preview-btn')?.addEventListener('click', () => {
            modal.style.display = 'none';
        });

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

async function handleImageUpload(file) {
    const uploadStatus = document.getElementById('image-upload-status');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const hiddenUrlInput = document.getElementById('question-image-url');
    const fileInput = document.getElementById('question-image-file');

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        alert('Only image files (JPEG, PNG, GIF, WEBP) are allowed!');
        fileInput.value = '';
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB!');
        fileInput.value = '';
        return;
    }

    imagePreview.style.display = 'none';
    uploadStatus.style.display = 'block';

    try {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch(`${TOEIC_API_BASE}/upload/part1-image`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` },
            body: formData
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.message || 'Upload failed');

        hiddenUrlInput.value = data.imageUrl;
        previewImg.src = data.imageUrl;
        uploadStatus.style.display = 'none';
        imagePreview.style.display = 'block';
    } catch (error) {
        console.error('Error uploading image:', error);
        alert('Failed to upload image: ' + error.message);
        uploadStatus.style.display = 'none';
        fileInput.value = '';
    }
}

async function handleAudioUpload(file) {
    const uploadStatus = document.getElementById('audio-upload-status');
    const audioPreview = document.getElementById('audio-preview');
    const previewAudio = document.getElementById('preview-audio');
    const hiddenUrlInput = document.getElementById('question-audio-url');
    const fileInput = document.getElementById('question-audio-file');

    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac', 'audio/x-m4a'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
        alert('Only audio files (MP3, WAV, OGG, M4A, AAC) are allowed!');
        fileInput.value = '';
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB!');
        fileInput.value = '';
        return;
    }

    audioPreview.style.display = 'none';
    uploadStatus.style.display = 'block';

    try {
        const formData = new FormData();
        formData.append('audio', file);

        const res = await fetch(`${TOEIC_API_BASE}/upload/audio`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` },
            body: formData
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.message || 'Upload failed');

        hiddenUrlInput.value = data.audioUrl;
        previewAudio.src = data.audioUrl;
        uploadStatus.style.display = 'none';
        audioPreview.style.display = 'block';
    } catch (error) {
        console.error('Error uploading audio:', error);
        alert('Failed to upload audio: ' + error.message);
        uploadStatus.style.display = 'none';
        fileInput.value = '';
    }
}

async function handleQuestionSubmit(e) {
    e.preventDefault();

    const questionId = document.getElementById('question-id').value;
    const part = parseInt(document.getElementById('question-part').value);
    const questionText = document.getElementById('question-text').value.trim();
    const audioText = document.getElementById('question-audio-text').value.trim();
    const passageRaw = document.getElementById('question-passage').value.trim();
    const imageUrlRaw = document.getElementById('question-image-url').value.trim();
    const audioUrl = document.getElementById('question-audio-url').value.trim();
    const explanationRaw = document.getElementById('question-explanation').value.trim();
    const groupIdRaw = document.getElementById('question-group-id').value.trim();
    const questionIndexRaw = document.getElementById('question-index').value.trim();
    const passageCountRaw = document.getElementById('question-passage-count').value;
    const audioTranslateRaw = document.getElementById('question-audio-translate').value.trim();
    const questionTranslateRaw = document.getElementById('question-text-translate').value.trim();
    const sourceRaw = document.getElementById('question-source')?.value.trim() || '';

    const correctAnswer = document.querySelector('input[name="correct-answer"]:checked')?.value;
    if (!correctAnswer) {
        alert('Please select the correct answer!');
        return;
    }

    const options = ['A', 'B', 'C', 'D'].map(label => ({
        label,
        text: document.getElementById(`option-${label}`).value.trim()
    })).filter(opt => opt.text);

    if (options.length < 3) {
        alert('Vui lòng điền vào ít nhất 3 đáp án!');
        return;
    }

    if (part === 1 && !imageUrlRaw && !audioUrl) {
        alert('Part 1 requires either an image or audio file! Please select a file (it will auto-upload).');
        return;
    }

    if (part >= 2 && part <= 4 && !audioText && !audioUrl) {
        alert(`Part ${part} requires audio! Please upload an audio file or provide audio text.`);
        return;
    }

    const questionData = { part, correctAnswer, options };

    if (questionText && part >= 2) questionData.questionText = questionText;
    if (audioText) questionData.audioText = audioText;
    if (passageRaw) questionData.passages = [passageRaw];
    if (imageUrlRaw) questionData.imageUrls = [imageUrlRaw];
    if (audioUrl) questionData.audioUrl = audioUrl;
    if (explanationRaw) {
        try { questionData.explanation = JSON.parse(explanationRaw); }
        catch { questionData.explanation = { note: explanationRaw }; }
    }
    if (groupIdRaw) questionData.groupId = groupIdRaw;
    if (questionIndexRaw) questionData.questionIndex = parseInt(questionIndexRaw);
    if (passageCountRaw) questionData.passageCount = parseInt(passageCountRaw);
    if (audioTranslateRaw) questionData.audioTranslate = audioTranslateRaw;
    if (questionTranslateRaw) questionData.questionTranslate = questionTranslateRaw;
    if (sourceRaw) questionData.source = sourceRaw;

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

        if (!data.success) throw new Error(data.message || 'Failed to save question');

        const isEditMode = !!questionId;

        if (isEditMode) {
            alert('✅ Question updated successfully!');
            closeQuestionModal();
            loadQuestions();
        } else {
            alert('✅ Question created successfully! Form is ready for next question.');

            lastSelectedPart = part;

            const form = document.getElementById('question-form');
            const currentPart = document.getElementById('question-part').value;

            form.reset();
            document.getElementById('question-part').value = currentPart;
            updatePartVisibility();

            document.getElementById('image-preview').style.display = 'none';
            document.getElementById('preview-img').src = '';
            document.getElementById('audio-preview').style.display = 'none';
            document.getElementById('preview-audio').src = '';
            document.getElementById('question-image-url').value = '';
            document.getElementById('question-audio-url').value = '';

            const firstInput = document.getElementById('question-text');
            if (firstInput && firstInput.offsetParent !== null) {
                firstInput.focus();
            } else {
                document.getElementById('option-A')?.focus();
            }

            loadQuestions();
        }
    } catch (error) {
        console.error('Error saving question:', error);
        alert('❌ Failed to save question: ' + error.message);
    }
}

async function deleteQuestion(questionId) {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
        const res = await fetch(`${TOEIC_API_BASE}/questions/${questionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.message || 'Failed to delete question');

        alert('✅ Question deleted successfully!');
        loadQuestions();
    } catch (error) {
        console.error('Error deleting question:', error);
        alert('❌ Failed to delete question: ' + error.message);
    }
}

async function deleteAllQuestions() {
    const confirmed1 = confirm('⚠️ WARNING: Bạn sắp xóa TẤT CẢ câu hỏi TOEIC!\n\nHành động này KHÔNG THỂ HOÀN TÁC!\n\nBạn có chắc chắn muốn tiếp tục?');
    if (!confirmed1) return;

    const typeConfirm = prompt('Để xác nhận xóa TẤT CẢ câu hỏi, vui lòng nhập chữ "DELETE ALL" (viết hoa):');
    if (typeConfirm !== 'DELETE ALL') {
        alert('❌ Xác nhận không đúng. Hủy thao tác xóa.');
        return;
    }

    try {
        const loadingMsg = document.createElement('div');
        loadingMsg.id = 'delete-all-loading';
        loadingMsg.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: white; padding: 30px; border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 10000; text-align: center;
        `;
        loadingMsg.innerHTML = `
            <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #ff6b6b; margin-bottom: 20px;"></i>
            <h3 style="margin: 0; color: #333;">Đang xóa tất cả câu hỏi...</h3>
            <p style="color: #666; margin-top: 10px;">Vui lòng chờ, đừng tắt trang này.</p>
        `;
        document.body.appendChild(loadingMsg);

        const res = await fetch(`${TOEIC_API_BASE}/questions/delete-all`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' }
        });

        const data = await res.json();
        document.getElementById('delete-all-loading')?.remove();

        if (!data.success) throw new Error(data.message || 'Failed to delete all questions');

        alert(`✅ Đã xóa thành công ${data.deletedCount || 'tất cả'} câu hỏi TOEIC!`);
        loadQuestions();
    } catch (error) {
        document.getElementById('delete-all-loading')?.remove();
        console.error('Error deleting all questions:', error);
        alert('❌ Lỗi khi xóa câu hỏi: ' + error.message);
    }
}

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
    if (!confirm(`Generate ${count} AI questions for Part ${part}?\n\nThis will use OpenAI API and may take a moment.`)) return;

    try {
        const res = await fetch(`${TOEIC_API_BASE}/questions/ai-generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ part, count, autoSave: true })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Server error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        if (!data.success) throw new Error(data.message || 'Failed to generate questions');

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

window.editQuestion = (questionId) => openQuestionModal(questionId);
window.deleteQuestion = deleteQuestion;

function openTestModal(testId = null) {
    const modal = document.getElementById('test-modal');
    const form = document.getElementById('test-form');
    const modalTitle = modal.querySelector('h3');
    const submitBtn = form.querySelector('button[type="submit"]');

    form.reset();
    document.getElementById('test-name').value = '';
    document.getElementById('test-type').value = 'full-test';
    document.getElementById('test-duration').value = '120';
    document.getElementById('test-description').value = '';
    document.getElementById('test-source').value = '';
    document.getElementById('test-level').value = 'intermediate';
    document.getElementById('random-question-count').value = '';
    const reuseCheckbox = document.getElementById('reuse-questions-checkbox');
    if (reuseCheckbox) reuseCheckbox.checked = false;

    modal.dataset.testId = testId || '';
    modal.dataset.editMode = testId ? 'true' : 'false';

    if (testId) {
        modalTitle.innerHTML = '<i class="fas fa-edit"></i> Chỉnh sửa đề thi';
        submitBtn.textContent = 'Cập nhật';
    } else {
        modalTitle.innerHTML = '<i class="fas fa-file-alt"></i> Tạo đề thi mới';
        submitBtn.textContent = 'Tạo đề thi';
    }

    modal.style.display = 'flex';

    const testTypeSelect = document.getElementById('test-type');
    const randomQuestionsField = document.getElementById('random-questions-field');

    const testTypeTimes = {
        'full-test': 120, 'mini-part1': 4, 'mini-part2': 10,
        'mini-part3': 17, 'mini-part4': 15, 'mini-part5': 12,
        'mini-part6': 8, 'mini-part7': 34,
    };

    // Replace listener by cloning node to avoid stacking listeners on reopen
    const freshSelect = testTypeSelect.cloneNode(true);
    testTypeSelect.parentNode.replaceChild(freshSelect, testTypeSelect);
    freshSelect.addEventListener('change', function () {
        const isFullTest = this.value === 'full-test';
        randomQuestionsField.style.display = isFullTest ? 'none' : 'block';
        if (isFullTest) document.getElementById('random-question-count').value = '';
        const suggested = testTypeTimes[this.value];
        if (suggested) document.getElementById('test-duration').value = suggested;
    });

    randomQuestionsField.style.display = 'none';
}

function closeTestModal() {
    const modal = document.getElementById('test-modal');
    const form = document.getElementById('test-form');

    modal.style.display = 'none';
    form.reset();
    document.getElementById('test-name').value = '';
    document.getElementById('test-type').value = 'full-test';
    document.getElementById('test-duration').value = '';
    document.getElementById('test-description').value = '';
    document.getElementById('test-source').value = '';
    document.getElementById('test-level').value = 'intermediate';
    document.getElementById('random-question-count').value = '';
    const reuseCheckbox = document.getElementById('reuse-questions-checkbox');
    if (reuseCheckbox) reuseCheckbox.checked = false;

    modal.dataset.testId = '';
    modal.dataset.editMode = 'false';
}

async function editTest(testId) {
    try {
        const res = await fetch(`${TOEIC_API_BASE}/tests/${testId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const data = await res.json();

        if (!data.success) {
            alert('Failed to load test details: ' + data.message);
            return;
        }

        const test = data.data;

        if (test.isPublished) {
            alert('⚠️ Cannot Edit Published Test\n\nThis test is currently published. Please unpublish it first before making any changes.');
            return;
        }

        openTestModal(testId);

        document.getElementById('test-name').value = test.testName || '';
        document.getElementById('test-type').value = test.testType || '';
        document.getElementById('test-description').value = test.description || '';
        document.getElementById('test-source').value = test.source || '';
        document.getElementById('test-level').value = test.level || 'intermediate';
        document.getElementById('test-duration').value = Math.round(test.totalTime / 60) || '';

        const randomQuestionsField = document.getElementById('random-questions-field');
        if (test.testType !== 'full-test') {
            randomQuestionsField.style.display = 'block';
            document.getElementById('random-question-count').value = test.randomQuestionCount || '';
        } else {
            randomQuestionsField.style.display = 'none';
            document.getElementById('random-question-count').value = '';
        }

        const reuseCheckbox = document.getElementById('reuse-questions-checkbox');
        if (reuseCheckbox) reuseCheckbox.checked = test.allowReuseQuestions || false;

    } catch (error) {
        console.error('Error loading test:', error);
        alert('Error loading test details. Please try again.');
    }
}

async function handleTestSubmit(e) {
    e.preventDefault();

    const modal = document.getElementById('test-modal');
    const isEditMode = modal.dataset.editMode === 'true';
    const testId = modal.dataset.testId;

    const testName = document.getElementById('test-name').value.trim();
    const testType = document.getElementById('test-type').value;
    const description = document.getElementById('test-description').value.trim();
    const source = document.getElementById('test-source').value.trim();
    const level = document.getElementById('test-level').value;
    const duration = parseInt(document.getElementById('test-duration').value);

    if (!testName || !testType || !duration) {
        alert('Vui lòng điền đầy đủ: tên đề, loại đề và thời gian!');
        return;
    }

    if (duration < 1) {
        alert('Thời gian phải ít nhất 1 phút!');
        return;
    }

    const testData = { testName, testType, description, totalTime: duration * 60, level };
    if (source) testData.source = source;

    const randomCount = parseInt(document.getElementById('random-question-count').value);
    if (!isNaN(randomCount) && randomCount > 0) testData.randomQuestionCount = randomCount;

    const reuseQuestions = document.getElementById('reuse-questions-checkbox')?.checked || false;
    testData.allowReuseQuestions = reuseQuestions;

    try {
        const url = isEditMode ? `${TOEIC_API_BASE}/tests/${testId}` : `${TOEIC_API_BASE}/tests`;
        const method = isEditMode ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify(testData)
        });

        const data = await res.json();

        if (!data.success) {
            if (data.insufficientParts && data.insufficientParts.length > 0) {
                let errorMsg = '⚠️ Cannot Create Test: Insufficient Questions\n\n';
                errorMsg += 'The following parts do not have enough questions:\n\n';
                data.insufficientParts.forEach(p => {
                    errorMsg += `• Part ${p.part}:\n  Required: ${p.required} | Available: ${p.available} | Missing: ${p.missing}\n\n`;
                });
                errorMsg += '💡 Please add more questions to these parts using:\n   - "Add Question" button\n   - "AI Generate" feature';
                alert(errorMsg);
            } else {
                throw new Error(data.message || 'Failed to create test');
            }
            return;
        }

        alert(data.message || (isEditMode ? '✅ Test updated successfully!' : '✅ Test created successfully!'));
        closeTestModal();
        loadTests();
    } catch (error) {
        console.error(isEditMode ? 'Error updating test:' : 'Error creating test:', error);
        alert('❌ Error:\n\n' + (error.message || (isEditMode ? 'Failed to update test' : 'Failed to create test')));
    }
}

async function generateTest() {
    if (!confirm('Generate a full TOEIC test automatically? This will create a 200-question test with random questions from all parts.')) return;

    try {
        const timestamp = new Date().toISOString().split('T')[0];
        const testNumber = Math.floor(Math.random() * 1000);

        const testData = {
            testName: `Auto-Generated Test #${testNumber}`,
            description: `Automatically generated full TOEIC test on ${timestamp}`
        };

        const res = await fetch(`${TOEIC_API_BASE}/tests/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify(testData)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Server error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        if (!data.success) {
            if (data.insufficientParts && data.insufficientParts.length > 0) {
                let errorMsg = '⚠️ Cannot Generate Full Test: Insufficient Questions\n\n';
                data.insufficientParts.forEach(p => {
                    errorMsg += `• Part ${p.part} (${p.partName}):\n  Required: ${p.required} | Available: ${p.available} | Missing: ${p.missing}\n\n`;
                });
                errorMsg += '💡 Please add more questions to these parts using:\n   - "Add Question" button\n   - "AI Generate" feature';
                alert(errorMsg);
            } else {
                throw new Error(data.message || 'Failed to generate test');
            }
            return;
        }

        alert('✅ Test generated successfully!');
        loadTests();
    } catch (error) {
        console.error('Error generating test:', error);
        alert('❌ Error:\n\n' + (error.message || 'Failed to generate test'));
    }
}

async function publishTest(testId, shouldPublish) {
    const action = shouldPublish ? 'publish' : 'unpublish';
    if (!confirm(`Are you sure you want to ${action} this test?`)) return;

    try {
        const res = await fetch(`${TOEIC_API_BASE}/tests/${testId}/publish`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ isPublished: shouldPublish })
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.message || `Failed to ${action} test`);

        alert(`✅ Test ${action}ed successfully!`);
        loadTests();
    } catch (error) {
        console.error(`Error ${action}ing test:`, error);
        alert(`❌ Failed to ${action} test: ` + error.message);
    }
}

async function deleteTest(testId) {
    if (!confirm('Are you sure you want to delete this test? All associated attempts will remain but the test will be unavailable.')) return;

    try {
        const res = await fetch(`${TOEIC_API_BASE}/tests/${testId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.message || 'Failed to delete test');

        alert('✅ Test deleted successfully!');
        loadTests();
    } catch (error) {
        console.error('Error deleting test:', error);
        alert('❌ Failed to delete test: ' + error.message);
    }
}

window.publishTest = publishTest;
window.deleteTest = deleteTest;

async function deleteAllTests() {
    const confirmText = prompt('⚠️ CẢNH BÁO: Hành động này sẽ xóa TẤT CẢ bài test!\n\nNhập "XOA TAT CA" để xác nhận:');

    if (confirmText !== 'XOA TAT CA') {
        alert('Đã hủy. Nhập đúng "XOA TAT CA" để xác nhận xóa.');
        return;
    }

    try {
        const res = await fetch(`${TOEIC_API_BASE}/tests/delete-all`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.message || 'Failed to delete all tests');

        alert(`✅ Đã xóa ${data.deletedCount || 'tất cả'} bài test!`);
        loadTests();
    } catch (error) {
        console.error('Error deleting all tests:', error);
        alert('❌ Lỗi khi xóa: ' + error.message);
    }
}


async function loadUsersInTab() {
    const tbody = document.querySelector("#users-table-tab tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="loading"><i class="fas fa-spinner"></i> Đang tải danh sách tài khoản...</td></tr>`;

    try {
        const res = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();

        if (data.success) {
            allUsers = data.data || [];
            currentUsers = [...allUsers];

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

async function loadPracticeHistory(page = 1, userId = '', search = '') {
    try {
        practiceHistoryPage = page;
        const params = new URLSearchParams({ page, limit: practiceHistoryLimit });

        if (userId) params.append('userId', userId);
        if (search) params.append('search', search);

        const response = await fetch(`${API_URL}/toeic/admin/practice-history?${params}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
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
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
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

    setTimeout(() => {
        document.querySelectorAll('.history-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                viewPracticeDetails(btn.getAttribute('data-attempt-id'));
            });
        });

        document.querySelectorAll('.history-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                deleteSingleHistory(btn.getAttribute('data-attempt-id'));
            });
        });
    }, 0);
}

function getHistoryFilters() {
    return {
        userId: document.getElementById('history-filter-user')?.value || '',
        search: document.getElementById('history-search')?.value || ''
    };
}

async function viewPracticeDetails(attemptId) {
    try {
        const response = await fetch(`${API_URL}/toeic/attempts/${attemptId}/review`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
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

function showPracticeDetailsModal(data) {
    const modal = document.createElement('div');
    modal.id = 'practice-details-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.5); display: flex;
        align-items: center; justify-content: center; z-index: 10000;
    `;

    modal.innerHTML = `
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
                    <div><strong>Total Questions:</strong> ${data.stats.total}</div>
                    <div style="color: var(--success);"><strong>Correct:</strong> ${data.stats.correct}</div>
                    <div style="color: var(--danger);"><strong>Incorrect:</strong> ${data.stats.incorrect}</div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('close-practice-modal-btn')?.addEventListener('click', closePracticeDetailsModal);
}

function closePracticeDetailsModal() {
    const modal = document.getElementById('practice-details-modal');
    if (modal) modal.remove();
}

async function loadUsersListForHistory() {
    try {
        const response = await fetch(`${API_URL}/toeic/admin/users-list`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const result = await response.json();

        if (result.success) {
            const select = document.getElementById('history-filter-user');
            if (select) {
                select.innerHTML = '<option value="">-- Tất cả --</option>' +
                    result.data.map(user => `
                        <option value="${user._id}">${user.username} (${user.email})</option>
                    `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading users list:', error);
    }
}

async function deleteSingleHistory(attemptId) {
    if (!confirm('Are you sure you want to delete this practice history entry?')) return;

    try {
        const response = await fetch(`${API_URL}/toeic/admin/practice-history/${attemptId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const result = await response.json();

        if (result.success) {
            alert('Practice history deleted successfully!');
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

async function deleteAllUserHistory() {
    const userId = document.getElementById('history-filter-user')?.value;

    if (!userId) {
        alert('Please select a user first!');
        return;
    }

    const userSelect = document.getElementById('history-filter-user');
    const selectedOption = userSelect.options[userSelect.selectedIndex];
    const username = selectedOption.text;

    if (!confirm(`Are you sure you want to delete ALL practice history for ${username}?\n\nThis action cannot be undone!`)) return;

    try {
        const response = await fetch(`${API_URL}/toeic/admin/practice-history/user/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const result = await response.json();

        if (result.success) {
            alert(result.message);
            loadPracticeHistory(1, '', '');
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

async function deleteAllHistory() {
    if (!confirm('⚠️ WARNING: Are you sure you want to delete ALL practice history from ALL users?\n\nThis will permanently delete EVERYTHING and CANNOT be undone!')) return;
    if (!confirm('⚠️ FINAL WARNING: This will delete ALL practice history entries from the database.\n\nType confirmation: Click OK to proceed with deletion.')) return;

    try {
        const response = await fetch(`${API_URL}/toeic/admin/practice-history/all`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const result = await response.json();

        if (result.success) {
            alert(`✅ ${result.message}`);
            loadPracticeHistory(1, '', '');
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
