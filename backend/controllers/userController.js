// ===================================
// USER CONTROLLER (JSON-based)
// ===================================

const bcrypt = require('bcryptjs');
const db = require('../config/db');
const activityLogger = require('../utils/activityLogger');

// ===================================
// CONTROLLER FUNCTIONS
// ===================================

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  Public (should be protected in production)
 */
exports.getAllUsers = async (req, res, next) => {
    try {
        const users = db.getUsers();

        // Remove password from response
        const sanitizedUsers = users.map(u => {
            const { password, token, ...userWithoutSensitive } = u;
            return userWithoutSensitive;
        });

        res.json({
            success: true,
            count: sanitizedUsers.length,
            data: sanitizedUsers,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  Public
 */
exports.getUserById = async (req, res, next) => {
    try {
        const user = db.findUserById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Remove sensitive data
        const { password, token, ...userWithoutSensitive } = user;

        res.json({
            success: true,
            data: userWithoutSensitive,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create new user (Admin)
 * @route   POST /api/users
 * @access  Private/Admin
 */
exports.createUser = async (req, res, next) => {
    try {
        const { username, email, password, role = 'user' } = req.body;

        // Validate required fields
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required',
            });
        }

        const users = db.getUsers();

        // Check if username already exists
        const existingUser = users.find(u => u.username === username);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username already exists',
            });
        }

        // Check if email already exists
        if (email) {
            const existingEmail = users.find(u => u.email === email);
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists',
                });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate new ID
        const newId = users.length > 0
            ? String(Math.max(...users.map(u => parseInt(u.id))) + 1)
            : '1';

        // Create new user
        const newUser = {
            id: newId,
            username,
            email: email || '',
            password: hashedPassword,
            role,
            level: 1,
            xp: 0,
            totalXp: 0,
            resources: {
                energy: 100,
                maxEnergy: 100,
                coins: 0,
                gems: 0,
                hints: 0,
                shields: 0,
                lastEnergyUpdate: new Date().toISOString(),
            },
            progress: {
                wordsLearned: [],
                wordsMastered: [],
                totalGamesPlayed: 0,
                totalCorrectAnswers: 0,
                totalWrongAnswers: 0,
                perfectRounds: 0,
                highestScore: 0,
                totalPlayTime: 0,
                modeStats: {},
            },
            streak: {
                current: 0,
                longest: 0,
                lastPlayDate: null,
                shieldsUsed: 0,
            },
            achievements: [],
            settings: {
                soundEnabled: true,
                soundEffects: true,
                volume: 70,
                notificationsEnabled: true,
                difficulty: 'medium',
            },
            isActive: true,
            createdAt: new Date().toISOString(),
        };

        users.push(newUser);
        await db.saveUsers(users);

        // Log activity
        await activityLogger.logActivity('user', 'add', {
            username: newUser.username,
            email: newUser.email,
            role: newUser.role
        });

        // Remove sensitive data from response
        const { password: _, ...userResponse } = newUser;

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: userResponse,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
exports.updateUser = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { username, email, password, role } = req.body;

        const users = db.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Check if new username already exists
        if (username && username !== users[userIndex].username) {
            const existingUser = users.find(u => u.username === username && u.id !== userId);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Username already exists',
                });
            }
        }

        // Check if new email already exists
        if (email && email !== users[userIndex].email) {
            const existingEmail = users.find(u => u.email === email && u.id !== userId);
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists',
                });
            }
        }

        // Update user fields
        if (username) users[userIndex].username = username;
        if (email !== undefined) users[userIndex].email = email;
        if (role) users[userIndex].role = role;

        // Update password if provided
        if (password) {
            users[userIndex].password = await bcrypt.hash(password, 10);
        }

        users[userIndex].updatedAt = new Date().toISOString();

        await db.saveUsers(users);

        // Log activity
        await activityLogger.logActivity('user', 'update', {
            username: users[userIndex].username,
            email: users[userIndex].email,
            role: users[userIndex].role
        });

        // Remove sensitive data
        const { password: _, token, ...userResponse } = users[userIndex];

        res.json({
            success: true,
            message: 'User updated successfully',
            data: userResponse,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res, next) => {
    try {
        const userId = req.params.id;

        const users = db.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Don't allow deleting the last admin
        const user = users[userIndex];
        if (user.role === 'admin') {
            const adminCount = users.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete the last admin user',
                });
            }
        }

        // Remove user
        const deletedUser = users.splice(userIndex, 1)[0];
        await db.saveUsers(users);

        // Log activity
        await activityLogger.logActivity('user', 'delete', {
            username: deletedUser.username,
            email: deletedUser.email,
            role: deletedUser.role
        });

        // Remove sensitive data
        const { password, token, ...userResponse } = deletedUser;

        res.json({
            success: true,
            message: 'User deleted successfully',
            data: userResponse,
        });

    } catch (error) {
        next(error);
    }
};
