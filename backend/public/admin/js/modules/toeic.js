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
            <tr><td colspan="7" class="loading" style="color: red;">
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
            <tr><td colspan="9" class="loading">
                <i class="fas fa-inbox"></i>
                <p>No questions found</p>
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = currentQuestions.map(q => {
        let imageDisplay = '-';
        if (q.imageUrl) {
            const imagePath = q.imageUrl.replace('/assets/images/', '');
            imageDisplay = `<span style="color: #3498db; font-size: 0.85em; font-family: monospace;" title="${q.imageUrl}">${truncate(imagePath, 20)}</span>`;
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

function applyTestFilters() {
    let filtered = [...allTests];

    if (testFilters.searchText) {
        filtered = filtered.filter(t => t.testName && t.testName.toLowerCase().includes(testFilters.searchText));
    }

    if (testFilters.type) {
        filtered = filtered.filter(t => t.type === testFilters.type);
    }

    switch (testFilters.sortBy) {
        case 'newest': filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)); break;
        case 'oldest': filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)); break;
        case 'most-attempts': filtered.sort((a, b) => (b.attempts || 0) - (a.attempts || 0)); break;
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
    if (filteredCount) filteredCount.textContent = currentTests.length;
    if (totalCount) totalCount.textContent = allTests.length;
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
                    <button class="btn btn-success btn-sm btn-publish-test" data-test-id="${t._id}" title="Publish Test" style="margin-right: 5px;">
                        <i class="fas fa-check-circle"></i> Publish
                    </button>
                ` : ''}
                ${isPublished ? `
                    <button class="btn btn-warning btn-sm btn-unpublish-test" data-test-id="${t._id}" title="Unpublish Test" style="margin-right: 5px;">
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
            document.getElementById('question-passage').value = question.passage || '';
            document.getElementById('question-image-url').value = question.imageUrl || '';
            document.getElementById('question-audio-url').value = question.audioUrl || '';
            document.getElementById('question-explanation').value = question.explanation || '';
            document.getElementById('question-keyword').value = question.questionKeyword || '';
            document.getElementById('answer-keyword').value = question.answerKeyword || '';

            const audioKeywordInput = document.getElementById('audio-keyword');
            if (audioKeywordInput) audioKeywordInput.value = question.audioKeyword || '';

            if (question.imageUrl) {
                previewImg.src = question.imageUrl;
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

    modal.style.display = 'flex';
}

function closeQuestionModal() {
    document.getElementById('question-modal').style.display = 'none';
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

    if (question.part === 1 && question.imageUrl) {
        html += `<img src="${question.imageUrl}" style="width: 100%; max-width: 500px; margin: 0 auto 20px; display: block; border-radius: 8px;">`;
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

    if (question.passage) {
        html += `<div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; white-space: pre-wrap;">${question.passage}</div>`;
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

    if (question.explanation) {
        html += `
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <strong style="color: #f59e0b;"><i class="fas fa-lightbulb"></i> Explanation:</strong>
                <p style="margin-top: 10px;">${question.explanation}</p>
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
    const passage = document.getElementById('question-passage').value.trim();
    const imageUrl = document.getElementById('question-image-url').value.trim();
    const audioUrl = document.getElementById('question-audio-url').value.trim();
    const explanation = document.getElementById('question-explanation').value.trim();

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

    if (part === 1 && !imageUrl && !audioUrl) {
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
    if (passage) questionData.passage = passage;
    if (imageUrl) questionData.imageUrl = imageUrl;
    if (audioUrl) questionData.audioUrl = audioUrl;
    if (explanation) questionData.explanation = explanation;

    const questionKeyword = document.getElementById('question-keyword')?.value.trim();
    const answerKeyword = document.getElementById('answer-keyword')?.value.trim();
    if (questionKeyword) questionData.questionKeyword = questionKeyword;
    if (answerKeyword) questionData.answerKeyword = answerKeyword;

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
    document.getElementById('test-duration').value = '';
    document.getElementById('test-description').value = '';
    document.getElementById('random-question-count').value = '';
    const reuseCheckbox = document.getElementById('reuse-questions-checkbox');
    if (reuseCheckbox) reuseCheckbox.checked = false;

    modal.dataset.testId = testId || '';
    modal.dataset.editMode = testId ? 'true' : 'false';

    if (testId) {
        modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Test';
        submitBtn.textContent = 'Update Test';
    } else {
        modalTitle.innerHTML = '<i class="fas fa-file-alt"></i> Create New Test';
        submitBtn.textContent = 'Create Test';
    }

    modal.style.display = 'flex';

    const testTypeSelect = document.getElementById('test-type');
    const randomQuestionsField = document.getElementById('random-questions-field');

    testTypeSelect.addEventListener('change', function() {
        const isFullTest = this.value === 'full-test';
        randomQuestionsField.style.display = isFullTest ? 'none' : 'block';
        if (isFullTest) document.getElementById('random-question-count').value = '';
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
    const duration = parseInt(document.getElementById('test-duration').value);

    if (!testName || !testType || !duration) {
        alert('Please fill in all required fields!');
        return;
    }

    if (duration < 1) {
        alert('Duration must be at least 1 minute!');
        return;
    }

    const testData = { testName, testType, description, totalTime: duration * 60 };

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

function openStatisticsModal() {
    document.getElementById('statistics-modal').style.display = 'flex';
    loadStatistics();
}

function closeStatisticsModal() {
    document.getElementById('statistics-modal').style.display = 'none';
}

async function loadStatistics() {
    try {
        const res = await fetch(`${TOEIC_API_BASE}/questions/statistics`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.message || 'Failed to load statistics');

        displayStatistics(data.data);
    } catch (error) {
        console.error('Error loading statistics:', error);
        alert('❌ Failed to load statistics: ' + error.message);
    }
}

function displayStatistics(data) {
    const { parts, summary, sections } = data;

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

    document.getElementById('stat-listening-count').textContent = sections.listening.count;
    document.getElementById('stat-listening-progress').textContent =
        `${((sections.listening.count / sections.listening.required) * 100).toFixed(1)}% complete`;

    document.getElementById('stat-reading-count').textContent = sections.reading.count;
    document.getElementById('stat-reading-progress').textContent =
        `${((sections.reading.count / sections.reading.required) * 100).toFixed(1)}% complete`;

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
                <td style="padding: 12px; text-align: center; color: ${part.missing > 0 ? '#f5576c' : '#38ef7d'}; font-weight: bold;">${part.missing}</td>
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
