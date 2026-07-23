// Sắp xếp danh sách đề TOEIC — dùng chung cho Mini Test và Đục lỗ.
// 'default' giữ nguyên thứ tự server trả về (mới nhất trước).
export function sortTests(list, sortBy) {
    if (!sortBy || sortBy === 'default') return list;
    const arr = [...list];
    const name = t => (t.testName || t.title || '').toLowerCase();
    const att = t => t.timesAttempted || 0;
    switch (sortBy) {
        case 'name-asc':       return arr.sort((a, b) => name(a).localeCompare(name(b)));
        case 'name-desc':      return arr.sort((a, b) => name(b).localeCompare(name(a)));
        case 'attempts-desc':  return arr.sort((a, b) => att(b) - att(a));
        case 'attempts-asc':   return arr.sort((a, b) => att(a) - att(b));
        default:               return arr;
    }
}
