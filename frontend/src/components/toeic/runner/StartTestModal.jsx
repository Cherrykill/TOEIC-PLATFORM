import { useState } from 'react';
import { toeicEnergyCost } from '../toeicCost.js';
import { customTotalSeconds } from '../toeicPartTime.js';

/**
 * Popup chọn thời gian làm bài — 3 loại, hệ thống chia tổng đó ra mỗi câu Đọc:
 *   1. ⚙️ Tùy chỉnh  — ngân sách riêng từng Part Đọc từ Cài đặt (toeicCustomPartMin)
 *   2. ⭐ Đề xuất    — thời gian admin gợi ý cho đề (test.totalTime)
 *   3. ∞ Không giới hạn — tắt mọi đồng hồ từng câu
 */
export default function StartTestModal({ test, onConfirm, onCancel }) {
    const [selected, setSelected] = useState('suggested');

    const suggestedMin = Math.round((test?.totalTime || 7200) / 60);
    // Số câu mỗi Part (từ test.parts) → tính tổng thời gian tùy chỉnh của đề này.
    const partCounts = {};
    (test?.parts || []).forEach(p => { partCounts[p.partNumber] = p.questionsCount || 0; });
    const customSec = customTotalSeconds(partCounts);
    const customMin = Math.max(1, Math.round(customSec / 60));

    const handleStart = () => {
        // Truyền kèm timeMode để runner dựng bảng giây/câu KHỚP với tổng đã chọn.
        if (selected === 'unlimited') return onConfirm(null, 'unlimited');
        if (selected === 'custom') return onConfirm(customSec, 'custom');
        return onConfirm(test?.totalTime, 'suggested');
    };

    const OPTIONS = [
        { key: 'suggested', icon: '⭐', label: `Đề xuất (${suggestedMin} phút)`, desc: 'Thời gian admin gợi ý cho đề này' },
        { key: 'custom', icon: '⚙️', label: `Tùy chỉnh (${customMin} phút)`, desc: 'Ngân sách riêng cho từng Part 5·6·7 — đặt trong Cài đặt → Luyện tập' },
        { key: 'unlimited', icon: '♾️', label: 'Không giới hạn', desc: 'Không đồng hồ nào cả — thong thả làm bài' },
    ];

    return (
        <div id="modal-container" className="active">
            <div className="modal-backdrop" onClick={onCancel}></div>
            <div className="modal">
                <div className="modal-header">
                    <h3>Chọn thời gian làm bài</h3>
                    <button className="icon-btn modal-close-btn" onClick={onCancel}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <div style={{ padding: 20 }}>
                        <p style={{ marginBottom: 18, color: 'var(--text-secondary)' }}>
                            Bài thi: <strong>{test?.testName || 'TOEIC Test'}</strong><br />
                            Số câu hỏi: <strong>{test?.totalQuestions || 200}</strong> câu<br />
                            Chi phí: <strong style={{ color: 'var(--warning, #f59e0b)' }}>
                                <i className="fas fa-bolt"></i> {toeicEnergyCost(test?.totalQuestions || 200)} năng lượng
                            </strong>
                        </p>

                        <div className="toeic-time-options">
                            {OPTIONS.map(o => (
                                <button
                                    key={o.key}
                                    className={`toeic-time-option${selected === o.key ? ' active' : ''}`}
                                    onClick={() => setSelected(o.key)}
                                >
                                    <span className="toeic-time-option-icon">{o.icon}</span>
                                    <span className="toeic-time-option-text">
                                        <b>{o.label}</b>
                                        <small>{o.desc}</small>
                                    </span>
                                    {selected === o.key && <i className="fas fa-check-circle toeic-time-option-check"></i>}
                                </button>
                            ))}
                        </div>

                        <p style={{ fontSize: '0.82em', color: 'var(--text-tertiary)', marginTop: 14, marginBottom: 0 }}>
                            <i className="fas fa-info-circle"></i> Part 5·6·7 (Đọc) chia đều tổng thời gian này ra mỗi câu.
                            Part Nghe do audio dẫn nhịp. Đổi mức "Tùy chỉnh" trong Cài đặt → Luyện tập.
                        </p>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onCancel}>Hủy</button>
                    <button className="btn btn-primary" onClick={handleStart}>Bắt đầu</button>
                </div>
            </div>
        </div>
    );
}
