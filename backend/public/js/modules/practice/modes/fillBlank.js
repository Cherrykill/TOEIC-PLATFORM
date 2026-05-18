// ===================================
// FILL IN THE BLANK MODE (ĐÃ SỬA LỖI ASYNC/AWAIT)
// ===================================

const FillBlank = {
  config: null,
  questions: [],
  currentIndex: 0,
  hintsRevealed: 0,

  /**
   * Start mode
   */
  async start(config) {
    // THÊM ASYNC
    this.config = config;
    this.currentIndex = 0;

    // Generate questions
    await this.generateQuestions(); // THÊM AWAIT

    // Setup hint and skip event listeners
    this.setupHintSkipListeners();

    // Show first question
    if (this.questions.length > 0) {
      this.showQuestion();
    } else {
      // Xử lý trường hợp không có từ vựng
      PracticeManager.complete();
      Notification.show({
        type: "warning",
        title: "Không có từ vựng",
        message: "Không tìm thấy từ vựng nào để luyện tập.",
      });
    }
  },

  /**
   * Generate questions
   */
  async generateQuestions() {
    // ✅ Kiểm tra xem có chọn Part không
    const selectedPart = GameState.state?.settings?.selectedPart || null;
    const requestCount = selectedPart
      ? 9999
      : this.config.questionsPerRound || 20;

    const words = await PartSelector.getWordsForPractice(requestCount);

    if (!Array.isArray(words)) {
      console.error("Lỗi: PartSelector không trả về mảng từ vựng.");
      this.questions = [];
      return;
    }

    // ✅ Nếu chọn Part → Dùng TẤT CẢ từ, Nếu không → Giới hạn theo config
    const selectedWords = selectedPart
      ? words // Lấy tất cả khi chọn part
      : words.slice(0, this.config.questionsPerRound || 20); // Giới hạn khi random

    // Tạo câu hỏi từ các từ đã chọn
    this.questions = selectedWords.map((word) =>
      GameLogic.generateFillBlank(word),
    );

    console.log(`📝 Generated ${this.questions.length} fill-blank questions`);
  },

  /**
   * Show current question
   */
  showQuestion() {
    if (this.currentIndex >= this.questions.length) {
      this.finish();
      return;
    }

    const question = this.questions[this.currentIndex];
    this.hintsRevealed = 0;

    // Update progress
    PracticeManager.updateProgress(
      this.currentIndex + 1,
      this.questions.length,
    );

    // Render question
    this.render(question);
  },

  /**
   * Render question UI
   */
  render(question) {
    const container = document.getElementById("practice-content");
    if (!container) return;

    container.innerHTML = `
            <div class="fill-blank-container">
                <div class="question-word">
                    <div class="word-display">${question.displayWord}</div>
                    <div class="word-type">${question.word.type}</div>
                    ${!question.reversed ? `<div class="word-phonetic" style="font-size:13px;color:var(--text-secondary)">${question.word.phonetic || ""}</div>` : ""}
                </div>

                <div class="sentence-display">
                    ${question.prompt} <input
                        type="text"
                        class="blank-input"
                        id="answer-input"
                        placeholder="${question.placeholder}"
                        autocomplete="off"
                    />
                </div>

                <button class="submit-answer-btn btn btn-primary" id="submit-btn">
                    Kiểm tra
                </button>
            </div>
        `;

    // Attach listeners
    this.attachListeners();

    // Focus input
    setTimeout(() => {
      const input = document.getElementById("answer-input");
      if (input) input.focus();
    }, 100);
  },

  /**
   * Attach event listeners
   */
  attachListeners() {
    const input = document.getElementById("answer-input");
    const submitBtn = document.getElementById("submit-btn");

    // Submit on Enter key
    input?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.checkAnswer();
      }
    });

    // Submit button
    submitBtn?.addEventListener("click", () => {
      this.checkAnswer();
    });
  },

  /**
   * Check answer
   */
  checkAnswer() {
    const question = this.questions[this.currentIndex];
    const input = document.getElementById("answer-input");
    const submitBtn = document.getElementById("submit-btn");

    if (!input) return;

    const userAnswer = input.value.trim();

    if (!userAnswer) {
      Notification.show({
        type: "warning",
        title: "Chưa nhập đáp án",
        message: "Vui lòng nhập câu trả lời",
      });
      return;
    }

    // Check answer
    const result = GameLogic.checkFillBlank(userAnswer, question.correctAnswer);

    // Disable input
    input.disabled = true;
    submitBtn.disabled = true;

    if (result.correct) {
      input.classList.add("correct");
      PracticeManager.recordAnswer(true, question.word);

      // Play sound
      if (GameState.state.settings.soundEnabled) {
        Utils.playSound(Config.sounds.correct, 0.5);
      }

      Notification.show({
        type: "success",
        title: "Chính xác!",
        message: `Đáp án: ${question.correctAnswer}`,
      });

      // Pronounce the correct answer
      if (GameState.state.settings.soundEnabled) {
        setTimeout(() => {
          GameLogic.speakWord(question.correctAnswer, "en-US");
        }, 500);
      }
    } else {
      input.classList.add("wrong");
      PracticeManager.recordAnswer(false, question.word);

      // Play sound
      if (GameState.state.settings.soundEnabled) {
        Utils.playSound(Config.sounds.wrong, 0.5);
      }

      Notification.show({
        type: "error",
        title: "Sai rồi!",
        message: `Đáp án đúng: ${question.correctAnswer}`,
      });

      // Pronounce the correct answer
      if (GameState.state.settings.soundEnabled) {
        setTimeout(() => {
          GameLogic.speakWord(question.correctAnswer, "en-US");
        }, 500);
      }
    }

    // Show example sentence if available
    this.showWordInfo(question.word);

    // Next question after delay (longer to read example)
    const delay = question.word.example ? 2000 : 1000;
    setTimeout(() => {
      this.nextQuestion();
    }, delay);
  },

  /**
   * Show word info (example + pronunciation) after answering
   */
  showWordInfo(word) {
    if (!word.example) return;

    const container = document.querySelector(".fill-blank-container");
    if (!container) return;

    const infoPanel = document.createElement("div");
    infoPanel.className = "word-info-panel";
    infoPanel.innerHTML = `
            <div class="word-info-example">
                <i class="fas fa-quote-left" style="color: var(--primary-color); margin-right: 6px;"></i>
                <span>${word.example}</span>
                <button class="btn-speak-mini" id="speak-example-btn" title="Nghe phát âm câu ví dụ">
                    <i class="fas fa-volume-up"></i>
                </button>
            </div>
        `;
    const sentenceDisplay = container.querySelector(".sentence-display");
    if (sentenceDisplay) {
      container.insertBefore(infoPanel, sentenceDisplay);
    } else {
      container.appendChild(infoPanel);
    }

    // Attach speak listener
    const speakBtn = document.getElementById("speak-example-btn");
    if (speakBtn) {
      speakBtn.addEventListener("click", () => {
        GameLogic.speakWord(word.example, "en-US");
      });
    }
  },

  /**
   * Next question
   */
  nextQuestion() {
    this.currentIndex++;
    this.showQuestion();
  },

  /**
   * Finish mode
   */
  finish() {
    PracticeManager.complete();
  },

  /**
   * Setup hint and skip event listeners
   */
  setupHintSkipListeners() {
    // Listen for hint event
    EventBus.on(GameEvents.HINT_USED, () => {
      if (this.currentIndex < this.questions.length) {
        this.showHint();
      }
    });

    // Listen for skip event
    EventBus.on(GameEvents.QUESTION_SKIPPED, () => {
      if (this.currentIndex < this.questions.length) {
        this.skipCurrentQuestion();
      }
    });
  },

  /**
   * Show hint for current question - reveals one more letter each time
   */
  showHint() {
    const question = this.questions[this.currentIndex];
    if (!question) return;

    const answer = question.correctAnswer;

    // Already fully revealed
    if (this.hintsRevealed >= answer.length) return;

    this.hintsRevealed++;

    const revealed = answer.slice(0, this.hintsRevealed);
    const input = document.getElementById("answer-input");

    if (input) {
      input.value = revealed;
      // Move cursor to end
      input.setSelectionRange(revealed.length, revealed.length);
      input.focus();
    }

    const remaining = answer.length - this.hintsRevealed;
    Notification.show({
      type: "info",
      title: "💡 Gợi ý",
      message:
        remaining > 0
          ? `"${revealed}..." — còn ${remaining} ký tự`
          : `Đáp án đầy đủ: ${answer}`,
      duration: 1500,
    });
  },

  /**
   * Skip current question
   */
  skipCurrentQuestion() {
    const question = this.questions[this.currentIndex];
    if (!question) return;

    const input = document.getElementById("answer-input");
    const submitBtn = document.getElementById("submit-btn");

    // Show correct answer
    if (input) {
      input.value = question.correctAnswer;
      input.disabled = true;
      input.classList.add("wrong");
    }

    if (submitBtn) {
      submitBtn.disabled = true;
    }

    // Record as wrong answer
    PracticeManager.recordAnswer(false, question.word);

    // Move to next question after delay
    setTimeout(() => {
      this.nextQuestion();
    }, 2000);
  },

  /**
   * Cleanup resources (called when exiting practice)
   */
  cleanup() {
    console.log("🧹 FillBlank cleanup: Clearing state");

    // Remove event listeners
    EventBus.off(GameEvents.HINT_USED);
    EventBus.off(GameEvents.QUESTION_SKIPPED);

    this.questions = [];
    this.currentIndex = 0;
    this.hintsRevealed = 0;
  },
};

// Make global
window.FillBlank = FillBlank;

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = FillBlank;
}
