import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Modal } from '@ui/Modal.jsx';
import { Notification } from '@ui/Toaster.jsx';
import { EventBus, GameEvents } from '@game/eventBus.js';
import { EnergyShop } from '@game/energyShop.js';
import { useToeicAttempt } from '../hooks/useToeicAttempt.js';
import { useToeicTimer } from '../hooks/useToeicTimer.js';
import { useToeicAudio } from '../hooks/useToeicAudio.js';
import RunnerHeader from './RunnerHeader.jsx';
import QuestionView from './QuestionView.jsx';
import GroupQuestionView from './GroupQuestionView.jsx';
import QuestionNavPopup from './QuestionNavPopup.jsx';
import PartTransitionModal from './PartTransitionModal.jsx';
import {
    isToeicQuestionTimerOn,
    isToeicAutoAdvanceOn,
    getToeicScreenTime,
    getToeicTransition,
    buildToeicReadingPlan,
} from '../toeicPartTime.js';

// Dải index của nhóm chứa `index` (các câu liền kề cùng groupId). Không nhóm → [i,i].
function getGroupRange(questions, index) {
    const q = questions[index];
    if (!q) return [index, index];

    // Backend dàn phẳng theo MÀN nên mỗi câu tự biết vị trí của mình trong màn
    // (questionIndex 1..N) và màn có bao nhiêu câu (setSize) → suy ra dải ngay,
    // khỏi quét hai chiều và khỏi giả định các câu cùng màn nằm liền kề.
    const idx = Number(q.questionIndex);
    const size = Number(q.setSize);
    if (Number.isFinite(idx) && Number.isFinite(size) && size > 0) {
        const start = Math.max(0, index - (idx - 1));
        return [start, Math.min(questions.length - 1, start + size - 1)];
    }

    // Dữ liệu cũ không có setSize → quay lại cách quét theo groupId.
    if (!q.groupId) return [index, index];
    let start = index;
    let end = index;
    while (start > 0 && questions[start - 1]?.groupId === q.groupId) start--;
    while (end < questions.length - 1 && questions[end + 1]?.groupId === q.groupId) end++;
    return [start, end];
}

export default function TestRunner({ config, onExit, onShowResults }) {
    const attempt = useToeicAttempt();
    const [phase, setPhase] = useState('loading'); // loading | running
    const [navOpen, setNavOpen] = useState(false);
    const [keywordStatus, setKeywordStatus] = useState({});
    const startedRef = useRef(false);

    // Ref trỏ tới doSubmit MỚI NHẤT — tránh stale closure khi hết giờ (onTimeUp
    // deps [] sẽ ôm doSubmit của render đầu lúc attemptId còn null → submit lỗi).
    const doSubmitRef = useRef(null);
    const onTimeUp = useCallback(() => {
        Notification.warning('Hết giờ! Tự động nộp bài...');
        setTimeout(() => doSubmitRef.current?.(), 2000);
    }, []);

    const timer = useToeicTimer({ totalSeconds: attempt.customTimeLimit, onTimeUp });

    const handleAudioFinished = useCallback(() => {
        const q = attempt.currentQuestion;
        if (!q || q.part > 4) return;
        if (attempt.pendingTransition) return;
        // Trong NHÓM: không tự nhảy — để người dùng trả lời hết các câu con trước.
        const [gs, ge] = getGroupRange(attempt.questions, attempt.currentIndex);
        if (ge > gs) return;
        setTimeout(() => attempt.nextQuestion(), 600);
    }, [attempt]);

    const audio = useToeicAudio({ onFinished: handleAudioFinished });

    // Header đề thi dính (sticky) NGAY DƯỚI hai thanh chung của app (.top-nav +
    // .status-bar) — cả hai cũng sticky. Để top:0 thì nó trượt xuống dưới hai
    // thanh kia và biến mất đúng lúc cuộn xem ảnh. Đo chiều cao thật thay vì
    // ghi số cứng: desktop/mobile mỗi nơi một khác.
    useEffect(() => {
        const measure = () => {
            const h = ['.top-nav', '.status-bar'].reduce((sum, sel) => {
                const el = document.querySelector(sel);
                if (!el) return sum;
                const st = getComputedStyle(el);
                if (st.position !== 'sticky' && st.position !== 'fixed') return sum;
                return sum + el.getBoundingClientRect().height;
            }, 0);
            document.documentElement.style.setProperty('--app-sticky-offset', `${Math.round(h)}px`);
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    // Khoá thanh tìm kiếm trên header CHỈ khi đang làm Full Test (mini/đục lỗ không khoá).
    useEffect(() => {
        const lock = phase === 'running' && attempt.test?.testType === 'full-test';
        EventBus.emit(GameEvents.TOEIC_SEARCH_LOCK, lock);
        return () => EventBus.emit(GameEvents.TOEIC_SEARCH_LOCK, false);
    }, [phase, attempt.test?.testType]);

    // Start or resume attempt on mount
    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        (async () => {
            try {
                if (config.resumeInfo) {
                    await attempt.resumeAttempt(config.resumeInfo.attemptId, config.resumeInfo.data);
                } else {
                    await attempt.startAttempt(config.testId, {
                        fillInBlankMode: config.fillInBlankMode,
                        customTimeLimit: config.customTimeLimit,
                    });
                }
                setPhase('running');
            } catch (err) {
                // Hết năng lượng → mở thẳng popup mua, khỏi bắt vào cửa hàng.
                // Vẫn thoát runner: mua xong người dùng đang ở danh sách đề,
                // bấm lại đề là vào (khôi phục runner vừa gỡ thì phức tạp mà
                // chẳng lợi gì).
                if (err.energyNeeded) {
                    EnergyShop.showModal({ needed: err.energyNeeded });
                } else {
                    Notification.error(err.message || 'Không thể bắt đầu bài thi');
                }
                onExit();
            }
        })();
    }, [config, attempt, onExit]);

    // Start timer once running
    useEffect(() => {
        if (phase === 'running') timer.start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // Auto-play audio on question change (listening parts)
    useEffect(() => {
        if (phase !== 'running') return;
        const q = attempt.currentQuestion;
        if (!q || q.part > 4) return;
        audio.resetFinished();
        const prev = attempt.questions[attempt.currentIndex - 1];
        const isFirstOfPart = attempt.currentIndex === 0 || (prev && prev.part !== q.part);
        const t = setTimeout(() => {
            if (q.audioUrl) audio.playRealAudio(q.audioUrl);
            else if (q.audioText) audio.playTTS(q.audioText, { part: q.part, isFirstOfPart });
        }, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt.currentIndex, phase]);

    const doSubmit = useCallback(async () => {
        timer.pause();
        audio.stop();
        Modal.show({
            title: 'Đang chấm bài...',
            content: '<div style="text-align:center;padding:20px"><i class="fas fa-spinner fa-spin" style="font-size:48px;color:var(--primary-color)"></i></div>',
        });
        try {
            const data = await attempt.submitTest();
            Modal.close();
            attempt.reset();
            onShowResults?.(data); // mở TRANG kết quả thay cho popup
        } catch (err) {
            Modal.close();
            Notification.error(err.message || 'Lỗi nộp bài thi');
        }
    }, [attempt, timer, audio, onShowResults]);
    doSubmitRef.current = doSubmit; // luôn trỏ tới doSubmit mới nhất

    const handleSelectAnswer = useCallback((answer) => {
        const q = attempt.currentQuestion;
        attempt.submitAnswer(answer);
        // Reading: auto-advance after 1s (unless last / transition pending)
        if (q && q.part >= 5) {
            setTimeout(() => {
                if (!attempt.pendingTransition && attempt.currentIndex < attempt.questions.length - 1) {
                    attempt.nextQuestion();
                }
            }, 1000);
        }
    }, [attempt]);

    // Đánh dấu rồi nhảy sang câu tiếp. Riêng FULL TEST: chỉ nhảy ở phần Đọc
    // (Part 5-7); phần Nghe (Part 1-4) tự chuyển theo audio nên chỉ đánh dấu.
    const handleToggleMark = useCallback(() => {
        attempt.toggleMark();
        const q = attempt.currentQuestion;
        const isFullTest = attempt.test?.testType === 'full-test';
        const isListening = q && q.part <= 4;
        if (isFullTest && isListening) return; // chỉ đánh dấu, không nhảy
        if (!attempt.pendingTransition) {
            const [, end] = getGroupRange(attempt.questions, attempt.currentIndex);
            if (end < attempt.questions.length - 1) attempt.goToQuestionChecked(end + 1);
        }
    }, [attempt]);

    const handleCheckKeywords = useCallback(() => {
        const inputs = document.querySelectorAll('.keyword-blank-input');
        let correct = 0;
        const status = {};
        inputs.forEach(input => {
            const ok = input.value.trim().toLowerCase() === (input.dataset.correct || '').toLowerCase();
            status[input.id] = ok ? 'correct' : 'wrong';
            if (ok) correct++;
        });
        setKeywordStatus(status);
        const total = inputs.length;
        Notification.show({
            type: correct === total ? 'success' : 'warning',
            message: `Đúng ${correct}/${total} từ điền`,
        });
    }, []);

    const handlePause = useCallback(async () => {
        timer.pause();
        audio.stop();
        try { await attempt.pause(); } catch { /* notified in hook */ }
        Modal.show({
            title: 'Bài thi đã tạm dừng',
            content: '<p>Bạn có muốn tiếp tục làm bài không?</p>',
            buttons: [
                {
                    text: 'Tiếp tục', className: 'btn-primary', stayOpen: true,
                    onClick: async () => {
                        try { await attempt.resume(); } catch { /* */ }
                        timer.start();
                        Modal.close();
                    },
                },
                { text: 'Thoát', className: 'btn-secondary', onClick: () => { Modal.close(); onExit(); } },
            ],
        });
    }, [attempt, timer, audio, onExit]);

    const handleConfirmSubmit = useCallback(() => {
        const unanswered = attempt.questions.length - Object.keys(attempt.answers).length;
        Modal.show({
            title: 'Nộp bài thi?',
            content: `<p>Bạn còn <strong>${unanswered}</strong> câu chưa trả lời.</p><p>Xác nhận nộp bài?</p>`,
            buttons: [
                { text: 'Nộp bài', className: 'btn-primary', stayOpen: true, onClick: () => { Modal.close(); doSubmit(); } },
                { text: 'Hủy', className: 'btn-secondary', onClick: () => Modal.close() },
            ],
        });
    }, [attempt.questions.length, attempt.answers, doSubmit]);

    const handleConfirmExit = useCallback(() => {
        Modal.show({
            title: 'Thoát bài thi?',
            content: '<p>Bài làm của bạn sẽ được lưu lại. Bạn có chắc muốn thoát?</p>',
            buttons: [
                {
                    text: 'Thoát', className: 'btn-danger',
                    onClick: () => { Modal.close(); timer.pause(); audio.stop(); onExit(); },
                },
                { text: 'Ở lại', className: 'btn-primary', onClick: () => Modal.close() },
            ],
        });
    }, [timer, audio, onExit]);

    const handlePlayAudio = useCallback(() => {
        const q = attempt.currentQuestion;
        if (!q) return;
        if (q.audioUrl) audio.playRealAudio(q.audioUrl);
        else if (q.audioText) {
            const prev = attempt.questions[attempt.currentIndex - 1];
            const isFirstOfPart = attempt.currentIndex === 0 || (prev && prev.part !== q.part);
            audio.playTTS(q.audioText, { part: q.part, isFirstOfPart });
        }
    }, [attempt, audio]);

    // Điều hướng THEO NHÓM: Next nhảy qua cả nhóm; Prev về đầu nhóm trước đó.
    const handleNext = useCallback(() => {
        const [, end] = getGroupRange(attempt.questions, attempt.currentIndex);
        attempt.goToQuestionChecked(Math.min(end + 1, attempt.questions.length - 1));
    }, [attempt]);
    const handlePrev = useCallback(() => {
        const [start] = getGroupRange(attempt.questions, attempt.currentIndex);
        if (start <= 0) return;
        const [ps] = getGroupRange(attempt.questions, start - 1);
        attempt.goToQuestion(ps);
    }, [attempt]);
    const handleNavSelect = useCallback((index) => {
        const [gs] = getGroupRange(attempt.questions, index);
        attempt.goToQuestion(gs);
    }, [attempt]);
    const handleGroupAnswer = useCallback((absIndex, label) => {
        attempt.submitAnswerAt(absIndex, label);
    }, [attempt]);

    // ── Đếm ngược THEO MÀN (Part nhóm = số câu × thời gian mỗi câu) ──────────
    // Chạy song song đồng hồ tổng; hết giờ màn nào thì tự sang màn kế.
    const [screenLeft, setScreenLeft] = useState(null);
    // Ngân sách của màn hiện tại — cần để vẽ thanh theo tỉ lệ còn lại.
    const [screenTotal, setScreenTotal] = useState(0);

    // NGUỒN THỜI GIAN DUY NHẤT: con số người dùng chọn ở popup (customTimeLimit).
    // null = "không giới hạn". Bảng nhịp giây/câu chia theo CHÍNH nó, không phải
    // totalTime admin — nhờ vậy tổng và từng câu luôn khớp nhau.
    const effectiveTotal = attempt.customTimeLimit; // giây, hoặc null/undefined
    const unlimited = effectiveTotal === null || effectiveTotal === undefined;

    // Bảng giờ Part Đọc: dựng MỘT lần cho cả bài, theo thời gian đã chọn.
    const readingPlan = useMemo(
        () => buildToeicReadingPlan(effectiveTotal, attempt.questions),
        [effectiveTotal, attempt.questions],
    );
    const handleNextRef = useRef(handleNext);
    handleNextRef.current = handleNext;

    useEffect(() => {
        // Không giới hạn thời gian → tắt luôn đếm ngược từng câu (kể cả Part Nghe):
        // tổng vô hạn mà mỗi câu vẫn bị hối là mâu thuẫn.
        if (phase !== 'running' || unlimited || !isToeicQuestionTimerOn()) { setScreenLeft(null); return; }
        const qs = attempt.questions;
        const [gs, ge] = getGroupRange(qs, attempt.currentIndex);
        const cur = qs[gs];
        if (!cur) { setScreenLeft(null); return; }
        const atLast = ge >= qs.length - 1;
        // Part 5/6/7 lấy giờ từ bảng chia theo chính đề này.
        let left = getToeicScreenTime(cur.part, ge - gs + 1, readingPlan);
        setScreenTotal(left);
        setScreenLeft(left);

        let moveTimer = null;
        const id = setInterval(() => {
            left -= 1;
            setScreenLeft(left);
            if (left > 0) return;

            clearInterval(id);
            // Câu cuối thì để đồng hồ tổng lo; tắt tự chuyển thì dừng ở 0 cho
            // người dùng tự bấm Tiếp (vẫn sửa được đáp án, không khoá gì).
            if (atLast || !isToeicAutoAdvanceOn()) return;
            // Chờ đúng khoảng chuyển câu đã trừ khỏi ngân sách mỗi câu — có
            // trừ thì phải có nghỉ thật, không thì phép tính chỉ là lý thuyết.
            moveTimer = setTimeout(() => handleNextRef.current(), getToeicTransition() * 1000);
        }, 1000);

        return () => { clearInterval(id); if (moveTimer) clearTimeout(moveTimer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt.currentIndex, phase, attempt.questions.length, readingPlan, unlimited]);

    if (phase === 'loading') {
        return (
            <div className="toeic-container" style={{ textAlign: 'center', padding: 60 }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: 48, color: 'var(--primary-color)' }}></i>
                <p style={{ marginTop: 16 }}>Đang chuẩn bị bài thi...</p>
            </div>
        );
    }

    const q = attempt.currentQuestion;

    // Gộp nhóm: nếu câu hiện tại thuộc nhóm (Part 3/4/6/7) → hiện cả nhóm 1 màn.
    // Không áp dụng ở chế độ "đục lỗ" (fill-blank) — giữ nguyên từng câu.
    const [gStart, gEnd] = getGroupRange(attempt.questions, attempt.currentIndex);
    const isGroupView = !attempt.fillInBlankMode && gEnd > gStart;
    const groupItems = [];
    for (let i = gStart; i <= gEnd; i++) groupItems.push({ q: attempt.questions[i], index: i });

    // Điều hướng câu giờ nằm trên thanh tiêu đề khung nội dung, không ở header đề.
    const navProps = {
        // Màn nhóm phủ nhiều câu → hiện DẢI vị trí (vd 5–8) cho đúng thực tế.
        current: gEnd > gStart ? `${gStart + 1}–${gEnd + 1}` : gStart + 1,
        total: attempt.test?.totalQuestions || attempt.questions.length,
        part: attempt.questions[gStart]?.part, // Part của câu/nhóm hiện tại
        canPrev: gStart > 0,
        canNext: gEnd < attempt.questions.length - 1,
        onPrev: handlePrev,
        onNext: handleNext,
    };

    return (
        <div className="toeic-container">
            <RunnerHeader
                testName={attempt.test?.testName || ''}
                timer={timer}
                nav={navProps}
                pace={{
                    left: screenLeft,
                    total: screenTotal,
                    label: `Còn ${Math.max(0, screenLeft ?? 0)}s cho ${isGroupView ? `nhóm ${groupItems.length} câu` : 'câu này'}`,
                }}
                isMarked={attempt.markedQuestions.has(attempt.currentIndex)}
                onBack={handleConfirmExit}
                onToggleNav={() => setNavOpen(o => !o)}
                onToggleMark={handleToggleMark}
                onPause={handlePause}
                onSubmit={handleConfirmSubmit}
            />

            <div className="toeic-question-container">
                {isGroupView ? (
                    <GroupQuestionView
                        groupItems={groupItems}
                        answers={attempt.answers}
                        onSelectAnswer={handleGroupAnswer}
                        audioPlaying={audio.playing}
                        onPlayAudio={handlePlayAudio}
                    />
                ) : (
                    <QuestionView
                        question={q}
                        timer={timer}
                        onToggleNav={() => setNavOpen(o => !o)}
                        currentIndex={attempt.currentIndex}
                        fillInBlankMode={attempt.fillInBlankMode}
                        selectedAnswer={attempt.answers[attempt.currentIndex]}
                        audioPlaying={audio.playing}
                        onPlayAudio={handlePlayAudio}
                        onSelectAnswer={handleSelectAnswer}
                        keywordAnswers={attempt.keywordAnswers}
                        keywordStatus={keywordStatus}
                        onKeywordChange={attempt.updateKeywordAnswer}
                        onCheckKeywords={handleCheckKeywords}
                    />
                )}
            </div>

            <QuestionNavPopup
                open={navOpen}
                questions={attempt.questions}
                currentIndex={attempt.currentIndex}
                answers={attempt.answers}
                markedQuestions={attempt.markedQuestions}
                onSelect={handleNavSelect}
                onClose={() => setNavOpen(false)}
            />

            {attempt.pendingTransition && (
                <PartTransitionModal
                    fromPart={attempt.pendingTransition.fromPart}
                    toPart={attempt.pendingTransition.toPart}
                    onContinue={() => attempt.acknowledgeTransition(true)}
                    onPauseForBreak={() => { attempt.acknowledgeTransition(false); handlePause(); }}
                />
            )}
        </div>
    );
}
