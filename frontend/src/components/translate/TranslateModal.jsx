import { useEffect, useState } from 'react';

// Mã ngôn ngữ phổ biến → tên tiếng Việt (hiện nguồn phát hiện được).
const LANG_NAMES = {
    en: 'Tiếng Anh', vi: 'Tiếng Việt', zh: 'Tiếng Trung', 'zh-CN': 'Tiếng Trung',
    ja: 'Tiếng Nhật', ko: 'Tiếng Hàn', fr: 'Tiếng Pháp', de: 'Tiếng Đức',
    es: 'Tiếng Tây Ban Nha', ru: 'Tiếng Nga', th: 'Tiếng Thái',
};

/**
 * Popup dịch trong app — gọi API công khai của Google Translate (không cần key).
 * @param {string} text - từ/cụm cần dịch
 * @param {() => void} onClose
 */
export default function TranslateModal({ text, onClose }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null); // { translated, sourceLang }

    const fullUrl = `https://translate.google.com.vn/?sl=auto&tl=vi&text=${encodeURIComponent(text)}&op=translate`;

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(''); setResult(null);
        (async () => {
            try {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('Không dịch được');
                const data = await res.json();
                if (cancelled) return;
                const translated = (data[0] || []).map(seg => seg[0]).join('');
                const sourceLang = data[2] || 'auto';
                setResult({ translated, sourceLang });
            } catch {
                if (!cancelled) setError('Không kết nối được dịch vụ dịch. Hãy mở Google Dịch đầy đủ.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [text]);

    return (
        <div id="modal-container" className="active">
            <div className="modal-backdrop" onClick={onClose}></div>
            <div className="modal translate-modal" style={{ maxWidth: 480, width: '92vw' }}>
                <div className="modal-header">
                    <h3><i className="fas fa-language"></i> Dịch nhanh</h3>
                    <button className="icon-btn modal-close-btn" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body" style={{ padding: 20 }}>
                    <div className="translate-source">
                        <div className="translate-label">Gốc</div>
                        <div className="translate-text">{text}</div>
                    </div>

                    <div className="translate-arrow"><i className="fas fa-arrow-down"></i></div>

                    <div className="translate-target">
                        <div className="translate-label">
                            Tiếng Việt
                            {result?.sourceLang && result.sourceLang !== 'vi' && (
                                <span className="translate-detected">
                                    {' '}· từ {LANG_NAMES[result.sourceLang] || result.sourceLang}
                                </span>
                            )}
                        </div>
                        {loading && (
                            <div className="translate-text muted"><i className="fas fa-spinner fa-spin"></i> Đang dịch...</div>
                        )}
                        {!loading && error && <div className="translate-text error">{error}</div>}
                        {!loading && result && <div className="translate-text result">{result.translated}</div>}
                    </div>

                    <a className="btn btn-secondary btn-sm translate-full-link" href={fullUrl} target="_blank" rel="noopener noreferrer">
                        <i className="fas fa-external-link-alt"></i> Mở Google Dịch đầy đủ
                    </a>
                </div>
            </div>
        </div>
    );
}
