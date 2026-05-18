import { useEffect } from 'react';
import { useAuth } from '@components/auth/AuthContext.jsx';
import { useFavorites } from './useFavorites.js';

export default function FavoritesModal({ open, onClose }) {
    const { isLoggedIn } = useAuth();
    const { words, loading, remove, reload } = useFavorites(isLoggedIn);

    useEffect(() => {
        if (open) reload();
    }, [open, reload]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div id="modal-container" className="active">
            <div className="modal-backdrop" onClick={onClose}></div>
            <div className="modal">
                <div className="modal-header">
                    <h3>⭐ Từ yêu thích</h3>
                    <button className="icon-btn modal-close-btn" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 20 }}>
                            <i className="fas fa-spinner fa-spin"></i> Đang tải...
                        </div>
                    ) : words.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                            <i className="fas fa-star" style={{ fontSize: '2rem', display: 'block', width: 'fit-content', margin: '0 auto 8px' }}></i>
                            Chưa có từ yêu thích nào
                        </div>
                    ) : (
                        <div className="favorites-list">
                            {words.map((w, i) => {
                                const en = w.en || w.word || '';
                                return (
                                    <div key={`${en}-${i}`} className="favorites-item" style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '10px 0', borderBottom: '1px solid var(--border-color)',
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <strong>{en}</strong>
                                            {w.phonetic && (
                                                <span style={{ color: '#888', marginLeft: 8, fontSize: '0.85em' }}>
                                                    /{w.phonetic}/
                                                </span>
                                            )}
                                            {w.vn && (
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>
                                                    {w.vn}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            className="icon-btn"
                                            title="Xóa khỏi yêu thích"
                                            onClick={() => remove(en)}
                                            style={{ color: '#dc2626' }}
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
