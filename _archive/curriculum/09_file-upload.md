# Module 9: File Upload với Multer

---

## Mục tiêu

Sau module này bạn sẽ:
- Hiểu cách browser gửi file lên server (`multipart/form-data`)
- Biết cài đặt và cấu hình Multer để xử lý file upload
- Biết validate file (loại, kích thước)
- Biết lưu file vào disk và tổ chức thư mục
- Hiểu sự khác biệt giữa disk storage và memory storage
- Đọc được `middleware/upload.js`

---

## Tại sao cần thư viện đặc biệt để upload file?

Khi form HTML gửi text thường:
```
Content-Type: application/json
{ "name": "Alice" }
```

Khi form HTML gửi kèm file:
```
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="avatar"; filename="photo.jpg"
Content-Type: image/jpeg

[BINARY DATA của file ảnh]
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

`express.json()` không xử lý được format `multipart/form-data` này. Cần **Multer**.

---

## 1. Cài đặt Multer

```bash
npm install multer
```

---

## 2. Cấu hình Cơ Bản

```javascript
const multer = require('multer');
const path = require('path');

// Cấu hình lưu vào disk
const storage = multer.diskStorage({
    // Thư mục lưu file
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
        // cb(lỗi, thư mục đích)
    },

    // Tên file lưu trên disk
    filename: function (req, file, cb) {
        // Thêm timestamp để tránh trùng tên
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);  // '.jpg', '.png'
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        // Ví dụ: 'avatar-1703000000000-123456789.jpg'
    },
});

// Tạo multer instance
const upload = multer({ storage });
```

---

## 3. Dùng trong Route

```javascript
// Upload một file — field name là 'avatar'
router.post('/avatar', upload.single('avatar'), (req, res) => {
    console.log(req.file);
    // {
    //   fieldname: 'avatar',
    //   originalname: 'photo.jpg',
    //   encoding: '7bit',
    //   mimetype: 'image/jpeg',
    //   destination: 'public/uploads/',
    //   filename: 'avatar-1703000000-123456789.jpg',
    //   path: 'public/uploads/avatar-1703000000-123456789.jpg',
    //   size: 45678  (bytes)
    // }

    if (!req.file) {
        return res.status(400).json({ message: 'Không có file được upload' });
    }

    res.json({
        success: true,
        filename: req.file.filename,
        url: `/uploads/${req.file.filename}`,
    });
});

// Upload nhiều file cùng lúc (tối đa 5)
router.post('/gallery', upload.array('images', 5), (req, res) => {
    console.log(req.files);  // Mảng các file objects
});

// Upload nhiều field khác nhau
router.post('/post', upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'attachments', maxCount: 10 },
]), (req, res) => {
    console.log(req.files.thumbnail[0]);   // File thumbnail
    console.log(req.files.attachments);    // Mảng attachments
});
```

---

## 4. Validate File

### Lọc loại file

```javascript
const imageFilter = (req, file, cb) => {
    // Kiểm tra extension
    const allowedExt = /jpeg|jpg|png|gif|webp/;
    const extname = allowedExt.test(path.extname(file.originalname).toLowerCase());

    // Kiểm tra MIME type (do browser gửi)
    const mimetype = allowedExt.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);   // Chấp nhận file
    }

    cb(new Error('Chỉ chấp nhận ảnh: jpeg, jpg, png, gif, webp'));
    // cb(null, false) — Từ chối mà không báo lỗi
    // cb(error)      — Từ chối và báo lỗi
};
```

### Giới hạn kích thước

```javascript
const upload = multer({
    storage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,  // 5MB (bytes)
        files: 10,                   // Tối đa 10 files
    },
});
```

---

## 5. Xử Lý Lỗi Multer

Multer throw lỗi đặc biệt — cần catch riêng:

```javascript
const multer = require('multer');

router.post('/upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Lỗi từ Multer
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File quá lớn (tối đa 5MB)' });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({ message: 'Quá nhiều file' });
            }
            return res.status(400).json({ message: err.message });
        }

        if (err) {
            // Lỗi từ fileFilter
            return res.status(400).json({ message: err.message });
        }

        // Upload thành công
        res.json({ success: true, file: req.file });
    });
});
```

Hoặc dùng global error handler (Module 3):

```javascript
// middleware/errorHandler.js
if (err instanceof multer.MulterError) {
    const messages = {
        'LIMIT_FILE_SIZE': 'File quá lớn',
        'LIMIT_FILE_COUNT': 'Quá nhiều file',
        'LIMIT_UNEXPECTED_FILE': 'Field upload không đúng',
    };
    return res.status(400).json({
        success: false,
        message: messages[err.code] || err.message,
    });
}
```

---

## 6. Tổ Chức Thư Mục Upload

🎯 **Trong project — `middleware/upload.js`** tổ chức file theo loại test:

```javascript
const imageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Parse tên file để lấy test type
        // Ví dụ: 'e2e9p1_1.jpg' → test type là 'e2e9'
        const match = file.originalname.match(/^([a-z0-9]+)p\d+/i);
        const testType = match ? match[1] : 'other';

        const destPath = `public/assets/images/${testType}/`;

        // Tự tạo thư mục nếu chưa có
        if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
        }

        cb(null, destPath);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);  // Giữ tên gốc
    },
});
```

Kết quả cấu trúc thư mục:
```
public/assets/
├── images/
│   ├── e2e9/
│   │   ├── e2e9p1_1.jpg
│   │   ├── e2e9p2_1.jpg
│   └── other/
│       └── unknown.jpg
└── audio/
    ├── e2e9/
    │   ├── e2e9p1_1.mp3
    └── other/
```

---

## 7. Upload Audio

Xử lý audio tương tự image nhưng check MIME type khác nhau:

🎯 **Trong project — `middleware/upload.js`:**

```javascript
const audioFilter = (req, file, cb) => {
    const allowedExtensions = /mp3|wav|ogg|m4a|aac/;
    const allowedMimeTypes = /audio\/(mpeg|mp3|wav|ogg|m4a|aac|x-m4a|x-wav)/;

    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.test(file.mimetype);

    // Chú ý: Dùng OR (||) thay vì AND (&&)
    // Lý do: Một số browser gửi MIME type sai cho audio
    // → Chấp nhận nếu EITHER extension HOẶC mimetype hợp lệ
    if (mimetype || extname) {
        return cb(null, true);
    }

    cb(new Error(`Invalid audio file: ${file.originalname}`));
};

const uploadAudio = multer({
    storage: audioStorage,
    limits: { fileSize: 10 * 1024 * 1024 },  // 10MB cho audio
    fileFilter: audioFilter,
});
```

---

## 8. Memory Storage vs Disk Storage

```javascript
// Disk Storage — lưu thẳng ra file (default)
const storage = multer.diskStorage({ destination: '...', filename: '...' });

// Memory Storage — lưu vào RAM dạng Buffer
const storage = multer.memoryStorage();
// req.file.buffer → Buffer chứa nội dung file
// Dùng khi: cần process file trước khi lưu (resize ảnh, upload lên S3, ...)
```

**Khi nào dùng Memory Storage:**
- Upload lên cloud (AWS S3, Cloudinary) — cần Buffer để gửi đi
- Resize/compress ảnh trước khi lưu với `sharp`

**Khi nào dùng Disk Storage:**
- Lưu thẳng vào server (đơn giản hơn)
- File lớn (không muốn nạp hết vào RAM)

---

## 9. Serve File Đã Upload

Sau khi lưu file vào `public/uploads/`, cần serve chúng ra:

```javascript
// server.js
app.use(express.static(path.join(__dirname, 'public')));
// → http://localhost:5000/uploads/avatar-123.jpg
// → http://localhost:5000/assets/images/e2e9/e2e9p1_1.jpg
```

URL của file sau upload:
```javascript
const fileUrl = `/uploads/${req.file.filename}`;
// Lưu URL này vào database
await User.findByIdAndUpdate(userId, { avatarUrl: fileUrl });
```

---

## 10. Security Considerations

### Nguy hiểm: Upload file thực thi

```javascript
// Nếu không validate, hacker có thể upload:
// evil.js, evil.php, evil.sh → RCE (Remote Code Execution)!

// Luôn validate file type
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Only images allowed'));
}

// KHÔNG cho phép upload vào thư mục public có thể execute code
// Lưu vào 'uploads/' ngoài 'public/'
```

### Rename file để tránh path traversal

```javascript
// Không dùng originalname trực tiếp — hacker có thể gửi:
// originalname: "../../config/db.js"

// Luôn tạo tên mới an toàn
filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safe = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    cb(null, safe + ext);
}
```

---

## Bài Tập Thực Hành

### Bài 1: Avatar upload API

```javascript
// routes/user.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'public/avatars/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (/image\/(jpeg|png|webp)/.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận ảnh JPEG, PNG, WebP'));
        }
    },
    limits: { fileSize: 2 * 1024 * 1024 },  // 2MB
});

router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Không có file' });

    const avatarUrl = `/avatars/${req.file.filename}`;
    await User.findByIdAndUpdate(req.user.id, { avatar: avatarUrl });

    res.json({ success: true, avatarUrl });
});
```

Test bằng curl:
```bash
curl -X POST http://localhost:5000/api/user/avatar \
  -H "Authorization: Bearer <token>" \
  -F "avatar=@/path/to/photo.jpg"
```

### Bài 2: Validate và từ chối file

Thêm validation:
- Tối đa 1MB
- Chỉ chấp nhận .jpg và .png
- Rename file thành `userId-timestamp.ext`

---

## Câu Hỏi Ôn Tập

1. Tại sao form HTML cần `enctype="multipart/form-data"` khi upload file?

2. Sự khác biệt giữa `cb(null, true)`, `cb(null, false)`, và `cb(new Error(...))` trong fileFilter?

3. Tại sao dùng `||` thay vì `&&` khi check audio MIME type trong project?

4. Khi nào nên dùng `memoryStorage()` thay vì `diskStorage()`?

5. Tại sao không dùng `file.originalname` làm tên file trực tiếp trên server?

---

## Tóm Tắt

- **Multer** xử lý `multipart/form-data` — format dùng để upload file
- **diskStorage**: Lưu trực tiếp ra disk — đơn giản, không tốn RAM
- **memoryStorage**: Lưu vào RAM dạng Buffer — cần khi process hoặc upload tiếp lên cloud
- **fileFilter**: Validate loại file — luôn check cả extension và MIME type
- **limits.fileSize**: Giới hạn kích thước — tránh DoS qua file khổng lồ
- **Tên file an toàn**: Tạo tên mới, không dùng originalname trực tiếp
- **Tổ chức thư mục**: Phân loại file theo test type, user ID, ngày tháng...
- **Serve static**: `express.static('public')` để serve file đã upload
