import { useEffect, useState, useCallback, useRef } from 'react';
import { Modal } from '@ui/Modal.jsx';
import { Notification } from '@ui/Toaster.jsx';
import { EventBus, GameEvents } from '@game/eventBus.js';
import { useToeicAttempt } from '../hooks/useToeicAttempt.js';
import { useToeicTimer } from '../hooks/useToeicTimer.js';
import { useToeicAudio } from '../hooks/useToeicAudio.js';
import RunnerHeader from './RunnerHeader.jsx';
import QuestionView from './QuestionView.jsx';
import QuestionNavPopup from './QuestionNavPopup.jsx';
import PartTransitionModal from './PartTransitionModal.jsx';
import ResultsModal from '../results/ResultsModal.jsx';

export default function TestRunner({ config, onExit }) {
    const attempt = useToeicAttempt();
    const [phase, setPhase] = useState('loading'); // loading | running | results
    const [resultData, setResultData] = useState(null);
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
        setTimeout(() => attempt.nextQuestion(), 600);
    }, [attempt]);

    const audio = useToeicAudio({ onFinished: handleAudioFinished });

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
                Notification.error(err.message || 'Không thể bắt đầu bài thi');
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
            setResultData(data);
            setPhase('results');
        } catch (err) {
            Modal.close();
            Notification.error(err.message || 'Lỗi nộp bài thi');
        }
    }, [attempt, timer, audio]);
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

    if (phase === 'loading') {
        return (
            <div className="toeic-container" style={{ textAlign: 'center', padding: 60 }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: 48, color: 'var(--primary-color)' }}></i>
                <p style={{ marginTop: 16 }}>Đang chuẩn bị bài thi...</p>
            </div>
        );
    }

    if (phase === 'results') {
        return (
            <ResultsModal
                data={resultData}
                onClose={() => { attempt.reset(); onExit(); }}
            />
        );
    }

    const q = attempt.currentQuestion;

    return (
        <div className="toeic-container">
            <RunnerHeader
                testName={attempt.test?.testName || ''}
                currentIndex={attempt.currentIndex}
                totalQuestions={attempt.test?.totalQuestions || attempt.questions.length}
                timer={timer}
                isMarked={attempt.markedQuestions.has(attempt.currentIndex)}
                onBack={handleConfirmExit}
                onToggleNav={() => setNavOpen(o => !o)}
                onToggleMark={attempt.toggleMark}
                onPause={handlePause}
                onSubmit={handleConfirmSubmit}
                onPrev={attempt.prevQuestion}
                onNext={attempt.nextQuestion}
                canPrev={attempt.currentIndex > 0}
                canNext={attempt.currentIndex < attempt.questions.length - 1}
            />

            <div className="toeic-question-container">
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
            </div>

            <QuestionNavPopup
                open={navOpen}
                questions={attempt.questions}
                currentIndex={attempt.currentIndex}
                answers={attempt.answers}
                markedQuestions={attempt.markedQuestions}
                onSelect={attempt.goToQuestion}
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
