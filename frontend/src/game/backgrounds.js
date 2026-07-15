// Registry nền cosmetic (dùng chung cho header Hồ sơ + dòng Bảng xếp hạng).
// Ảnh động để ở BE: backend/public/uploads/background/ → phục vụ tại /uploads/background/.
// `dark: true` → nền tối, dùng chữ sáng cho dễ đọc.
// Key = itemId của cosmetic (khớp item_definitions.itemId ở backend) → nền chạy
// theo đồ đang trang bị (equipped.background).
export const BACKGROUNDS = {
    'bg-vip-week': {
        label: 'Hoàng gia VIP',
        image: '/uploads/background/bg-vip-week.png',
        // Gradient dự phòng khi chưa có/ảnh lỗi — cùng tông header VIP.
        gradient: 'linear-gradient(120deg,#241150 0%,#5b21b6 42%,#b45309 100%)',
        dark: true,
        requiresVip: true, // hết VIP → tự revert về nền mặc định
    },
    // Nền mua ở cửa hàng — hiện dùng gradient (ảnh tùy chọn, đặt ở /uploads/background/).
    'bg-ocean': {
        label: 'Đại dương',
        image: '/uploads/background/bg-ocean.jpg',
        gradient: 'linear-gradient(120deg,#0ea5e9 0%,#0369a1 50%,#1e3a8a 100%)',
        dark: true,
    },
    'bg-neon': {
        label: 'Neon',
        image: '/uploads/background/bg-neon.jpg',
        gradient: 'linear-gradient(120deg,#7c3aed 0%,#db2777 45%,#0ea5e9 100%)',
        dark: true,
    },
};

// Gộp nền do admin định nghĩa (effect.slot === 'background') từ catalog vào BACKGROUNDS.
// styleMode 'css' → dùng b.css (gradient/màu); 'image' → dùng ảnh (b.image).
export function registerBackgroundCosmetics(items) {
    (items || []).forEach(d => {
        const eff = d.effect || {};
        if (eff.slot !== 'background' || !eff.key) return;
        BACKGROUNDS[eff.key] = {
            ...(BACKGROUNDS[eff.key] || {}),
            label: d.name || BACKGROUNDS[eff.key]?.label || eff.key,
            styleMode: eff.styleMode || BACKGROUNDS[eff.key]?.styleMode || 'image',
            css: eff.css || BACKGROUNDS[eff.key]?.css || '',
            image: d.image || BACKGROUNDS[eff.key]?.image || '',
            dark: BACKGROUNDS[eff.key]?.dark !== undefined ? BACKGROUNDS[eff.key].dark : true,
        };
    });
}

// Chọn key nền cho 1 user: ưu tiên cosmetic đang TRANG BỊ (equipped.background),
// rồi tới VIP mặc định (khi chưa migrate/chưa trang bị).
export function bgKeyForUser(data = {}) {
    const vip = !!(data.isVip || data.vip);
    let key = (data.background && BACKGROUNDS[data.background]) ? data.background : null;
    if (!key && vip) key = 'bg-vip-week';
    // Nền yêu cầu VIP mà đã hết VIP → về nền mặc định.
    if (key && BACKGROUNDS[key].requiresVip && !vip) return null;
    return key;
}

// Style nền để gắn inline (ảnh phủ trên gradient dự phòng; nền tối thêm lớp
// tối nhẹ để chữ sáng luôn đọc rõ dù ảnh bất kỳ).
export function bgStyle(key) {
    const b = BACKGROUNDS[key];
    if (!b) return null;
    // Nền CSS (gradient/màu do admin nhập) — admin tự lo độ tương phản, không phủ overlay.
    if (b.styleMode === 'css' && b.css) {
        return { background: b.css, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    // Nền ẢNH: ảnh phủ trên gradient dự phòng; nền tối thêm lớp tối nhẹ cho chữ sáng dễ đọc.
    const overlay = b.dark ? 'linear-gradient(rgba(0,0,0,.32),rgba(0,0,0,.12))' : '';
    const layers = [overlay, b.image ? `url("${b.image}")` : '', b.gradient || '']
        .filter(Boolean).join(', ');
    return { backgroundImage: layers, backgroundSize: 'cover', backgroundPosition: 'center' };
}

export function isDarkBg(key) {
    return !!BACKGROUNDS[key]?.dark;
}
