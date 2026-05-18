# Module 12: Swagger — API Documentation

---

## Mục tiêu

Sau module này bạn sẽ:
- Hiểu tại sao cần API documentation
- Biết cấu hình Swagger UI trong Express
- Biết viết JSDoc annotations trong routes
- Biết định nghĩa Schemas, Request bodies, Response formats
- Biết cấu hình authentication trong Swagger
- Đọc được `config/swagger.js` và JSDoc trong routes

---

## Tại sao cần API Documentation?

Bạn viết API cho backend — nhưng ai dùng nó? Frontend developer, mobile developer, hoặc chính bạn sau 3 tháng.

Không có documentation:
```
Frontend: "Endpoint login nhận gì?"
Backend: "Mày tự đọc code đi"
Frontend: "...request body có field gì?"
Backend: "email và password"
Frontend: "Trả về gì?"
Backend: "Object user và token"
Frontend: "Format là gì?"
Backend: *giải thích 30 phút qua chat*
```

Có Swagger:
```
Frontend: Mở http://localhost:5000/api-docs
→ Thấy ngay: tất cả endpoints, parameters, request/response format
→ Test trực tiếp từ browser
→ Copy code example
```

---

## 1. Swagger / OpenAPI

**OpenAPI** là chuẩn mô tả REST API (được hỗ trợ bởi hầu hết ngôn ngữ/framework).
**Swagger UI** là giao diện web để đọc và test OpenAPI specs.

```bash
npm install swagger-jsdoc swagger-ui-express
```

- **`swagger-jsdoc`**: Tạo OpenAPI spec từ JSDoc comments trong code
- **`swagger-ui-express`**: Serve Swagger UI tại một route

---

## 2. Cấu hình Swagger

```javascript
// config/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',        // Version OpenAPI
        info: {
            title: 'TOEIC API',
            version: '1.0.0',
            description: 'API documentation cho TOEIC Learning Platform',
        },
        servers: [
            { url: 'http://localhost:5000', description: 'Local' },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                // Reusable schemas định nghĩa ở đây
            },
        },
        security: [{ bearerAuth: [] }],   // Mặc định mọi endpoint cần auth
    },
    apis: ['./routes/*.js'],   // Đọc JSDoc từ tất cả file routes
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
```

```javascript
// server.js
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'TOEIC API Docs',
    swaggerOptions: { persistAuthorization: true },  // Nhớ token sau khi F5
}));

// JSON spec để import vào Postman/Insomnia
app.get('/api-docs.json', (_, res) => res.json(swaggerSpec));
```

Truy cập: `http://localhost:5000/api-docs`

---

## 3. Viết JSDoc Annotations

Swagger JSDoc dùng comments `/** @swagger */` trong route files:

### Cấu trúc annotation cơ bản

```javascript
/**
 * @swagger
 * /api/vocabulary:
 *   get:
 *     tags: [Vocabulary]         ← Nhóm endpoint
 *     summary: Lấy danh sách từ vựng
 *     description: Có phân trang và filter theo type/difficulty
 *     security: []               ← Không cần auth (override default)
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VocabularyListResponse'
 *       500:
 *         description: Server error
 */
router.get('/', getAllVocabulary);
```

### Parameters

```javascript
/**
 * @swagger
 * /api/vocabulary:
 *   get:
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [noun, verb, adjective, adverb]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId
 */
```

### Request Body

```javascript
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng nhập
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 example: admin
 *                 description: Username hoặc email
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Admin@123
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Sai thông tin đăng nhập
 */
```

### $ref — Tái Sử Dụng Schema

Thay vì viết schema dài trong mỗi annotation, định nghĩa một lần trong `config/swagger.js` và reference:

```javascript
// config/swagger.js — định nghĩa schema
components: {
    schemas: {
        VocabularyItem: {
            type: 'object',
            properties: {
                _id:        { type: 'string', example: '507f1f77bcf86cd799439011' },
                en:         { type: 'string', example: 'accomplish' },
                vn:         { type: 'string', example: 'hoàn thành' },
                type:       { type: 'string', enum: ['noun', 'verb', 'adjective', 'adverb'] },
                difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                phonetic:   { type: 'string', example: '/əˈkʌmplɪʃ/' },
            },
        },
        VocabularyListResponse: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/VocabularyItem' },
                },
                pagination: {
                    type: 'object',
                    properties: {
                        page:       { type: 'integer' },
                        limit:      { type: 'integer' },
                        total:      { type: 'integer' },
                        totalPages: { type: 'integer' },
                    },
                },
            },
        },
        ErrorResponse: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Error description' },
            },
        },
    },
},
```

```javascript
// routes/vocabulary.js — dùng $ref
/**
 * @swagger
 * /api/vocabulary:
 *   get:
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VocabularyListResponse'  ← Tham chiếu
 */
```

---

## 4. Authentication trong Swagger

Để test các endpoint cần auth, cần "đăng nhập" trong Swagger UI:

```javascript
// config/swagger.js
components: {
    securitySchemes: {
        bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
        },
    },
},
security: [{ bearerAuth: [] }],   // Áp dụng cho tất cả endpoints mặc định
```

```javascript
// Route công khai — override bằng security: []
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     security: []   ← Không cần token
 */

// Route cần token (mặc định)
/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Lấy thông tin bản thân
 *     # security không viết → dùng default = bearerAuth
 */
```

**Cách dùng trong Swagger UI:**
1. Gọi `POST /api/auth/login` → copy token từ response
2. Click nút "Authorize" (khóa) ở trên cùng
3. Paste token vào → Authorize
4. Giờ test các endpoint cần auth được rồi

---

## 5. Tags — Nhóm Endpoints

```javascript
// config/swagger.js
definition: {
    tags: [
        { name: 'Auth', description: 'Đăng nhập, đăng ký, OTP' },
        { name: 'Vocabulary', description: 'CRUD từ vựng TOEIC' },
        { name: 'Practice', description: 'Luyện tập từ vựng' },
        { name: 'Users', description: 'Quản lý người dùng' },
    ],
}

// Trong route annotation
/**
 * @swagger
 * /api/vocabulary:
 *   get:
 *     tags: [Vocabulary]   ← Gán vào group Vocabulary
 */
```

---

## 6. Ví Dụ Annotation Đầy Đủ

🎯 **Trong project — `routes/practice.js`:**

```javascript
/**
 * @swagger
 * /api/practice/start:
 *   post:
 *     tags: [Practice]
 *     summary: Bắt đầu phiên luyện tập
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mode
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [multiple-choice, fill-blank, listening, matching, word-scramble, speed-quiz]
 *                 example: multiple-choice
 *               questionCount:
 *                 type: integer
 *                 default: 10
 *                 minimum: 5
 *                 maximum: 50
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard, adaptive]
 *                 default: medium
 *     responses:
 *       200:
 *         description: Phiên luyện tập đã tạo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sessionId:
 *                   type: string
 *                 questions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PracticeQuestion'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/start', protect, startPractice);
```

---

## 7. Lợi Ích Thực Tế

1. **Frontend developer** tự đọc docs, không cần hỏi backend
2. **Test API** trực tiếp từ browser (Swagger UI)
3. **Import vào Postman**: `http://localhost:5000/api-docs.json` → Import → Postman collection
4. **Code contract**: Docs là "hợp đồng" giữa frontend và backend
5. **Onboarding**: Developer mới tự tìm hiểu API mà không cần hướng dẫn

---

## Bài Tập Thực Hành

### Bài 1: Thêm annotation cho CRUD API

Lấy CRUD API từ Module 3 (tasks) và thêm Swagger annotations:

```javascript
// Cấu hình swagger.js và server.js trước
// Sau đó thêm annotations vào routes/tasks.js:

/**
 * @swagger
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: Lấy tất cả tasks
 *     security: []
 *     responses:
 *       200:
 *         description: Danh sách tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 */
```

Định nghĩa Task schema trong swagger.js:
```javascript
schemas: {
    Task: {
        type: 'object',
        properties: {
            id:    { type: 'integer', example: 1 },
            title: { type: 'string', example: 'Học Node.js' },
            done:  { type: 'boolean', example: false },
        },
    },
}
```

### Bài 2: Annotation cho auth route

Thêm annotation cho `POST /tasks` (tạo task mới) với request body và validation errors.

---

## Câu Hỏi Ôn Tập

1. `swagger-jsdoc` và `swagger-ui-express` đảm nhận vai trò gì khác nhau?

2. `$ref: '#/components/schemas/User'` hoạt động như thế nào?

3. Tại sao `security: []` cần thiết cho route đăng nhập?

4. `persistAuthorization: true` trong Swagger options có tác dụng gì?

5. Endpoint `/api-docs.json` dùng để làm gì?

---

## Tóm Tắt

- **OpenAPI 3.0**: Chuẩn mô tả REST API — language-agnostic
- **swagger-jsdoc**: Parse JSDoc comments trong routes → tạo OpenAPI spec
- **swagger-ui-express**: Serve UI tại `/api-docs` để đọc và test
- **JSDoc annotations**: Comment `/** @swagger */` trên mỗi route
- **Schemas**: Định nghĩa một lần trong `config/swagger.js`, tái dùng qua `$ref`
- **Tags**: Nhóm endpoints liên quan vào cùng section
- **bearerAuth**: Cấu hình JWT authentication trong Swagger UI
- **`/api-docs.json`**: Export spec để import vào Postman/Insomnia
