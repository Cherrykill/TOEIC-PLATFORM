import { useState, useEffect, useRef } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { GameState } from '@game/state.js';
import { GameLogic } from '@game/gameLogic.js';

const MODE_NAMES = {
    'multiple-choice': 'Trắc nghiệm',
    'fill-blank': 'Điền từ',
    'listening': 'Nghe & chọn',
    'matching': 'Nối từ',
    'word-scramble': 'Xếp chữ',
    'speed-quiz': 'Tốc độ',
    'flashcard': 'Thẻ từ vựng',
    'dictation': 'Nghe chép',
    'pronunciation': 'Phát âm',
};

function filterHistory(history, days) {
    if (days === 'all') return history;
    const n = parseInt(days);
    const cutoff = new Date();
    // "1 ngày" = lấy từ đầu hôm nay (00:00) thay vì 24h cuộn — đúng với
    // ý "thống kê hôm nay" của user.
    if (n === 1) cutoff.setHours(0, 0, 0, 0);
    else cutoff.setDate(cutoff.getDate() - n);
    return history.filter(e => new Date(e.date) >= cutoff);
}

export default function StatisticsScreen({ active }) {
    const { showScreen } = useGame();
    const [timeRange, setTimeRange] = useState('1');
    const [activeTab, setActiveTab] = useState('overview');
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    const state = GameState.state;
    const progress = state.progress;
    const practiceHistory = state.practiceHistory || [];

    const filteredHistory = filterHistory(practiceHistory, timeRange);
    const totalTime = filteredHistory.reduce((s, e) => s + (e.timeSpent || 0), 0);
    const totalWords = progress.wordsLearned?.length || 0;
    const totalAnswered = (progress.totalCorrectAnswers || 0) + (progress.totalWrongAnswers || 0);
    const accuracy = totalAnswered > 0 ? Math.round((progress.totalCorrectAnswers / totalAnswered) * 100) : 0;
    const achievementCount = (state.achievements || []).filter(a => a.unlocked).length;

    const modeStats = progress.modeStats || {};
    const modeData = Object.entries(MODE_NAMES)
        .map(([key, name]) => {
            const d = modeStats[key] || { correct: 0, total: 0, played: 0 };
            return { name, accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0, played: d.played || 0 };
        })
        .filter(m => m.played > 0);

    const vocab = GameLogic.vocabularyData || [];
    const learned = new Set(progress.wordsLearned || []);
    const partMap = {};
    vocab.forEach(w => {
        if (!w.part) return;
        if (!partMap[w.part]) partMap[w.part] = { total: 0, learned: 0 };
        partMap[w.part].total++;
        if (learned.has(w.en)) partMap[w.part].learned++;
    });
    const partEntries = Object.entries(partMap).sort((a, b) => a[0].localeCompare(b[0]));

    useEffect(() => {
        if (!active || activeTab !== 'overview') return;
        drawChart();
    }, [active, activeTab, timeRange]);

    function exportReport() {
        const labelMap = { '1': 'hom-nay', '7': '7-ngay', '30': '30-ngay' };
        const periodLabel = labelMap[timeRange] || timeRange;
        const now = new Date();
        const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');

        // BOM cho Excel mở UTF-8 đúng tiếng Việt.
        const lines = ['﻿'];
        const push = (...cols) => lines.push(cols.map(c => {
            const s = c == null ? '' : String(c);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(','));

        push('Báo cáo thống kê — ' + periodLabel);
        push('Xuất lúc', now.toLocaleString('vi-VN'));
        push('');

        push('TỔNG QUAN');
        push('Thời gian luyện tập (giây)', totalTime);
        push('Từ đã học (tổng)',           totalWords);
        push('Độ chính xác tổng thể (%)',  accuracy);
        push('Số thành tích đã mở',        achievementCount);
        push('');

        push('LỊCH SỬ THEO NGÀY');
        push('Ngày', 'Phiên', 'Câu đúng', 'Tổng câu', 'Chính xác (%)', 'Thời gian (giây)');
        const daysCount = timeRange === 'all' ? 30 : Math.max(1, parseInt(timeRange));
        for (let i = daysCount - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const e = practiceHistory.find(x => x.date === key || x.date?.startsWith(key)) || {};
            const totalQ = (e.correctAnswers || 0) + (e.wrongAnswers || 0);
            const acc = totalQ > 0 ? Math.round(((e.correctAnswers || 0) / totalQ) * 100) : 0;
            push(key, e.sessionsCompleted || 0, e.correctAnswers || 0, totalQ, acc, e.timeSpent || 0);
        }
        push('');

        push('THEO CHẾ ĐỘ');
        push('Chế độ', 'Số lượt chơi', 'Độ chính xác (%)');
        modeData.forEach(m => push(m.name, m.played, m.accuracy));

        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bao-cao-thong-ke-${periodLabel}-${stamp}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function drawChart() {
        const canvas = chartRef.current;
        if (!canvas || typeof window.Chart === 'undefined') return;

        if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#cbd5e1' : '#555';
        const gridColor = isDark ? 'rgba(71,85,105,0.3)' : 'rgba(0,0,0,0.1)';

        const days = timeRange === 'all' ? 30 : Math.max(1, parseInt(timeRange));
        const filled = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const found = practiceHistory.find(e => e.date === key || e.date?.startsWith(key));
            filled.push({
                label: d.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }),
                sessions: found?.sessionsCompleted || 0,
                xp: found?.totalXpEarned || 0,
                acc: found ? (found.questionsAnswered > 0 ? Math.round((found.correctAnswers / found.questionsAnswered) * 100) : 0) : 0,
            });
        }

        // Combo chart: BAR cho "Phiên luyện tập" (số đếm rời rạc) +
        // LINE cho "Độ chính xác %" (continuous). Đúng semantic data type.
        chartInstance.current = new window.Chart(canvas.getContext('2d'), {
            type: 'bar', // baseline; dataset accuracy override sang line
            data: {
                labels: filled.map(d => d.label),
                datasets: [
                    {
                        type: 'bar',
                        label: 'Phiên luyện tập',
                        data: filled.map(d => d.sessions),
                        backgroundColor: 'rgba(75,192,192,0.55)',
                        borderColor: 'rgb(75,192,192)',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y',
                        order: 2,
                    },
                    {
                        type: 'line',
                        label: 'Độ chính xác (%)',
                        data: filled.map(d => d.acc),
                        borderColor: 'rgb(54,162,235)',
                        backgroundColor: 'rgba(54,162,235,0.15)',
                        yAxisID: 'y2',
                        tension: 0.35,
                        pointRadius: 4,
                        pointBackgroundColor: 'rgb(54,162,235)',
                        borderWidth: 2,
                        order: 1, // vẽ line đè lên bar
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: textColor } },
                },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: {
                        type: 'linear', position: 'left',
                        title: { display: true, text: 'Phiên', color: textColor },
                        ticks: { color: textColor, precision: 0 }, // không hiện thập phân cho số đếm
                        grid: { color: gridColor },
                        beginAtZero: true,
                    },
                    y2: {
                        type: 'linear', position: 'right', min: 0, max: 100,
                        title: { display: true, text: '%', color: textColor },
                        ticks: { color: textColor },
                        grid: { display: false },
                    },
                },
            },
        });
    }

    const hours = Math.floor(totalTime / 3600);
    const mins = Math.floor((totalTime % 3600) / 60);
    const timeLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins} phút`;

    return (
        <div id="statistics-screen" className={`screen ${active ? 'active' : ''}`}>
            <div className="screen-header">
                <button className="back-btn-screen icon-btn" onClick={() => showScreen('home-screen')}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <h2><i className="fas fa-chart-line"></i> Thống kê</h2>
                <button
                    className="stats-export-btn"
                    onClick={exportReport}
                    title="Xuất báo cáo CSV (mở bằng Excel)"
                >
                    <i className="fas fa-file-export"></i> Xuất báo cáo
                </button>
            </div>

            <div className="time-range-selector">
                {[['1', '1 ngày'], ['7', '7 ngày'], ['30', '30 ngày']].map(([val, label]) => (
                    <button key={val} className={`time-range-btn ${timeRange === val ? 'active' : ''}`}
                        onClick={() => setTimeRange(val)}>{label}</button>
                ))}
            </div>

            <div className="stats-tab-nav">
                {[['overview', 'fa-chart-line', 'Tổng quan'], ['modes', 'fa-gamepad', 'Chế độ'], ['vocabulary', 'fa-book', 'Từ vựng']].map(([tab, icon, label]) => (
                    <button key={tab} className={`stats-tab-btn ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}>
                        <i className={`fas ${icon}`}></i> {label}
                    </button>
                ))}
            </div>

            <div className={`stats-tab-panel ${activeTab === 'overview' ? 'active' : ''}`}>
                <div className="stats-overview">
                    <div className="stat-box">
                        <div className="stat-icon"><i className="fas fa-clock"></i></div>
                        <div>
                            <div style={{ fontWeight: 700 }}>{timeLabel}</div>
                            <div style={{ fontSize: '0.8em', opacity: 0.7 }}>Thời gian luyện tập</div>
                        </div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-icon"><i className="fas fa-book"></i></div>
                        <div>
                            <div style={{ fontWeight: 700 }}>{totalWords}</div>
                            <div style={{ fontSize: '0.8em', opacity: 0.7 }}>Từ đã học</div>
                        </div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-icon"><i className="fas fa-bullseye"></i></div>
                        <div>
                            <div style={{ fontWeight: 700 }}>{accuracy}%</div>
                            <div style={{ fontSize: '0.8em', opacity: 0.7 }}>Độ chính xác</div>
                        </div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-icon"><i className="fas fa-trophy"></i></div>
                        <div>
                            <div style={{ fontWeight: 700 }}>{achievementCount}</div>
                            <div style={{ fontSize: '0.8em', opacity: 0.7 }}>Thành tích</div>
                        </div>
                    </div>
                </div>

                {timeRange === '1' ? (
                    // 1 ngày = 1 điểm dữ liệu → chart vô nghĩa, ẩn đi để khỏi
                    // hiển thị "đường thẳng" rỗng tuếch. Số liệu nằm ở thẻ trên.
                    <div className="empty-state" style={{ paddingTop: 24, marginTop: 16, opacity: 0.7 }}>
                        <i className="fas fa-chart-column" style={{ fontSize: 32, opacity: 0.35 }}></i>
                        <p style={{ marginTop: 8, fontSize: 13 }}>
                            Biểu đồ theo ngày sẽ hiện ở tab <b>7 ngày</b> hoặc <b>30 ngày</b>.
                        </p>
                    </div>
                ) : (
                    <div style={{ height: 380, marginTop: 16, position: 'relative' }}>
                        {practiceHistory.length === 0 ? (
                            <div className="empty-state" style={{ paddingTop: 40 }}>
                                <i className="fas fa-chart-line" style={{ fontSize: 40, opacity: 0.3 }}></i>
                                <p style={{ marginTop: 8 }}>Chưa có dữ liệu lịch sử luyện tập</p>
                                <p style={{ fontSize: '0.85em', opacity: 0.6 }}>Hoàn thành bài luyện tập để xem biểu đồ</p>
                            </div>
                        ) : (
                            <canvas ref={chartRef} style={{ width: '100%', height: '100%' }} />
                        )}
                    </div>
                )}
            </div>

            <div className={`stats-tab-panel ${activeTab === 'modes' ? 'active' : ''}`}>
                <div id="mode-accuracy" className="mode-accuracy-list">
                    {modeData.length === 0 ? (
                        <div className="empty-state">
                            <i className="fas fa-gamepad" style={{ fontSize: 36, opacity: 0.3 }}></i>
                            <p style={{ marginTop: 8 }}>Chưa có dữ liệu luyện tập</p>
                        </div>
                    ) : modeData.map(m => (
                        <div key={m.name} className="mode-accuracy-item">
                            <span className="mode-name">{m.name}</span>
                            <div className="accuracy-bar-container">
                                <div className="accuracy-bar" style={{ width: `${m.accuracy}%` }}></div>
                            </div>
                            <span className="accuracy-value">{m.accuracy}%</span>
                            <span style={{ fontSize: '0.8em', opacity: 0.6, marginLeft: 4 }}>{m.played} lượt</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className={`stats-tab-panel ${activeTab === 'vocabulary' ? 'active' : ''}`}>
                <div id="part-progress" className="part-progress-list">
                    {partEntries.length === 0 ? (
                        <div className="empty-state">
                            <i className="fas fa-book" style={{ fontSize: 36, opacity: 0.3 }}></i>
                            <p style={{ marginTop: 8 }}>Chưa có dữ liệu thống kê từ vựng</p>
                            <p style={{ fontSize: '0.85em', opacity: 0.6 }}>Dữ liệu sẽ hiện sau khi từ vựng được tải</p>
                        </div>
                    ) : partEntries.map(([part, data]) => {
                        const pct = data.total > 0 ? Math.round((data.learned / data.total) * 100) : 0;
                        const color = pct >= 70 ? 'var(--success-color)' : pct >= 40 ? 'var(--warning-color)' : 'var(--error-color)';
                        return (
                            <div key={part} className="part-item">
                                <div className="part-item-header">
                                    <span className="part-item-name">{part}</span>
                                    <span className="part-item-score">{data.learned}/{data.total}</span>
                                </div>
                                <div className="part-item-bar-track">
                                    <div className="part-item-bar-fill" style={{ width: `${pct}%`, background: color }}></div>
                                </div>
                                <span className="part-item-pct" style={{ color }}>{pct}%</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
