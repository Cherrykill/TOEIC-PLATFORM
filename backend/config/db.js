const fs = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');

// ===================================
// JSON DATABASE PATHS
// ===================================
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DEFAULT_VOCABULARY_FILE = path.join(__dirname, '..', 'public', 'data', 'vocabulary.json');
const PRACTICE_SESSIONS_FILE = path.join(DATA_DIR, 'practice-sessions.json');

// ===================================
// IN-MEMORY CACHE
// ===================================
let usersCache = null;
let vocabularyCache = null;
let practiceSessionsCache = null;

// Track current vocabulary file (for save operations)
let currentVocabularyFile = DEFAULT_VOCABULARY_FILE;

// ===================================
// HELPER FUNCTIONS
// ===================================

/**
 * Ensure data directory exists
 */
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

/**
 * Read JSON file with error handling
 */
async function readJSONFile(filePath, defaultValue = []) {
    try {
        await fs.access(filePath);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, create it with default value
            await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
            return defaultValue;
        }
        throw error;
    }
}

/**
 * Write JSON file with error handling
 */
async function writeJSONFile(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ===================================
// DATABASE CONNECTION (JSON)
// ===================================

const connectDB = async () => {
    try {
        logger.info('Loading JSON database...');

        await ensureDataDir();

        usersCache = await readJSONFile(USERS_FILE, []);
        vocabularyCache = await readJSONFile(DEFAULT_VOCABULARY_FILE, []);
        practiceSessionsCache = await readJSONFile(PRACTICE_SESSIONS_FILE, []);
        currentVocabularyFile = DEFAULT_VOCABULARY_FILE;

        logger.info('JSON Database Loaded', {
            users: usersCache.length,
            vocabulary: vocabularyCache.length,
            practiceSessions: practiceSessionsCache.length,
        });

        return { success: true };
    } catch (error) {
        logger.error('Database Loading Error', { error: error.message });
        throw error;
    }
};

const closeConnection = async () => {
    logger.info('JSON Database closed');
};

// ===================================
// DATA ACCESS FUNCTIONS
// ===================================

/**
 * Get all users from cache
 */
function getUsers() {
    return usersCache || [];
}

/**
 * Save users to file and update cache
 */
async function saveUsers(users) {
    usersCache = users;
    await writeJSONFile(USERS_FILE, users);
}

/**
 * Get all vocabulary from cache
 */
function getVocabulary() {
    return vocabularyCache || [];
}

/**
 * Save vocabulary to current file and update cache
 */
async function saveVocabulary(vocabulary) {
    vocabularyCache = vocabulary;
    await writeJSONFile(currentVocabularyFile, vocabulary);
    logger.info('Vocabulary saved', { count: vocabulary.length, file: path.basename(currentVocabularyFile) });
}

/**
 * Load vocabulary from a specific file into cache
 * Also sets this file as current working file for save operations
 * @param {string} filePath - Full path to the JSON file
 */
async function loadVocabularyFromFile(filePath) {
    const data = await readJSONFile(filePath, []);
    vocabularyCache = data;
    currentVocabularyFile = filePath; // Track for saving
    logger.info('Vocabulary file loaded', { file: path.basename(filePath), count: data.length });
    return data;
}

/**
 * Get all practice sessions from cache
 */
function getPracticeSessions() {
    return practiceSessionsCache || [];
}

/**
 * Save practice sessions to file and update cache
 */
async function savePracticeSessions(sessions) {
    practiceSessionsCache = sessions;
    await writeJSONFile(PRACTICE_SESSIONS_FILE, sessions);
}

/**
 * Find user by username
 */
function findUserByUsername(username) {
    return usersCache.find(u => u.username === username);
}

/**
 * Find user by ID
 */
function findUserById(id) {
    return usersCache.find(u => u.id === id);
}

/**
 * Find user by email
 */
function findUserByEmail(email) {
    return usersCache.find(u => u.email === email);
}

module.exports = {
    connectDB,
    closeConnection,
    getUsers,
    saveUsers,
    getVocabulary,
    saveVocabulary,
    loadVocabularyFromFile,
    getPracticeSessions,
    savePracticeSessions,
    findUserByUsername,
    findUserById,
    findUserByEmail,
};
