const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const UserStats = require('../models/UserStats');
const OtpCode = require('../models/OtpCode');
const logger = require('../utils/logger');
const { buildFullState, applyEnergyRegen, createUserWithDependents } = require('../utils/userStateHelper');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { emailQueue } = require('../queues');
const { sendOtpEmail } = require('../utils/emailService');

const QUEUE_TIMEOUT_MS = 2000;

async function dispatchEmail(to, code, type, jobId) {
    try {
        const addJob = emailQueue.add('send-otp', { to, code, type }, { jobId });
        addJob.catch(() => {}); // suppress dangling rejection if timeout wins
        await Promise.race([
            addJob,
            new Promise((_, reject) => setTimeout(() => reject(new Error('queue timeout')), QUEUE_TIMEOUT_MS)),
        ]);
    } catch (err) {
        logger.warn('Email queue unavailable, using fallback', { error: err.message });
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await sendOtpEmail(to, code, type);
        } else {
            // No email credentials — print to console (dev only)
            logger.info('='.repeat(50));
            logger.info(`📧  OTP [dev, no SMTP] → ${to}  type=${type}`);
            logger.info(`    CODE: ${code}`);
            logger.info('='.repeat(50));
        }
    }
}

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

// ===================================
// AUTH
// ===================================

const login = async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
        const loginIdentifier = email || username;

        if (!loginIdentifier || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email/username and password' });
        }

        // Find User — try email first, then username via UserProfile
        let user;
        if (loginIdentifier.includes('@')) {
            user = await User.findOne({ email: loginIdentifier.toLowerCase().trim() }).select('+password');
        } else {
            const profile = await UserProfile.findOne({ username: loginIdentifier.trim() });
            if (profile) user = await User.findById(profile.userId).select('+password');
        }

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (!user.isActive) {
            return res.status(401).json({ success: false, message: 'Account is disabled' });
        }

        if (user.isLocked && user.role !== 'admin') {
            return res.status(423).json({ success: false, locked: true, lockType: 'admin', message: 'Tài khoản đã bị khóa bởi quản trị viên. Vui lòng liên hệ hỗ trợ.' });
        }

        const now = Date.now();
        if (user.role !== 'admin') {
            if (user.lockUntil && user.lockUntil > now) {
                return res.status(423).json({ success: false, locked: true, lockType: 'temp', lockUntil: user.lockUntil, message: 'Tài khoản tạm thời bị khóa do nhập sai quá nhiều lần.' });
            }
            if (user.lockUntil && user.lockUntil <= now) {
                user.loginAttempts = 0;
                user.lockUntil = null;
            }
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            if (user.role !== 'admin') {
                user.loginAttempts = (user.loginAttempts || 0) + 1;
                const attempts = user.loginAttempts;
                let lockMinutes = 0;
                if (attempts >= 20) lockMinutes = 60;
                else if (attempts >= 15) lockMinutes = 30;
                else if (attempts >= 10) lockMinutes = 15;
                else if (attempts >= 5) lockMinutes = 5;

                if (lockMinutes > 0) {
                    user.lockUntil = new Date(now + lockMinutes * 60 * 1000);
                    await user.save();
                    return res.status(423).json({ success: false, locked: true, lockType: 'temp', lockUntil: user.lockUntil, message: `Nhập sai quá nhiều lần. Tài khoản bị khóa ${lockMinutes} phút.` });
                }
                await user.save();
            }
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Reset lockout, update lastLoginAt
        user.loginAttempts = 0;
        user.lockUntil = null;
        user.lastLoginAt = Date.now();
        await user.save();

        // Regen energy on login
        const stats = await UserStats.findOne({ userId: user._id });
        if (stats) {
            applyEnergyRegen(stats);
            await stats.save();
        }

        const token = user.generateToken();
        const fullState = await buildFullState(user._id);

        res.json({ success: true, message: 'Login successful', token, user: fullState });
    } catch (error) {
        logger.error('Login error:', error);
        next(error);
    }
};

const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Update lastLoginAt if it's a new day (so daily leaderboard reflects active users)
        const now = new Date();
        const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0);
        if (!user.lastLoginAt || new Date(user.lastLoginAt) < todayMidnight) {
            user.lastLoginAt = now;
            await user.save();
        }

        const stats = await UserStats.findOne({ userId: user._id });
        if (stats) {
            applyEnergyRegen(stats);
            await stats.save();
        }

        const fullState = await buildFullState(user._id);
        res.json({ success: true, data: fullState });
    } catch (error) {
        logger.error('GetMe error:', error);
        next(error);
    }
};

const updateProfile = async (req, res, next) => {
    try {
        const { username, avatar, settings } = req.body;

        const profile = await UserProfile.findOne({ userId: req.user.id });
        if (!profile) return res.status(404).json({ success: false, message: 'User not found' });

        if (username && username !== profile.username) {
            const existing = await UserProfile.findOne({ username, userId: { $ne: req.user.id } });
            if (existing) return res.status(400).json({ success: false, message: 'Username already taken' });
            profile.username = username;
        }

        if (avatar) profile.avatar = avatar;

        if (settings) {
            Object.assign(profile.settings, settings);
            profile.markModified('settings');
        }

        await profile.save();

        const fullState = await buildFullState(req.user.id);
        res.json({ success: true, message: 'Profile updated successfully', data: fullState });
    } catch (error) {
        logger.error('UpdateProfile error:', error);
        next(error);
    }
};

const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Please provide current and new password' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user.id).select('+password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

        const isSame = await bcrypt.compare(newPassword, user.password);
        if (isSame) return res.status(400).json({ success: false, message: 'New password cannot be the same as current password' });

        user.password = newPassword;
        await user.save();

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        logger.error('ChangePassword error:', error);
        next(error);
    }
};

const logout = async (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
};

// ===================================
// FORGOT PASSWORD
// ===================================

const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Vui lòng nhập email' });

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.json({ success: true, message: 'Nếu email tồn tại, mã sẽ được gửi đến hộp thư của bạn' });

        const normalEmail = email.toLowerCase().trim();
        await OtpCode.deleteMany({ email: normalEmail, type: 'reset' });

        const code = generateOtp();
        const hashedCode = await bcrypt.hash(code, 10);
        const otpDoc = await OtpCode.create({
            email: normalEmail,
            code: hashedCode,
            type: 'reset',
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        });

        // Respond immediately — email sends in background
        res.json({ success: true, message: 'Mã xác nhận đã được gửi đến email của bạn' });

        dispatchEmail(email, code, 'reset', `reset-${otpDoc._id}`)
            .catch(err => logger.error('Background reset email failed', { to: email, error: err.message }));
    } catch (error) {
        logger.error('ForgotPassword error:', error);
        next(error);
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) return res.status(400).json({ success: false, message: 'Thiếu thông tin' });
        if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Mật khẩu phải ít nhất 6 ký tự' });

        const otp = await OtpCode.findOne({ email: email.toLowerCase().trim(), type: 'reset' });
        if (!otp) return res.status(400).json({ success: false, message: 'Mã không hợp lệ hoặc đã hết hạn' });

        if (otp.attempts >= 5) {
            await otp.deleteOne();
            return res.status(400).json({ success: false, message: 'Quá nhiều lần thử sai. Vui lòng yêu cầu mã mới.' });
        }

        const isMatch = await bcrypt.compare(code.trim(), otp.code);
        if (!isMatch) {
            otp.attempts += 1;
            await otp.save();
            return res.status(400).json({ success: false, message: `Mã không đúng. Còn ${5 - otp.attempts} lần thử.` });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });

        const isSame = await user.comparePassword(newPassword);
        if (isSame) return res.status(400).json({ success: false, message: 'Mật khẩu mới không được giống mật khẩu cũ' });

        user.password = newPassword;
        await user.save();
        await otp.deleteOne();

        res.json({ success: true, message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.' });
    } catch (error) {
        logger.error('ResetPassword error:', error);
        next(error);
    }
};

// ===================================
// OTP REGISTER FLOW
// ===================================

const sendRegisterOtp = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin' });
        if (password.length < 6) return res.status(400).json({ success: false, message: 'Mật khẩu phải ít nhất 6 ký tự' });
        if (username.trim().length < 3 || username.length > 20) return res.status(400).json({ success: false, message: 'Username phải 3-20 ký tự' });

        const normalEmail = email.toLowerCase().trim();
        const normalUsername = username.trim();

        const [existingUser, existingProfile] = await Promise.all([
            User.findOne({ email: normalEmail }),
            UserProfile.findOne({ username: normalUsername }),
        ]);

        if (existingUser) return res.status(400).json({ success: false, message: 'Email này đã được đăng ký' });
        if (existingProfile) return res.status(400).json({ success: false, message: 'Username đã được sử dụng' });

        const passwordHash = await bcrypt.hash(password, 10);
        await OtpCode.deleteMany({ email: normalEmail, type: 'register' });

        const code = generateOtp();
        const hashedCode = await bcrypt.hash(code, 10);
        const otpDoc = await OtpCode.create({
            email: normalEmail,
            code: hashedCode,
            type: 'register',
            userData: { username: normalUsername, passwordHash },
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        });

        // Respond immediately — email sends in background
        res.json({ success: true, message: 'Mã xác nhận đã được gửi đến email của bạn' });

        dispatchEmail(email, code, 'register', `register-${otpDoc._id}`)
            .catch(err => logger.error('Background register email failed', { to: email, error: err.message }));
    } catch (error) {
        logger.error('SendRegisterOtp error:', error);
        next(error);
    }
};

const verifyRegisterOtp = async (req, res, next) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ success: false, message: 'Thiếu thông tin' });

        const otp = await OtpCode.findOne({ email: email.toLowerCase().trim(), type: 'register' });
        if (!otp) return res.status(400).json({ success: false, message: 'Mã không hợp lệ hoặc đã hết hạn' });

        if (otp.attempts >= 5) {
            await otp.deleteOne();
            return res.status(400).json({ success: false, message: 'Quá nhiều lần thử sai. Vui lòng đăng ký lại.' });
        }

        const isMatch = await bcrypt.compare(code.trim(), otp.code);
        if (!isMatch) {
            otp.attempts += 1;
            await otp.save();
            return res.status(400).json({ success: false, message: `Mã không đúng. Còn ${5 - otp.attempts} lần thử.` });
        }

        const { username, passwordHash } = otp.userData;

        // Race condition check
        const [existingUser, existingProfile] = await Promise.all([
            User.findOne({ email: otp.email }),
            UserProfile.findOne({ username }),
        ]);
        if (existingUser || existingProfile) {
            await otp.deleteOne();
            return res.status(400).json({ success: false, message: 'Tài khoản đã tồn tại' });
        }

        const { user } = await createUserWithDependents({
            email: otp.email,
            passwordHash,
            username,
            skipPasswordHash: true,
        });

        await otp.deleteOne();

        const token = user.generateToken();
        const fullState = await buildFullState(user._id);

        res.status(201).json({ success: true, message: 'Đăng ký thành công!', token, user: fullState });
    } catch (error) {
        logger.error('VerifyRegisterOtp error:', error);
        next(error);
    }
};

// Direct register (non-OTP path — kept for backward compat / admin use)
const register = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide username, email and password' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const normalEmail = email.toLowerCase().trim();
        const normalUsername = username.trim();

        const [existingUser, existingProfile] = await Promise.all([
            User.findOne({ email: normalEmail }),
            UserProfile.findOne({ username: normalUsername }),
        ]);

        if (existingUser) return res.status(400).json({ success: false, message: 'Email already registered' });
        if (existingProfile) return res.status(400).json({ success: false, message: 'Username already taken' });

        const { user } = await createUserWithDependents({ email: normalEmail, passwordHash: password, username: normalUsername });

        const token = user.generateToken();
        const fullState = await buildFullState(user._id);

        res.status(201).json({ success: true, message: 'Registration successful', token, user: fullState });
    } catch (error) {
        logger.error('Register error:', error);
        next(error);
    }
};

const checkLock = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email required' });

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.json({ success: true, locked: false });
        if (user.isLocked) return res.json({ success: true, locked: true, lockType: 'admin' });

        const now = Date.now();
        if (user.lockUntil && user.lockUntil > now) {
            return res.json({ success: true, locked: true, lockType: 'temp', lockUntil: user.lockUntil });
        }

        return res.json({ success: true, locked: false });
    } catch (error) {
        next(error);
    }
};

// syncProgress is kept for backward compat — delegates to saveState logic via UserStats
const syncProgress = async (req, res, next) => {
    try {
        const { resources, progress, streak, settings } = req.body;

        const [profile, stats] = await Promise.all([
            UserProfile.findOne({ userId: req.user.id }),
            UserStats.findOne({ userId: req.user.id }),
        ]);

        if (!profile || !stats) return res.status(404).json({ success: false, message: 'User not found' });

        applyEnergyRegen(stats);

        if (resources) {
            if (resources.energy !== undefined) stats.energy = resources.energy;
            if (resources.maxEnergy !== undefined) stats.maxEnergy = resources.maxEnergy;
            if (resources.coins !== undefined) stats.coins = resources.coins;
            if (resources.gems !== undefined) stats.gems = resources.gems;
            if (resources.hints !== undefined) stats.hints = resources.hints;
            if (resources.shields !== undefined) stats.shields = resources.shields;
            if (resources.timeFreezes !== undefined) stats.timeFreezes = resources.timeFreezes;
        }

        if (progress) {
            if (progress.wordsLearned) stats.wordsLearned = progress.wordsLearned;
            if (progress.wordsMastered) stats.wordsMastered = progress.wordsMastered;
            if (progress.totalGamesPlayed !== undefined) stats.totalGamesPlayed = progress.totalGamesPlayed;
            if (progress.totalCorrectAnswers !== undefined) stats.totalCorrectAnswers = progress.totalCorrectAnswers;
            if (progress.totalWrongAnswers !== undefined) stats.totalWrongAnswers = progress.totalWrongAnswers;
            if (progress.perfectRounds !== undefined) stats.perfectRounds = progress.perfectRounds;
            if (progress.highestScore !== undefined) stats.highestScore = progress.highestScore;
            if (progress.totalPlayTime !== undefined) stats.totalPlayTime = progress.totalPlayTime;
            if (progress.modeStats) stats.modeStats = new Map(Object.entries(progress.modeStats));
        }

        if (streak) {
            if (streak.current !== undefined) stats.streakCurrent = streak.current;
            if (streak.longest !== undefined) stats.streakLongest = streak.longest;
            if (streak.lastPlayDate) stats.streakLastPlayDate = new Date(streak.lastPlayDate);
            if (streak.shieldsUsed !== undefined) stats.streakShieldsUsed = streak.shieldsUsed;
        }

        if (settings) {
            Object.assign(profile.settings, settings);
            profile.markModified('settings');
            await profile.save();
        }

        await stats.save();

        const fullState = await buildFullState(req.user.id);
        res.json({ success: true, message: 'Progress synced successfully', data: fullState });
    } catch (error) {
        logger.error('SyncProgress error:', error);
        next(error);
    }
};

module.exports = {
    register,
    login,
    logout,
    getMe,
    updateProfile,
    changePassword,
    syncProgress,
    forgotPassword,
    resetPassword,
    sendRegisterOtp,
    verifyRegisterOtp,
    checkLock,
};
