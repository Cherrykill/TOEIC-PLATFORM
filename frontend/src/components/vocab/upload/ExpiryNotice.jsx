import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@components/auth/AuthContext.jsx';
import { UploadVocabAPI } from '@api/uploadVocab.js';
import { downloadWords } from '@/services/vocabExport.js';
import { Notification } from '@ui/Toaster.jsx';

const DISMISS_KEY = 'expiryNoticeDismissed'; // per-session (sessionStorage)

/**
 * Non-blocking notice: when the logged-in user has private vocab sources
 * expiring soon, show a dismissible banner letting them either EXPORT
 * (JSON/Excel — no deletion) or EXTEND (+renew the retention). The app
 * stays fully usable; this only nudges, it does not block.
 */
export default function ExpiryNotice() {
    const { isLoggedIn } = useAuth();
    const [sources, setSources] = useState([]); // [{source,wordCount,expiresAt,daysLeft}]
    const [busy, setBusy] = useState('');
    const [dismissed, setDismissed] = useState(
        () => sessionStorage.getItem(DISMISS_KEY) === '1'
    );

    useEffect(() => {
        if (!isLoggedIn) { setSources([]); return; }
        let alive = true;
        UploadVocabAPI.expiring().then(res => {
            if (alive && res?.success && Array.isArray(res.data)) {
                const now = Date.now();
                setSources(res.data.map(s => ({
                    ...s,
                    daysLeft: Math.max(0, Math.ceil(
                        (new Date(s.expiresAt).getTime() - now) / (24 * 60 * 60 * 1000)
                    )),
                })));
            }
        });
        return () => { alive = false; };
    }, [isLoggedIn]);

    const handleExport = useCallback(async (source, fmt) => {
        if (busy) return;
        setBusy(source);
        try {
            const res = await UploadVocabAPI.myVocabulary(source);
            if (!res.success) throw new Error(res.message || 'Không tải được từ vựng');
            const n = downloadWords(source, res.data || [], fmt);
            if (n === 0) throw new Error('Nguồn rỗng, không có gì để xuất');
            Notification.success(`Đã xuất "${source}" (${n} từ). Dữ liệu vẫn còn tới hạn.`);
        } catch (err) {
            Notification.error(err.message || 'Lỗi khi xuất file');
        } finally {
            setBusy('');
        }
    }, [busy]);

    const handleExtend = useCallback(async (source) => {
        if (busy) return;
        setBusy(source);
        try {
            const res = await UploadVocabAPI.extendSource(source);
            if (!res.success) throw new Error(res.message || 'Gia hạn thất bại');
            Notification.success(res.message || `Đã gia hạn "${source}"`);
            setSources(prev => prev.filter(s => s.source !== source));
        } catch (err) {
            Notification.error(err.message || 'Lỗi khi gia hạn');
        } finally {
            setBusy('');
        }
    }, [busy]);

    const close = () => {
        sessionStorage.setItem(DISMISS_KEY, '1');
        setDismissed(true);
    };

    if (!isLoggedIn || dismissed || sources.length === 0) return null;

    return (
        <div style={{
            position: 'fixed', right: 16, bottom: 16, zIndex: 9000,
            width: 380, maxWidth: 'calc(100vw - 32px)',
            background: 'var(--bg-secondary, #1e1e2e)',
            border: '1px solid var(--border-color, #333)',
            borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
            overflow: 'hidden',
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border-color,#333)' }}>
                <i className="fas fa-triangle-exclamation" style={{ color: '#f59e0b', marginTop: 2 }}></i>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary,#fff)' }}>
                        Từ vựng riêng sắp hết hạn
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary,#aaa)', marginTop: 2 }}>
                        Xuất để lưu lại, hoặc gia hạn để khỏi mất.
                    </div>
                </div>
                <button onClick={close} title="Đóng"
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary,#888)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>
                    <i className="fas fa-times"></i>
                </button>
            </div>

            <div style={{ maxHeight: 320, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sources.map(s => (
                    <div key={s.source} style={{
                        border: '1px solid var(--border-color,#333)', borderRadius: 8,
                        padding: '10px 12px', background: 'var(--bg-tertiary,var(--bg-secondary))',
                    }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary,#fff)', wordBreak: 'break-word' }}>{s.source}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary,#aaa)', margin: '2px 0 8px' }}>
                            {s.wordCount} từ · còn ~{s.daysLeft} ngày
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn btn-secondary btn-sm" disabled={busy === s.source}
                                onClick={() => handleExport(s.source, 'json')}>
                                <i className="fas fa-file-code"></i> JSON
                            </button>
                            <button className="btn btn-secondary btn-sm" disabled={busy === s.source}
                                onClick={() => handleExport(s.source, 'csv')}>
                                <i className="fas fa-file-excel"></i> Excel
                            </button>
                            <button className="btn btn-primary btn-sm" disabled={busy === s.source}
                                onClick={() => handleExtend(s.source)}>
                                <i className="fas fa-clock-rotate-left"></i> {busy === s.source ? 'Đang xử lý…' : 'Gia hạn +30 ngày'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
