// ===================================
// FAVORITES MODULE - Danh sách từ vựng yêu thích
// ===================================

const FavoritesUI = (() => {
    const BASE_KEY = 'favorites_list';

    function getToken() {
        try { return JSON.parse(localStorage.getItem('authToken') || '{}').token || null; } catch { return null; }
    }

    function getStorageKey() {
        try {
            const raw = localStorage.getItem('authToken');
            if (raw) {
                const parsed = JSON.parse(raw);
                const email = parsed.email || parsed.user?.email || '';
                if (email) return `${BASE_KEY}_${email}`;
                // fallback: decode JWT to get sub/email
                const token = parsed.token || raw;
                const payload = JSON.parse(atob(token.split('.')[1]));
                const id = payload.email || payload.sub || payload.id || '';
                if (id) return `${BASE_KEY}_${id}`;
            }
        } catch (e) {}
        return BASE_KEY;
    }

    // ===== Server sync =====
    function apiCall(method, body) {
        const token = getToken();
        if (!token) return;
        fetch('/api/vocabulary/favorites', {
            method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: body ? JSON.stringify(body) : undefined,
        }).catch(() => {});
    }

    async function syncFromServer() {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch('/api/vocabulary/favorites', {
                headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.json());
            if (res.success) saveFavorites(res.data || []);
        } catch {}
    }

    // ===== Storage =====
    function getFavorites() {
        try {
            return JSON.parse(localStorage.getItem(getStorageKey()) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveFavorites(list) {
        localStorage.setItem(getStorageKey(), JSON.stringify(list));
    }

    function isFavorite(word) {
        if (!word || !word.en) return false;
        return getFavorites().some(w => w.en === word.en);
    }

    function toggleFavorite(word) {
        if (!word || !word.en) return false;
        let list = getFavorites();
        const idx = list.findIndex(w => w.en === word.en);
        if (idx >= 0) {
            list.splice(idx, 1);
            saveFavorites(list);
            apiCall('DELETE', { en: word.en });
            return false;
        } else {
            const entry = { en: word.en, vn: word.vn || '', phonetic: word.phonetic || '', synonyms: word.synonyms || '', part: word.part || '' };
            list.push(entry);
            saveFavorites(list);
            apiCall('POST', { word: entry });
            return true;
        }
    }

    // ===== Get current practice word from active mode =====
    function getCurrentWord() {
        const session = (typeof PracticeManager !== 'undefined') ? PracticeManager.currentSession : null;
        if (!session) return null;
        const mode = session.mode;
        try {
            switch (mode) {
                case 'flashcard':
                    return (typeof Flashcard !== 'undefined') ? Flashcard.words?.[Flashcard.currentIndex] : null;
                case 'multiple-choice':
                    return (typeof MultipleChoice !== 'undefined') ? MultipleChoice.questions?.[MultipleChoice.currentIndex]?.word : null;
                case 'fill-blank':
                    return (typeof FillBlank !== 'undefined') ? FillBlank.questions?.[FillBlank.currentIndex]?.word : null;
                case 'listening':
                    return (typeof Listening !== 'undefined') ? Listening.questions?.[Listening.currentIndex]?.word : null;
                case 'speed-quiz':
                    return (typeof SpeedQuiz !== 'undefined') ? SpeedQuiz.questions?.[SpeedQuiz.currentIndex]?.word : null;
                case 'synonym-check':
                    return (typeof SynonymCheck !== 'undefined') ? SynonymCheck.questions?.[SynonymCheck.currentIndex]?.word : null;
                case 'word-type-check':
                    return (typeof WordTypeCheck !== 'undefined') ? WordTypeCheck.questions?.[WordTypeCheck.currentIndex]?.word : null;
                case 'example-fill-blank':
                    return (typeof ExampleFillBlank !== 'undefined') ? ExampleFillBlank.questions?.[ExampleFillBlank.currentIndex]?.word : null;
                case 'review-mistakes':
                    return (typeof ReviewMistakes !== 'undefined') ? ReviewMistakes.questions?.[ReviewMistakes.currentIndex]?.word : null;
                case 'sentence-builder':
                    return (typeof SentenceBuilder !== 'undefined') ? SentenceBuilder.questions?.[SentenceBuilder.currentIndex]?.word : null;
                case 'pronunciation':
                    return (typeof PronunciationMode !== 'undefined') ? PronunciationMode.questions?.[PronunciationMode.currentIndex]?.word : null;
                case 'context-learning':
                    return (typeof ContextLearning !== 'undefined') ? ContextLearning.questions?.[ContextLearning.currentIndex]?.word : null;
                case 'dictation':
                    return (typeof Dictation !== 'undefined') ? Dictation.questions?.[Dictation.currentIndex]?.word : null;
                case 'sentence-listening':
                    return (typeof SentenceListening !== 'undefined') ? SentenceListening.questions?.[SentenceListening.currentIndex]?.word : null;
                case 'phonetic-quiz':
                    return (typeof PhoneticQuiz !== 'undefined') ? PhoneticQuiz.questions?.[PhoneticQuiz.currentIndex]?.word : null;
                default:
                    return null;
            }
        } catch (e) {
            return null;
        }
    }

    // ===== Inject star button next to .word-phonetic =====
    function injectStarBtn() {
        // Nếu nút đã tồn tại, chỉ cập nhật trạng thái (tránh loop observer)
        const existing = document.querySelector('#practice-content .fav-inline-star');
        if (existing) {
            const word = getCurrentWord();
            if (word) {
                existing.classList.toggle('fav-star-active', isFavorite(word));
                existing.title = isFavorite(word) ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích';
            }
            return;
        }

        // Xóa nút cũ nếu có (ngoài practice-content)
        document.querySelectorAll('.fav-inline-star').forEach(el => el.remove());

        const word = getCurrentWord();
        if (!word) return;

        // Tìm phần tử phiên âm trong practice-content
        const phoneticEl = document.querySelector('#practice-content .word-phonetic');
        if (!phoneticEl) return;

        const btn = document.createElement('button');
        btn.className = 'fav-inline-star' + (isFavorite(word) ? ' fav-star-active' : '');
        btn.title = isFavorite(word) ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích';
        btn.innerHTML = `<i class="fas fa-star"></i>`;

        btn.addEventListener('click', () => {
            const currentWord = getCurrentWord();
            if (!currentWord) return;
            const added = toggleFavorite(currentWord);
            btn.classList.toggle('fav-star-active', added);
            btn.title = added ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích';
            const msg = added ? `⭐ Đã thêm "${currentWord.en}" vào yêu thích` : `✕ Đã xóa "${currentWord.en}" khỏi yêu thích`;
            if (typeof Notification !== 'undefined' && Notification.show) {
                Notification.show({ type: added ? 'success' : 'info', message: msg });
            }
        });

        // Chèn sau phần tử phiên âm
        phoneticEl.style.display = 'inline-flex';
        phoneticEl.style.alignItems = 'center';
        phoneticEl.style.gap = '6px';
        phoneticEl.appendChild(btn);
    }

    // ===== Favorites List Button (dùng nav button) =====
    function createListButton() {
        const navBtn = document.getElementById('nav-favorite-btn');
        if (!navBtn) return;

        navBtn.addEventListener('click', () => {
            openModal();
        });
    }

    // ===== Modal =====
    function createModal() {
        const modal = document.createElement('div');
        modal.id = 'fav-modal';
        modal.className = 'fav-modal';
        modal.innerHTML = `
            <div class="fav-modal-content">
                <div class="fav-modal-header">
                    <h3><i class="fas fa-star"></i> Từ vựng yêu thích</h3>
                    <button class="fav-modal-close" id="fav-modal-close" title="Đóng">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="fav-modal-body">
                    <div id="fav-list-container"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('fav-modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    }

    function openModal() {
        renderList();
        document.getElementById('fav-modal').classList.add('fav-modal-open');
    }

    function closeModal() {
        document.getElementById('fav-modal').classList.remove('fav-modal-open');
    }

    function renderList() {
        const container = document.getElementById('fav-list-container');
        if (!container) return;
        const list = getFavorites();

        if (list.length === 0) {
            container.innerHTML = `
                <div class="fav-empty">
                    <i class="fas fa-star" style="font-size:48px; color:var(--primary-color,#E11D48); margin-bottom:12px;"></i>
                    <p>Chưa có từ vựng yêu thích nào.</p>
                    <p style="font-size:13px; color:var(--text-secondary,#9ca3af);">Trong lúc luyện tập, bấm ⭐ cạnh phiên âm để thêm từ vào đây.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="fav-toolbar">
                <span class="fav-count">${list.length} từ</span>
                <button class="fav-clear-btn" id="fav-clear-btn" title="Xóa tất cả">
                    <i class="fas fa-trash-alt"></i> Xóa tất cả
                </button>
            </div>
            <div class="fav-table-wrap">
                <table class="fav-table">
                    <thead>
                        <tr>
                            <th>Tiếng Anh</th>
                            <th>Tiếng Việt</th>
                            <th>Đồng nghĩa</th>
                            <th>Phiên âm</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.map((w, i) => `
                            <tr>
                                <td class="fav-word-en">${w.en}</td>
                                <td class="fav-word-vn">${w.vn || '—'}</td>
                                <td class="fav-word-syn">${w.synonyms || '—'}</td>
                                <td class="fav-word-ph">${w.phonetic ? `/${w.phonetic}/` : '—'}</td>
                                <td class="fav-actions">
                                    <button class="fav-speak-btn" data-word="${w.en}" title="Nghe phát âm">
                                        <i class="fas fa-volume-up"></i>
                                    </button>
                                    <button class="fav-remove-btn" data-en="${w.en}" title="Xóa">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.querySelectorAll('.fav-speak-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const word = btn.dataset.word;
                if (typeof GameLogic !== 'undefined' && GameLogic.speakWord) {
                    GameLogic.speakWord(word, 'en-US');
                } else if (window.speechSynthesis) {
                    const u = new SpeechSynthesisUtterance(word);
                    u.lang = 'en-US';
                    speechSynthesis.speak(u);
                }
            });
        });

        container.querySelectorAll('.fav-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const en = btn.dataset.en;
                const updated = getFavorites().filter(w => w.en !== en);
                saveFavorites(updated);
                apiCall('DELETE', { en });
                renderList();
            });
        });

        const clearBtn = document.getElementById('fav-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Xóa toàn bộ danh sách yêu thích?')) {
                    saveFavorites([]);
                    apiCall('DELETE', { all: true });
                    renderList();
                }
            });
        }
    }

    // ===== Init =====
    function init() {
        createListButton();
        createModal();
        syncFromServer(); // load favorites từ server (theo tài khoản)

        // Observer: inject star btn mỗi khi practice-content thay đổi
        const practiceContent = document.getElementById('practice-content');
        if (practiceContent) {
            const observer = new MutationObserver(() => {
                // Dùng timeout nhỏ để chờ DOM render xong
                setTimeout(injectStarBtn, 50);
            });
            observer.observe(practiceContent, { childList: true, subtree: true });
        }
    }

    return { init, isFavorite, toggleFavorite };
})();
