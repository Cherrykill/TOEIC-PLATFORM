import { useState, useCallback, useRef } from 'react';
import { ToeicAPI } from '@api/toeic.js';
import { Notification } from '@ui/Toaster.jsx';
import { Quest } from '@components/quest/quest.js';

const initialState = {
    attemptId: null,
    test: null,
    questions: [],
    currentIndex: 0,
    answers: {},
    markedQuestions: new Set(),
    customTimeLimit: undefined,
    fillInBlankMode: false,
    keywordAnswers: {},
};

/**
 * Owns all state for an in-progress TOEIC attempt + API calls.
 * Returns state + methods, plus a transition signal for the runner.
 */
export function useToeicAttempt() {
    const [state, setState] = useState(initialState);
    const [pendingTransition, setPendingTransition] = useState(null); // { fromPart, toPart, nextIndex }
    const startTimeRef = useRef(null);
    const shownTransitionsRef = useRef(new Set());

    const reset = useCallback(() => {
        setState(initialState);
        setPendingTransition(null);
        startTimeRef.current = null;
        shownTransitionsRef.current = new Set();
    }, []);

    const startAttempt = useCallback(async (testId, { fillInBlankMode = false, customTimeLimit } = {}) => {
        const response = await ToeicAPI.startAttempt(testId, fillInBlankMode);
        const apiData = response.data || response;
        if (!apiData?.success || !apiData.data) {
            throw new Error(apiData?.message || 'Không thể bắt đầu bài thi');
        }
        startTimeRef.current = Date.now();
        shownTransitionsRef.current = new Set();
        setState({
            attemptId: apiData.data.attemptId,
            test: apiData.data.test,
            questions: apiData.data.questions || [],
            currentIndex: 0,
            answers: {},
            markedQuestions: new Set(),
            customTimeLimit,
            fillInBlankMode,
            keywordAnswers: {},
        });
        return apiData.data;
    }, []);

    const resumeAttempt = useCallback(async (attemptId, attemptData) => {
        // Resume giờ trả về ĐỦ câu hỏi của đề + map đáp án đã lưu (server dựng lại).
        const res = await ToeicAPI.resumeAttempt(attemptId);
        const apiData = res?.data || res;
        if (!apiData?.success || !apiData.data) {
            throw new Error('Không thể tiếp tục bài thi');
        }
        startTimeRef.current = Date.now();
        shownTransitionsRef.current = new Set();
        setState({
            attemptId,
            test: apiData.data.test || attemptData.testId,
            questions: apiData.data.questions || [],
            currentIndex: 0,
            answers: apiData.data.answers || {},
            markedQuestions: new Set(apiData.data.markedQuestions || []),
            customTimeLimit: undefined,
            fillInBlankMode: false,
            keywordAnswers: {},
        });
    }, []);

    const submitAnswer = useCallback(async (answer) => {
        let isPartTransition = false;
        let transitionInfo = null;

        setState(prev => {
            const next = { ...prev, answers: { ...prev.answers, [prev.currentIndex]: answer } };
            // Check part transition for full-test
            const cur = prev.questions[prev.currentIndex];
            const nextIdx = prev.currentIndex + 1;
            const nxt = prev.questions[nextIdx];
            if (cur && nxt && cur.part !== nxt.part) {
                const isFull = prev.test?.testType === 'full' || prev.test?.testType === 'full-test';
                if (isFull) {
                    const key = `${cur.part}-${nxt.part}`;
                    if (!shownTransitionsRef.current.has(key)) {
                        shownTransitionsRef.current.add(key);
                        isPartTransition = true;
                        transitionInfo = { fromPart: cur.part, toPart: nxt.part, nextIndex: nextIdx };
                    }
                }
            }
            return next;
        });

        // Send answer to server (fire-and-forget; don't block UI)
        try {
            const questionId = state.questions[state.currentIndex]?._id;
            if (questionId) {
                await ToeicAPI.submitAnswer(state.attemptId, {
                    questionId,
                    userAnswer: answer,
                    timeSpent: Date.now() - (startTimeRef.current || Date.now()),
                });
            }
        } catch (err) {
            console.error('Error submitting answer:', err);
        }

        if (isPartTransition && transitionInfo) {
            setPendingTransition(transitionInfo);
        }
    }, [state.questions, state.currentIndex, state.attemptId]);

    const goToQuestion = useCallback((index) => {
        setState(prev => ({ ...prev, currentIndex: index }));
    }, []);

    const nextQuestion = useCallback(() => {
        setState(prev => {
            if (prev.currentIndex < prev.questions.length - 1) {
                return { ...prev, currentIndex: prev.currentIndex + 1 };
            }
            return prev;
        });
    }, []);

    const prevQuestion = useCallback(() => {
        setState(prev => {
            if (prev.currentIndex > 0) {
                return { ...prev, currentIndex: prev.currentIndex - 1 };
            }
            return prev;
        });
    }, []);

    const toggleMark = useCallback(() => {
        setState(prev => {
            const newSet = new Set(prev.markedQuestions);
            if (newSet.has(prev.currentIndex)) newSet.delete(prev.currentIndex);
            else newSet.add(prev.currentIndex);
            return { ...prev, markedQuestions: newSet };
        });
    }, []);

    const updateKeywordAnswer = useCallback((id, value) => {
        setState(prev => ({ ...prev, keywordAnswers: { ...prev.keywordAnswers, [id]: value } }));
    }, []);

    const pause = useCallback(async () => {
        try {
            await ToeicAPI.pauseAttempt(state.attemptId);
        } catch (err) {
            Notification.error('Lỗi tạm dừng bài thi');
            throw err;
        }
    }, [state.attemptId]);

    const resume = useCallback(async () => {
        try {
            await ToeicAPI.resumeAttempt(state.attemptId);
        } catch (err) {
            Notification.error('Lỗi tiếp tục bài thi');
            throw err;
        }
    }, [state.attemptId]);

    const submitTest = useCallback(async () => {
        const duration = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
        const response = await ToeicAPI.submitAttempt(state.attemptId, duration);
        const apiData = response.data || response;
        if (!apiData?.success) {
            throw new Error(apiData?.message || 'Lỗi nộp bài thi');
        }
        // Tick quest TOEIC (vd special_first_toeic) — không có flow nào khác
        // phát sự kiện này nên trước đây quest TOEIC luôn đứng yên.
        try { Quest.updateProgress('complete-toeic', 1); } catch (_) {}
        return apiData.data;
    }, [state.attemptId]);

    const acknowledgeTransition = useCallback((advance = true) => {
        const t = pendingTransition;
        setPendingTransition(null);
        if (advance && t) {
            setState(prev => ({ ...prev, currentIndex: t.nextIndex }));
        }
    }, [pendingTransition]);

    return {
        ...state,
        currentQuestion: state.questions[state.currentIndex],
        pendingTransition,
        startAttempt,
        resumeAttempt,
        submitAnswer,
        goToQuestion,
        nextQuestion,
        prevQuestion,
        toggleMark,
        updateKeywordAnswer,
        pause,
        resume,
        submitTest,
        acknowledgeTransition,
        reset,
    };
}
