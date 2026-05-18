# Contributing — Frontend Conventions

Áp dụng cho **code mới và code đụng tới khi sửa**. Không cần đổi ngược toàn bộ code cũ.

## Layering (luật phụ thuộc một chiều)

```
features (components/) → services → domain (game/) / api → lib
```

- **UI không gọi `fetch` trực tiếp.** Mọi HTTP đi qua `src/api/*`.
- **Domain/logic không import React.** Quy tắc nghiệp vụ thuần để test được.
- **Service** điều phối giữa UI và domain/api (vd: theme, backup, upload).

## localStorage

KHÔNG viết string literal. Import từ registry:

```js
import { STORAGE_KEYS, colorThemeKey } from '@/constants/storageKeys.js';
localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
```

Lý do: bug `practiceSound` vs `practiceSoundEnabled` đến từ key gõ tay lệch nhau.

## Auth token

Dùng helper chung, không tự parse `authToken`:

```js
import { getToken, authHeaders } from '@/auth/token.js';
fetch(url, { headers: authHeaders() });
```

## Naming

| Loại | Quy ước | Ví dụ |
|---|---|---|
| Folder | kebab-case | `wrong-words/` |
| React component (file + export) | PascalCase.jsx | `TopicModal.jsx` |
| Hook | useXxx.js | `useTopics.js` |
| Service / util / controller | camelCase.js, export named | `theme.js` |
| Hằng / storage key | SCREAMING_SNAKE trong registry | `STORAGE_KEYS.THEME` |

- Code & comment mới: tiếng Anh. Chuỗi hiển thị cho người dùng: giữ tiếng Việt.
- Component > ~250 dòng JSX = dấu hiệu nên tách.

## Import paths

Alias `@` = `src/`. Dùng `@/constants/...`, `@components/...`, `@game/...` thay vì `../../..`.

## Quy mô PR

Mỗi PR refactor phải **tự đứng được**: revert được, app vẫn chạy nếu dừng giữa chừng.
Di chuyển code trước, đổi hành vi sau (PR riêng).
