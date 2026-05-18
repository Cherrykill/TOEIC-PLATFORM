import { useState } from 'react';
import { Notification } from '@ui/Toaster.jsx';

export default function StartTestModal({ test, onConfirm, onCancel }) {
    const [selected, setSelected] = useState('default');
    const [customValue, setCustomValue] = useState(120);

    const handleStart = () => {
        let time = selected;
        if (selected === 'custom') {
            const v = parseInt(customValue);
            if (isNaN(v) || v < 1 || v > 600) {
                Notification.error('Vui lòng nhập thời gian từ 1 đến 600 phút');
                return;
            }
            time = String(v);
        }

        let customTimeLimit;
        if (time === 'unlimited') customTimeLimit = null;
        else if (time === 'default') customTimeLimit = test?.totalTime;
        else customTimeLimit = parseInt(time) * 60;

        onConfirm(customTimeLimit);
    };

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
                        <p style={{ marginBottom: 20, color: 'var(--text-secondary)' }}>
                            Bài thi: <strong>{test?.testName || 'TOEIC Test'}</strong><br />
                            Số câu hỏi: <strong>{test?.totalQuestions || 200}</strong> câu
                        </p>

                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                                <i className="fas fa-clock"></i> Chọn thời gian:
                            </label>
                            <select
                                value={selected}
                                onChange={e => setSelected(e.target.value)}
                                style={{
                                    width: '100%', padding: 12, border: '2px solid var(--border-color)',
                                    borderRadius: 8, fontSize: 16, background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)', cursor: 'pointer',
                                }}
                            >
                                <option value="default">⭐ Mặc định (120 phút)</option>
                                <optgroup label="⚡ Luyện nhanh">
                                    {[3, 5, 10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n} phút</option>)}
                                </optgroup>
                                <optgroup label="📚 Luyện trung bình">
                                    {[40, 45, 50, 60, 75, 90].map(n => <option key={n} value={n}>{n} phút</option>)}
                                </optgroup>
                                <optgroup label="🎯 Thi thật TOEIC">
                                    <option value="45">45 phút (Listening)</option>
                                    <option value="75">75 phút (Reading)</option>
                                    <option value="120">120 phút (Full Test)</option>
                                </optgroup>
                                <optgroup label="🔥 Luyện dài hạn">
                                    {[135, 150, 180, 210, 240, 300].map(n => <option key={n} value={n}>{n} phút</option>)}
                                </optgroup>
                                <optgroup label="♾️ Tùy chỉnh">
                                    <option value="custom">⚙️ Tùy chỉnh thời gian...</option>
                                    <option value="unlimited">∞ Không giới hạn thời gian</option>
                                </optgroup>
                            </select>
                        </div>

                        {selected === 'custom' && (
                            <div style={{ marginBottom: 15 }}>
                                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                                    <i className="fas fa-edit"></i> Nhập thời gian tùy chỉnh (phút):
                                </label>
                                <input
                                    type="number" min="1" max="600"
                                    value={customValue}
                                    onChange={e => setCustomValue(e.target.value)}
                                    style={{
                                        width: '100%', padding: 12, border: '2px solid var(--border-color)',
                                        borderRadius: 8, fontSize: 16, background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                    }}
                                    placeholder="Nhập số phút (1-600)"
                                />
                                <p style={{ fontSize: '0.85em', color: 'var(--text-tertiary)', marginTop: 5 }}>
                                    Tối thiểu 1 phút, tối đa 600 phút (10 giờ)
                                </p>
                            </div>
                        )}

                        <p style={{ fontSize: '0.9em', color: 'var(--text-tertiary)', marginTop: 15 }}>
                            <i className="fas fa-info-circle"></i> Chọn "Không giới hạn" nếu bạn muốn làm bài không giới hạn thời gian
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
