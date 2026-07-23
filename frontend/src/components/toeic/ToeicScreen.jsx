import { useState, useCallback, useEffect, useRef } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { Modal } from '@ui/Modal.jsx';
import { Notification } from '@ui/Toaster.jsx';
import { ToeicAPI } from '@api/toeic.js';
import { useToeicTests } from './hooks/useToeicTests.js';
import FullTestList from './selector/FullTestList.jsx';
import MiniTestList from './selector/MiniTestList.jsx';
import FillBlankList from './selector/FillBlankList.jsx';
import HistoryList from './selector/HistoryList.jsx';
import AnalyticsView from './selector/AnalyticsView.jsx';
import StartTestModal from './runner/StartTestModal.jsx';
import TestRunner from './runner/TestRunner.jsx';
import { GameState } from '@game/state.js';

const TABS = [
    { key: 'full-test',  icon: 'fa-clipboard-list', label: 'Full Test (200 câu)' },
    { key: 'mini-test',  icon: 'fa-tasks',           label: 'Mini Test (theo Part)' },
    { key: 'fill-blank', icon: 'fa-pen-square',      label: 'Nghe Đục Lỗ' },
];

// Bộ lọc theo Part — chỉ hiện ở các tab có ý nghĩa theo part.
const PART_FILTERS = [
    { key: 'all', label: 'All' },
    ...[1, 2, 3, 4, 5, 6, 7].map(n => ({ key: n, label: `Part ${n}` })),
];
const PART_FILTER_TABS = ['mini-test', 'fill-blank', 'my-history'];
const LIST_TABS = ['full-test', 'mini-test', 'fill-blank'];
// Gợi ý nhanh — bấm để điền vào ô tìm kiếm.
const SEARCH_SUGGESTIONS = ['ETS 2026', 'ETS 2025', 'ETS 2024', 'ETS 2023', 'ETS 2022', 'ETS 2021', 'ETS 2020', 'ETS 2019', 'ETS 2018'];

export default function ToeicScreen({ active }) {
    const { showScreen } = useGame();
    const [activeTab, setActiveTab] = useState('full-test');
    const { tests, loading: testsLoading, reload: reloadTests } = useToeicTests();
    // Bump để remount History/Analytics (chúng tự fetch khi mount) → tải lại dữ liệu.
    const [refreshKey, setRefreshKey] = useState(0);
    const [partFilter, setPartFilter] = useState('all'); // 'all' | 1..7
    const [sortBy, setSortBy] = useState('default');     // sắp xếp danh sách đề
    const [searchQuery, setSearchQuery] = useState('');  // lọc đề theo tên
    const [searchFocused, setSearchFocused] = useState(false);

    const [mode, setMode] = useState('selector');       // selector | runner
    const [runnerConfig, setRunnerConfig] = useState(null);
    const [startModalCfg, setStartModalCfg] = useState(null); // { test, fillInBlankMode }
    const inProgressChecked = useRef(false);

    // Lưu tạm dữ liệu kết quả rồi mở TRANG kết quả (thay cho popup cũ).
    const openResultScreen = useCallback((resultData) => {
        GameState.state._toeicResult = resultData;
        showScreen('toeic-result-screen');
    }, [showScreen]);

    // Offer to resume an in-progress attempt the first time the screen is shown
    useEffect(() => {
        if (!active || inProgressChecked.current) return;
        inProgressChecked.current = true;
        (async () => {
            try {
                const res = await ToeicAPI.getInProgressAttempt();
                const attemptData = res?.data?.data || res?.data;
                if (!attemptData?._id) return;
                const dismissKey = `toeic_dismissed_attempt_${attemptData._id}`;
                if (localStorage.getItem(dismissKey)) return;

                const answered = Object.keys(attemptData.answers || {}).length;
                // Bài "bấm Bắt đầu rồi thoát" (chưa trả lời câu nào) → không mời tiếp
                // tục (resume bài rỗng vô nghĩa + endpoint review không có câu để tải).
                if (answered === 0) {
                    localStorage.setItem(dismissKey, '1');
                    return;
                }
                const totalQ = attemptData.testId?.totalQuestions || '?';
                Modal.show({
                    title: '📋 Bạn có bài luyện tập đang dở',
                    content: `<p>Bài thi <strong>${attemptData.testId?.title || 'TOEIC Test'}</strong> chưa hoàn thành.</p>
                              <p>Đã trả lời: <strong>${answered}/${totalQ}</strong> câu</p>
                              <p>Bạn có muốn tiếp tục không?</p>`,
                    buttons: [
                        {
                            text: 'Tiếp tục làm bài', className: 'btn-primary', stayOpen: true,
                            onClick: () => {
                                Modal.close();
                                setRunnerConfig({ resumeInfo: { attemptId: attemptData._id, data: attemptData } });
                                setMode('runner');
                            },
                        },
                        {
                            text: 'Bỏ qua', className: 'btn-secondary',
                            onClick: () => { localStorage.setItem(dismissKey, '1'); Modal.close(); },
                        },
                    ],
                });
            } catch { /* silent */ }
        })();
    }, [active]);

    const openStartModal = useCallback((testId, fillInBlankMode) => {
        const test = tests.find(t => t._id === testId);
        if (!test) { Notification.error('Không tìm thấy bài thi'); return; }
        setStartModalCfg({ test, fillInBlankMode });
    }, [tests]);

    const handleStartConfirm = useCallback((customTimeLimit, timeMode) => {
        const { test, fillInBlankMode } = startModalCfg;
        setStartModalCfg(null);
        setRunnerConfig({ testId: test._id, fillInBlankMode, customTimeLimit, timeMode });
        setMode('runner');
    }, [startModalCfg]);

    const handleRunnerExit = useCallback(() => {
        setMode('selector');
        setRunnerConfig(null);
    }, []);

    const handleRefresh = useCallback(() => {
        reloadTests();
        setRefreshKey(k => k + 1);
    }, [reloadTests]);

    const handleViewResults = useCallback(async (attemptId) => {
        Modal.show({
            title: 'Đang tải...',
            content: '<div style="text-align:center;padding:20px"><i class="fas fa-spinner fa-spin" style="font-size:48px;color:var(--primary-color)"></i></div>',
        });
        try {
            const res = await ToeicAPI.getAttemptReview(attemptId);
            const apiData = res.data || res;
            Modal.close();
            if (apiData?.success && apiData.data) {
                openResultScreen(apiData.data);
            } else {
                Notification.error('Dữ liệu kết quả không hợp lệ');
            }
        } catch (err) {
            Modal.close();
            Notification.error('Lỗi tải kết quả: ' + (err.message || ''));
        }
    }, [openResultScreen]);

    if (mode === 'runner' && runnerConfig) {
        return (
            <div id="toeic-screen" className={`screen ${active ? 'active' : ''}`}>
                <div className="screen-content">
                    <TestRunner config={runnerConfig} onExit={handleRunnerExit} onShowResults={openResultScreen} />
                </div>
            </div>
        );
    }

    return (
        <div id="toeic-screen" className={`screen ${active ? 'active' : ''}`}>
            <div className="screen-header">
                <button className="back-btn-screen icon-btn" onClick={() => showScreen('home-screen')}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <h2><i className="fas fa-graduation-cap"></i> Luyện tập TOEIC</h2>
                <div className="toeic-search-bar in-header">
                    <i className="fas fa-search"></i>
                    <input
                        type="text"
                        placeholder="Tìm đề thi theo tên..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                    />
                    {searchQuery && (
                        <button className="toeic-search-clear" onClick={() => setSearchQuery('')} title="Xóa">
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                    {searchFocused && (() => {
                        const sug = SEARCH_SUGGESTIONS.filter(s =>
                            !searchQuery || (s.toLowerCase().includes(searchQuery.toLowerCase()) && s.toLowerCase() !== searchQuery.toLowerCase())
                        );
                        return sug.length > 0 && (
                            <div className="toeic-search-suggest">
                                {sug.map(s => (
                                    <button
                                        key={s}
                                        className="toeic-search-suggest-item"
                                        onMouseDown={() => { setSearchQuery(s); setSearchFocused(false); }}
                                    >
                                        <i className="fas fa-magnifying-glass"></i> {s}
                                    </button>
                                ))}
                            </div>
                        );
                    })()}
                </div>
                <button
                    className={`toeic-header-btn${activeTab === 'my-history' ? ' active' : ''}`}
                    style={{ marginLeft: 'auto' }}
                    title="Lịch sử thi"
                    onClick={() => setActiveTab('my-history')}
                >
                    <i className="fas fa-history"></i> Lịch sử
                </button>
                <button
                    className={`toeic-header-btn${activeTab === 'analytics' ? ' active' : ''}`}
                    title="Phân tích"
                    onClick={() => setActiveTab('analytics')}
                >
                    <i className="fas fa-chart-line"></i> Phân tích
                </button>
                <button className="icon-btn" title="Tải lại dữ liệu" onClick={handleRefresh}>
                    <i className="fas fa-rotate-right"></i>
                </button>
            </div>
            <div className="screen-content">
                <div id="toeic-selector" className="toeic-container">
                    <div className="toeic-tabs">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                className={`toeic-tab${activeTab === tab.key ? ' active' : ''}`}
                                data-tab={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                <i className={`fas ${tab.icon}`}></i> {tab.label}
                            </button>
                        ))}
                    </div>
                    {/* Bộ lọc theo Part + sắp xếp — cùng một hàng, select nằm sát phải */}
                    {PART_FILTER_TABS.includes(activeTab) && (
                        <div className="toeic-part-filters">
                            {PART_FILTERS.map(f => (
                                <button
                                    key={f.key}
                                    className={`toeic-part-btn${partFilter === f.key ? ' active' : ''}`}
                                    onClick={() => setPartFilter(f.key)}
                                >
                                    {f.label}
                                </button>
                            ))}
                            <select
                                className="toeic-sort-select"
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                title="Sắp xếp danh sách đề"
                            >
                                <option value="default">Mặc định</option>
                                <option value="name-asc">Tên A → Z</option>
                                <option value="name-desc">Tên Z → A</option>
                                <option value="attempts-desc">Nhiều lượt thi nhất</option>
                                <option value="attempts-asc">Ít lượt thi nhất</option>
                            </select>
                        </div>
                    )}
                    <div id="toeic-tab-content">
                        {activeTab === 'full-test'  && <FullTestList tests={tests} loading={testsLoading} search={searchQuery} onStart={(id) => openStartModal(id, false)} />}
                        {activeTab === 'mini-test'  && <MiniTestList tests={tests} loading={testsLoading} partFilter={partFilter} sortBy={sortBy} search={searchQuery} onStart={(id) => openStartModal(id, false)} />}
                        {activeTab === 'fill-blank' && <FillBlankList tests={tests} loading={testsLoading} partFilter={partFilter} sortBy={sortBy} search={searchQuery} onStart={(id) => openStartModal(id, true)} />}
                        {activeTab === 'my-history' && <HistoryList key={`history-${refreshKey}`} active={active && activeTab === 'my-history'} partFilter={partFilter} onView={handleViewResults} />}
                        {activeTab === 'analytics'  && <AnalyticsView key={`analytics-${refreshKey}`} active={active && activeTab === 'analytics'} />}
                    </div>
                </div>
            </div>

            {startModalCfg && (
                <StartTestModal
                    test={startModalCfg.test}
                    onConfirm={handleStartConfirm}
                    onCancel={() => setStartModalCfg(null)}
                />
            )}
        </div>
    );
}
