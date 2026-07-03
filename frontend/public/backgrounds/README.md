# Ảnh nền cosmetic (profile header + dòng leaderboard)

Đặt file ảnh nền vào đây. Tên file phải khớp với `image` khai báo trong
`frontend/src/game/backgrounds.js`.

Hiện có:
- `vip.jpg` — nền VIP (key `vip-royal`). Chưa có file → tự dùng gradient dự phòng
  (tím → gold). Bỏ file `vip.jpg` vào đây là nó dùng ảnh ngay.

Thêm nền mới:
1. Bỏ ảnh vào thư mục này (vd `ocean.jpg`).
2. Thêm 1 entry vào `BACKGROUNDS` trong `src/game/backgrounds.js`
   (key, image: '/backgrounds/ocean.jpg', gradient dự phòng, dark: true/false).

Khuyến nghị: ảnh ngang, tối, ~1200×300px, dung lượng nhẹ (<200KB).
