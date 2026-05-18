// ===================================
// MATCHING MODE (ĐÃ SỬA LỖI ASYNC/AWAIT)
// ===================================

const Matching = {

    config: null,
    matchingData: null,
    selectedLeft: null,
    selectedRight: null,
    matchedPairs: [],
    allWords: [], // Lưu tất cả từ vựng
    currentBatch: 0, // Batch hiện tại (mỗi batch = 5 cặp)
    batchSize: 5, // Số cặp mỗi lần hiển thị
    totalBatches: 0, // Tổng số batch

    /**
     * Start mode
     */
    async start(config) { // THÊM ASYNC
        this.config = config;
        this.matchedPairs = [];
        this.selectedLeft = null;
        this.selectedRight = null;
        this.currentBatch = 0;

        // Dùng questionsPerRound đã tính sẵn từ practiceManager (đã áp dụng level filter + part filter)
        const requestCount = config.questionsPerRound || config.pairsCount || 20;

        // Use PartSelector to get words based on settings
        const words = await PartSelector.getWordsForPractice(requestCount);

        // Kiểm tra an toàn: Đảm bảo words là mảng
        if (!Array.isArray(words) || words.length === 0) {
            console.warn("🃏 Không có từ vựng nào để luyện tập. Kết thúc chế độ.");
            PracticeManager.complete();
            return;
        }

        const selectedWords = words;

        // Đảm bảo có đủ từ để tạo cặp
        if (selectedWords.length < 1) {
             PracticeManager.complete();
             return;
        }

        // Lưu tất cả từ vựng
        this.allWords = selectedWords;
        this.totalBatches = Math.ceil(selectedWords.length / this.batchSize);

        console.log(`📝 Total words: ${selectedWords.length}, Batches: ${this.totalBatches}, Batch size: ${this.batchSize}`);

        // Load batch đầu tiên
        this.loadBatch(0);
    },

    /**
     * Load một batch (5 cặp từ)
     */
    loadBatch(batchIndex) {
        this.currentBatch = batchIndex;

        // Lấy 5 từ cho batch này
        const startIndex = batchIndex * this.batchSize;
        const endIndex = Math.min(startIndex + this.batchSize, this.allWords.length);
        const batchWords = this.allWords.slice(startIndex, endIndex);

        if (batchWords.length === 0) {
            this.finish();
            return;
        }

        // Generate matching pairs cho batch này
        this.matchingData = GameLogic.generateMatching(batchWords.length, batchWords);

        console.log(`📝 Loading batch ${batchIndex + 1}/${this.totalBatches} - ${batchWords.length} pairs`);

        // Reset matched pairs cho batch mới
        this.matchedPairs = [];
        this.selectedLeft = null;
        this.selectedRight = null;

        // Update progress: tổng tiến độ = (batch đã hoàn thành * 5) + số cặp đã match trong batch hiện tại
        const totalProgress = (batchIndex * this.batchSize);
        PracticeManager.updateProgress(totalProgress, this.allWords.length);

        // Render
        this.render();
    },

    /**
     * Render matching UI
     */
    render() {
        const container = document.getElementById('practice-content');
        if (!container) return;

        // Hiển thị thông tin batch hiện tại
        const batchInfo = this.totalBatches > 1
            ? `<div class="batch-info" style="text-align: center; margin-bottom: 15px; color: #666; font-size: 14px;">
                   <i class="fas fa-layer-group"></i> Nhóm ${this.currentBatch + 1}/${this.totalBatches}
                   <span style="margin-left: 10px;">(${this.matchedPairs.length}/${this.matchingData.pairs} cặp)</span>
               </div>`
            : '';

        container.innerHTML = `
            ${batchInfo}
            <div class="matching-container">
                <div class="matching-column">
                    <h4>Tiếng Anh</h4>
                    <div class="matching-items">
                        ${this.matchingData.leftColumn.map(item => `
                            <div class="matching-item" data-id="${item.id}" data-side="left">
                                <span class="matching-word-text" data-word="${item.text}">${item.text}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="matching-column">
                    <h4>Tiếng Việt</h4>
                    <div class="matching-items">
                        ${this.matchingData.rightColumn.map(item => `
                            <div class="matching-item" data-id="${item.id}" data-side="right">
                                ${item.text}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Attach listeners
        this.attachListeners();
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        const items = document.querySelectorAll('.matching-item');

        items.forEach(item => {
            item.addEventListener('click', (e) => {
                const id = item.dataset.id;
                const side = item.dataset.side;

                // Phát âm nếu là cột trái (tiếng Anh)
                if (side === 'left') {
                    const wordEl = item.querySelector('.matching-word-text');
                    if (wordEl) GameLogic.speakWord(wordEl.dataset.word, 'en-US');
                }

                this.selectItem(id, side, item);
            });
        });

    },

    /**
     * Select item
     */
    selectItem(id, side, element) {
        // Check if already matched
        if (element.classList.contains('matched')) return;

        if (side === 'left') {
            // Deselect previous
            if (this.selectedLeft) {
                this.selectedLeft.classList.remove('selected');
            }

            this.selectedLeft = element;
            element.classList.add('selected');

            // Get data
            const leftData = this.matchingData.leftColumn.find(item => item.id === id);

            // Check if right is selected
            if (this.selectedRight) {
                const rightId = this.selectedRight.dataset.id;
                const rightData = this.matchingData.rightColumn.find(item => item.id === rightId);

                this.checkMatch(leftData, rightData);
            }

        } else {
            // Deselect previous
            if (this.selectedRight) {
                this.selectedRight.classList.remove('selected');
            }

            this.selectedRight = element;
            element.classList.add('selected');

            // Get data
            const rightData = this.matchingData.rightColumn.find(item => item.id === id);

            // Check if left is selected
            if (this.selectedLeft) {
                const leftId = this.selectedLeft.dataset.id;
                const leftData = this.matchingData.leftColumn.find(item => item.id === leftId);

                this.checkMatch(leftData, rightData);
            }
        }
    },

    /**
     * Check if match is correct
     */
    checkMatch(leftData, rightData) {
        const isCorrect = GameLogic.checkMatching(leftData, rightData);

        if (isCorrect) {
            // Correct match
            this.selectedLeft.classList.remove('selected');
            this.selectedRight.classList.remove('selected');
            this.selectedLeft.classList.add('matched');
            this.selectedRight.classList.add('matched');

            this.matchedPairs.push({ left: leftData, right: rightData });

            // Record answer (assuming leftData.wordData holds the word object)
            PracticeManager.recordAnswer(true, leftData.wordData);

            // Update progress: tổng tiến độ = (batch đã hoàn thành * batchSize) + số cặp đã match trong batch hiện tại
            const totalProgress = (this.currentBatch * this.batchSize) + this.matchedPairs.length;
            PracticeManager.updateProgress(totalProgress, this.allWords.length);

            // Play sound
            if (GameState.state.settings.soundEnabled) {
                Utils.playSound(Config.sounds.correct, 0.5);
            }

            // Check if all pairs in current batch are matched
            if (this.matchedPairs.length === this.matchingData.pairs) {
                // Hoàn thành batch hiện tại
                const nextBatch = this.currentBatch + 1;

                if (nextBatch < this.totalBatches) {
                    // Còn batch tiếp theo -> Load batch mới sau 1 giây
                    setTimeout(() => {
                        Notification.show({
                            type: 'success',
                            title: '🎉 Hoàn thành nhóm!',
                            message: `Đang chuyển sang nhóm ${nextBatch + 1}/${this.totalBatches}...`,
                            duration: 1500
                        });

                        setTimeout(() => {
                            this.loadBatch(nextBatch);
                        }, 800);
                    }, 500);
                } else {
                    // Đã hoàn thành tất cả batch -> Kết thúc
                    setTimeout(() => {
                        this.finish();
                    }, 500);
                }
            }

        } else {
            // Wrong match - shake animation
            this.selectedLeft.classList.add('animate-shake');
            this.selectedRight.classList.add('animate-shake');

            // Record answer (assuming leftData.wordData holds the word object)
            PracticeManager.recordAnswer(false, leftData.wordData);

            // Play sound
            if (GameState.state.settings.soundEnabled) {
                Utils.playSound(Config.sounds.wrong, 0.5);
            }

            setTimeout(() => {
                this.selectedLeft?.classList.remove('animate-shake');
                this.selectedRight?.classList.remove('animate-shake');
            }, 400);
        }

        // Reset selection
        this.selectedLeft = null;
        this.selectedRight = null;
    },

    /**
     * Finish mode
     */
    finish() {
        PracticeManager.complete();
    },

    /**
     * Cleanup resources (called when exiting practice)
     */
    cleanup() {
        console.log('🧹 Matching cleanup: Clearing state');
        this.matchingData = null;
        this.selectedLeft = null;
        this.selectedRight = null;
        this.matchedPairs = [];
        this.allWords = [];
        this.currentBatch = 0;
        this.totalBatches = 0;
    }
};

// Make global
window.Matching = Matching;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Matching;
}