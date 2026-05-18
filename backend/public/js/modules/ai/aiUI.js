// ===================================
// AI UI MODULE
// ===================================

const AIUI = (() => {
    let conversationHistory = [];
    const CHAT_HISTORY_KEY = 'ai_chat_history';
    const MAX_HISTORY = 200; // Giới hạn 200 tin nhắn (~100KB)

    /**
     * Initialize AI UI
     */
    function init() {
        loadChatHistory();
        createAIButton();
        createAIModal();
        setupEventListeners();
    }

    /**
     * Load chat history from localStorage
     */
    function loadChatHistory() {
        try {
            const saved = localStorage.getItem(CHAT_HISTORY_KEY);
            if (saved) {
                conversationHistory = JSON.parse(saved);
                console.log(`📚 Loaded ${conversationHistory.length} chat messages from history`);
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            conversationHistory = [];
        }
    }

    /**
     * Save chat history to localStorage
     */
    function saveChatHistory() {
        try {
            // Giới hạn số lượng tin nhắn
            if (conversationHistory.length > MAX_HISTORY) {
                conversationHistory = conversationHistory.slice(-MAX_HISTORY);
            }
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(conversationHistory));
        } catch (error) {
            console.error('Error saving chat history:', error);
        }
    }

    /**
     * Clear chat history
     */
    function clearChatHistory() {
        conversationHistory = [];
        localStorage.removeItem(CHAT_HISTORY_KEY);

        // Clear UI
        const container = document.getElementById('ai-chat-container');
        container.innerHTML = `
            <div class="ai-chat-welcome">
                <i class="fas fa-robot" style="font-size: 48px; color: var(--primary-color); margin-bottom: 15px;"></i>
                <h4>Xin chào! Tôi là trợ lý AI TOEIC</h4>
                <p>Bạn có thể hỏi tôi về từ vựng, ngữ pháp, hoặc bất kỳ câu hỏi nào về TOEIC!</p>
            </div>
        `;
    }

    /**
     * Create floating AI button
     */
    function createAIButton() {
        const button = document.createElement('button');
        button.id = 'ai-floating-btn';
        button.className = 'ai-floating-btn';
        button.innerHTML = `
            <i class="fas fa-robot"></i>
            <span class="ai-btn-text">AI</span>
        `;
        button.title = 'Trợ lý AI';
        document.body.appendChild(button);

        button.addEventListener('click', () => {
            openAIModal();
        });
    }

    /**
     * Create AI modal
     */
    function createAIModal() {
        const modal = document.createElement('div');
        modal.id = 'ai-modal';
        modal.className = 'ai-modal';
        modal.innerHTML = `
            <div class="ai-modal-content">
                <div class="ai-modal-header">
                    <h3><i class="fas fa-robot"></i> Trợ lý AI TOEIC</h3>
                    <div style="display: flex; gap: 10px;">
                        <button class="ai-modal-clear" id="ai-modal-clear" title="Xóa lịch sử chat">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="ai-modal-close" id="ai-modal-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <div class="ai-tabs">
                    <button class="ai-tab active" data-tab="chat">
                        <i class="fas fa-comments"></i> Chat
                    </button>
                    <button class="ai-tab" data-tab="explain">
                        <i class="fas fa-lightbulb"></i> Giải thích
                    </button>
                    <button class="ai-tab" data-tab="grammar">
                        <i class="fas fa-spell-check"></i> Ngữ pháp
                    </button>
                    <button class="ai-tab" data-tab="translate">
                        <i class="fas fa-language"></i> Dịch
                    </button>
                    <button class="ai-tab" data-tab="listen">
                        <i class="fas fa-headphones"></i> Nghe
                    </button>
                </div>

                <div class="ai-tab-content">
                    <!-- Chat Tab -->
                    <div class="ai-panel active" data-panel="chat">
                        <div class="ai-chat-container" id="ai-chat-container">
                            <div class="ai-chat-welcome">
                                <i class="fas fa-robot" style="font-size: 48px; color: var(--primary-color); margin-bottom: 15px;"></i>
                                <h4>Xin chào! Tôi là trợ lý AI TOEIC</h4>
                                <p>Bạn có thể hỏi tôi về từ vựng, ngữ pháp, hoặc bất kỳ câu hỏi nào về TOEIC!</p>
                            </div>
                        </div>
                        <div class="ai-chat-input-container">
                            <textarea id="ai-chat-input" placeholder="Nhập câu hỏi của bạn..." rows="2"></textarea>
                            <button id="ai-chat-send" class="ai-btn-primary">
                                <i class="fas fa-paper-plane"></i> Gửi
                            </button>
                        </div>
                    </div>

                    <!-- Explain Tab -->
                    <div class="ai-panel" data-panel="explain">
                        <div class="ai-input-group">
                            <label>Nhập từ vựng cần giải thích:</label>
                            <input type="text" id="ai-explain-word" placeholder="Ví dụ: accommodation" />
                            <button id="ai-explain-btn" class="ai-btn-primary">
                                <i class="fas fa-lightbulb"></i> Giải thích
                            </button>
                        </div>
                        <div id="ai-explain-result" class="ai-result-container"></div>
                    </div>

                    <!-- Grammar Tab -->
                    <div class="ai-panel" data-panel="grammar">
                        <div class="ai-input-group">
                            <label>Nhập câu tiếng Anh cần kiểm tra:</label>
                            <textarea id="ai-grammar-sentence" placeholder="Ví dụ: I goes to school every day" rows="3"></textarea>
                            <button id="ai-grammar-btn" class="ai-btn-primary">
                                <i class="fas fa-spell-check"></i> Kiểm tra
                            </button>
                        </div>
                        <div id="ai-grammar-result" class="ai-result-container"></div>
                    </div>

                    <!-- Translate Tab -->
                    <div class="ai-panel" data-panel="translate">
                        <div class="ai-input-group">
                            <label>Nhập câu tiếng Anh cần dịch:</label>
                            <textarea id="ai-translate-sentence" placeholder="Ví dụ: The hotel provides comfortable accommodation for business travelers" rows="3"></textarea>
                            <button id="ai-translate-btn" class="ai-btn-primary">
                                <i class="fas fa-language"></i> Dịch
                            </button>
                        </div>
                        <div id="ai-translate-result" class="ai-result-container"></div>
                    </div>

                    <!-- Listen Tab -->
                    <div class="ai-panel" data-panel="listen">
                        <div class="ai-listen-container">
                            <div class="ai-listen-header">
                                <button id="ai-listen-swap" class="ai-swap-btn" title="Hoán đổi vị trí">
                                    <i class="fas fa-exchange-alt"></i>
                                </button>
                                <button id="ai-listen-trim" class="ai-swap-btn" title="Xóa dòng trống">
                                    <i class="fas fa-compress-alt"></i>
                                </button>
                                <button id="ai-listen-translate" class="ai-btn-primary ai-translate-btn">
                                    <i class="fas fa-language"></i> Dịch
                                </button>
                                <button id="ai-listen-play" class="ai-btn-primary ai-play-btn">
                                    <i class="fas fa-play"></i> Nghe
                                </button>
                                <button id="ai-listen-pause" class="ai-btn-secondary ai-pause-btn" style="display: none;">
                                    <i class="fas fa-pause"></i> Tạm dừng
                                </button>
                                <button id="ai-listen-stop" class="ai-btn-secondary ai-stop-btn" style="display: none;">
                                    <i class="fas fa-stop"></i> Dừng
                                </button>
                                <div class="ai-listen-speed">
                                    <label>Tốc độ:</label>
                                    <select id="ai-listen-speed-select">
                                        <option value="0.5">0.5x</option>
                                        <option value="0.75">0.75x</option>
                                        <option value="1" selected>1x</option>
                                        <option value="1.25">1.25x</option>
                                        <option value="1.5">1.5x</option>
                                    </select>
                                </div>
                            </div>
                            <div class="ai-listen-panels" id="ai-listen-panels">
                                <div class="ai-listen-panel ai-listen-english" data-lang="en">
                                    <div class="ai-listen-panel-header">
                                        <span><i class="fas fa-flag-usa"></i> Tiếng Anh</span>
                                        <button class="ai-listen-clear" data-target="ai-listen-en-input" title="Xóa">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                    <textarea id="ai-listen-en-input" class="ai-listen-textarea" placeholder="Nhập văn bản tiếng Anh tại đây..."></textarea>
                                    <div class="ai-listen-highlight-layer" id="ai-listen-en-highlight"></div>
                                </div>
                                <div class="ai-listen-panel ai-listen-vietnamese" data-lang="vi">
                                    <div class="ai-listen-panel-header">
                                        <span><i class="fas fa-flag"></i> Tiếng Việt</span>
                                        <button class="ai-listen-clear" data-target="ai-listen-vi-input" title="Xóa">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                    <textarea id="ai-listen-vi-input" class="ai-listen-textarea" placeholder="Bản dịch tiếng Việt sẽ hiển thị ở đây..." readonly></textarea>
                                    <div class="ai-listen-highlight-layer" id="ai-listen-vi-highlight"></div>
                                </div>
                            </div>
                            <div class="ai-listen-status" id="ai-listen-status"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Close modal
        document.getElementById('ai-modal-close').addEventListener('click', closeAIModal);
        document.getElementById('ai-modal').addEventListener('click', (e) => {
            if (e.target.id === 'ai-modal') {
                closeAIModal();
            }
        });

        // Clear chat history
        document.getElementById('ai-modal-clear').addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử chat?')) {
                clearChatHistory();
            }
        });

        // Tab switching
        document.querySelectorAll('.ai-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                switchTab(tab.dataset.tab);
            });
        });

        // Chat send
        document.getElementById('ai-chat-send').addEventListener('click', sendChatMessage);
        document.getElementById('ai-chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });

        // Explain word
        document.getElementById('ai-explain-btn').addEventListener('click', explainWord);
        document.getElementById('ai-explain-word').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                explainWord();
            }
        });

        // Check grammar
        document.getElementById('ai-grammar-btn').addEventListener('click', checkGrammar);
        document.getElementById('ai-grammar-sentence').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                checkGrammar();
            }
        });

        // Translate
        document.getElementById('ai-translate-btn').addEventListener('click', translateSentence);
        document.getElementById('ai-translate-sentence').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                translateSentence();
            }
        });

        // Listen tab
        setupListenTab();
    }

    // ===== LISTEN TAB FUNCTIONALITY =====
    let listenState = {
        isPlaying: false,
        isPaused: false,
        lines: [],           // English lines
        viLines: [],         // Vietnamese lines
        currentLineIndex: 0,
        swapped: false,
        selectedVoice: null,
        voicesLoaded: false
    };

    /**
     * Setup Listen Tab event listeners
     */
    function setupListenTab() {
        // Load available voices
        loadVoices();

        // Swap button
        document.getElementById('ai-listen-swap').addEventListener('click', swapListenPanels);

        // Play/Pause/Stop buttons
        document.getElementById('ai-listen-play').addEventListener('click', startListening);
        document.getElementById('ai-listen-pause').addEventListener('click', pauseListening);
        document.getElementById('ai-listen-stop').addEventListener('click', stopListening);

        // Clear buttons
        document.querySelectorAll('.ai-listen-clear').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.target;
                const target = document.getElementById(targetId);
                if (target) {
                    target.value = '';
                    if (targetId === 'ai-listen-en-input') {
                        document.getElementById('ai-listen-vi-input').value = '';
                    }
                }
            });
        });

        // Manual translate button
        document.getElementById('ai-listen-translate').addEventListener('click', () => {
            const text = document.getElementById('ai-listen-en-input').value;
            translateForListen(text);
        });

        // Trim empty lines button
        document.getElementById('ai-listen-trim').addEventListener('click', trimEmptyLines);
    }

    /**
     * Remove empty lines from both textareas
     */
    function trimEmptyLines() {
        const enInput = document.getElementById('ai-listen-en-input');
        const viInput = document.getElementById('ai-listen-vi-input');

        // Remove empty lines from English
        const enLines = enInput.value.split(/\n/).filter(line => line.trim());
        enInput.value = enLines.join('\n');

        // Remove empty lines from Vietnamese
        const viLines = viInput.value.split(/\n/).filter(line => line.trim());
        viInput.value = viLines.join('\n');

        // Update state
        listenState.lines = enLines;
        listenState.viLines = viLines;

        document.getElementById('ai-listen-status').innerHTML =
            '<i class="fas fa-check"></i> Đã xóa dòng trống (' + enLines.length + ' dòng)';
    }

    /**
     * Load and select the best English voice
     */
    function loadVoices() {
        const setVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length === 0) return;

            // Priority order for natural-sounding English voices
            const preferredVoices = [
                'Google US English',
                'Google UK English Female',
                'Google UK English Male',
                'Microsoft Zira',
                'Microsoft David',
                'Samantha',
                'Alex',
                'en-US',
                'en-GB'
            ];

            // Find the best available voice
            for (const preferred of preferredVoices) {
                const voice = voices.find(v =>
                    v.name.includes(preferred) ||
                    v.lang.startsWith(preferred)
                );
                if (voice) {
                    listenState.selectedVoice = voice;
                    console.log('Selected voice:', voice.name);
                    break;
                }
            }

            // Fallback to any English voice
            if (!listenState.selectedVoice) {
                listenState.selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
            }

            listenState.voicesLoaded = true;
        };

        // Chrome loads voices asynchronously
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = setVoice;
        }
        setVoice();
    }

    /**
     * Swap listen panels position
     */
    function swapListenPanels() {
        const container = document.getElementById('ai-listen-panels');
        const panels = container.querySelectorAll('.ai-listen-panel');

        if (panels.length === 2) {
            listenState.swapped = !listenState.swapped;
            container.insertBefore(panels[1], panels[0]);

            const swapBtn = document.getElementById('ai-listen-swap');
            swapBtn.style.transform = listenState.swapped ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }

    /**
     * Translate English text for listen tab
     */
    async function translateForListen(text) {
        const viInput = document.getElementById('ai-listen-vi-input');
        const status = document.getElementById('ai-listen-status');

        if (!text.trim()) {
            viInput.value = '';
            listenState.lines = [];
            listenState.viLines = [];
            return;
        }

        status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang dịch...';

        try {
            const result = await window.AIHelper.translateSentence(text);
            if (result.success) {
                viInput.value = result.translation;

                // Split into lines for line-by-line sync
                listenState.lines = text.split(/\n/).filter(line => line.trim());
                listenState.viLines = result.translation.split(/\n/).filter(line => line.trim());

                status.innerHTML = '<i class="fas fa-check"></i> Sẵn sàng nghe (' + listenState.lines.length + ' dòng)';
            } else {
                status.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Lỗi dịch';
            }
        } catch (error) {
            console.error('Translation error:', error);
            status.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Lỗi kết nối';
        }
    }

    /**
     * Start listening - read line by line with highlighting
     */
    function startListening() {
        const enInput = document.getElementById('ai-listen-en-input');
        const text = enInput.value.trim();

        if (!text) {
            document.getElementById('ai-listen-status').innerHTML =
                '<i class="fas fa-exclamation-triangle"></i> Vui lòng nhập văn bản tiếng Anh';
            return;
        }

        // Resume if paused
        if (listenState.isPaused) {
            window.speechSynthesis.resume();
            listenState.isPaused = false;
            listenState.isPlaying = true;
            updateListenButtons(true);
            document.getElementById('ai-listen-status').innerHTML =
                '<i class="fas fa-volume-up"></i> Đang phát dòng ' + (listenState.currentLineIndex + 1) + '/' + listenState.lines.length;
            return;
        }

        // Stop any current speech
        window.speechSynthesis.cancel();

        // Split into lines
        listenState.lines = text.split(/\n/).filter(line => line.trim());
        listenState.currentLineIndex = 0;
        listenState.isPlaying = true;

        // Also split Vietnamese
        const viInput = document.getElementById('ai-listen-vi-input');
        listenState.viLines = viInput.value.split(/\n/).filter(line => line.trim());

        updateListenButtons(true);
        speakCurrentLine();
    }

    /**
     * Speak the current line
     */
    function speakCurrentLine() {
        if (listenState.currentLineIndex >= listenState.lines.length) {
            // All lines completed
            listenState.isPlaying = false;
            listenState.currentLineIndex = 0;
            clearHighlights();
            updateListenButtons(false);
            document.getElementById('ai-listen-status').innerHTML =
                '<i class="fas fa-check-circle"></i> Hoàn thành!';
            return;
        }

        const line = listenState.lines[listenState.currentLineIndex];
        highlightCurrentLine();

        document.getElementById('ai-listen-status').innerHTML =
            '<i class="fas fa-volume-up"></i> Đang phát dòng ' + (listenState.currentLineIndex + 1) + '/' + listenState.lines.length;

        const utterance = new SpeechSynthesisUtterance(line);

        // Use the best available voice
        if (listenState.selectedVoice) {
            utterance.voice = listenState.selectedVoice;
        }

        utterance.lang = 'en-US';
        utterance.rate = parseFloat(document.getElementById('ai-listen-speed-select').value);
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onend = () => {
            if (listenState.isPlaying && !listenState.isPaused) {
                listenState.currentLineIndex++;
                // Small delay between lines for better listening experience
                setTimeout(() => {
                    if (listenState.isPlaying && !listenState.isPaused) {
                        speakCurrentLine();
                    }
                }, 300);
            }
        };

        utterance.onerror = (event) => {
            console.error('Speech error:', event);
            // Try next line on error
            if (listenState.isPlaying) {
                listenState.currentLineIndex++;
                speakCurrentLine();
            }
        };

        window.speechSynthesis.speak(utterance);
    }

    /**
     * Highlight current line in both textareas (same line index for both)
     */
    function highlightCurrentLine() {
        const enInput = document.getElementById('ai-listen-en-input');
        const viInput = document.getElementById('ai-listen-vi-input');
        const enText = enInput.value;
        const viText = viInput.value;

        const enLines = enText.split(/\n/);
        const viLines = viText.split(/\n/);
        const lineIndex = listenState.currentLineIndex;

        // Find the start position of current English line
        let enStart = 0;
        for (let i = 0; i < lineIndex && i < enLines.length; i++) {
            enStart += enLines[i].length + 1; // +1 for newline
        }
        const enEnd = lineIndex < enLines.length ? enStart + enLines[lineIndex].length : enStart;

        // Find the start position of Vietnamese line (same index)
        let viStart = 0;
        for (let i = 0; i < lineIndex && i < viLines.length; i++) {
            viStart += viLines[i].length + 1;
        }
        const viEnd = lineIndex < viLines.length ? viStart + viLines[lineIndex].length : viStart;

        // Highlight both textareas at the same line
        enInput.focus();
        enInput.setSelectionRange(enStart, enEnd);

        viInput.focus();
        viInput.setSelectionRange(viStart, viEnd);

        // Return focus to English
        enInput.focus();

        // Scroll both textareas to show highlighted line
        scrollToLine(enInput, lineIndex, enLines.length);
        scrollToLine(viInput, lineIndex, viLines.length);
    }

    /**
     * Scroll textarea to show specific line
     */
    function scrollToLine(textarea, lineIndex, totalLines) {
        if (totalLines <= 0) return;
        const lineHeight = textarea.scrollHeight / totalLines;
        const scrollPosition = lineIndex * lineHeight - (textarea.clientHeight / 2) + (lineHeight / 2);
        textarea.scrollTop = Math.max(0, scrollPosition);
    }

    /**
     * Pause listening
     */
    function pauseListening() {
        if (listenState.isPlaying) {
            window.speechSynthesis.pause();
            listenState.isPaused = true;
            document.getElementById('ai-listen-play').style.display = 'inline-flex';
            document.getElementById('ai-listen-pause').style.display = 'none';
            document.getElementById('ai-listen-status').innerHTML =
                '<i class="fas fa-pause-circle"></i> Tạm dừng tại dòng ' + (listenState.currentLineIndex + 1);
        }
    }

    /**
     * Stop listening
     */
    function stopListening() {
        window.speechSynthesis.cancel();
        listenState.isPlaying = false;
        listenState.isPaused = false;
        listenState.currentLineIndex = 0;
        clearHighlights();
        updateListenButtons(false);
        document.getElementById('ai-listen-status').innerHTML =
            '<i class="fas fa-stop-circle"></i> Đã dừng';
    }

    /**
     * Update button visibility
     */
    function updateListenButtons(isPlaying) {
        document.getElementById('ai-listen-play').style.display = isPlaying ? 'none' : 'inline-flex';
        document.getElementById('ai-listen-pause').style.display = isPlaying ? 'inline-flex' : 'none';
        document.getElementById('ai-listen-stop').style.display = isPlaying ? 'inline-flex' : 'none';
    }

    /**
     * Clear all highlights
     */
    function clearHighlights() {
        const enInput = document.getElementById('ai-listen-en-input');
        const viInput = document.getElementById('ai-listen-vi-input');
        enInput.setSelectionRange(0, 0);
        viInput.setSelectionRange(0, 0);
        enInput.scrollTop = 0;
        viInput.scrollTop = 0;
    }

    /**
     * Switch tab
     */
    function switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.ai-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update panels
        document.querySelectorAll('.ai-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === tabName);
        });
    }

    /**
     * Open AI modal
     */
    function openAIModal() {
        document.getElementById('ai-modal').classList.add('active');

        // Load chat history when opening
        if (conversationHistory.length > 0) {
            restoreChatHistory();
        }
    }

    /**
     * Restore chat history to UI
     */
    function restoreChatHistory() {
        const container = document.getElementById('ai-chat-container');

        // Clear welcome message
        container.innerHTML = '';

        // Display all messages
        conversationHistory.forEach(msg => {
            const role = msg.role === 'user' ? 'user' : 'assistant';
            const messageDiv = document.createElement('div');
            messageDiv.className = `ai-chat-message ${role}`;
            messageDiv.innerHTML = `
                <div class="ai-chat-bubble">
                    ${msg.content}
                </div>
            `;
            container.appendChild(messageDiv);
        });

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Close AI modal
     */
    function closeAIModal() {
        document.getElementById('ai-modal').classList.remove('active');
    }

    /**
     * Send chat message
     */
    async function sendChatMessage() {
        const input = document.getElementById('ai-chat-input');
        const message = input.value.trim();

        if (!message) return;

        // Clear input
        input.value = '';

        // Add user message to chat
        addChatMessage('user', message);

        // Show loading
        const loadingId = addChatMessage('assistant', '<i class="fas fa-spinner fa-spin"></i> Đang suy nghĩ...', true);

        // Send to AI
        const result = await window.AIHelper.chatWithTutor(message, conversationHistory);

        // Remove loading
        removeChatMessage(loadingId);

        if (result.success) {
            addChatMessage('assistant', result.response);
            conversationHistory = result.conversationHistory || [];

            // Save to localStorage
            saveChatHistory();
        } else {
            addChatMessage('assistant', `❌ ${result.message || 'Lỗi kết nối AI'}`, true);
        }
    }

    /**
     * Add chat message
     */
    function addChatMessage(role, content, isTemp = false) {
        const container = document.getElementById('ai-chat-container');

        // Remove welcome message if exists
        const welcome = container.querySelector('.ai-chat-welcome');
        if (welcome) {
            welcome.remove();
        }

        const messageId = `msg-${Date.now()}`;
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-chat-message ${role}`;
        messageDiv.id = messageId;
        messageDiv.innerHTML = `
            <div class="ai-chat-bubble">
                ${content}
            </div>
        `;

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;

        return messageId;
    }

    /**
     * Remove chat message
     */
    function removeChatMessage(messageId) {
        const message = document.getElementById(messageId);
        if (message) {
            message.remove();
        }
    }

    /**
     * Explain word
     */
    async function explainWord() {
        const input = document.getElementById('ai-explain-word');
        const word = input.value.trim();
        const resultContainer = document.getElementById('ai-explain-result');

        if (!word) {
            resultContainer.innerHTML = '<div class="ai-error">⚠️ Vui lòng nhập từ vựng</div>';
            return;
        }

        // Show loading
        resultContainer.innerHTML = '<div class="ai-loading"><i class="fas fa-spinner fa-spin"></i> Đang phân tích...</div>';

        const result = await window.AIHelper.explainWord(word);

        if (result.success) {
            resultContainer.innerHTML = `
                <div class="ai-success">
                    <div class="ai-word-header">
                        <h4>${result.word.en}</h4>
                        <span class="ai-phonetic">${result.word.phonetic || ''}</span>
                        <span class="ai-vn">${result.word.vn}</span>
                    </div>
                    <div class="ai-explanation">
                        ${result.explanation.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        } else {
            resultContainer.innerHTML = `<div class="ai-error">❌ ${result.message || 'Không tìm thấy từ vựng'}</div>`;
        }
    }

    /**
     * Check grammar
     */
    async function checkGrammar() {
        const input = document.getElementById('ai-grammar-sentence');
        const sentence = input.value.trim();
        const resultContainer = document.getElementById('ai-grammar-result');

        if (!sentence) {
            resultContainer.innerHTML = '<div class="ai-error">⚠️ Vui lòng nhập câu cần kiểm tra</div>';
            return;
        }

        // Show loading
        resultContainer.innerHTML = '<div class="ai-loading"><i class="fas fa-spinner fa-spin"></i> Đang kiểm tra...</div>';

        const result = await window.AIHelper.checkGrammar(sentence);

        if (result.success) {
            const isCorrect = result.isCorrect;
            resultContainer.innerHTML = `
                <div class="ai-success">
                    <div class="ai-grammar-status ${isCorrect ? 'correct' : 'incorrect'}">
                        <i class="fas fa-${isCorrect ? 'check-circle' : 'times-circle'}"></i>
                        ${isCorrect ? 'Câu đúng ngữ pháp!' : 'Có lỗi ngữ pháp'}
                    </div>
                    ${!isCorrect ? `
                        <div class="ai-grammar-errors">
                            <strong>Lỗi:</strong>
                            <ul>
                                ${result.errors.map(e => `<li>${e}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="ai-grammar-corrected">
                            <strong>Câu đã sửa:</strong>
                            <p>${result.corrected}</p>
                        </div>
                    ` : ''}
                    <div class="ai-grammar-explanation">
                        <strong>Giải thích:</strong>
                        <p>${result.explanation}</p>
                    </div>
                </div>
            `;
        } else {
            resultContainer.innerHTML = `<div class="ai-error">❌ ${result.message || 'Lỗi kiểm tra ngữ pháp'}</div>`;
        }
    }

    /**
     * Translate sentence
     */
    async function translateSentence() {
        const input = document.getElementById('ai-translate-sentence');
        const sentence = input.value.trim();
        const resultContainer = document.getElementById('ai-translate-result');

        if (!sentence) {
            resultContainer.innerHTML = '<div class="ai-error">⚠️ Vui lòng nhập câu cần dịch</div>';
            return;
        }

        // Show loading
        resultContainer.innerHTML = '<div class="ai-loading"><i class="fas fa-spinner fa-spin"></i> Đang dịch...</div>';

        const result = await window.AIHelper.translateSentence(sentence);

        if (result.success) {
            resultContainer.innerHTML = `
                <div class="ai-success">
                    <div class="ai-translate-original">
                        <strong>Tiếng Anh:</strong>
                        <p>${result.original}</p>
                    </div>
                    <div class="ai-translate-arrow">
                        <i class="fas fa-arrow-down"></i>
                    </div>
                    <div class="ai-translate-result">
                        <strong>Tiếng Việt:</strong>
                        <p>${result.translation}</p>
                    </div>
                </div>
            `;
        } else {
            resultContainer.innerHTML = `<div class="ai-error">❌ ${result.message || 'Lỗi dịch câu'}</div>`;
        }
    }

    return {
        init,
        openAIModal,
        closeAIModal,
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', AIUI.init);
} else {
    AIUI.init();
}

// Export for use in other modules
window.AIUI = AIUI;
