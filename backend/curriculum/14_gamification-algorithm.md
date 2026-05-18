# Module 14: Gamification & Thuật Toán SM-2

---

## Mục tiêu

Sau module này bạn sẽ:
- Hiểu gamification là gì và tại sao nó tăng engagement
- Biết thiết kế hệ thống XP, Level, Streak, Coins
- Hiểu thuật toán SM-2 (Spaced Repetition) — khoa học đằng sau Anki
- Biết implement SM-2 trong MongoDB Schema
- Hiểu cách kết hợp gamification + spaced repetition
- Đọc được `models/User.js` (game mechanics) và `models/WrongWord.js` (SM-2)

---

## Gamification là gì?

**Gamification** = Áp dụng cơ chế game vào ứng dụng không phải game để tăng động lực và engagement.

**Tại sao học TOEIC cần gamification?**
- Học từ vựng lặp đi lặp lại → nhàm chán
- Gamification tạo **feedback loop**: Làm → Nhận reward → Muốn làm tiếp
- Streak tạo **FOMO**: "Nếu hôm nay không học, mất streak 30 ngày!"
- Leaderboard tạo **cạnh tranh**: "Tôi phải qua mặt user này"

---

## 1. Hệ Thống XP và Level

### Thiết kế

```
XP (Experience Points) = Điểm kinh nghiệm tích lũy từ học tập
Level = Mốc đạt được khi tích đủ XP
```

**Công thức level progression** trong project:
```javascript
xpNeeded = Math.floor(100 * Math.pow(level, 1.5))

Level 1 → 2: cần 100 XP
Level 2 → 3: cần 283 XP   (100 * 2^1.5)
Level 3 → 4: cần 520 XP   (100 * 3^1.5)
Level 5 → 6: cần 1118 XP
Level 10 → 11: cần 3162 XP
```

Công thức **exponential** làm cho level cao ngày càng khó đạt hơn — phù hợp với learning curve thực tế.

🎯 **Trong project — `models/User.js`:**

```javascript
UserSchema.methods.addXp = function(amount) {
    this.xp += amount;
    this.totalXp += amount;

    const xpNeeded = Math.floor(100 * Math.pow(this.level, 1.5));

    if (this.xp >= xpNeeded) {
        this.level += 1;
        this.xp = this.xp - xpNeeded;   // XP thừa mang sang level mới
        return { leveledUp: true, newLevel: this.level };
    }

    return { leveledUp: false };
};
```

### Phân phối XP theo hành động

```javascript
const XP_REWARDS = {
    CORRECT_ANSWER: 10,
    PERFECT_SESSION: 50,         // Đúng 100%
    STREAK_BONUS: 20 * streakDays, // Tăng theo streak
    FIRST_TIME_WORD: 15,         // Học từ mới lần đầu
    SPEED_BONUS: 5,              // Trả lời nhanh
};
```

---

## 2. Streak — Chuỗi ngày học liên tiếp

**Streak** là số ngày học liên tiếp không bị gián đoạn. Mất streak = mất toàn bộ chuỗi.

### Logic cập nhật streak

```
Hôm nay so với ngày học cuối:
├── Cùng ngày    → Đã học hôm nay rồi, không thay đổi
├── Ngày hôm qua → Tiếp tục streak (streak++)
└── Cũ hơn       → Reset streak về 1
```

🎯 **Trong project — `models/User.js`:**

```javascript
UserSchema.methods.updateStreak = function() {
    const today = new Date().setHours(0, 0, 0, 0);     // Đầu ngày hôm nay
    const lastPlay = this.streakLastPlayDate
        ? new Date(this.streakLastPlayDate).setHours(0, 0, 0, 0)
        : null;

    if (!lastPlay || lastPlay < today - 86400000) {
        // Chưa có streak, hoặc bỏ ngày hôm qua → Reset
        this.streakCurrent = 1;
    } else if (lastPlay === today - 86400000) {
        // Ngày hôm qua → Tăng streak
        this.streakCurrent += 1;
        if (this.streakCurrent > this.streakLongest) {
            this.streakLongest = this.streakCurrent;
        }
    }
    // lastPlay === today → Không thay đổi (đã học hôm nay)

    this.streakLastPlayDate = Date.now();
};
```

### Streak Shield

**Streak Shield** = Vật phẩm cho phép bảo vệ streak khi bỏ một ngày. Tạo thêm động lực mua bằng coins.

```javascript
// Khi user bỏ học → check có shield không
if (streakBroken && user.shields > 0) {
    user.shields -= 1;
    user.streakShieldsUsed += 1;
    // Streak được bảo vệ — không reset
}
```

---

## 3. Energy System

**Energy** giới hạn số lần luyện tập trong ngày → tạo **scarcity** (khan hiếm):
- Không thể farm XP vô hạn trong 1 ngày
- Tạo lý do quay lại mỗi ngày (energy tự nạp theo thời gian)
- Tạo lý do mua energy bằng gems

```javascript
UserSchema.methods.regenerateEnergy = function() {
    const now = Date.now();
    const lastUpdate = this.lastEnergyUpdate.getTime();
    const minutesPassed = Math.floor((now - lastUpdate) / 60000);

    if (minutesPassed > 0 && this.energy < this.maxEnergy) {
        // +1 energy mỗi phút (100 energy = 100 phút = 1h40)
        const energyToAdd = Math.min(minutesPassed, this.maxEnergy - this.energy);
        this.energy += energyToAdd;
        this.lastEnergyUpdate = now;
    }
};
```

---

## 4. Virtual Economy — Coins và Gems

**Two-currency system** phổ biến trong mobile games:

| Currency | Cách kiếm | Dùng để |
|----------|-----------|---------|
| **Coins** | Hoàn thành bài tập | Mua hints, shields |
| **Gems** | Streak milestones, achievements | Mua energy, XP boost |

Tách 2 loại tiền giúp:
- Coins (common) — dễ kiếm, dùng thường
- Gems (premium) — khó kiếm, dùng cho items quý

```javascript
UserSchema.methods.useCoins = function(amount) {
    if (this.coins < amount) {
        throw new Error('Not enough coins');
    }
    this.coins -= amount;
};
```

---

## 5. Achievements

Achievements (thành tích) là milestones được unlock khi đạt điều kiện:

```javascript
// Ví dụ achievements
const ACHIEVEMENTS = [
    {
        id: 'first-word',
        name: 'Từ đầu tiên',
        description: 'Học từ vựng đầu tiên',
        conditionType: 'wordsLearned',
        conditionValue: 1,
        rewardXp: 50,
        rewardCoins: 100,
    },
    {
        id: 'streak-7',
        name: 'Tuần lễ hoàng kim',
        description: 'Học 7 ngày liên tiếp',
        conditionType: 'streak',
        conditionValue: 7,
        rewardGems: 5,
    },
    {
        id: 'speed-demon',
        name: 'Tốc độ ánh sáng',
        description: 'Đạt điểm tối đa trong Speed Quiz',
        conditionType: 'perfectSpeedQuiz',
        conditionValue: 1,
        rewardXp: 200,
    },
];

// Kiểm tra sau mỗi session
function checkAchievements(user, sessionResult) {
    const unlocked = [];

    for (const achievement of ACHIEVEMENTS) {
        if (achievement.unlocked) continue;  // Đã unlock rồi

        const isUnlocked = checkCondition(user, achievement, sessionResult);
        if (isUnlocked) {
            achievement.unlocked = true;
            achievement.unlockedAt = new Date();
            user.addXp(achievement.rewardXp || 0);
            user.addCoins(achievement.rewardCoins || 0);
            unlocked.push(achievement);
        }
    }

    return unlocked;
}
```

---

## 6. Spaced Repetition — Khoa Học Đằng Sau Anki

### Forgetting Curve (Hermann Ebbinghaus, 1885)

Não người quên theo quy luật exponential:

```
Sau 1 giờ:   Nhớ ~50% nội dung mới học
Sau 1 ngày:  Nhớ ~33%
Sau 1 tuần:  Nhớ ~25%
Sau 1 tháng: Nhớ ~21%
```

**Spaced Repetition**: Ôn lại đúng lúc sắp quên → củng cố trí nhớ → kéo dài khoảng cách ôn tập lần sau.

```
Lần 1: Học từ mới
Lần 2: Ôn sau 1 ngày
Lần 3: Ôn sau 6 ngày
Lần 4: Ôn sau 14 ngày
Lần 5: Ôn sau 30 ngày
...
```

### Thuật Toán SM-2 (SuperMemo 2)

SM-2 là thuật toán spaced repetition được phát triển năm 1987, nền tảng của Anki và Duolingo.

**3 biến số:**
- **EF (Easiness Factor)**: 1.3 - 2.5, mặc định 2.5. Từ dễ nhớ EF cao
- **interval**: Số ngày đến lần ôn tiếp theo
- **repetition**: Số lần trả lời đúng liên tiếp

**Công thức khi trả lời ĐÚNG:**
```
If repetition == 1: interval = 1
If repetition == 2: interval = 6
If repetition >= 3: interval = round(interval * EF)

EF mới = EF + 0.1  (tăng EF khi đúng)
```

**Khi trả lời SAI:**
```
repetition = 0 (reset)
interval = 1
EF = max(1.3, EF - 0.2)  (giảm EF khi sai)
```

**Ví dụ timeline:**
```
Học từ "accomplish":
  Trả lời đúng lần 1: EF=2.5, interval=1  → Ôn lại sau 1 ngày
  Trả lời đúng lần 2: EF=2.6, interval=6  → Ôn lại sau 6 ngày
  Trả lời đúng lần 3: EF=2.7, interval=16 → Ôn lại sau 16 ngày (6*2.6=~16)
  Trả lời sai lần 4:  EF=2.5, interval=1  → Ôn lại sau 1 ngày (reset!)
  Trả lời đúng lần 5: EF=2.6, interval=1  → (repetition reset về 0→1)
```

🎯 **Trong project — `models/WrongWord.js`:**

```javascript
WrongWordSchema.methods.recordCorrect = function() {
    this.correctCount += 1;
    this.reviewCount += 1;
    this.repetition += 1;

    // Tăng EF (từ dễ nhớ hơn sau khi đúng)
    this.easinessFactor = Math.min(2.5, this.easinessFactor + 0.1);

    // Tính interval mới theo SM-2
    if (this.repetition === 1) {
        this.interval = 1;
    } else if (this.repetition === 2) {
        this.interval = 6;
    } else {
        this.interval = Math.round(this.interval * this.easinessFactor);
    }

    // Next review date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + this.interval);
    this.nextReviewDate = nextDate;

    // Tăng mastery level (0-5)
    this.masteryLevel = Math.min(5, this.masteryLevel + 1);

    // Mastered khi level 5 và repetition >= 3
    if (this.masteryLevel >= 5 && this.repetition >= 3) {
        this.status = 'mastered';
    }
};

WrongWordSchema.methods.recordWrong = function() {
    this.wrongCount += 1;
    this.repetition = 0;              // Reset chuỗi đúng
    this.easinessFactor = Math.max(1.3, this.easinessFactor - 0.2);  // Giảm EF
    this.interval = 1;                // Ôn lại sớm
    this.masteryLevel = Math.max(0, this.masteryLevel - 1);
    // Set nextReviewDate = ngày mai
};
```

---

## 7. Priority Score — Xếp Hạng Từ Cần Ôn

Ngoài `nextReviewDate`, dùng `priorityScore` để ưu tiên từ cần ôn nhất:

```javascript
WrongWordSchema.methods.calculatePriority = function() {
    const now = Date.now();
    const daysSinceWrong = (now - this.lastWrongAt) / 86400000;
    const daysOverdue = -1 * ((this.nextReviewDate - now) / 86400000); // Âm = chưa đến hạn

    let score = this.wrongCount * 20;    // Sai nhiều = ưu tiên cao

    if (daysOverdue > 0) {
        score += daysOverdue * 10;       // Quá hạn ôn = urgent
    }
    if (daysSinceWrong < 3) {
        score += 30;                     // Mới sai gần đây = ôn sớm
    }

    score -= this.masteryLevel * 15;     // Thuộc rồi = ít ưu tiên
    score -= this.correctCount * 5;      // Đúng nhiều = ít ưu tiên

    this.priorityScore = Math.max(0, Math.round(score));
};
```

**Query lấy từ cần ôn:**
```javascript
WrongWordSchema.statics.getWordsToReview = async function(userId, limit = 10) {
    const now = new Date();
    return this.find({
        userId,
        status: 'active',
        nextReviewDate: { $lte: now }   // Đã đến lúc ôn
    })
    .sort({ priorityScore: -1, nextReviewDate: 1 })  // Ưu tiên cao trước
    .limit(limit);
};
```

---

## 8. Kết Hợp: Gamification + Spaced Repetition

```javascript
// Sau khi user hoàn thành practice session:
async function handleSessionComplete(userId, sessionResult) {
    const user = await User.findById(userId);

    // 1. Update XP và level
    const { xpEarned, leveledUp } = user.addXp(sessionResult.xpEarned);

    // 2. Update streak
    user.updateStreak();

    // 3. Update coins
    user.addCoins(sessionResult.coinsEarned);

    // 4. Check achievements
    const newAchievements = checkAchievements(user, sessionResult);

    // 5. Update SM-2 cho từng từ đã làm
    for (const wordResult of sessionResult.words) {
        const wrongWord = await WrongWord.findOne({ userId, wordId: wordResult.id });

        if (wrongWord) {
            if (wordResult.correct) {
                wrongWord.recordCorrect();
            } else {
                wrongWord.recordWrong();
            }
            wrongWord.calculatePriority();
            await wrongWord.save();
        } else if (!wordResult.correct) {
            // Từ mới sai lần đầu → tạo WrongWord record
            await WrongWord.create({
                userId,
                wordId: wordResult.id,
                en: wordResult.en,
                vn: wordResult.vn,
            });
        }
    }

    await user.save();

    return {
        xpEarned,
        leveledUp,
        newAchievements,
        nextReviewCount: await WrongWord.countDocuments({
            userId,
            status: 'active',
            nextReviewDate: { $lte: new Date() }
        }),
    };
}
```

---

## Bài Tập Thực Hành

### Bài 1: Implement Level System

```javascript
function addXp(currentLevel, currentXp, xpToAdd) {
    let xp = currentXp + xpToAdd;
    let level = currentLevel;
    let leveledUp = false;

    while (true) {
        const xpNeeded = Math.floor(100 * Math.pow(level, 1.5));
        if (xp >= xpNeeded) {
            xp -= xpNeeded;
            level++;
            leveledUp = true;
        } else {
            break;
        }
    }

    return { level, xp, leveledUp };
}

// Test
console.log(addXp(1, 80, 50));    // Level up: 1→2, XP: 80+50-100=30
console.log(addXp(5, 1000, 200)); // Level 5 cần 1118 XP → không level up
```

### Bài 2: Implement SM-2

```javascript
function sm2Update(card, quality) {
    // quality: 0-5 (0=hoàn toàn quên, 5=nhớ hoàn hảo)
    // Trong project: quality = 0 (sai) hoặc 5 (đúng)

    let { ef, interval, repetition } = card;

    if (quality >= 3) {  // Đúng
        if (repetition === 0) interval = 1;
        else if (repetition === 1) interval = 6;
        else interval = Math.round(interval * ef);

        repetition++;
    } else {  // Sai
        repetition = 0;
        interval = 1;
    }

    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    ef = Math.max(1.3, ef);

    return {
        ef: Math.round(ef * 100) / 100,
        interval,
        repetition,
        nextDate: new Date(Date.now() + interval * 86400000),
    };
}

// Simulate học một từ 5 lần đúng
let card = { ef: 2.5, interval: 1, repetition: 0 };
for (let i = 0; i < 5; i++) {
    card = sm2Update(card, 5);
    console.log(`Rep ${i+1}: interval=${card.interval} days, EF=${card.ef}`);
}
```

---

## Câu Hỏi Ôn Tập

1. Tại sao công thức XP dùng `Math.pow(level, 1.5)` thay vì nhân cố định (vd: thêm 100 mỗi level)?

2. Trong SM-2, tại sao khi trả lời SAI phải reset `repetition = 0` thay vì chỉ giảm 1?

3. `easinessFactor` ảnh hưởng thế nào đến tốc độ ôn tập của một từ dễ vs khó?

4. Tại sao cần cả `nextReviewDate` và `priorityScore` để sắp xếp từ cần ôn?

5. **Two-currency system** (coins + gems) giải quyết vấn đề gì mà một loại currency không giải quyết được?

---

## Tóm Tắt

- **Gamification**: XP, Level, Streak, Coins, Achievements → feedback loop tạo động lực
- **XP formula**: `100 * level^1.5` — exponential scale, level cao ngày càng khó
- **Streak**: Học liên tiếp không bị gián đoạn — FOMO effect, Streak Shield bảo vệ
- **Energy**: Giới hạn số lần luyện tập, tự nạp theo thời gian
- **Two currencies**: Coins (dễ kiếm, dùng thường) + Gems (khó kiếm, dùng premium)
- **SM-2**: Thuật toán spaced repetition — ôn đúng lúc sắp quên, khoảng cách tăng dần
- **EF (Easiness Factor)**: Tăng khi đúng, giảm khi sai — cá nhân hóa lịch ôn
- **Priority Score**: Kết hợp nhiều yếu tố để xếp hạng từ cần ôn gấp nhất
