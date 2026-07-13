# 📚 TOEIC Platform — Claude Code Instructions

## 🎯 Bối cảnh & mục tiêu

TOEIC Platform là 1 trong 3 dự án CV của tôi, đóng vai trò **chứng minh khả năng xây sản phẩm hoàn chỉnh có chiều sâu**: gamification (XP/level/coins/energy/streak), 12 chế độ luyện từ vựng, hệ thống thi TOEIC 7 Part, admin dashboard. Hai dự án còn lại: `../quiz-arena` (real-time PvP — sinh ra để bổ sung tính năng thi đấu trực tuyến mà dự án này thiếu) và `../study-mind` (AI study assistant).

Dự án đã **hoàn thiện về tính năng** — giai đoạn hiện tại là **đánh bóng cho CV**, không phải đắp thêm tính năng lớn. Đọc `README.md` và `docs/PROJECT_DOCUMENTATION.md` để nắm chi tiết.

**Stack:** Express + MongoDB (Mongoose) + JWT · React (Vite) · backend có queues/workers, tests (Jest), Docker.

## ✅ Nguyên tắc quan trọng có sẵn (giữ nguyên)

- Energy hồi 1/phút **tính server-side** (chống cheat) — mọi logic tiền tệ/XP mới cũng phải server-side
- localStorage chỉ là backup khi server không khả dụng, MongoDB là nguồn chính
- Có test Jest sẵn ở `backend/tests` — sửa logic phải chạy lại test, thêm logic phải thêm test

## 🚧 Hướng phát triển (làm theo thứ tự)

### Phase 1 — Deploy công khai (quan trọng nhất)
1. Deploy backend (Render/Railway, đã có Dockerfile) + MongoDB Atlas, frontend lên Vercel
2. Tạo demo account có sẵn dữ liệu đẹp (level, streak, lịch sử thi) để nhà tuyển dụng vào xem ngay
3. Link live + screenshot/GIF vào đầu README

### Phase 2 — README kể chuyện kỹ thuật
Viết lại README theo hướng "vì sao" thay vì liệt kê tính năng:
- Energy/streak tính server-side như thế nào, vì sao chống cheat được
- Cơ chế sync MongoDB ↔ localStorage fallback
- Kiến trúc queues/workers dùng cho việc gì
- Spaced repetition ("Ôn sai") hoạt động ra sao

### Phase 3 — Liên kết hệ sinh thái với quiz-arena
1. Export/API cho bộ từ vựng (ETS2024/ETS2026/1000 từ) để quiz-arena dùng làm question bank
2. Nút "Thi đấu trực tuyến" trên frontend trỏ sang quiz-arena (deep-link kèm topic đang học nếu được)
3. Về lâu dài: đồng bộ XP thắng trận PvP về profile bên này (bàn với tôi trước khi làm)

## 📝 Nguyên tắc code

- Không refactor lớn khi không cần — dự án đã chạy ổn, ưu tiên ổn định để demo
- Mọi thay đổi backend phải chạy `npm test` trước khi kết thúc
- Response format và convention theo code hiện có, comment tiếng Việt
