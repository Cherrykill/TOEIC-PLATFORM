/**
 * Đổi mật khẩu một tài khoản, chạy tại máy: `npm run change-password`
 *
 * Ba chỗ bản cũ làm sai, sửa hết ở đây:
 *
 *  1. Tra `User.findOne({ username })` — nhưng `username` đã dời sang
 *     `user_profiles` từ lâu, `users` không còn trường đó. Script luôn báo
 *     "User not found" dù gõ đúng tên. Giờ tra như authController.login: có '@'
 *     thì tìm theo email, không thì tra UserProfile rồi lấy User theo userId.
 *
 *  2. Tự khai một `userSchema` riêng thay vì dùng models/User.js. Bản khai đó
 *     KHÔNG có hook `pre('save')` băm mật khẩu, nên script phải tự băm. Dùng
 *     model thật mà vẫn tự băm là băm HAI LẦN → mật khẩu mới không đăng nhập
 *     được, mà lỗi chỉ lộ ra lúc thử đăng nhập. Ở đây gán mật khẩu thô rồi để
 *     hook của model lo.
 *
 *  3. Mật khẩu hiện nguyên văn khi gõ, nằm lại trong lịch sử cuộn của terminal.
 *     Giờ che lại.
 */
const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const User = require('../../models/User');
const UserProfile = require('../../models/UserProfile');

const MIN_LENGTH = 6;   // khớp với authController (đổi ở đây thì đổi cả bên đó)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (q) => new Promise(resolve => rl.question(q, resolve));

/**
 * Hỏi mà không hiện ký tự. Ghi đè `_writeToOutput` của readline — API nội bộ,
 * nên nếu Node đổi cách làm thì rơi về hỏi thường còn hơn là script chết.
 */
function askHidden(query) {
    return new Promise(resolve => {
        try {
            process.stdout.write(query);
            rl._writeToOutput = (str) => { if (str.includes('\n')) rl.output.write('\n'); };
            rl.question('', (value) => {
                rl._writeToOutput = (str) => rl.output.write(str);
                resolve(value);
            });
        } catch {
            rl._writeToOutput = (str) => rl.output.write(str);
            resolve(ask(query));
        }
    });
}

/** Tìm user theo email hoặc username — cùng cách authController.login tra. */
async function findUser(identifier) {
    if (identifier.includes('@')) {
        return User.findOne({ email: identifier.toLowerCase().trim() });
    }
    const profile = await UserProfile.findOne({ username: identifier.trim() });
    return profile ? User.findById(profile.userId) : null;
}

async function main() {
    if (!process.env.MONGODB_URI) {
        console.error('❌ Thiếu MONGODB_URI — kiểm tra backend/.env');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    const identifier = (await ask('Email hoặc tên đăng nhập: ')).trim();
    if (!identifier) {
        console.error('❌ Phải nhập email hoặc tên đăng nhập');
        process.exit(1);
    }

    const user = await findUser(identifier);
    if (!user) {
        console.error(`❌ Không tìm thấy tài khoản "${identifier}"`);
        process.exit(1);
    }

    const profile = await UserProfile.findOne({ userId: user._id }).select('username');
    console.log('\n✅ Tìm thấy:');
    console.log(`   Tên đăng nhập : ${profile?.username || '(chưa có)'}`);
    console.log(`   Email         : ${user.email}`);
    console.log(`   Vai trò       : ${user.role}`);
    if (user.isLocked) console.log('   ⚠ Đang bị khoá bởi quản trị viên');
    if (user.lockUntil && user.lockUntil > Date.now()) {
        console.log(`   ⚠ Đang khoá tạm tới ${new Date(user.lockUntil).toLocaleString('vi-VN')}`);
    }
    console.log('');

    const newPassword = await askHidden(`Mật khẩu mới (tối thiểu ${MIN_LENGTH} ký tự): `);
    if (!newPassword || newPassword.length < MIN_LENGTH) {
        console.error(`\n❌ Mật khẩu phải ít nhất ${MIN_LENGTH} ký tự`);
        process.exit(1);
    }

    const confirm = await askHidden('Nhập lại mật khẩu mới: ');
    if (newPassword !== confirm) {
        console.error('\n❌ Hai lần nhập không khớp');
        process.exit(1);
    }

    // Gán THÔ. Hook pre('save') trong models/User.js tự băm — tự băm ở đây nữa
    // là băm hai lần, mật khẩu mới sẽ không đăng nhập được.
    user.password = newPassword;

    // Đổi mật khẩu cũng là lúc gỡ khoá đăng nhập sai: người quên mật khẩu
    // thường đã gõ sai nhiều lần và đang bị khoá tạm — đổi xong mà vẫn khoá thì
    // vẫn không vào được, rất khó hiểu.
    user.loginAttempts = 0;
    user.lockUntil = null;

    await user.save();

    console.log('\n✅ Đã đổi mật khẩu cho', user.email);
    console.log('   Đã xoá luôn số lần đăng nhập sai và khoá tạm (nếu có).');
    console.log('\n⚠ Lưu ý: token đã cấp trước đó VẪN dùng được tới khi hết hạn');
    console.log('  (JWT_EXPIRE, mặc định 7 ngày). Đổi mật khẩu không đá được các');
    console.log('  phiên đang đăng nhập ra. Nếu nghi tài khoản bị chiếm, phải đổi');
    console.log('  JWT_SECRET trong .env — nhưng thao tác đó đăng xuất TẤT CẢ.\n');

    rl.close();
    await mongoose.connection.close();
    process.exit(0);
}

main().catch(async (err) => {
    console.error('❌ Lỗi:', err.message);
    rl.close();
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
});
