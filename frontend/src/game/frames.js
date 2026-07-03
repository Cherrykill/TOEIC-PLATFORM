// Registry khung avatar (cosmetic_frame). Key = itemId (khớp item_definitions.itemId).
// Khung là vòng viền + phát sáng quanh avatar tròn — không cần ảnh, dùng CSS box-shadow
// nên hiển thị đồng nhất ở Hồ sơ, Thanh trạng thái, Bảng xếp hạng.
export const FRAMES = {
    'frame-gold': { label: 'Khung Vàng', ring: '#f59e0b', glow: 'rgba(245,158,11,.65)' },
    'frame-neon': { label: 'Khung Neon', ring: '#22d3ee', glow: 'rgba(34,211,238,.7)' },
};

// Style gắn vào phần tử avatar (tròn) để hiện khung. null nếu không có khung.
export function frameStyle(key) {
    const f = FRAMES[key];
    if (!f) return null;
    return { boxShadow: `0 0 0 3px ${f.ring}, 0 0 14px 3px ${f.glow}` };
}
