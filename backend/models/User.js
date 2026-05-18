const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Please provide email'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
        },
        password: {
            type: String,
            required: [true, 'Please provide password'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false,
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        isActive: { type: Boolean, default: true },
        isLocked: { type: Boolean, default: false },
        loginAttempts: { type: Number, default: 0 },
        lockUntil: { type: Date, default: null },
        lastLoginAt: { type: Date, default: Date.now },
        token: { type: String, select: false },
        favoriteWords: {
            type: [{
                en: { type: String, required: true },
                vn: { type: String, default: '' },
                phonetic: { type: String, default: '' },
                synonyms: { type: String, default: '' },
                part: { type: String, default: '' },
                _id: false,
            }],
            default: [],
        },
    },
    {
        timestamps: true,
        collection: 'users',
        versionKey: false,
    }
);

UserSchema.pre('save', async function () {
    if (!this.isModified('password') || this.$skipPasswordHash) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.generateToken = function () {
    return jwt.sign(
        { id: this._id, role: this.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

module.exports = mongoose.model('User', UserSchema);
