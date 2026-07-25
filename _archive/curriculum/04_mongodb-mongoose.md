# Module 4: MongoDB & Mongoose

---

## Mục tiêu

Sau module này bạn sẽ:
- Hiểu MongoDB là gì và tại sao dùng thay vì SQL
- Biết kết nối MongoDB Atlas vào project
- Hiểu Schema, Model và cách định nghĩa cấu trúc dữ liệu
- Thực hiện CRUD operations: tạo, đọc, cập nhật, xóa
- Biết dùng validation, middleware, và methods trong Schema
- Hiểu indexing cơ bản để query nhanh hơn
- Đọc được `models/User.js` và `models/Vocabulary.js`

---

## Tại sao cần Database?

Đến giờ, project dùng file JSON để lưu dữ liệu (`data/users.json`). Cách này đơn giản nhưng có giới hạn:

| Vấn đề | JSON File | MongoDB |
|--------|-----------|---------|
| Tốc độ tìm kiếm | Chậm (phải đọc hết file) | Nhanh (có index) |
| Nhiều user cùng ghi | Có thể mất dữ liệu | An toàn (atomic operations) |
| Dữ liệu lớn | Tốn RAM (load hết vào memory) | Hiệu quả hơn |
| Quan hệ giữa bảng | Phức tạp | Hỗ trợ references |
| Backup & Recovery | Tự làm | Built-in |

---

## 1. MongoDB vs SQL

MongoDB là **NoSQL** database — lưu dữ liệu dạng **document** (JSON) thay vì bảng (table).

```
SQL (MySQL, PostgreSQL):          MongoDB:
┌─────────────────────┐           Collection: "users"
│ Table: users        │           ┌─────────────────────────┐
│ id │ name  │ email  │           │ { _id: ObjectId(...),   │
│────┼───────┼────────│           │   name: "Alice",        │
│  1 │ Alice │ a@g.com│           │   email: "a@g.com",     │
│  2 │ Bob   │ b@g.com│           │   level: 5,             │
└─────────────────────┘           │   badges: ["streak-7"]  │
                                  │ }                       │
                                  └─────────────────────────┘
```

**Ưu điểm MongoDB:**
- Lưu object phức tạp (mảng, object lồng nhau) rất tự nhiên
- Không cần định nghĩa schema cứng nhắc trước (flexible)
- Dễ scale horizontal

**Khi nào dùng SQL thay vì MongoDB:**
- Dữ liệu có nhiều quan hệ phức tạp (joins nhiều bảng)
- Cần transaction ACID nghiêm ngặt

---

## 2. Mongoose — ODM cho MongoDB

**Mongoose** là thư viện giúp làm việc với MongoDB trong Node.js. Nó thêm:
- **Schema** — định nghĩa cấu trúc document (validation)
- **Model** — object để query database
- **Middleware** — hooks trước/sau save, find, ...
- **Methods** — thêm hàm vào document

```bash
npm install mongoose
```

---

## 3. Kết nối MongoDB

### Tạo MongoDB Atlas (free)

1. Đăng ký tại [mongodb.com/atlas](https://mongodb.com/atlas)
2. Tạo cluster free tier (M0)
3. Tạo database user (username + password)
4. Cho phép IP (0.0.0.0/0 để dev)
5. Lấy connection string

```
mongodb+srv://username:password@cluster0.abc123.mongodb.net/toeic?retryWrites=true&w=majority
```

### Kết nối trong code

```javascript
const mongoose = require('mongoose');

async function connectDB() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB!');
}

connectDB();
```

🎯 **Trong project — `config/mongodb.js`:**

```javascript
const connectMongoDB = async () => {
    const MONGODB_URI = process.env.MONGODB_URI;

    await mongoose.connect(MONGODB_URI, {
        maxPoolSize: 50,      // Tối đa 50 connections đồng thời
        minPoolSize: 10,      // Duy trì ít nhất 10 connections
        serverSelectionTimeoutMS: 5000,  // Timeout 5s nếu không kết nối được
    });

    logger.info('MongoDB Connected', {
        host: mongoose.connection.host,
        db: mongoose.connection.name,
    });

    // Lắng nghe sự kiện disconnect
    mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected — sẽ tự reconnect');
    });
};
```

---

## 4. Schema — Định Nghĩa Cấu Trúc

Schema là "bản thiết kế" cho document. Mongoose dùng Schema để validate dữ liệu trước khi lưu.

### Tạo Schema đơn giản

```javascript
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    // Kiểu dữ liệu đơn giản
    name: String,
    price: Number,
    inStock: Boolean,

    // Với validation
    name: {
        type: String,
        required: true,         // Bắt buộc
        trim: true,             // Tự xóa whitespace
        minlength: 2,
        maxlength: 100,
    },
    price: {
        type: Number,
        required: [true, 'Giá là bắt buộc'],  // Custom error message
        min: [0, 'Giá không được âm'],
    },
    category: {
        type: String,
        enum: ['electronics', 'clothing', 'food'],  // Chỉ chấp nhận giá trị này
        default: 'electronics',
    },

    // Mảng
    tags: [String],
    images: [{ url: String, alt: String }],

    // Object lồng nhau
    dimensions: {
        width: Number,
        height: Number,
    },
});
```

### Các kiểu dữ liệu trong Mongoose

```javascript
{
    name: String,
    count: Number,
    active: Boolean,
    createdAt: Date,
    data: Buffer,           // Binary data
    anything: mongoose.Schema.Types.Mixed,    // Bất kỳ kiểu nào
    userId: mongoose.Schema.Types.ObjectId,   // Reference sang collection khác
}
```

### timestamps — Tự động thêm createdAt & updatedAt

```javascript
const Schema = new mongoose.Schema({
    name: String,
}, {
    timestamps: true,  // Tự thêm createdAt và updatedAt
});
```

🎯 **Trong project — `models/Vocabulary.js`:**

```javascript
const VocabularySchema = new mongoose.Schema({
    en: {
        type: String,
        required: [true, 'English word is required'],
        trim: true,
        unique: true,     // Không được trùng từ tiếng Anh
    },
    vn: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom'],
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium',
    },
    examples: [{         // Mảng object
        en: String,
        vn: String,
    }],
    topics: [String],   // Mảng string đơn giản
}, {
    timestamps: true,   // Tự thêm createdAt, updatedAt
});
```

---

## 5. Model — Tạo và Query

```javascript
// Tạo Model từ Schema
const Vocabulary = mongoose.model('Vocabulary', VocabularySchema);
//                               └── Tên collection sẽ là 'vocabularies' (tự thêm 's')

module.exports = Vocabulary;
```

### CRUD Operations

#### Create — Tạo mới

```javascript
// Cách 1: new + save()
const word = new Vocabulary({
    en: 'accomplish',
    vn: 'hoàn thành',
    type: 'verb',
    difficulty: 'medium',
});
await word.save();

// Cách 2: create() — ngắn hơn
const word = await Vocabulary.create({
    en: 'accomplish',
    vn: 'hoàn thành',
    type: 'verb',
});

// Tạo nhiều cùng lúc
await Vocabulary.insertMany([
    { en: 'achieve', vn: 'đạt được', type: 'verb' },
    { en: 'success', vn: 'thành công', type: 'noun' },
]);
```

#### Read — Lấy dữ liệu

```javascript
// Lấy tất cả
const words = await Vocabulary.find();

// Lọc
const verbs = await Vocabulary.find({ type: 'verb' });
const easyVerbs = await Vocabulary.find({ type: 'verb', difficulty: 'easy' });

// Lấy một document
const word = await Vocabulary.findOne({ en: 'accomplish' });
const word = await Vocabulary.findById('507f1f77bcf86cd799439011');

// Chọn fields cần lấy (projection)
const words = await Vocabulary.find({}, 'en vn type');
// Chỉ lấy fields en, vn, type — bỏ các fields khác

// Sắp xếp, phân trang
const words = await Vocabulary.find()
    .sort({ createdAt: -1 })     // Mới nhất trước (-1)
    .skip(20)                     // Bỏ qua 20 document đầu
    .limit(10);                   // Lấy tối đa 10
```

#### Update — Cập nhật

```javascript
// Cập nhật và trả về document mới
const updated = await Vocabulary.findByIdAndUpdate(
    id,
    { vn: 'hoàn thành được' },   // Fields cần cập nhật
    { new: true, runValidators: true }  // new: trả về doc sau khi update
);

// Cập nhật nhiều documents
await Vocabulary.updateMany(
    { difficulty: null },            // Filter
    { $set: { difficulty: 'medium' } }  // Update
);

// Atomic operators
await User.findByIdAndUpdate(userId, {
    $inc: { coins: 50, xp: 100 },  // Tăng giá trị
    $push: { badges: 'streak-7' }, // Thêm vào mảng
    $set: { lastLoginAt: new Date() },  // Set giá trị
});
```

#### Delete — Xóa

```javascript
await Vocabulary.findByIdAndDelete(id);

// Xóa nhiều
await Vocabulary.deleteMany({ isActive: false });
```

### Querying nâng cao

```javascript
// Comparison operators
await Vocabulary.find({ usageCount: { $gte: 10 } });  // >= 10
await Vocabulary.find({ level: { $in: [1, 2, 3] } }); // level là 1, 2, hoặc 3
await Vocabulary.find({ type: { $ne: 'noun' } });      // type != noun

// Regex (tìm kiếm text)
await Vocabulary.find({ en: { $regex: 'acc', $options: 'i' } });
// Tìm từ chứa 'acc', case-insensitive

// Count
const total = await Vocabulary.countDocuments({ isActive: true });
```

---

## 6. Schema Middleware (Hooks)

Middleware của Mongoose chạy trước/sau các operations:

```javascript
// pre('save') — Chạy trước khi save
UserSchema.pre('save', async function() {
    // 'this' là document đang được save

    // Chỉ hash nếu password bị thay đổi
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// post('save') — Chạy sau khi save
UserSchema.post('save', function(doc) {
    console.log(`User ${doc.username} đã được lưu`);
});
```

🎯 **Trong project — `models/User.js`:**

```javascript
// Hash password tự động trước khi save
UserSchema.pre('save', async function() {
    if (!this.isModified('password') || this.$skipPasswordHash) {
        return;  // Không hash nếu password không đổi
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});
```

---

## 7. Schema Methods & Statics

### Instance Methods — Gọi trên một document

```javascript
// Định nghĩa
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.generateToken = function() {
    return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Sử dụng
const user = await User.findOne({ email });
const isMatch = await user.comparePassword('mypassword');  // Gọi trên instance
const token = user.generateToken();
```

### Static Methods — Gọi trên Model

```javascript
// Định nghĩa
UserSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

// Sử dụng
const user = await User.findByEmail('alice@gmail.com');  // Gọi trên Model
```

🎯 **Trong project — `models/User.js`** có nhiều methods hữu ích:

```javascript
UserSchema.methods.addXp = function(amount) {
    this.xp += amount;
    this.totalXp += amount;

    // Tính XP cần để lên level tiếp theo (công thức exponential)
    const xpNeeded = Math.floor(100 * Math.pow(this.level, 1.5));

    if (this.xp >= xpNeeded) {
        this.level += 1;
        this.xp = this.xp - xpNeeded;
        return { leveledUp: true, newLevel: this.level };
    }
    return { leveledUp: false };
};

UserSchema.methods.updateStreak = function() {
    const today = new Date().setHours(0, 0, 0, 0);
    const lastPlay = this.streakLastPlayDate
        ? new Date(this.streakLastPlayDate).setHours(0, 0, 0, 0)
        : null;

    if (!lastPlay || lastPlay < today - 86400000) {
        this.streakCurrent = 1;                    // Reset streak
    } else if (lastPlay === today - 86400000) {
        this.streakCurrent += 1;                   // Tăng streak
        if (this.streakCurrent > this.streakLongest) {
            this.streakLongest = this.streakCurrent;
        }
    }
    this.streakLastPlayDate = Date.now();
};
```

---

## 8. Indexing — Tăng tốc Query

Index giống như mục lục của sách — giúp MongoDB tìm document nhanh hơn:

```javascript
// Thêm index vào Schema
VocabularySchema.index({ en: 1 });        // Index theo en (ascending)
VocabularySchema.index({ type: 1 });      // Index theo type
VocabularySchema.index({ type: 1, difficulty: 1 });  // Compound index

// Text search index — cho full-text search
VocabularySchema.index({
    en: 'text',
    vn: 'text',
    synonyms: 'text',
});
```

**Khi nào cần index:**
- Field thường dùng trong `.find({ field: value })`
- Field dùng để sort `.sort({ field: -1 })`
- Fields kết hợp query thường xuyên

**⚠️ Lưu ý**: Index tăng tốc read nhưng làm chậm write (phải cập nhật index). Không nên index tất cả fields.

---

## 9. Populate — Quan hệ giữa Collections

Khi một document reference sang collection khác:

```javascript
// Schema với reference
const PracticeSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',   // Tên model tham chiếu
        required: true,
    },
    words: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vocabulary',
    }],
    score: Number,
});

// Query và populate
const session = await PracticeSession.findById(id)
    .populate('userId', 'username email')   // Thay ObjectId bằng User object
    .populate('words', 'en vn');             // Chỉ lấy en và vn
```

---

## 10. Aggregation — Thống kê phức tạp

```javascript
// Đếm user đăng ký theo ngày (dùng trong admin dashboard)
const growth = await User.aggregate([
    // Stage 1: Lọc user tạo trong 30 ngày gần nhất
    { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },

    // Stage 2: Group theo ngày
    {
        $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
        }
    },

    // Stage 3: Sắp xếp theo ngày
    { $sort: { _id: 1 } },
]);
// Kết quả: [{ _id: '2025-01-01', count: 5 }, ...]
```

🎯 **Trong project — `server.js`** dùng aggregation cho admin stats:

```javascript
// server.js — User growth chart
const raw = await User.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
    }},
    { $sort: { _id: 1 } },
]);
```

---

## Bài Tập Thực Hành

### Bài 1: Schema và CRUD

Tạo Schema cho "Product" với các fields: name, price, category, inStock, và tạo CRUD API cho nó.

```javascript
// models/Product.js
const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tên sản phẩm là bắt buộc'],
        trim: true,
        maxlength: [100, 'Tên không quá 100 ký tự'],
    },
    price: {
        type: Number,
        required: true,
        min: [0, 'Giá không được âm'],
    },
    category: {
        type: String,
        enum: ['điện tử', 'quần áo', 'thực phẩm'],
        default: 'điện tử',
    },
    inStock: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });
```

### Bài 2: Mongoose methods

Thêm method `getPriceInUSD()` vào ProductSchema (tỷ giá: 1 USD = 25000 VND).

### Bài 3: Aggregation

Viết query aggregation đếm số sản phẩm theo từng category.

---

## Câu Hỏi Ôn Tập

1. `findById(id)` và `findOne({ _id: id })` khác nhau như thế nào?

2. Tại sao `{ new: true }` trong `findByIdAndUpdate()` lại quan trọng?

3. Khi dùng `$inc: { coins: 50 }` thay vì `user.coins += 50; await user.save()`, lợi ích là gì?

4. Tại sao không nên index tất cả các fields?

5. `UserSchema.methods.xxx` và `UserSchema.statics.xxx` khác nhau như thế nào? Dùng cái nào khi nào?

---

## Tóm Tắt

- **MongoDB** = NoSQL database, lưu dữ liệu dạng JSON document
- **Mongoose** = ODM giúp làm việc với MongoDB từ Node.js
- **Schema** = định nghĩa cấu trúc, validation rules
- **Model** = object để thực hiện CRUD queries
- **CRUD**: `create()`, `find()`, `findByIdAndUpdate()`, `findByIdAndDelete()`
- **Middleware**: `pre('save')` để tự động hash password trước khi lưu
- **Methods**: Thêm business logic vào document (`addXp`, `updateStreak`)
- **Index**: Tăng tốc query nhưng làm chậm write
- **Aggregation**: Thống kê phức tạp với pipeline
